import { useMemo, useState } from "react";
import { Search, TriangleAlert, Wand2, X } from "lucide-react";
import type { Championship, Team } from "@/lib/lol/types";
import { LOCAL_REGIONS } from "@/lib/lol/local-teams";
import { uid } from "@/lib/lol/generate";
import { playerFromScout } from "@/lib/lol/players";

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Descobre a liga do banco a partir da região ou do nome do campeonato. */
export function resolveBankLeague(championship: Championship) {
  const normName = normalize(championship.name);
  return (
    LOCAL_REGIONS.find(
      (r) => championship.region && normalize(r.name) === normalize(championship.region),
    ) ??
    LOCAL_REGIONS.find((r) => normName.includes(normalize(r.name))) ??
    null
  );
}

/**
 * "Montar Série B automática": lista os times do banco da liga que NÃO estão
 * na Série A (nem na Série B atual), já pré-selecionados — o usuário só
 * desmarca quem não quiser e confirma.
 */
export function AutoFillSerieB({
  championship,
  onAdd,
}: {
  championship: Championship;
  onAdd: (teams: Team[]) => void;
}) {
  const detected = resolveBankLeague(championship);
  const [open, setOpen] = useState(false);
  const [leagueId, setLeagueId] = useState(detected?.id ?? LOCAL_REGIONS[0].id);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const league = LOCAL_REGIONS.find((r) => r.id === leagueId) ?? LOCAL_REGIONS[0];

  const takenNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of championship.teams) names.add(normalize(t.name));
    for (const t of championship.serieB?.teams ?? []) names.add(normalize(t.name));
    return names;
  }, [championship]);

  const candidates = useMemo(
    () => league.teams.filter((t) => !takenNames.has(normalize(t.name))),
    [league, takenNames],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return candidates;
    return candidates.filter((t) => normalize(t.name).includes(q) || normalize(t.tag).includes(q));
  }, [candidates, query]);

  const checkedCount = candidates.filter((t) => checked[t.name]).length;

  const openModal = () => {
    setLeagueId(detected?.id ?? leagueId);
    setChecked(Object.fromEntries(candidates.map((t) => [t.name, true])));
    setQuery("");
    setOpen(true);
  };

  const changeLeague = (id: string) => {
    setLeagueId(id);
    const next = LOCAL_REGIONS.find((r) => r.id === id) ?? LOCAL_REGIONS[0];
    const nextNames = new Set(
      [...championship.teams, ...(championship.serieB?.teams ?? [])].map((t) => normalize(t.name)),
    );
    setChecked(
      Object.fromEntries(
        next.teams.filter((t) => !nextNames.has(normalize(t.name))).map((t) => [t.name, true]),
      ),
    );
    setQuery("");
  };

  const confirm = () => {
    const selected = candidates
      .filter((t) => checked[t.name])
      .map((t) => ({
        id: uid(),
        name: t.name,
        tag: t.tag,
        region: t.region,
        logo: t.logo,
        // Elenco real de 2026 — a Série B também evolui.
        roster: t.roster?.map(playerFromScout),
        synergy: 0,
        culture: 50,
      }));
    if (selected.length === 0) return;
    onAdd(selected);
    setOpen(false);
  };

  const estimatedMatches = checkedCount > 1 ? (checkedCount * (checkedCount - 1)) / 2 : 0;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex w-full items-center justify-center gap-2 border-2 border-gold bg-gold/10 px-4 py-3 font-display text-sm uppercase tracking-widest text-gold hover:bg-gold/20"
        title="Traz do banco global os times da liga que não estão na Série A"
      >
        <Wand2 className="h-5 w-5" strokeWidth={2.5} />
        Montar Série B automática
        {detected ? (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
            (banco {detected.name}, fora da Série A)
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10">
          <div className="w-full max-w-2xl border-2 border-gold bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wider text-gold">
                <Wand2 className="h-6 w-6" /> Montar Série B automática
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

            <p className="mb-3 text-sm text-muted-foreground">
              Times do banco que <span className="text-gold">não estão</span> na sua Série A nem na
              Série B atual. Desmarque quem não quiser — as fases da Série B (Grupos + Playoffs) são
              criadas sozinhas se ainda não existirem.
            </p>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <label className="flex items-center gap-2 border-2 border-border bg-input px-2 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Liga
                </span>
                <select
                  value={leagueId}
                  onChange={(e) => changeLeague(e.target.value)}
                  className="bg-transparent font-display text-sm uppercase tracking-widest text-bone outline-none"
                >
                  {LOCAL_REGIONS.map((r) => (
                    <option key={r.id} value={r.id} className="bg-ink text-bone">
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full border-2 border-border bg-input py-2 pl-10 pr-3 font-condensed text-base uppercase tracking-wide text-foreground outline-none focus:border-gold"
                  placeholder="Filtrar por nome ou sigla..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {candidates.length} disponíveis · {checkedCount} selecionados
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setChecked(Object.fromEntries(candidates.map((t) => [t.name, true])))
                  }
                  className="border border-gold/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setChecked({})}
                  className="border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:border-blood hover:text-blood"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((t) => (
                <label
                  key={t.name}
                  className="flex cursor-pointer items-center gap-3 border-2 border-ink bg-black/30 p-2 hover:border-gold/60"
                >
                  <input
                    type="checkbox"
                    checked={!!checked[t.name]}
                    onChange={(e) =>
                      setChecked((prev) => ({
                        ...prev,
                        [t.name]: e.target.checked,
                      }))
                    }
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
                    <div className="font-display text-lg uppercase leading-none tracking-wide text-bone">
                      {t.name} <span className="text-gold">[{t.tag}]</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.region}
                    </div>
                  </div>
                </label>
              ))}
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {candidates.length === 0 ? (
                    <div className="space-y-2">
                      <p>
                        Nenhum time disponível desta liga —{" "}
                        <span className="text-gold">todos já estão no campeonato</span>,
                        provavelmente na Série A (a versão antiga misturava as divisões).
                      </p>
                      <p className="text-xs">
                        Solução: no editor, cada time da Série A agora tem um botão{" "}
                        <span className="text-blood">"→ Série B"</span> — use-o para mover os times
                        certos para cá.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Nenhum resultado para este filtro — limpe a busca para ver todos os{" "}
                      {candidates.length} disponíveis.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {checkedCount > 16 ? (
              <div className="mt-3 flex items-start gap-2 border border-gold/40 bg-gold/5 p-2 text-xs text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  São {checkedCount} times — uma fase de grupos no turno único teria ~
                  {estimatedMatches} partidas. Desmarque quem não quiser (uma Série B costuma ter 8
                  a 12).
                </span>
              </div>
            ) : null}

            <button
              type="button"
              disabled={checkedCount === 0}
              onClick={confirm}
              className="mt-4 w-full border-2 border-gold bg-gold py-3 font-display text-xl uppercase tracking-widest text-ink hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Adicionar {checkedCount} time(s) à Série B
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
