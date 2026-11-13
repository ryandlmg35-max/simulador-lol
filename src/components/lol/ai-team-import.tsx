import { useState, useMemo } from "react";
import { Search, X, Users, Trophy } from "lucide-react";
import type { GameId, Team } from "@/lib/lol/types";
import { uid } from "@/lib/lol/generate";
import { LOCAL_REGIONS } from "@/lib/lol/local-teams";
import { playerFromScout } from "@/lib/lol/players";

const inputCls =
  "w-full border-2 border-border bg-input px-3 py-2 font-condensed text-base uppercase tracking-wide text-foreground outline-none focus:border-gold";

export function AiTeamImport({
  game,
  onImport,
}: {
  game: GameId;
  onImport: (teams: Team[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const allTeams = useMemo(() => {
    return LOCAL_REGIONS.flatMap((r) =>
      r.teams.map((t) => ({ ...t, regionLogo: r.logo, regionName: r.name })),
    );
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    // First try exact region match (e.g., "CBLOL")
    const regionMatches = allTeams.filter((t) => t.regionName.toLowerCase() === q);
    if (regionMatches.length > 0) return regionMatches;

    // Then fuzzy match team names or tags
    return allTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q) ||
        t.regionName.toLowerCase().includes(q),
    );
  }, [query, allTeams]);

  // When results change, default to picking all matches: sempre que a busca é
  // uma liga exata (ex: clicou no botão "CBLOL") marca todos; senão, marca
  // todos quando cabem numa tela (≤20).
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setPicked({});
      return;
    }
    const q = val.toLowerCase();
    const rMatches = allTeams.filter((t) => t.regionName.toLowerCase() === q);
    const isExactRegion = rMatches.length > 0;
    const newResults = isExactRegion
      ? rMatches
      : allTeams.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.tag.toLowerCase().includes(q) ||
            t.regionName.toLowerCase().includes(q),
        );

    if (newResults.length > 0 && (isExactRegion || newResults.length <= 20)) {
      setPicked(Object.fromEntries(newResults.map((t) => [t.name, true])));
    } else {
      setPicked({});
    }
  };

  const importPicked = () => {
    if (!results.length) return;
    const teamsToImport: Team[] = results
      .filter((t) => picked[t.name])
      .map((t) => ({
        id: uid(),
        name: t.name,
        tag: t.tag,
        logo: t.logo,
        region: t.regionName,
        // Elenco real de 2026 (banco scrapeado) — ativa o sistema de
        // evolução no time importado.
        roster: t.roster?.map(playerFromScout),
        synergy: 0,
        culture: 50,
      }));
    if (teamsToImport.length) onImport(teamsToImport);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 border-2 border-gold bg-gold/10 py-3 font-display text-lg uppercase tracking-widest text-gold hover:bg-gold/20"
      >
        <Users className="h-5 w-5" strokeWidth={3} /> Importar Times do Banco Global
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10">
          <div className="w-full max-w-3xl border-2 border-gold bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-3xl uppercase tracking-wider text-bone flex items-center gap-3">
                <Trophy className="text-gold h-6 w-6" />
                Banco de Dados de Times
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-2 border-border p-1 text-muted-foreground hover:border-blood hover:text-blood"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 font-condensed text-sm uppercase tracking-widest text-muted-foreground">
              Busca instantânea e sem limites nos maiores times de LoL do mundo (CBLOL, LCK, LPL,
              LEC, LCS, LCP).
            </p>

            <div className="flex flex-col gap-2 md:flex-row mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  className={`${inputCls} pl-10`}
                  placeholder="Busque por região (ex: CBLOL) ou nome do time (ex: T1)"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {LOCAL_REGIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleQueryChange(r.name)}
                  className="flex items-center gap-2 border border-gold/40 bg-black/40 px-3 py-1.5 font-display text-sm hover:bg-gold/20 hover:border-gold text-bone"
                >
                  <img
                    src={r.logo}
                    alt={`Logo da região ${r.name}`}
                    className="h-4 w-4 object-contain"
                  />
                  {r.name}
                </button>
              ))}
            </div>

            {results && results.length > 0 ? (
              <>
                <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                  {results.map((t, i) => (
                    <label
                      key={`${t.name}-${i}`}
                      className="flex cursor-pointer items-center gap-3 border-2 border-ink bg-black/30 p-2 hover:border-gold/60"
                    >
                      <input
                        type="checkbox"
                        checked={!!picked[t.name]}
                        onChange={(e) => setPicked((p) => ({ ...p, [t.name]: e.target.checked }))}
                        className="h-4 w-4 accent-[var(--gold)]"
                      />
                      {t.logo ? (
                        <img
                          src={t.logo}
                          alt={`Logo do time ${t.name}`}
                          className="h-9 w-9 object-contain"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center bg-blood text-xs font-bold text-bone">
                          {t.tag.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-xl uppercase leading-none tracking-wide text-bone flex items-center gap-2">
                          {t.name} <span className="text-gold">[{t.tag}]</span>
                        </div>
                        <div className="truncate font-condensed text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1 mt-1">
                          <img
                            src={t.regionLogo}
                            className="h-3 w-3 object-contain"
                            alt={`Logo da região ${t.regionName}`}
                          />
                          {t.regionName}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={importPicked}
                  disabled={Object.values(picked).filter(Boolean).length === 0}
                  className="mt-4 w-full border-2 border-gold bg-gold py-3 font-display text-xl uppercase tracking-widest text-ink hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Importar {Object.values(picked).filter(Boolean).length} time(s)
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
