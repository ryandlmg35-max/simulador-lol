import type { CareerLedger, Championship, Player, PlayerRole, Team } from "./types";
import { uid } from "./generate";
import { ensureRoster, getResolvedAttrs, hashStr } from "./players";
import { REAL_ROSTERS } from "./real-rosters";
import { GLOBAL_FREE_AGENT_POOL } from "./transfers";

export interface CountryMeta {
  code: string;
  name: string;
  selectionName: string;
  tag: string;
  colors: [string, string, string?];
}

const COUNTRY_META: Record<string, CountryMeta> = {
  KR: { code: "KR", name: "Coreia do Sul", selectionName: "Seleção Coreana", tag: "KOR", colors: ["#0047a0", "#cd2e3a", "#ffffff"] },
  CN: { code: "CN", name: "China", selectionName: "Seleção Chinesa", tag: "CHN", colors: ["#de2910", "#ffde00"] },
  BR: { code: "BR", name: "Brasil", selectionName: "Seleção Brasileira", tag: "BRA", colors: ["#009c3b", "#ffdf00", "#002776"] },
  US: { code: "US", name: "Estados Unidos", selectionName: "Seleção Americana", tag: "USA", colors: ["#b22234", "#3c3b6e", "#ffffff"] },
  CA: { code: "CA", name: "Canadá", selectionName: "Seleção Canadense", tag: "CAN", colors: ["#ff0000", "#ffffff"] },
  DK: { code: "DK", name: "Dinamarca", selectionName: "Seleção Dinamarquesa", tag: "DEN", colors: ["#c60c30", "#ffffff"] },
  FR: { code: "FR", name: "França", selectionName: "Seleção Francesa", tag: "FRA", colors: ["#0055a4", "#ef4135", "#ffffff"] },
  DE: { code: "DE", name: "Alemanha", selectionName: "Seleção Alemã", tag: "GER", colors: ["#000000", "#dd0000", "#ffce00"] },
  ES: { code: "ES", name: "Espanha", selectionName: "Seleção Espanhola", tag: "ESP", colors: ["#aa151b", "#f1bf00"] },
  PL: { code: "PL", name: "Polônia", selectionName: "Seleção Polonesa", tag: "POL", colors: ["#dc143c", "#ffffff"] },
  SE: { code: "SE", name: "Suécia", selectionName: "Seleção Sueca", tag: "SWE", colors: ["#006aa7", "#fecc00"] },
  GB: { code: "GB", name: "Reino Unido", selectionName: "Seleção Britânica", tag: "GBR", colors: ["#012169", "#c8102e", "#ffffff"] },
  NL: { code: "NL", name: "Países Baixos", selectionName: "Seleção Holandesa", tag: "NED", colors: ["#ae1c28", "#21468b", "#ffffff"] },
  BE: { code: "BE", name: "Bélgica", selectionName: "Seleção Belga", tag: "BEL", colors: ["#000000", "#fae042", "#ed2939"] },
  TR: { code: "TR", name: "Turquia", selectionName: "Seleção Turca", tag: "TUR", colors: ["#e30a17", "#ffffff"] },
  TW: { code: "TW", name: "Taiwan", selectionName: "Seleção Taiwanesa", tag: "TPE", colors: ["#000095", "#fe0000", "#ffffff"] },
  VN: { code: "VN", name: "Vietnã", selectionName: "Seleção Vietnamita", tag: "VIE", colors: ["#da251d", "#ffff00"] },
  JP: { code: "JP", name: "Japão", selectionName: "Seleção Japonesa", tag: "JPN", colors: ["#bc002d", "#ffffff"] },
  AU: { code: "AU", name: "Austrália", selectionName: "Seleção Australiana", tag: "AUS", colors: ["#00008b", "#ff0000", "#ffffff"] },
  HK: { code: "HK", name: "Hong Kong", selectionName: "Seleção de Hong Kong", tag: "HKG", colors: ["#de2910", "#ffffff"] },
  CZ: { code: "CZ", name: "República Tcheca", selectionName: "Seleção Tcheca", tag: "CZE", colors: ["#11457e", "#d7141a", "#ffffff"] },
  NO: { code: "NO", name: "Noruega", selectionName: "Seleção Norueguesa", tag: "NOR", colors: ["#ba0c2f", "#00205b", "#ffffff"] },
  PT: { code: "PT", name: "Portugal", selectionName: "Seleção Portuguesa", tag: "POR", colors: ["#006600", "#ff0000", "#ffcc00"] },
  SG: { code: "SG", name: "Singapura", selectionName: "Seleção de Singapura", tag: "SGP", colors: ["#ef3340", "#ffffff"] },
  AR: { code: "AR", name: "Argentina", selectionName: "Seleção Argentina", tag: "ARG", colors: ["#74acdf", "#ffffff", "#f6b40e"] },
  CL: { code: "CL", name: "Chile", selectionName: "Seleção Chilena", tag: "CHI", colors: ["#0039a6", "#d52b1e", "#ffffff"] },
};

