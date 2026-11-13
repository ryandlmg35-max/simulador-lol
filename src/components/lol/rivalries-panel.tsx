import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Crown, Flame, Swords, Zap } from "lucide-react";
import type { CareerTeam, Championship, Team } from "@/lib/lol/types";
import { computeChampionshipNarratives } from "@/lib/lol/rivalries";
import { TeamLogo } from "./team-logo";

export function RivalriesPanel({
  championship,
  allChampionships,
  poolTeams,
  careerTable,
  isInternational,
}: {
  championship: Championship;
  allChampionships: Championship[];
  poolTeams: Team[];
  careerTable?: Record<string, CareerTeam>;
  isInternational: boolean;
}) {
  // Em torneios internacionais tem destaque imediato; em ligas locais fica recolhido e discreto.
  const [expanded, setExpanded] = useState(isInternational);

  const narratives = useMemo(
    () =>
      computeChampionshipNarratives({
        championship,
        allChampionships,
        poolTeams,
        careerTable,
        isInternational,
      }),
    [championship, allChampionships, poolTeams, careerTable, isInternational],
  );

  const totalItems =
    narratives.rivalries.length +
    narratives.paternities.length +
    narratives.playoffBeasts.length +
    narratives.upsetKings.length;

  if (totalItems === 0) return null;

  return (
    <section
      className={`border-2 bg-card transition-all ${
        isInternational
          ? "border-gold/50 shadow-[4px_4px_0_0_var(--gold)]"
          : "border-border/70"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
          isInternational
            ? "bg-gold/10 hover:bg-gold/15"
            : "bg-black/30 hover:bg-black/45"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Swords className={`h-4 w-4 ${isInternational ? "text-gold" : "text-muted-foreground"}`} />
          <span
            className={`font-display text-sm uppercase tracking-[0.18em] ${
              isInternational ? "text-gold" : "text-bone"
            }`}
          >
            {isInternational
              ? "Rivalidades, Paternidades & Místicas Internacionais"
              : "Histórico da Liga · Rivalidades & Paternidades"}
          </span>
          <span className="border border-border/60 bg-black/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {narratives.rivalries.length} rivalidades · {narratives.paternities.length} paternidades
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded ? (
        <div className="grid grid-cols-1 gap-4 border-t border-border/60 p-4 lg:grid-cols-2">
          {/* Maiores Rivalidades */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-blood">
              <Flame className="h-4 w-4" />
              Maiores Rivalidades
            </div>
            {narratives.rivalries.length === 0 ? (
              <div className="border border-dashed border-border/50 bg-black/30 p-3 text-xs text-muted-foreground">
                Nenhuma rivalidade equilibrada com histórico suficiente ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {narratives.rivalries.map((r) => (
                  <div
                    key={`${r.teamA.key}-${r.teamB.key}`}
                    className="flex items-center justify-between gap-2 border border-blood/35 bg-black/45 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamLogo
                        team={{ id: r.teamA.key, name: r.teamA.name, tag: r.teamA.tag, logo: r.teamA.logo }}
                        size={24}
                      />
                      <span className="font-display text-sm uppercase text-bone truncate">
                        {r.teamA.tag}
                      </span>
                      <span className="font-mono text-xs font-bold text-gold">
                        {r.winsA} × {r.winsB}
                      </span>
                      <span className="font-display text-sm uppercase text-bone truncate">
                        {r.teamB.tag}
                      </span>
                      <TeamLogo
                        team={{ id: r.teamB.key, name: r.teamB.name, tag: r.teamB.tag, logo: r.teamB.logo }}
                        size={24}
                      />
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                      <div>{r.total} séries</div>
                      {r.finalsMeetings > 0 ? (
                        <div className="text-gold">{r.finalsMeetings} final(is)</div>
                      ) : r.playoffMeetings > 0 ? (
                        <div>{r.playoffMeetings} playoff(s)</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maiores Paternidades ("É Pai") */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-gold">
              <Crown className="h-4 w-4" />
              Paternidades ("É Pai")
            </div>
            {narratives.paternities.length === 0 ? (
              <div className="border border-dashed border-border/50 bg-black/30 p-3 text-xs text-muted-foreground">
                Nenhum domínio histórico consolidado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {narratives.paternities.map((p) => (
                  <div
                    key={`${p.father.key}-${p.son.key}`}
                    className="flex items-center justify-between gap-2 border border-gold/35 bg-black/45 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamLogo
                        team={{ id: p.father.key, name: p.father.name, tag: p.father.tag, logo: p.father.logo }}
                        size={24}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <strong className="font-display uppercase text-gold">
                            {p.father.tag}
                          </strong>
                          <span className="text-muted-foreground">é pai de</span>
                          <strong className="font-display uppercase text-bone">
                            {p.son.tag}
                          </strong>
                          {p.isKryptonite ? (
                            <span className="border border-emerald-500/50 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-emerald-300">
                              Kriptonita
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Último encontro: {p.lastTournament}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-xs font-bold text-gold">
                      {p.fatherWins} × {p.sonWins}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extras interessantes: Carrascos de Mata-Mata & Matadores de Gigantes */}
          {(narratives.playoffBeasts.length > 0 || narratives.upsetKings.length > 0) ? (
            <div className="grid grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:col-span-2">
              {narratives.playoffBeasts.length > 0 ? (
                <div className="border border-border/50 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-1.5 font-display text-[11px] uppercase tracking-widest text-sky-300">
                    🏆 Carrascos de Mata-Mata
                  </div>
                  <div className="space-y-1.5">
                    {narratives.playoffBeasts.map((b) => (
                      <div key={b.team.key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <TeamLogo
                            team={{ id: b.team.key, name: b.team.name, tag: b.team.tag, logo: b.team.logo }}
                            size={20}
                          />
                          <span className="font-display uppercase text-bone">{b.team.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-sky-300">
                          {b.winRate}% WR ({b.wins}V-{b.losses}D)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {narratives.upsetKings.length > 0 ? (
                <div className="border border-border/50 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-1.5 font-display text-[11px] uppercase tracking-widest text-amber-300">
                    <Zap className="h-3.5 w-3.5" />
                    Matadores de Gigantes (Upsets)
                  </div>
                  <div className="space-y-1.5">
                    {narratives.upsetKings.map((u) => (
                      <div key={u.team.key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <TeamLogo
                            team={{ id: u.team.key, name: u.team.name, tag: u.team.tag, logo: u.team.logo }}
                            size={20}
                          />
                          <span className="font-display uppercase text-bone">{u.team.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-amber-300">
                          {u.upsets} upset(s){u.biggestVictim ? ` · vs ${u.biggestVictim}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
