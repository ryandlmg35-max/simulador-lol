import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Star, Users, X } from "lucide-react";
import { useStore } from "@/lib/lol/store";
import type { Team } from "@/lib/lol/types";
import { uid } from "@/lib/lol/generate";
import { TeamLogo } from "./team-logo";

/**
 * Puxa times direto do RANKING GLOBAL DE CARREIRA (Power Ranking) — os
 * melhores colocados por pontos, títulos e rating ELO. Serve pra criar
 * campeonatos "All-Stars" ou "Best of the Best" com os times mais fortes.
 */
export function ImportFromRanking({
  game,
  onImport,
  currentTeamNames = [],
}: {
  game: string;
  onImport: (teams: Team[]) => void;
  currentTeamNames?: string[];
}) {
  const { career } = useStore();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(8);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const gameKey = game as "lol" | "cs2";
  const ranked = useMemo(() => {
    const table = career[gameKey] ?? {};
    return Object.values(table)
      .filter((t) => t.played > 0)
      .sort((a, b) => b.points - a.points || b.titles - a.titles || b.wins - a.wins);
  }, [career, gameKey]);

  const presentNames = useMemo(
    () => new Set(currentTeamNames.map((n) => n.trim().toLowerCase())),
    [currentTeamNames],
  );
  const isPresent = (name: string) => presentNames.has(name.trim().toLowerCase());

  const applyRange = (f: number, t: number) => {
    const max = Math.max(1, ranked.length);
    const nf = Math.max(1, Math.min(max, f));
    const nt = Math.max(nf, Math.min(max, t));
    setFrom(nf);
    setTo(nt);
    setPicked(
      Object.fromEntries(
        ranked.map((team, i) => [
          team.name,
          i + 1 >= nf && i + 1 <= nt && !isPresent(team.name),
        ]),
      ),
    );
  };

  const openModal = () => {
    applyRange(from, to);
    setOpen(true);
  };

  const pickedCount = ranked.filter((t) => picked[t.name]).length;

  const confirm = () => {
    const selected = ranked
      .filter((t) => picked[t.name])
      .map((t) => ({
        id: uid(),
        name: t.name,
        tag: t.tag ?? t.name.slice(0, 3).toUpperCase(),
        logo: t.logo,
        region: t.region,
      }));
    if (selected.length === 0) return;
    onImport(selected);
    setOpen(false);
  };

  const positionLabel = (i: number) => {
    if (i < 2) return "Elite";
    if (i < 4) return "Top 4";
    if (i < 8) return "Top 8";
    return `${i + 1}º`;
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex w-full items-center justify-center gap-2 border-2 border-gold/60 bg-gold/10 px-4 py-3 font-display text-sm uppercase tracking-widest text-gold hover:bg-gold/20"
        title="Puxa os melhores times do Ranking Global de Carreira (Power Ranking)"
      >
        <Star className="h-5 w-5" /> Puxar do Ranking Global (melhores times)
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10">
          <div className="w-full max-w-2xl border-2 border-gold bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wider text-gold">
                <Star className="h-6 w-6" /> Ranking Global de Times
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
              Os melhores times da carreira por pontos, títulos e rating ELO.
              Escolha a faixa (ex: Top 8) ou marque individualmente.
            </p>

            {ranked.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum time no ranking ainda — jogue partidas em campeonatos
                contabilizados primeiro.
              </p>
            ) : (
              <>
                {/* Faixa */}
                <div className="mb-3 flex flex-wrap items-end gap-2 border-2 border-gold/40 bg-black/30 p-3">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-gold">Do</span>
                    <input
                      type="number"
                      min={1}
                      max={ranked.length}
                      value={from}
                      onChange={(e) => applyRange(Number(e.target.value) || 1, to)}
                      className="w-16 border-2 border-border bg-input px-2 py-1 text-center font-display text-lg text-bone outline-none focus:border-gold"
                    />
                    <span className="text-[10px] uppercase tracking-widest text-gold">º ao</span>
                    <input
                      type="number"
                      min={from}
                      max={ranked.length}
                      value={to}
                      onChange={(e) => applyRange(from, Number(e.target.value) || from)}
                      className="w-16 border-2 border-border bg-input px-2 py-1 text-center font-display text-lg text-bone outline-none focus:border-gold"
                    />
                    <span className="text-[10px] uppercase tracking-widest text-gold">º lugar</span>
                  </label>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {ranked.length} times ranqueados
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => applyRange(1, 4)}
                      className="border border-gold/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink"
                    >
                      Top 4
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRange(1, 8)}
                      className="border border-gold/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink"
                    >
                      Top 8
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRange(1, 16)}
                      className="border border-gold/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink"
                    >
                      Top 16
                    </button>
                  </div>
                </div>

                {/* Lista */}
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                  {ranked.map((t, i) => {
                    const present = isPresent(t.name);
                    const checked = !!picked[t.name];
                    const rating = t.rating ?? 50;
                    return (
                      <label
                        key={t.name}
                        className={`flex cursor-pointer items-center gap-2 border-2 p-2 ${
                          present
                            ? "cursor-not-allowed border-ink bg-black/50 opacity-60"
                            : checked
                              ? "border-gold/60 bg-gold/10"
                              : "border-ink bg-black/30 hover:border-gold/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={present}
                          onChange={(e) =>
                            setPicked((prev) => ({ ...prev, [t.name]: e.target.checked }))
                          }
                          className="h-4 w-4 accent-[var(--gold)]"
                        />
                        <span className="w-8 shrink-0 text-center font-display text-lg text-gold">
                          {i + 1}
                        </span>
                        <TeamLogo
                          team={{ id: t.name, name: t.name, tag: t.tag ?? "", logo: t.logo }}
                          size={26}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-display text-base uppercase tracking-wider text-bone">
                            {t.name}
                          </span>
                          <span className="ml-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                            {positionLabel(i)}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-sm font-bold text-gold">{t.points} pts</div>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                            {t.titles > 0 ? `${t.titles}🏆` : ""} · {t.wins}V-{t.losses}D · ELO {Math.round(rating)}
                          </div>
                        </div>
                        {present ? (
                          <span className="shrink-0 border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            já está
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={pickedCount === 0}
                  onClick={confirm}
                  className="mt-4 flex w-full items-center justify-center gap-2 border-2 border-gold bg-gold py-3 font-display text-xl uppercase tracking-widest text-ink hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Users className="h-5 w-5" /> Puxar {pickedCount} time(s)
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