const COUNTRY_ALIASES: Record<string, string> = {
  BRA: "BR",
  BRASIL: "BR",
  BRAZIL: "BR",
  KOR: "KR",
  KOREA: "KR",
  "SOUTH KOREA": "KR",
  CHN: "CN",
  CHINA: "CN",
  USA: "US",
  CAN: "CA",
  DEN: "DK",
  DNK: "DK",
  FRA: "FR",
  GER: "DE",
  DEU: "DE",
  ESP: "ES",
  POL: "PL",
  SWE: "SE",
  UK: "GB",
  ENG: "GB",
  GBR: "GB",
  NED: "NL",
  NLD: "NL",
  TUR: "TR",
  TWN: "TW",
  TPE: "TW",
  VIE: "VN",
  VNM: "VN",
  JPN: "JP",
  AUS: "AU",
  ARG: "AR",
  CHI: "CL",
  CHL: "CL",
};

export function normalizeCountryCode(raw?: string): string | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase();
  if (!clean || clean === "INT" || clean === "EU" || clean === "OUTROS") return null;
  if (COUNTRY_ALIASES[clean]) return COUNTRY_ALIASES[clean];
  if (clean.length === 2) return clean;
  return null;
}

export function getCountryMeta(code: string): CountryMeta {
  const c = code.toUpperCase();
  if (COUNTRY_META[c]) return COUNTRY_META[c];
  return {
    code: c,
    name: c,
    selectionName: `Seleção (${c})`,
    tag: c.slice(0, 3),
    colors: ["#38bdf8", "#eab308", "#0f172a"],
  };
}

function buildRealFlagLogo(code: string): string {
  const clean = code.trim().toLowerCase();
  const iso = clean === "uk" ? "gb" : clean;
  return `https://flagcdn.com/w160/${iso}.png`;
}

interface CoachCandidate {
  name: string;
  country: string;
  clubHint?: string;
  baseRating: number;
}

