import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Trophy,
  Medal,
  Users,
  Swords,
  Flame,
  Award,
  X,
  TrendingUp,
  Shield,
  Activity,
  Globe,
  Calendar,
} from "lucide-react";
import type { CareerLedger, Championship, GameId, Player, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";
import { CountryFlag } from "./country-flag";
import { PlayerAvatar } from "./player-avatar";
import { ensureRoster, pickStarters } from "@/lib/lol/players";
import { canonicalTournamentName, extractSeasonFromChampName } from "@/lib/lol/international";
import { useStore } from "@/lib/lol/store";
import { getPlayerCareerAwards } from "@/lib/lol/mvp";

export function TeamProfileDrawer({
  team,
  championship,
  career,
  game = "lol",
  allChampionships = [],
  onClose,
}: {
  team: Team;
  championship?: Championship;
  career?: CareerLedger;
  game?: GameId;
  allChampionships?: Championship[];
  onClose: () => void;
}) {
  const { championships: storeChampionships } = useStore();
  const effectiveChampionships = allChampionships && allChampionships.length > 0 ? allChampionships : storeChampionships;
  const [activeTab, setActiveTab] = useState<"trophies" | "roster" | "stats" | "history">("trophies");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const roster = ensureRoster(team) ?? [];
  const starters = pickStarters(roster);
  const subs = roster.filter((p) => p.sub);

  const normKey = team.name.trim().toLowerCase();
  const normTag = (team.tag ?? "").trim().toLowerCase();
  const careerEntry = career?.[game]?.[normKey];

  const matchTeam = (name?: string, tag?: string) => {
    if (!name) return false;
    const n = name.trim().toLowerCase();
    const t = (tag ?? "").trim().toLowerCase();
    return n === normKey || (normTag !== "" && t !== "" && t === normTag);
  };

  const formatConquestDate = (dateStr?: string): string => {
    if (!dateStr) return "Temporada Oficial";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  interface DetailedTitle {
    key: string;
    titleName: string;
    tourney: string;
    split: string;
    dateFormatted: string;
    rawDate?: string;
  }

  const normTitleSplit = (s: string) =>
    s
      .replace(/\s*\(Série B\)\s*$/i, "")
      .replace(/[·\-_/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const titleMap = new Map<string, DetailedTitle>();

  // 1. Títulos registrados no Hall da Fama permanente da Carreira (career.titles)
  for (const t of career?.titles ?? []) {
    if (matchTeam(t.teamName, t.teamTag)) {
      const tourney = canonicalTournamentName(t.champName || championship?.name || "Campeonato Oficial");
      const split = t.label || "Edição Oficial";
      const key = `${tourney.toLowerCase()}:::${normTitleSplit(split)}`;
      titleMap.set(key, {
        key,
        titleName: `Campeão do ${tourney}`,
        tourney,
        split,
        dateFormatted: formatConquestDate(t.at),
        rawDate: t.at,
      });
    }
  }

  // 2. Títulos salvos no histórico das edições (championship.history)
  const allPool = championship ? [championship, ...effectiveChampionships] : effectiveChampionships;
  for (const c of allPool) {
    const listA = (c.history ?? []).map((h) => ({ h, div: "Série A", cName: c.name }));
    const listB = (c.serieB?.history ?? []).map((h) => ({ h, div: "Série B", cName: `${c.name} (Série B)` }));
    for (const { h, cName } of [...listA, ...listB]) {
      if (matchTeam(h.teamName, h.teamTag)) {
        const tourney = canonicalTournamentName(cName || "Campeonato Oficial");
        const rawSplit = h.splitLabel || c.season || "Split Oficial";
        const canonicalSplit = extractSeasonFromChampName(cName, rawSplit);
        const key = `${tourney.toLowerCase()}:::${normTitleSplit(canonicalSplit)}`;
        const altKey = `${tourney.toLowerCase()}:::${normTitleSplit(rawSplit)}`;
        const existingKey = titleMap.has(key) ? key : titleMap.has(altKey) ? altKey : key;
        if (!titleMap.has(existingKey) || h.savedAt) {
          titleMap.set(existingKey, {
            key: existingKey,
            titleName: `Campeão do ${tourney}`,
            tourney,
            split: rawSplit,
            dateFormatted: formatConquestDate(h.savedAt),
            rawDate: h.savedAt,
          });
        }
      }
    }
  }

  // 3. Se a pontuação de carreira tiver títulos históricos anteriores
  const expectedTotal = careerEntry?.titles ?? 0;
  if (expectedTotal > titleMap.size) {
    const diff = expectedTotal - titleMap.size;
    const defaultLeague = championship?.name || team.region || "Liga Oficial";
    for (let i = 0; i < diff; i++) {
      const tourney = defaultLeague;
      const split = `Split ${i + 1}`;
      const key = `hist-${i}-${tourney.toLowerCase()}`;
      titleMap.set(key, {
        key,
        titleName: `Campeão da ${tourney}`,
        tourney,
        split,
        dateFormatted: "Conquistado nesta carreira",
      });
    }
  }

  const titleList = Array.from(titleMap.values()).sort((a, b) => {
    if (a.rawDate && b.rawDate) return b.rawDate.localeCompare(a.rawDate);
    return 0;
  });

  // Estatísticas calculadas
  const rating = careerEntry?.rating ?? 50;
  const points = careerEntry?.points ?? 0;
  const matchesWon = careerEntry?.matchesWon ?? 0;
  const matchesLost = careerEntry?.matchesLost ?? 0;
  const totalMatches = matchesWon + matchesLost;
  const winRate = totalMatches > 0 ? Math.round((matchesWon / totalMatches) * 100) : 0;

  // Momentum no campeonato atual
  const teamMomentum = championship?.momentum?.[team.id];
  const form = teamMomentum?.form ?? 50;
  const streak = teamMomentum?.streak ?? 0;

  const drawerContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl border-l border-border bg-[#0b0c10] shadow-2xl flex flex-col overflow-hidden text-foreground animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Perfil */}
        <div
          className="relative border-b border-border p-6"
          style={{
            background: `linear-gradient(180deg, ${team.color || "oklch(0.28 0.06 240)"}33 0%, transparent 100%)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative rounded-2xl border border-border bg-card/60 p-2 shadow-xl">
              <TeamLogo team={team} className="h-20 w-20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-foreground">
                  {team.name}
                </h2>
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-bold uppercase text-muted-foreground">
                  {team.tag}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                {team.region ? (
                  <span className="flex items-center gap-1 font-semibold uppercase">
                    <Globe className="h-3.5 w-3.5" /> {team.region}
                  </span>
                ) : null}
                <span>·</span>
                <span className="font-semibold text-gold">
                  {titleList.length} Título(s)
                </span>
              </div>

              {/* Badges de Força & ELO */}
              <div className="mt-3 flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold">
                  <TrendingUp className="h-3.5 w-3.5" /> ELO {Math.round(rating)}
                </div>
                <div className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  <Activity className="h-3.5 w-3.5" /> Forma {form}%
                </div>
                {streak !== 0 ? (
                  <div
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${
                      streak > 0
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-blood/20 text-blood border border-blood/40"
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5" /> {streak > 0 ? `+${streak} V` : `${streak} D`}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-border bg-card/40 px-4 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab("trophies")}
            className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors ${
              activeTab === "trophies"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="h-4 w-4" /> Sala de Troféus ({titleList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors ${
              activeTab === "roster"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Elenco ({roster.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors ${
              activeTab === "stats"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" /> Estatísticas
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: TROFÉUS */}
          {activeTab === "trophies" && (
            <div className="space-y-4">
              {titleList.length >= 3 ? (
                <div className="flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/15 p-4 text-gold">
                  <Award className="h-8 w-8 shrink-0" />
                  <div>
                    <h4 className="font-display text-sm font-black uppercase tracking-wider">
                      Dinastia Consagrada ({titleList.length} Títulos)
                    </h4>
                    <p className="text-xs text-gold/80">
                      Esta equipe construiu uma era dominante na história do cenário competitivo.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2.5">
                {titleList.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-card/20 p-8 text-center text-xs text-muted-foreground">
                    <Trophy className="mx-auto h-8 w-8 opacity-30 mb-2" />
                    Esta equipe ainda busca seu primeiro título oficial.
                  </div>
                ) : (
                  titleList.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-gold/30 bg-card/40 p-3.5 hover:bg-card/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-xl bg-gold/20 p-2 text-gold shrink-0 border border-gold/40 shadow">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-display text-sm font-bold text-foreground block truncate">
                            {t.titleName}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            <span className="font-semibold text-gold/90">{t.tourney}</span>
                            <span>·</span>
                            <span className="text-foreground/80 font-medium">{t.split}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3 text-gold/80" /> {t.dateFormatted}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="rounded bg-gold/20 border border-gold/40 px-2.5 py-1 text-xs font-mono font-bold text-gold shrink-0">
                        🏆 1º Lugar
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ELENCO */}
          {activeTab === "roster" && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-gold mb-2 block">
                  Titulares
                </span>
                <div className="space-y-2">
                  {starters.map((player) => {
                    const pAwards = getPlayerCareerAwards(player.ign, allPool);
                    return (
                      <div
                        key={player.id}
                        className="rounded-xl border border-border/60 bg-card/40 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <PlayerAvatar ign={player.ign} role={player.role} size="sm" />
                            <span className="w-12 text-center rounded bg-muted/60 px-1.5 py-1 text-xs font-mono font-bold uppercase text-muted-foreground">
                              {player.role}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <CountryFlag code={player.country} size="xs" />
                                <span className="font-display text-sm font-bold text-foreground">
                                  {player.ign}
                                </span>
                                {player.country ? (
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {player.country}
                                  </span>
                                ) : null}
                              </div>
                              {player.real ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {player.real}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <span className="text-[10px] uppercase text-muted-foreground block font-mono">
                                Mecânica
                              </span>
                              <span className="font-display text-xs font-bold text-gold">
                                {player.attrs.mechanics}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-muted-foreground block font-mono">
                                Clutch
                              </span>
                              <span className="font-display text-xs font-bold text-foreground">
                                {player.attrs.clutch}
                              </span>
                            </div>
                          </div>
                        </div>

                        {(pAwards.splitMvpTitles.length > 0 ||
                          pAwards.allProSelections.length > 0 ||
                          pAwards.matchMvpCount > 0) && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
                            {pAwards.splitMvpTitles.length > 0 && (
                              <span
                                title={pAwards.splitMvpTitles.join(", ")}
                                className="inline-flex items-center gap-1 rounded border border-gold bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-gold"
                              >
                                🏆 {pAwards.splitMvpTitles.length}× MVP do Split
                              </span>
                            )}
                            {pAwards.allProSelections.length > 0 && (
                              <span
                                title={pAwards.allProSelections.join(", ")}
                                className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300"
                              >
                                ⭐ {pAwards.allProSelections.length}× Seleção All-Pro
                              </span>
                            )}
                            {pAwards.matchMvpCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded border border-border bg-black/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                                🎖️ {pAwards.matchMvpCount}× MVP de Série
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {subs.length > 0 ? (
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2 block">
                    Reservas
                  </span>
                  <div className="space-y-2">
                    {subs.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-xl border border-border/40 bg-card/20 p-2.5 opacity-80"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-12 text-center rounded bg-muted/40 px-1 py-0.5 text-[11px] font-mono uppercase text-muted-foreground">
                            {player.role}
                          </span>
                          <span className="font-display text-xs font-semibold text-foreground">
                            {player.ign}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {player.attrs.mechanics} MEC
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: ESTATÍSTICAS */}
          {activeTab === "stats" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Pontos no Hall da Fama
                  </span>
                  <span className="mt-1 block font-display text-3xl font-extrabold text-gold">
                    {points}
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Aproveitamento Geral
                  </span>
                  <span className="mt-1 block font-display text-3xl font-extrabold text-foreground">
                    {winRate}%
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Registros Históricos
                </h4>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Partidas Oficiais Jogadas</span>
                  <span className="font-bold text-foreground">{totalMatches}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Vitórias Registradas</span>
                  <span className="font-bold text-emerald-400">{matchesWon}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-muted-foreground">Derrotas Registradas</span>
                  <span className="font-bold text-blood">{matchesLost}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return drawerContent;
  return createPortal(drawerContent, document.body);
}
