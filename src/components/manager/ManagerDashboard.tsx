import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/lol/player-avatar";
import { CountryFlag } from "@/components/lol/country-flag";
import {
  ArrowLeft,
  ArrowUpDown,
  Award,
  Briefcase,
  Building2,
  Coins,
  Crown,
  Dices,
  FastForward,
  Globe,
  Handshake,
  HeartHandshake,
  LayoutDashboard,
  Radio,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  ALL_LEAGUES,
  LEAGUE_META,
  MANAGER_STYLES,
  STAFF_ROLE_META,
  computeLeagueStandings,
  formatMoneyK,
  getTeamRoster,
  getUserPayrollPerRoundK,
  getUserSponsorIncomePerRoundK,
  teamCurrentStrength,
  type CareerMatch,
  type CareerPlayer,
  type LeagueId,
  type ManagerCareerState,
  type StaffRole,
  type TransferEvaluationResult,
} from "@/lib/lol/manager-career";
import { getResolvedAttrs } from "@/lib/lol/players";
import type { PlayerRole } from "@/lib/lol/types";
import { NegotiationModal } from "./NegotiationModal";
import { LiveCareerMatchModal } from "./LiveCareerMatchModal";

type TabId = "overview" | "roster" | "staff" | "market" | "finances" | "tournaments";

