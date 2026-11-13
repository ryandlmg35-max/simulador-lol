import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Info,
  Plus,
  Shuffle,
  Trash2,
  Trophy,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/lol/store";
import type {
  BestOf,
  Championship,
  GameId,
  GroupsConfig,
  InternationalLevel,
  Phase,
  PhaseConfig,
  PhaseKind,
  PlayoffsConfig,
  SwissConfig,
  Team,
} from "@/lib/lol/types";
import {
  automaticPlayInAdvanceCount,
  adaptPlayoffConfig,
  buildPhaseMatches,
  createGroupsForTeams,
  emptyCustomSpec,
  renameDecider,
  shuffle,
  uid,
} from "@/lib/lol/generate";
import {
  isPlayInPhaseName,
  planInternationalField,
  playInStructure,
  type InternationalPlan,
} from "@/lib/lol/international";
import { fileToLogo } from "@/lib/lol/image";
import {
  getOfficialLogo,
  OFFICIAL_REGION_LOGOS,
  detectLeaguePreset,
} from "@/lib/lol/official-logos";
import { AiTeamImport } from "@/components/lol/ai-team-import";
import { PlayoffBuilder, PlayoffModeToggle } from "@/components/lol/playoff-builder";
import { ImportLeagueTeams } from "@/components/lol/import-league-teams";
import { ImportFromRanking } from "@/components/lol/import-from-ranking";
import { ChampionshipLogoPicker } from "@/components/lol/championship-logo-picker";
import { ANNUAL_CIRCUIT, pickInternationalTeams } from "@/lib/lol/circuit";
import { toast } from "sonner";

type CreateSearch = {
  game?: GameId;
  name?: string;
  season?: string;
  template?: string;
  month?: number;
};
type Division = 1 | 2;

export const Route = createFileRoute("/create")({
  component: CreatePage,
  validateSearch: (s: Record<string, unknown>): CreateSearch => ({
    game: s.game === "cs2" ? "cs2" : "lol",
    name: typeof s.name === "string" ? s.name.slice(0, 80) : undefined,
    season: typeof s.season === "string" ? s.season.slice(0, 40) : undefined,
    template: typeof s.template === "string" ? s.template : undefined,
    month: typeof s.month === "number" ? s.month : undefined,
  }),
});

interface DraftPhase {
  id: string;
  name: string;
  kind: PhaseKind;
  config: PhaseConfig;
  groupAssignments?: Record<string, number>;
}

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

const defaultPhaseName = (kind: PhaseKind, index: number): string => {
  if (kind === "groups") return index === 0 ? "Fase de Grupos" : `Fase de Grupos ${index + 1}`;
  if (kind === "swiss") return index === 0 ? "Fase Suíça" : `Fase Suíça ${index + 1}`;
  return index === 0 ? "Playoffs" : `Playoffs ${index + 1}`;
};

const mkDraftPhase = (kind: PhaseKind, index: number): DraftPhase => ({
  id: uid(),
  name: defaultPhaseName(kind, index),
  kind,
  config: defaultConfigFor(kind),
});

