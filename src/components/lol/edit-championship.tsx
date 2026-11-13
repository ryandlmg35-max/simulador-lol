import { useMemo, useState } from "react";
import { Plus, RefreshCw, Swords, Trash2, Users, X } from "lucide-react";
import type {
  BestOf,
  Championship,
  Group,
  GroupsConfig,
  InternationalLevel,
  Match,
  Phase,
  PhaseConfig,
  PhaseKind,
  PlayoffsConfig,
  SwissConfig,
  Team,
} from "@/lib/lol/types";
import { useStore, type Division } from "@/lib/lol/store";
import { buildPhaseMatches, emptyCustomSpec, shuffle, uid } from "@/lib/lol/generate";
import { isPlayInPhase, planInternationalField } from "@/lib/lol/international";
import { fileToLogo } from "@/lib/lol/image";
import { LOCAL_REGIONS } from "@/lib/lol/local-teams";
import { getOfficialLogo } from "@/lib/lol/official-logos";
import { TeamLogo } from "./team-logo";
import { AiTeamImport } from "./ai-team-import";
import { AutoFillSerieB } from "./serie-b-autofill";
import { ImportLeagueTeams } from "./import-league-teams";
import { ImportFromRanking } from "./import-from-ranking";
import { PlayoffBuilder, PlayoffModeToggle } from "./playoff-builder";
import { RosterEditor } from "./roster-editor";
import { ChampionshipLogoPicker } from "./championship-logo-picker";
import { ConfirmDialog } from "./confirm-dialog";
import { useConfirm } from "./use-confirm";
import { rosterStrength } from "@/lib/lol/players";

const inputCls =
  "w-full border border-border bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

const defaultConfigFor = (kind: PhaseKind): PhaseConfig => {
  if (kind === "groups")
    return {
      kind: "groups",
      groupCount: 1,
      doubleRoundRobin: false,
      bestOf: 1,
      qualifiersPerGroup: 2,
    };
  if (kind === "swiss")
    return {
      kind: "swiss",
      winsToAdvance: 3,
      lossesToEliminate: 3,
      defaultBestOf: 3,
    };
  return {
    kind: "bracket",
    slots: 4,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
    mode: "custom",
    custom: emptyCustomSpec(),
  };
};

const BO_OPTIONS: BestOf[] = [1, 3, 5];