const REAL_COACHES_BY_COUNTRY: Record<string, CoachCandidate[]> = {
  KR: [
    { name: "kkOma", country: "KR", clubHint: "T1", baseRating: 92 },
    { name: "KIM", country: "KR", clubHint: "Gen.G", baseRating: 90 },
    { name: "DanDy", country: "KR", clubHint: "Hanwha Life", baseRating: 87 },
    { name: "Homme", country: "KR", clubHint: "TOP Esports", baseRating: 89 },
    { name: "Score", country: "KR", clubHint: "KT Rolster", baseRating: 86 },
  ],
  CN: [
    { name: "Tabe", country: "CN", clubHint: "Anyone's Legend", baseRating: 90 },
    { name: "Maokai", country: "CN", clubHint: "Bilibili Gaming", baseRating: 87 },
    { name: "KenZhu", country: "CN", clubHint: "JD Gaming", baseRating: 86 },
    { name: "Clearlove", country: "CN", clubHint: "EDward Gaming", baseRating: 85 },
  ],
  BR: [
    { name: "Djoko", country: "BR", clubHint: "paiN Gaming", baseRating: 83 },
    { name: "Turtle", country: "BR", clubHint: "LOUD", baseRating: 82 },
    { name: "Von", country: "BR", clubHint: "RED Canids", baseRating: 81 },
    { name: "Halier", country: "BR", clubHint: "Fluxo", baseRating: 80 },
    { name: "Kalec", country: "BR", clubHint: "Vivo Keyd", baseRating: 80 },
  ],
  US: [
    { name: "Thinkcard", country: "US", clubHint: "FlyQuest", baseRating: 82 },
    { name: "Inero", country: "US", clubHint: "Dignitas", baseRating: 80 },
    { name: "Zikz", country: "US", clubHint: "Team Liquid", baseRating: 81 },
  ],
  CA: [
    { name: "Dylan Falco", country: "CA", clubHint: "G2 Esports", baseRating: 88 },
  ],
  DE: [
    { name: "GrabbZ", country: "DE", clubHint: "Fnatic", baseRating: 85 },
  ],
  FR: [
    { name: "Striker", country: "FR", clubHint: "Karmine Corp", baseRating: 84 },
    { name: "Romain", country: "FR", clubHint: "G2 Esports", baseRating: 83 },
  ],
  ES: [
    { name: "Mithy", country: "ES", clubHint: "KOI", baseRating: 84 },
    { name: "Melzhet", country: "ES", clubHint: "Movistar KOI", baseRating: 83 },
  ],
  GB: [
    { name: "Mac", country: "GB", clubHint: "Team Vitality", baseRating: 84 },
  ],
  SE: [
    { name: "YamatoCannon", country: "SE", clubHint: "Fnatic", baseRating: 82 },
  ],
  DK: [
    { name: "Bjergsen", country: "DK", clubHint: "100 Thieves", baseRating: 83 },
    { name: "Svenskeren", country: "DK", clubHint: "Cloud9", baseRating: 80 },
  ],
  PL: [
    { name: "Hatchy", country: "PL", clubHint: "Team Heretics", baseRating: 79 },
  ],
  NL: [
    { name: "YoungBuck", country: "NL", clubHint: "SK Gaming", baseRating: 81 },
  ],
  NO: [
    { name: "Veigar v2", country: "NO", clubHint: "Cloud9", baseRating: 81 },
  ],
  PT: [
    { name: "Guilhoto", country: "PT", clubHint: "GIANTX", baseRating: 81 },
  ],
  TW: [
    { name: "WarHorse", country: "TW", clubHint: "PSG Talon", baseRating: 84 },
    { name: "Steak", country: "TW", clubHint: "CTBC Flying Oyster", baseRating: 83 },
  ],
  VN: [
    { name: "Archie", country: "VN", clubHint: "GAM Esports", baseRating: 82 },
    { name: "Tinikun", country: "VN", clubHint: "Vikings Esports", baseRating: 81 },
  ],
  TR: [
    { name: "FabFabulous", country: "TR", clubHint: "Papara SuperMassive", baseRating: 78 },
  ],
  JP: [
    { name: "Ceros", country: "JP", clubHint: "DetonatioN FocusMe", baseRating: 79 },
  ],
  AU: [
    { name: "Spawn", country: "AU", clubHint: "Team Liquid", baseRating: 84 },
  ],
};

export interface EvaluatedPlayerCandidate {
  player: Player;
  country: string;
  clubName: string;
  clubRegion: string;
  performanceScore: number;
  overall: number;
  wins: number;
  losses: number;
  mvps: number;
  form: number;
  isFreeAgent: boolean;
}

export interface WorldCupNationCallup {
  team: Team;
  country: CountryMeta;
  coach: string;
  coachReason: string;
  avgPerformance: number;
  starters: EvaluatedPlayerCandidate[];
  subs: EvaluatedPlayerCandidate[];
}

export interface WorldCupBuildResult {
  nations: WorldCupNationCallup[];
  teams: Team[];
  skippedCountries: { code: string; name: string; missingRoles: PlayerRole[]; availableCount: number }[];
}

const ALL_ROLES: PlayerRole[] = ["top", "jungle", "mid", "adc", "support"];

const normStr = (s?: string) => (s ?? "").trim().toLowerCase();

function computePlayerOverall(p: Player): number {
  const attrs = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
  return Math.round(
    attrs.mechanics * 0.35 +
      attrs.gameIq * 0.25 +
      attrs.clutch * 0.15 +
      attrs.mentality * 0.15 +
      attrs.intlExperience * 0.1,
  );
}

interface TeamSeasonStats {
  wins: number;
  losses: number;
  form: number;
  streak: number;
  isIntl: boolean;
  isChamp: boolean;
  teamName: string;
  region: string;
  coach?: string;
}

/**
 * Avalia todos os jogadores e técnicos do save por desempenho real na temporada,
 * sem restrição de liga (um jogador pode atuar em qualquer liga do mundo),
 * mas exigindo estritamente a nacionalidade do país (zero estrangeiros).
 * O número de seleções geradas é dinâmico conforme os países que fecham as 5 rotas.
 */
