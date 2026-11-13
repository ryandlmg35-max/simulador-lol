import { useMemo, useState } from "react";
import { Download, Trophy, Users, X, Sparkles, Check } from "lucide-react";
import { useStore } from "@/lib/lol/store";
import type { Team } from "@/lib/lol/types";
import { uid } from "@/lib/lol/generate";
import { seriesRanking } from "@/lib/lol/promotion";
import { TeamLogo } from "./team-logo";
import { computeRegionSlots, normalizeRegion, getOfficialRegionRanking } from "@/lib/lol/international";
import { getChampionshipRegionNorm } from "@/lib/lol/circuit";

function getTargetCountFor(
  targetName: string | undefined,
  region: string,
  isTop2: boolean,
  slotInfo?: { worlds?: number; msi?: number },
): { to: number; label: string; tagBadge: string; isDynamic: boolean } {
  const target = (targetName ?? "").toLowerCase();

  // 1. First Stand: Apenas o Campeão (1º lugar)
  if (target.includes("first stand") || target.includes("kickoff")) {
    return {
      to: 1,
      label: `1 vaga (Campeão / 1º lugar da ${region})`,
      tagBadge: `FIRST STAND: 1 VAGA (CAMPEÃO)`,
      isDynamic: false,
    };
  }

  // 2. MSI: Vagas dinâmicas de MSI do ranking regional
  if (target.includes("msi") || target.includes("mid-season") || target.includes("mid season")) {
    const to =
      slotInfo?.msi && slotInfo.msi > 0
        ? slotInfo.msi
        : (["LCK", "LPL", "LEC", "LCS"].includes(region) ? 2 : 1);
    return {
      to,
      label: `${to} vaga(s) da ${region} (Coeficiente de Momento)`,
      tagBadge: `MSI: ${to} VAGA(S) (MOMENTO)`,
      isDynamic: true,
    };
  }

  // 3. Worlds: Vagas dinâmicas de Worlds do coeficiente de momento
  if (target.includes("world") || target.includes("mundial")) {
    const to =
      slotInfo?.worlds && slotInfo.worlds > 0
        ? slotInfo.worlds
        : (["LCK", "LPL"].includes(region) ? 4 : ["LEC", "LCS"].includes(region) ? 3 : 2);
    return {
      to,
      label: `${to} vaga(s) da ${region} (Coeficiente de Momento)`,
      tagBadge: `MUNDIAL: ${to} VAGA(S) (MOMENTO)`,
      isDynamic: true,
    };
  }

  // 4. Rift Rivals: Top 2 da região (Finalistas)
  if (target.includes("rift rivals") || target.includes("rift-rivals")) {
    return {
      to: 2,
      label: `2 vagas (Campeão e Vice da ${region})`,
      tagBadge: `RIFT RIVALS: 2 VAGAS (FINALISTAS)`,
      isDynamic: false,
    };
  }

  // 5. Global Masters: 1 vaga (Campeão), ou 2 para as top 2 regiões do ranking mundial
  if (target.includes("global master") || target.includes("iem")) {
    const to = isTop2 ? 2 : 1;
    return {
      to,
      label: `${to} vaga(s) (${to === 2 ? "Campeão e Vice — Região Elite Mundial" : "Campeão / 1º lugar"} da ${region})`,
      tagBadge: `GLOBAL MASTERS: ${to} VAGA(S)`,
      isDynamic: isTop2,
    };
  }

  // 6. Supercopa: 1 vaga (Campeão), ou 2 para as top 2 regiões
  if (target.includes("supercopa") || target.includes("supercup") || target.includes("super cup")) {
    const to = isTop2 ? 2 : 1;
    return {
      to,
      label: `${to} vaga(s) (${to === 2 ? "Campeão e Vice — Região Elite Mundial" : "Campeão / 1º lugar"} da ${region})`,
      tagBadge: `SUPERCOPA: ${to} VAGA(S)`,
      isDynamic: isTop2,
    };
  }

  // 7. Copa dos Desafiantes: 4 vagas para Regiões Major (Top 2 do Momento) e 2 para as demais
  if (target.includes("desafiante") || target.includes("underdog")) {
    const isMajor = isTop2;
    const to = isMajor ? 4 : 2;
    return {
      to,
      label: `${to} vagas (${isMajor ? "Região Major — Top 2 Mundial" : "Convidada / Desafiante"} — Top ${to} da ${region})`,
      tagBadge: `COPA DESAFIANTES: ${to} VAGAS (TOP ${to})`,
      isDynamic: true,
    };
  }

  // Default para ligas comuns ou outros campeonatos
  return {
    to: 4,
    label: `Top 4 da ${region}`,
    tagBadge: `TOP 4 (${region})`,
    isDynamic: false,
  };
}

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Puxa times de outro campeonato já existente — por FAIXA de colocação
 * ("do 1º ao 4º", "do 4º ao 7º"...) com prévia do ranking. Serve pra montar
 * Mundial/MSI com os melhores de cada liga sem apagar nada.
 * Agora detecta a liga do campeonato de origem e mostra quantas vagas ela tem
 * no ranking (Worlds/MSI) com botões rápidos para a faixa correta.
 */
