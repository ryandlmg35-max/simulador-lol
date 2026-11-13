import { Eraser, Plus, Trash2, Wand2 } from "lucide-react";
import type { BestOf, CustomBracketSpec, CustomRoundSpec, PlayoffsConfig } from "@/lib/lol/types";
import { defaultCustomSpec, emptyCustomSpec, uid } from "@/lib/lol/generate";

const BO_OPTIONS: BestOf[] = [1, 3, 5];

function BoSelect({
  value,
  onChange,
}: {
  value: BestOf;
  onChange: (v: BestOf) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as BestOf)}
      className="border-2 border-border bg-input px-2 py-1 font-display text-sm uppercase tracking-widest text-bone"
    >
      {BO_OPTIONS.map((b) => (
        <option key={b} value={b}>
          Bo{b}
        </option>
      ))}
    </select>
  );
}

function RoundList({
  title,
  accent,
  rounds,
  fallbackName,
  onChange,
}: {
  title: string;
  accent: "gold" | "blood";
  rounds: CustomRoundSpec[];
  fallbackName: (i: number) => string;
  onChange: (rounds: CustomRoundSpec[]) => void;
}) {
  const patch = (id: string, p: Partial<CustomRoundSpec>) =>
    onChange(rounds.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="border-2 border-border bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div
          className={`font-display text-sm uppercase tracking-[0.25em] ${
            accent === "gold" ? "text-gold" : "text-blood"
          }`}
        >
          {title}
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...rounds,
              {
                id: uid(),
                name: fallbackName(rounds.length),
                matches: Math.max(1, Math.floor((rounds[rounds.length - 1]?.matches ?? 2) / 2) || 1),
                bestOf: 3,
              },
            ])
          }
          className="inline-flex items-center gap-1 border-2 border-gold/60 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink"
        >
          <Plus className="h-3 w-3" /> Rodada
        </button>
      </div>

      {rounds.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma rodada. Clique em “Rodada” para adicionar.
        </p>
      ) : (
        <div className="space-y-2">
          {rounds.map((r, i) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2"
            >
              <input
                value={r.name}
                placeholder={fallbackName(i)}
                onChange={(e) => patch(r.id, { name: e.target.value })}
                className="border-2 border-border bg-input px-2 py-1 text-sm text-bone"
              />
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Confrontos
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={r.matches}
                  onChange={(e) =>
                    patch(r.id, {
                      matches: Math.min(32, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-16 border-2 border-border bg-input px-2 py-1 text-center text-sm text-bone"
                />
              </label>
              <BoSelect value={r.bestOf} onChange={(v) => patch(r.id, { bestOf: v })} />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {r.matches * 2} vagas
              </span>
              <button
                type="button"
                onClick={() => onChange(rounds.filter((x) => x.id !== r.id))}
                className="border-2 border-border p-1.5 text-muted-foreground hover:border-blood hover:text-blood"
                aria-label="Remover rodada"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayoffBuilder({
  config,
  onConfig,
}: {
  config: PlayoffsConfig;
  onConfig: (patch: Partial<PlayoffsConfig>) => void;
}) {
  const spec = config.custom ?? emptyCustomSpec();

  const patchSpec = (p: Partial<typeof spec>) =>
    onConfig({ mode: "custom", custom: { ...spec, ...p } });

  const totalMatches =
    spec.upper.reduce((a, r) => a + r.matches, 0) +
    spec.lower.reduce((a, r) => a + r.matches, 0) +
    (spec.grandFinal ? 1 : 0) +
    (spec.grandFinal && spec.bracketReset ? 1 : 0);

  const capacity =
    (spec.upper[0]?.matches ?? 0) * 2 + (spec.lower[0]?.matches ?? 0) * 2;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Monte a chave do zero: quantas rodadas, quantos confrontos por rodada e
          quantos jogos em cada um. Times podem começar direto na chave inferior.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => patchSpec(emptyCustomSpec())}
            className="inline-flex items-center gap-1 border-2 border-blood/60 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-blood hover:bg-blood hover:text-ink"
          >
            <Eraser className="h-3 w-3" /> Deixar totalmente vazio
          </button>
          <button
            type="button"
            onClick={() =>
              patchSpec(
                defaultCustomSpec(
                  config.slots,
                  config.type,
                  config.defaultBestOf,
                  config.finalBestOf,
                  config.bracketReset,
                ),
              )
            }
            className="inline-flex items-center gap-1 border-2 border-border px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:border-gold hover:text-gold"
          >
            <Wand2 className="h-3 w-3" /> Sugerir base (opcional)
          </button>
        </div>
      </div>

      <RoundList
        title="Chave Superior"
        accent="gold"
        rounds={spec.upper}
        fallbackName={(i) => `Rodada ${i + 1}`}
        onChange={(upper) => patchSpec({ upper })}
      />
      <RoundList
        title="Chave Inferior"
        accent="blood"
        rounds={spec.lower}
        fallbackName={(i) => `Chave Inferior R${i + 1}`}
        onChange={(lower) => patchSpec({ lower })}
      />

      <div className="flex flex-wrap items-center gap-4 border-2 border-border bg-black/30 p-3">
        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-bone">
          <input
            type="checkbox"
            checked={spec.grandFinal}
            onChange={(e) => patchSpec({ grandFinal: e.target.checked })}
            className="h-4 w-4 accent-gold"
          />
          Grande Final
        </label>
        {spec.grandFinal ? (
          <>
            <BoSelect
              value={spec.grandFinalBestOf}
              onChange={(v) => patchSpec({ grandFinalBestOf: v })}
            />
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-bone">
              <input
                type="checkbox"
                checked={spec.bracketReset}
                onChange={(e) => patchSpec({ bracketReset: e.target.checked })}
                className="h-4 w-4 accent-gold"
              />
              Reset da chave
            </label>
          </>
        ) : null}
      </div>

      <BracketMap spec={spec} />

      <div className="border-2 border-gold/40 bg-black/30 p-3 text-xs text-muted-foreground">
        <span className="font-display text-sm uppercase tracking-widest text-gold">
          Resumo:
        </span>{" "}
        {totalMatches} confronto(s) no total · até {capacity} times entram na
        primeira rodada (superior + inferior). Depois de criar, você pode arrastar
        qualquer time para qualquer vaga.
      </div>
    </div>
  );
}

function MapColumn({
  title,
  matches,
  accent,
}: {
  title: string;
  matches: number;
  accent: "gold" | "blood" | "bone";
}) {
  const border =
    accent === "gold" ? "border-gold/60" : accent === "blood" ? "border-blood/60" : "border-bone/60";
  const text =
    accent === "gold" ? "text-gold" : accent === "blood" ? "text-blood" : "text-bone";
  return (
    <div className="min-w-36 shrink-0 space-y-1">
      <div className={`truncate font-display text-[11px] uppercase tracking-widest ${text}`}>
        {title}
      </div>
      {Array.from({ length: matches }).map((_, i) => (
        <div key={i} className={`border-2 ${border} bg-black/40 p-1`}>
          <div className="h-3 border border-dashed border-border" />
          <div className="mt-1 h-3 border border-dashed border-border" />
        </div>
      ))}
    </div>
  );
}

function BracketMap({ spec }: { spec: CustomBracketSpec }) {
  const empty =
    spec.upper.length === 0 && spec.lower.length === 0 && !spec.grandFinal;
  return (
    <div className="border-2 border-border bg-black/30 p-3">
      <div className="mb-2 font-display text-sm uppercase tracking-[0.25em] text-bone">
        Mapa da chave
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground">
          Vazio. Adicione rodadas acima e o mapa aparece aqui.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {spec.upper.map((r, i) => (
            <MapColumn key={r.id} title={r.name || `Rodada ${i + 1}`} matches={r.matches} accent="gold" />
          ))}
          {spec.lower.map((r, i) => (
            <MapColumn key={r.id} title={r.name || `Inferior R${i + 1}`} matches={r.matches} accent="blood" />
          ))}
          {spec.grandFinal ? (
            <MapColumn title="Grande Final" matches={spec.bracketReset ? 2 : 1} accent="bone" />
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PlayoffModeToggle({
  config,
  onConfig,
}: {
  config: PlayoffsConfig;
  onConfig: (patch: Partial<PlayoffsConfig>) => void;
}) {
  const mode = config.mode === "custom" ? "custom" : "auto";
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onConfig({ mode: "auto" })}
        className={`border-2 py-2 font-display text-sm uppercase tracking-widest ${
          mode === "auto"
            ? "border-gold bg-gold text-ink"
            : "border-border bg-input text-muted-foreground"
        }`}
      >
        Automático
      </button>
      <button
        type="button"
        onClick={() => {
          if (mode === "custom") return;
          onConfig({ mode: "custom", custom: emptyCustomSpec() });
        }}
        className={`border-2 py-2 font-display text-sm uppercase tracking-widest ${
          mode === "custom"
            ? "border-gold bg-gold text-ink"
            : "border-border bg-input text-muted-foreground"
        }`}
      >
        Vazio · montar do zero
      </button>
    </div>
  );
}