export function ManagerDashboard({
  state,
  onAdvanceRound,
  onSimulateUntilStageEnd,
  onStartNextSplit,
  onFirePlayer,
  onToggleStarter,
  onHireStaff,
  onFireStaff,
  onSelectSponsor,
  onAcceptIncomingOffer,
  onRejectIncomingOffer,
  onSubmitTransfer,
  onResetCareer,
}: {
  state: ManagerCareerState;
  onAdvanceRound: (forcedResult?: { matchId: string; winnerId: string; scoreA: number; scoreB: number }) => void;
  onSimulateUntilStageEnd: () => void;
  onStartNextSplit: () => void;
  onFirePlayer: (playerId: string) => void;
  onToggleStarter: (playerId: string) => void;
  onHireStaff: (staffId: string) => void;
  onFireStaff: (staffId: string) => void;
  onSelectSponsor: (sponsorId: string) => void;
  onAcceptIncomingOffer: (offerId: string) => void;
  onRejectIncomingOffer: (offerId: string, giveRetentionBonus?: boolean) => void;
  onSubmitTransfer: (params: {
    playerId: string;
    offeredFeeK: number;
    offeredSalaryK: number;
    promisedRole: "franchise_star" | "starter" | "sub";
  }) => TransferEvaluationResult;
  onResetCareer: () => void;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [selectedLeagueView, setSelectedLeagueView] = useState<LeagueId>(state.userLeague);

  // Market filters
  const [marketSearch, setMarketSearch] = useState("");
  const [marketLeague, setMarketLeague] = useState<LeagueId | "ALL" | "FREE_AGENT">("ALL");
  const [marketRole, setMarketRole] = useState<PlayerRole | "ALL">("ALL");
  const [negotiatingPlayer, setNegotiatingPlayer] = useState<CareerPlayer | null>(null);

  // Staff filter
  const [staffRoleFilter, setStaffRoleFilter] = useState<StaffRole | "ALL">("ALL");

  // Live Match modal
  const [liveMatchModalOpen, setLiveMatchModalOpen] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);

  const teamsMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const playersByTeam = useMemo(() => {
    const m = new Map<string, CareerPlayer[]>();
    for (const p of state.players) {
      if (!p.teamId) continue;
      const list = m.get(p.teamId) ?? [];
      list.push(p);
      m.set(p.teamId, list);
    }
    return m;
  }, [state.players]);

  const userTeam = teamsMap.get(state.userTeamId)!;
  const userRoster = playersByTeam.get(state.userTeamId) ?? [];
  const userStrength = teamCurrentStrength(userTeam, userRoster, state.staff, state.manager);
  const payrollK = getUserPayrollPerRoundK(state);
  const incomeK = getUserSponsorIncomePerRoundK(state);
  const netPerRoundK = incomeK - payrollK;

  const userLeagueState = state.leagues[state.userLeague];
  const standings = useMemo(() => {
    const lTeams = state.teams.filter((t) => t.league === state.userLeague).map((t) => t.id);
    return computeLeagueStandings(lTeams, userLeagueState.regularMatches, teamsMap, playersByTeam);
  }, [state.teams, state.userLeague, userLeagueState.regularMatches, teamsMap, playersByTeam]);

  const userRank = Math.max(1, standings.findIndex((s) => s.teamId === state.userTeamId) + 1);

  // Próximo confronto do usuário
  const nextUserMatch: CareerMatch | null = useMemo(() => {
    if (state.international?.active && !state.international.completed) {
      const openRound = state.international.matches
        .filter((m) => !m.winnerId && m.teamAId && m.teamBId)
        .reduce((min, m) => Math.min(min, m.round), 999);
      return (
        state.international.matches.find(
          (m) =>
            m.round === openRound &&
            !m.winnerId &&
            (m.teamAId === state.userTeamId || m.teamBId === state.userTeamId),
        ) ?? null
      );
    }
    if (userLeagueState.stage === "regular") {
      return (
        userLeagueState.regularMatches.find(
          (m) =>
            m.round === userLeagueState.currentRound &&
            !m.winnerId &&
            (m.teamAId === state.userTeamId || m.teamBId === state.userTeamId),
        ) ?? null
      );
    }
    if (userLeagueState.stage === "playoffs") {
      const openRound = userLeagueState.playoffMatches
        .filter((m) => !m.winnerId && m.teamAId && m.teamBId)
        .reduce((min, m) => Math.min(min, m.round), 999);
      return (
        userLeagueState.playoffMatches.find(
          (m) =>
            m.round === openRound &&
            !m.winnerId &&
            (m.teamAId === state.userTeamId || m.teamBId === state.userTeamId),
        ) ?? null
      );
    }
    return null;
  }, [state.international, state.userTeamId, userLeagueState]);

  const isSplitFullyDone =
    ALL_LEAGUES.every((l) => state.leagues[l].stage === "completed") &&
    (!state.international || state.international.completed);

  const marketPlayers = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    return state.players
      .filter((p) => p.teamId !== state.userTeamId)
      .filter((p) => (marketLeague === "ALL" ? true : p.league === marketLeague))
      .filter((p) => (marketRole === "ALL" ? true : p.role === marketRole))
      .filter(
        (p) =>
          !q ||
          p.ign.toLowerCase().includes(q) ||
          (p.real ?? "").toLowerCase().includes(q) ||
          (p.teamName ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 80);
  }, [state.players, state.userTeamId, marketLeague, marketRole, marketSearch]);

  const viewedLeagueState = state.leagues[selectedLeagueView];
  const viewedStandings = useMemo(() => {
    const lTeams = state.teams.filter((t) => t.league === selectedLeagueView).map((t) => t.id);
    return computeLeagueStandings(lTeams, viewedLeagueState.regularMatches, teamsMap, playersByTeam);
  }, [state.teams, selectedLeagueView, viewedLeagueState.regularMatches, teamsMap, playersByTeam]);

  const sortedRoster = useMemo(() => {
    const order: Record<PlayerRole, number> = { top: 0, jungle: 1, mid: 2, adc: 3, support: 4 };
    return [...userRoster].sort((a, b) => {
      if (!!a.sub !== !!b.sub) return a.sub ? 1 : -1;
      return order[a.role] - order[b.role];
    });
  }, [userRoster]);

  const tabs: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    { id: "roster", label: "Elenco", icon: Users },
    { id: "staff", label: "Funcionários", icon: Briefcase },
    { id: "market", label: "Mercado Global", icon: Globe },
    { id: "finances", label: "Finanças", icon: Coins },
    { id: "tournaments", label: "Liga & Torneios", icon: Trophy },
  ];

  const avgMorale = useMemo(() => {
    if (userRoster.length === 0) return 75;
    return Math.round(userRoster.reduce((s, p) => s + p.morale, 0) / userRoster.length);
  }, [userRoster]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08),transparent_65%)] pb-16">
      {/* Executive Top Bar */}
      <header className="sticky top-0 z-30 border-b border-gold/25 bg-ink/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          {/* Clube + Manager */}
          <div className="flex items-center gap-3.5">
            {userTeam.logo ? (
              <img
                src={userTeam.logo}
                alt={userTeam.name}
                className="h-12 w-12 rounded-sm border border-gold/40 bg-black/50 object-contain p-1"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-sm border border-gold/40 font-display text-lg font-bold text-bone"
                style={{ background: userTeam.color ?? "var(--blood)" }}
              >
                {userTeam.tag}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl uppercase tracking-wider text-bone sm:text-2xl">
                  {userTeam.name}
                </h1>
                <span className="border border-gold/50 bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
                  {state.userLeague} · #{userRank}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Manager: <strong className="text-bone">{state.manager.name}</strong> ({MANAGER_STYLES[state.manager.style].label}) ·{" "}
                <span className="text-gold">
                  {state.seasonYear} Split {state.splitNumber}
                </span>
              </p>
            </div>
          </div>

          {/* Métricas Executivas + Sair */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="border border-emerald-500/40 bg-emerald-950/25 px-3 py-1.5 text-xs">
              <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-300/80">
                Caixa do Clube
              </div>
              <div className="font-display text-base text-emerald-300">
                {formatMoneyK(state.cashK)}
              </div>
            </div>
            <div className="border border-border bg-black/55 px-3 py-1.5 text-xs">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Saldo / Rodada
              </div>
              <div
                className={`font-display text-base ${
                  netPerRoundK >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {netPerRoundK >= 0 ? `+${formatMoneyK(netPerRoundK)}` : formatMoneyK(netPerRoundK)}
              </div>
            </div>
            <div className="border border-gold/35 bg-black/55 px-3 py-1.5 text-xs">
              <div className="text-[9px] font-bold uppercase tracking-widest text-gold/80">
                Força / Rep.
              </div>
              <div className="font-display text-base text-gold">
                {userStrength} OVR · {state.manager.reputation}
              </div>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 border border-gold/50 bg-black/65 px-3.5 py-2 font-display text-xs uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Sair p/ Simulador
            </Link>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              title="Reiniciar Carreira de Manager"
              className="border border-border bg-black/65 p-2 text-muted-foreground transition-colors hover:border-red-500/60 hover:text-red-400"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-2 border px-3.5 py-2 font-display text-xs uppercase tracking-[0.18em] transition-all ${
                  active
                    ? "border-gold bg-gold text-ink"
                    : "border-transparent bg-black/40 text-muted-foreground hover:border-gold/30 hover:text-bone"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-7xl px-5">
        {/* ================= TAB: VISÃO GERAL ================= */}
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Coluna Esquerda: Próximo Jogo + Ação de Simulação + Saúde do Clube */}
            <div className="space-y-6 lg:col-span-7">
              {/* Central de Simulação */}
              <div className="border-2 border-gold/40 bg-card/85 p-5 shadow-[0_12px_30px_-15px_rgba(0,0,0,0.9)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
                      {state.international?.active && !state.international.completed
                        ? `Torneio Internacional · ${state.international.name}`
                        : userLeagueState.stage === "regular"
                          ? `Temporada Regular · Rodada ${userLeagueState.currentRound} de ${userLeagueState.totalRegularRounds}`
                          : userLeagueState.stage === "playoffs"
                            ? `Playoffs da ${state.userLeague}`
                            : isSplitFullyDone
                              ? "Split Encerrado"
                              : "Aguardando Encerramento das Outras Ligas"}
                    </span>
                    <h2 className="font-display text-2xl uppercase tracking-wider text-bone">
                      Centro de Simulação
                    </h2>
                  </div>
                </div>

                {nextUserMatch && nextUserMatch.teamAId && nextUserMatch.teamBId ? (
                  (() => {
                    const tA = teamsMap.get(nextUserMatch.teamAId!)!;
                    const tB = teamsMap.get(nextUserMatch.teamBId!)!;
                    const sA = teamCurrentStrength(
                      tA,
                      playersByTeam.get(tA.id) ?? [],
                      state.staff,
                      state.manager,
                    );
                    const sB = teamCurrentStrength(
                      tB,
                      playersByTeam.get(tB.id) ?? [],
                      state.staff,
                      state.manager,
                    );
                    return (
                      <div className="mt-4 border border-gold/25 bg-black/50 p-4">
                        <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-gold">
                          Seu Próximo Confronto · {nextUserMatch.label} (MD{nextUserMatch.bestOf})
                        </div>
                        <div className="grid grid-cols-11 items-center gap-2 text-center">
                          <div className="col-span-4">
                            <div className="font-display text-lg uppercase text-bone">
                              {tA.name}
                            </div>
                            <div className="text-xs font-bold text-gold">{sA} OVR</div>
                          </div>
                          <div className="col-span-3 font-display text-2xl text-muted-foreground">
                            VS
                          </div>
                          <div className="col-span-4">
                            <div className="font-display text-lg uppercase text-bone">
                              {tB.name}
                            </div>
                            <div className="text-xs font-bold text-gold">{sB} OVR</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="mt-4 border border-border bg-black/40 p-4 text-xs text-muted-foreground">
                    {isSplitFullyDone
                      ? "Todos os torneios deste Split terminaram. Você pode reforçar o elenco ou iniciar o próximo Split!"
                      : "Seu time está de folga nesta rodada ou aguarda o avanço da chave."}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2.5">
                  {!isSplitFullyDone ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onAdvanceRound()}
                        className="inline-flex flex-1 items-center justify-center gap-2 bg-gold px-4 py-3 font-display text-sm uppercase tracking-widest text-ink transition-transform hover:scale-[1.01]"
                      >
                        <Dices className="h-4 w-4" /> Simular Próxima Rodada
                      </button>
                      {nextUserMatch && nextUserMatch.teamAId && nextUserMatch.teamBId ? (
                        <button
                          type="button"
                          onClick={() => setLiveMatchModalOpen(true)}
                          className="inline-flex items-center gap-2 border border-red-500/60 bg-red-950/30 px-4 py-3 font-display text-xs uppercase tracking-widest text-red-300 hover:bg-red-950/50"
                        >
                          <Radio className="h-4 w-4" /> Jogar Ao Vivo
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={onSimulateUntilStageEnd}
                        className="inline-flex items-center gap-2 border border-gold/40 bg-black/60 px-4 py-3 font-display text-xs uppercase tracking-widest text-gold hover:bg-gold/10"
                      >
                        <FastForward className="h-4 w-4" /> Simular Fase Atual
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onStartNextSplit}
                      className="inline-flex w-full items-center justify-center gap-2 bg-gold px-5 py-3.5 font-display text-sm uppercase tracking-widest text-ink"
                    >
                      <Sparkles className="h-4 w-4" /> Avançar para{" "}
                      {state.splitNumber === 1
                        ? `${state.seasonYear} Split 2`
                        : `${state.seasonYear + 1} Split 1 (Offseason)`}
                    </button>
                  )}
                </div>
              </div>

              {/* Propostas Recebidas pelos Seus Jogadores */}
              {(state.incomingOffers?.length ?? 0) > 0 && (
                <div className="border-2 border-emerald-500/60 bg-emerald-950/20 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-wider text-emerald-300">
                      <Handshake className="h-5 w-5" /> Propostas Oficialmente Recebidas ({state.incomingOffers.length})
                    </h3>
                    <span className="border border-emerald-500/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                      Ofertas de Compra na Mesa
                    </span>
                  </div>
                  <div className="space-y-3">
                    {state.incomingOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="border border-emerald-500/40 bg-black/65 p-4 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">
                                {offer.playerRole.toUpperCase()}
                              </span>
                              <strong className="font-display text-base uppercase text-bone">
                                {offer.playerIgn} ({offer.playerOvr} OVR)
                              </strong>
                              <span className="text-muted-foreground">→</span>
                              <strong className="font-display text-base uppercase text-gold">
                                {offer.fromTeamName} ({offer.fromLeague})
                              </strong>
                            </div>
                            <p className="mt-1 text-muted-foreground">{offer.reason}</p>
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
                              <span className="border border-border bg-black/50 px-2 py-0.5 text-bone">
                                Desejo do Jogador:{" "}
                                <strong className="text-gold">
                                  {offer.playerDesire === "eager"
                                    ? "Quer se transferir (Liga Maior)"
                                    : offer.playerDesire === "open"
                                      ? "Aberto à proposta"
                                      : "Fiel ao clube"}
                                </strong>
                              </span>
                              <span className="border border-border bg-black/50 px-2 py-0.5 text-muted-foreground">
                                Expira na rodada #{offer.expiresAtStep}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                              Valor de Compra
                            </div>
                            <div className="font-display text-2xl text-emerald-400">
                              +{formatMoneyK(offer.offeredFeeK)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                          <button
                            type="button"
                            onClick={() => onAcceptIncomingOffer(offer.id)}
                            disabled={userRoster.length <= 5}
                            title={
                              userRoster.length <= 5
                                ? "Contrate um substituto antes (mínimo 5 jogadores no elenco)"
                                : "Vender jogador e receber valor integral no caixa"
                            }
                            className="bg-emerald-500 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-ink hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Vender Craque (+{formatMoneyK(offer.offeredFeeK)})
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectIncomingOffer(offer.id, true)}
                            className="border border-gold/50 bg-gold/15 px-3 py-1.5 font-display text-[11px] uppercase tracking-widest text-gold hover:bg-gold hover:text-ink"
                          >
                            Segurar + Bônus Retenção (Moral +10)
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectIncomingOffer(offer.id, false)}
                            className="border border-border bg-black/60 px-3 py-1.5 font-display text-[11px] uppercase tracking-widest text-muted-foreground hover:border-red-500/40 hover:text-bone"
                          >
                            Recusar Proposta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patrocinador Master & Metas da Diretoria */}
              <div className="border border-gold/35 bg-card/80 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
                      Estratégia Financeira do Split
                    </span>
                    <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-wider text-bone">
                      <Building2 className="h-5 w-5 text-gold" /> Patrocinador Master & Meta da Diretoria
                    </h3>
                  </div>
                  {state.activeSponsor && (
                    <span
                      className={`border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        state.activeSponsor.status === "fulfilled"
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                          : state.activeSponsor.status === "failed"
                            ? "border-red-500/50 bg-red-950/40 text-red-300"
                            : "border-gold/50 bg-gold/15 text-gold"
                      }`}
                    >
                      {state.activeSponsor.status === "fulfilled"
                        ? "✓ Meta Cumprida"
                        : state.activeSponsor.status === "failed"
                          ? "✕ Meta Falhou"
                          : "Em Andamento"}
                    </span>
                  )}
                </div>

                {state.activeSponsor ? (
                  <div className="border border-gold/30 bg-black/50 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-display text-lg uppercase text-gold">
                          {state.activeSponsor.brandName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {state.activeSponsor.sector} · Meta:{" "}
                          <strong className="text-bone">{state.activeSponsor.goalLabel}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold text-emerald-400">
                          +{formatMoneyK(state.activeSponsor.perRoundIncomeK)} / rodada
                        </div>
                        <div className="text-[11px] text-gold">
                          Bônus Meta: +{formatMoneyK(state.activeSponsor.rewardBonusK)}
                          {state.activeSponsor.penaltyK > 0
                            ? ` · Multa: -${formatMoneyK(state.activeSponsor.penaltyK)}`
                            : " · Sem multa"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Escolha 1 dos 3 patrocinadores para este Split. Contratos mais ousados pagam mais por
                      rodada e oferecem bônus maiores, mas cobram multa se o time não atingir a meta!
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(state.sponsorOffers ?? []).map((sp) => (
                        <div
                          key={sp.id}
                          className="flex flex-col justify-between border border-gold/30 bg-black/55 p-3.5 text-xs transition-colors hover:border-gold"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                                {sp.tier === "safe"
                                  ? "Seguro"
                                  : sp.tier === "balanced"
                                    ? "Equilibrado"
                                    : "Ambicioso"}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-emerald-400">
                                +{formatMoneyK(sp.perRoundIncomeK)}/rod
                              </span>
                            </div>
                            <h4 className="mt-2 font-display text-base uppercase text-bone">
                              {sp.brandName}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">{sp.sector}</p>
                            <div className="mt-2 border-t border-border/50 pt-2 text-[11px]">
                              <div className="text-bone">
                                🎯 <strong>{sp.goalLabel}</strong>
                              </div>
                              <div className="mt-1 text-emerald-300">
                                Bônus: <strong>+{formatMoneyK(sp.rewardBonusK)}</strong>
                              </div>
                              <div className="text-muted-foreground">
                                Risco:{" "}
                                {sp.penaltyK > 0 ? (
                                  <span className="text-red-300">
                                    Multa -{formatMoneyK(sp.penaltyK)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-300">Sem multa</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectSponsor(sp.id)}
                            className="mt-3 w-full bg-gold py-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-ink hover:bg-gold/90"
                          >
                            Assinar Contrato
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Saúde do Clube & Impacto das Decisões */}
              <div className="border border-gold/30 bg-card/75 p-5">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg uppercase tracking-wider text-gold">
                  <HeartHandshake className="h-5 w-5" /> Saúde Interna & Impacto da Gestão
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="border border-border bg-black/45 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Cultura / Clima
                    </div>
                    <div className="mt-1 font-display text-2xl text-bone">
                      {userTeam.culture ?? 55}
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                  </div>
                  <div className="border border-border bg-black/45 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Sinergia Elenco
                    </div>
                    <div className="mt-1 font-display text-2xl text-gold">
                      {userTeam.synergy ?? 18}
                      <span className="text-xs text-muted-foreground">/50</span>
                    </div>
                  </div>
                  <div className="border border-border bg-black/45 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Moral Jogadores
                    </div>
                    <div className="mt-1 font-display text-2xl text-emerald-400">
                      {avgMorale}%
                    </div>
                  </div>
                  <div className="border border-border bg-black/45 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Aprovação Torcida
                    </div>
                    <div className="mt-1 font-display text-2xl text-amber-300">
                      {state.fanApproval}%
                    </div>
                  </div>
                </div>

                {/* Feed de Acontecimentos e Consequências */}
                <div className="mt-5">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gold/80">
                    Linha do Tempo de Decisões & Acontecimentos
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {state.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="border border-border/60 bg-black/45 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-bone">{ev.headline}</strong>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ev.splitLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{ev.detail}</p>
                        {ev.impactTags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {ev.impactTags.map((tag, i) => (
                              <span
                                key={i}
                                className="border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Tabela da Liga + Resumo de Staff */}
            <div className="space-y-6 lg:col-span-5">
              <div className="border border-gold/30 bg-card/75 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg uppercase tracking-wider text-gold">
                    Classificação {state.userLeague}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab("tournaments")}
                    className="text-[10px] font-bold uppercase tracking-widest text-gold hover:underline"
                  >
                    Ver Playoffs →
                  </button>
                </div>
                <div className="overflow-hidden border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/60 text-[10px] uppercase tracking-wider text-gold">
                      <tr>
                        <th className="px-2.5 py-2">#</th>
                        <th className="px-2.5 py-2">Time</th>
                        <th className="px-2.5 py-2 text-center">V-D</th>
                        <th className="px-2.5 py-2 text-right">OVR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {standings.map((row, idx) => {
                        const t = teamsMap.get(row.teamId);
                        if (!t) return null;
                        const isUser = t.id === state.userTeamId;
                        const isPlayoffZone = idx < 4;
                        return (
                          <tr
                            key={t.id}
                            className={
                              isUser
                                ? "bg-gold/15 font-semibold text-bone"
                                : "bg-black/30 text-muted-foreground"
                            }
                          >
                            <td className="px-2.5 py-2">
                              <span
                                className={
                                  isPlayoffZone ? "font-bold text-emerald-400" : ""
                                }
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-bone">
                              {t.name} {isUser ? "★" : ""}
                            </td>
                            <td className="px-2.5 py-2 text-center font-mono text-bone">
                              {row.wins}-{row.losses}
                            </td>
                            <td className="px-2.5 py-2 text-right font-bold text-gold">
                              {row.ovr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Top 4 avançam para os Playoffs BO5. Campeão garante premiação + vaga no Internacional.
                </p>
              </div>

              {/* Resumo Rápido Comissão Técnica */}
              <div className="border border-gold/30 bg-card/75 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg uppercase tracking-wider text-gold">
                    Comissão & Diretoria ({state.staff.length}/5)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab("staff")}
                    className="text-[10px] font-bold uppercase tracking-widest text-gold hover:underline"
                  >
                    Gerenciar →
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {(Object.keys(STAFF_ROLE_META) as StaffRole[]).map((role) => {
                    const hired = state.staff.find((s) => s.role === role);
                    return (
                      <div
                        key={role}
                        className="flex items-center justify-between border border-border/60 bg-black/40 px-3 py-2"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gold/80">
                            {STAFF_ROLE_META[role].label}
                          </div>
                          <div className="font-semibold text-bone">
                            {hired ? hired.name : "Cargo Vago"}
                          </div>
                        </div>
                        {hired ? (
                          <span className="border border-gold/40 bg-gold/10 px-2 py-0.5 font-bold text-gold">
                            {hired.rating}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setTab("staff")}
                            className="border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground hover:border-gold hover:text-gold"
                          >
                            Contratar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: ELENCO ================= */}
        {tab === "roster" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-gold/30 bg-card/80 p-4">
              <div>
                <h2 className="font-display text-2xl uppercase tracking-wider text-gold">
                  Elenco Ativo ({userRoster.length} jogadores)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Alterar titulares reduz levemente a sinergia imediata. Demitir jogadores populares
                  cobra multa de 2 rodadas e impacta o clima do vestiário.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("market")}
                className="inline-flex items-center gap-2 bg-gold px-4 py-2 font-display text-xs uppercase tracking-widest text-ink"
              >
                <UserPlus className="h-4 w-4" /> Contratar no Mercado Global
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {sortedRoster.map((p) => {
                const attrs = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
                return (
                  <div
                    key={p.id}
                    className={`border-2 p-4 ${
                      p.sub
                        ? "border-border/70 bg-black/50"
                        : "border-gold/40 bg-card/85"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                      <div className="flex items-start gap-3">
                        <PlayerAvatar ign={p.ign} role={p.role} size="md" highlight={!p.sub} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">
                              {p.role.toUpperCase()}
                            </span>
                            <CountryFlag code={p.country} size="xs" />
                            <span className="font-display text-xl uppercase tracking-wide text-bone">
                              {p.ign}
                            </span>
                            <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {p.sub ? "Reserva" : "Titular"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {p.real ? `${p.real} · ` : ""}
                            {p.country ?? "INTL"} · {p.age ?? 21} anos · V-D: {p.wins}-{p.losses} ·{" "}
                            {p.mvps} MVPs
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-3xl text-gold">{p.overall}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          OVR
                        </div>
                      </div>
                    </div>

                    {/* Atributos chave */}
                    <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px]">
                      <div className="border border-border/50 bg-black/40 py-1">
                        <div className="text-[9px] text-muted-foreground">MEC</div>
                        <strong className="text-bone">{Math.round(attrs.mechanics)}</strong>
                      </div>
                      <div className="border border-border/50 bg-black/40 py-1">
                        <div className="text-[9px] text-muted-foreground">IQ</div>
                        <strong className="text-bone">{Math.round(attrs.gameIq)}</strong>
                      </div>
                      <div className="border border-border/50 bg-black/40 py-1">
                        <div className="text-[9px] text-muted-foreground">CLUTCH</div>
                        <strong className="text-bone">{Math.round(attrs.clutch)}</strong>
                      </div>
                      <div className="border border-border/50 bg-black/40 py-1">
                        <div className="text-[9px] text-muted-foreground">MENTAL</div>
                        <strong className="text-bone">{Math.round(attrs.mentality)}</strong>
                      </div>
                      <div className="border border-border/50 bg-black/40 py-1">
                        <div className="text-[9px] text-muted-foreground">MORAL</div>
                        <strong
                          className={
                            p.morale >= 70
                              ? "text-emerald-400"
                              : p.morale >= 45
                                ? "text-amber-300"
                                : "text-red-400"
                          }
                        >
                          {p.morale}%
                        </strong>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <div className="text-muted-foreground">
                        Salário: <strong className="text-bone">{formatMoneyK(p.salaryPerRoundK)}/rod.</strong>{" "}
                        · Mercado: <strong className="text-gold">{formatMoneyK(p.marketValueK)}</strong>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleStarter(p.id)}
                          className="inline-flex items-center gap-1 border border-gold/40 bg-black/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gold hover:bg-gold/15"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {p.sub ? "Virar Titular" : "Ir p/ Banco"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onFirePlayer(p.id)}
                          disabled={userRoster.length <= 5}
                          title={
                            userRoster.length <= 5
                              ? "Mínimo de 5 jogadores exigido"
                              : `Demitir (Multa ${formatMoneyK(p.salaryPerRoundK * 2)})`
                          }
                          className="inline-flex items-center gap-1 border border-red-500/40 bg-red-950/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <UserMinus className="h-3 w-3" /> Demitir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB: FUNCIONÁRIOS & STAFF ================= */}
        {tab === "staff" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <div className="border border-gold/30 bg-card/80 p-4">
                <h2 className="font-display text-xl uppercase tracking-wider text-gold">
                  Sua Comissão Técnica
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada departamento gera impactos diretos nas partidas, finanças, negociações e vestiário.
                </p>
              </div>

              {(Object.keys(STAFF_ROLE_META) as StaffRole[]).map((role) => {
                const meta = STAFF_ROLE_META[role];
                const hired = state.staff.find((s) => s.role === role);
                return (
                  <div
                    key={role}
                    className={`border p-4 ${
                      hired ? "border-gold/40 bg-card/85" : "border-dashed border-border bg-black/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                          {meta.label}
                        </span>
                        <h3 className="font-display text-lg uppercase tracking-wide text-bone">
                          {hired ? hired.name : "Vaga em Aberto"}
                        </h3>
                      </div>
                      {hired && (
                        <span className="border border-gold/50 bg-gold/15 px-2.5 py-1 font-display text-lg text-gold">
                          {hired.rating}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.impactSummary}</p>
                    {hired ? (
                      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
                        <span className="text-muted-foreground">
                          {hired.country} · Salário:{" "}
                          <strong className="text-bone">
                            {formatMoneyK(hired.salaryPerRoundK)}/rodada
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => onFireStaff(hired.id)}
                          className="border border-red-500/40 bg-red-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-950/50"
                        >
                          Demitir (-{formatMoneyK(hired.salaryPerRoundK)})
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 lg:col-span-7">
              <div className="border border-gold/30 bg-card/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl uppercase tracking-wider text-gold">
                      Mercado de Profissionais
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Contrate especialistas para substituir ou preencher departamentos vazios.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStaffRoleFilter("ALL")}
                    className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      staffRoleFilter === "ALL"
                        ? "border-gold bg-gold text-ink"
                        : "border-border bg-black/50 text-muted-foreground"
                    }`}
                  >
                    Todos
                  </button>
                  {(Object.keys(STAFF_ROLE_META) as StaffRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setStaffRoleFilter(role)}
                      className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        staffRoleFilter === role
                          ? "border-gold bg-gold text-ink"
                          : "border-border bg-black/50 text-muted-foreground hover:text-bone"
                      }`}
                    >
                      {STAFF_ROLE_META[role].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {state.staffMarket
                  .filter((s) => staffRoleFilter === "ALL" || s.role === staffRoleFilter)
                  .sort((a, b) => b.rating - a.rating)
                  .map((cand) => {
                    const existing = state.staff.find((x) => x.role === cand.role);
                    const totalCost = cand.hireFeeK + (existing ? existing.salaryPerRoundK : 0);
                    const canAfford = state.cashK >= totalCost;
                    return (
                      <div
                        key={cand.id}
                        className="flex flex-col justify-between border border-border bg-card/75 p-4"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                                {STAFF_ROLE_META[cand.role].label}
                              </span>
                              <h4 className="font-display text-lg uppercase text-bone">
                                {cand.name}
                              </h4>
                            </div>
                            <span className="border border-gold/40 bg-black/60 px-2 py-0.5 font-display text-base text-gold">
                              {cand.rating}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {cand.country} · {cand.age} anos · {cand.specialty}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">
                              Luvas: <strong className="text-bone">{formatMoneyK(cand.hireFeeK)}</strong>
                            </div>
                            <div className="text-muted-foreground">
                              Salário:{" "}
                              <strong className="text-bone">
                                {formatMoneyK(cand.salaryPerRoundK)}/rod.
                              </strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onHireStaff(cand.id)}
                            className="bg-gold px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {existing ? "Substituir" : "Contratar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: MERCADO GLOBAL ================= */}
        {tab === "market" && (
          <div className="space-y-4">
            <div className="border border-gold/30 bg-card/85 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl uppercase tracking-wider text-gold">
                    Mercado Global de Jogadores
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Negocie com qualquer jogador do mundo ou contrate agentes livres sem taxa. Cada
                    jogador analisa prestígio da sua liga, força do elenco, papel e salário.
                  </p>
                </div>
                <div className="border border-emerald-500/40 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-300">
                  Disponível em Caixa: <strong>{formatMoneyK(state.cashK)}</strong>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-12">
                <div className="relative md:col-span-5">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Buscar jogador, nome real ou time (ex: Faker, brTT, Chovy)..."
                    className="w-full border border-gold/35 bg-black/60 py-2 pl-9 pr-3 text-sm text-bone outline-none focus:border-gold"
                  />
                </div>

                <div className="flex flex-wrap gap-1 md:col-span-4">
                  {(["ALL", "FREE_AGENT", ...ALL_LEAGUES] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setMarketLeague(l)}
                      className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        marketLeague === l
                          ? "border-gold bg-gold text-ink"
                          : "border-border bg-black/50 text-muted-foreground hover:text-bone"
                      }`}
                    >
                      {l === "ALL" ? "Mundo" : l === "FREE_AGENT" ? "Livres" : l}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1 md:col-span-3 md:justify-end">
                  {(["ALL", "top", "jungle", "mid", "adc", "support"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMarketRole(r)}
                      className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        marketRole === r
                          ? "border-gold bg-gold text-ink"
                          : "border-border bg-black/50 text-muted-foreground hover:text-bone"
                      }`}
                    >
                      {r === "ALL" ? "Pos." : r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-gold/25 bg-card/75">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gold/30 bg-black/70 text-[10px] uppercase tracking-widest text-gold">
                  <tr>
                    <th className="px-4 py-3">Jogador</th>
                    <th className="px-3 py-3">Rota</th>
                    <th className="px-3 py-3">Clube / Liga</th>
                    <th className="px-3 py-3 text-center">Idade</th>
                    <th className="px-3 py-3 text-center">OVR</th>
                    <th className="px-3 py-3 text-right">Multa Est.</th>
                    <th className="px-3 py-3 text-right">Salário/Rod.</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {marketPlayers.map((p) => (
                    <tr key={p.id} className="hover:bg-gold/5">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar ign={p.ign} role={p.role} size="xs" />
                          <div>
                            <div className="flex items-center gap-1.5 font-display text-sm uppercase tracking-wide text-bone">
                              <CountryFlag code={p.country} size="xs" />
                              <span>{p.ign}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {p.real ? `${p.real} · ` : ""}
                              {p.country ?? "INTL"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="border border-gold/40 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold">
                          {p.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {p.teamName ? (
                          <div>
                            <span className="font-semibold text-bone">{p.teamName}</span>
                            <span className="ml-1.5 text-[10px] text-gold">{p.league}</span>
                          </div>
                        ) : (
                          <span className="border border-emerald-500/40 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            Agente Livre
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">
                        {p.age ?? 21}
                      </td>
                      <td className="px-3 py-2.5 text-center font-display text-base text-gold">
                        {p.overall}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-bone">
                        {p.league === "FREE_AGENT" ? "$0" : formatMoneyK(p.marketValueK)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                        {formatMoneyK(p.salaryPerRoundK)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setNegotiatingPlayer(p)}
                          className="inline-flex items-center gap-1 border border-gold bg-gold/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-ink"
                        >
                          <Handshake className="h-3.5 w-3.5" /> Proposta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Transferências da IA pelo Mundo */}
            <div className="border border-gold/30 bg-card/80 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg uppercase tracking-wider text-gold">
                    🔄 Transferências dos Times da IA pelo Mundo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Clubes de todas as ligas contratam agentes livres e negociam jogadores entre si ao
                    longo do Split e na Offseason.
                  </p>
                </div>
                <span className="border border-gold/40 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
                  {(state.worldTransfers ?? []).length} movimentações
                </span>
              </div>
              {(state.worldTransfers ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Avance algumas rodadas para acompanhar as primeiras movimentações de mercado dos times
                  da IA pelo mundo.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
                  {(state.worldTransfers ?? []).map((tr) => (
                    <div
                      key={tr.id}
                      className="flex flex-wrap items-center justify-between gap-2 border border-border/60 bg-black/45 px-3.5 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">
                          {tr.playerRole.toUpperCase()}
                        </span>
                        <strong className="font-display text-sm uppercase text-bone">
                          {tr.playerIgn} ({tr.playerOvr} OVR)
                        </strong>
                        <span className="text-muted-foreground">
                          {tr.fromTeamName} ({tr.fromLeague === "FREE_AGENT" ? "Livre" : tr.fromLeague})
                        </span>
                        <span className="text-gold">→</span>
                        <strong className="text-gold">
                          {tr.toTeamName} ({tr.toLeague})
                        </strong>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-emerald-400">
                          {tr.feeK > 0 ? formatMoneyK(tr.feeK) : "Sem Custos"}
                        </span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {tr.splitLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB: FINANÇAS ================= */}
        {tab === "finances" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-emerald-500/40 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  <Wallet className="h-4 w-4" /> Caixa Atual
                </div>
                <div className="mt-1 font-display text-3xl text-emerald-300">
                  {formatMoneyK(state.cashK)}
                </div>
              </div>
              <div className="border border-border bg-card/80 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gold">
                  <TrendingUp className="h-4 w-4" /> Receita Patrocínio / Rodada
                </div>
                <div className="mt-1 font-display text-3xl text-bone">
                  +{formatMoneyK(incomeK)}
                </div>
              </div>
              <div className="border border-border bg-card/80 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-400">
                  <TrendingDown className="h-4 w-4" /> Folha Salarial / Rodada
                </div>
                <div className="mt-1 font-display text-3xl text-red-300">
                  -{formatMoneyK(payrollK)}
                </div>
              </div>
              <div className="border border-gold/40 bg-card/80 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gold">
                  <Award className="h-4 w-4" /> Prêmio Título {state.userLeague}
                </div>
                <div className="mt-1 font-display text-3xl text-gold">
                  {formatMoneyK(LEAGUE_META[state.userLeague].prizePoolK.champion)}
                </div>
              </div>
            </div>

            <div className="border border-gold/30 bg-card/80 p-5">
              <h3 className="mb-3 font-display text-lg uppercase tracking-wider text-gold">
                Extrato Financeiro do Clube
              </h3>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 text-xs">
                {state.transactions.map((tr) => (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between border border-border/60 bg-black/45 px-4 py-2.5"
                  >
                    <div>
                      <div className="font-semibold text-bone">{tr.title}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {tr.splitLabel} · {tr.type}
                      </div>
                    </div>
                    <strong
                      className={`font-display text-base ${
                        tr.amountK >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {tr.amountK >= 0
                        ? `+${formatMoneyK(tr.amountK)}`
                        : formatMoneyK(tr.amountK)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: LIGA & TORNEIOS ================= */}
        {tab === "tournaments" && (
          <div className="space-y-6">
            {/* Torneio Internacional quando ativo */}
            {state.international && (
              <div className="border-2 border-gold bg-card/90 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
                      Palco Mundial
                    </span>
                    <h2 className="font-display text-2xl uppercase tracking-wider text-bone">
                      🌎 {state.international.name} {state.seasonYear}
                    </h2>
                  </div>
                  {state.international.championId && (
                    <div className="border border-gold bg-gold/20 px-4 py-2 font-display text-sm uppercase tracking-wider text-gold">
                      🏆 Campeão:{" "}
                      {teamsMap.get(state.international.championId)?.name ?? "Campeão"}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {state.international.matches.map((m) => {
                    const tA = m.teamAId ? teamsMap.get(m.teamAId) : null;
                    const tB = m.teamBId ? teamsMap.get(m.teamBId) : null;
                    return (
                      <div key={m.id} className="border border-gold/30 bg-black/50 p-3 text-xs">
                        <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase text-gold">
                          <span>{m.label}</span>
                          <span>MD{m.bestOf}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className={m.winnerId === tA?.id ? "font-bold text-gold" : "text-bone"}>
                            {tA?.name ?? "A definir"}
                          </span>
                          <span className="font-mono text-bone">{m.scoreA ?? "-"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className={m.winnerId === tB?.id ? "font-bold text-gold" : "text-bone"}>
                            {tB?.name ?? "A definir"}
                          </span>
                          <span className="font-mono text-bone">{m.scoreB ?? "-"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seletor de Liga */}
            <div className="flex flex-wrap gap-2">
              {ALL_LEAGUES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setSelectedLeagueView(l)}
                  className={`border px-3.5 py-2 font-display text-xs uppercase tracking-widest ${
                    selectedLeagueView === l
                      ? "border-gold bg-gold text-ink"
                      : "border-border bg-black/50 text-muted-foreground hover:text-bone"
                  }`}
                >
                  {l} {l === state.userLeague ? "★" : ""}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="border border-gold/30 bg-card/80 p-5 lg:col-span-6">
                <h3 className="mb-3 font-display text-lg uppercase tracking-wider text-gold">
                  Tabela {selectedLeagueView}
                </h3>
                <div className="overflow-hidden border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/60 text-[10px] uppercase tracking-wider text-gold">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Organização</th>
                        <th className="px-3 py-2 text-center">V-D</th>
                        <th className="px-3 py-2 text-right">Força</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {viewedStandings.map((r, i) => {
                        const t = teamsMap.get(r.teamId);
                        if (!t) return null;
                        return (
                          <tr
                            key={t.id}
                            className={
                              t.id === state.userTeamId
                                ? "bg-gold/15 text-bone"
                                : "bg-black/30 text-muted-foreground"
                            }
                          >
                            <td className="px-3 py-2 font-bold">{i + 1}</td>
                            <td className="px-3 py-2 text-bone">
                              {t.name} ({t.tag})
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-bone">
                              {r.wins}-{r.losses}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gold">
                              {r.ovr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-6">
                {/* Playoffs da liga selecionada */}
                <div className="border border-gold/30 bg-card/80 p-5">
                  <h3 className="mb-3 font-display text-lg uppercase tracking-wider text-gold">
                    Playoffs {selectedLeagueView}
                  </h3>
                  {viewedLeagueState.playoffMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Os Playoffs começam ao fim da temporada regular (Top 4).
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {viewedLeagueState.playoffMatches.map((m) => {
                        const tA = m.teamAId ? teamsMap.get(m.teamAId) : null;
                        const tB = m.teamBId ? teamsMap.get(m.teamBId) : null;
                        return (
                          <div
                            key={m.id}
                            className="border border-gold/25 bg-black/45 p-3 text-xs"
                          >
                            <div className="mb-1 text-[10px] font-bold uppercase text-gold">
                              {m.label} · MD{m.bestOf}
                            </div>
                            <div className="flex justify-between">
                              <span className={m.winnerId === tA?.id ? "font-bold text-gold" : "text-bone"}>
                                {tA?.name ?? "A definir"}
                              </span>
                              <span className="font-mono text-bone">{m.scoreA ?? "-"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={m.winnerId === tB?.id ? "font-bold text-gold" : "text-bone"}>
                                {tB?.name ?? "A definir"}
                              </span>
                              <span className="font-mono text-bone">{m.scoreB ?? "-"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sala de Troféus */}
                <div className="border border-gold/30 bg-card/80 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-lg uppercase tracking-wider text-gold">
                    <Crown className="h-5 w-5" /> Histórico da Carreira
                  </h3>
                  {state.history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum campeonato concluído nesta carreira ainda.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {state.history.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between border border-border/60 bg-black/45 px-3 py-2"
                        >
                          <div>
                            <strong className="text-bone">{h.tournament}</strong>
                            <div className="text-[10px] text-muted-foreground">
                              Campeão: {h.championName} · Vice: {h.runnerUpName}
                            </div>
                          </div>
                          <span className="border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">
                            {h.userPlacement}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Negociação Realista */}
      {negotiatingPlayer && (
        <NegotiationModal
          state={state}
          player={negotiatingPlayer}
          onSubmitOffer={onSubmitTransfer}
          onClose={() => setNegotiatingPlayer(null)}
        />
      )}

      {/* Modal de Partida Ao Vivo */}
      {liveMatchModalOpen &&
        nextUserMatch &&
        nextUserMatch.teamAId &&
        nextUserMatch.teamBId && (
          <LiveCareerMatchModal
            match={nextUserMatch}
            teamA={teamsMap.get(nextUserMatch.teamAId)!}
            teamB={teamsMap.get(nextUserMatch.teamBId)!}
            strengthA={teamCurrentStrength(
              teamsMap.get(nextUserMatch.teamAId)!,
              playersByTeam.get(nextUserMatch.teamAId) ?? [],
              state.staff,
              state.manager,
            )}
            strengthB={teamCurrentStrength(
              teamsMap.get(nextUserMatch.teamBId)!,
              playersByTeam.get(nextUserMatch.teamBId) ?? [],
              state.staff,
              state.manager,
            )}
            onFinish={(res) => {
              setLiveMatchModalOpen(false);
              onAdvanceRound(res);
            }}
            onClose={() => setLiveMatchModalOpen(false)}
          />
        )}

      {/* Modal Confirmar Nova Carreira */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border-2 border-gold bg-ink p-6">
            <h3 className="font-display text-xl uppercase tracking-wider text-gold">
              Reiniciar Modo Carreira?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Isso apaga apenas o save atual do <strong>Modo Carreira Manager</strong> para você
              criar um novo personagem e assumir outro time. Suas ligas e rankings do simulador
              normal não serão alterados.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="border border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-bone"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetCareer();
                }}
                className="bg-blood px-4 py-2 text-xs font-bold uppercase tracking-widest text-bone"
              >
                Apagar e Criar Nova
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
