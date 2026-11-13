import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import type { Championship, Team } from "@/lib/lol/types";
import { getMomentumState } from "@/lib/lol/momentum";
import { TeamLogo } from "./team-logo";

const MOOD_ICON: Record<string, string> = {
  hot: "🔥",
  cold: "❄️",
  tilted: "😤",
  rising: "⭐",
};

const DIVISION_LABEL: Record<number | "play-in", string> = {
  1: "Série A",
  2: "Série B",
  "play-in": "Play-in",
};

function FormBar({ value }: { value: number }) {
  const tone =
    value >= 65
      ? "bg-emerald-500"
      : value <= 35
        ? "bg-blood"
        : "bg-gold";
  return (
    <div className="h-2 w-full border border-border bg-black/60">
      <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

/**
 * Painel de Momentum: forma de cada time da série vista + log de eventos
 * narrativos. Fica RECOLHIDO por padrão — não polui a página.
 */
export function MomentumPanel({
  championship,
  division,
  teams,
}: {
  championship: Championship;
  division: 1 | 2;
  teams: Team[];
}) {
  const [open, setOpen] = useState(false);
  const log = championship.momentumLog ?? [];
  const hasAnything =
    log.length > 0 ||
    Object.keys(championship.momentum ?? {}).some((id) =>
      teams.some((t) => t.id === id),
    );
  if (!hasAnything) return null;

  const entries = teams
    .map((t) => ({ team: t, state: getMomentumState(championship.momentum, t.id) }))
    .sort((a, b) => b.state.form - a.state.form);

  return (
    <section className="mt-10 border-t-2 border-border/40 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Brain className="h-4 w-4 text-gold" />
        <span className="font-display text-lg uppercase tracking-widest text-bone">
          Momentum & Forma
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {log.length} evento(s) — a forma influencia os dados 🎲
        </span>
      </button>

      {open ? (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Forma dos times da série atual */}
          <div>
            <div className="mb-2 font-display text-xs uppercase tracking-widest text-gold">
              Forma — {DIVISION_LABEL[division]}
            </div>
            <div className="space-y-1.5">
              {entries.map(({ team, state }) => (
                <div key={team.id} className="flex items-center gap-2">
                  <TeamLogo team={team} size={20} />
                  <span className="w-16 shrink-0 truncate font-display text-sm uppercase tracking-wider text-bone">
                    {team.tag || team.name.slice(0, 3)}
                  </span>
                  {state.mood ? (
                    <span className="shrink-0 text-xs" title={state.mood}>
                      {MOOD_ICON[state.mood]}
                    </span>
                  ) : null}
                  <FormBar value={state.form} />
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    {Math.round(state.form)}
                  </span>
                  {state.streak !== 0 ? (
                    <span
                      className={`w-8 shrink-0 text-right font-mono text-[10px] ${
                        state.streak > 0 ? "text-emerald-500" : "text-blood"
                      }`}
                    >
                      {state.streak > 0 ? `${state.streak}V` : `${state.streak}D`}
                    </span>
                  ) : (
                    <span className="w-8 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Log de eventos narrativos */}
          <div>
            <div className="mb-2 font-display text-xs uppercase tracking-widest text-blood">
              Eventos recentes
            </div>
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum evento ainda — jogue partidas e acompanhe o drama.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {log.map((e) => {
                  const team = [
                    ...championship.teams,
                    ...(championship.serieB?.teams ?? []),
                  ].find((t) => t.id === e.teamId);
                  const time = new Date(e.at);
                  return (
                    <div
                      key={e.id}
                      className="flex items-start gap-2 border border-border/60 bg-black/30 p-2"
                    >
                      <TeamLogo team={team ?? null} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-sm uppercase tracking-wider text-bone">
                            {e.title}
                          </span>
                          {e.delta !== 0 ? (
                            <span
                              className={`shrink-0 font-mono text-[11px] font-bold ${
                                e.delta > 0 ? "text-emerald-500" : "text-blood"
                              }`}
                            >
                              {e.delta > 0 ? `+${e.delta}` : e.delta}
                            </span>
                          ) : (
                            // delta 0 = evento narrativo (ex: evolução no recesso).
                            <span className="shrink-0 text-[9px] uppercase tracking-widest text-gold/70">
                              recesso
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {e.detail}
                        </p>
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                          {DIVISION_LABEL[e.division]} ·{" "}
                          {time.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
