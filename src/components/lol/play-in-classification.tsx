import { useMemo } from "react";
import { Check, Skull, Timer } from "lucide-react";
import type { Phase, Team } from "@/lib/lol/types";
import { getQualifiers, isPhaseComplete } from "@/lib/lol/generate";
import { phaseTeamIdsInOrder } from "@/lib/lol/international";
import { TeamLogo } from "./team-logo";

/**
 * Classificação do play-in internacional (Worlds/MSI).
 *
 * O play-in é fase de ELIMINAÇÃO: quem passa vai pra fase principal e quem
 * fica de fora sai do evento. A painel deixa isso explícito — quem
 * classificador, quem foi eliminado e quantas vagas ainda faltam.
 */
export function PlayInClassification({
  phase,
  teams,
  targetName,
}: {
  /** Fase do play-in (internacional). */
  phase: Phase;
  /** Times do campeonato (para nome/logo). */
  teams: Team[];
  /** Nome da fase principal que os classificados vão disputar. */
  targetName: string;
}) {
  const entrants = useMemo(() => phaseTeamIdsInOrder(phase), [phase]);
  const limit = phase.advanceCount ?? 0;
  const qualified = useMemo(() => getQualifiers(phase, limit), [phase, limit]);
  const finished = isPhaseComplete(phase);
  const qualifiedSet = useMemo(() => new Set(qualified), [qualified]);
  const eliminated = useMemo(
    () => (finished ? entrants.filter((id) => !qualifiedSet.has(id)) : []),
    [finished, entrants, qualifiedSet],
  );
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (entrants.length === 0) return null;

  // Confrontos que ainda precisam de resultado (com os dois times) + as
  // partidas de classificação que ainda dependem de resultado anterior.
  const pendingMatches = phase.matches.filter(
    (m) => (m.teamAId && m.teamBId && !m.winnerId) || m.pendingA || m.pendingB,
  ).length;

  return (
    <div className="noise-layer border-2 border-gold/50 bg-card/60 p-4 shadow-[4px_4px_0_0_var(--gold)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink/60 pb-2">
        <h3 className="font-display text-sm uppercase tracking-widest text-gold">
          Classificação do play-in
        </h3>
        <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
          {finished
            ? `${qualified.length} classificado(s) · ${eliminated.length} eliminado(s)`
            : `em andamento · ${pendingMatches} confronto(s) pendente(s)`}
        </span>
      </div>

      {!finished ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Timer className="h-3.5 w-3.5 text-gold" />
          {`Classificação só é fechada no fim do play-in — ${limit} vaga(s) para ${targetName}.`}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="border-2 border-emerald-600/60 bg-emerald-500/5">
          <div className="flex items-center gap-2 border-b-2 border-emerald-600/60 bg-emerald-600/20 px-3 py-1.5">
            <Check className="h-4 w-4 text-emerald-300" />
            <span className="font-display text-xs uppercase tracking-widest text-emerald-300">
              Classificados · entram em {targetName}
            </span>
          </div>
          <ul>
            {!finished ? (
              <li className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Aguardando o fim do play-in
              </li>
            ) : qualified.length === 0 ? (
              <li className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Ninguém classificado
              </li>
            ) : (
              qualified.map((id, i) => {
                const t = byId.get(id);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 border-t border-emerald-600/20 px-3 py-1.5 first:border-t-0"
                  >
                    <span className="w-4 font-display text-sm text-emerald-300">{i + 1}</span>
                    <TeamLogo team={t} size={22} />
                    <span className="font-display text-sm uppercase tracking-wider text-bone">
                      {t?.name ?? id}
                    </span>
                    <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-300/80">
                      Classificado
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="border-2 border-blood/60 bg-blood/5">
          <div className="flex items-center gap-2 border-b-2 border-blood/60 bg-blood/20 px-3 py-1.5">
            <Skull className="h-4 w-4 text-blood" />
            <span className="font-display text-xs uppercase tracking-widest text-blood">
              Eliminados · ficam fora do evento
            </span>
          </div>
          <ul>
            {!finished ? (
              <li className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Quem for eliminado só aparece no fim do play-in
              </li>
            ) : eliminated.length === 0 ? (
              <li className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Ninguém eliminado
              </li>
            ) : (
              eliminated.map((id) => {
                const t = byId.get(id);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 border-t border-blood/20 px-3 py-1.5 first:border-t-0"
                  >
                    <TeamLogo team={t} size={22} />
                    <span className="font-display text-sm uppercase tracking-wider text-muted-foreground line-through">
                      {t?.name ?? id}
                    </span>
                    <span className="ml-auto text-[10px] uppercase tracking-widest text-blood/80">
                      Eliminado
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
