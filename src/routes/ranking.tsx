import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Crown, Medal, Trophy, RotateCcw, AlertTriangle, X, Check, Trash2, LineChart as ChartIcon, ChevronDown, ChevronUp, Swords } from "lucide-react";
import { useStore } from "@/lib/lol/store";
import { TeamLogo } from "@/components/lol/team-logo";
import type { Championship, Team } from "@/lib/lol/types";
import { canonicalTournamentName, computeRegionSlots, getOfficialRegionRanking, normalizeRegion } from "@/lib/lol/international";
import { RegionalPowerChart } from "@/components/lol/regional-power-chart";
import { TeamProfileDrawer } from "@/components/lol/team-profile-drawer";
import { computeHeadToHead } from "@/lib/lol/h2h";

type Search = { game?: "lol" | "cs2" };

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    game: s.game === "cs2" ? "cs2" : "lol",
  }),
});

function RankingPage() {
  const { game = "lol" } = Route.useSearch();
  const { career, championships, hydrated, resetCareer } = useStore();

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetScope, setResetScope] = useState<"game" | "all">("game");
  const [clearHistory, setClearHistory] = useState(true);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [selectedProfileTeam, setSelectedProfileTeam] = useState<Team | null>(null);
  const [expandedPodium, setExpandedPodium] = useState<Record<string, boolean>>({});
  const [h2hKeyA, setH2hKeyA] = useState<string>("");
  const [h2hKeyB, setH2hKeyB] = useState<string>("");

  const togglePodiumExpand = (champName: string) => {
    setExpandedPodium((prev) => ({
      ...prev,
      [champName]: !prev[champName],
    }));
  };

  const handleConfirmReset = () => {
    resetCareer({
      game: resetScope === "all" ? "all" : game,
      clearChampionshipHistory: clearHistory,
    });
    setResetModalOpen(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 5000);
  };

  // ---------- RANKING DE CARREIRA (permanente — nunca recalculado) ----------
  const table = career[game] ?? {};
  const isNationalTeamName = (name: string) => /^sele[cç][aã]o\b/i.test(name.trim());
  const careerTeams = Object.values(table).filter(
    (t) => (t.played > 0 || t.points !== 0) && !isNationalTeamName(t.name),
  );

  const sortedRanking = [...careerTeams].sort(
    (a, b) => b.points - a.points || b.titles - a.titles || b.wins - a.wins,
  );

  // ---------- Força das Regiões (Ranking Oficial do Hall da Fama) ----------
  const officialRegionRanking = getOfficialRegionRanking(career, game);

  // ---------- VAGAS INTERNACIONAIS (Worlds / MSI) ----------
  // Dinâmicas e proporcionais ao desempenho internacional. A distância da
  // média pesa AO QUADRADO — ganhar/perder pontos move vaga de verdade:
  // 1.0x (média) = 4 vagas · 1.4x satura o teto (8) · 0.6x cai ao piso (1).
  const intlTable = career.international?.[game] ?? {};
  const intlByRegion = new Map<string, number>();
  for (const [region, row] of Object.entries(intlTable)) {
    intlByRegion.set(region, row.points);
  }
  for (const stats of careerTeams) {
    const region = stats.region?.trim().toUpperCase();
    if (region && !intlByRegion.has(region)) intlByRegion.set(region, 0);
  }

  // Mesma fórmula usada pelo planejador do play-in: as vagas da tabela são
  // exatamente as vagas que o MSI/Worlds vão usar.
  const regionSlotTable = computeRegionSlots(career, game, Array.from(intlByRegion.keys()));
  const regionSlot = (region: string): { worlds: number; msi: number; ratio: number } => {
    const info = regionSlotTable.get(normalizeRegion(region));
    if (!info) return { worlds: 1, msi: 1, ratio: 0 };
    return { worlds: info.worlds, msi: info.msi, ratio: info.ratio };
  };

  // ---------- Pódio (lista permanente de títulos creditados) ----------
  const isWorldCupTitle = (champName: string) =>
    /copa do mundo|world cup|seleções|selecoes/i.test(champName);
  const podium = new Map<
    string,
    { label: string; teamName: string; teamTag?: string; teamLogo?: string }[]
  >();
  const worldCupPodium: {
    champName: string;
    label: string;
    teamName: string;
    teamTag?: string;
    teamLogo?: string;
  }[] = [];
  for (const t of career.titles ?? []) {
    if (isWorldCupTitle(t.champName)) {
      worldCupPodium.push({
        champName: t.champName,
        label: t.label,
        teamName: t.teamName,
        teamTag: t.teamTag,
        teamLogo: t.teamLogo,
      });
      continue;
    }
    const champKey = canonicalTournamentName(t.champName);
    const arr = podium.get(champKey) || [];
    arr.push({ label: t.label, teamName: t.teamName, teamTag: t.teamTag, teamLogo: t.teamLogo });
    podium.set(champKey, arr);
  }

  const teamFromCareer = (c: {
    name: string;
    tag?: string;
    logo?: string;
    region?: string;
  }): Team => ({
    id: `career:${c.name.toLowerCase()}`,
    name: c.name,
    tag: c.tag ?? "",
    logo: c.logo,
    region: c.region,
  });

  const gameChampionships = useMemo(
    () => championships.filter((c) => (c.game ?? "lol") === game),
    [championships, game],
  );

  const allWorldTeams = useMemo(() => {
    const map = new Map<string, Team>();
    for (const c of sortedRanking) {
      const k = c.name.trim().toLowerCase();
      map.set(k, teamFromCareer(c));
    }
    for (const ch of gameChampionships) {
      const pool = [...ch.teams, ...(ch.serieB?.teams ?? []), ...(ch.formerTeams ?? [])];
      for (const t of pool) {
        const k = t.name.trim().toLowerCase();
        if (!map.has(k)) {
          map.set(k, { ...t, region: t.region || ch.region });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedRanking, gameChampionships]);

  const effectiveKeyA =
    h2hKeyA ||
    (sortedRanking[0]?.name.trim().toLowerCase() ??
      allWorldTeams[0]?.name.trim().toLowerCase() ??
      "");
  const effectiveKeyB =
    h2hKeyB ||
    (sortedRanking[1]?.name.trim().toLowerCase() ??
      allWorldTeams[1]?.name.trim().toLowerCase() ??
      "");

  const h2hTeamA = allWorldTeams.find((t) => t.name.trim().toLowerCase() === effectiveKeyA) ?? null;
  const h2hTeamB = allWorldTeams.find((t) => t.name.trim().toLowerCase() === effectiveKeyB) ?? null;

  const h2hStats = useMemo(() => {
    if (!h2hTeamA || !h2hTeamB || h2hTeamA.name.toLowerCase() === h2hTeamB.name.toLowerCase()) {
      return null;
    }
    const baseChamp: Championship = gameChampionships[0] ?? {
      id: "dummy-h2h",
      name: "Histórico Global",
      teams: [],
      phases: [],
    };
    return computeHeadToHead(h2hTeamA, h2hTeamB, baseChamp, gameChampionships);
  }, [h2hTeamA, h2hTeamB, gameChampionships]);

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-40 border-b border-gold/25 bg-ink/85 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              search={{ game }}
              className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-bone"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <div className="flex items-center gap-3 border-l-2 border-gold/30 pl-4">
              <Trophy className="h-5 w-5 text-gold" />
              <span className="font-display text-xl uppercase tracking-[0.2em] text-bone">
                {game === "cs2"
                  ? "Ranking Mundial CS2 (HLTV / VRS) & Hall da Fama"
                  : "Hall da Fama & Ranking Global"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-2 border border-blood/60 bg-blood/10 px-3.5 py-1.5 font-display text-xs uppercase tracking-widest text-blood transition-all hover:bg-blood hover:text-white shadow-sm"
            title="Resetar todos os pontos, títulos e histórico do Hall da Fama"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resetar Hall da Fama
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        {resetSuccess ? (
          <div className="flex items-center gap-2 border border-emerald-500/60 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-emerald-400 animate-in fade-in">
            <Check className="h-4 w-4 shrink-0" />
            Hall da Fama resetado com sucesso! O histórico foi zerado para iniciar uma nova era com novos times.
          </div>
        ) : null}

        {/* Aviso: o ranking é permanente com opção de reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-gold/40 bg-gold/5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gold">
          <div className="flex items-center gap-2">
            <span>🛡️</span>
            <span>
              Ranking Permanente — Acumula títulos, pontos e força das regiões ao longo de todas as edições.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 text-blood hover:underline text-xs tracking-wider"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Zerar tudo e recomeçar
          </button>
        </div>

        {/* Gráfico Interativo de Evolução Regional */}
        <section>
          <RegionalPowerChart career={career} game={game} />
        </section>

        {/* Força das Regiões */}
        <section>
          <div className="mb-6 flex items-center gap-3 border-b-2 border-gold/30 pb-2">
            <Crown className="h-6 w-6 text-gold" />
            <h2 className="font-display text-3xl uppercase tracking-widest text-gold">
              Força das Regiões
            </h2>
          </div>
          <div className="overflow-x-auto border-2 border-ink bg-card shadow-[6px_6px_0_0_var(--gold)]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-ink bg-gold text-[11px] font-bold uppercase tracking-widest text-ink">
                  <th className="w-16 px-4 py-3 text-center">Pos</th>
                  <th className="px-4 py-3">Região</th>
                  <th className="px-4 py-3 text-center">Pts Totais</th>
                  <th className="px-4 py-3 text-center">Títulos</th>
                  <th className="px-4 py-3 text-center">Momento Int.</th>
                  <th className="px-4 py-3 text-center">Vagas Worlds</th>
                  <th className="px-4 py-3 text-center">Vagas MSI</th>
                  <th className="px-4 py-3 text-center">Times</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink">
                {officialRegionRanking.map((stats) => {
                  return (
                    <tr key={stats.region} className="transition-colors hover:bg-white/5">
                      <td className="px-4 py-3 text-center font-display text-xl text-gold">
                        #{stats.rank}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-display text-lg uppercase tracking-wider text-bone">
                          {stats.region}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-display text-xl text-bone">
                        {stats.points}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-gold">
                        {stats.titles > 0 ? `${stats.titles} 🏆` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-gold/80">
                        {stats.momentumScore !== 0
                          ? stats.momentumScore > 0
                            ? `+${stats.momentumScore}`
                            : stats.momentumScore
                          : "—"}
                        {stats.isTop2 ? (
                          <span className="ml-1 text-[9px] text-emerald-400">
                            🔥Top 2
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block border px-2.5 py-1 font-display text-lg ${
                            stats.worldsSlots >= 4
                              ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                              : stats.worldsSlots >= 3
                                ? "border-gold/60 bg-gold/15 text-gold"
                                : "border-border bg-black/40 text-muted-foreground"
                          }`}
                        >
                          {stats.worldsSlots}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block border px-2.5 py-1 font-display text-lg ${
                            stats.msiSlots >= 2
                              ? "border-blood/50 bg-blood/15 text-blood"
                              : "border-border bg-black/40 text-muted-foreground"
                          }`}
                        >
                          {stats.msiSlots}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                        {stats.teamsCount}
                      </td>
                    </tr>
                  );
                })}
                {officialRegionRanking.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {hydrated
                        ? "Cadastre a região (ex: CBLOL, LCK) nos times para ver este ranking."
                        : "Carregando…"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            🌎 VAGAS POR MOMENTO INTERNACIONAL: A posição (#1 ao #6) é definida pelo Coeficiente de Momento dos últimos 4 torneios internacionais (títulos, finais e playoffs impulsionam a região para cima; pipocadas derrubam a região na tabela). As vagas seguem estritamente a escada da tabela: Top 2 (4 Worlds / 2 MSI) · #3 e #4 (3 Worlds / 2 MSI) · #5 e #6 (2 Worlds / 1 MSI).
          </p>
        </section>

        {/* Pódio de Campeões (permanente) */}
        <section>
          <div className="mb-6 flex items-center gap-3 border-b-2 border-gold/30 pb-2">
            <Trophy className="h-6 w-6 text-gold" />
            <h2 className="font-display text-3xl uppercase tracking-widest text-gold">
              Pódio de Campeonatos
            </h2>
          </div>
          {podium.size === 0 ? (
            <div className="border border-dashed border-border bg-card/30 p-10 text-center text-muted-foreground">
              Nenhum campeão registrado ainda. Conclua um campeonato e salve o campeão no histórico
              para que ele apareça aqui!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from(podium.entries()).map(([champName, winners]) => {
                const LIMIT = 4;
                const isExpanded = !!expandedPodium[champName];
                const visibleWinners = isExpanded ? winners : winners.slice(0, LIMIT);
                const hasMore = winners.length > LIMIT;

                return (
                  <div
                    key={champName}
                    className="flex flex-col border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--gold)]"
                  >
                    <div className="flex items-center justify-between border-b-2 border-ink bg-gold/10 px-4 py-3">
                      <h3 className="font-display text-xl uppercase tracking-widest text-gold truncate mr-2" title={champName}>
                        {champName}
                      </h3>
                      <span className="shrink-0 rounded bg-gold/20 px-2 py-0.5 font-display text-[11px] uppercase tracking-wider text-gold">
                        {winners.length} {winners.length === 1 ? "título" : "títulos"}
                      </span>
                    </div>
                    <div className="flex-1 space-y-4 p-4">
                      {visibleWinners.map((w, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3">
                            <TeamLogo
                              team={teamFromCareer({
                                name: w.teamName,
                                tag: w.teamTag,
                                logo: w.teamLogo,
                              })}
                              size={32}
                            />
                            <div>
                              <div className="font-display text-lg uppercase tracking-widest text-bone">
                                {w.teamName}
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {w.label || "Campeão"}
                              </div>
                            </div>
                          </div>
                          <Trophy className="h-5 w-5 text-gold" />
                        </div>
                      ))}
                    </div>
                    {hasMore && (
                      <div className="border-t border-border/50 p-2 bg-ink/40">
                        <button
                          type="button"
                          onClick={() => togglePodiumExpand(champName)}
                          className="flex w-full items-center justify-center gap-1.5 rounded border border-gold/40 bg-gold/5 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/15"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" /> Mostrar menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" /> Ver histórico completo (+{winners.length - LIMIT})
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pódio Exclusivo · Copa do Mundo de Seleções */}
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b-2 border-sky-400/40 pb-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <h2 className="font-display text-3xl uppercase tracking-widest text-sky-300">
                Pódio · Copa do Mundo de Seleções
              </h2>
            </div>
            <span className="border border-sky-400/40 bg-sky-500/10 px-3 py-1 font-display text-[11px] uppercase tracking-widest text-sky-200">
              Separado do Ranking de Clubes & Ligas
            </span>
          </div>
          {worldCupPodium.length === 0 ? (
            <div className="border border-dashed border-sky-400/30 bg-sky-500/5 p-8 text-center text-sm text-muted-foreground">
              Nenhuma seleção campeã registrada ainda. Conclua uma Copa do Mundo de Seleções e salve
              a campeã para consagrá-la aqui sem misturar com o ranking de clubes.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {worldCupPodium.map((w, i) => (
                <div
                  key={`${w.champName}-${w.label}-${i}`}
                  className="flex items-center justify-between border-2 border-sky-400/50 bg-card p-4 shadow-[4px_4px_0_0_#38bdf8]"
                >
                  <div className="flex items-center gap-3">
                    <TeamLogo
                      team={teamFromCareer({
                        name: w.teamName,
                        tag: w.teamTag,
                        logo: w.teamLogo,
                      })}
                      size={40}
                    />
                    <div>
                      <div className="font-display text-lg uppercase tracking-widest text-bone">
                        {w.teamName}
                      </div>
                      <div className="text-[11px] uppercase tracking-widest text-sky-300">
                        {w.champName} · {w.label || "Campeão"}
                      </div>
                    </div>
                  </div>
                  <Trophy className="h-6 w-6 text-sky-300 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Confronto Direto Global (Head-to-Head) */}
        <section>
          <div className="mb-6 flex items-center gap-3 border-b-2 border-gold/30 pb-2">
            <Swords className="h-6 w-6 text-gold" />
            <div>
              <h2 className="font-display text-3xl uppercase tracking-widest text-gold">
                Confronto Direto Global (Head-to-Head)
              </h2>
              <p className="text-xs text-muted-foreground">
                Compare quaisquer dois times do mundo somando todas as séries e mapas já disputados
                na história do seu save (ligas regionais, MSI e Worlds).
              </p>
            </div>
          </div>

          <div className="border-2 border-ink bg-card p-6 shadow-[6px_6px_0_0_var(--gold)]">
            <div className="grid gap-4 md:grid-cols-11 md:items-center">
              <div className="md:col-span-5">
                <label className="mb-1.5 block font-display text-xs uppercase tracking-widest text-gold">
                  Time A
                </label>
                <select
                  value={effectiveKeyA}
                  onChange={(e) => setH2hKeyA(e.target.value)}
                  className="w-full border-2 border-gold/40 bg-black/60 px-3 py-2.5 font-display text-sm uppercase tracking-wider text-bone outline-none focus:border-gold"
                >
                  {allWorldTeams.map((t) => (
                    <option key={t.name.toLowerCase()} value={t.name.trim().toLowerCase()}>
                      {t.name} {t.tag ? `(${t.tag})` : ""} {t.region ? `— ${t.region}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center font-display text-2xl text-gold md:col-span-1">VS</div>

              <div className="md:col-span-5">
                <label className="mb-1.5 block font-display text-xs uppercase tracking-widest text-gold">
                  Time B
                </label>
                <select
                  value={effectiveKeyB}
                  onChange={(e) => setH2hKeyB(e.target.value)}
                  className="w-full border-2 border-gold/40 bg-black/60 px-3 py-2.5 font-display text-sm uppercase tracking-wider text-bone outline-none focus:border-gold"
                >
                  {allWorldTeams.map((t) => (
                    <option key={t.name.toLowerCase()} value={t.name.trim().toLowerCase()}>
                      {t.name} {t.tag ? `(${t.tag})` : ""} {t.region ? `— ${t.region}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {h2hStats && h2hTeamA && h2hTeamB ? (
              <div className="mt-6 space-y-5 border-t border-border/60 pt-6">
                <div className="grid grid-cols-11 items-center gap-3 text-center">
                  <div className="col-span-4 flex flex-col items-center gap-2">
                    <TeamLogo team={h2hTeamA} size={48} />
                    <div className="font-display text-xl uppercase tracking-wider text-bone">
                      {h2hTeamA.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {h2hStats.teamAGameWins} mapas vencidos
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gold">
                      Séries Vencidas
                    </div>
                    <div className="mt-1 font-display text-4xl text-bone sm:text-5xl">
                      <span className="text-gold">{h2hStats.teamASeriesWins}</span>
                      <span className="mx-2 text-muted-foreground">×</span>
                      <span className="text-blood">{h2hStats.teamBSeriesWins}</span>
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h2hStats.totalSeries} confronto(s) oficial(is)
                    </div>
                  </div>

                  <div className="col-span-4 flex flex-col items-center gap-2">
                    <TeamLogo team={h2hTeamB} size={48} />
                    <div className="font-display text-xl uppercase tracking-wider text-bone">
                      {h2hTeamB.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {h2hStats.teamBGameWins} mapas vencidos
                    </div>
                  </div>
                </div>

                {/* Barra de Dominância */}
                {h2hStats.totalSeries > 0 && (
                  <div>
                    <div className="flex h-3 w-full overflow-hidden border border-border bg-black/50">
                      <div
                        className="bg-gold transition-all"
                        style={{
                          width: `${Math.round(
                            (h2hStats.teamASeriesWins / h2hStats.totalSeries) * 100,
                          )}%`,
                        }}
                      />
                      <div className="flex-1 bg-blood transition-all" />
                    </div>
                    {h2hStats.streakLeader && h2hStats.streakCount >= 2 && (
                      <div className="mt-2 text-center text-xs text-gold">
                        🔥 <strong>{h2hStats.streakLeader}</strong> vem de{" "}
                        <strong>{h2hStats.streakCount}</strong> vitórias seguidas neste confronto!
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de Confrontos */}
                {h2hStats.recentClashes.length === 0 ? (
                  <div className="border border-dashed border-border bg-black/30 p-6 text-center text-xs text-muted-foreground">
                    Estes dois times ainda não se enfrentaram em partidas finalizadas no seu save.
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gold">
                      Histórico Completo de Séries ({h2hStats.recentClashes.length})
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
                      {h2hStats.recentClashes.map((clash, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center justify-between gap-2 border border-border/60 bg-black/45 px-4 py-2.5"
                        >
                          <div>
                            <strong className="text-gold">{clash.tournament}</strong>
                            {clash.season ? (
                              <span className="ml-1.5 text-muted-foreground">
                                ({clash.season})
                              </span>
                            ) : null}
                            <span className="ml-2 border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {clash.roundOrPhase}
                            </span>
                          </div>
                          <div className="font-mono text-sm">
                            <span
                              className={
                                clash.isTeamAWinner
                                  ? "font-bold text-gold"
                                  : "text-muted-foreground"
                              }
                            >
                              {h2hTeamA.tag || h2hTeamA.name} {clash.scoreA}
                            </span>
                            <span className="mx-2 text-muted-foreground">×</span>
                            <span
                              className={
                                !clash.isTeamAWinner
                                  ? "font-bold text-blood"
                                  : "text-muted-foreground"
                              }
                            >
                              {clash.scoreB} {h2hTeamB.tag || h2hTeamB.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center text-xs text-muted-foreground">
                Selecione dois times diferentes acima para comparar o histórico de confrontos.
              </div>
            )}
          </div>
        </section>

        {/* Power Ranking de Times */}
        <section>
          <div className="mb-6 flex items-center gap-3 border-b-2 border-blood/30 pb-2">
            <Medal className="h-6 w-6 text-blood" />
            <h2 className="font-display text-3xl uppercase tracking-widest text-blood">
              Power Ranking de Times
            </h2>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 text-xs text-muted-foreground md:grid-cols-2">
            <div className="border border-border/50 bg-black/20 p-3">
              <strong className="mb-1 block text-gold">🏛️ Liga Doméstica (Teto Máx: +7 pts):</strong>
              • Vitória em Grupos/Suíço: <span className="text-emerald-500">+1 pt</span> · Playoffs:{" "}
              <span className="text-emerald-500">+2 pts</span> · Derrota:{" "}
              <span className="text-red-500">-1 pt</span> <br />• Vice-campeão:{" "}
              <span className="text-emerald-500">+4 pts</span> · Campeão:{" "}
              <span className="text-emerald-500">+7 pts</span> <br />
              <span className="mt-1 block text-[11px] text-gold/90">
                *Nenhum time ganha mais de <strong>7 pontos</strong> no total dentro de uma liga doméstica.
              </span>
            </div>
            <div className="border border-border/50 bg-black/20 p-3">
              <strong className="mb-1 block text-gold">🌎 Torneios Internacionais (MSI / Worlds):</strong>
              • Vitória Grupos: <span className="text-emerald-500">+4 a +6 pts</span> · Playoffs:{" "}
              <span className="text-emerald-500">+7 a +10 pts</span> <br />• Vice-campeão:{" "}
              <span className="text-emerald-500">+14 a +20 pts</span> · Campeão:{" "}
              <span className="text-emerald-500">+27 a +40 pts</span>
              <span className="mt-1 block text-xs italic text-muted-foreground">
                *Tudo é PERMANENTE — resetar/remover não muda o ranking.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border-2 border-ink bg-card shadow-[6px_6px_0_0_var(--blood)]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-ink bg-blood text-[11px] font-bold uppercase tracking-widest text-bone">
                  <th className="w-16 px-4 py-3 text-center">Pos</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-center">Pts</th>
                  <th className="px-4 py-3 text-center">Títulos</th>
                  <th className="px-4 py-3 text-center">Partidas</th>
                  <th className="px-4 py-3 text-center">V - D</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink">
                {sortedRanking.map((stats, i) => (
                  <tr
                    key={stats.name}
                    onClick={() => setSelectedProfileTeam(teamFromCareer(stats))}
                    className="cursor-pointer transition-colors hover:bg-gold/15"
                    title={`Clique para ver o perfil completo de ${stats.name}`}
                  >
                    <td className="px-4 py-3 text-center font-display text-xl text-gold">
                      #{i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo team={teamFromCareer(stats)} size={28} />
                        <span className="font-display text-lg uppercase tracking-wider text-bone group-hover:text-gold transition-colors">
                          {stats.tag ? `${stats.tag} · ` : ""}
                          {stats.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-display text-xl text-bone">
                      {stats.points}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-gold">
                      {stats.titles > 0 ? `${stats.titles} 🏆` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                      {stats.played}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="font-bold text-emerald-500">{stats.wins}V</span> -{" "}
                      <span className="font-bold text-red-500">{stats.losses}D</span>
                    </td>
                  </tr>
                ))}
                {sortedRanking.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {hydrated
                        ? "Nenhum resultado registrado ainda — jogue partidas!"
                        : "Carregando…"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal de Confirmação para Resetar Hall da Fama */}
      {resetModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md border-2 border-blood bg-ink p-6 shadow-[8px_8px_0_0_var(--blood)]">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2.5 font-display text-lg uppercase tracking-wider text-blood">
                <AlertTriangle className="h-5 w-5" />
                Resetar Hall da Fama
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="text-muted-foreground hover:text-bone"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Esta ação zera todos os pontos acumulados, títulos conquistados no Pódio de Campeões e a Força das Regiões, permitindo que você recomece tudo do zero com novos times.
            </p>

            <div className="mt-4 space-y-3 rounded-sm border border-border bg-black/40 p-3">
              <span className="block font-display text-xs uppercase tracking-wider text-gold">
                Escopo do Reset:
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-bone">
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === "game"}
                  onChange={() => setResetScope("game")}
                  className="accent-blood"
                />
                Resetar apenas {game === "lol" ? "League of Legends" : "Counter-Strike 2"}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-bone">
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === "all"}
                  onChange={() => setResetScope("all")}
                  className="accent-blood"
                />
                Resetar ambos os jogos (LoL e CS2)
              </label>

              <div className="mt-2 border-t border-border/50 pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-bone">
                  <input
                    type="checkbox"
                    checked={clearHistory}
                    onChange={(e) => setClearHistory(e.target.checked)}
                    className="accent-blood"
                  />
                  Zerar também o histórico de edições passadas gravadas nos campeonatos
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="border border-border bg-black/40 px-4 py-2 font-display text-xs uppercase tracking-widest text-bone hover:bg-black/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex items-center gap-2 border-2 border-blood bg-blood px-4 py-2 font-display text-xs uppercase tracking-widest text-white shadow-md hover:bg-blood/90"
              >
                <Trash2 className="h-4 w-4" /> Sim, Resetar Tudo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Gaveta de Perfil do Time */}
      {selectedProfileTeam ? (
        <TeamProfileDrawer
          team={selectedProfileTeam}
          career={career}
          game={game}
          allChampionships={championships}
          onClose={() => setSelectedProfileTeam(null)}
        />
      ) : null}
    </div>
  );
}
