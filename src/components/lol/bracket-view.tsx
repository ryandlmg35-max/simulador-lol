import { useState } from "react";
import { Minus, Plus, Trash2, Wrench } from "lucide-react";
import type { Phase, Team } from "@/lib/lol/types";
import { MatchCard } from "./match-card";
import { useStore } from "@/lib/lol/store";
import {
  applyBracketOp,
  rebuildFromSpec,
  specFromMatches,
  type BracketOp,
} from "@/lib/lol/bracket-edit";

function Column({
  title,
  children,
  spacing = 0,
  tools,
}: {
  title: string;
  children: React.ReactNode;
  spacing?: number;
  tools?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-64 flex-col gap-3">
      <div className="relative">
        <div className="stripes-strong absolute inset-0 opacity-20" />
        <div className="notch-tl relative border-2 border-gold bg-ink px-3 py-1.5">
          <h3 className="font-display text-base uppercase tracking-[0.25em] text-gold">
            {title}
          </h3>
        </div>
      </div>
      {tools}
      <div
        className="flex flex-col justify-around gap-6"
        style={{ minHeight: `${100 + spacing * 90}px` }}
      >
        {children}
      </div>
    </div>
  );
}

function ToolBtn({
  onClick,
  label,
  children,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1 border-2 px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
        danger
          ? "border-blood/60 text-blood hover:bg-blood hover:text-ink"
          : "border-gold/60 text-gold hover:bg-gold hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function BracketView({
  championshipId,
  teams,
  phase,
  allTeams,
}: {
  championshipId: string;
  /** Times da série a que esta fase pertence — nunca mistura divisões. */
  teams: Team[];
  phase: Phase;
  /** Times arquivados (exibição de confrontos antigos). */
  allTeams?: Team[];
}) {
  const { updateChampionship } = useStore();
  const [editing, setEditing] = useState(false);

  const run = (op: BracketOp) => {
    updateChampionship(championshipId, (c) => {
      // A fase pode pertencer à Série A (c.phases) ou à Série B
      // (c.serieB.phases) — nunca misturamos as duas.
      const inSerieB = c.serieB?.phases.some((p) => p.id === phase.id);
      const applyOp = (phases: Phase[]): Phase[] =>
        phases.map((p): Phase => {
          if (p.id !== phase.id) return p;
          const spec = applyBracketOp(specFromMatches(p.matches), op);
          return {
            ...p,
            config:
              p.config.kind === "bracket"
                ? { ...p.config, mode: "custom", custom: spec }
                : p.config,
            matches: rebuildFromSpec(spec, p.matches),
          };
        });
      if (inSerieB && c.serieB) {
        return { ...c, serieB: { ...c.serieB, phases: applyOp(c.serieB.phases) } };
      }
      return { ...c, phases: applyOp(c.phases) };
    });
  };

  const visible = phase.matches.filter((m) => !m.bye);
  const upper = visible.filter((m) => (m.bracketSide ?? "upper") === "upper");
  const lower = visible.filter((m) => m.bracketSide === "lower");
  const grand = visible.filter(
    (m) => m.bracketSide === "grand" || m.bracketSide === "reset",
  );
  const hasGrand = phase.matches.some((m) => m.bracketSide === "grand");
  const hasReset = phase.matches.some((m) => m.bracketSide === "reset");

  const upperRounds = Array.from(new Set(upper.map((m) => m.round ?? 0))).sort(
    (a, b) => a - b,
  );
  const lowerRounds = Array.from(new Set(lower.map((m) => m.round ?? 0))).sort(
    (a, b) => a - b,
  );
  const totalUb = upperRounds.length;
  const isEmpty = phase.matches.length === 0;

  const roundName = (r: number, total: number, side: "upper" | "lower") => {
    if (side === "upper") {
      const remaining = total - r;
      if (remaining === 1) return "Final Superior";
      if (remaining === 2) return "Semi Superior";
      if (remaining === 3) return "Quartas";
      return `Rodada ${r + 1}`;
    }
    return `Chave Inferior R${r + 1}`;
  };

  const columnTools = (side: "upper" | "lower", index: number, name: string) =>
    editing ? (
      <div className="flex flex-wrap items-center gap-1">
        <input
          defaultValue={name}
          aria-label="Nome da rodada"
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== name)
              run({ type: "renameRound", side, round: index, name: e.target.value });
          }}
          className="w-full border-2 border-gold/40 bg-ink px-2 py-1 text-[11px] uppercase tracking-widest text-bone outline-none focus:border-gold"
        />
        <ToolBtn label="Adicionar confronto" onClick={() => run({ type: "addMatch", side, round: index })}>
          <Plus className="h-3 w-3" /> Vaga
        </ToolBtn>
        <ToolBtn label="Remover confronto" onClick={() => run({ type: "removeMatch", side, round: index })}>
          <Minus className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn
          danger
          label="Remover rodada"
          onClick={() => run({ type: "removeRound", side, round: index })}
        >
          <Trash2 className="h-3 w-3" />
        </ToolBtn>
      </div>
    ) : null;

  return (
    <div className="space-y-8 overflow-x-auto pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`inline-flex items-center gap-2 border-2 px-3 py-1.5 font-display text-sm uppercase tracking-widest ${
            editing ? "border-gold bg-gold text-ink" : "border-gold/60 text-gold hover:bg-gold hover:text-ink"
          }`}
        >
          <Wrench className="h-4 w-4" />
          {editing ? "Concluir edição da chave" : "Editar chave"}
        </button>
        {editing ? (
          <>
            <ToolBtn label="Nova rodada superior" onClick={() => run({ type: "addRound", side: "upper" })}>
              <Plus className="h-3 w-3" /> Rodada superior
            </ToolBtn>
            <ToolBtn label="Nova rodada inferior" onClick={() => run({ type: "addRound", side: "lower" })}>
              <Plus className="h-3 w-3" /> Rodada inferior
            </ToolBtn>
            <ToolBtn label="Grande final" onClick={() => run({ type: "toggleGrandFinal" })}>
              {hasGrand ? "Remover grande final" : "Grande final"}
            </ToolBtn>
            {hasGrand ? (
              <ToolBtn label="Reset da chave" onClick={() => run({ type: "toggleReset" })}>
                {hasReset ? "Remover reset" : "Reset da chave"}
              </ToolBtn>
            ) : null}
          </>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="border-2 border-dashed border-gold/50 bg-black/30 px-6 py-10 text-center">
          <h2 className="font-display text-3xl uppercase tracking-widest text-bone">
            Playoff vazio
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nada foi criado automaticamente. Ative “Editar chave” e adicione somente as rodadas que quiser.
          </p>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-5 inline-flex items-center gap-2 border-2 border-gold bg-gold px-4 py-2 font-display text-sm uppercase tracking-widest text-ink"
            >
              <Wrench className="h-4 w-4" /> Começar a montar
            </button>
          ) : (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <ToolBtn label="Criar primeira rodada superior" onClick={() => run({ type: "addRound", side: "upper" })}>
                <Plus className="h-3 w-3" /> Primeiro confronto superior
              </ToolBtn>
              <ToolBtn label="Criar primeira rodada inferior" onClick={() => run({ type: "addRound", side: "lower" })}>
                <Plus className="h-3 w-3" /> Primeiro confronto inferior
              </ToolBtn>
              <ToolBtn label="Criar grande final" onClick={() => run({ type: "toggleGrandFinal" })}>
                <Plus className="h-3 w-3" /> Grande final
              </ToolBtn>
            </div>
          )}
        </div>
      ) : null}

      {upper.length > 0 ? <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="h-1 w-8 bg-gold" />
          <h2 className="font-display text-2xl uppercase tracking-widest text-gold">
            Chave Superior
          </h2>
        </div>
        <div className="flex min-w-max items-stretch gap-6">
          {upperRounds.map((r, i) => {
            const rm = upper
              .filter((m) => (m.round ?? 0) === r)
              .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
            return (
              <Column
                key={`u-${r}`}
                title={rm[0]?.roundName ?? roundName(r, totalUb, "upper")}
                spacing={Math.pow(2, r)}
                tools={columnTools(
                  "upper",
                  i,
                  rm[0]?.roundName ?? roundName(r, totalUb, "upper"),
                )}
              >
                {rm.map((m) => (
                  <MatchCard
                    key={m.id}
                    championshipId={championshipId} teams={teams}
                    allTeams={allTeams}
                    phaseId={phase.id}
                    match={m}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </div> : null}

      {lower.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1 w-8 bg-blood" />
            <h2 className="font-display text-2xl uppercase tracking-widest text-blood">
              Chave Inferior
            </h2>
          </div>
          <div className="flex min-w-max items-stretch gap-6">
            {lowerRounds.map((r, i) => {
              const rm = lower
                .filter((m) => (m.round ?? 0) === r)
                .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
              return (
                <Column
                  key={`l-${r}`}
                  title={rm[0]?.roundName ?? roundName(r, lowerRounds.length, "lower")}
                  spacing={1}
                  tools={columnTools(
                    "lower",
                    i,
                    rm[0]?.roundName ?? roundName(r, lowerRounds.length, "lower"),
                  )}
                >
                  {rm.map((m) => (
                    <MatchCard
                      key={m.id}
                      championshipId={championshipId} teams={teams}
                    allTeams={allTeams}
                      phaseId={phase.id}
                      match={m}
                    />
                  ))}
                </Column>
              );
            })}
          </div>
        </div>
      ) : null}

      {grand.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1 w-8 bg-bone" />
            <h2 className="font-display text-2xl uppercase tracking-widest text-bone">
              Grande Final
            </h2>
          </div>
          <div className="flex min-w-max items-stretch gap-6">
            {grand.map((m) => (
              <Column
                key={m.id}
                title={m.roundName ?? "Grande Final"}
                spacing={0}
              >
                <MatchCard
                  championshipId={championshipId} teams={teams}
                    allTeams={allTeams}
                  phaseId={phase.id}
                  match={m}
                />
              </Column>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}