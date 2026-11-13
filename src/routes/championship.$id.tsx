import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightCircle,
  ArrowRightLeft,
  BookOpen,
  CalendarPlus,
  Download,
  Globe,
  Info,
  Medal,
  Mic,
  Pencil,
  Radio,
  RotateCcw,
  Sparkles,
  Trophy,
  Upload,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Dices } from "lucide-react";
import { isInternationalChamp, useStore } from "@/lib/lol/store";
import { TransferWindowFeed } from "@/components/lol/transfer-window-feed";
import { StandingsTable } from "@/components/lol/standings";
import { PlayInClassification } from "@/components/lol/play-in-classification";
import { MatchCard } from "@/components/lol/match-card";
import { BracketView } from "@/components/lol/bracket-view";
import { EditChampionshipDialog } from "@/components/lol/edit-championship";
import { ConfirmDialog } from "@/components/lol/confirm-dialog";
import { useConfirm } from "@/components/lol/use-confirm";
import { PromotionSection } from "@/components/lol/promotion-section";
import { MomentumPanel } from "@/components/lol/momentum-panel";
import { SwissStageView } from "@/components/lol/swiss-stage-view";
import { ChampionCelebrationModal } from "@/components/lol/champion-celebration-modal";
import { LiveFinalModal } from "@/components/lol/live-final-modal";
import { PressConferenceModal } from "@/components/lol/press-conference-modal";
import { OffseasonMarketDialog } from "@/components/lol/offseason-market";
import { TeamProfileDrawer } from "@/components/lol/team-profile-drawer";
import { CountryFlag } from "@/components/lol/country-flag";
import type { GroupsConfig, Phase } from "@/lib/lol/types";
import {
  automaticPlayInAdvanceCount,
  getQualifiers,
  groupMatchRounds,
  isPhaseComplete,
  pendingSlotCount,
} from "@/lib/lol/generate";
import {
  canonicalTournamentName,
  isPlayInPhase,
  phaseTeamIdsInOrder,
  planInternationalField,
} from "@/lib/lol/international";
import { nextSeasonLabel, seriesBottomTwo } from "@/lib/lol/promotion";
import { buildLast5, simulateForMatch } from "@/lib/lol/momentum";
import { computeChampionshipAwards } from "@/lib/lol/mvp";

export const Route = createFileRoute("/championship/$id")({
  component: ChampionshipPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Campeonato não encontrado.
    </div>
  ),
});

function ChampionshipPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const {
    getChampionship,
    resetPhase,
    advanceToPhase,
    setMatchResult,
    batchSetMatchResults,
    saveChampionToHistory,
    seedPhaseTeams,
    redrawSwiss,
    championships,
    career,
    exportChampionship,
    importChampionship,
    updateChampionship,
    advanceToNextSplit,
    createNextSplit,
    advanceInternationalEdition,
  } = useStore();
  const championship = getChampionship(id);
  const isIntl = championship ? isInternationalChamp(championship) : false;
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [splitLabel, setSplitLabel] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationSeenFor, setCelebrationSeenFor] = useState<string | null>(null);
  const [offseasonOpen, setOffseasonOpen] = useState(false);
  const [liveFinalOpen, setLiveFinalOpen] = useState(false);
  const [pressConferenceOpen, setPressConferenceOpen] = useState(false);
  const [selectedTeamProfile, setSelectedTeamProfile] = useState<Team | null>(null);
  const [showAllLeagueHistory, setShowAllLeagueHistory] = useState(false);

  const [activeDivision, setActiveDivision] = useState<1 | 2>(1);

  // Confirmação no estilo do app (substitui o `confirm()` nativo do browser).
  const { confirm, confirmDialog } = useConfirm();

  // ---------- BACKUP JSON ----------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleExport = () => {
    if (!championship) {
      toast.error("Nada para exportar.");
      return;
    }
    const json = exportChampionship(championship.id);
    if (!json) {
      toast.error("Nada para exportar.");
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(championship.name || "campeonato").replace(/[^\p{L}\p{N}_-]+/gu, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado.");
  };
  const handleImportFile = async (file: File) => {
    try {
      const result = importChampionship(await file.text());
      if (result.ok) toast.success("Campeonato importado como nova edição.");
      else toast.error(result.error ?? "Arquivo inválido.");
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const handleNextEdition = async () => {
    if (!championship) return;
    const nextSeason = nextSeasonLabel(championship.season);
    const champName = champion ? champion.name : null;

    if (isIntl) {
      // Torneio Internacional (Worlds, MSI, First Stand, etc.):
      // Arquiva o campeão atual, limpa os times antigos e abre a tela de criação/configuração para puxar os classificados manualmente!
      const ok = await confirm({
        title: `Nova Edição Internacional (${nextSeason})`,
        message: champName
          ? `O campeão atual (${champName}) será gravado no Histórico permanente da competição. Os times antigos serão limpos para você puxar manualmente os novos classificados das ligas regionais!`
          : `A edição atual ainda não teve campeão definido. Ao avançar para ${nextSeason}, a edição será preparada para você puxar os novos classificados manualmente. Deseja continuar?`,
        confirmLabel: `Avançar para ${nextSeason}`,
        tone: "gold",
      });

      if (!ok) return;

      const success = advanceInternationalEdition(championship.id);
      if (success) {
        toast.success(`Edição ${nextSeason} preparada! Agora selecione os novos times classificados.`);
        navigate({
          to: "/create",
          search: {
            game: championship.game ?? "lol",
            name: championship.name,
          },
        });
      } else {
        toast.error("Não foi possível avançar a edição internacional.");
      }
      return;
    }

    // Liga Doméstica / Local (CBLOL, LCK, etc.):
    // Mantém os times da liga, evolui elencos, roda mercado autônomo e reseta a tabela para o próximo split
    const ok = await confirm({
      title: `Iniciar ${nextSeason}?`,
      message: champName
        ? `O campeão atual (${champName}) será gravado no Histórico permanente. Todos os elencos evoluirão no recesso e realizarão transferências autônomas no mercado. O formato de fases, grupos e regras será 100% preservado.`
        : `A edição atual ainda não teve campeão definido. Ao avançar para ${nextSeason}, os elencos evoluirão e os confrontos serão reiniciados mantendo exatamente o mesmo formato. Deseja continuar?`,
      confirmLabel: `Avançar para ${nextSeason}`,
      tone: "gold",
    });

    if (!ok) return;

    const success = advanceToNextSplit(championship.id);
    if (success) {
      toast.success(`Temporada ${nextSeason} iniciada! Histórico preservado.`);
      setActivePhaseId(null);
    } else {
      toast.error("Não foi possível avançar a temporada.");
    }
  };

  // Hooks precisam vir antes de qualquer return — computed do valor seguro.
  const last5 = useMemo(
    () =>
      buildLast5(
        championship
          ? activeDivision === 1
            ? championship.phases
            : (championship.serieB?.phases ?? [])
          : [],
      ),
    [championship, activeDivision],
  );

  // Histórico da LIGA: os títulos desta edição + os salvos nas outras edições
  // do mesmo campeonato (ex.: MSI 2025 aparece na página do MSI 2026). Cada
  // título continua contando UMA vez só no ranking (são campeonatos distintos).
  const leagueHistory = useMemo(() => {
    if (!championship) return [];
    const own = (activeDivision === 1 ? championship.history : championship.serieB?.history) ?? [];
    const canon = canonicalTournamentName(championship.name);
    const others = championships
      .filter((c) => c.id !== championship.id && canonicalTournamentName(c.name) === canon)
      .flatMap((c) => (activeDivision === 1 ? c.history : c.serieB?.history) ?? []);
    return [...own, ...others].sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
  }, [championships, championship, activeDivision]);

  // Mini ranking de maiores campeões: agrega TODOS os títulos da liga por
  // time (ordem cronológica descendente já vem do leagueHistory). A
  // contagem é automática — títulos, sequência vigente e dinastia
  // (>=3 títulos) aparecem sozinhas, sem registro manual.
  const championsRanking = useMemo(() => {
    const byTeam = new Map<
      string,
      {
        teamName: string;
        teamTag: string;
        teamLogo?: string;
        titles: number;
        lastSplit: string;
        lastAt: string;
        splits: string[];
      }
    >();
    for (const e of leagueHistory) {
      const key = e.teamName.trim().toLowerCase();
      const row = byTeam.get(key);
      if (!row) {
        byTeam.set(key, {
          teamName: e.teamName,
          teamTag: e.teamTag,
          teamLogo: e.teamLogo,
          titles: 1,
          lastSplit: e.splitLabel,
          lastAt: e.savedAt ?? "",
          splits: [e.splitLabel],
        });
      } else {
        row.titles += 1;
        row.splits.push(e.splitLabel);
        // A primeira entrada vista é a mais recente (lista ordenada desc):
        // só completa o logo se faltar.
        if (!row.teamLogo && e.teamLogo) row.teamLogo = e.teamLogo;
      }
    }
    // Sequência VIGENTE: títulos seguidos contando do mais recente pra trás.
    const streakOf = (key: string) => {
      let n = 0;
      for (const e of leagueHistory) {
        if (e.teamName.trim().toLowerCase() === key) n++;
        else if (n > 0) break;
      }
      return n;
    };
    return Array.from(byTeam.entries())
      .map(([key, row]) => ({ ...row, key, streak: streakOf(key) }))
      .sort(
        (a, b) =>
          b.titles - a.titles ||
          b.lastAt.localeCompare(a.lastAt) ||
          a.teamName.localeCompare(b.teamName),
      );
  }, [leagueHistory]);

  // Topo do ranking + alerta de dinastia (automático: >=3 títulos).
  const topChampion = championsRanking[0];
  const dynasty =
    topChampion && topChampion.titles >= 3
      ? {
          ...topChampion,
          label:
            topChampion.streak >= 2
              ? `${topChampion.titles} títulos · ${topChampion.streak} seguidos`
              : `${topChampion.titles} títulos`,
        }
      : null;

  // Todas as edições com o mesmo nome vivem na mesma "janela" visual. A
  // edição mais recente é aberta pela home; as anteriores ficam arquivadas e
  // podem ser consultadas sem aparecerem como cards duplicados.
  const editions = useMemo(() => {
    if (!championship) return [];
    const canon = canonicalTournamentName(championship.name);
    return championships
      .filter(
        (c) =>
          c.id !== championship.id &&
          (c.game ?? "lol") === (championship.game ?? "lol") &&
          canonicalTournamentName(c.name) === canon,
      )
      .concat(championship)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [championships, championship]);

  // ---------- CÁLCULOS MEMOIZADOS (antes do early return) ----------
  // As divisões são COMPLETEMENTE separadas: cada aba lê apenas o próprio
  // conjunto de times e fases. Nada da Série B aparece na Série A e vice-versa.
  const divPhases = useMemo(
    () =>
      championship
        ? activeDivision === 1
          ? championship.phases
          : (championship.serieB?.phases ?? [])
        : [],
    [championship, activeDivision],
  );
  const divTeams = useMemo(
    () =>
      championship
        ? activeDivision === 1
          ? championship.teams
          : (championship.serieB?.teams ?? [])
        : [],
    [championship, activeDivision],
  );

  const phaseIdResolved =
    activePhaseId && divPhases.some((p) => p.id === activePhaseId)
      ? activePhaseId
      : divPhases[0]?.id;
  const phaseResolved = divPhases.find((p) => p.id === phaseIdResolved);
  const phaseIndexResolved = divPhases.findIndex((p) => p.id === phaseIdResolved);
  const prevPhaseResolved = phaseIndexResolved > 0 ? divPhases[phaseIndexResolved - 1] : undefined;
  const prevIdsResolved = prevPhaseResolved ? phaseTeamIdsInOrder(prevPhaseResolved) : [];
  const qualifierLimitResolved =
    prevPhaseResolved?.advanceCount ??
    (prevPhaseResolved && isPlayInPhase(prevPhaseResolved)
      ? automaticPlayInAdvanceCount(prevIdsResolved.length)
      : undefined);

  // Classificados da fase anterior — antes recalculado a CADA render (o
  // `getQualifiers` reconstrói a classificação completa da chave).
  const previousQualified = useMemo(
    () => (prevPhaseResolved ? getQualifiers(prevPhaseResolved, qualifierLimitResolved) : []),
    [prevPhaseResolved, qualifierLimitResolved],
  );

  // Vagas RESERVADAS para o classificado do play-in (Worlds/MSI): o evento
  // principal começa em paralelo ao play-in, com a vaga marcada como TBD.
  const reservedSlots = useMemo(
    () => (phaseResolved ? pendingSlotCount(phaseResolved.matches) : 0),
    [phaseResolved],
  );

  // Classificação do play-in internacional: quem classifica e quem é
  // eliminado (o play-in é fase de ELIMINAÇÃO — quem não passa fica fora).
  // Só é definitiva quando o play-in ACABOU: no meio da fase a ordem por
  // vitórias ainda pode virar (e no GSL o winner da chave ainda joga a
  // partida de classificação), então não se marca ninguém antes da hora.
  const playInClassification = useMemo(() => {
    const map: Record<string, "qualified" | "eliminated"> = {};
    if (!phaseResolved?.internationalPlayIn || phaseResolved.skipped) return map;
    if (!isPhaseComplete(phaseResolved)) return map;
    const limit = phaseResolved.advanceCount ?? 0;
    const qualified = getQualifiers(phaseResolved, limit);
    const qualifiedSet = new Set(qualified);
    for (const id of qualified) map[id] = "qualified";
    for (const id of phaseTeamIdsInOrder(phaseResolved)) {
      if (!qualifiedSet.has(id)) map[id] = "eliminated";
    }
    return map;
  }, [phaseResolved]);

  // Plano internacional (Worlds/MSI): classifica regiões, vagas e seeds.
  // Era o cálculo mais caro da página e rodava a cada render.
  const intlPlan = useMemo(() => {
    if (!championship || divPhases.length < 2) return null;
    return planInternationalField({
      teams: divTeams,
      phases: divPhases,
      game: championship.game ?? "lol",
      career,
      fallbackRegion: championship.region,
      championshipName: championship.name,
    });
  }, [championship, divPhases, divTeams, career]);

  if (!championship) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const hasSecondDivision = !!championship.hasSecondDivision;

  const poolPhases = divPhases;
  const poolTeams = divTeams;

  const currentPhaseId = phaseIdResolved;
  const currentPhase = phaseResolved;
  const currentPhaseIndex = phaseIndexResolved;
  const previousPhase = prevPhaseResolved;
  const targetIds = currentPhase ? phaseTeamIdsInOrder(currentPhase) : [];
  const previousIds = prevIdsResolved;
  const qualifierLimit = qualifierLimitResolved;
  // Partidas já jogadas com resultado real (não bye) na fase alvo.
  const hasRealTargetResult =
    !!currentPhase && currentPhase.matches.some((m) => m.winnerId && !m.bye);

  // O pull só é bloqueado por falta de vaga reservada se a fase alvo JÁ começou a ser jogada,
  // pois refazer a chave apagaria confrontos jogados. Se ainda não foi jogada (ou se for fase suíça),
  // os classificados entram perfeitamente via re-seeding!
  const pullBlockedByMissingReserved =
    !!previousPhase?.internationalPlayIn &&
    !previousPhase.skipped &&
    reservedSlots === 0 &&
    hasRealTargetResult;
  const previousReady =
    !!previousPhase &&
    isPhaseComplete(previousPhase) &&
    !pullBlockedByMissingReserved &&
    // No play-in internacional a contagem vem do próprio formato: basta haver
    // classificado (o número de vagas é o que o formato definiu). Nas outras
    // fases vale a cota da fase (suíça/grupo).
    (previousPhase.internationalPlayIn
      ? previousQualified.length > 0
      : previousQualified.length >= (qualifierLimit ?? 1));
  const missingQualifiers =
    previousReady && previousQualified.some((teamId) => !targetIds.includes(teamId));
  const targetEmpty = !!currentPhase && currentPhase.matches.every((m) => !m.teamAId && !m.teamBId);
  const needsSeeding =
    !!currentPhase && currentPhaseIndex > 0 && (targetEmpty || missingQualifiers);
  // Primeira fase da série que ainda não tem os times dela dentro: pode ser
  // uma fase nova (vazia) ou uma fase "fantasma" migrada da versão antiga,
  // cujos confrontos referenciam times de outra série. Nas duas situações,
  // oferecemos preencher com os times da própria série.
  const currentPhasePlan = currentPhaseIndex === 0 ? intlPlan : null;
  const expectedFirstPhaseIds = currentPhasePlan?.active
    ? currentPhasePlan.playInTeamIds
    : poolTeams.map((team) => team.id);
  const currentPhaseTeamIds = currentPhase ? phaseTeamIdsInOrder(currentPhase) : [];
  const hasExpectedFirstPhaseTeams = expectedFirstPhaseIds.every((teamId) =>
    currentPhaseTeamIds.includes(teamId),
  );
  const hasLaterPhaseResults = poolPhases
    .slice(1)
    .some((phase) => phase.matches.some((match) => match.winnerId));
  const canSeedFirstPhase =
    currentPhase &&
    currentPhaseIndex === 0 &&
    poolTeams.length >= 2 &&
    (!currentPhasePlan?.active || expectedFirstPhaseIds.length > 0) &&
    (!hasExpectedFirstPhaseTeams || currentPhase.matches.every((m) => !m.teamAId && !m.teamBId));
  const canReseedPlayIn =
    !!currentPhase &&
    currentPhaseIndex === 0 &&
    poolPhases.length > 1 &&
    poolTeams.length >= 2 &&
    isPlayInPhase(currentPhase);

  const champion = (() => {
    // Campeão da série que está sendo vista (A ou B, independentes) — a busca
    // inclui times arquivados: quem saiu do elenco continua sendo o campeão
    // daquela edição.
    const lookup = [...poolTeams, ...(championship.formerTeams ?? [])];
    const finalPhase = poolPhases[poolPhases.length - 1];
    if (finalPhase?.kind !== "bracket") return null;
    const last = [...finalPhase.matches].sort((a, b) => {
      const pA =
        a.bracketSide === "reset" ? 4 : a.bracketSide === "grand" ? 3 : !a.nextMatchId ? 2 : 0;
      const pB =
        b.bracketSide === "reset" ? 4 : b.bracketSide === "grand" ? 3 : !b.nextMatchId ? 2 : 0;
      if (pA !== pB) return pB - pA;
      return (b.round ?? 0) - (a.round ?? 0);
    })[0];
    if (!last?.winnerId) return null;
    return lookup.find((t) => t.id === last.winnerId) ?? null;
  })();

  const runnerUp = useMemo(() => {
    if (!champion) return undefined;
    const finalPhase = poolPhases[poolPhases.length - 1];
    if (finalPhase?.kind !== "bracket") return undefined;
    const last = [...finalPhase.matches].sort((a, b) => {
      const pA =
        a.bracketSide === "reset" ? 4 : a.bracketSide === "grand" ? 3 : !a.nextMatchId ? 2 : 0;
      const pB =
        b.bracketSide === "reset" ? 4 : b.bracketSide === "grand" ? 3 : !b.nextMatchId ? 2 : 0;
      if (pA !== pB) return pB - pA;
      return (b.round ?? 0) - (a.round ?? 0);
    })[0];
    if (!last?.winnerId || !last.teamAId || !last.teamBId) return undefined;
    const runnerUpId = last.winnerId === last.teamAId ? last.teamBId : last.teamAId;
    const lookup = [...poolTeams, ...(championship.formerTeams ?? [])];
    return lookup.find((t) => t.id === runnerUpId);
  }, [champion, poolPhases, poolTeams, championship.formerTeams]);

  const finalDecisiveMatch = useMemo(() => {
    const finalPhase = poolPhases[poolPhases.length - 1];
    if (finalPhase?.kind !== "bracket") return undefined;
    const last = [...finalPhase.matches].sort((a, b) => {
      const pA =
        a.bracketSide === "reset" ? 4 : a.bracketSide === "grand" ? 3 : !a.nextMatchId ? 2 : 0;
      const pB =
        b.bracketSide === "reset" ? 4 : b.bracketSide === "grand" ? 3 : !b.nextMatchId ? 2 : 0;
      if (pA !== pB) return pB - pA;
      return (b.round ?? 0) - (a.round ?? 0);
    })[0];
    return last?.winnerId ? last : undefined;
  }, [poolPhases]);

  const finalMvp = finalDecisiveMatch?.mvp;
  const seasonAwards = useMemo(
    () => computeChampionshipAwards(championship, activeDivision),
    [championship, activeDivision],
  );

  useEffect(() => {
    if (champion && celebrationSeenFor !== champion.id) {
      setShowCelebration(true);
      setCelebrationSeenFor(champion.id);
    }
  }, [champion, celebrationSeenFor]);

  // Elenco + arquivados: confrontos antigos continuam mostrando quem jogou
  // (o seletor ⇄ continua oferecendo só quem está no elenco).
  const matchLookupTeams = [...poolTeams, ...(championship.formerTeams ?? [])];

  // Detecta se a Grande Final da série atual já está pronta e aguardando campeão
  const readyGrandFinal = useMemo(() => {
    const finalPhase = poolPhases[poolPhases.length - 1];
    if (!finalPhase || finalPhase.kind !== "bracket" || currentPhase?.id !== finalPhase.id) {
      return null;
    }
    const last = [...finalPhase.matches].sort((a, b) => {
      const pA =
        a.bracketSide === "reset" ? 4 : a.bracketSide === "grand" ? 3 : !a.nextMatchId ? 2 : 0;
      const pB =
        b.bracketSide === "reset" ? 4 : b.bracketSide === "grand" ? 3 : !b.nextMatchId ? 2 : 0;
      return pB - pA || (b.round ?? 0) - (a.round ?? 0);
    })[0];
    if (!last || last.winnerId || !last.teamAId || !last.teamBId) return null;
    const teamA = matchLookupTeams.find((t) => t.id === last.teamAId);
    const teamB = matchLookupTeams.find((t) => t.id === last.teamBId);
    if (!teamA || !teamB) return null;
    return { phaseId: finalPhase.id, match: last, teamA, teamB };
  }, [poolPhases, currentPhase?.id, matchLookupTeams]);

  const divisionLabel = activeDivision === 1 ? "A" : "B";

  return (
    <div className="min-h-screen">
      <ConfirmDialog {...confirmDialog} />
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Todos os campeonatos
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleNextEdition}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-gold/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/30 shadow-sm"
              title={
                isIntl
                  ? "Arquiva o campeão atual no histórico, remove os times da edição anterior e puxa os novos classificados das ligas regionais mantendo o formato oficial exato!"
                  : "Avança esta liga para o próximo split: arquiva o campeão no histórico, roda mercado autônomo, evolui elencos e mantém 100% do formato!"
              }
            >
              {isIntl ? (
                <>
                  <Globe className="h-3.5 w-3.5" /> Nova Edição Internacional
                </>
              ) : (
                <>
                  <CalendarPlus className="h-3.5 w-3.5" /> Próximo Split
                </>
              )}
            </button>
            {!isIntl ? (
              <button
                type="button"
                onClick={() => setOffseasonOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
                title="Consultar elencos, orçamentos e histórico da janela de transferências"
              >
                <ArrowRightLeft className="h-3 w-3" /> Elencos &amp; Mercado
              </button>
            ) : null}
            {champion ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowCelebration(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-gold px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-gold/90 shadow-md"
                  title="Ver celebração do campeão, line-up e baixar pôster"
                >
                  <Sparkles className="h-3 w-3" /> Celebração & Pôster
                </button>
                {runnerUp && finalDecisiveMatch ? (
                  <button
                    type="button"
                    onClick={() => setPressConferenceOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-gold/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/30 shadow-sm"
                    title="Abrir Coletiva de Imprensa Pós-Título e Pós-Vice"
                  >
                    <Mic className="h-3.5 w-3.5" /> Coletiva Pós-Título
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSplitLabel(championship.season ?? "");
                    setSavingHistory(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
                >
                  <Medal className="h-3 w-3" /> Salvar no Histórico
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              type="button"
              onClick={handleExport}
              title="Baixar backup em JSON"
              aria-label="Exportar campeonato em JSON"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Download className="h-3 w-3" /> JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Importar campeonato de um backup JSON"
              aria-label="Importar campeonato de JSON"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Upload className="h-3 w-3" /> Importar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
          </div>
        </div>
      </header>

      {/* Save to History Dialog */}
      {savingHistory && champion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border-2 border-gold bg-card p-6">
            <h3 className="mb-1 flex items-center gap-2 font-display text-2xl uppercase tracking-wider text-gold">
              <Medal className="h-5 w-5" /> Salvar no Histórico
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              O campeão <span className="font-bold text-bone">{champion.name}</span> será registrado
              permanentemente no histórico
              {hasSecondDivision ? ` da Série ${divisionLabel}` : " desta liga"}.
            </p>
            <label className="mb-4 block">
              <span className="mb-1 block font-display text-xs uppercase tracking-widest text-gold">
                Nome do Split / Temporada
              </span>
              <input
                className="w-full border-2 border-border bg-input px-3 py-2 text-bone focus:border-gold focus:outline-none"
                placeholder="Ex: 2026 Split 1"
                value={splitLabel}
                onChange={(e) => setSplitLabel(e.target.value)}
                autoFocus
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  saveChampionToHistory(
                    championship.id,
                    {
                      teamName: champion.name,
                      teamTag: champion.tag,
                      teamLogo: champion.logo,
                      splitLabel:
                        (splitLabel.trim() || "Split Sem Nome") +
                        (activeDivision === 2 ? " (Série B)" : ""),
                    },
                    activeDivision,
                  );
                  setSavingHistory(false);
                  setSplitLabel("");
                }}
                className="flex-1 border-2 border-gold bg-gold py-2 font-display text-lg uppercase tracking-widest text-ink hover:bg-gold/90"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setSavingHistory(false)}
                className="border-2 border-border bg-input px-4 py-2 font-display text-sm uppercase tracking-widest text-muted-foreground hover:border-blood hover:text-blood"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <EditChampionshipDialog championship={championship} onClose={() => setEditing(false)} />
      ) : null}

      <section
        className="border-b border-border/60"
        style={{
          background: `linear-gradient(180deg, ${championship.accentColor ?? "oklch(0.28 0.06 240)"}22 0%, transparent 100%)`,
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center gap-4">
            {championship.logo ? (
              <img
                src={championship.logo}
                alt=""
                className="h-16 w-16 shrink-0 rounded-sm object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              />
            ) : null}
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <h1
                  className="font-display text-4xl font-bold uppercase tracking-tight text-foreground"
                  style={{ color: championship.accentColor }}
                >
                  {championship.name}
                </h1>
                <span className="text-sm uppercase tracking-widest text-muted-foreground">
                  {championship.region} · {championship.season}
                </span>
              </div>
            </div>
          </div>

          {hasSecondDivision ? (
            <div className="mt-6 flex border-b border-border">
              <button
                type="button"
                onClick={() => {
                  setActiveDivision(1);
                  setActivePhaseId(null);
                }}
                className={`px-4 py-2 font-display text-sm uppercase tracking-widest transition-colors ${
                  activeDivision === 1
                    ? "border-b-2 border-gold text-gold"
                    : "text-muted-foreground hover:text-bone"
                }`}
              >
                1ª Divisão (Série A) · {championship.teams.length} times
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDivision(2);
                  setActivePhaseId(null);
                }}
                className={`px-4 py-2 font-display text-sm uppercase tracking-widest transition-colors ${
                  activeDivision === 2
                    ? "border-b-2 border-blood text-blood"
                    : "text-muted-foreground hover:text-bone"
                }`}
              >
                2ª Divisão (Série B) · {championship.serieB?.teams.length ?? 0} times
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-1">
            {poolPhases.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePhaseId(p.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  p.id === currentPhaseId
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {p.name}
                {p.skipped ? (
                  <span className="ml-1.5 text-[9px] uppercase opacity-70">dispensada</span>
                ) : null}
                {p.internationalPlayIn && !p.skipped ? (
                  <span className="ml-1.5 text-[9px] uppercase opacity-70">0 pts</span>
                ) : null}
              </button>
            ))}
            {poolPhases.length === 0 ? (
              <span className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                Nenhuma fase nesta série — adicione em Editar
              </span>
            ) : null}
          </div>
          {editions.length > 1 ? (
            <div className="mt-5 border-t border-gold/20 pt-4">
              <div className="mb-2 flex items-center gap-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-gold" />
                Edições deste campeonato
              </div>
              <div className="flex flex-wrap gap-2">
                {editions.map((edition, index) => (
                  <Link
                    key={edition.id}
                    to="/championship/$id"
                    params={{ id: edition.id }}
                    className={`border px-3 py-1.5 font-display text-xs uppercase tracking-widest transition-colors ${
                      edition.id === championship.id
                        ? "border-gold bg-gold text-ink"
                        : "border-border bg-black/30 text-muted-foreground hover:border-gold/60 hover:text-gold"
                    }`}
                  >
                    {index === 0 ? "Atual · " : "Arquivo · "}
                    {edition.season || `Edição ${editions.length - index}`}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {currentPhase ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold uppercase tracking-wider text-foreground">
                  {currentPhase.name}
                </h2>
                {hasSecondDivision ? (
                  <span
                    className={`mt-0.5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest ${
                      activeDivision === 1 ? "text-gold" : "text-blood"
                    }`}
                  >
                    {activeDivision === 1 ? "▲ 1ª Divisão — Série A" : "▼ 2ª Divisão — Série B"}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {readyGrandFinal ? (
                  <button
                    type="button"
                    onClick={() => setLiveFinalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blood bg-blood px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-blood/90"
                    title="Transmitir e simular a Grande Final ao vivo mapa a mapa"
                  >
                    <Radio className="h-3.5 w-3.5 animate-pulse" /> Simular Grande Final Ao Vivo ({readyGrandFinal.teamA.tag} × {readyGrandFinal.teamB.tag})
                  </button>
                ) : null}
                {canSeedFirstPhase && !currentPhasePlan?.active ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const hasResults = currentPhase.matches.some((match) => match.winnerId);
                      if (hasResults || hasLaterPhaseResults) {
                        const ok = await confirm({
                          title: "Refazer a primeira fase?",
                          message:
                            "Os confrontos e resultados das fases seguintes também serão apagados.",
                          confirmLabel: "Refazer",
                        });
                        if (!ok) return;
                      }
                      seedPhaseTeams(championship.id, currentPhase.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:opacity-90"
                  >
                    <Users className="h-3 w-3" /> Preencher com os {expectedFirstPhaseIds.length}{" "}
                    times da Série {divisionLabel}
                  </button>
                ) : null}
                {currentPhasePlan?.active && (canSeedFirstPhase || canReseedPlayIn) ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Reorganizar o play-in?",
                        message:
                          "Recalcula as vagas do Hall da Fama, os grupos do play-in e as vagas reservadas do evento principal. Os confrontos e resultados desta fase e das seguintes serão refeitos.",
                        confirmLabel: "Reorganizar",
                        tone: "gold",
                      });
                      if (ok) seedPhaseTeams(championship.id, currentPhase.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
                    title="Recalcula as vagas do Hall da Fama, os grupos do play-in e as vagas reservadas do evento principal"
                  >
                    <Users className="h-3 w-3" /> Reorganizar play-in
                  </button>
                ) : null}
                {currentPhaseIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => advanceToPhase(championship.id, currentPhase.id)}
                    disabled={!previousReady}
                    title={
                      previousReady
                        ? `Levar os ${previousQualified.length} classificado(s) para esta fase`
                        : pullBlockedByMissingReserved
                          ? "Esta fase já possui resultados jogados e não tem vagas reservadas do play-in"
                          : previousPhase?.internationalPlayIn
                            ? "Conclua o play-in (todos os confrontos) para puxar os classificados"
                            : "Finalize a fase anterior primeiro"
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      needsSeeding
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-muted/30 text-muted-foreground"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <ArrowRightCircle className="h-3 w-3" /> Puxar classificados
                    {previousQualified.length > 0 ? ` (${previousQualified.length})` : ""}
                  </button>
                ) : null}
                {currentPhase.kind === "swiss" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const played = currentPhase.matches.some((m) => m.winnerId);
                      if (played) {
                        const ok = await confirm({
                          title: "Re-sortear os confrontos?",
                          message: "Os resultados desta fase serão descartados.",
                          confirmLabel: "Sortear de novo",
                          tone: "gold",
                        });
                        if (!ok) return;
                      }
                      redrawSwiss(championship.id, currentPhase.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
                  >
                    <Dices className="h-3 w-3" /> Sortear confrontos
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Resetar todos os resultados desta fase?",
                      message:
                        "Placar, evolução dos jogadores e a forma acumulada NESTA fase voltam ao estado anterior.",
                      confirmLabel: "Resetar fase",
                    });
                    if (ok) resetPhase(championship.id, currentPhase.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
                >
                  <RotateCcw className="h-3 w-3" /> Resetar fase
                </button>
              </div>
            </div>

            <RoundSimulator
              phase={currentPhase}
              onSimulate={(ids) => {
                const careerTable = career[championship.game ?? "lol"];
                const batch: Array<{
                  matchId: string;
                  winnerId: string;
                  score: { a: number; b: number };
                }> = [];
                for (const m of currentPhase.matches) {
                  if (!ids.includes(m.id) || !m.teamAId || !m.teamBId || m.winnerId) continue;
                  // Simulação usa momentum + rating ELO: nível real conta.
                  const r = simulateForMatch(championship, m, careerTable);
                  const winnerId = r.a > r.b ? m.teamAId : m.teamBId;
                  batch.push({ matchId: m.id, winnerId, score: r });
                }
                if (batch.length > 0) {
                  batchSetMatchResults(championship.id, currentPhase.id, batch);
                }
              }}
            />

            {currentPhase.internationalPlayIn && !currentPhase.skipped ? (
              <div className="mb-4">
                <PlayInClassification
                  phase={currentPhase}
                  teams={poolTeams}
                  targetName={divPhases[currentPhaseIndex + 1]?.name ?? "evento principal"}
                />
              </div>
            ) : null}

            {currentPhase.kind === "groups" && currentPhase.groups
              ? (currentPhase.config as GroupsConfig).format === "gsl"
                ? currentPhase.groups.map((g) => {
                    const groupMatches = currentPhase.matches.filter((m) => m.groupId === g.id);
                    const r1 = groupMatches.filter((m) => (m.round ?? 0) === 0);
                    const wm = groupMatches.find(
                      (m) => (m.round ?? 0) === 1 && m.bracketSide === "upper",
                    );
                    const lm = groupMatches.find(
                      (m) => (m.round ?? 0) === 1 && m.bracketSide === "lower",
                    );
                    const dm = groupMatches.find((m) => (m.round ?? 0) === 2);
                    return (
                      <div
                        key={g.id}
                        className="noise-layer border-2 border-ink bg-card/40 p-4 shadow-[4px_4px_0_0_var(--blood)]"
                      >
                        <h3 className="mb-3 border-b-2 border-ink bg-blood px-3 py-1.5 font-display text-lg uppercase tracking-widest text-bone">
                          {g.name}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <div className="font-display text-[11px] uppercase tracking-widest text-gold">
                              Rodada 1
                            </div>
                            {r1.map((m) => (
                              <MatchCard
                                key={m.id}
                                championshipId={championship.id}
                                teams={poolTeams}
                                allTeams={matchLookupTeams}
                                phaseId={currentPhase.id}
                                match={m}
                                compact
                              />
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="font-display text-[11px] uppercase tracking-widest text-gold">
                              Rodada 2
                            </div>
                            {wm ? (
                              <MatchCard
                                championshipId={championship.id}
                                teams={poolTeams}
                                allTeams={matchLookupTeams}
                                phaseId={currentPhase.id}
                                match={wm}
                                compact
                              />
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <div className="font-display text-[11px] uppercase tracking-widest text-blood">
                              Chave dos Perdedores
                            </div>
                            {lm ? (
                              <MatchCard
                                championshipId={championship.id}
                                teams={poolTeams}
                                allTeams={matchLookupTeams}
                                phaseId={currentPhase.id}
                                match={lm}
                                compact
                              />
                            ) : null}
                            {dm ? (
                              <MatchCard
                                championshipId={championship.id}
                                teams={poolTeams}
                                allTeams={matchLookupTeams}
                                phaseId={currentPhase.id}
                                match={dm}
                                compact
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                : currentPhase.groups.map((g) => (
                    <div key={g.id} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
                      <StandingsTable
                        teams={poolTeams}
                        phase={currentPhase}
                        group={g}
                        qualifySlots={
                          currentPhase.config?.kind === "groups"
                            ? currentPhase.config.qualifiersPerGroup
                            : 0
                        }
                        classification={playInClassification}
                        relegateTeamIds={
                          hasSecondDivision && activeDivision === 1
                            ? seriesBottomTwo(championship.phases, championship.teams).map(
                                (t) => t.id,
                              )
                            : undefined
                        }
                        last5={last5}
                      />
                      <div className="w-full lg:w-80">
                        <div className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Partidas
                        </div>
                        <div className="grid max-h-[600px] grid-cols-1 gap-2 overflow-y-auto pr-1">
                          {currentPhase.matches
                            .filter((m) => m.groupId === g.id)
                            .map((m) => (
                              <MatchCard
                                key={m.id}
                                championshipId={championship.id}
                                teams={poolTeams}
                                allTeams={matchLookupTeams}
                                phaseId={currentPhase.id}
                                match={m}
                              />
                            ))}
                        </div>
                      </div>
                    </div>
                  ))
              : null}

            {currentPhase.internationalPlayIn ? (
              <div className="mb-4 flex items-start gap-2 border border-gold/40 bg-gold/5 px-3 py-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-display uppercase tracking-wider text-gold">
                    Play-in internacional
                  </span>
                  {currentPhase.skipped
                    ? " — nenhum time entrou na disputa. Fase dispensada: todos seguem direto para o evento principal."
                    : ` — disputam o play-in: nas regiões fora do top 2 do ranking do Hall da Fama, o pior seed de cada região (região com 1 vaga vai direto pro play-in). As 2 melhores regiões (${(intlPlan?.playInExemptRegions ?? []).join(", ") || "—"}) são isentas: todos os times delas vão direto. As vagas em disputa completam o evento principal (${intlPlan?.mainTargetSlots ?? 0} vagas no total, soma das vagas do Hall da Fama por região). Não vale pontos, ELO nem histórico no Hall da Fama.`}
                </p>
              </div>
            ) : null}

            {currentPhase.internationalPlayIn &&
            currentPhase.groups &&
            currentPhase.groups.length > 1 &&
            currentPhase.groups.every((g) => g.teamIds.length <= 2) ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-amber-500/50 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-xs leading-relaxed text-amber-200">
                    <span className="font-display font-semibold uppercase tracking-wider text-amber-300">
                      Formato antigo com poucos jogos detectado:
                    </span>{" "}
                    os times foram divididos em grupos de 2 times (apenas 1 confronto cada). Clique para colocar todos os times em Grupo Único onde todos se enfrentam!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Reorganizar para Grupo Único?",
                      message:
                        "Todos os times se enfrentarão em turno único (confrontos todos contra todos). Os confrontos desta fase serão refeitos.",
                      confirmLabel: "Reorganizar agora",
                      tone: "gold",
                    });
                    if (ok) seedPhaseTeams(championship.id, currentPhase.id);
                  }}
                  className="shrink-0 rounded border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/30"
                >
                  Colocar todos contra todos
                </button>
              </div>
            ) : null}

            {previousPhase?.internationalPlayIn && reservedSlots === 0 && !currentPhase.skipped && hasRealTargetResult ? (
              <div className="mb-4 flex items-start gap-2 border border-blood/50 bg-blood/5 px-3 py-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blood" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-display uppercase tracking-wider text-blood">
                    Sem vagas reservadas
                  </span>
                  {" — esta fase já possui resultados jogados e foi montada sem as vagas do play-in. Volte à fase do play-in e clique em "}
                  <span className="font-display uppercase tracking-wider text-gold">
                    Reorganizar play-in
                  </span>
                  {" para recalcular o formato (isso apaga os resultados do play-in)."}
                </p>
              </div>
            ) : null}

            {reservedSlots > 0 ? (
              <div className="mb-4 flex items-start gap-2 border border-gold/40 bg-gold/5 px-3 py-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-display uppercase tracking-wider text-gold">
                    Vaga do play-in
                  </span>{" "}
                  — {reservedSlots} vaga(s) deste evento estão reservadas para o classificado do
                  play-in. Os diretos já jogam em paralelo; o classificado entra na vaga assim que o
                  play-in terminar.
                </p>
              </div>
            ) : null}

            {currentPhase.kind === "bracket" && currentPhase.skipped ? (
              <div className="border border-dashed border-border bg-black/20 p-8 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
                Fase dispensada — nenhum time inscrito.
              </div>
            ) : null}

            {currentPhase.kind === "bracket" && !currentPhase.skipped ? (
              <BracketView
                championshipId={championship.id}
                teams={poolTeams}
                allTeams={matchLookupTeams}
                phase={currentPhase}
              />
            ) : null}

            {currentPhase.kind === "swiss" ? (
              <SwissStageView
                championship={championship}
                phase={currentPhase}
                teams={poolTeams}
                renderMatch={(matchId) => {
                  const m = currentPhase.matches.find((x) => x.id === matchId);
                  if (!m) return null;
                  return (
                    <MatchCard
                      championshipId={championship.id}
                      teams={poolTeams}
                      allTeams={matchLookupTeams}
                      phaseId={currentPhase.id}
                      match={m}
                    />
                  );
                }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Prêmios da Temporada: MVP do Split & Seleção All-Pro */}
        {seasonAwards.hasMatches && seasonAwards.splitMvp ? (
          <section className="mt-10 border-t-2 border-gold/25 pt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-gold" />
                <div>
                  <h2 className="font-display text-2xl uppercase tracking-widest text-gold">
                    {seasonAwards.isCompleted
                      ? "Prêmios Oficiais da Temporada (All-Pro & MVP)"
                      : "Corrida pelo MVP & Seleção do Campeonato (Parcial)"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Eleição automática baseada em MVPs de série, vitórias da equipe, playoffs e
                    desempenho individual. Clique em qualquer time para abrir o perfil completo.
                  </p>
                </div>
              </div>
              <span
                className={`border px-3 py-1 font-display text-xs uppercase tracking-widest ${
                  seasonAwards.isCompleted
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-border bg-black/40 text-muted-foreground"
                }`}
              >
                {seasonAwards.isCompleted ? "🏆 Premiação Finalizada" : "Em Disputa"}
              </span>
            </div>

            {/* Card Principal do MVP do Split */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-2 border-gold bg-[radial-gradient(ellipse_at_left,rgba(212,175,55,0.18),transparent_70%)] bg-card p-5 shadow-[4px_4px_0_0_var(--gold)]">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center border-2 border-gold bg-gold font-display text-ink">
                  <Trophy className="h-6 w-6" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">MVP</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink">
                      {seasonAwards.splitMvp.role.toUpperCase()}
                    </span>
                    <CountryFlag code={seasonAwards.splitMvp.country} size="md" />
                    <span className="font-display text-2xl uppercase tracking-wider text-bone sm:text-3xl">
                      {seasonAwards.splitMvp.ign}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const found = matchLookupTeams.find(
                          (t) => t.id === seasonAwards.splitMvp?.teamId,
                        );
                        if (found) setSelectedTeamProfile(found);
                      }}
                      className="border border-gold/50 bg-black/50 px-2.5 py-0.5 font-display text-xs uppercase tracking-wider text-gold hover:bg-gold hover:text-ink"
                    >
                      {seasonAwards.splitMvp.teamName} ({seasonAwards.splitMvp.teamTag})
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {seasonAwards.splitMvp.real ? `${seasonAwards.splitMvp.real} · ` : ""}
                    Overall <strong className="text-gold">{seasonAwards.splitMvp.overall}</strong> ·{" "}
                    <strong className="text-bone">{seasonAwards.splitMvp.mvpCount}×</strong> MVP de
                    Série · <strong className="text-bone">{seasonAwards.splitMvp.teamWins}</strong>{" "}
                    vitórias na competição
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gold">
                  Pontuação All-Pro
                </div>
                <div className="font-display text-3xl text-gold">
                  {seasonAwards.splitMvp.score}
                </div>
              </div>
            </div>

            {/* Seleção do Campeonato (5 Rotas: TOP, JG, MID, ADC, SUP) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(["top", "jungle", "mid", "adc", "support"] as const).map((role) => {
                const w = seasonAwards.allPro[role];
                const roleLabel =
                  role === "top"
                    ? "TOP LANER"
                    : role === "jungle"
                      ? "JUNGLER"
                      : role === "mid"
                        ? "MID LANER"
                        : role === "adc"
                          ? "BOT / ADC"
                          : "SUPPORT";
                return (
                  <div
                    key={role}
                    className="flex flex-col justify-between border-2 border-ink bg-card p-3.5 shadow-[3px_3px_0_0_var(--gold)]"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-gold">
                          {roleLabel}
                        </span>
                        {w ? (
                          <span className="font-display text-sm font-bold text-gold">
                            {w.overall} OVR
                          </span>
                        ) : null}
                      </div>
                      {w ? (
                        <div className="mt-2.5">
                          <div className="flex items-center gap-2">
                            <CountryFlag code={w.country} size="sm" />
                            <span className="font-display text-xl uppercase tracking-wide text-bone">
                              {w.ign}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const found = matchLookupTeams.find((t) => t.id === w.teamId);
                              if (found) setSelectedTeamProfile(found);
                            }}
                            className="mt-0.5 text-left text-xs font-semibold text-gold hover:underline"
                          >
                            {w.teamName}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">A definir</div>
                      )}
                    </div>
                    {w ? (
                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{w.mvpCount} MVPs</span>
                        <span>{w.teamWins} Vitórias</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Histórico da série (A ou B, separados) + ranking de maiores campeões */}
        {leagueHistory.length > 0 ? (
          <section className="mt-10 border-t-2 border-gold/20 pt-8">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <BookOpen className="h-5 w-5 text-gold" />
              <h2 className="font-display text-2xl uppercase tracking-widest text-gold">
                Histórico{hasSecondDivision ? ` — Série ${divisionLabel}` : " da Liga"}
              </h2>
              <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                {leagueHistory.length} título(s) registrado(s)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(showAllLeagueHistory ? leagueHistory : leagueHistory.slice(0, 6)).map((entry, i) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 border-2 border-ink bg-card p-3 shadow-[3px_3px_0_0_var(--gold)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center font-display text-2xl font-bold text-gold/60">
                        #{i + 1}
                      </div>
                      {entry.teamLogo ? (
                        <img
                          src={entry.teamLogo}
                          alt=""
                          className="h-10 w-10 shrink-0 object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blood font-display text-sm font-bold text-bone">
                          {entry.teamTag.slice(0, 3)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-gold" />
                          <span className="truncate font-display text-base uppercase tracking-wide text-bone">
                            {entry.teamName}
                          </span>
                        </div>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">
                          {entry.splitLabel}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {leagueHistory.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllLeagueHistory((prev) => !prev)}
                    className="mt-3 flex w-full items-center justify-center gap-2 border border-gold/40 bg-gold/5 py-2 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/15"
                  >
                    {showAllLeagueHistory ? (
                      <>
                        <ChevronUp className="h-4 w-4" /> Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" /> Ver histórico completo (+{leagueHistory.length - 6} títulos)
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Mini ranking — maiores campeões da história da liga */}
              <aside className="h-fit border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--gold)]">
                <div className="mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-gold" />
                  <h3 className="font-display text-sm uppercase tracking-widest text-gold">
                    Maiores Campeões
                  </h3>
                </div>
                {dynasty ? (
                  <div className="mb-3 border border-gold/50 bg-gold/10 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-gold" />
                      <span className="font-display text-xs uppercase tracking-widest text-gold">
                        👑 Dinastia
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      <span className="font-semibold text-bone">{dynasty.teamName}</span> domina a
                      história: {dynasty.label}
                    </div>
                  </div>
                ) : null}
                <ol className="space-y-1.5">
                  {championsRanking.slice(0, 10).map((row, i) => (
                    <li
                      key={row.key}
                      className={`flex items-center gap-2.5 px-2 py-1.5 ${
                        i === 0 ? "bg-gold/10" : ""
                      }`}
                    >
                      <span
                        className={`w-5 shrink-0 text-center font-display text-sm font-bold ${
                          i === 0 ? "text-gold" : "text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {row.teamLogo ? (
                        <img
                          src={row.teamLogo}
                          alt=""
                          className="h-6 w-6 shrink-0 object-contain"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-blood font-display text-[10px] font-bold text-bone">
                          {row.teamTag.slice(0, 3)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-display text-sm uppercase tracking-wide text-bone">
                            {row.teamName}
                          </span>
                          {row.streak >= 2 ? (
                            <span
                              title={`${row.streak} títulos seguidos`}
                              className="shrink-0 border border-gold/60 px-1 font-mono text-[9px] font-bold text-gold"
                            >
                              {row.streak}× seguidos
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                          {row.titles} título(s) · último {row.lastSplit}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                {championsRanking.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum título registrado.</div>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        {/* Painel de momentum (recolhido por padrão) */}
        <MomentumPanel championship={championship} division={activeDivision} teams={poolTeams} />

        {/* Promoção & Rebaixamento entre as séries */}
        <PromotionSection championship={championship} />
      </main>

      {/* Transmissão Ao Vivo da Grande Final */}
      {liveFinalOpen && readyGrandFinal ? (
        <LiveFinalModal
          championship={championship}
          match={readyGrandFinal.match}
          teamA={readyGrandFinal.teamA}
          teamB={readyGrandFinal.teamB}
          career={career[championship.game ?? "lol"]}
          onFinish={(winnerId, score) => {
            setMatchResult(
              championship.id,
              readyGrandFinal.phaseId,
              readyGrandFinal.match.id,
              winnerId,
              score,
            );
          }}
          onClose={() => setLiveFinalOpen(false)}
        />
      ) : null}

      {/* Modal de Celebração de Campeão & Pôster */}
      {showCelebration && champion ? (
        <ChampionCelebrationModal
          champion={champion}
          runnerUp={runnerUp}
          championship={championship}
          division={activeDivision}
          mvp={finalMvp}
          onSaveHistory={(label) => {
            saveChampionToHistory(
              championship.id,
              {
                teamName: champion.name,
                teamTag: champion.tag,
                teamLogo: champion.logo,
                splitLabel: label,
              },
              activeDivision,
            );
            toast.success("Título salvo com sucesso no Hall da Fama!");
          }}
          onGoToOffseason={
            !isIntl
              ? () => {
                  setShowCelebration(false);
                  setOffseasonOpen(true);
                }
              : undefined
          }
          onOpenPressConference={
            runnerUp && finalDecisiveMatch
              ? () => {
                  setShowCelebration(false);
                  setPressConferenceOpen(true);
                }
              : undefined
          }
          onClose={() => setShowCelebration(false)}
        />
      ) : null}

      {/* Coletiva de Imprensa Pós-Título / Pós-Vice */}
      {pressConferenceOpen && champion && runnerUp && finalDecisiveMatch ? (
        <PressConferenceModal
          championship={championship}
          match={finalDecisiveMatch}
          winnerTeam={champion}
          loserTeam={runnerUp}
          isGrandFinal
          initialTab="winner"
          career={career[championship.game ?? "lol"]}
          onClose={() => setPressConferenceOpen(false)}
        />
      ) : null}

      {/* Visor de Elencos, Orçamentos e Janela de Transferências */}
      {offseasonOpen ? (
        <OffseasonMarketDialog
          championship={championship}
          onClose={() => setOffseasonOpen(false)}
        />
      ) : null}

      {/* Perfil do Time */}
      {selectedTeamProfile ? (
        <TeamProfileDrawer
          team={selectedTeamProfile}
          championship={championship}
          career={career}
          game={championship.game ?? "lol"}
          allChampionships={championships}
          onClose={() => setSelectedTeamProfile(null)}
        />
      ) : null}

      {/* Painel lateral da Janela de Transferências (substitui o chat de mídia ao vivo) */}
      <TransferWindowFeed championship={championship} isInternational={isIntl} />
    </div>
  );
}
function RoundSimulator({
  phase,
  onSimulate,
}: {
  phase: Phase;
  onSimulate: (ids: string[]) => void;
}) {
  const rounds =
    phase.kind === "groups" && (phase.config as GroupsConfig).format !== "gsl"
      ? groupMatchRounds(phase)
      : new Map(phase.matches.map((m) => [m.id, m.round ?? 0]));
  const list = Array.from(new Set(rounds.values())).sort((a, b) => a - b);
  const playable = (r: number) =>
    phase.matches.filter((m) => rounds.get(m.id) === r && m.teamAId && m.teamBId && !m.winnerId);
  const next = list.find((r) => playable(r).length > 0);
  const allOpen = phase.matches.filter((m) => m.teamAId && m.teamBId && !m.winnerId);
  if (list.length === 0) return null;
  const btn =
    "inline-flex items-center gap-1 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30";
  return (
    <div className="flex flex-wrap items-center gap-2 border-2 border-gold/40 bg-black/40 p-3">
      <span className="mr-1 inline-flex items-center gap-1 font-display text-sm uppercase tracking-widest text-gold">
        <Dices className="h-4 w-4" /> Simular
      </span>
      <button
        type="button"
        disabled={next === undefined}
        onClick={() => next !== undefined && onSimulate(playable(next).map((m) => m.id))}
        className={`${btn} border-gold bg-gold text-ink hover:bg-gold/80`}
      >
        Próxima rodada{next !== undefined ? ` (R${next + 1})` : ""}
      </button>
      {list.map((r) => (
        <button
          key={r}
          type="button"
          disabled={playable(r).length === 0}
          onClick={() => onSimulate(playable(r).map((m) => m.id))}
          className={`${btn} border-gold/50 text-gold hover:bg-gold hover:text-ink`}
        >
          Rodada {r + 1}
        </button>
      ))}
      <button
        type="button"
        disabled={allOpen.length === 0}
        onClick={() => onSimulate(allOpen.map((m) => m.id))}
        className={`${btn} border-blood/60 text-blood hover:bg-blood hover:text-bone`}
      >
        Tudo Disponível
      </button>
    </div>
  );
}
