import { createServerFn } from "@tanstack/react-start";

export interface ScoutedTeam {
  name: string;
  tag: string;
  logo?: string;
  players?: string[];
  coach?: string;
  region?: string;
}

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const scoutTeams = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; game: "lol" | "cs2"; rankingTop?: number }) => {
    const query = String(input?.query ?? "").trim();
    const rankingTopRaw = Number(input?.rankingTop ?? 0);
    const rankingTop = [10, 20, 30, 50].includes(rankingTopRaw) ? rankingTopRaw : 0;
    if (!rankingTop && (!query || query.length > 160)) throw new Error("Consulta inválida");
    return {
      query,
      game: input.game === "cs2" ? ("cs2" as const) : ("lol" as const),
      rankingTop,
    };
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const fcKey = process.env["FIRECRAWL_API_KEY"];
    if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente");
    if (!fcKey) throw new Error("Conector Firecrawl não está conectado");

    const gameLabel = data.game === "cs2" ? "Counter-Strike 2" : "League of Legends";
    const sites = data.game === "cs2" ? "liquipedia.net/counterstrike OR hltv.org" : "liquipedia.net/leagueoflegends OR lol.fandom.com";

    const rankingMode = data.game === "cs2" && data.rankingTop > 0;

    type Hit = { url?: string; title?: string; markdown?: string; description?: string };
    let results: Hit[] = [];

    if (rankingMode) {
      // HLTV bloqueia scraping com frequência (502/403), então tentamos várias
      // fontes espelho até uma responder com conteúdo utilizável.
      const candidates = [
        {
          url: "https://egamersworld.com/counterstrike/teams/ranking/hltv",
          title: "HLTV World Ranking (espelho)",
        },
        { url: "https://www.hltv.org/ranking/teams", title: "HLTV World Ranking" },
        { url: "https://www.hltv.org/valve-ranking/teams", title: "Valve Global Ranking" },
      ];
      let lastStatus = 0;
      for (const c of candidates) {
        try {
          const scrapeRes = await fetch(`${GATEWAY}/scrape`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": fcKey,
            },
            body: JSON.stringify({
              url: c.url,
              formats: ["markdown"],
              onlyMainContent: true,
              waitFor: 3000,
            }),
          });
          if (!scrapeRes.ok) {
            lastStatus = scrapeRes.status;
            console.error(`Firecrawl scrape falhou [${scrapeRes.status}] em ${c.url}: ${await scrapeRes.text()}`);
            continue;
          }
          const j = (await scrapeRes.json()) as { markdown?: string; data?: { markdown?: string } };
          const md = j.markdown ?? j.data?.markdown ?? "";
          if (md.trim().length > 500) {
            results = [{ url: c.url, title: c.title, markdown: md }];
            break;
          }
        } catch (e) {
          console.error(`Erro ao raspar ${c.url}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (results.length === 0) {
        // Último recurso: busca web com conteúdo raspado dos resultados.
        const fallback = await fetch(`${GATEWAY}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": fcKey,
          },
          body: JSON.stringify({
            query: `HLTV world ranking top ${data.rankingTop} teams current`,
            limit: 3,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });
        if (fallback.ok) {
          const fj = (await fallback.json()) as { data?: Hit[] | { web?: Hit[]; results?: Hit[] }; web?: Hit[] };
          results = Array.isArray(fj.data) ? fj.data : (fj.data?.web ?? fj.data?.results ?? fj.web ?? []);
        } else {
          console.error(`Fallback de busca falhou [${fallback.status}]: ${await fallback.text()}`);
        }
      }

      if (results.length === 0) {
        throw new Error(
          `O HLTV bloqueou a leitura agora${lastStatus ? ` [${lastStatus}]` : ""}. Tente de novo em instantes.`,
        );
      }
    }

    const searchRes = rankingMode ? null : await fetch(`${GATEWAY}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": fcKey,
      },
      body: JSON.stringify({
        query: `${data.query} ${gameLabel} teams rosters ${sites}`,
        limit: 4,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (searchRes && !searchRes.ok) {
      const body = await searchRes.text();
      console.error(`Firecrawl search falhou [${searchRes.status}]: ${body}`);
      throw new Error(`Busca web falhou [${searchRes.status}]`);
    }

    if (searchRes) {
      const searchJson = (await searchRes.json()) as {
        data?: Hit[] | { web?: Hit[]; results?: Hit[] };
        web?: Hit[];
      };
      results = Array.isArray(searchJson.data)
        ? searchJson.data
        : (searchJson.data?.web ?? searchJson.data?.results ?? searchJson.web ?? []);
    }
    // Páginas de wiki vêm com muito lixo de navegação: pegamos o resumo + os
    // trechos ao redor das seções que realmente listam times/escalações.
    const relevantSlices = (md?: string) => {
      if (!md) return "";
      if (rankingMode) return md.slice(0, 40000);
      const keys = ["Participating Teams", "Participants", "Teams", "Roster", "Group Stage", "Playoffs"];
      const low = md.toLowerCase();
      const parts: string[] = [];
      for (const k of keys) {
        const i = low.indexOf(k.toLowerCase());
        if (i >= 0) parts.push(md.slice(i, i + 6000));
      }
      return parts.join("\n").slice(0, 14000);
    };

    const context = results
      .map(
        (r) =>
          `# ${r.title ?? ""}\n${r.url ?? ""}\n${(r.description ?? "").slice(0, 8000)}\n${relevantSlices(r.markdown)}`,
      )
      .join("\n\n---\n\n")
      .slice(0, 70000);

    if (!context.trim()) return { teams: [] as ScoutedTeam[], sources: [] as string[] };

    const aiRes = await fetch(AI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você extrai dados de esports de conteúdo web e responde APENAS JSON válido no formato " +
              '{"teams":[{"name":string,"tag":string,"logo":string|null,"players":string[],"coach":string|null,"region":string|null}]}. ' +
              (rankingMode
                ? `O conteúdo é o HLTV World Ranking. Liste EXATAMENTE os ${data.rankingTop} primeiros times na ordem do ranking (#1 primeiro). `
                : "Liste TODOS os times participantes citados no conteúdo (seções de times participantes, tabelas, brackets). ") +
              "tag = sigla curta em maiúsculas (máx 5). logo = URL https de imagem do time se aparecer; senão null. " +
              "players = nicks da line atual (até 5) ou []. Não invente times fora do conteúdo. " +
              "Nunca retorne lista vazia se houver qualquer nome de time no conteúdo. " +
              (rankingMode ? `Máximo ${data.rankingTop} times.` : "Máximo 24 times."),
          },
          {
            role: "user",
            content: `Jogo: ${gameLabel}\nBusca do usuário: ${rankingMode ? `Top ${data.rankingTop} do HLTV World Ranking` : data.query}\n\nConteúdo web:\n${context}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text();
      console.error(`AI gateway falhou [${aiRes.status}]: ${body}`);
      if (aiRes.status === 429) throw new Error("Limite de requisições da IA atingido. Tente de novo em instantes.");
      if (aiRes.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(`IA falhou [${aiRes.status}]`);
    }

    const aiJson = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { teams?: ScoutedTeam[] } = {};
    try {
      parsed = JSON.parse(raw) as { teams?: ScoutedTeam[] };
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]) as { teams?: ScoutedTeam[] };
        } catch {
          parsed = {};
        }
      }
    }

    const teams: ScoutedTeam[] = (parsed.teams ?? [])
      .filter((t) => t && typeof t.name === "string" && t.name.trim())
      .slice(0, rankingMode ? data.rankingTop : 24)
      .map((t) => ({
        name: String(t.name).trim().slice(0, 60),
        tag: String(t.tag ?? t.name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "TBD",
        logo: typeof t.logo === "string" && t.logo.startsWith("https://") ? t.logo : undefined,
        players: Array.isArray(t.players) ? t.players.filter((p) => typeof p === "string").slice(0, 5) : undefined,
        coach: typeof t.coach === "string" ? t.coach : undefined,
        region: typeof t.region === "string" ? t.region : undefined,
      }));

    return { teams, sources: results.map((r) => r.url ?? "").filter(Boolean) };
  });