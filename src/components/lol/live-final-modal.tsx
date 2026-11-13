import { useEffect, useMemo, useRef, useState } from "react";
import {
  FastForward,
  Pause,
  Play,
  Radio,
  Sparkles,
  Swords,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { CareerTeam, Championship, Match, Player, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";
import {
  getMomentumState,
  seasonRecords,
  winProbability,
  type MatchSimulationContext,
} from "@/lib/lol/momentum";
import { effectiveRating, ensureRoster, pickStarters, rosterAverageAttrs } from "@/lib/lol/players";

interface LiveFeedItem {
  id: string;
  timeLabel: string;
  side: "A" | "B" | "neutral";
  text: string;
  important?: boolean;
}

interface FinishedMapSummary {
  mapNumber: number;
  winnerSide: "A" | "B";
  detail: string;
  mvpName?: string;
}

interface MapPlan {
  mapNumber: number;
  winnerSide: "A" | "B";
  gameProbA: number;
  isSilverScrapes: boolean;
  adaptNote?: string;
  durationMins: number;
  targetKillsA: number;
  targetKillsB: number;
  targetRoundsA: number;
  targetRoundsB: number;
  mvpName?: string;
  events: { atStep: number; timeLabel: string; side: "A" | "B" | "neutral"; text: string; important?: boolean }[];
}

function pickStarPlayer(team: Team, preferAttr: keyof Player["attrs"] = "mechanics"): Player | undefined {
  const roster = ensureRoster(team);
  if (!roster || roster.length === 0) return undefined;
  const starters = pickStarters(roster);
  const pool = starters.length > 0 ? starters : roster;
  return [...pool].sort((a, b) => (b.attrs[preferAttr] ?? 60) - (a.attrs[preferAttr] ?? 60))[0];
}

function buildMapPlan(params: {
  mapNumber: number;
  scoreA: number;
  scoreB: number;
  needed: number;
  baseProbA: number;
  lastWinner: "A" | "B" | null;
  teamA: Team;
  teamB: Team;
  isCs2: boolean;
  ctx: MatchSimulationContext;
}): MapPlan {
  const { mapNumber, scoreA, scoreB, needed, baseProbA, lastWinner, teamA, teamB, isCs2, ctx } =
    params;

  let gameProbA = baseProbA;
  let adaptNote: string | undefined;
  const attrsA = ctx.rosterA ? rosterAverageAttrs(ctx.rosterA) : undefined;
  const attrsB = ctx.rosterB ? rosterAverageAttrs(ctx.rosterB) : undefined;

  if (attrsA && attrsB && mapNumber > 1 && lastWinner) {
    if (lastWinner === "B") {
      const adaptBonus = (attrsA.adaptability / 100) * 0.05;
      const tiltPenalty = attrsA.mentality < 50 ? 0.03 : 0;
      gameProbA += adaptBonus - tiltPenalty;
      if (adaptBonus - tiltPenalty >= 0.02) {
        adaptNote = `${teamA.tag} ajustou o draft pós-derrota (+Adaptabilidade)`;
      } else if (tiltPenalty > 0) {
        adaptNote = `${teamA.tag} sentiu a pressão da derrota anterior`;
      }
    } else {
      const adaptBonus = (attrsB.adaptability / 100) * 0.05;
      const tiltPenalty = attrsB.mentality < 50 ? 0.03 : 0;
      gameProbA -= adaptBonus - tiltPenalty;
      if (adaptBonus - tiltPenalty >= 0.02) {
        adaptNote = `${teamB.tag} leu o plano adversário e respondeu no draft`;
      } else if (tiltPenalty > 0) {
        adaptNote = `${teamB.tag} entrou pressionado após perder o mapa`;
      }
    }
  }

  const isSilverScrapes = scoreA === needed - 1 && scoreB === needed - 1 && needed > 1;
  if (isSilverScrapes && attrsA && attrsB) {
    const clutchEdge = ((attrsA.clutch - attrsB.clutch) / 100) * 0.08;
    const mentEdge = ((attrsA.mentality - attrsB.mentality) / 100) * 0.06;
    gameProbA += clutchEdge + mentEdge;
  }

  gameProbA = Math.max(0.05, Math.min(0.95, gameProbA));
  const winnerSide: "A" | "B" = Math.random() < gameProbA ? "A" : "B";
  const winnerTeam = winnerSide === "A" ? teamA : teamB;
  const loserTeam = winnerSide === "A" ? teamB : teamA;

  const starAggroW = pickStarPlayer(winnerTeam, "aggression");
  const starClutchW = pickStarPlayer(winnerTeam, "clutch");
  const starIqW = pickStarPlayer(winnerTeam, "gameIq");
  const starAggroL = pickStarPlayer(loserTeam, "aggression");

  const durationMins = 28 + Math.floor(Math.random() * 14);
  const winKills = 14 + Math.floor(Math.random() * 12);
  const loseKills = Math.max(3, winKills - 4 - Math.floor(Math.random() * 8));
  const targetKillsA = winnerSide === "A" ? winKills : loseKills;
  const targetKillsB = winnerSide === "B" ? winKills : loseKills;

  const loseRounds = 5 + Math.floor(Math.random() * 7);
  const targetRoundsA = winnerSide === "A" ? 13 : loseRounds;
  const targetRoundsB = winnerSide === "B" ? 13 : loseRounds;

  const events: MapPlan["events"] = [];

  if (isSilverScrapes) {
    events.push({
      atStep: 1,
      timeLabel: isCs2 ? "R1" : "00:00",
      side: "neutral",
      text: `⚡ SILVER SCRAPES! Jogo decisivo (${scoreA}×${scoreB}) — Clutch e Mentalidade no limite!`,
      important: true,
    });
  } else if (adaptNote) {
    events.push({
      atStep: 1,
      timeLabel: isCs2 ? "R1" : "00:00",
      side: "neutral",
      text: `📋 Draft do Mapa ${mapNumber}: ${adaptNote}`,
    });
  } else {
    events.push({
      atStep: 1,
      timeLabel: isCs2 ? "R1" : "00:00",
      side: "neutral",
      text: `🎬 Começa o Mapa ${mapNumber} da Grande Final!`,
    });
  }

  if (isCs2) {
    const firstSide: "A" | "B" = Math.random() < 0.55 ? winnerSide : winnerSide === "A" ? "B" : "A";
    const firstTeam = firstSide === "A" ? teamA : teamB;
    const firstPlayer = firstSide === "A" ? starAggroW : starAggroL;
    events.push({
      atStep: 3,
      timeLabel: "R4",
      side: firstSide,
      text: `${firstTeam.tag} vence o Pistol e abre vantagem!${firstPlayer ? ` Destaque inicial para ${firstPlayer.ign}.` : ""}`,
    });
    events.push({
      atStep: 6,
      timeLabel: "R13",
      side: winnerSide,
      text: `${starClutchW ? `${starClutchW.ign} garante clutch absurdo` : winnerTeam.tag} vira a metade e assume o controle do mapa!`,
      important: true,
    });
    events.push({
      atStep: 9,
      timeLabel: `R${targetRoundsA + targetRoundsB - 1}`,
      side: winnerSide,
      text: `${winnerTeam.tag} fecha o mapa (${targetRoundsA}×${targetRoundsB}) no match point!`,
      important: true,
    });
  } else {
    const fbSide: "A" | "B" = Math.random() < 0.6 ? winnerSide : winnerSide === "A" ? "B" : "A";
    const fbTeam = fbSide === "A" ? teamA : teamB;
    const fbPlayer = fbSide === "A" ? starAggroW : starAggroL;
    events.push({
      atStep: 3,
      timeLabel: "04:15",
      side: fbSide,
      text: `🩸 FIRST BLOOD! ${fbPlayer ? `${fbPlayer.ign} (${fbTeam.tag})` : fbTeam.tag} abre o placar no início de jogo!`,
    });
    events.push({
      atStep: 5,
      timeLabel: `${Math.round(durationMins * 0.45)}:20`,
      side: winnerSide,
      text: `🐉 Luta pelo objetivo! ${starIqW ? `${starIqW.ign} comanda o macro da ${winnerTeam.tag}` : winnerTeam.tag} vence a escaramuça e abre vantagem no ouro.`,
    });
    events.push({
      atStep: 8,
      timeLabel: `${Math.round(durationMins * 0.78)}:40`,
      side: winnerSide,
      text: `👾 BARÃO! ${starClutchW ? `${starClutchW.ign} (Clutch ${starClutchW.attrs.clutch}) brilha na teamfight decisiva` : `${winnerTeam.tag} atropela no Barão`} e marcha para a base!`,
      important: true,
    });
    events.push({
      atStep: 10,
      timeLabel: `${durationMins}:00`,
      side: winnerSide,
      text: `💥 NEXUS DESTRUÍDO! ${winnerTeam.tag} vence o Mapa ${mapNumber}!`,
      important: true,
    });
  }

  return {
    mapNumber,
    winnerSide,
    gameProbA,
    isSilverScrapes,
    adaptNote,
    durationMins,
    targetKillsA,
    targetKillsB,
    targetRoundsA,
    targetRoundsB,
    mvpName: starClutchW?.ign ?? starAggroW?.ign,
    events,
  };
}

export function LiveFinalModal({
  championship,
  match,
  teamA,
  teamB,
  career,
  onFinish,
  onClose,
}: {
  championship: Championship;
  match: Match;
  teamA: Team;
  teamB: Team;
  career?: Record<string, CareerTeam>;
  onFinish: (winnerId: string, score: { a: number; b: number }) => void;
  onClose: () => void;
}) {
  const isCs2 = (championship.game ?? "lol") === "cs2";
  const needed = Math.ceil(match.bestOf / 2);

  // Calcula probabilidade inicial exatamente com a mesma engine do simulador
  const simContext = useMemo(() => {
    const rec = seasonRecords(championship.phases);
    const m = championship.momentum ?? {};
    const ratingFor = (t: Team): number => {
      const ledger = t.name ? (career?.[t.name.trim().toLowerCase()]?.rating ?? 50) : 50;
      return effectiveRating(ledger, ensureRoster(t), t.synergy, t.culture);
    };
    const isIntl =
      championship.internationalLevel === "minor" ||
      championship.internationalLevel === "major" ||
      /world|msi|global master|supercopa|desafiante|rift|kickoff|first stand/i.test(
        championship.name ?? "",
      );
    const ctx: MatchSimulationContext = {
      isIntl: !!isIntl,
      isPlayoff: true,
      isFinal: true,
      rosterA: ensureRoster(teamA),
      rosterB: ensureRoster(teamB),
      teamA,
      teamB,
    };
    const baseProbA = winProbability(
      rec.get(teamA.id),
      rec.get(teamB.id),
      getMomentumState(m, teamA.id).form,
      getMomentumState(m, teamB.id).form,
      ratingFor(teamA),
      ratingFor(teamB),
      ctx,
    );
    return {
      baseProbA,
      ctx,
      ratingA: Math.round(ratingFor(teamA)),
      ratingB: Math.round(ratingFor(teamB)),
    };
  }, [championship, career, teamA, teamB]);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [step, setStep] = useState(0); // 0..10 dentro do mapa atual
  const [finishedMaps, setFinishedMaps] = useState<FinishedMapSummary[]>([]);
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<MapPlan>(() =>
    buildMapPlan({
      mapNumber: 1,
      scoreA: 0,
      scoreB: 0,
      needed,
      baseProbA: simContext.baseProbA,
      lastWinner: null,
      teamA,
      teamB,
      isCs2,
      ctx: simContext.ctx,
    }),
  );

  const seriesWinnerSide: "A" | "B" | null =
    scoreA >= needed ? "A" : scoreB >= needed ? "B" : null;
  const committedRef = useRef(false);

  // Avança os ticks ao vivo do mapa atual
  useEffect(() => {
    if (paused || seriesWinnerSide) return;

    const tickMs = speed === 4 ? 140 : speed === 2 ? 300 : 580;
    const timer = window.setInterval(() => {
      setStep((prevStep) => {
        const nextStep = prevStep + 1;

        // Publica eventos programados para esse tick
        const matchingEvents = currentPlan.events.filter((e) => e.atStep === nextStep);
        if (matchingEvents.length > 0) {
          setFeed((prevFeed) => [
            ...matchingEvents.map((ev, idx) => ({
              id: `${currentPlan.mapNumber}-${nextStep}-${idx}`,
              timeLabel: `M${currentPlan.mapNumber} · ${ev.timeLabel}`,
              side: ev.side,
              text: ev.text,
              important: ev.important,
            })),
            ...prevFeed,
          ]);
        }

        if (nextStep >= 10) {
          // Finaliza o mapa atual e atualiza o placar da série ao vivo!
          const newA = scoreA + (currentPlan.winnerSide === "A" ? 1 : 0);
          const newB = scoreB + (currentPlan.winnerSide === "B" ? 1 : 0);
          const winTeam = currentPlan.winnerSide === "A" ? teamA : teamB;

          setScoreA(newA);
          setScoreB(newB);
          setFinishedMaps((prev) => [
            ...prev,
            {
              mapNumber: currentPlan.mapNumber,
              winnerSide: currentPlan.winnerSide,
              detail: isCs2
                ? `${currentPlan.targetRoundsA} × ${currentPlan.targetRoundsB}`
                : `${currentPlan.targetKillsA} × ${currentPlan.targetKillsB} abates (${currentPlan.durationMins}:00)`,
              mvpName: currentPlan.mvpName,
            },
          ]);

          if (newA < needed && newB < needed) {
            setCurrentPlan(
              buildMapPlan({
                mapNumber: currentPlan.mapNumber + 1,
                scoreA: newA,
                scoreB: newB,
                needed,
                baseProbA: simContext.baseProbA,
                lastWinner: currentPlan.winnerSide,
                teamA,
                teamB,
                isCs2,
                ctx: simContext.ctx,
              }),
            );
            return 0;
          } else {
            setFeed((prevFeed) => [
              {
                id: `champ-${Date.now()}`,
                timeLabel: "FIM DE JOGO",
                side: currentPlan.winnerSide,
                text: `🏆 ${winTeam.name.toUpperCase()} VENCE A GRANDE FINAL POR ${newA} × ${newB} E CONQUISTA O TÍTULO!`,
                important: true,
              },
              ...prevFeed,
            ]);
            return 10;
          }
        }
        return nextStep;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [paused, speed, seriesWinnerSide, currentPlan, scoreA, scoreB, needed, teamA, teamB, isCs2, simContext]);

  const finishCurrentMapNow = () => {
    if (seriesWinnerSide) return;
    const newA = scoreA + (currentPlan.winnerSide === "A" ? 1 : 0);
    const newB = scoreB + (currentPlan.winnerSide === "B" ? 1 : 0);
    const winTeam = currentPlan.winnerSide === "A" ? teamA : teamB;
    setScoreA(newA);
    setScoreB(newB);
    setFinishedMaps((prev) => [
      ...prev,
      {
        mapNumber: currentPlan.mapNumber,
        winnerSide: currentPlan.winnerSide,
        detail: isCs2
          ? `${currentPlan.targetRoundsA} × ${currentPlan.targetRoundsB}`
          : `${currentPlan.targetKillsA} × ${currentPlan.targetKillsB} abates (${currentPlan.durationMins}:00)`,
        mvpName: currentPlan.mvpName,
      },
    ]);
    setFeed((prev) => [
      {
        id: `skip-${currentPlan.mapNumber}-${Date.now()}`,
        timeLabel: `M${currentPlan.mapNumber}`,
        side: currentPlan.winnerSide,
        text: `💥 ${winTeam.tag} vence o Mapa ${currentPlan.mapNumber}! Placar da série: ${newA} × ${newB}`,
        important: true,
      },
      ...prev,
    ]);
    if (newA < needed && newB < needed) {
      setCurrentPlan(
        buildMapPlan({
          mapNumber: currentPlan.mapNumber + 1,
          scoreA: newA,
          scoreB: newB,
          needed,
          baseProbA: simContext.baseProbA,
          lastWinner: currentPlan.winnerSide,
          teamA,
          teamB,
          isCs2,
          ctx: simContext.ctx,
        }),
      );
      setStep(0);
    } else {
      setStep(10);
    }
  };

  const handleConfirmAndClose = () => {
    if (seriesWinnerSide && !committedRef.current) {
      committedRef.current = true;
      const winnerId = seriesWinnerSide === "A" ? teamA.id : teamB.id;
      onFinish(winnerId, { a: scoreA, b: scoreB });
    }
    onClose();
  };

  // Placar parcial dentro do mapa atual (evolui ao vivo conforme step 0..10)
  const progress = step / 10;
  const liveInGameA = isCs2
    ? Math.min(currentPlan.targetRoundsA, Math.round(currentPlan.targetRoundsA * progress))
    : Math.round(currentPlan.targetKillsA * progress);
  const liveInGameB = isCs2
    ? Math.min(currentPlan.targetRoundsB, Math.round(currentPlan.targetRoundsB * progress))
    : Math.round(currentPlan.targetKillsB * progress);
  const liveClockMins = Math.min(currentPlan.durationMins, Math.round(currentPlan.durationMins * progress));
  const probAPct = Math.round(currentPlan.gameProbA * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border-2 border-gold bg-[#0b0d13] shadow-[0_0_50px_rgba(200,170,110,0.25)]">
        {/* Top Broadcast Bar */}
        <div className="flex items-center justify-between border-b border-gold/30 bg-gradient-to-r from-blood/25 via-gold/10 to-blood/25 px-5 py-3">
          <div className="flex items-center gap-3">
            {!seriesWinnerSide ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-blood px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                <Radio className="h-3 w-3 animate-pulse" /> AO VIVO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink">
                <Trophy className="h-3 w-3" /> FINALIZADA
              </span>
            )}
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-widest text-gold">
                {championship.name} {championship.season ? `· ${championship.season}` : ""}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Grande Final • Melhor de {match.bestOf} (Vence quem fizer {needed})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConfirmAndClose}
            className="rounded border border-border p-1.5 text-muted-foreground transition-colors hover:border-gold hover:text-bone"
            title={seriesWinnerSide ? "Salvar título e fechar" : "Fechar transmissão"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main Scoreboard */}
        <div className="border-b border-border/60 bg-gradient-to-b from-[#131722] to-[#0b0d13] px-6 py-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Team A */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`rounded-xl border-2 p-2 transition-all ${
                  seriesWinnerSide === "A"
                    ? "border-gold bg-gold/15 shadow-[0_0_24px_rgba(200,170,110,0.4)]"
                    : "border-border/70 bg-black/40"
                }`}
              >
                <TeamLogo team={teamA} size={56} />
              </div>
              <span className="mt-2 font-display text-xl font-bold uppercase tracking-wider text-bone">
                {teamA.name}
              </span>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <span>{teamA.region || "REG"}</span>
                <span>•</span>
                <span className="text-gold">Força {simContext.ratingA}</span>
              </div>
              {/* Pips de vitória */}
              <div className="mt-2 flex gap-1.5">
                {Array.from({ length: needed }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-6 rounded-sm border transition-all ${
                      i < scoreA
                        ? "border-gold bg-gold shadow-[0_0_8px_rgba(200,170,110,0.7)]"
                        : "border-border bg-black/50"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Placar Gigante da Série */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-black/70 px-5 py-3 shadow-inner">
                <span
                  className={`font-display text-5xl font-black tabular-nums transition-all ${
                    seriesWinnerSide === "A" ? "text-gold" : "text-bone"
                  }`}
                >
                  {scoreA}
                </span>
                <span className="font-display text-2xl text-gold/60">×</span>
                <span
                  className={`font-display text-5xl font-black tabular-nums transition-all ${
                    seriesWinnerSide === "B" ? "text-gold" : "text-bone"
                  }`}
                >
                  {scoreB}
                </span>
              </div>
              {!seriesWinnerSide ? (
                <div className="mt-2.5 flex flex-col items-center gap-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      currentPlan.isSilverScrapes
                        ? "border border-gold bg-gold/20 text-gold animate-pulse"
                        : "border border-border bg-black/60 text-muted-foreground"
                    }`}
                  >
                    {currentPlan.isSilverScrapes
                      ? `⚡ Mapa ${currentPlan.mapNumber} · Silver Scrapes`
                      : `Mapa ${currentPlan.mapNumber} em andamento`}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-xs text-bone/90">
                    <span className="text-gold">{teamA.tag}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 font-bold">
                      {liveInGameA} × {liveInGameB}
                    </span>
                    <span className="text-gold">{teamB.tag}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {isCs2 ? "(Rounds)" : `(${String(liveClockMins).padStart(2, "0")}:00)`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1.5 rounded-full border border-gold bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">
                  <Trophy className="h-3.5 w-3.5" />
                  Campeão: {seriesWinnerSide === "A" ? teamA.name : teamB.name}
                </div>
              )}
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`rounded-xl border-2 p-2 transition-all ${
                  seriesWinnerSide === "B"
                    ? "border-gold bg-gold/15 shadow-[0_0_24px_rgba(200,170,110,0.4)]"
                    : "border-border/70 bg-black/40"
                }`}
              >
                <TeamLogo team={teamB} size={56} />
              </div>
              <span className="mt-2 font-display text-xl font-bold uppercase tracking-wider text-bone">
                {teamB.name}
              </span>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <span>{teamB.region || "REG"}</span>
                <span>•</span>
                <span className="text-gold">Força {simContext.ratingB}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {Array.from({ length: needed }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-6 rounded-sm border transition-all ${
                      i < scoreB
                        ? "border-gold bg-gold shadow-[0_0_8px_rgba(200,170,110,0.7)]"
                        : "border-border bg-black/50"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Barra de Progresso do Mapa + Probabilidade ao Vivo */}
          {!seriesWinnerSide ? (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>
                  Chance no Mapa {currentPlan.mapNumber}: {teamA.tag} {probAPct}%
                </span>
                <span>Progresso do Mapa: {step * 10}%</span>
                <span>
                  {100 - probAPct}% {teamB.tag}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/60 border border-border/50">
                <div
                  className="h-full bg-gradient-to-r from-blood via-gold to-emerald-400 transition-all duration-300"
                  style={{ width: `${step * 10}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Feed Ao Vivo + Mapas Concluídos */}
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-5">
          {/* Lado Esquerdo: Narração ao Vivo */}
          <div className="flex flex-col md:col-span-3">
            <h4 className="mb-2 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-gold">
              <Zap className="h-3.5 w-3.5" /> Transmissão Minuto a Minuto
            </h4>
            <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-black/40 p-3 max-h-60">
              {feed.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Times entrando em Summoner&apos;s Rift... preparando transmissão ao vivo!
                </p>
              ) : (
                feed.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded border px-3 py-2 text-xs transition-all ${
                      item.important
                        ? "border-gold/60 bg-gold/10 text-bone font-medium"
                        : "border-border/40 bg-card/40 text-muted-foreground"
                    }`}
                  >
                    <span className="mr-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gold">
                      {item.timeLabel}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Lado Direito: Resumo dos Mapas */}
          <div className="flex flex-col md:col-span-2">
            <h4 className="mb-2 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-gold">
              <Swords className="h-3.5 w-3.5" /> Placar por Mapa
            </h4>
            <div className="space-y-2 rounded-lg border border-border/60 bg-black/40 p-3 max-h-60 overflow-y-auto">
              {finishedMaps.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum mapa finalizado ainda.
                </p>
              ) : (
                finishedMaps.map((m) => {
                  const wTeam = m.winnerSide === "A" ? teamA : teamB;
                  return (
                    <div
                      key={m.mapNumber}
                      className="flex items-center justify-between rounded border border-border/50 bg-card/50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          M{m.mapNumber}
                        </span>
                        <TeamLogo team={wTeam} size={20} />
                        <div>
                          <div className="font-bold text-bone">{wTeam.tag} venceu</div>
                          <div className="text-[10px] text-muted-foreground">{m.detail}</div>
                        </div>
                      </div>
                      {m.mvpName ? (
                        <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-gold">
                          ★ {m.mvpName}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/30 bg-[#0f121a] px-5 py-3">
          {!seriesWinnerSide ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/20"
                >
                  {paused ? (
                    <>
                      <Play className="h-3.5 w-3.5" /> Retomar
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Pausar
                    </>
                  )}
                </button>
                <div className="flex overflow-hidden rounded border border-border">
                  {([1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeed(spd)}
                      className={`px-2.5 py-1.5 font-mono text-xs font-bold transition-colors ${
                        speed === spd
                          ? "bg-gold text-ink"
                          : "bg-black/40 text-muted-foreground hover:text-bone"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={finishCurrentMapNow}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-black/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold hover:text-gold"
              >
                <FastForward className="h-3.5 w-3.5" /> Pular para fim do Mapa {currentPlan.mapNumber}
              </button>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-xs font-semibold text-emerald-400">
                ✓ Grande Final concluída ({scoreA} × {scoreB})! Clique ao lado para gravar e celebrar.
              </span>
              <button
                type="button"
                onClick={handleConfirmAndClose}
                className="inline-flex items-center gap-2 rounded border-2 border-gold bg-gold px-4 py-2 font-display text-xs font-black uppercase tracking-widest text-ink shadow-md hover:bg-gold/90"
              >
                <Sparkles className="h-4 w-4" /> Confirmar Título &amp; Celebrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