export function buildWorldCupNationalTeams(
  championships: Championship[],
  career?: CareerLedger,
): WorldCupBuildResult {
  const teamStatsMap = new Map<string, TeamSeasonStats>();
  const playerMvpCount = new Map<string, number>();
  const playerNetDelta = new Map<string, number>();
  const seenKeys = new Set<string>();
  const candidatesByCountry = new Map<string, EvaluatedPlayerCandidate[]>();

  // 1. Agrega estatísticas de partidas, MVPs, forma e evolução em TODOS os campeonatos do save
  for (const champ of championships) {
    const isIntl =
      champ.internationalLevel === "major" ||
      champ.internationalLevel === "minor" ||
      champ.isInternational === true;
    const allDivTeams = [...champ.teams, ...(champ.serieB?.teams ?? [])];
    const teamWinLoss = new Map<string, { w: number; l: number }>();

    const allPhases = [...champ.phases, ...(champ.serieB?.phases ?? [])];
    for (const phase of allPhases) {
      for (const m of phase.matches) {
        if (!m.winnerId || !m.teamAId || !m.teamBId || m.bye) continue;
        const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
        const wEntry = teamWinLoss.get(m.winnerId) ?? { w: 0, l: 0 };
        wEntry.w += 1;
        teamWinLoss.set(m.winnerId, wEntry);
        const lEntry = teamWinLoss.get(loserId) ?? { w: 0, l: 0 };
        lEntry.l += 1;
        teamWinLoss.set(loserId, lEntry);

        if (m.mvp) {
          const mvpKey = m.mvp.playerName ? normStr(m.mvp.playerName) : "";
          if (mvpKey) {
            playerMvpCount.set(mvpKey, (playerMvpCount.get(mvpKey) ?? 0) + 1);
          }
        }
        if (m.formEffect?.playerDeltas) {
          for (const [pid, delta] of Object.entries(m.formEffect.playerDeltas)) {
            const sum = Object.values(delta ?? {}).reduce((acc: number, v) => acc + (typeof v === "number" ? v : 0), 0);
            playerNetDelta.set(pid, (playerNetDelta.get(pid) ?? 0) + sum);
          }
        }
      }
    }

    const lastBracket = [...champ.phases].reverse().find((p) => p.kind === "bracket");
    const lastMatch = lastBracket?.matches.at(-1);
    const champWinnerId = lastMatch?.winnerId;

    for (const team of allDivTeams) {
      const wl = teamWinLoss.get(team.id) ?? { w: 0, l: 0 };
      const mom = champ.momentum?.[team.id];
      const existing = teamStatsMap.get(normStr(team.name));
      const form = mom?.form ?? 50;
      const streak = mom?.streak ?? 0;
      const isChamp = !!champWinnerId && champWinnerId === team.id;

      teamStatsMap.set(normStr(team.name), {
        wins: (existing?.wins ?? 0) + wl.w,
        losses: (existing?.losses ?? 0) + wl.l,
        form: existing ? Math.round((existing.form + form) / 2) : form,
        streak: existing ? Math.max(existing.streak, streak) : streak,
        isIntl: (existing?.isIntl ?? false) || isIntl,
        isChamp: (existing?.isChamp ?? false) || isChamp,
        teamName: team.name,
        region: team.region || champ.region || "",
        coach: team.coach || existing?.coach,
      });
    }
  }

  // 2. Coleta todos os jogadores ativos nas ligas (independentemente da liga onde jogam!)
  for (const champ of championships) {
    // Pula outras edições da própria Copa do Mundo para não reciclar seleções como clubes
    if (/copa do mundo|world cup|seleções|selecoes/i.test(champ.name)) continue;

    const allDivTeams = [...champ.teams, ...(champ.serieB?.teams ?? [])];
    for (const team of allDivTeams) {
      const roster = ensureRoster(team) ?? [];
      const tStats = teamStatsMap.get(normStr(team.name));
      const wins = tStats?.wins ?? 0;
      const losses = tStats?.losses ?? 0;
      const games = wins + losses;
      const winRate = games > 0 ? wins / games : 0.5;
      const form = tStats?.form ?? 50;
      const streak = tStats?.streak ?? 0;

      for (const p of roster) {
        const country = normalizeCountryCode(p.country);
        if (!country) continue;

        const key = `${normStr(p.ign)}|${p.role}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const overall = computePlayerOverall(p);
        const mvps = playerMvpCount.get(normStr(p.ign)) ?? 0;
        const netDelta = playerNetDelta.get(p.id) ?? 0;

        const performanceScore = Number(
          (
            overall +
            (form - 50) * 0.35 +
            Math.max(-5, Math.min(8, streak * 1.5)) +
            (winRate - 0.5) * 16 * Math.min(1, games / 6) +
            Math.min(10, mvps * 2.2) +
            Math.max(-6, Math.min(8, netDelta * 1.2)) +
            (tStats?.isIntl ? 2.5 : 0) +
            (tStats?.isChamp ? 3 : 0) +
            (p.sub ? -2 : 3)
          ).toFixed(1),
        );

        const list = candidatesByCountry.get(country) ?? [];
        list.push({
          player: p,
          country,
          clubName: team.name,
          clubRegion: team.region || champ.region || "INT",
          performanceScore,
          overall,
          wins,
          losses,
          mvps,
          form,
          isFreeAgent: false,
        });
        candidatesByCountry.set(country, list);
      }
    }
  }

  // 2.5. Escaneia elencos reais de todas as ligas do mundo (REAL_ROSTERS) para convocar
  // jogadores de países/ligas que ainda não foram criadas no save atual.
  for (const [leagueName, teams] of Object.entries(REAL_ROSTERS)) {
    for (const rt of teams) {
      for (const rp of rt.players) {
        const country = normalizeCountryCode(rp.country);
        if (!country) continue;
        const key = `${normStr(rp.ign)}|${rp.role}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const playerObj: Player = {
          id: `wc_rr_${hashStr(`${rp.ign}:${rp.role}`).toString(36)}`,
          ign: rp.ign,
          real: rp.real ?? undefined,
          role: rp.role,
          country,
          sub: rp.sub,
        };
        const overall = computePlayerOverall(playerObj);
        const list = candidatesByCountry.get(country) ?? [];
        list.push({
          player: playerObj,
          country,
          clubName: rt.name,
          clubRegion: leagueName,
          performanceScore: Number((overall - (rp.sub ? 5 : 1)).toFixed(1)),
          overall,
          wins: 0,
          losses: 0,
          mvps: 0,
          form: 50,
          isFreeAgent: false,
        });
        candidatesByCountry.set(country, list);
      }
    }
  }

  // 3. Completa com Agentes Livres Globais (apenas quem ainda não está em nenhum clube, com leve penalidade de inatividade)
  for (let i = 0; i < GLOBAL_FREE_AGENT_POOL.length; i++) {
    const fa = GLOBAL_FREE_AGENT_POOL[i];
    const country = normalizeCountryCode(fa.country);
    if (!country) continue;
    const key = `${normStr(fa.ign)}|${fa.role}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const playerObj: Player = {
      ...fa,
      id: `wc_fa_${hashStr(`${fa.ign}:${fa.role}`).toString(36)}`,
    };
    const overall = computePlayerOverall(playerObj);
    const list = candidatesByCountry.get(country) ?? [];
    list.push({
      player: playerObj,
      country,
      clubName: "Agente Livre",
      clubRegion: "FA",
      performanceScore: Number((overall - 10).toFixed(1)),
      overall,
      wins: 0,
      losses: 0,
      mvps: 0,
      form: 50,
      isFreeAgent: true,
    });
    candidatesByCountry.set(country, list);
  }

  // 4. Seleciona Técnico por desempenho para cada país elegível
  const selectCoachForCountry = (
    countryCode: string,
    starters: EvaluatedPlayerCandidate[],
  ): { coach: string; reason: string } => {
    const pool: { name: string; score: number; reason: string }[] = [];

    // Candidatos reais de clubes que já têm `coach` no save e jogam com jogadores desse país
    for (const s of starters) {
      if (s.isFreeAgent) continue;
      const tStats = teamStatsMap.get(normStr(s.clubName));
      if (tStats?.coach) {
        const g = tStats.wins + tStats.losses;
        const wr = g > 0 ? Math.round((tStats.wins / g) * 100) : 50;
        const sc = 78 + (wr - 50) * 0.25 + (tStats.isChamp ? 8 : 0) + (tStats.form - 50) * 0.2;
        pool.push({
          name: tStats.coach,
          score: sc,
          reason: `${tStats.coach} (${tStats.teamName} · ${wr}% WR${tStats.isChamp ? " · Campeão" : ""})`,
        });
      }
    }

    // Catálogo de técnicos nativos do país, pontuado pelo desempenho do clube correspondente no save
    const natives = REAL_COACHES_BY_COUNTRY[countryCode] ?? [];
    for (const c of natives) {
      const clubStats = c.clubHint ? teamStatsMap.get(normStr(c.clubHint)) : undefined;
      const g = clubStats ? clubStats.wins + clubStats.losses : 0;
      const wr = g > 0 && clubStats ? Math.round((clubStats.wins / g) * 100) : 50;
      const careerEntry = c.clubHint ? career?.lol?.[normStr(c.clubHint)] : undefined;
      const score =
        c.baseRating +
        (clubStats ? (wr - 50) * 0.28 + (clubStats.isChamp ? 7 : 0) + (clubStats.form - 50) * 0.2 : 0) +
        (careerEntry ? ((careerEntry.rating ?? 50) - 50) * 0.15 : 0);

      const reasonParts: string[] = [];
      if (clubStats && g > 0) {
        reasonParts.push(`${clubStats.teamName} · ${wr}% WR`);
        if (clubStats.isChamp) reasonParts.push("Campeão");
      } else if (c.clubHint) {
        reasonParts.push(c.clubHint);
      }
      pool.push({
        name: c.name,
        score,
        reason: reasonParts.length > 0 ? `${c.name} (${reasonParts.join(" · ")})` : `${c.name} (Comissão Técnica ${countryCode})`,
      });
    }

    if (pool.length > 0) {
      pool.sort((a, b) => b.score - a.score);
      return { coach: pool[0].name, reason: pool[0].reason };
    }

    const bestClub = starters.find((s) => !s.isFreeAgent);
    const fallbackName = `Comissão Técnica ${countryCode}`;
    return {
      coach: fallbackName,
      reason: bestClub
        ? `Base técnica de ${bestClub.clubName} (melhor desempenho ${countryCode})`
        : `Comissão Técnica Nacional (${countryCode})`,
    };
  };

  // 5. Monta apenas as seleções dos países que conseguem fechar as 5 rotas (número dinâmico!)
  const nations: WorldCupNationCallup[] = [];
  const skippedCountries: WorldCupBuildResult["skippedCountries"] = [];

  for (const [code, candidates] of candidatesByCountry.entries()) {
    const sorted = [...candidates].sort((a, b) => b.performanceScore - a.performanceScore);
    const starters: EvaluatedPlayerCandidate[] = [];
    const missingRoles: PlayerRole[] = [];
    const pickedIds = new Set<string>();

    for (const role of ALL_ROLES) {
      const best = sorted.find((c) => c.player.role === role);
      if (!best) {
        missingRoles.push(role);
      } else {
        starters.push(best);
        pickedIds.add(best.player.id);
      }
    }

    if (missingRoles.length > 0) {
      const meta = getCountryMeta(code);
      skippedCountries.push({
        code,
        name: meta.name,
        missingRoles,
        availableCount: candidates.length,
      });
      continue;
    }

    // Até 2 reservas (próximos melhores jogadores do mesmo país, preferindo rotas distintas)
    const subs: EvaluatedPlayerCandidate[] = [];
    const subRoles = new Set<PlayerRole>();
    for (const cand of sorted) {
      if (subs.length >= 2) break;
      if (pickedIds.has(cand.player.id)) continue;
      if (subRoles.has(cand.player.role) && subs.length === 0) continue;
      subs.push(cand);
      subRoles.add(cand.player.role);
      pickedIds.add(cand.player.id);
    }

    const meta = getCountryMeta(code);
    const { coach, reason } = selectCoachForCountry(code, starters);
    const avgPerformance = Number(
      (starters.reduce((s, x) => s + x.performanceScore, 0) / starters.length).toFixed(1),
    );

    const roster: Player[] = [
      ...starters.map((s) => ({ ...s.player, sub: false })),
      ...subs.map((s) => ({ ...s.player, sub: true })),
    ];

    const team: Team = {
      id: uid(),
      name: meta.name,
      tag: meta.tag,
      region: code,
      logo: buildRealFlagLogo(meta.code),
      color: meta.colors[0],
      coach,
      roster,
      synergy: 18,
      culture: 65,
    };

    nations.push({
      team,
      country: meta,
      coach,
      coachReason: reason,
      avgPerformance,
      starters,
      subs,
    });
  }

  nations.sort((a, b) => b.avgPerformance - a.avgPerformance);

  return {
    nations,
    teams: nations.map((n) => n.team),
    skippedCountries: skippedCountries.sort((a, b) => b.availableCount - a.availableCount),
  };
}
