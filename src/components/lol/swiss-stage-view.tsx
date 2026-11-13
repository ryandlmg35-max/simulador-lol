import type { Championship, Phase, SwissConfig, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";

/** Recorde (V-D) de cada time na fase suíça. */
function swissRecords(phase: Phase): Map<string, { w: number; l: number }> {
  const rec = new Map<string, { w: number; l: number }>();
  const ensure = (id: string) => {
    if (!rec.has(id)) rec.set(id, { w: 0, l: 0 });
    return rec.get(id)!;
  };
  for (const m of phase.matches) {
    // Vaga (bye) conta vitória sem adversário — igual aos outros leitores.
    if (m.bye && m.winnerId) {
      ensure(m.winnerId).w++;
      continue;
    }
    if (!m.winnerId || !m.teamAId || !m.teamBId) continue;
    const loser = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    ensure(m.winnerId).w++;
    ensure(loser).l++;
  }
  return rec;
}

function RecordBadge({ rec }: { rec: { w: number; l: number } | undefined }) {
  if (!rec) return null;
  const qualified = rec.w >= 3;
  const eliminated = rec.l >= 3;
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        qualified
          ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
          : eliminated
            ? "border-blood/60 bg-blood/20 text-red-400"
            : "border-border bg-black/40 text-muted-foreground"
      }`}
    >
      {rec.w}-{rec.l}
    </span>
  );
}

/**
 * Visual completo da fase suíça: mostra classificados, eliminados e o
 * recorde de cada time em cada confronto (estilo Worlds/MSI).
 */
export function SwissStageView({
  championship,
  phase,
  teams,
  renderMatch,
}: {
  championship: Championship;
  phase: Phase;
  /** Times da série a que a fase pertence. */
  teams: Team[];
  renderMatch: (matchId: string) => React.ReactNode;
}) {
  const cfg = phase.config as SwissConfig;
  const records = swissRecords(phase);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const allTeams = [...teams, ...(championship.formerTeams ?? [])];
  const teamByIdAll = new Map(allTeams.map((t) => [t.id, t]));

  const qualified = Array.from(records.entries())
    .filter(([, r]) => r.w >= cfg.winsToAdvance)
    .sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l);

  const eliminated = Array.from(records.entries())
    .filter(([, r]) => r.l >= cfg.lossesToEliminate)
    .sort((a, b) => a[1].l - b[1].l || b[1].w - a[1].w);

  const alive = Array.from(records.entries()).filter(
    ([, r]) => r.w < cfg.winsToAdvance && r.l < cfg.lossesToEliminate,
  );

  const rounds = Array.from(new Set(phase.matches.map((m) => m.round ?? 0))).sort((a, b) => a - b);

  const roundLabel = (r: number) => {
    const roundMatches = phase.matches.filter((m) => (m.round ?? 0) === r);
    const recs = new Set(
      roundMatches
        .filter((m) => m.teamAId && m.teamBId)
        .map((m) => {
          const ra = records.get(m.teamAId!);
          // O recorde ANTES do jogo é o recorde atual menos este resultado
          const rb = records.get(m.teamBId!);
          if (!ra || !rb) return "";
          // Aproximação: mostra o grupo pelo maior recorde dos dois
          const wa = m.winnerId === m.teamAId ? ra.w - 1 : ra.w;
          const wb = m.winnerId === m.teamBId ? rb.w - 1 : rb.w;
          const la = m.winnerId === m.teamAId ? ra.l : ra.l - 1;
          const lb = m.winnerId === m.teamBId ? rb.l : rb.l - 1;
          return `${wa}-${la} / ${wb}-${lb}`;
        }),
    );
    return `Rodada ${r + 1}`;
  };

  return (
    <div className="space-y-6">
      {/* ===== Classificados / Eliminados ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Classificados */}
        <div className="border-2 border-emerald-500/50 bg-emerald-500/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500" />
            <span className="font-display text-sm uppercase tracking-widest text-emerald-400">
              ✅ Classificados ({qualified.length})
            </span>
          </div>
          {qualified.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ninguém alcançou {cfg.winsToAdvance}V ainda.
            </p>
          ) : (
            <div className="space-y-1.5">
              {qualified.map(([id, r]) => {
                const t = teamByIdAll.get(id) ?? teamById.get(id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <TeamLogo team={t} size={20} />
                    <span className="flex-1 truncate font-display text-sm uppercase text-bone">
                      {t?.tag || t?.name.slice(0, 4) || "?"}
                    </span>
                    <RecordBadge rec={r} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Em disputa */}
        <div className="border-2 border-gold/40 bg-gold/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 bg-gold" />
            <span className="font-display text-sm uppercase tracking-widest text-gold">
              ⏳ Em disputa ({alive.length})
            </span>
          </div>
          {alive.length === 0 ? (
            <p className="text-xs text-muted-foreground">Fase encerrada.</p>
          ) : (
            <div className="space-y-1.5">
              {alive.map(([id, r]) => {
                const t = teamByIdAll.get(id) ?? teamById.get(id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <TeamLogo team={t} size={20} />
                    <span className="flex-1 truncate font-display text-sm uppercase text-bone">
                      {t?.tag || t?.name.slice(0, 4) || "?"}
                    </span>
                    <RecordBadge rec={r} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Eliminados */}
        <div className="border-2 border-blood/50 bg-blood/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 bg-blood" />
            <span className="font-display text-sm uppercase tracking-widest text-red-400">
              ❌ Eliminados ({eliminated.length})
            </span>
          </div>
          {eliminated.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ninguém alcançou {cfg.lossesToEliminate}D ainda.
            </p>
          ) : (
            <div className="space-y-1.5">
              {eliminated.map(([id, r]) => {
                const t = teamByIdAll.get(id) ?? teamById.get(id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <TeamLogo team={t} size={20} />
                    <span className="flex-1 truncate font-display text-sm uppercase text-muted-foreground line-through">
                      {t?.tag || t?.name.slice(0, 4) || "?"}
                    </span>
                    <RecordBadge rec={r} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== Rodadas com recordes ===== */}
      {rounds.map((r) => {
        const rm = phase.matches.filter((m) => (m.round ?? 0) === r && !m.bye);
        // Agrupa por "confronto de mesma faixa de recorde"
        const byRecordGroup = new Map<string, typeof rm>();
        for (const m of rm) {
          if (!m.teamAId || !m.teamBId) continue;
          const ra = records.get(m.teamAId);
          const rb = records.get(m.teamBId);
          if (!ra || !rb) continue;
          // Recorde pré-jogo (aproximação: recorde atual menos o resultado desta partida)
          const wa = m.winnerId === m.teamAId ? ra.w - 1 : ra.w;
          const la = m.winnerId === m.teamAId ? ra.l : ra.l - 1;
          const wb = m.winnerId === m.teamBId ? rb.w - 1 : rb.w;
          const lb = m.winnerId === m.teamBId ? rb.l : rb.l - 1;
          const group = `${Math.max(wa, wb)}-${Math.min(la, lb)}`;
          if (!byRecordGroup.has(group)) byRecordGroup.set(group, []);
          byRecordGroup.get(group)!.push(m);
        }

        const isQualRound = (group: string) => {
          const [w] = group.split("-").map(Number);
          return w === cfg.winsToAdvance - 1;
        };
        const isElimRound = (group: string) => {
          const [, l] = group.split("-").map(Number);
          return l === cfg.lossesToEliminate - 1;
        };

        return (
          <div key={r} className="rounded-lg border border-dashed border-border bg-card/40 p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="font-display text-sm uppercase tracking-widest text-gold">
                Rodada {r + 1}
              </span>
              {Array.from(byRecordGroup.keys()).map((g) => (
                <span
                  key={g}
                  className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                    isQualRound(g)
                      ? "border-emerald-500/60 text-emerald-400"
                      : isElimRound(g)
                        ? "border-blood/60 text-red-400"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {isQualRound(g) ? "✅ " : isElimRound(g) ? "❌ " : ""}
                  {g}
                </span>
              ))}
            </div>

            {/* Confrontos agrupados por faixa de recorde */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rm.map((m) => {
                const ta = m.teamAId ? teamByIdAll.get(m.teamAId) : null;
                const tb = m.teamBId ? teamByIdAll.get(m.teamBId) : null;
                const ra = m.teamAId ? records.get(m.teamAId) : undefined;
                const rb = m.teamBId ? records.get(m.teamBId) : undefined;
                // Recorde pré-jogo
                const wa = m.winnerId === m.teamAId ? (ra?.w ?? 0) - 1 : (ra?.w ?? 0);
                const la = m.winnerId === m.teamAId ? (ra?.l ?? 0) : (ra?.l ?? 0) - 1;
                const wb = m.winnerId === m.teamBId ? (rb?.w ?? 0) - 1 : (rb?.w ?? 0);
                const lb = m.winnerId === m.teamBId ? (rb?.l ?? 0) : (rb?.l ?? 0) - 1;

                const isQual = Math.max(wa, wb) === cfg.winsToAdvance - 1;
                const isElim = Math.max(la, lb) === cfg.lossesToEliminate - 1;

                return (
                  <div key={m.id}>
                    {/* Etiqueta do grupo de recorde */}
                    <div
                      className={`mb-1 flex items-center gap-1.5 border px-2 py-0.5 ${
                        isQual
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : isElim
                            ? "border-blood/50 bg-blood/10"
                            : "border-border/50 bg-black/20"
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {isQual ? "✅ Classifica" : isElim ? "❌ Elimina" : "Em jogo"}
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
                        <RecordBadge rec={{ w: wa, l: la }} />
                        <span>vs</span>
                        <RecordBadge rec={{ w: wb, l: lb }} />
                      </span>
                    </div>
                    {renderMatch(m.id)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}