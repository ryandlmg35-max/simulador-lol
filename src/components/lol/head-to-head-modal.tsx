import { useEffect } from "react";
import { Swords, Trophy, X, Flame } from "lucide-react";
import type { Championship, Team } from "@/lib/lol/types";
import { computeHeadToHead } from "@/lib/lol/h2h";
import { useStore } from "@/lib/lol/store";
import { TeamLogo } from "./team-logo";

export function HeadToHeadModal({
  teamA,
  teamB,
  championship,
  allChampionships = [],
  onClose,
}: {
  teamA: Team;
  teamB: Team;
  championship: Championship;
  allChampionships?: Championship[];
  onClose: () => void;
}) {
  const { championships: storeChampionships } = useStore();
  const effectiveChampionships =
    allChampionships && allChampionships.length > 0 ? allChampionships : storeChampionships;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = computeHeadToHead(teamA, teamB, championship, effectiveChampionships);
  const total = stats.totalSeries;
  const pctA = total > 0 ? Math.round((stats.teamASeriesWins / total) * 100) : 50;
  const pctB = total > 0 ? 100 - pctA : 50;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-[#0d0f14] shadow-2xl p-6 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-gold" />
            <span className="font-display text-lg font-bold uppercase tracking-wider text-gold">
              Histórico Direto (Head-to-Head)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Confronto Central */}
        <div className="mt-6 flex items-center justify-between rounded-lg bg-card/60 border border-border/60 p-5">
          {/* Team A */}
          <div className="flex flex-col items-center gap-2 flex-1 text-center">
            <TeamLogo team={teamA} className="h-16 w-16" />
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              {teamA.name}
            </span>
            <span className="text-xs uppercase text-muted-foreground font-mono">
              {teamA.tag}
            </span>
          </div>

          {/* Placar Central */}
          <div className="flex flex-col items-center px-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              Vitórias em Séries
            </span>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-4xl font-extrabold text-gold">
                {stats.teamASeriesWins}
              </span>
              <span className="text-muted-foreground font-display text-2xl font-light">
                -
              </span>
              <span className="font-display text-4xl font-extrabold text-foreground">
                {stats.teamBSeriesWins}
              </span>
            </div>
            <span className="mt-1 text-xs text-muted-foreground font-mono">
              {stats.teamAGameWins} - {stats.teamBGameWins} mapas
            </span>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-2 flex-1 text-center">
            <TeamLogo team={teamB} className="h-16 w-16" />
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              {teamB.name}
            </span>
            <span className="text-xs uppercase text-muted-foreground font-mono">
              {teamB.tag}
            </span>
          </div>
        </div>

        {/* Barra de Aproveitamento */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            <span className="text-gold">{pctA}%</span>
            <span>{total} série(s) registrada(s)</span>
            <span className="text-primary">{pctB}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden flex">
            <div
              className="bg-gold transition-all duration-500"
              style={{ width: `${pctA}%` }}
            />
            <div
              className="bg-primary transition-all duration-500"
              style={{ width: `${pctB}%` }}
            />
          </div>
        </div>

        {/* Sequência Vigente */}
        {stats.streakLeader && stats.streakCount >= 2 ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gold/10 border border-gold/30 py-2 px-3 text-xs text-gold">
            <Flame className="h-4 w-4" />
            <span>
              <strong>{stats.streakLeader}</strong> venceu os últimos{" "}
              <strong>{stats.streakCount}</strong> confrontos consecutivos!
            </span>
          </div>
        ) : null}

        {/* Lista de Confrontos Recentes */}
        <div className="mt-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <Trophy className="h-3.5 w-3.5 text-gold" />
            Confrontos Recentes
          </span>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {stats.recentClashes.length === 0 ? (
              <div className="rounded-lg border border-border/40 bg-card/20 p-4 text-center text-xs text-muted-foreground">
                Nenhum confronto finalizado registrado entre as duas equipes ainda.
              </div>
            ) : (
              stats.recentClashes.map((clash, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-card/30 px-3.5 py-2.5 text-xs hover:bg-card/60 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {clash.tournament}
                      {clash.season ? ` · ${clash.season}` : ""}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {clash.roundOrPhase}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-display text-sm">
                    <span
                      className={
                        clash.isTeamAWinner
                          ? "font-bold text-gold"
                          : "text-muted-foreground"
                      }
                    >
                      {teamA.tag} {clash.scoreA}
                    </span>
                    <span className="text-muted-foreground font-light">x</span>
                    <span
                      className={
                        !clash.isTeamAWinner
                          ? "font-bold text-gold"
                          : "text-muted-foreground"
                      }
                    >
                      {clash.scoreB} {teamB.tag}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-input px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-muted transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
