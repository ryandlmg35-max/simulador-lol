import { useMemo, useState } from "react";
import { Globe, RefreshCw, ShieldAlert, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useStore } from "@/lib/lol/store";
import type { Team } from "@/lib/lol/types";
import { buildWorldCupNationalTeams, type WorldCupNationCallup } from "@/lib/lol/world-cup";
import { CountryFlag } from "./country-flag";

const ROLE_SHORT: Record<string, string> = {
  top: "TOP",
  jungle: "JG",
  mid: "MID",
  adc: "ADC",
  support: "SUP",
};

export function WorldCupCallupPanel({
  onApplyTeams,
  currentTeamCount,
}: {
  onApplyTeams: (teams: Team[]) => void;
  currentTeamCount: number;
}) {
  const { championships, career } = useStore();
  const [expanded, setExpanded] = useState(true);
  const [selectedNation, setSelectedNation] = useState<string | null>(null);

  const result = useMemo(
    () => buildWorldCupNationalTeams(championships, career),
    [championships, career],
  );

  const activeNation: WorldCupNationCallup | undefined =
    result.nations.find((n) => n.country.code === selectedNation) ?? result.nations[0];

  return (
    <div className="border-2 border-sky-400/60 bg-sky-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Globe className="h-5 w-5 text-sky-400" />
          <div>
            <div className="font-display text-sm font-bold uppercase tracking-widest text-sky-300">
              Convocação da Copa do Mundo · Seleções por Desempenho
            </div>
            <p className="text-[11px] text-muted-foreground">
              100% nativos de cada país (zero gringos) · Convocados de qualquer liga do mundo pela fase atual ·{" "}
              <span className="font-semibold text-sky-200">
                {result.nations.length} seleções elegíveis
              </span>{" "}
              (dinâmico conforme jogadores disponíveis nas 5 rotas)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyTeams(result.teams)}
            disabled={result.teams.length < 2}
            className="flex items-center gap-1.5 border-2 border-sky-400 bg-sky-500/20 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-sky-200 hover:bg-sky-500/30 disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {currentTeamCount > 0 ? "Reconvocar Seleções" : `Convocar ${result.nations.length} Seleções`}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="border border-sky-400/40 px-2 py-1.5 text-sky-300 hover:bg-sky-500/10"
            title={expanded ? "Recolher prévia" : "Ver convocados"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && result.nations.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Lista horizontal / grade compacta das seleções formadas */}
          <div className="flex flex-wrap gap-1.5">
            {result.nations.map((n) => {
              const active = activeNation?.country.code === n.country.code;
              return (
                <button
                  key={n.country.code}
                  type="button"
                  onClick={() => setSelectedNation(n.country.code)}
                  className={`flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "border-sky-400 bg-sky-500/25 text-bone font-bold"
                      : "border-border/60 bg-black/40 text-muted-foreground hover:text-bone"
                  }`}
                >
                  <CountryFlag code={n.country.code} size="sm" />
                  <span>{n.country.name}</span>
                  <span className="font-mono text-[10px] text-sky-300">
                    {n.avgPerformance}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detalhe da Seleção Selecionada */}
          {activeNation && (
            <div className="border border-sky-400/30 bg-black/50 p-3">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <CountryFlag code={activeNation.country.code} size="md" />
                  <span className="font-display text-sm font-bold uppercase tracking-wider text-bone">
                    {activeNation.team.name}
                  </span>
                  <span className="border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                    Média {activeNation.avgPerformance}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    <strong>Técnico:</strong> {activeNation.coachReason}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                {activeNation.starters.map((s) => (
                  <div
                    key={s.player.id}
                    className="flex flex-col justify-between border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 font-bold text-bone truncate">
                        <span className="border border-sky-400/40 bg-sky-500/15 px-1 py-0.2 font-mono text-[9px] text-sky-300 shrink-0">
                          {ROLE_SHORT[s.player.role] ?? s.player.role.toUpperCase()}
                        </span>
                        <span className="truncate">{s.player.ign}</span>
                      </span>
                      <span className="font-mono text-[10px] text-sky-300">
                        {s.performanceScore}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">{s.clubName}</span>
                      <span className="font-mono uppercase">{s.clubRegion}</span>
                    </div>
                  </div>
                ))}
              </div>

              {activeNation.subs.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-sky-300/80">
                    Reservas:
                  </span>
                  {activeNation.subs.map((sub) => (
                    <span
                      key={sub.player.id}
                      className="inline-flex items-center gap-1 border border-border/40 bg-black/40 px-2 py-0.5"
                    >
                      <span className="font-mono text-[9px] text-sky-300">
                        {ROLE_SHORT[sub.player.role] ?? sub.player.role.toUpperCase()}
                      </span>
                      {sub.player.ign} ({sub.clubName}) · {sub.performanceScore}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {result.skippedCountries.length > 0 && (
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>
                Países sem 5 rotas completas (não convocados):{" "}
                {result.skippedCountries
                  .slice(0, 6)
                  .map((c) => `${c.name} (${c.availableCount} jog.)`)
                  .join(", ")}
                {result.skippedCountries.length > 6
                  ? ` e +${result.skippedCountries.length - 6}`
                  : ""}
                .
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