function CreatePage() {
  const navigate = useNavigate();
  const { addChampionship, career, championships } = useStore();
  const {
    game = "lol",
    name: prefilledName,
    season: prefilledSeason,
    template: prefilledTemplate,
    month: prefilledMonth,
  } = Route.useSearch();
  // Se vier com template da URL, começa no step 3 (Times) já que nome/fases já estão preenchidos
  const [step, setStep] = useState<number>(prefilledTemplate ? 3 : 1);

  const [name, setName] = useState(prefilledName ?? "");
  const [logo, setLogo] = useState<string | undefined>();
  const [region, setRegion] = useState("");
  const [season, setSeason] = useState(prefilledSeason ?? "");
  const [accentColor, setAccentColor] = useState(game === "cs2" ? "#f59e0b" : "#e11d1d");
  const [countsTowardsRanking, setCountsTowardsRanking] = useState(true);
  const [internationalLevel, setInternationalLevel] = useState<InternationalLevel>("none");
  const [hasSecondDivision, setHasSecondDivision] = useState(false);
  const [scheduledMonth, setScheduledMonth] = useState<number | undefined>(prefilledMonth);

  const [teamsA, setTeamsA] = useState<Team[]>([]);
  const [teamsB, setTeamsB] = useState<Team[]>([]);
  const [phasesA, setPhasesA] = useState<DraftPhase[]>([
    mkDraftPhase("groups", 0),
    mkDraftPhase("bracket", 1),
  ]);
  const [phasesB, setPhasesB] = useState<DraftPhase[]>([]);
  const [teamsDivision, setTeamsDivision] = useState<Division>(1);

  // Carrega template da URL se fornecido (ex: vindo do Calendário)
  useEffect(() => {
    if (prefilledTemplate) {
      const match = ANNUAL_CIRCUIT.find(
        (c) =>
          c.id === prefilledTemplate ||
          c.name.toLowerCase().includes(prefilledTemplate.toLowerCase()),
      );
      if (match) {
        setName(`${match.name} 2026`);
        setRegion("Internacional");
        setLogo(match.logo);
        setAccentColor(match.accentColor);
        setInternationalLevel(match.level);
        setScheduledMonth(prefilledMonth ?? match.month);
        setPhasesA(
          match.buildPhases().map((p) => ({
            id: uid(),
            name: p.name,
            kind: p.kind,
            config: p.config,
          })),
        );
      }
    } else if (prefilledName) {
      // Se vier criando a partir de um campeonato existente com mesmo nome, preenche o formato e os times idênticos
      const existing = championships.find(
        (c) =>
          c.name.trim().toLowerCase() === prefilledName.trim().toLowerCase() &&
          (c.game ?? "lol") === game,
      );
      if (existing) {
        setRegion(existing.region ?? "");
        if (existing.logo) setLogo(existing.logo);
        if (existing.accentColor) setAccentColor(existing.accentColor);
        if (existing.internationalLevel) setInternationalLevel(existing.internationalLevel);
        setHasSecondDivision(!!existing.serieB);
        setPhasesA(
          existing.phases.map((p) => ({
            id: uid(),
            name: p.name,
            kind: p.kind,
            config: p.config,
          })),
        );
        if (existing.serieB) {
          setPhasesB(
            existing.serieB.phases.map((p) => ({
              id: uid(),
              name: p.name,
              kind: p.kind,
              config: p.config,
            })),
          );
          setTeamsB(existing.serieB.teams.map((t) => ({ ...t, id: uid() })));
        }
        setTeamsA(existing.teams.map((t) => ({ ...t, id: uid() })));
      }
    }
  }, [prefilledTemplate, prefilledMonth, prefilledName, championships, game]);

  const teamsOf = (d: Division) => (d === 1 ? teamsA : teamsB);
  const phasesOf = (d: Division) => (d === 1 ? phasesA : phasesB);
  const setTeamsOf = (d: Division, updater: (prev: Team[]) => Team[]) =>
    d === 1 ? setTeamsA(updater) : setTeamsB(updater);
  const setPhasesOf = (d: Division, updater: (prev: DraftPhase[]) => DraftPhase[]) =>
    d === 1 ? setPhasesA(updater) : setPhasesB(updater);

  const enableSecondDivision = (on: boolean) => {
    setHasSecondDivision(on);
    if (on && phasesB.length === 0) {
      setPhasesB([mkDraftPhase("groups", 0), mkDraftPhase("bracket", 1)]);
    }
  };

  const addPhaseDraft = (d: Division) =>
    setPhasesOf(d, (prev) => [...prev, mkDraftPhase("bracket", prev.length)]);
  const removePhaseDraft = (d: Division, id: string) =>
    setPhasesOf(d, (prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  const setPhaseKindAt = (d: Division, i: number, kind: PhaseKind) =>
    setPhasesOf(d, (prev) =>
      prev.map((p, idx) =>
        idx === i
          ? {
              ...p,
              kind,
              name: defaultPhaseName(kind, i),
              config: defaultConfigFor(kind),
              groupAssignments: undefined,
            }
          : p,
      ),
    );
  const updatePhaseAt = (d: Division, i: number, patch: Partial<DraftPhase>) =>
    setPhasesOf(d, (prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const updatePhaseConfigAt = (d: Division, i: number, patch: Partial<PhaseConfig>) =>
    setPhasesOf(d, (prev) =>
      prev.map((p, idx) =>
        idx === i ? { ...p, config: { ...p.config, ...patch } as PhaseConfig } : p,
      ),
    );

  const addTeamAt = (d: Division) =>
    setTeamsOf(d, (prev) => [...prev, { id: uid(), name: "", tag: "", color: "#c9a84c" }]);
  const updateTeamAt = (d: Division, id: string, patch: Partial<Team>) =>
    setTeamsOf(d, (prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextName = patch.name ?? t.name;
        const nextTag = patch.tag ?? t.tag;
        const autoLogo = !t.logo && !patch.logo ? getOfficialLogo(nextName, nextTag) : undefined;
        return { ...t, ...patch, ...(autoLogo ? { logo: autoLogo } : {}) };
      }),
    );
  const removeTeamAt = (d: Division, id: string) =>
    setTeamsOf(d, (prev) => prev.filter((t) => t.id !== id));

  const divisionReady = (d: Division) => {
    const teams = teamsOf(d);
    return phasesOf(d).length >= 1 && teams.length >= 2 && teams.every((t) => t.name.trim());
  };

  const canGoStep = (s: number): boolean => {
    if (s <= 1) return true;
    if (s === 2) return name.trim().length > 0;
    if (s === 3) return true;
    if (s === 4) return divisionReady(1) && (!hasSecondDivision || divisionReady(2));
    if (s === 5) return true;
    return true;
  };

  const applyTemplate = (
    meta: {
      name: string;
      region: string;
      logo?: string;
      accentColor?: string;
      internationalLevel?: InternationalLevel;
      scheduledMonth?: number;
    },
    phases: DraftPhase[],
  ) => {
    setName(meta.name);
    setRegion(meta.region);
    if (meta.logo) setLogo(meta.logo);
    if (meta.accentColor) setAccentColor(meta.accentColor);
    if (meta.internationalLevel) {
      setInternationalLevel(meta.internationalLevel);
    } else {
      setInternationalLevel(
        /worlds?|mundial|\bmsi\b|mid.?season/i.test(meta.name) ? "major" : "none",
      );
    }
    if (meta.scheduledMonth) setScheduledMonth(meta.scheduledMonth);
    setPhasesA(phases);
    // Pula direto para o Step 3 (Times) — nome e formato já estão configurados
    setStep(3);
  };

  const circuitDef = useMemo(() => {
    if (prefilledTemplate) {
      const match = ANNUAL_CIRCUIT.find(
        (c) =>
          c.id === prefilledTemplate ||
          c.name.toLowerCase().includes(prefilledTemplate.toLowerCase()),
      );
      if (match) return match;
    }
    const lower = name.toLowerCase().trim();
    if (!lower) return undefined;
    return ANNUAL_CIRCUIT.find(
      (c) =>
        c.matchPatterns.some((p) => lower.includes(p)) ||
        lower.includes(c.shortName.toLowerCase()) ||
        lower.includes(c.name.toLowerCase()),
    );
  }, [prefilledTemplate, name]);

  const handlePullQualifiedTeams = () => {
    if (!circuitDef) return;
    const picked = pickInternationalTeams(championships, circuitDef, career);
    if (picked.length === 0) {
      toast.error("Nenhum time classificado encontrado nas ligas regionais!");
      return;
    }
    setTeamsA(picked);
    toast.success(`${picked.length} times classificados importados com sucesso!`);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const circuitMatch = ANNUAL_CIRCUIT.find(
      (c) =>
        c.matchPatterns.some((pattern) => val.toLowerCase().includes(pattern)) ||
        val.toLowerCase().includes(c.shortName.toLowerCase()) ||
        val.toLowerCase().includes(c.name.toLowerCase()),
    );
    if (circuitMatch) {
      if (!logo || logo.startsWith("data:") || logo.includes("upload.wikimedia.org") || logo.includes("wsrv.nl")) {
        setLogo(circuitMatch.logo);
      }
      setRegion("Internacional");
      setAccentColor(circuitMatch.accentColor);
      setInternationalLevel(circuitMatch.level);
      setScheduledMonth(circuitMatch.month);
      setPhasesA(
        circuitMatch.buildPhases().map((p) => ({
          id: uid(),
          name: p.name,
          kind: p.kind,
          config: p.config,
        })),
      );
      return;
    }
    const preset = detectLeaguePreset(val);
    if (preset) {
      if (!logo || logo.startsWith("data:") || logo.includes("upload.wikimedia.org") || logo.includes("wsrv.nl")) {
        setLogo(preset.logo);
      }
      if (!region) setRegion(preset.defaultRegion);
      if (!accentColor || accentColor === "#e11d1d") setAccentColor(preset.accentColor);
      if (/worlds?|mundial|\bmsi\b|mid.?season/i.test(preset.id)) {
        setInternationalLevel("major");
      } else if (["FirstStand", "RiftRivals", "SuperCup", "GlobalMasters", "UnderdogsCup"].includes(preset.id)) {
        setInternationalLevel("minor");
      }
    }
  };

  const previewPlanA = useMemo(
    () =>
      planInternationalField({
        teams: teamsA,
        phases: phasesA,
        game,
        career,
        fallbackRegion: region,
        championshipName: name,
      }),
    [teamsA, phasesA, game, career, region, name],
  );
  const previewPlanB = useMemo(
    () =>
      planInternationalField({
        teams: teamsB,
        phases: phasesB,
        game,
        career,
        fallbackRegion: region,
        championshipName: name,
      }),
    [teamsB, phasesB, game, career, region, name],
  );

  const buildPoolPhases = (draftPhases: DraftPhase[], poolTeams: Team[]): Phase[] => {
    const plan = planInternationalField({
      teams: poolTeams,
      phases: draftPhases,
      game,
      career,
      fallbackRegion: region,
      championshipName: name,
    });

    // Formato do play-in internacional (Worlds/MSI): grupo (2x2 GSL) ou
    // confronto único de Classificação quando é só uma vaga.
    const structure = plan.active ? playInStructure(plan.playInSlots, plan.qualifiersToMain) : null;

    return draftPhases.map((dp, phaseIndex) => {
      let teamIdsForPhase: string[] = [];
      // Vagas RESERVADAS da fase principal: o classificado do play-in entra
      // nelas quando o play-in termina (evento principal começa em paralelo).
      let reservedSlots = 0;
      if (plan.active) {
        if (phaseIndex === plan.playInPhaseIndex) teamIdsForPhase = plan.playInTeamIds;
        else if (phaseIndex === plan.mainPhaseIndex) {
          teamIdsForPhase = plan.directTeamIds;
          reservedSlots = plan.qualifiersToMain;
        }
      } else if (phaseIndex === 0) {
        teamIdsForPhase = poolTeams.map((t) => t.id);
      }

      // Play-in internacional (Worlds/MSI): fase própria, sem valor no Hall
      // da Fama. Sem inscritos ela é DISPENSADA (conta como concluída).
      const isIntlPlayIn = plan.active && phaseIndex === plan.playInPhaseIndex;
      const isIntlMain = plan.active && phaseIndex === plan.mainPhaseIndex;
      const playInEmpty = isIntlPlayIn && teamIdsForPhase.length === 0;

      const phaseConfig = isIntlPlayIn && structure ? structure.config : dp.config;
      const config = adaptPlayoffConfig(phaseConfig, teamIdsForPhase.length + reservedSlots);
      const groups =
        config.kind === "groups"
          ? createGroupsForTeams(config, teamIdsForPhase, dp.groupAssignments)
          : [];

      const built = playInEmpty
        ? []
        : buildPhaseMatches(config, teamIdsForPhase, groups, reservedSlots);
      const matches =
        isIntlPlayIn && structure?.deciderLabel
          ? renameDecider(built, structure.deciderLabel)
          : built;

      return {
        id: dp.id,
        name: dp.name,
        kind:
          isIntlPlayIn && structure
            ? structure.kind === "groups"
              ? "groups"
              : "bracket"
            : dp.kind,
        config,
        groups: config.kind === "groups" ? groups : undefined,
        matches,
        seededTeamIds: teamIdsForPhase,
        directTeamIds: isIntlMain ? plan.directTeamIds : undefined,
        advanceCount: isIntlPlayIn ? (playInEmpty ? 0 : plan.qualifiersToMain) : undefined,
        internationalPlayIn: isIntlPlayIn ? true : undefined,
        skipped: playInEmpty ? true : undefined,
      };
    });
  };

  const finalize = () => {
    const prepareTeams = (list: Team[]) =>
      list.map((t) => ({ ...t, logo: t.logo || getOfficialLogo(t.name, t.tag) }));
    const finalTeamsA = prepareTeams(teamsA);
    const finalTeamsB = prepareTeams(teamsB);

    const championship: Championship = {
      id: uid(),
      name: name.trim(),
      game,
      region: region.trim() || undefined,
      season: season.trim() || undefined,
      logo,
      accentColor,
      teams: finalTeamsA,
      phases: buildPoolPhases(phasesA, finalTeamsA),
      countsTowardsRanking,
      internationalLevel,
      hasSecondDivision,
      scheduledMonth: scheduledMonth ?? undefined,
      serieB: hasSecondDivision
        ? { teams: finalTeamsB, phases: buildPoolPhases(phasesB, finalTeamsB), history: [] }
        : undefined,
    };
    addChampionship(championship);
    navigate({ to: "/championship/$id", params: { id: championship.id } });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-ink bg-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-bone"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <span className="font-display text-lg uppercase tracking-widest text-gold">
            Novo Campeonato · {game === "cs2" ? "CS2" : "LoL"}
          </span>
        </div>
      </header>

      <div className="border-b-2 border-ink bg-card/40">
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-6 py-3">
          {[
            { id: 1, label: "Informações" },
            { id: 2, label: "Estrutura" },
            { id: 3, label: "Times" },
            { id: 4, label: "Configurar Fases" },
            { id: 5, label: "Revisão" },
          ].map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id <= step || canGoStep(s.id)) setStep(s.id);
                }}
                className={`flex items-center gap-2 border-2 px-3 py-1.5 font-display text-xs uppercase tracking-widest transition-colors ${
                  active
                    ? "border-gold bg-gold text-ink"
                    : done
                      ? "border-gold/60 bg-black/40 text-gold"
                      : "border-border bg-black/30 text-muted-foreground"
                }`}
              >
                <span className="font-display text-base leading-none">
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {step === 1 && (
          <section>
            <SectionTitle
              icon={Sparkles}
              step={1}
              title="Informações Básicas"
              sub="Só o essencial. Você pode mudar tudo depois."
            />
            <div className="mb-8 flex flex-col gap-4 border-2 border-gold/40 bg-gold/5 p-4">
              {/* Torneios Internacionais Major */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-display text-sm uppercase tracking-widest text-gold font-bold">
                    👑 Torneios Major (Mundiais Riot · 2.0x Pontos)
                  </span>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Máximo Prestígio Mundial
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Mundial (Worlds)",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.Worlds,
                          accentColor: "#c8aa6e",
                          internationalLevel: "major",
                        },
                        [
                          {
                            id: uid(),
                            name: "Play-in",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 8,
                              type: "double",
                              defaultBestOf: 3,
                              finalBestOf: 3,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                          {
                            id: uid(),
                            name: "Fase Suíça",
                            kind: "swiss",
                            config: {
                              kind: "swiss",
                              winsToAdvance: 3,
                              lossesToEliminate: 3,
                              defaultBestOf: 1,
                            },
                          },
                          {
                            id: uid(),
                            name: "Knockout Stage",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 8,
                              type: "double",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-gold/80 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-gold hover:bg-gold/20 transition-all shadow-[2px_2px_0_0_var(--gold)]"
                  >
                    🏆 Mundial (Worlds)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Mid-Season Invitational (MSI)",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.MSI,
                          accentColor: "#eab308",
                          internationalLevel: "major",
                        },
                        [
                          {
                            id: uid(),
                            name: "Play-in",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 8,
                              type: "double",
                              defaultBestOf: 3,
                              finalBestOf: 3,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                          {
                            id: uid(),
                            name: "Bracket Stage",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 8,
                              type: "double",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-amber-400/80 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-400/20 transition-all shadow-[2px_2px_0_0_rgba(251,191,36,0.6)]"
                  >
                    ⚡ Mid-Season Invitational (MSI)
                  </button>
                </div>
              </div>

              {/* Torneios Internacionais Secundários (Minor) */}
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-display text-sm uppercase tracking-widest text-cyan-400 font-bold">
                    ⚡ Internacionais Secundários (Minor · 1.35x Pontos)
                  </span>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Mais confrontos no ano · Regras Inovadoras
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "First Stand Tournament",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.FirstStand,
                          accentColor: "#00e5ff",
                          internationalLevel: "minor",
                        },
                        [
                          {
                            id: uid(),
                            name: "Fase Suíça Relâmpago",
                            kind: "swiss",
                            config: {
                              kind: "swiss",
                              winsToAdvance: 2,
                              lossesToEliminate: 2,
                              defaultBestOf: 3,
                            },
                          },
                          {
                            id: uid(),
                            name: "Final Four (Chave Dupla)",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 4,
                              type: "double",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-cyan-400/70 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-400/20 transition-all shadow-[2px_2px_0_0_rgba(6,182,212,0.6)]"
                    title="Abertura da temporada: Suíço compacto 2V/2D em Bo3 + Final Four em Chave Dupla Bo5"
                  >
                    ⚡ First Stand (Kickoff)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Rift Rivals: Batalha Continental",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.RiftRivals,
                          accentColor: "#ff4500",
                          internationalLevel: "minor",
                        },
                        [
                          {
                            id: uid(),
                            name: "Fase de Grupos Continental",
                            kind: "groups",
                            config: {
                              kind: "groups",
                              format: "round-robin",
                              groupCount: 2,
                              doubleRoundRobin: true,
                              bestOf: 3,
                              qualifiersPerGroup: 2,
                            },
                          },
                          {
                            id: uid(),
                            name: "King of the Hill (Gauntlet)",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 4,
                              type: "single",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-orange-500/70 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-400 hover:bg-orange-500/20 transition-all shadow-[2px_2px_0_0_rgba(249,115,22,0.6)]"
                    title="Rivalidade regional: Turno e Returno Bo3 em 2 grupos + Gauntlet Escalado Bo5"
                  >
                    ⚔️ Rift Rivals
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Supercopa Intercontinental",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.SuperCup,
                          accentColor: "#a855f7",
                          internationalLevel: "minor",
                        },
                        [
                          {
                            id: uid(),
                            name: "Chave Dupla com Reset",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 8,
                              type: "double",
                              defaultBestOf: 3,
                              finalBestOf: 5,
                              bracketReset: true,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-purple-500/70 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-purple-300 hover:bg-purple-500/20 transition-all shadow-[2px_2px_0_0_rgba(168,85,247,0.6)]"
                    title="8 equipes em eliminação dupla pura: quem vem da repescagem precisa vencer 2 séries para ser campeão!"
                  >
                    👑 Supercopa (Bracket Reset)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Global Masters",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.GlobalMasters,
                          accentColor: "#3b82f6",
                          internationalLevel: "minor",
                        },
                        [
                          {
                            id: uid(),
                            name: "Grupos Estilo GSL",
                            kind: "groups",
                            config: {
                              kind: "groups",
                              format: "gsl",
                              groupCount: 2,
                              doubleRoundRobin: false,
                              bestOf: 3,
                              qualifiersPerGroup: 2,
                            },
                          },
                          {
                            id: uid(),
                            name: "Finais Knockout",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 4,
                              type: "single",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-blue-500/70 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-300 hover:bg-blue-500/20 transition-all shadow-[2px_2px_0_0_rgba(59,130,246,0.6)]"
                    title="Copa do Mundo de Clubes: Grupos em Chave Dupla (GSL) Bo3 + Playoffs Eliminatórios Bo5"
                  >
                    🌐 Global Masters (GSL)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Copa dos Desafiantes Internacional",
                          region: "Internacional",
                          logo: OFFICIAL_REGION_LOGOS.UnderdogsCup,
                          accentColor: "#10b981",
                          internationalLevel: "minor",
                        },
                        [
                          {
                            id: uid(),
                            name: "Fase Suíça Desafiante",
                            kind: "swiss",
                            config: {
                              kind: "swiss",
                              winsToAdvance: 3,
                              lossesToEliminate: 3,
                              defaultBestOf: 1,
                            },
                          },
                          {
                            id: uid(),
                            name: "Playoffs Chave Dupla",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 4,
                              type: "double",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border-2 border-emerald-500/70 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-[2px_2px_0_0_rgba(16,185,129,0.6)]"
                    title="Palco para regiões desafiantes (CBLOL, LCP, etc.) pontuarem no ranking mundial!"
                  >
                    🛡️ Copa dos Desafiantes
                  </button>
                </div>
              </div>

              {/* Ligas Regionais & Formatos */}
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-display text-sm uppercase tracking-widest text-bone font-bold">
                    🏛️ Ligas Regionais & Formatos Gerais (1.0x Pontos)
                  </span>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Campeonatos Locais
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "CBLOL",
                          region: "BR",
                          logo: OFFICIAL_REGION_LOGOS.CBLOL,
                          accentColor: "#00ff88",
                          internationalLevel: "none",
                        },
                        [
                          {
                            id: uid(),
                            name: "Fase de Pontos",
                            kind: "groups",
                            config: {
                              kind: "groups",
                              format: "round-robin",
                              groupCount: 1,
                              doubleRoundRobin: true,
                              bestOf: 1,
                              qualifiersPerGroup: 6,
                            },
                          },
                          {
                            id: uid(),
                            name: "Playoffs",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 6,
                              type: "double",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border border-green-500/60 bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-green-400 hover:bg-green-500/20"
                  >
                    🇧🇷 Formato CBLOL
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "LCK",
                          region: "KR",
                          logo: OFFICIAL_REGION_LOGOS.LCK,
                          accentColor: "#0055ff",
                          internationalLevel: "none",
                        },
                        [
                          {
                            id: uid(),
                            name: "Temporada Regular",
                            kind: "groups",
                            config: {
                              kind: "groups",
                              format: "round-robin",
                              groupCount: 1,
                              doubleRoundRobin: true,
                              bestOf: 3,
                              qualifiersPerGroup: 6,
                            },
                          },
                          {
                            id: uid(),
                            name: "Playoffs",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 6,
                              type: "double",
                              defaultBestOf: 5,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border border-blue-500/60 bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-500/20"
                  >
                    🇰🇷 Formato LCK
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        {
                          name: "Torneio Suíço",
                          region: "Geral",
                          accentColor: "#c8aa6e",
                          internationalLevel: "none",
                        },
                        [
                          {
                            id: uid(),
                            name: "Fase Suíça",
                            kind: "swiss",
                            config: {
                              kind: "swiss",
                              winsToAdvance: 3,
                              lossesToEliminate: 3,
                              defaultBestOf: 1,
                            },
                          },
                          {
                            id: uid(),
                            name: "Playoffs",
                            kind: "bracket",
                            config: {
                              kind: "bracket",
                              slots: 8,
                              type: "single",
                              defaultBestOf: 3,
                              finalBestOf: 5,
                              bracketReset: false,
                              mode: "auto",
                            },
                          },
                        ],
                      )
                    }
                    className="border border-border bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-bone hover:bg-white/10"
                  >
                    🔷 Suíço + Playoffs
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField
                label="Nome do campeonato"
                required
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleNameChange(e.target.value)
                }
                placeholder="Ex: Meu Torneio 2026"
              />
              <TextField
                label="Região (opcional)"
                value={region}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegion(e.target.value)}
                placeholder="Ex: BR, INT, EU..."
              />
              <TextField
                label="Temporada / Split (opcional)"
                value={season}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeason(e.target.value)}
                placeholder="Ex: 2026 Split 1"
              />
              <label className="block">
                <span className="mb-1 block font-display text-xs uppercase tracking-widest text-gold">
                  📅 Mês no Calendário (opcional)
                </span>
                <select
                  className="w-full border-2 border-border bg-input px-3 py-2 text-sm text-bone focus:border-gold/60 focus:outline-none font-display uppercase tracking-wider"
                  value={scheduledMonth ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setScheduledMonth(Number.isFinite(v) ? v : undefined);
                  }}
                >
                  <option value="">— Sem mês definido —</option>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}. {m}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Usado para organizar o Calendário da Temporada.
                </p>
              </label>
              <label className="block">
                <span className="mb-1 block font-display text-xs uppercase tracking-widest text-gold">
                  Cor de destaque
                </span>
                <div className="flex items-center gap-2 border-2 border-border bg-input px-3 py-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-14 cursor-pointer border-none bg-transparent p-0"
                  />
                  <input
                    className="flex-1 bg-transparent text-sm text-bone focus:outline-none"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                </div>
              </label>
              <label className="block sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={countsTowardsRanking}
                    onChange={(e) => setCountsTowardsRanking(e.target.checked)}
                    className="h-5 w-5 accent-gold"
                  />
                  <span className="font-display text-sm uppercase tracking-widest text-bone">
                    Contar este campeonato para o Pódio e Ranking Global
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground ml-7">
                  Desmarque se for apenas um campeonato de teste.
                </p>
              </label>
              <div className="sm:col-span-2 border-2 border-gold/30 bg-black/40 p-4">
                <span className="mb-2 block font-display text-xs uppercase tracking-widest text-gold font-bold">
                  Prestígio & Nível de Pontos do Campeonato
                </span>
                <p className="mb-3 text-xs text-muted-foreground">
                  Define o multiplicador de pontos no Hall da Fama e se os confrontos alimentam o ranking internacional de vagas.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInternationalLevel("none")}
                    className={`p-3 text-left border-2 transition-all ${
                      internationalLevel === "none"
                        ? "border-bone bg-bone/10 text-bone shadow-[2px_2px_0_0_rgba(255,255,255,0.4)]"
                        : "border-border/40 bg-black/20 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <div className="font-display text-xs uppercase tracking-wider font-bold text-bone">
                      🏛️ Liga Local / Nacional
                    </div>
                    <div className="mt-1 font-display text-[11px] text-gold">
                      1.0x · Título: +20 pts
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Torneio doméstico tradicional (CBLOL, LCK, LPL, etc.).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInternationalLevel("minor")}
                    className={`p-3 text-left border-2 transition-all ${
                      internationalLevel === "minor"
                        ? "border-cyan-400 bg-cyan-400/15 text-cyan-300 shadow-[2px_2px_0_0_rgba(6,182,212,0.6)]"
                        : "border-border/40 bg-black/20 text-muted-foreground hover:border-cyan-400/50"
                    }`}
                  >
                    <div className="font-display text-xs uppercase tracking-wider font-bold text-cyan-300">
                      ⚡ Internacional Minor
                    </div>
                    <div className="mt-1 font-display text-[11px] text-cyan-400">
                      1.35x · Título: +27 pts
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Torneio secundário internacional (First Stand, Rift Rivals, Supercopa, Global Masters).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInternationalLevel("major")}
                    className={`p-3 text-left border-2 transition-all ${
                      internationalLevel === "major"
                        ? "border-gold bg-gold/15 text-gold shadow-[2px_2px_0_0_var(--gold)]"
                        : "border-border/40 bg-black/20 text-muted-foreground hover:border-gold/50"
                    }`}
                  >
                    <div className="font-display text-xs uppercase tracking-wider font-bold text-gold">
                      👑 Internacional Major
                    </div>
                    <div className="mt-1 font-display text-[11px] text-gold">
                      2.0x · Título: +40 pts
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Campeonato Mundial oficial da Riot (Worlds, MSI). Máximo prestígio global.
                    </div>
                  </button>
                </div>
              </div>
              <label className="block sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasSecondDivision}
                    onChange={(e) => enableSecondDivision(e.target.checked)}
                    className="h-5 w-5 accent-gold"
                  />
                  <span className="font-display text-sm uppercase tracking-widest text-bone">
                    Habilitar 2ª Divisão (Série B)
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground ml-7">
                  Série A e Série B ficam <span className="text-gold">completamente separadas</span>
                  : cada uma tem seus próprios times, fases e histórico. Uma nunca interfere na
                  outra.
                </p>
              </label>
              <div className="md:col-span-2">
                <ChampionshipLogoPicker
                  value={logo}
                  onChange={setLogo}
                  onSelectPreset={(preset) => {
                    if (!name) setName(`${preset.name} 2026`);
                    if (!region) setRegion(preset.defaultRegion);
                    setAccentColor(preset.accentColor);
                  }}
                  game={game}
                />
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <SectionTitle
              icon={Layers}
              step={2}
              title="Estrutura"
              sub="Quantas fases e qual o tipo de cada uma — por série."
            />

            <DivisionHeader
              division={1}
              title="Fases · Série A"
              extra={`${phasesA.length} fase(s)`}
            />
            <div className="space-y-4">
              {phasesA.map((p, i) => (
                <DraftPhaseCard
                  key={p.id}
                  division={1}
                  phase={p}
                  canRemove={phasesA.length > 1}
                  onName={(v) => updatePhaseAt(1, i, { name: v })}
                  onKind={(k) => setPhaseKindAt(1, i, k)}
                  onConfig={(patch) => updatePhaseConfigAt(1, i, patch)}
                  onRemove={() => removePhaseDraft(1, p.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => addPhaseDraft(1)}
                className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-gold/60 bg-black/30 py-3 font-display text-sm uppercase tracking-widest text-gold hover:border-gold hover:bg-gold/10"
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> Adicionar Fase (Série A)
              </button>
            </div>

            {hasSecondDivision ? (
              <div className="mt-8">
                <DivisionHeader
                  division={2}
                  title="Fases · Série B (independente)"
                  extra={`${phasesB.length} fase(s)`}
                />
                <div className="space-y-4">
                  {phasesB.map((p, i) => (
                    <DraftPhaseCard
                      key={p.id}
                      division={2}
                      phase={p}
                      canRemove={phasesB.length > 1}
                      onName={(v) => updatePhaseAt(2, i, { name: v })}
                      onKind={(k) => setPhaseKindAt(2, i, k)}
                      onConfig={(patch) => updatePhaseConfigAt(2, i, patch)}
                      onRemove={() => removePhaseDraft(2, p.id)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => addPhaseDraft(2)}
                    className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-blood/60 bg-black/30 py-3 font-display text-sm uppercase tracking-widest text-blood hover:border-blood hover:bg-blood/10"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} /> Adicionar Fase (Série B)
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {step === 3 && (
          <section>
            <SectionTitle
              icon={Users}
              step={3}
              title="Times"
              sub={
                hasSecondDivision
                  ? "Cadastre os times de cada série separadamente. Mínimo 2 por série."
                  : "Adicione quantos times quiser. Mínimo 2."
              }
            />

            {/* Banner: Formato pré-configurado — aparece quando template carregado */}
            {phasesA.length > 0 && name && (
              <div className="mb-5 flex items-start gap-3 border-2 border-cyan-400/60 bg-cyan-400/8 p-3">
                <Layers className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xs uppercase tracking-widest text-cyan-300 font-bold mb-1">
                    ✅ Formato pré-configurado: {name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {phasesA.map((p, i) => (
                      <span
                        key={p.id}
                        className="rounded bg-black/40 border border-cyan-400/30 px-2 py-0.5 font-display text-[11px] uppercase tracking-wider text-cyan-200"
                      >
                        {i + 1}. {p.name} ({p.kind === "swiss" ? "Suíço" : p.kind === "groups" ? "Grupos" : "Bracket"})
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Formato já configurado. Adicione os times abaixo e finalize na etapa 5.{" "}
                    <button
                      type="button"
                      className="underline text-cyan-300 hover:text-cyan-100"
                      onClick={() => setStep(2)}
                    >
                      Editar formato
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* Ação rápida para puxar classificados das ligas automaticamente */}
            {circuitDef && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-2 border-gold/60 bg-gold/10 p-3">
                <div>
                  <div className="font-display text-xs uppercase tracking-widest text-gold font-bold">
                    ⚡ Classificação Automática ({circuitDef.name})
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Critério: <strong>{circuitDef.qualifiesFrom}</strong>. Puxa os times corretos das ligas regionais finalizadas.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePullQualifiedTeams}
                  className="flex items-center gap-2 border-2 border-gold bg-gold px-4 py-2 font-display text-xs uppercase tracking-widest text-ink hover:bg-gold/80 transition-all font-bold shadow-[2px_2px_0_0_var(--gold)]"
                >
                  <Sparkles className="h-4 w-4" />
                  Puxar Classificados Oficiais
                </button>
              </div>
            )}

            {hasSecondDivision ? (
              <div className="mb-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTeamsDivision(1)}
                  className={`border-2 py-3 font-display text-base uppercase tracking-widest transition-colors ${
                    teamsDivision === 1
                      ? "border-gold bg-gold text-ink"
                      : "border-border bg-input text-muted-foreground hover:border-gold/60"
                  }`}
                >
                  ① Série A · {teamsA.length} times
                </button>
                <button
                  type="button"
                  onClick={() => setTeamsDivision(2)}
                  className={`border-2 py-3 font-display text-base uppercase tracking-widest transition-colors ${
                    teamsDivision === 2
                      ? "border-blood bg-blood text-white"
                      : "border-border bg-input text-muted-foreground hover:border-blood/60"
                  }`}
                >
                  ② Série B · {teamsB.length} times
                </button>
              </div>
            ) : null}
            <TeamsList
              game={game}
              champName={name}
              accent={hasSecondDivision && teamsDivision === 2 ? "blood" : "gold"}
              teams={teamsOf(teamsDivision)}
              showRegionalSeedingHint={
                /worlds?|mundial|\bmsi\b|mid.?season/i.test(name) &&
                isPlayInPhaseName(phasesOf(teamsDivision)[0]?.name ?? "")
              }
              onAiImport={(imported) => setTeamsOf(teamsDivision, (prev) => [...prev, ...imported])}
              addTeam={() => addTeamAt(teamsDivision)}
              updateTeam={(id, patch) => updateTeamAt(teamsDivision, id, patch)}
              removeTeam={(id) => removeTeamAt(teamsDivision, id)}
            />
          </section>
        )}

        {step === 4 && (
          <section>
            <SectionTitle
              icon={Trophy}
              step={4}
              title="Configurar Fases"
              sub="Formato de jogo, grupos, chaveamento, vagas."
            />
            {circuitDef && (
              <div className="mb-6 flex items-start gap-3 border-2 border-emerald-500/60 bg-emerald-500/10 p-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xs uppercase tracking-widest text-emerald-300 font-bold mb-0.5">
                    Formato Oficial Pré-Configurado: {circuitDef.name}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {circuitDef.formatSummary}. As fases, chaves, grupos e regras de eliminação já estão configuradas segundo o regulamento oficial. Você pode personalizar abaixo ou avançar diretamente para a <strong>Revisão (Etapa 5)</strong> para salvar!
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-6">
              {previewPlanA.active ? (
                <div className="flex items-start gap-2 border border-gold/40 bg-gold/5 px-3 py-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-display uppercase tracking-wider text-gold">
                      Play-in internacional ativo
                    </span>
                    {` — cada região tem vaga própria para o evento principal: as 2 melhores regiões do ranking do Hall da Fama (${previewPlanA.playInExemptRegions.join(", ")}) nunca disputam o play-in (todos os times delas vão direto); nas demais, os melhores seeds vão direto e o pior seed da região disputa o play-in — região com 1 vaga vai direto pro play-in. `}
                    {`O evento principal tem ${previewPlanA.mainTargetSlots} vagas (soma das vagas do Hall da Fama por região) — não existe número fixo de vagas. `}
                    {`Vagas em disputa: ${previewPlanA.qualifiersToMain} · quem não classificar fica fora do evento. O play-in não vale pontos, ELO nem histórico no Hall da Fama.`}
                  </p>
                </div>
              ) : null}
              <div>
                <DivisionHeader division={1} title="Série A" extra={`${phasesA.length} fase(s)`} />
                <div className="space-y-6">
                  {phasesA.map((p, i) => (
                    <PhaseConfigBlock
                      key={p.id}
                      index={i}
                      isFirst={i === 0}
                      accent="gold"
                      phase={p}
                      teams={teamsA}
                      entrantCount={
                        previewPlanA.active
                          ? i === previewPlanA.playInPhaseIndex
                            ? previewPlanA.playInTeamIds.length
                            : i === previewPlanA.mainPhaseIndex
                              ? previewPlanA.directTeamIds.length + previewPlanA.qualifiersToMain
                              : undefined
                          : i === 0
                            ? teamsA.length
                            : undefined
                      }
                      advanceCount={
                        isPlayInPhaseName(p.name)
                          ? previewPlanA.active && i === previewPlanA.playInPhaseIndex
                            ? previewPlanA.qualifiersToMain
                            : i === 0
                              ? automaticPlayInAdvanceCount(teamsA.length)
                              : undefined
                          : undefined
                      }
                      slotsNote={
                        previewPlanA.active && i === previewPlanA.mainPhaseIndex
                          ? `${previewPlanA.mainTargetSlots} vagas — soma das vagas do Hall da Fama por região`
                          : undefined
                      }
                      onConfig={(patch) => updatePhaseConfigAt(1, i, patch)}
                      onAssignments={(a) => updatePhaseAt(1, i, { groupAssignments: a })}
                    />
                  ))}
                </div>
              </div>

              {hasSecondDivision ? (
                <div>
                  <DivisionHeader
                    division={2}
                    title="Série B (independente)"
                    extra={`${phasesB.length} fase(s)`}
                  />
                  <div className="space-y-6">
                    {phasesB.map((p, i) => (
                      <PhaseConfigBlock
                        key={p.id}
                        index={i}
                        isFirst={i === 0}
                        accent="blood"
                        phase={p}
                        teams={teamsB}
                        entrantCount={
                          previewPlanB.active
                            ? i === previewPlanB.playInPhaseIndex
                              ? previewPlanB.playInTeamIds.length
                              : i === previewPlanB.mainPhaseIndex
                                ? previewPlanB.directTeamIds.length + previewPlanB.qualifiersToMain
                                : undefined
                            : i === 0
                              ? teamsB.length
                              : undefined
                        }
                        advanceCount={
                          isPlayInPhaseName(p.name)
                            ? previewPlanB.active && i === previewPlanB.playInPhaseIndex
                              ? previewPlanB.qualifiersToMain
                              : i === 0
                                ? automaticPlayInAdvanceCount(teamsB.length)
                                : undefined
                            : undefined
                        }
                        slotsNote={
                          previewPlanB.active && i === previewPlanB.mainPhaseIndex
                            ? `${previewPlanB.mainTargetSlots} vagas — soma das vagas do Hall da Fama por região`
                            : undefined
                        }
                        onConfig={(patch) => updatePhaseConfigAt(2, i, patch)}
                        onAssignments={(a) => updatePhaseAt(2, i, { groupAssignments: a })}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {step === 5 && (
          <section>
            <SectionTitle
              icon={Check}
              step={5}
              title="Revisão"
              sub="Tudo certo? Você pode voltar para ajustar."
            />
            <div className="space-y-4">
              <div className="border-2 border-ink bg-card p-4">
                <div className="font-display text-xl uppercase tracking-widest text-bone">
                  {name || "(sem nome)"}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {region || "—"} · {season || "—"}
                </div>
              </div>

              <div className="border-2 border-ink bg-card p-4">
                <div className="font-display text-lg uppercase tracking-widest text-gold">
                  Série A · {teamsA.length} times · {phasesA.length} fase(s)
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {teamsA.map((t) => (
                    <span
                      key={t.id}
                      className="border border-border bg-black/40 px-2 py-1 text-xs uppercase text-bone"
                    >
                      {t.tag || "?"} · {t.name}
                    </span>
                  ))}
                </div>
                <div className="mt-3">
                  <InternationalPlanPreview
                    plan={previewPlanA}
                    mainName={phasesA[previewPlanA.mainPhaseIndex]?.name ?? "fase principal"}
                  />
                </div>
                <ol className="mt-3 space-y-2">
                  {phasesA.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-baseline justify-between border-l-2 border-gold pl-3 text-sm"
                    >
                      <span>
                        <span className="font-display text-base uppercase tracking-widest text-bone">
                          {i + 1}. {p.name}
                        </span>{" "}
                        <span className="text-muted-foreground">{phaseSummary(p)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {hasSecondDivision ? (
                <div className="border-2 border-ink bg-card p-4">
                  <div className="font-display text-lg uppercase tracking-widest text-blood">
                    Série B (independente) · {teamsB.length} times · {phasesB.length} fase(s)
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {teamsB.map((t) => (
                      <span
                        key={t.id}
                        className="border border-border bg-black/40 px-2 py-1 text-xs uppercase text-bone"
                      >
                        {t.tag || "?"} · {t.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3">
                    <InternationalPlanPreview
                      plan={previewPlanB}
                      mainName={phasesB[previewPlanB.mainPhaseIndex]?.name ?? "fase principal"}
                      accent="blood"
                    />
                  </div>
                  <ol className="mt-3 space-y-2">
                    {phasesB.map((p, i) => (
                      <li
                        key={p.id}
                        className="flex items-baseline justify-between border-l-2 border-blood pl-3 text-sm"
                      >
                        <span>
                          <span className="font-display text-base uppercase tracking-widest text-bone">
                            {i + 1}. {p.name}
                          </span>{" "}
                          <span className="text-muted-foreground">{phaseSummary(p)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </section>
        )}

        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 border-2 border-border bg-input px-4 py-2 font-display uppercase tracking-widest text-bone transition-colors hover:border-gold disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          {step < 5 ? (
            <button
              type="button"
              disabled={!canGoStep(step + 1)}
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              className="slant-r flex items-center gap-2 bg-gold px-6 py-3 font-display text-lg uppercase tracking-widest text-ink transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próximo <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finalize}
              className="slant-r flex items-center gap-2 bg-blood px-8 py-3 font-display text-xl uppercase tracking-widest text-bone transition-transform hover:-translate-y-0.5"
            >
              Criar Campeonato <Check className="h-5 w-5" strokeWidth={3} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  step,
  title,
  sub,
}: {
  icon: React.ElementType;
  step: number;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="notch-tl flex h-10 w-10 items-center justify-center font-display text-xl bg-gold text-ink">
          {step}
        </span>
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-gold" />
          <span className="font-display text-2xl uppercase tracking-widest text-bone">{title}</span>
        </div>
      </div>
      <p className="ml-13 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function DivisionHeader({
  division,
  title,
  extra,
}: {
  division: Division;
  title: string;
  extra: string;
}) {
  const isA = division === 1;
  return (
    <div
      className={`mb-3 flex items-center gap-3 border-b-2 ${isA ? "border-gold/40" : "border-blood/40"} pb-2`}
    >
      <span className={`h-5 w-1.5 ${isA ? "bg-gold" : "bg-blood"}`} />
      <h3
        className={`font-display text-xl uppercase tracking-widest ${isA ? "text-gold" : "text-blood"}`}
      >
        {title}
      </h3>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{extra}</span>
    </div>
  );
}

function DraftPhaseCard({
  division,
  phase,
  canRemove,
  onName,
  onKind,
  onConfig,
  onRemove,
}: {
  division: Division;
  phase: DraftPhase;
  canRemove: boolean;
  onName: (v: string) => void;
  onKind: (k: PhaseKind) => void;
  onConfig: (patch: Partial<PhaseConfig>) => void;
  onRemove: () => void;
}) {
  const isA = division === 1;
  const accentOn = isA ? "border-gold bg-gold text-ink" : "border-blood bg-blood text-white";
  const accentOff = "border-border bg-input text-muted-foreground";
  const accentHover = isA ? "hover:border-gold/60" : "hover:border-blood/60";
  return (
    <div
      className={`border-2 p-4 ${isA ? "border-ink bg-card shadow-[3px_3px_0_0_var(--gold)]" : "border-ink bg-card shadow-[3px_3px_0_0_var(--blood)]"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span
            className={`notch-tl flex h-9 w-9 items-center justify-center font-display text-lg ${isA ? "bg-gold text-ink" : "bg-blood text-bone"}`}
          >
            {isA ? "A" : "B"}
          </span>
          <input
            className="flex-1 border-b-2 border-transparent bg-transparent font-display text-2xl uppercase tracking-widest text-bone focus:border-gold focus:outline-none"
            value={phase.name}
            onChange={(e) => onName(e.target.value)}
          />
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center border-2 border-border bg-input text-muted-foreground hover:border-blood hover:text-blood"
            aria-label="Remover fase"
            title="Remover fase"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {(["groups", "swiss", "bracket", "playin"] as const).map((k) => {
          const isPlayIn = k === "playin";
          const baseKind: PhaseKind = isPlayIn ? "bracket" : k;
          const isActive = isPlayIn
            ? phase.kind === "bracket" && isPlayInPhaseName(phase.name)
            : phase.kind === baseKind;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                onKind(baseKind);
                if (isPlayIn) {
                  onName("Play-in");
                  onConfig({
                    kind: "bracket",
                    slots: 8,
                    type: "double",
                    defaultBestOf: 3,
                    finalBestOf: 3,
                    bracketReset: false,
                    mode: "auto",
                  });
                }
              }}
              className={`border-2 p-4 text-left transition-colors ${isActive ? accentOn : `${accentOff} ${accentHover}`}`}
            >
              <div className="font-display text-lg uppercase tracking-widest text-bone">
                {k === "groups"
                  ? "Fase de Grupos"
                  : k === "swiss"
                    ? "Fase Suíça"
                    : k === "playin"
                      ? "Play-in"
                      : "Playoffs"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {k === "groups"
                  ? "Round robin em um ou mais grupos."
                  : k === "swiss"
                    ? "Pareamento por recorde (estilo MSI/Worlds)."
                    : k === "playin"
                      ? "Eliminação dupla; a chave se ajusta ao número de times."
                      : "Mata-mata simples ou dupla, ajustado ao número de times."}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhaseConfigBlock({
  index,
  isFirst,
  phase,
  teams,
  entrantCount,
  advanceCount,
  slotsNote,
  accent,
  onConfig,
  onAssignments,
}: {
  index: number;
  isFirst: boolean;
  phase: DraftPhase;
  teams: Team[];
  entrantCount?: number;
  advanceCount?: number;
  /** Evento internacional: as vagas vêm do Hall da Fama (sem número fixo). */
  slotsNote?: string;
  accent?: "gold" | "blood";
  onConfig: (patch: Partial<PhaseConfig>) => void;
  onAssignments: (a: Record<string, number>) => void;
}) {
  const isA = accent !== "blood";
  return (
    <div
      className={`border-2 border-ink bg-card ${isA ? "shadow-[4px_4px_0_0_var(--gold)]" : "shadow-[4px_4px_0_0_var(--blood)]"}`}
    >
      <div className="stripes-strong flex items-center gap-3 border-b-2 border-ink bg-ink px-4 py-2 text-bone">
        <span
          className={`notch-tl flex h-8 w-8 items-center justify-center font-display text-lg ${isA ? "bg-gold text-ink" : "bg-blood text-bone"}`}
        >
          {index + 1}
        </span>
        <div>
          <div className="font-display text-xl uppercase tracking-widest">{phase.name}</div>
          <div
            className={`text-[10px] font-bold uppercase tracking-[0.25em] ${isA ? "text-gold" : "text-blood"}`}
          >
            {isA ? "Série A · " : "Série B · "}
            {isPlayInPhaseName(phase.name)
              ? "Play-in"
              : phase.kind === "groups"
                ? "Fase de Grupos"
                : phase.kind === "swiss"
                  ? "Fase Suíça"
                  : "Playoffs"}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {entrantCount === undefined
              ? "Vagas ajustadas automaticamente pelos classificados anteriores"
              : `${entrantCount} ${entrantCount === 1 ? "time" : "times"} nesta fase`}
          </div>
          {slotsNote ? (
            <div className="text-[10px] font-bold uppercase tracking-wider text-gold">
              {slotsNote}
            </div>
          ) : null}
          {advanceCount !== undefined ? (
            <div className="text-[10px] font-bold uppercase tracking-wider text-gold">
              {advanceCount} {advanceCount === 1 ? "classifica" : "classificam"} automaticamente
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-4">
        {phase.kind === "groups" ? (
          <GroupsForm
            config={phase.config as GroupsConfig}
            onConfig={onConfig}
            isFirst={isFirst}
            teams={teams}
            assignments={phase.groupAssignments}
            onAssignments={onAssignments}
          />
        ) : phase.kind === "swiss" ? (
          <SwissForm config={phase.config as SwissConfig} onConfig={onConfig} teams={teams} />
        ) : (
          <PlayoffsForm config={phase.config as PlayoffsConfig} onConfig={onConfig} />
        )}
      </div>
    </div>
  );
}

function GroupsForm({
  config,
  onConfig,
  isFirst,
  teams,
  assignments,
  onAssignments,
}: {
  config: GroupsConfig;
  onConfig: (patch: Partial<PhaseConfig>) => void;
  isFirst: boolean;
  teams: Team[];
  assignments?: Record<string, number>;
  onAssignments: (a: Record<string, number>) => void;
}) {
  const groupCount = config.groupCount;
  const currentAssign = useMemo(() => {
    const a: Record<string, number> = { ...(assignments ?? {}) };
    teams.forEach((t, idx) => {
      if (a[t.id] === undefined) a[t.id] = idx % groupCount;
    });
    return a;
  }, [assignments, teams, groupCount]);

  const distribute = () => {
    const shuffled = shuffle(teams.map((t) => t.id));
    const a: Record<string, number> = {};
    shuffled.forEach((id, i) => (a[id] = i % groupCount));
    onAssignments(a);
  };

  const setTeamGroup = (id: string, g: number) => onAssignments({ ...currentAssign, [id]: g });

  const groupsPreview = Array.from({ length: groupCount }, (_, gi) =>
    teams.filter((t) => currentAssign[t.id] === gi),
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 font-display text-xs uppercase tracking-widest text-gold">
          Formato dos grupos
        </div>
        <div className="flex gap-2">
          {(["round-robin", "gsl"] as const).map((f) => {
            const cur = config.format ?? "round-robin";
            return (
              <button
                key={f}
                type="button"
                onClick={() => onConfig({ format: f })}
                className={`flex-1 border-2 py-2 font-display text-sm uppercase tracking-widest ${
                  cur === f
                    ? "border-gold bg-gold text-ink"
                    : "border-border bg-input text-muted-foreground"
                }`}
              >
                {f === "round-robin" ? "Todos contra todos" : "GSL (chave dupla)"}
              </button>
            );
          })}
        </div>
        {(config.format ?? "round-robin") === "gsl" ? (
          <div>
            <p className="text-[11px] text-muted-foreground">
              Mini chave dupla por grupo de 4 times. 2 classificados por grupo.
            </p>
            {teams.length > config.groupCount * 4 ? (
              <p className="mt-1 text-[11px] font-bold text-gold">
                ⚠️ {teams.length} times não cabem em {config.groupCount} grupo(s) de 4 — o sistema
                vai criar {Math.ceil(teams.length / 4)} grupo(s) automaticamente.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TextField
          label="Grupos"
          type="number"
          value={config.groupCount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onConfig({ groupCount: Math.max(1, Number(e.target.value) || 1) })
          }
          min={1}
          max={16}
        />
        <TextField
          label="Best of"
          type="number"
          value={config.bestOf}
          onChange={(e) => onConfig({ bestOf: Math.max(1, Number(e.target.value) || 1) as BestOf })}
          min={1}
          max={5}
        />
        <TextField
          label="Classificados/grupo"
          type="number"
          value={config.qualifiersPerGroup}
          onChange={(e) =>
            onConfig({ qualifiersPerGroup: Math.max(1, Number(e.target.value) || 1) })
          }
          min={1}
        />
        <label className="flex items-center gap-2 border-2 border-border bg-input px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.doubleRoundRobin}
            onChange={(e) => onConfig({ doubleRoundRobin: e.target.checked })}
            className="h-5 w-5 accent-gold"
          />
          <span className="font-display text-xs uppercase tracking-widest text-bone">
            Ida e volta
          </span>
        </label>
      </div>
      {isFirst && teams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-widest text-gold">
              Distribuição dos times
            </span>
            <button
              type="button"
              onClick={distribute}
              className="border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/20"
            >
              <Shuffle className="h-3 w-3" /> Sortear
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {groupsPreview.map((group, gi) => (
              <div key={gi} className="border border-border bg-black/30 p-2">
                <div className="mb-1 font-display text-xs uppercase tracking-widest text-gold">
                  Grupo {String.fromCharCode(65 + gi)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.map((t) => (
                    <span
                      key={t.id}
                      className="border border-border bg-black/40 px-1.5 py-0.5 text-[10px] uppercase text-bone"
                    >
                      {t.tag || "?"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SwissForm({
  config,
  onConfig,
  teams,
}: {
  config: SwissConfig;
  onConfig: (patch: Partial<PhaseConfig>) => void;
  teams: Team[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <TextField
        label="Vitórias p/ classificar"
        type="number"
        value={config.winsToAdvance}
        onChange={(e) => onConfig({ winsToAdvance: Math.max(1, Number(e.target.value) || 1) })}
        min={1}
        max={10}
      />
      <TextField
        label="Derrotas p/ eliminar"
        type="number"
        value={config.lossesToEliminate}
        onChange={(e) => onConfig({ lossesToEliminate: Math.max(1, Number(e.target.value) || 1) })}
        min={1}
        max={10}
      />
      <TextField
        label="Best of"
        type="number"
        value={config.defaultBestOf}
        onChange={(e) =>
          onConfig({ defaultBestOf: Math.max(1, Number(e.target.value) || 1) as BestOf })
        }
        min={1}
        max={5}
      />
    </div>
  );
}

function PlayoffsForm({
  config,
  onConfig,
}: {
  config: PlayoffsConfig;
  onConfig: (patch: Partial<PhaseConfig>) => void;
}) {
  const isCustom = config.mode === "custom" && !!config.custom;
  const patchPlayoffs = (patch: Partial<PlayoffsConfig>) => onConfig(patch);
  return (
    <div className="space-y-4">
      <PlayoffModeToggle config={config} onConfig={patchPlayoffs} />
      {isCustom && config.custom ? (
        <PlayoffBuilder config={config} onConfig={patchPlayoffs} />
      ) : (
        <>
          <div className="border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-display uppercase tracking-widest text-gold">
              Vagas automáticas
            </span>
            <span className="ml-2">
              A chave será ajustada ao número de times que chegar a esta fase.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <label className="flex items-center gap-2">
              <span className="mb-1 block font-display text-xs uppercase tracking-widest text-gold">
                Tipo
              </span>
              <select
                value={config.type}
                onChange={(e) => onConfig({ type: e.target.value as "single" | "double" })}
                className="w-full border-2 border-border bg-input px-3 py-2 text-sm text-bone focus:border-gold focus:outline-none"
              >
                <option value="single">Eliminação simples</option>
                <option value="double">Eliminação dupla</option>
              </select>
            </label>
            <TextField
              label="Bo padrão"
              type="number"
              value={config.defaultBestOf}
              onChange={(e) =>
                onConfig({ defaultBestOf: Math.max(1, Number(e.target.value) || 1) as BestOf })
              }
              min={1}
              max={5}
            />
            <TextField
              label="Bo final"
              type="number"
              value={config.finalBestOf}
              onChange={(e) =>
                onConfig({ finalBestOf: Math.max(1, Number(e.target.value) || 1) as BestOf })
              }
              min={1}
              max={5}
            />
            {config.type === "double" ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.bracketReset}
                  onChange={(e) => onConfig({ bracketReset: e.target.checked })}
                  className="h-5 w-5 accent-gold"
                />
                <span className="font-display text-xs uppercase tracking-widest text-bone">
                  Reset da chave
                </span>
              </label>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function InternationalPlanPreview({
  plan,
  mainName,
  accent = "gold",
}: {
  plan: InternationalPlan;
  mainName: string;
  accent?: "gold" | "blood";
}) {
  if (!plan.active) return null;
  const isA = accent !== "blood";
  const direct = plan.entries.filter((entry) => entry.destination === "direct");
  const playIn = plan.entries.filter((entry) => entry.destination === "play-in");
  const out = plan.entries.filter((entry) => entry.destination === "out");
  // Vagas do Hall da Fama por região (é daí que sai o tamanho do evento).
  const byRegion = new Map<string, { slots: number; direct: number; playIn: number }>();
  for (const entry of plan.entries) {
    const row = byRegion.get(entry.region) ?? { slots: entry.regionSlots, direct: 0, playIn: 0 };
    if (entry.destination === "direct") row.direct += 1;
    if (entry.destination === "play-in") row.playIn += 1;
    byRegion.set(entry.region, row);
  }
  return (
    <div
      className={`border-2 p-4 ${isA ? "border-gold/40 bg-gold/5" : "border-blood/40 bg-blood/5"}`}
    >
      <div
        className={`font-display text-sm uppercase tracking-widest ${isA ? "text-gold" : "text-blood"}`}
      >
        Play-in automático · {plan.tournament === "msi" ? "MSI" : "Worlds"}
      </div>
      {plan.eliteRegions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {plan.eliteRegions.map((region) => (
            <span
              key={`elite-${region}`}
              className="border-2 border-yellow-400 bg-yellow-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-300"
              title="Uma das regiões mais bem colocadas no ranking internacional"
            >
              ⭐ {region} (elite)
            </span>
          ))}
        </div>
      )}
      {plan.playInExemptRegions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {plan.playInExemptRegions.map((region) => (
            <span
              key={`exempt-${region}`}
              className="border-2 border-emerald-500/70 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
              title="As 2 melhores regiões do ranking do Hall da Fama: todos os times vão direto, nunca disputam o play-in"
            >
              {region} · isenta do play-in
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {plan.totalQualified} participantes · {playIn.length} no play-in · {direct.length} direto
        para {mainName} · {out.length} fora da edição.
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gold">
        {mainName}: {plan.mainTargetSlots} vaga(s) — soma das vagas do Hall da Fama por região
        {plan.eventTeamCount < plan.mainTargetSlots
          ? ` (${plan.eventTeamCount} times com vaga)`
          : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {Array.from(byRegion.entries()).map(([region, row]) => (
          <span
            key={region}
            className="border border-border/60 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
            title={`${region}: ${row.slots} vaga(s) no Hall da Fama`}
          >
            {region}: {row.slots} vaga(s) · {row.direct} direto
            {row.playIn ? ` · ${row.playIn} play-in` : ""}
            {plan.playInExemptRegions.includes(region) ? " · isenta" : ""}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Usa as vagas do Hall da Fama: as 2 melhores regiões do ranking nunca disputam o play-in
        (todos os times delas vão direto); nas demais, os melhores seeds vão direto e o pior seed da
        região vai pro play-in — região com 1 vaga vai direto pro play-in.
      </p>
      {plan.qualifiersToMain > 0 ? (
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {plan.qualifiersToMain} sobrevivem do play-in para a fase principal.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1">
        {direct.map((entry) => (
          <span
            key={`direct-${entry.teamId}`}
            className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
              entry.eliteRegion
                ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                : isA
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-blood/60 bg-blood/10 text-blood"
            }`}
            title={`${entry.teamName} · ${entry.region} #${entry.seed} · ${entry.regionSlots} vaga(s) ${plan.tournament === "worlds" ? "Worlds" : "MSI"}${entry.eliteRegion ? " · elite" : ""}`}
          >
            {entry.teamTag || entry.teamName} · direto{entry.eliteRegion ? " ⭐" : ""}
          </span>
        ))}
        {playIn.map((entry) => (
          <span
            key={`playin-${entry.teamId}`}
            className="border border-border bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-bone"
            title={`${entry.teamName} · ${entry.region} #${entry.seed} · ${entry.regionSlots} vaga(s) ${plan.tournament === "worlds" ? "Worlds" : "MSI"}`}
          >
            {entry.teamTag || entry.teamName} · play-in
          </span>
        ))}
        {out.map((entry) => (
          <span
            key={`out-${entry.teamId}`}
            className="border border-border/60 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground line-through"
            title={`${entry.teamName} · ${entry.region} #${entry.seed}`}
          >
            {entry.teamTag || entry.teamName} · fora
          </span>
        ))}
      </div>
    </div>
  );
}

function phaseSummary(p: DraftPhase): string {
  const isPlayIn = isPlayInPhaseName(p.name);
  if (p.config.kind === "groups") {
    const c = p.config;
    return `${c.groupCount} grupo(s) · ${c.doubleRoundRobin ? "ida e volta" : "turno único"} · Bo${c.bestOf} · top ${c.qualifiersPerGroup} classifica`;
  }
  if (p.config.kind === "swiss") {
    const c = p.config;
    return `${c.winsToAdvance}V classifica / ${c.lossesToEliminate}D elimina · Bo${c.defaultBestOf}`;
  }
  const hasManualRounds =
    p.config.custom &&
    (p.config.custom.upper.length > 0 ||
      p.config.custom.lower.length > 0 ||
      p.config.custom.grandFinal);
  const isManual = p.config.mode === "custom" && hasManualRounds;
  if (isManual && p.config.custom) {
    const c = p.config.custom;
    const total =
      c.upper.reduce((a, r) => a + r.matches, 0) +
      c.lower.reduce((a, r) => a + r.matches, 0) +
      (c.grandFinal ? 1 : 0);
    return `chave manual · ${c.upper.length} rodada(s) superior · ${c.lower.length} inferior · ${total} confronto(s)`;
  }
  const playInPrefix = isPlayIn ? "Play-in · " : "";
  return `${playInPrefix}${p.config.type === "single" ? "eliminação simples" : "eliminação dupla"} · vagas ajustadas automaticamente · final Bo${p.config.finalBestOf}${p.config.type === "double" && p.config.bracketReset ? " · com reset" : ""}`;
}

function TeamsList({
  teams,
  game,
  champName,
  accent,
  showRegionalSeedingHint,
  onAiImport,
  addTeam,
  updateTeam,
  removeTeam,
}: {
  teams: Team[];
  game: GameId;
  champName?: string;
  accent: "gold" | "blood";
  showRegionalSeedingHint: boolean;
  onAiImport: (teams: Team[]) => void;
  addTeam: () => void;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  removeTeam: (id: string) => void;
}) {
  const toDataUrl = useFileToDataUrl();

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        {showRegionalSeedingHint ? (
          <p className="border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
            Informe a região de cada time (LCK, LPL, LEC, LCS, CBLOL...) para separar classificados
            diretos e participantes do play-in.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <AiTeamImport game={game} onImport={onAiImport} />
          </div>
          <div className="flex-1">
            <ImportLeagueTeams
              game={game}
              currentChampName={champName}
              onImport={onAiImport}
              currentTeamNames={teams.map((t) => t.name)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <ImportFromRanking
              game={game}
              onImport={onAiImport}
              currentTeamNames={teams.map((t) => t.name)}
            />
          </div>
        </div>
      </div>
      <div className="border-2 border-ink bg-card">
        <div className="border-b-2 border-ink bg-ink px-4 py-2">
          <div className="flex items-center justify-between">
            <span
              className={`font-display text-lg uppercase tracking-widest ${accent === "gold" ? "text-gold" : "text-blood"}`}
            >
              Times ({teams.length})
            </span>
            <button
              type="button"
              onClick={addTeam}
              className="flex items-center gap-2 border-2 border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/20"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>
        </div>
        <div className="p-4">
          {teams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum time adicionado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {teams.map((team, idx) => (
                <TeamEditor
                  key={team.id}
                  team={team}
                  index={idx}
                  accent={accent}
                  onUpdate={updateTeam}
                  onRemove={removeTeam}
                  toDataUrl={toDataUrl}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamEditor({
  team,
  index,
  accent,
  onUpdate,
  onRemove,
  toDataUrl,
}: {
  team: Team;
  index: number;
  accent: "gold" | "blood";
  onUpdate: (id: string, patch: Partial<Team>) => void;
  onRemove: (id: string) => void;
  toDataUrl: (file: File) => Promise<string>;
}) {
  const isA = accent === "gold";
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
    const dataUrl = await toDataUrl(file);
    onUpdate(team.id, { logo: dataUrl });
  };

  return (
    <li className="flex items-center gap-3 border-2 border-border bg-black/30 p-2">
      <span className="font-display text-xl text-muted-foreground">{index + 1}.</span>
      <label className="flex-shrink-0 cursor-pointer">
        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
        <div
          className={`h-10 w-10 rounded border-2 ${team.logo || preview ? "" : "border-dashed border-border"}`}
          style={{
            backgroundImage: team.logo || preview ? `url(${preview || team.logo})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </label>
      <div className="flex-1 min-w-0 space-y-1.5">
        <input
          type="text"
          placeholder="Nome do time"
          value={team.name}
          onChange={(e) => onUpdate(team.id, { name: e.target.value })}
          className="w-full border-2 border-border bg-input px-3 py-1.5 text-sm text-bone focus:border-gold focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Tag (3-4 letras)"
            maxLength={4}
            value={team.tag}
            onChange={(e) => onUpdate(team.id, { tag: e.target.value.toUpperCase() })}
            className="w-24 border-2 border-border bg-input px-3 py-1.5 text-sm text-bone focus:border-gold focus:outline-none uppercase"
          />
          <input
            type="text"
            placeholder="Região · LCK"
            title="Região do time; usada para classificar Worlds/MSI"
            value={team.region ?? ""}
            onChange={(e) => onUpdate(team.id, { region: e.target.value })}
            className="w-32 border-2 border-border bg-input px-3 py-1.5 text-sm text-bone focus:border-gold focus:outline-none"
          />
          <input
            type="color"
            value={team.color ?? "#c9a84c"}
            onChange={(e) => onUpdate(team.id, { color: e.target.value })}
            className="h-8 w-10 cursor-pointer border-none bg-transparent p-0"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(team.id)}
        className="flex-shrink-0 border-2 border-border bg-input p-1.5 text-muted-foreground hover:border-blood hover:text-blood"
        aria-label="Remover time"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function useFileToDataUrl() {
  return useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);
}

function TextField({
  label,
  type = "text",
  value,
  onChange,
  min,
  max,
  placeholder,
  required = false,
}: {
  label: string;
  type?: "text" | "number";
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-xs uppercase tracking-widest text-gold">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        placeholder={placeholder}
        required={required}
        className="w-full border-2 border-border bg-input px-3 py-2 text-sm text-bone focus:border-gold focus:outline-none"
      />
    </label>
  );
}