export function ImportLeagueTeams({
  game,
  onImport,
  currentTeamNames = [],
  currentChampName,
}: {
  game: string;
  onImport: (teams: Team[]) => void;
  /** Nomes já presentes no campeonato (pra marcar duplicados na prévia). */
  currentTeamNames?: string[];
  /** Nome do campeonato sendo criado (para sugerir exatamente os classificados). */
  currentChampName?: string;
}) {
  const { championships, career } = useStore();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [sourceDivision, setSourceDivision] = useState<1 | 2>(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(4);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const eligible = championships.filter((c) => (c.game ?? "lol") === game);
  const source = eligible.find((c) => c.id === sourceId);

  const sourcePhases =
    source && sourceDivision === 2 ? (source.serieB?.phases ?? []) : (source?.phases ?? []);
  // Elenco atual + arquivados: quem saiu do elenco mantém a colocação
  // histórica no ranking de importação.
  const sourceTeams = useMemo(
    () =>
      source && sourceDivision === 2
        ? [...(source.serieB?.teams ?? []), ...(source.formerTeams ?? [])]
        : [...(source?.teams ?? []), ...(source?.formerTeams ?? [])],
    [source, sourceDivision],
  );

  const ranking = useMemo(
    () => seriesRanking(sourcePhases, sourceTeams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceId, sourceDivision],
  );

  const presentNames = useMemo(
    () => new Set(currentTeamNames.map((n) => normalize(n))),
    [currentTeamNames],
  );
  const isPresent = (t: Team) => presentNames.has(normalize(t.name));

  /** Marca a faixa atual (ignorando duplicados) na lista de seleção. */
  const applyRange = (f: number, t: number) => {
    const max = Math.max(1, ranking.length);
    const nf = Math.max(1, Math.min(max, f));
    const nt = Math.max(nf, Math.min(max, t));
    setFrom(nf);
    setTo(nt);
    setPicked(
      Object.fromEntries(
        ranking.map((team, i) => [team.id, i + 1 >= nf && i + 1 <= nt && !isPresent(team)]),
      ),
    );
  };

  const allActiveRegions = useMemo(() => ["LCK", "LPL", "LEC", "LCS", "CBLOL", "LCP"], []);

  const officialRanking = useMemo(() => {
    return getOfficialRegionRanking(career, game as "lol" | "cs2");
  }, [career, game]);

  const slotTable = useMemo(() => {
    return computeRegionSlots(career, game as "lol" | "cs2", allActiveRegions);
  }, [career, game, allActiveRegions]);

  // Detect source championship's region
  const sourceRegion = useMemo(() => {
    if (!source) return "";
    return getChampionshipRegionNorm(source);
  }, [source]);

  const sourceRank = useMemo(() => {
    if (!sourceRegion) return undefined;
    return officialRanking.find((r) => r.region === sourceRegion);
  }, [officialRanking, sourceRegion]);

  const isTop2Region = useMemo(() => {
    return sourceRank?.isTop2 ?? false;
  }, [sourceRank]);

  const targetInfo = useMemo(() => {
    return getTargetCountFor(currentChampName, sourceRegion || "Região", isTop2Region, slotTable.get(sourceRegion));
  }, [currentChampName, sourceRegion, isTop2Region, slotTable]);

  const changeSource = (id: string) => {
    setSourceId(id);
    const s = eligible.find((c) => c.id === id);
    setSourceDivision(1);
    if (s) {
      const reg = getChampionshipRegionNorm(s);
      const rankEntry = officialRanking.find((r) => r.region === reg);
      const top2 = rankEntry?.isTop2 ?? false;
      const info = getTargetCountFor(currentChampName, reg, top2, slotTable.get(reg));
      setFrom(1);
      setTo(info.to);
      const r = seriesRanking(s.phases, s.teams);
      setPicked(Object.fromEntries(r.map((team, i) => [team.id, i < info.to && !isPresent(team)])));
    } else {
      setFrom(1);
      setTo(4);
      setPicked({});
    }
  };

  const changeDivision = (d: 1 | 2) => {
    setSourceDivision(d);
    setFrom(1);
    setTo(targetInfo.to);
    if (source) {
      const phases = d === 2 ? (source.serieB?.phases ?? []) : source.phases;
      const teams = d === 2 ? (source.serieB?.teams ?? []) : source.teams;
      const r = seriesRanking(phases, teams);
      setPicked(Object.fromEntries(r.map((team, i) => [team.id, i < targetInfo.to && !isPresent(team)])));
    }
  };

  const openModal = () => {
    setOpen(true);
    const targetId = sourceId || (eligible.length > 0 ? eligible[0].id : "");
    if (targetId) changeSource(targetId);
  };

  const pickedCount = ranking.filter((t) => picked[t.id]).length;

  const confirm = () => {
    const selected = ranking.filter((t) => picked[t.id]).map((t) => ({ ...t, id: uid() }));
    if (selected.length === 0) return;
    onImport(selected);
    setOpen(false);
    setPicked({});
  };

  const positionLabel = (i: number) => {
    if (i === 0) return "Campeão";
    if (i === 1) return "Vice";
    if (i === 2 || i === 3) return "Semifinal";
    return `${i + 1}º`;
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex w-full items-center justify-center gap-2 border-2 border-gold/60 bg-gold/10 px-4 py-3 font-display text-sm uppercase tracking-widest text-gold hover:bg-gold/20"
        title="Puxa times de um campeonato existente por faixa de colocação (ex: top 4 de uma liga)"
      >
        <Download className="h-5 w-5" /> Puxar times de outro campeonato (faixa de colocação)
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10">
          <div className="w-full max-w-2xl border-2 border-gold bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wider text-gold">
                <Trophy className="h-6 w-6" /> Puxar times de campeonato
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
              Escolha o campeonato de origem e a faixa de colocação — por exemplo, do{" "}
              <span className="text-gold">1º ao 4º</span> (top 4) ou do{" "}
              <span className="text-gold">4º ao 7º</span>. Os nomes já presentes no seu campeonato
              aparecem marcados e não entram duplicados.
            </p>

            {eligible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum campeonato deste jogo para puxar times — crie uma liga primeiro.
              </p>
            ) : (
              <>
                {/* League info card */}
                {source && (
                  <div className="mb-3 p-3 border-2 border-gold/40 bg-gold/5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-gold" />
                        <span className="font-display text-sm uppercase tracking-widest text-gold font-bold">
                          Liga: {source.name} {sourceRegion ? `(${sourceRegion})` : ""}
                        </span>
                      </div>
                      <span className="border border-gold/50 bg-gold/15 px-2.5 py-0.5 font-bold uppercase tracking-wider text-gold font-display text-xs">
                        {targetInfo.tagBadge}
                      </span>
                    </div>

                    <div className="rounded bg-black/50 border border-gold/30 p-2.5 text-xs">
                      <span className="font-display uppercase tracking-wider text-gold font-bold block mb-0.5">
                        🎯 Vagas de Classificação para {currentChampName || "este campeonato"}:
                      </span>
                      <span className="text-bone font-medium text-sm block">
                        {targetInfo.label}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <label className="flex flex-1 items-center gap-2 border-2 border-border bg-input px-2 py-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Origem
                    </span>
                    <select
                      value={sourceId}
                      onChange={(e) => changeSource(e.target.value)}
                      className="w-full bg-transparent font-display text-sm uppercase tracking-wider text-bone outline-none"
                    >
                      {eligible.map((c) => (
                        <option key={c.id} value={c.id} className="bg-ink text-bone">
                          {c.name} {c.season ? `· ${c.season}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {source?.hasSecondDivision ? (
                    <div className="flex overflow-hidden border-2 border-border">
                      <button
                        type="button"
                        onClick={() => changeDivision(1)}
                        className={`px-3 py-2 font-display text-xs uppercase tracking-widest ${
                          sourceDivision === 1
                            ? "bg-gold text-ink"
                            : "bg-input text-muted-foreground"
                        }`}
                      >
                        Série A
                      </button>
                      <button
                        type="button"
                        onClick={() => changeDivision(2)}
                        className={`px-3 py-2 font-display text-xs uppercase tracking-widest ${
                          sourceDivision === 2
                            ? "bg-blood text-white"
                            : "bg-input text-muted-foreground"
                        }`}
                      >
                        Série B
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Faixa de colocação */}
                <div className="mb-3 flex flex-wrap items-end gap-2 border-2 border-gold/40 bg-black/30 p-3">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-gold">Do</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, ranking.length)}
                      value={from}
                      onChange={(e) => applyRange(Number(e.target.value) || 1, to)}
                      className="w-16 border-2 border-border bg-input px-2 py-1 text-center font-display text-lg text-bone outline-none focus:border-gold"
                    />
                    <span className="text-[10px] uppercase tracking-widest text-gold">º ao</span>
                    <input
                      type="number"
                      min={from}
                      max={Math.max(1, ranking.length)}
                      value={to}
                      onChange={(e) => applyRange(from, Number(e.target.value) || from)}
                      className="w-16 border-2 border-border bg-input px-2 py-1 text-center font-display text-lg text-bone outline-none focus:border-gold"
                    />
                    <span className="text-[10px] uppercase tracking-widest text-gold">º lugar</span>
                  </label>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {ranking.length} times ranqueados
                  </span>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {/* Botão principal de Classificados baseado no campeonato de destino */}
                    <button
                      type="button"
                      onClick={() => applyRange(1, targetInfo.to)}
                      className="border-2 border-yellow-400 bg-yellow-400/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-yellow-300 hover:bg-yellow-400 hover:text-ink transition-all shadow-sm"
                      title={`Puxar exatamente os classificados recomendados (${targetInfo.label})`}
                    >
                      Classificados ({targetInfo.to})
                    </button>
                    {targetInfo.to !== 1 && (
                      <button
                        type="button"
                        onClick={() => applyRange(1, 1)}
                        className="border border-gold/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink transition-colors"
                        title="Puxar apenas o Campeão (1º colocado)"
                      >
                        Campeão
                      </button>
                    )}
                    {ranking.length >= 2 && targetInfo.to !== 2 && (
                      <button
                        type="button"
                        onClick={() => applyRange(1, 2)}
                        className="border border-gold/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink transition-colors"
                        title="Puxar Campeão e Vice (Top 2)"
                      >
                        Finalistas
                      </button>
                    )}
                    {ranking.length >= 4 && targetInfo.to !== 4 && (
                      <button
                        type="button"
                        onClick={() => applyRange(1, 4)}
                        className="border border-border/60 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-gold hover:text-gold transition-colors"
                        title="Puxar Top 4"
                      >
                        Top 4
                      </button>
                    )}
                  </div>
                </div>

                {/* Prévia do ranking */}
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                  {ranking.map((t, i) => {
                    const present = isPresent(t);
                    const checked = !!picked[t.id];
                    return (
                      <label
                        key={t.id}
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
                            setPicked((prev) => ({
                              ...prev,
                              [t.id]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[var(--gold)]"
                        />
                        <span className="w-8 shrink-0 text-center font-display text-lg text-gold">
                          {i + 1}
                        </span>
                        <TeamLogo team={t} size={26} />
                        <div className="min-w-0 flex-1">
                          <span className="font-display text-base uppercase tracking-wider text-bone">
                            {t.name} {t.tag ? <span className="text-gold">[{t.tag}]</span> : null}
                          </span>
                          <span className="ml-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                            {positionLabel(i)}
                          </span>
                        </div>
                        {present ? (
                          <span className="shrink-0 border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            já está aqui
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                  {ranking.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      Este campeonato ainda não tem times suficientes.
                    </p>
                  ) : null}
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