function BoRow({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: BestOf;
  onChange: (v: BestOf) => void;
  accent: "gold" | "blood";
}) {
  const on =
    accent === "gold" ? "border-gold bg-gold text-ink" : "border-blood bg-blood text-white";
  const hover = accent === "gold" ? "hover:border-gold/60" : "hover:border-blood/60";
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex gap-1">
        {BO_OPTIONS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onChange(b)}
            className={`flex-1 border px-2 py-1 text-xs font-bold uppercase tracking-widest ${
              value === b ? on : `border-border bg-black/40 text-muted-foreground ${hover}`
            }`}
          >
            Bo{b}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Em qual série está a fase com este id. */
function phaseDivision(c: Championship, phaseId: string): Division {
  return c.serieB?.phases.some((p) => p.id === phaseId) ? 2 : 1;
}

/** Em qual série está o time com este id. */
function teamDivision(c: Championship, teamId: string): Division {
  return c.serieB?.teams.some((t) => t.id === teamId) ? 2 : 1;
}

function SectionDivider({
  title,
  accent,
  count,
}: {
  title: string;
  accent: "gold" | "blood";
  count?: number;
}) {
  const color = accent === "gold" ? "text-gold" : "text-blood";
  const line = accent === "gold" ? "bg-gold/20" : "bg-blood/20";
  return (
    <div className="mb-2 mt-4 flex items-center gap-2">
      <span className={`font-display text-xs uppercase tracking-widest ${color}`}>{title}</span>
      {count !== undefined ? (
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          ({count})
        </span>
      ) : null}
      <div className={`h-px flex-1 ${line}`} />
    </div>
  );
}

export function EditChampionshipDialog({
  championship,
  onClose,
}: {
  championship: Championship;
  onClose: () => void;
}) {
  const {
    championships,
    updateChampionship,
    updateTeam,
    addTeamsToDivision,
    setupSerieB,
    clearSerieB,
    seedPhaseTeams,
    career,
  } = useStore();
  const { confirm, confirmDialog } = useConfirm();
  const [name, setName] = useState(championship.name);
  const [region, setRegion] = useState(championship.region ?? "");
  const [season, setSeason] = useState(championship.season ?? "");
  const [accent, setAccent] = useState(championship.accentColor ?? "#c8aa6e");
  const [logo, setLogo] = useState(championship.logo);
  const [countsTowardsRanking, setCountsTowardsRanking] = useState(
    championship.countsTowardsRanking ?? true,
  );
  const [hasSecondDivision, setHasSecondDivision] = useState(
    championship.hasSecondDivision ?? false,
  );
  const initialInternationalLevel: InternationalLevel =
    championship.internationalLevel ?? (championship.isInternational ? "major" : "none");
  const [internationalLevel, setInternationalLevel] =
    useState<InternationalLevel>(initialInternationalLevel);
  const [isInternational, setIsInternational] = useState(initialInternationalLevel !== "none");

  const teamsA = championship.teams;
  const teamsB = useMemo(() => championship.serieB?.teams ?? [], [championship.serieB?.teams]);
  const phasesA = championship.phases;
  const phasesB = useMemo(() => championship.serieB?.phases ?? [], [championship.serieB?.phases]);

  // Plano internacional (Worlds/MSI): o tamanho do evento NÃO é fixo — sai da
  // soma das vagas que cada região tem no Hall da Fama.
  const intlPlanA = useMemo(
    () =>
      planInternationalField({
        teams: teamsA,
        phases: phasesA,
        game: championship.game ?? "lol",
        career,
        fallbackRegion: region,
        championshipName: name,
      }),
    [teamsA, phasesA, championship.game, career, region, name],
  );
  const intlPlanB = useMemo(
    () =>
      planInternationalField({
        teams: teamsB,
        phases: phasesB,
        game: championship.game ?? "lol",
        career,
        fallbackRegion: region,
        championshipName: name,
      }),
    [teamsB, phasesB, championship.game, career, region, name],
  );

  // Editor de elenco aberto (nome + nota dos jogadores).
  const [rosterTeamId, setRosterTeamId] = useState<string | null>(null);
  const rosterTeam = rosterTeamId
    ? [...teamsA, ...teamsB].find((t) => t.id === rosterTeamId)
    : undefined;

  // ---------- RESTAURAÇÃO DE TIMES "FANTASMA" ----------
  // Confrontos antigos podem referenciar times removidos antes do
  // arquivamento existir. Detectamos esses ids órfãos e deixamos o usuário
  // religar cada um ao time certo — devolvendo nomes, pontos e região ao
  // ranking.
  const orphans = useMemo(() => {
    const known = new Set<string>();
    for (const t of teamsA) known.add(t.id);
    for (const t of teamsB) known.add(t.id);
    for (const t of championship.formerTeams ?? []) known.add(t.id);
    const counts = new Map<string, number>();
    const scan = (m: Match) => {
      for (const id of [m.teamAId, m.teamBId]) {
        if (id && !known.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    };
    for (const p of phasesA) p.matches.forEach(scan);
    for (const p of phasesB) p.matches.forEach(scan);
    for (const m of championship.promotion?.matches ?? []) scan(m);
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [championship]);

  const candidateNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of championships) {
      for (const t of c.teams) names.add(t.name);
      for (const t of c.formerTeams ?? []) names.add(t.name);
      for (const t of c.serieB?.teams ?? []) names.add(t.name);
    }
    for (const r of LOCAL_REGIONS) for (const t of r.teams) names.add(t.name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [championships]);

  /** Religa um id órfão ao time digitado — reescreve todos os confrontos. */
  const relinkOrphan = (deadId: string, nameInput: string) => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    updateChampionship(championship.id, (c) => {
      // Procura o time pelo nome nos outros campeonatos e no banco global.
      type TeamLike = {
        name: string;
        tag: string;
        logo?: string;
        region?: string;
        color?: string;
      };
      let base: TeamLike | undefined;
      const target = trimmed.toLowerCase();
      for (const other of championships) {
        base = [...other.teams, ...(other.formerTeams ?? []), ...(other.serieB?.teams ?? [])].find(
          (t) => t.name.trim().toLowerCase() === target,
        );
        if (base) break;
      }
      if (!base) {
        for (const r of LOCAL_REGIONS) {
          base = r.teams.find((t) => t.name.trim().toLowerCase() === target);
          if (base) break;
        }
      }
      const finalName = base?.name ?? trimmed;
      const finalTag = base?.tag ?? trimmed.slice(0, 3).toUpperCase();
      const team: Team = {
        id: uid(),
        name: finalName,
        tag: finalTag,
        logo: base?.logo || getOfficialLogo(finalName, finalTag),
        region: base?.region,
        color: base?.color,
      };
      const remapId = (id: string | null) => (id === deadId ? team.id : id);
      const remapMatch = (m: Match): Match => ({
        ...m,
        teamAId: remapId(m.teamAId),
        teamBId: remapId(m.teamBId),
        winnerId: remapId(m.winnerId),
        formEffect: m.formEffect
          ? {
              ...m.formEffect,
              winnerId: remapId(m.formEffect.winnerId) ?? m.formEffect.winnerId,
            }
          : m.formEffect,
      });
      const remapPhases = (phases: Phase[]): Phase[] =>
        phases.map((p) => ({
          ...p,
          matches: p.matches.map(remapMatch),
          groups: p.groups?.map((g) => ({
            ...g,
            teamIds: g.teamIds.map((id) => (id === deadId ? team.id : id)),
          })),
        }));
      const momentum = c.momentum
        ? Object.fromEntries(
            Object.entries(c.momentum).map(([k, v]) => [k === deadId ? team.id : k, v]),
          )
        : c.momentum;
      const momentumLog = c.momentumLog?.map((e) =>
        e.teamId === deadId ? { ...e, teamId: team.id } : e,
      );
      return {
        ...c,
        phases: remapPhases(c.phases),
        serieB: c.serieB ? { ...c.serieB, phases: remapPhases(c.serieB.phases) } : c.serieB,
        promotion: c.promotion
          ? { ...c.promotion, matches: c.promotion.matches.map(remapMatch) }
          : c.promotion,
        formerTeams: [...(c.formerTeams ?? []).filter((t) => t.id !== team.id), team],
        momentum,
        momentumLog,
      };
    });
  };

  const save = () => {
    updateChampionship(championship.id, (c) => ({
      ...c,
      name: name.trim() || c.name,
      region: region.trim() || undefined,
      season: season.trim() || undefined,
      accentColor: accent,
      logo,
      countsTowardsRanking,
      internationalLevel,
      hasSecondDivision,
      // Ao ativar a Série B garantimos o bloco separado; ao desativar, os
      // dados dela são preservados (basta reativar para voltar).
      serieB: hasSecondDivision ? (c.serieB ?? { teams: [], phases: [], history: [] }) : c.serieB,
    }));
    onClose();
  };

  // ---------- TIMES (por série, sem mistura) ----------
  const patchTeam = (team: Team, patch: Partial<Team>) => {
    const nextName = patch.name ?? team.name;
    const nextTag = patch.tag ?? team.tag;
    const autoLogo = !team.logo && !patch.logo ? getOfficialLogo(nextName, nextTag) : undefined;
    updateTeam(championship.id, { ...team, ...patch, ...(autoLogo ? { logo: autoLogo } : {}) });
  };

  const addTeam = (division: Division) => {
    const team: Team = { id: uid(), name: "", tag: "" };
    updateChampionship(championship.id, (c) => {
      if (division === 2) {
        const serieB = c.serieB ?? { teams: [], phases: [], history: [] };
        return { ...c, serieB: { ...serieB, teams: [...serieB.teams, team] } };
      }
      return { ...c, teams: [...c.teams, team] };
    });
  };

  const removeTeam = (teamId: string) => {
    updateChampionship(championship.id, (c) => {
      if (teamDivision(c, teamId) === 2) {
        if (!c.serieB) return c;
        return {
          ...c,
          serieB: { ...c.serieB, teams: c.serieB.teams.filter((t) => t.id !== teamId) },
        };
      }
      return { ...c, teams: c.teams.filter((t) => t.id !== teamId) };
    });
  };

  /** Troca um time de série preservando a identidade e o elenco. */
  const moveTeam = (teamId: string, target: Division) => {
    updateChampionship(championship.id, (c) => {
      const fromA = c.teams.find((t) => t.id === teamId);
      const fromB = c.serieB?.teams.find((t) => t.id === teamId);
      const team = fromA ?? fromB;
      if (!team) return c;
      if (target === 2) {
        const serieB = c.serieB ?? { teams: [], phases: [], history: [] };
        return {
          ...c,
          teams: c.teams.filter((t) => t.id !== teamId),
          serieB: { ...serieB, teams: [...serieB.teams.filter((t) => t.id !== teamId), team] },
        };
      }
      if (!c.serieB) return c;
      return {
        ...c,
        teams: [...c.teams.filter((t) => t.id !== teamId), team],
        serieB: { ...c.serieB, teams: c.serieB.teams.filter((t) => t.id !== teamId) },
      };
    });
  };

  const addImportedTeams = (division: Division, imported: Team[]) => {
    const prepared = imported.map((t) => ({
      ...t,
      logo: t.logo || getOfficialLogo(t.name, t.tag),
    }));
    addTeamsToDivision(championship.id, prepared, division);
  };

  // ---------- FASES (por série, sem mistura) ----------
  const patchPhase = (phaseId: string, patch: Partial<Phase>) => {
    updateChampionship(championship.id, (c) => {
      const division = phaseDivision(c, phaseId);
      const map = (phases: Phase[]) =>
        phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p));
      if (division === 2) {
        const serieB = c.serieB ?? { teams: [], phases: [], history: [] };
        return { ...c, serieB: { ...serieB, phases: map(serieB.phases) } };
      }
      return { ...c, phases: map(c.phases) };
    });
  };

  const changePhaseKind = (phaseId: string, kind: PhaseKind) => {
    patchPhase(phaseId, {
      kind,
      config: defaultConfigFor(kind),
      groups: undefined,
      matches: [],
    });
  };

  const patchPhaseConfig = (phaseId: string, patch: Partial<PhaseConfig>) => {
    updateChampionship(championship.id, (c) => {
      const division = phaseDivision(c, phaseId);
      const map = (phases: Phase[]) =>
        phases.map((p) =>
          p.id === phaseId ? { ...p, config: { ...p.config, ...patch } as PhaseConfig } : p,
        );
      if (division === 2) {
        const serieB = c.serieB ?? { teams: [], phases: [], history: [] };
        return { ...c, serieB: { ...serieB, phases: map(serieB.phases) } };
      }
      return { ...c, phases: map(c.phases) };
    });
  };

  const rebuildPhase = (phaseId: string) => {
    // Play-in internacional: recalcula vagas pelo ranking e semeia play-in +
    // fase principal (não joga todo mundo no play-in). Fora do updater pra
    // não aninhar setState.
    const currentDivision = phaseDivision(championship, phaseId);
    const currentPool =
      currentDivision === 2 ? (championship.serieB?.phases ?? []) : championship.phases;
    const currentIdx = currentPool.findIndex((p) => p.id === phaseId);
    const currentPhase = currentPool[currentIdx];
    if (currentIdx === 0 && currentPhase && isPlayInPhase(currentPhase)) {
      seedPhaseTeams(championship.id, phaseId);
      return;
    }

    updateChampionship(championship.id, (c) => {
      const division = phaseDivision(c, phaseId);
      const pool = division === 2 ? (c.serieB?.phases ?? []) : c.phases;
      const poolTeams = division === 2 ? (c.serieB?.teams ?? []) : c.teams;
      const idx = pool.findIndex((p) => p.id === phaseId);
      if (idx < 0) return c;
      const phase = pool[idx];

      // A primeira fase da série é semeada com os times da PRÓPRIA série.
      const isFirst = idx === 0;
      const teamIds = isFirst ? poolTeams.map((t) => t.id) : [];

      let groups: Group[] = [];
      if (phase.config.kind === "groups") {
        const gc = phase.config;
        let groupCount = gc.groupCount;
        // GSL precisa de EXATAMENTE 4 times por grupo — auto-ajusta.
        if (gc.format === "gsl" && isFirst && teamIds.length > 0) {
          const needed = Math.ceil(teamIds.length / 4);
          if (groupCount < needed) groupCount = needed;
        }
        groups = Array.from({ length: groupCount }, (_, gi) => ({
          id: uid(),
          name: groupCount === 1 ? "Grupo Único" : `Grupo ${String.fromCharCode(65 + gi)}`,
          teamIds: [] as string[],
        }));
        if (isFirst) {
          if (gc.format === "gsl") {
            // GSL: SORTEIA a distribuição ao reconstruir a fase
            const shuffled = shuffle(teamIds);
            shuffled.forEach((tid, i) => {
              const g = Math.floor(i / 4);
              if (g < groupCount) groups[g]?.teamIds.push(tid);
            });
          } else {
            // Round-robin: distribui igualmente
            teamIds.forEach((tid, i) => {
              groups[i % groupCount]?.teamIds.push(tid);
            });
          }
        }
      }
      const matches = buildPhaseMatches(phase.config, teamIds, groups);
      const rebuilt: Phase = {
        ...phase,
        groups: phase.config.kind === "groups" ? groups : undefined,
        matches,
      };
      const replace = (phases: Phase[]) => phases.map((p) => (p.id === phaseId ? rebuilt : p));
      if (division === 2) {
        const serieB = c.serieB ?? { teams: [], phases: [], history: [] };
        return { ...c, serieB: { ...serieB, phases: replace(serieB.phases) } };
      }
      return { ...c, phases: replace(c.phases) };
    });
  };

  const addPhase = (division: Division) => {
    const newPhase: Phase = {
      id: uid(),
      name: division === 2 ? "Fase Série B" : "Nova Fase",
      kind: "bracket",
      config: {
        kind: "bracket",
        slots: division === 2 ? 4 : 8,
        type: "single",
        defaultBestOf: 3,
        finalBestOf: 5,
        bracketReset: false,
        mode: "auto",
      },
      matches: [],
    };
    updateChampionship(championship.id, (c) => {
      if (division === 2) {
        const serieB = c.serieB ?? { teams: [], phases: [], history: [] };
        return { ...c, serieB: { ...serieB, phases: [...serieB.phases, newPhase] } };
      }
      return { ...c, phases: [...c.phases, newPhase] };
    });
  };

  const removePhase = (phaseId: string) => {
    updateChampionship(championship.id, (c) => {
      const division = phaseDivision(c, phaseId);
      if (division === 2) {
        if (!c.serieB) return c;
        return {
          ...c,
          serieB: { ...c.serieB, phases: c.serieB.phases.filter((p) => p.id !== phaseId) },
        };
      }
      return { ...c, phases: c.phases.filter((p) => p.id !== phaseId) };
    });
  };

  const teamRow = (t: Team, division: Division) => {
    const teamStrength = rosterStrength(t.roster);
    return (
      <div
        key={t.id}
        className="flex flex-wrap items-center gap-2 border border-border bg-black/30 p-2"
      >
        <TeamLogo team={t} size={28} />
        <input
          className={`${inputCls} min-w-[120px] flex-1`}
          placeholder="Nome"
          value={t.name}
          onChange={(e) => patchTeam(t, { name: e.target.value })}
        />
        <input
          className={`${inputCls} w-20 uppercase`}
          placeholder="Sigla"
          value={t.tag}
          maxLength={5}
          onChange={(e) => patchTeam(t, { tag: e.target.value.toUpperCase() })}
        />
        <input
          className={`${inputCls} w-24 uppercase`}
          placeholder="Região"
          value={t.region || ""}
          maxLength={10}
          onChange={(e) => patchTeam(t, { region: e.target.value.toUpperCase() })}
        />
        <label className="shrink-0 cursor-pointer border border-gold/50 px-2 py-1 text-[10px] uppercase tracking-wider text-gold hover:bg-gold hover:text-ink">
          Logo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) patchTeam(t, { logo: await fileToLogo(f) });
            }}
          />
        </label>
        {hasSecondDivision ? (
          <button
            type="button"
            onClick={async () => {
              const target = division === 1 ? "Série B" : "Série A";
              const ok = await confirm({
                title: `Mover "${t.name || "sem nome"}" para a ${target}?`,
                message:
                  "Se ele já tiver partidas registradas na série de origem, " +
                  "esses confrontos vão precisar ser refeitos (botão 'Aplicar' na fase).",
                confirmLabel: "Mover time",
                tone: "gold",
              });
              if (ok) moveTeam(t.id, division === 1 ? 2 : 1);
            }}
            className={`shrink-0 whitespace-nowrap border px-1.5 py-1 text-[9px] font-bold uppercase tracking-widest ${
              division === 1
                ? "border-blood/50 text-blood hover:bg-blood hover:text-white"
                : "border-gold/50 text-gold hover:bg-gold hover:text-ink"
            }`}
            title={
              division === 1 ? "Mover este time para a Série B" : "Mover este time para a Série A"
            }
          >
            {division === 1 ? "→ Série B" : "→ Série A"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setRosterTeamId(t.id)}
          className="flex shrink-0 items-center gap-1 border border-gold/50 px-2 py-1 text-[10px] uppercase tracking-wider text-gold hover:bg-gold hover:text-ink"
          title="Editar elenco: jogadores, nota de cada um e idade"
        >
          <Users className="h-3 w-3" />
          <Swords className="h-3 w-3" />
          {teamStrength != null ? Math.round(teamStrength) : "elenco"}
        </button>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: `Remover o time "${t.name || "sem nome"}"?`,
              message: "O time sai do campeonato e dos confrontos registrados.",
              confirmLabel: "Remover",
            });
            if (ok) removeTeam(t.id);
          }}
          className="text-blood hover:opacity-80"
          aria-label="Remover time"
          title="Remover time"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const phaseCard = (p: Phase, division: Division, index: number, total: number) => {
    const plan = division === 1 ? intlPlanA : intlPlanB;
    // Em evento internacional o nº de vagas é AUTOMÁTICO (Hall da Fama por
    // região) — nada de número fixo para o usuário editar.
    const autoSlotsNote =
      plan.active && index === plan.mainPhaseIndex
        ? `${plan.mainTargetSlots} vagas (soma das vagas do Hall da Fama por região)`
        : plan.active && index === plan.playInPhaseIndex
          ? "Formato automático: grupo/classificação conforme as vagas do Hall da Fama"
          : undefined;
    return (
      <PhaseCard
        key={p.id}
        phase={p}
        accent={division === 1 ? "gold" : "blood"}
        accentLabel={division === 1 ? "Série A" : "Série B"}
        index={index}
        isFirst={index === 0}
        hasTeams={(division === 1 ? teamsA : teamsB).length >= 2}
        autoSlotsNote={autoSlotsNote}
        onName={(name) => patchPhase(p.id, { name })}
        onKind={(kind) => changePhaseKind(p.id, kind)}
        onConfig={(patch) => patchPhaseConfig(p.id, patch)}
        onRebuild={async () => {
          const scope =
            index === 0 && isPlayInPhase(p)
              ? "Esta fase e todas as seguintes serão refeitas."
              : "Os resultados desta fase serão apagados.";
          const ok = await confirm({
            title: `Recriar a fase "${p.name}"?`,
            message: scope,
            confirmLabel: "Recriar fase",
            tone: "gold",
          });
          if (ok) rebuildPhase(p.id);
        }}
        onRemove={async () => {
          const ok = await confirm({
            title: `Remover a fase "${p.name}"?`,
            message: "A fase e os confrontos dela serão apagados.",
            confirmLabel: "Remover fase",
          });
          if (ok) removePhase(p.id);
        }}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <ConfirmDialog {...confirmDialog} />
      <div
        className="w-full max-w-2xl border-2 border-gold bg-ink p-6 shadow-[6px_6px_0_0_var(--gold)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-widest text-gold">
            Editar campeonato
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Nome</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Região</span>
            <input
              className={inputCls}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Temporada
            </span>
            <input
              className={inputCls}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Cor de destaque
            </span>
            <input
              type="color"
              className="h-10 w-full cursor-pointer border border-border bg-black/40"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <ChampionshipLogoPicker
              value={logo}
              onChange={setLogo}
              onSelectPreset={(preset) => {
                if (!region) setRegion(preset.defaultRegion);
                setAccent(preset.accentColor);
              }}
              game={championship.game}
            />
          </div>
          <label className="space-y-1 sm:col-span-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={countsTowardsRanking}
                  onChange={(e) => setCountsTowardsRanking(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                <span className="text-xs uppercase tracking-widest text-bone">
                  Contar este campeonato para o Pódio e Ranking
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isInternational}
                  onChange={(e) => {
                    setIsInternational(e.target.checked);
                    setInternationalLevel(e.target.checked ? "major" : "none");
                  }}
                  className="h-4 w-4 accent-gold"
                />
                <div>
                  <span className="text-xs uppercase tracking-widest text-bone">
                    🌎 Campeonato Internacional
                  </span>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    O desempenho aqui alimenta a força regional usada na classificação automática de
                    Worlds/MSI.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border border-gold/40 bg-gold/5 p-3">
                <input
                  type="checkbox"
                  checked={hasSecondDivision}
                  onChange={(e) => setHasSecondDivision(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-gold">
                    Habilitar 2ª Divisão (Série B)
                  </span>
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Times, fases e histórico totalmente separados da Série A.
                  </div>
                </div>
              </div>
              {hasSecondDivision &&
              ((championship.serieB?.teams.length ?? 0) > 0 ||
                (championship.serieB?.phases.length ?? 0) > 0 ||
                (championship.serieB?.history?.length ?? 0) > 0) ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Apagar TODA a Série B?",
                      message:
                        `${championship.serieB?.teams.length ?? 0} time(s), ` +
                        `${championship.serieB?.phases.length ?? 0} fase(s) com resultados e o histórico dela serão removidos.\n\n` +
                        'A Série A NÃO é afetada. Depois basta clicar em "Montar Série B automática" para fazer de novo.',
                      confirmLabel: "Apagar Série B",
                    });
                    if (ok) clearSerieB(championship.id);
                  }}
                  className="flex items-center gap-1.5 border border-blood/60 bg-blood/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-blood hover:bg-blood hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir Série B inteira (fazer de novo do zero)
                </button>
              ) : null}
            </div>
          </label>
        </div>

        {/* ---------- RESTAURAÇÃO DE FANTASMAS ---------- */}
        {orphans.size > 0 ? (
          <div className="mt-6 border-2 border-gold/50 bg-gold/5 p-3">
            <div className="mb-1 font-display text-sm uppercase tracking-widest text-gold">
              🔗 Restaurar times de confrontos antigos ({orphans.size})
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Estes times aparecem em confrontos registrados, mas foram removidos antes de o app
              arquivar identidade. Digite quem era cada um (pode buscar) e a história volta ao
              ranking — pontos, títulos e região.
            </p>
            <datalist id="relink-candidates">
              {candidateNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {Array.from(orphans.entries()).map(([deadId, count]) => (
              <OrphanRow
                key={deadId}
                count={count}
                onRestore={async (nameInput) => {
                  const ok = await confirm({
                    title: `Restaurar ${count} confronto(s) como "${nameInput.trim()}"?`,
                    message: "Os pontos, títulos e região voltam para o ranking com esse nome.",
                    confirmLabel: "Restaurar",
                    tone: "gold",
                  });
                  if (ok) relinkOrphan(deadId, nameInput);
                }}
              />
            ))}
          </div>
        ) : null}

        {/* ---------- TIMES ---------- */}
        <div className="mt-6">
          <SectionDivider title="Times — Série A" accent="gold" count={teamsA.length} />
          <div className="mb-3">
            <AiTeamImport
              game={championship.game ?? "lol"}
              onImport={(imported) => addImportedTeams(1, imported)}
            />
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {teamsA.map((t) => teamRow(t, 1))}
          </div>
          <button
            type="button"
            onClick={() => addTeam(1)}
            className="mt-2 flex w-full items-center justify-center gap-1 border border-dashed border-gold/40 py-2 text-[11px] uppercase tracking-widest text-gold/60 hover:border-gold hover:text-gold"
          >
            <Plus className="h-3 w-3" /> Adicionar time na Série A
          </button>

          {hasSecondDivision ? (
            <>
              <SectionDivider
                title="Times — Série B (independente)"
                accent="blood"
                count={teamsB.length}
              />
              <div className="mb-3">
                <AiTeamImport
                  game={championship.game ?? "lol"}
                  onImport={(imported) => addImportedTeams(2, imported)}
                />
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {teamsB.map((t) => teamRow(t, 2))}
              </div>
              <button
                type="button"
                onClick={() => addTeam(2)}
                className="mt-2 flex w-full items-center justify-center gap-1 border border-dashed border-blood/40 py-2 text-[11px] uppercase tracking-widest text-blood/60 hover:border-blood hover:text-blood"
              >
                <Plus className="h-3 w-3" /> Adicionar time na Série B
              </button>
            </>
          ) : null}
        </div>

        {/* ---------- FASES ---------- */}
        <div className="mt-6">
          <p className="mb-1 text-[11px] text-muted-foreground">
            Alterar o tipo ou os parâmetros de uma fase e clicar em{" "}
            <span className="text-gold">Aplicar</span> vai{" "}
            <span className="text-blood">resetar a fase</span> e recriar todos os confrontos dela.
          </p>

          <SectionDivider title="Fases — Série A" accent="gold" count={phasesA.length} />
          <div className="space-y-3">
            {phasesA.map((p, i) => phaseCard(p, 1, i, phasesA.length))}
            <button
              type="button"
              onClick={() => addPhase(1)}
              className="flex w-full items-center justify-center gap-1 border border-dashed border-gold/40 py-2 text-[11px] uppercase tracking-widest text-gold/60 hover:border-gold hover:text-gold"
            >
              <Plus className="h-3 w-3" /> Adicionar Fase (Série A)
            </button>
          </div>

          {hasSecondDivision ? (
            <>
              <SectionDivider
                title="Fases — Série B (independente)"
                accent="blood"
                count={phasesB.length}
              />
              <div className="space-y-3">
                {phasesB.map((p, i) => phaseCard(p, 2, i, phasesB.length))}
                <button
                  type="button"
                  onClick={() => addPhase(2)}
                  className="flex w-full items-center justify-center gap-1 border border-dashed border-blood/40 py-2 text-[11px] uppercase tracking-widest text-blood/60 hover:border-blood hover:text-blood"
                >
                  <Plus className="h-3 w-3" /> Adicionar Fase (Série B)
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            className="bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"
          >
            Salvar
          </button>
        </div>

        {/* ---------- EDITOR DE ELENCO (jogadores + notas) ---------- */}
        {rosterTeam ? (
          <RosterEditor
            team={rosterTeam}
            onPatch={(patch) => patchTeam(rosterTeam, patch)}
            onClose={() => setRosterTeamId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

function OrphanRow({ count, onRestore }: { count: number; onRestore: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 border border-border bg-black/30 p-2">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Time desconhecido · {count} confronto(s)
      </span>
      <input
        list="relink-candidates"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Quem era este time? (ex: Team Liquid)"
        className="min-w-[180px] flex-1 border border-border bg-black/40 px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
      />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => onRestore(name)}
        className="shrink-0 border border-gold/60 bg-gold/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Restaurar
      </button>
    </div>
  );
}

function PhaseCard({
  phase,
  accent,
  accentLabel,
  index,
  isFirst,
  hasTeams,
  autoSlotsNote,
  onName,
  onKind,
  onConfig,
  onRebuild,
  onRemove,
}: {
  phase: Phase;
  accent: "gold" | "blood";
  accentLabel: string;
  index: number;
  isFirst: boolean;
  hasTeams: boolean;
  /** Evento internacional: as vagas vêm do Hall da Fama (sem número fixo). */
  autoSlotsNote?: string;
  onName: (name: string) => void;
  onKind: (kind: PhaseKind) => void;
  onConfig: (patch: Partial<PhaseConfig>) => void;
  onRebuild: () => void;
  onRemove: () => void;
}) {
  const on =
    accent === "gold" ? "border-gold bg-gold text-ink" : "border-blood bg-blood text-white";
  const off = "border-border bg-black/40 text-muted-foreground";
  const hover = accent === "gold" ? "hover:border-gold/60" : "hover:border-blood/60";
  const chip = accent === "gold" ? "text-gold" : "text-blood";
  const sectionCls =
    accent === "gold" ? "border-border bg-black/30 p-3" : "border border-blood/40 bg-blood/5 p-3";
  const rebuildCls =
    accent === "gold"
      ? "border-gold/60 text-gold hover:bg-gold hover:text-ink"
      : "border-blood/60 text-blood hover:bg-blood hover:text-white";

  return (
    <div className={sectionCls}>
      <div className="mb-2 flex items-center gap-2">
        <input
          className={`${inputCls} flex-1`}
          value={phase.name}
          onChange={(e) => onName(e.target.value)}
        />
        <span className={`whitespace-nowrap text-[10px] uppercase tracking-widest ${chip}`}>
          {accentLabel} · {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-blood hover:opacity-80"
          aria-label="Remover fase"
          title="Remover fase"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {(["groups", "swiss", "bracket"] as PhaseKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKind(k)}
            className={`border px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              phase.kind === k ? on : `${off} ${hover}`
            }`}
          >
            {k === "groups" ? "Grupos" : k === "swiss" ? "Suíço" : "Playoffs"}
          </button>
        ))}
      </div>

      {phase.config.kind === "groups" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 grid grid-cols-2 gap-1">
            {(["round-robin", "gsl"] as const).map((f) => {
              const cur = (phase.config as GroupsConfig).format ?? "round-robin";
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onConfig({ format: f })}
                  className={`border px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
                    cur === f ? on : `${off} ${hover}`
                  }`}
                >
                  {f === "round-robin" ? "Todos contra todos" : "GSL (chave dupla)"}
                </button>
              );
            })}
          </div>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Nº de grupos
            </span>
            <input
              type="number"
              min={1}
              max={8}
              className={inputCls}
              value={(phase.config as GroupsConfig).groupCount}
              onChange={(e) => onConfig({ groupCount: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Classificados / grupo
            </span>
            <input
              type="number"
              min={1}
              max={16}
              className={inputCls}
              value={(phase.config as GroupsConfig).qualifiersPerGroup}
              onChange={(e) =>
                onConfig({ qualifiersPerGroup: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
          <div className="col-span-2">
            <BoRow
              label="Best of"
              value={(phase.config as GroupsConfig).bestOf}
              onChange={(v) => onConfig({ bestOf: v })}
              accent={accent}
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={(phase.config as GroupsConfig).doubleRoundRobin}
              onChange={(e) => onConfig({ doubleRoundRobin: e.target.checked })}
            />
            Turno e returno (double round-robin)
          </label>
        </div>
      ) : phase.config.kind === "swiss" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Vitórias p/ avançar
            </span>
            <input
              type="number"
              min={1}
              max={7}
              className={inputCls}
              value={(phase.config as SwissConfig).winsToAdvance}
              onChange={(e) =>
                onConfig({ winsToAdvance: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Derrotas p/ eliminar
            </span>
            <input
              type="number"
              min={1}
              max={7}
              className={inputCls}
              value={(phase.config as SwissConfig).lossesToEliminate}
              onChange={(e) =>
                onConfig({ lossesToEliminate: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
          <div className="col-span-2">
            <BoRow
              label="Best of padrão"
              value={(phase.config as SwissConfig).defaultBestOf}
              onChange={(v) => onConfig({ defaultBestOf: v })}
              accent={accent}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <PlayoffModeToggle config={phase.config as PlayoffsConfig} onConfig={onConfig} />
          </div>
          {(phase.config as PlayoffsConfig).mode === "custom" ? (
            <div className="col-span-2">
              <PlayoffBuilder config={phase.config as PlayoffsConfig} onConfig={onConfig} />
            </div>
          ) : (
            <>
              <div className="col-span-2 grid grid-cols-2 gap-1">
                {(["single", "double"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onConfig({ type: t })}
                    className={`border px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
                      (phase.config as PlayoffsConfig).type === t ? on : `${off} ${hover}`
                    }`}
                  >
                    {t === "single" ? "Eliminação simples" : "Eliminação dupla"}
                  </button>
                ))}
              </div>
              {autoSlotsNote ? (
                <div className="col-span-2 border border-gold/40 bg-gold/5 px-2 py-1.5 text-[10px] uppercase tracking-widest text-gold">
                  Vagas automáticas · {autoSlotsNote}
                </div>
              ) : (
                <label className="col-span-2 space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Nº de vagas
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={32}
                    className={inputCls}
                    value={(phase.config as PlayoffsConfig).slots}
                    onChange={(e) => onConfig({ slots: Math.max(2, Number(e.target.value) || 2) })}
                  />
                </label>
              )}
              <BoRow
                label="Best of padrão"
                value={(phase.config as PlayoffsConfig).defaultBestOf}
                onChange={(v) => onConfig({ defaultBestOf: v })}
                accent={accent}
              />
              <BoRow
                label="Best of da final"
                value={(phase.config as PlayoffsConfig).finalBestOf}
                onChange={(v) => onConfig({ finalBestOf: v })}
                accent={accent}
              />
              {(phase.config as PlayoffsConfig).type === "double" ? (
                <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={(phase.config as PlayoffsConfig).bracketReset}
                    onChange={(e) => onConfig({ bracketReset: e.target.checked })}
                  />
                  Reset da chave na Grande Final
                </label>
              ) : null}
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {isFirst ? (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {hasTeams
              ? "1ª fase — “Aplicar” preenche com os times da série"
              : "1ª fase — cadastre times da série antes de preencher"}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Times entram via “Puxar classificados” na página
          </span>
        )}
        <button
          type="button"
          onClick={onRebuild}
          className={`inline-flex shrink-0 items-center gap-1 border bg-black/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${rebuildCls}`}
        >
          <RefreshCw className="h-3 w-3" /> Aplicar (resetar fase)
        </button>
      </div>
    </div>
  );
}
