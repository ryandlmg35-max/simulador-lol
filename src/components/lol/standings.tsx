import { useMemo, memo } from "react";
import type { Phase, Group, Team } from "@/lib/lol/types";
import { rosterStrength } from "@/lib/lol/players";
import { TeamLogo } from "./team-logo";

interface Row {
  teamId: string;
  w: number;
  l: number;
  played: number;
  pct: number;
}

function computeStandings(phase: Phase, group: Group): Row[] {
  const rows = new Map<string, Row>();
  group.teamIds.forEach((id) => rows.set(id, { teamId: id, w: 0, l: 0, played: 0, pct: 0 }));
  for (const m of phase.matches) {
    if (m.groupId !== group.id) continue;
    if (!m.winnerId || !m.teamAId || !m.teamBId) continue;
    const winner = rows.get(m.winnerId);
    const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    const loser = rows.get(loserId);
    if (winner) {
      winner.w += 1;
      winner.played += 1;
    }
    if (loser) {
      loser.l += 1;
      loser.played += 1;
    }
  }
  return Array.from(rows.values())
    .map((r) => ({ ...r, pct: r.played > 0 ? r.w / r.played : 0 }))
    .sort((a, b) => b.w - a.w || a.l - b.l || b.pct - a.pct);
}

export const StandingsTable = memo(function StandingsTable({
  teams,
  phase,
  group,
  qualifySlots = 0,
  relegateTeamIds,
  last5,
  classification,
}: {
  /** Times da série a que esta fase pertence. */
  teams: Team[];
  phase: Phase;
  group: Group;
  qualifySlots?: number;
  /** Ids dos times na zona de rebaixamento (linha vermelha na tabela). */
  relegateTeamIds?: string[];
  /** Últimos 5 resultados por time ("W"/"L") — coluna Forma. */
  last5?: Record<string, ("W" | "L")[]>;
  /**
   * Situação de cada time na fase (play-in internacional): "qualified" (passou)
   * ou "eliminated" (eliminado). Vira badge na linha da tabela.
   */
  classification?: Record<string, "qualified" | "eliminated">;
}) {
  const rows = useMemo(() => computeStandings(phase, group), [phase, group]);
  const teamById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const relegateSet = useMemo(() => new Set(relegateTeamIds ?? []), [relegateTeamIds]);

  return (
    <div className="noise-layer border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--blood)]">
      <div className="flex items-center justify-between border-b-2 border-ink bg-blood px-4 py-2 text-bone">
        <h3 className="font-display text-lg uppercase tracking-widest">{group.name}</h3>
        <span className="font-display text-xs uppercase tracking-widest opacity-80">
          Classificação
        </span>
      </div>
      <table className="w-full">
        <thead className="bg-ink text-bone">
          <tr className="text-[10px] uppercase tracking-widest">
            <th className="w-8 px-2 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Time</th>
            <th className="w-12 px-1 py-2 text-center text-gold">V</th>
            <th className="w-12 px-1 py-2 text-center text-blood">D</th>
            <th className="w-24 px-2 py-2 text-center">Forma</th>
            <th
              className="w-10 px-1 py-2 text-center text-gold"
              title="Força do elenco (média dos titulares, curva de idade aplicada)"
            >
              EL
            </th>
            <th className="w-16 px-2 py-2 text-center">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = teamById[r.teamId];
            const teamStrength = rosterStrength(t?.roster);
            const inQualify = qualifySlots > 0 && i < qualifySlots;
            const inRelegate = !inQualify && relegateSet.has(r.teamId);
            return (
              <tr
                key={r.teamId}
                className={`border-t border-ink/60 transition-colors ${
                  inQualify ? "bg-gold/8" : inRelegate ? "bg-blood/15" : "odd:bg-black/20"
                } hover:bg-blood/15`}
              >
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-full w-1.5 self-stretch ${
                        inQualify ? "bg-gold" : inRelegate ? "bg-blood" : "bg-border"
                      }`}
                      style={{ minHeight: 24 }}
                    />
                    <span
                      className={`font-display text-lg ${
                        inQualify
                          ? "text-gold"
                          : inRelegate
                            ? "text-blood"
                            : "text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TeamLogo team={t} size={26} />
                    <div className="flex flex-col leading-tight">
                      <span className="font-display text-base uppercase tracking-wider text-bone">
                        {t?.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t?.tag}
                      </span>
                    </div>
                    {classification?.[r.teamId] === "qualified" ? (
                      <span className="ml-1 border border-emerald-500/70 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                        Classificado
                      </span>
                    ) : null}
                    {classification?.[r.teamId] === "eliminated" ? (
                      <span className="ml-1 border border-blood/70 bg-blood/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blood">
                        Eliminado
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-1 py-2 text-center font-display text-lg text-gold">{r.w}</td>
                <td className="px-1 py-2 text-center font-display text-lg text-blood">{r.l}</td>
                <td className="px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {(last5?.[r.teamId] ?? []).map((res, j) => (
                      <span
                        key={j}
                        className={`inline-block px-1 font-mono text-[10px] font-bold ${
                          res === "W" ? "bg-emerald-500/80 text-black" : "bg-blood/80 text-bone"
                        }`}
                      >
                        {res}
                      </span>
                    ))}
                    {(last5?.[r.teamId] ?? []).length === 0 ? (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        —
                      </span>
                    ) : null}
                  </div>
                </td>
                <td
                  className="px-1 py-2 text-center font-display text-sm tabular-nums text-bone"
                  title={t ? `Elenco de ${t.name}` : undefined}
                >
                  {teamStrength != null ? Math.round(teamStrength) : "—"}
                </td>
                <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                  {(r.pct * 100).toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {qualifySlots > 0 ? (
        <div className="border-t border-ink/60 bg-black/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold">
          ▸ Top {qualifySlots} classifica
        </div>
      ) : null}
      {relegateSet.size > 0 ? (
        <div className="border-t border-ink/60 bg-blood/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blood">
          ▼ Zona de rebaixamento — joga o play-in contra a Série B
        </div>
      ) : null}
    </div>
  );
});