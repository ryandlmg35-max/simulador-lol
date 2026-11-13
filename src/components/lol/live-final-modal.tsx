import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { useStore } from "@/lib/lol/store";
import { seriesRanking } from "@/lib/lol/promotion";

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

interface MapStepSnapshot {
  inGameA: number;
  inGameB: number;
  clockMins: number;
  liveProbA: number;
}

interface MapPlan {
  mapNumber: number;
  winnerSide: "A" | "B";
  gameProbA: number;
  isSilverScrapes: boolean;
  isComeback: boolean;
  adaptNote?: string;
  durationMins: number;
  targetKillsA: number;
  targetKillsB: number;
  targetRoundsA: number;
  targetRoundsB: number;
  mvpName?: string;
  snapshots: MapStepSnapshot[]; // índice 0..10
  events: { atStep: number; timeLabel: string; side: "A" | "B" | "neutral"; text: string; important?: boolean }[];
}

function pickStarPlayer(team: Team, preferAttr: keyof Player["attrs"] = "mechanics"): Player | undefined {
  const roster = ensureRoster(team);
  if (!roster || roster.length === 0) return undefined;
  const starters = pickStarters(roster);
  const pool = starters.length > 0 ? starters : roster;
  return [...pool].sort((a, b) => (b.attrs[preferAttr] ?? 60) - (a.attrs[preferAttr] ?? 60))[0];
}

function pickRandomStarter(team: Team): Player | undefined {
  const roster = ensureRoster(team);
  if (!roster || roster.length === 0) return undefined;
  const starters = pickStarters(roster);
  const pool = starters.length > 0 ? starters : roster;
  return pool[Math.floor(Math.random() * pool.length)];
}

function clampProb(p: number): number {
  return Math.max(0.06, Math.min(0.94, p));
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
  isGrandFinal: boolean;
  ctx: MatchSimulationContext;
}): MapPlan {
  const { mapNumber, scoreA, scoreB, needed, baseProbA, lastWinner, teamA, teamB, isCs2, isGrandFinal, ctx } =
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

  gameProbA = Math.max(0.08, Math.min(0.92, gameProbA));

  // ---------- SIMULAÇÃO DINÂMICA POR FASES DO MAPA ----------
  // Em vez de definir tudo de forma linear, simulamos Early -> Mid -> Late.
  // Um time pode abrir 7x2 no início e ainda assim sofrer virada no Barão/Ancião!
  const aggroEdgeA = attrsA && attrsB ? ((attrsA.aggression - attrsB.aggression) / 100) * 0.14 : 0;
  const iqEdgeA = attrsA && attrsB ? ((attrsA.gameIq - attrsB.gameIq) / 100) * 0.14 : 0;
  const clutchEdgeA = attrsA && attrsB ? ((attrsA.clutch - attrsB.clutch) / 100) * 0.16 : 0;

  // Fator de ritmo/script do mapa:
  // "comeback" (~30%), "brawl" (~25%), "tactical" (~25%), "stomp" (~20%)
  const roll = Math.random();
  const archetype: "comeback" | "brawl" | "tactical" | "stomp" =
    roll < 0.30 ? "comeback" : roll < 0.55 ? "brawl" : roll < 0.80 ? "tactical" : "stomp";

  const earlyProbA = clampProb(gameProbA + aggroEdgeA + (Math.random() - 0.5) * 0.22);
  const earlyLeader: "A" | "B" = Math.random() < earlyProbA ? "A" : "B";
  const earlyTrailer: "A" | "B" = earlyLeader === "A" ? "B" : "A";

  let midLeader: "A" | "B" = earlyLeader;
  let winnerSide: "A" | "B";

  if (archetype === "stomp") {
    // Snowball limpo do líder inicial (mas ainda com pequena chance de susto)
    winnerSide = Math.random() < 0.9 ? earlyLeader : earlyTrailer;
  } else if (archetype === "comeback") {
    // O time que saiu atrás escala melhor ou força erro no mid/late
    const trailerIsA = earlyTrailer === "A";
    const comebackBonus = trailerIsA
      ? gameProbA + clutchEdgeA + iqEdgeA * 0.5
      : 1 - gameProbA - clutchEdgeA - iqEdgeA * 0.5;
    // Se o time que saiu atrás tem boa base/clutch, vira com frequência!
    winnerSide = Math.random() < clampProb(0.55 + (comebackBonus - 0.5) * 0.5) ? earlyTrailer : earlyLeader;
    midLeader = Math.random() < 0.6 ? earlyLeader : earlyTrailer;
  } else if (archetype === "brawl") {
    // Jogo caótico e equilibrado, alternando liderança no mid
    midLeader = Math.random() < 0.5 ? earlyTrailer : earlyLeader;
    const lateProbA = clampProb(gameProbA + clutchEdgeA + (midLeader === "A" ? 0.05 : -0.05));
    winnerSide = Math.random() < lateProbA ? "A" : "B";
  } else {
    // Jogo tático decidido no macro e objetivos neutros
    const midProbA = clampProb(gameProbA + iqEdgeA);
    midLeader = Math.random() < midProbA ? "A" : "B";
    const lateProbA = clampProb(gameProbA + iqEdgeA * 0.6 + clutchEdgeA * 0.8 + (midLeader === "A" ? 0.08 : -0.08));
    winnerSide = Math.random() < lateProbA ? "A" : "B";
  }

  const isComeback = earlyLeader !== winnerSide;
  const winnerTeam = winnerSide === "A" ? teamA : teamB;
  const loserTeam = winnerSide === "A" ? teamB : teamA;
  const earlyLeaderTeam = earlyLeader === "A" ? teamA : teamB;
  const earlyTrailerTeam = earlyTrailer === "A" ? teamA : teamB;

  const starAggroW = pickStarPlayer(winnerTeam, "aggression");
  const starClutchW = pickStarPlayer(winnerTeam, "clutch");
  const starIqW = pickStarPlayer(winnerTeam, "gameIq");
  const starAggroL = pickStarPlayer(loserTeam, "aggression");
  const starClutchL = pickStarPlayer(loserTeam, "clutch");
  const randomWinnerPlayer = pickRandomStarter(winnerTeam);
  const randomLoserPlayer = pickRandomStarter(loserTeam);

  const durationMins = isCs2
    ? 34 + Math.floor(Math.random() * 14)
    : archetype === "stomp"
      ? 25 + Math.floor(Math.random() * 6)
      : archetype === "brawl" || isComeback
        ? 34 + Math.floor(Math.random() * 12)
        : 29 + Math.floor(Math.random() * 9);

  const events: MapPlan["events"] = [];
  const snapshots: MapStepSnapshot[] = [];

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
      text: isGrandFinal
        ? `🎬 Começa o Mapa ${mapNumber} da Grande Final!`
        : `🎬 Começa o Mapa ${mapNumber}!`,
    });
  }

  let targetKillsA = 0;
  let targetKillsB = 0;
  let targetRoundsA = 0;
  let targetRoundsB = 0;

  if (isCs2) {
    const overtime = archetype === "brawl" || (isComeback && Math.random() < 0.45);
    const winRounds = overtime ? 16 : 13;
    const loseRounds = overtime
      ? 12 + Math.floor(Math.random() * 3)
      : archetype === "stomp"
        ? 4 + Math.floor(Math.random() * 4)
        : 8 + Math.floor(Math.random() * 4);

    targetRoundsA = winnerSide === "A" ? winRounds : loseRounds;
    targetRoundsB = winnerSide === "B" ? winRounds : loseRounds;

    // Constrói progressão realista de rounds em 10 passos (ex: líder inicial abre 7x3 e sofre virada para 11x13)
    const halfWinEarly = isComeback ? 8 + Math.floor(Math.random() * 2) : archetype === "stomp" ? 9 : 6 + Math.floor(Math.random() * 2);
    const halfLoseEarly = 12 - halfWinEarly;
    const halfA = earlyLeader === "A" ? halfWinEarly : halfLoseEarly;
    const halfB = earlyLeader === "B" ? halfWinEarly : halfLoseEarly;

    for (let s = 0; s <= 10; s++) {
      let rA = 0;
      let rB = 0;
      if (s <= 5) {
        const t = s / 5;
        rA = Math.round(halfA * t);
        rB = Math.round(halfB * t);
      } else {
        const t = (s - 5) / 5;
        rA = Math.round(halfA + (targetRoundsA - halfA) * t);
        rB = Math.round(halfB + (targetRoundsB - halfB) * t);
      }
      const roundDiff = rA - rB;
      const liveProbA = s === 10
        ? (winnerSide === "A" ? 0.99 : 0.01)
        : clampProb(gameProbA + roundDiff * 0.045);
      snapshots.push({
        inGameA: rA,
        inGameB: rB,
        clockMins: Math.round((durationMins * s) / 10),
        liveProbA,
      });
    }

    const firstPlayer = earlyLeader === winnerSide ? starAggroW : starAggroL;
    events.push({
      atStep: 2,
      timeLabel: "R3",
      side: earlyLeader,
      text: `🔫 ${earlyLeaderTeam.tag} vence o Pistol e os ecos iniciais!${firstPlayer ? ` ${firstPlayer.ign} abre 3 abates rápidos.` : ""}`,
    });

    if (isComeback) {
      events.push({
        atStep: 5,
        timeLabel: "R12",
        side: earlyLeader,
        text: `📊 Fim de metade: ${earlyLeaderTeam.tag} abre vantagem de ${Math.max(halfA, halfB)}×${Math.min(halfA, halfB)} na troca de lados.`,
      });
      events.push({
        atStep: 7,
        timeLabel: `R${Math.min(22, halfA + halfB + 5)}`,
        side: winnerSide,
        text: `🔥 VIRADA EM CURSO! ${starClutchW ? `${starClutchW.ign} vence 1v3 impossível no eco` : `${winnerTeam.tag} encaixa 5 rounds seguidos`} e quebra a economia rival!`,
        important: true,
      });
    } else {
      events.push({
        atStep: 5,
        timeLabel: "R12",
        side: midLeader,
        text: `🔄 Virada de lado equilibrada (${halfA}×${halfB})! Tudo aberto para a segunda metade.`,
      });
      events.push({
        atStep: 7,
        timeLabel: `R${Math.min(22, halfA + halfB + 6)}`,
        side: winnerSide,
        text: `💣 ${starClutchW ? `${starClutchW.ign} garante clutch decisivo no bombsite` : `${winnerTeam.tag} encaixa execução perfeita`} e assume o controle!`,
        important: true,
      });
    }

    events.push({
      atStep: 9,
      timeLabel: `R${targetRoundsA + targetRoundsB - 1}`,
      side: winnerSide,
      text: overtime
        ? `⚡ PRORROGAÇÃO ÉPICA! ${winnerTeam.tag} fecha no limite (${targetRoundsA}×${targetRoundsB})!`
        : `🏆 ${winnerTeam.tag} converte o match point e fecha o mapa (${targetRoundsA}×${targetRoundsB})!`,
      important: true,
    });
  } else {
    // ---------- LEAGUE OF LEGENDS: ABATES PASSO A PASSO COM VIRADAS REAIS ----------
    // Em jogos difíceis ou de virada, o vencedor pode até terminar com MENOS kills que o perdedor
    // ou virar o placar de kills só nos últimos 10 minutos!
    const macroStealWin = isComeback && Math.random() < 0.35;
    let curA = 0;
    let curB = 0;
    snapshots.push({ inGameA: 0, inGameB: 0, clockMins: 0, liveProbA: gameProbA });

    const sideKills = (side: "A" | "B", n: number) => {
      if (side === "A") curA += n;
      else curB += n;
    };

    for (let s = 1; s <= 10; s++) {
      const clockMins = Math.round((durationMins * s) / 10);

      if (s === 1) {
        // Minuto 3: lane phase tranquila ou invade
        if (Math.random() < 0.45) sideKills(earlyLeader, 1);
      } else if (s === 2 || s === 3) {
        // Early game (6-11 min): quem saiu na frente abre vantagem real em kills
        const burst = archetype === "stomp" ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
        sideKills(earlyLeader, burst);
        if (Math.random() < 0.45) sideKills(earlyTrailer, 1);
      } else if (s === 4 || s === 5) {
        // Mid game inicial (12-18 min)
        if (isComeback) {
          // O time que vai perder ainda está na frente! (Ex: 8x3 ou 9x4)
          sideKills(earlyLeader, 1 + Math.floor(Math.random() * 2));
          if (Math.random() < 0.6) sideKills(earlyTrailer, 1);
        } else if (archetype === "brawl") {
          sideKills("A", 1 + Math.floor(Math.random() * 2));
          sideKills("B", 1 + Math.floor(Math.random() * 2));
        } else {
          sideKills(midLeader, 1 + Math.floor(Math.random() * 2));
          if (Math.random() < 0.5) sideKills(midLeader === "A" ? "B" : "A", 1);
        }
      } else if (s === 6 || s === 7) {
        // Luta por dragão/barão (20-26 min): ponto de inflexão!
        if (isComeback) {
          // Time que estava atrás começa a reagir em teamfights!
          sideKills(winnerSide, 2 + Math.floor(Math.random() * 3));
          if (Math.random() < 0.55) sideKills(loserTeam === teamA ? "A" : "B", 1);
        } else if (archetype === "brawl") {
          sideKills("A", 2 + Math.floor(Math.random() * 2));
          sideKills("B", 2 + Math.floor(Math.random() * 2));
        } else if (archetype === "tactical") {
          sideKills(winnerSide, 1 + Math.floor(Math.random() * 2));
          if (Math.random() < 0.4) sideKills(loserTeam === teamA ? "A" : "B", 1);
        } else {
          sideKills(winnerSide, 2 + Math.floor(Math.random() * 2));
        }
      } else if (s === 8 || s === 9) {
        // Late game / Barão / Ancião (28-36 min)
        if (macroStealWin) {
          // Vence por macro/roubo de Barão + backdoor/base push mesmo sem atropelar em kills
          sideKills(winnerSide, 1 + Math.floor(Math.random() * 2));
          sideKills(loserTeam === teamA ? "A" : "B", 1);
        } else if (isComeback) {
          // Grande teamfight da virada (ACE / 4 abates)
          sideKills(winnerSide, 3 + Math.floor(Math.random() * 2));
          if (Math.random() < 0.4) sideKills(loserTeam === teamA ? "A" : "B", 1);
        } else {
          sideKills(winnerSide, 2 + Math.floor(Math.random() * 3));
          if (archetype === "brawl") sideKills(loserTeam === teamA ? "A" : "B", 1 + Math.floor(Math.random() * 2));
        }
      } else if (s === 10) {
        // Push final pro Nexus
        sideKills(winnerSide, macroStealWin ? 2 : 3 + Math.floor(Math.random() * 2));
        if (!macroStealWin && isComeback) {
          // Garante que uma virada épica termine disputada ou com o vencedor passando à frente no final
          const winNow = winnerSide === "A" ? curA : curB;
          const loseNow = winnerSide === "A" ? curB : curA;
          if (winNow < loseNow - 2) {
            sideKills(winnerSide, loseNow - winNow);
          }
        }
      }

      const killDiff = curA - curB;
      let liveProbA: number;
      if (s === 10) {
        liveProbA = winnerSide === "A" ? 0.99 : 0.01;
      } else {
        // A probabilidade ao vivo reage aos abates atuais + escala conforme se aproxima do late game
        const killInfluence = killDiff * 0.038;
        const latePull = s >= 7 ? ((winnerSide === "A" ? 0.14 : -0.14) * ((s - 6) / 3)) : 0;
        liveProbA = clampProb(gameProbA + killInfluence + latePull);
      }

      snapshots.push({
        inGameA: curA,
        inGameB: curB,
        clockMins,
        liveProbA,
      });
    }

    targetKillsA = curA;
    targetKillsB = curB;

    // ---------- NARRAÇÃO VARIADA CONFORME O QUE REALMENTE ACONTECEU ----------
    const fbPlayer = earlyLeader === winnerSide ? starAggroW : starAggroL;
    events.push({
      atStep: 2,
      timeLabel: `${String(snapshots[2].clockMins).padStart(2, "0")}:15`,
      side: earlyLeader,
      text: `🩸 FIRST BLOOD! ${fbPlayer ? `${fbPlayer.ign} (${earlyLeaderTeam.tag})` : earlyLeaderTeam.tag} garante o primeiro abate e pressiona o mapa!`,
    });

    if (isComeback) {
      const earlyScoreText = `${snapshots[4].inGameA}×${snapshots[4].inGameB}`;
      events.push({
        atStep: 4,
        timeLabel: `${String(snapshots[4].clockMins).padStart(2, "0")}:30`,
        side: earlyLeader,
        text: `⚡ Pressão total da ${earlyLeaderTeam.tag}! Abre vantagem (${earlyScoreText}) nos abates e derruba as torres externas.`,
      });
      events.push({
        atStep: 6,
        timeLabel: `${String(snapshots[6].clockMins).padStart(2, "0")}:45`,
        side: winnerSide,
        text: `🛡️ Defesa heróica! ${starClutchW ? `${starClutchW.ign} segura o cerco da ${winnerTeam.tag}` : `${winnerTeam.tag} segura a base`} e pune o avanço rival — o jogo esquenta!`,
        important: true,
      });
      events.push({
        atStep: 8,
        timeLabel: `${String(snapshots[8].clockMins).padStart(2, "0")}:20`,
        side: winnerSide,
        text: macroStealWin
          ? `🤯 ROUBO HISTÓRICO DE BARÃO! ${randomWinnerPlayer ? `${randomWinnerPlayer.ign} (${winnerTeam.tag})` : winnerTeam.tag} rouba o objetivo no 50/50 mesmo atrás no placar!`
          : `🔥 VIRADA INACREDITÁVEL! ${starClutchW ? `${starClutchW.ign} (Clutch ${starClutchW.attrs.clutch}) destrói a teamfight` : `${winnerTeam.tag} aplica ACE`} e vira o momento do jogo!`,
        important: true,
      });
    } else if (archetype === "brawl") {
      events.push({
        atStep: 4,
        timeLabel: `${String(snapshots[4].clockMins).padStart(2, "0")}:10`,
        side: "neutral",
        text: `⚔️ Jogo sangrento! ${teamA.tag} e ${teamB.tag} trocam abates sem parar (${snapshots[4].inGameA}×${snapshots[4].inGameB}) pela Alma do Dragão.`,
      });
      events.push({
        atStep: 6,
        timeLabel: `${String(snapshots[6].clockMins).padStart(2, "0")}:50`,
        side: earlyTrailer,
        text: `🐉 ${starClutchL && earlyTrailer !== winnerSide ? starClutchL.ign : earlyTrailerTeam.tag} responde com pickoff no mid e impede o snowball!`,
      });
      events.push({
        atStep: 8,
        timeLabel: `${String(snapshots[8].clockMins).padStart(2, "0")}:40`,
        side: winnerSide,
        text: `👾 DRAGÃO ANCIÃO & BARÃO! ${starClutchW ? `${starClutchW.ign} brilha na luta final` : `${winnerTeam.tag} vence a luta decisiva`} após partida duríssima!`,
        important: true,
      });
    } else if (archetype === "tactical") {
      events.push({
        atStep: 5,
        timeLabel: `${String(snapshots[5].clockMins).padStart(2, "0")}:20`,
        side: midLeader,
        text: `🧭 Partida estudada! ${starIqW && midLeader === winnerSide ? `${starIqW.ign} dita o macro da ${winnerTeam.tag}` : `${midLeader === "A" ? teamA.tag : teamB.tag} controla a visão`} no rio (${snapshots[5].inGameA}×${snapshots[5].inGameB}).`,
      });
      events.push({
        atStep: 8,
        timeLabel: `${String(snapshots[8].clockMins).padStart(2, "0")}:15`,
        side: winnerSide,
        text: `👾 BARÃO! ${starClutchW ? `${starClutchW.ign} encontra o engage perfeito` : `${winnerTeam.tag} força o Barão`} e quebra a linha de frente adversária!`,
        important: true,
      });
    } else {
      events.push({
        atStep: 5,
        timeLabel: `${String(snapshots[5].clockMins).padStart(2, "0")}:20`,
        side: winnerSide,
        text: `🐉 Controle absoluto! ${starIqW ? `${starIqW.ign} comanda o ritmo da ${winnerTeam.tag}` : winnerTeam.tag} vence a luta no dragão e amplia a vantagem.`,
      });
      events.push({
        atStep: 8,
        timeLabel: `${String(snapshots[8].clockMins).padStart(2, "0")}:35`,
        side: winnerSide,
        text: `👾 BARÃO! ${starClutchW ? `${starClutchW.ign} fecha a porta` : `${winnerTeam.tag} garante o Barão`} e marcha para os inibidores.`,
        important: true,
      });
    }

    const finalDiff = Math.abs(targetKillsA - targetKillsB);
    const wonBehindInKills =
      (winnerSide === "A" && targetKillsA < targetKillsB) ||
      (winnerSide === "B" && targetKillsB < targetKillsA);

    events.push({
      atStep: 10,
      timeLabel: `${durationMins}:00`,
      side: winnerSide,
      text: wonBehindInKills
        ? `💥 NEXUS DESTRUÍDO! Mesmo atrás nos abates (${targetKillsA}×${targetKillsB}), ${winnerTeam.tag} vence o Mapa ${mapNumber} no macro!`
        : isComeback
          ? `💥 VIRADA HISTÓRICA! ${winnerTeam.tag} busca o impossível e vence o Mapa ${mapNumber} (${targetKillsA}×${targetKillsB})!`
          : finalDiff <= 3
            ? `💥 NO DETALHE! ${winnerTeam.tag} vence um Mapa ${mapNumber} equilibradíssimo (${targetKillsA}×${targetKillsB})!`
            : `💥 NEXUS DESTRUÍDO! ${winnerTeam.tag} vence o Mapa ${mapNumber} (${targetKillsA}×${targetKillsB})!`,
      important: true,
    });
  }

  return {
    mapNumber,
    winnerSide,
    gameProbA,
    isSilverScrapes,
    isComeback,
    adaptNote,
    durationMins,
    targetKillsA,
    targetKillsB,
    targetRoundsA,
    targetRoundsB,
    mvpName:
      isComeback
        ? (starClutchW?.ign ?? randomWinnerPlayer?.ign ?? starAggroW?.ign)
        : (starClutchW?.ign ?? starAggroW?.ign ?? randomLoserPlayer?.ign),
    snapshots,
    events,
  };
}

export function LiveFinalModal({
  championship,
  match,
  teamA,
  teamB,
  career,
  isGrandFinal = true,
  onFinish,
  onClose,
}: {
  championship: Championship;
  match: Match;
  teamA: Team;
  teamB: Team;
  career?: Record<string, CareerTeam>;
  isGrandFinal?: boolean;
  onFinish: (winnerId: string, score: { a: number; b: number }) => void;
  onClose: () => void;
}) {
  const { championships } = useStore();
  const isCs2 = (championship.game ?? "lol") === "cs2";
  const needed = Math.ceil(match.bestOf / 2);

  const { seedA, seedB } = useMemo(() => {
    const isCurrentIntl =
      championship.internationalLevel === "minor" ||
      championship.internationalLevel === "major" ||
      championship.isInternational === true ||
      /copa do mundo|world cup|seleções|selecoes|world|msi|global master|supercopa|desafiante|rift|kickoff|first stand/i.test(
        championship.name ?? "",
      );

    const findSeed = (team: Team): number | null => {
      if (!isCurrentIntl) {
        const ranked = seriesRanking(championship.teams, championship.phases);
        const idx = ranked.findIndex((r) => r.teamId === team.id);
        return idx >= 0 ? idx + 1 : null;
      }
      const normName = team.name.trim().toLowerCase();
      const localLeagues = championships
        .filter(
          (c) =>
            (c.game ?? "lol") === (championship.game ?? "lol") &&
            c.internationalLevel !== "major" &&
            c.internationalLevel !== "minor" &&
            !c.isInternational &&
            !/copa do mundo|world cup|seleções|selecoes|world|msi|global master|supercopa|desafiante|rift|kickoff|first stand/i.test(
              c.name ?? "",
            ),
        )
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

      for (const league of localLeagues) {
        const localTeam = league.teams.find((t) => t.name.trim().toLowerCase() === normName);
        if (!localTeam) continue;
        const ranked = seriesRanking(league.teams, league.phases);
        const idx = ranked.findIndex((r) => r.teamId === localTeam.id);
        if (idx >= 0) return idx + 1;
      }
      return null;
    };

    return { seedA: findSeed(teamA), seedB: findSeed(teamB) };
  }, [championship, championships, teamA, teamB]);

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
      isFinal: isGrandFinal,
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
      isGrandFinal,
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
                isGrandFinal,
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
                text: isGrandFinal
                  ? `🏆 ${winTeam.name.toUpperCase()} VENCE A GRANDE FINAL POR ${newA} × ${newB} E CONQUISTA O TÍTULO!`
                  : `🏆 ${winTeam.name.toUpperCase()} VENCE A SÉRIE POR ${newA} × ${newB}!`,
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
          isGrandFinal,
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

  // Placar parcial e probabilidade dinâmica dentro do mapa atual (step 0..10)
  const snapshot = currentPlan.snapshots[Math.min(step, currentPlan.snapshots.length - 1)] ?? {
    inGameA: 0,
    inGameB: 0,
    clockMins: 0,
    liveProbA: currentPlan.gameProbA,
  };
  const liveInGameA = snapshot.inGameA;
  const liveInGameB = snapshot.inGameB;
  const liveClockMins = snapshot.clockMins;
  const probAPct = Math.round(snapshot.liveProbA * 100);

  const modalContent = (
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
                {isGrandFinal ? "Grande Final" : match.roundName || "Partida Oficial"} • Melhor de {match.bestOf} (Vence quem fizer {needed})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConfirmAndClose}
            className="rounded border border-border p-1.5 text-muted-foreground transition-colors hover:border-gold hover:text-bone"
            title={
              seriesWinnerSide
                ? isGrandFinal
                  ? "Salvar título e fechar"
                  : "Salvar resultado e fechar"
                : "Fechar transmissão"
            }
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
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <span>{teamA.region || "REG"}</span>
                {seedA ? (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-sky-300">Seed #{seedA}</span>
                  </>
                ) : null}
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
                  {isGrandFinal ? "Campeão" : "Vencedor"}: {seriesWinnerSide === "A" ? teamA.name : teamB.name}
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
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <span>{teamB.region || "REG"}</span>
                {seedB ? (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-sky-300">Seed #{seedB}</span>
                  </>
                ) : null}
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
                {isGrandFinal
                  ? `✓ Grande Final concluída (${scoreA} × ${scoreB})! Clique ao lado para gravar e celebrar.`
                  : `✓ Série concluída (${scoreA} × ${scoreB})! Clique ao lado para registrar o placar.`}
              </span>
              <button
                type="button"
                onClick={handleConfirmAndClose}
                className="inline-flex items-center gap-2 rounded border-2 border-gold bg-gold px-4 py-2 font-display text-xs font-black uppercase tracking-widest text-ink shadow-md hover:bg-gold/90"
              >
                <Sparkles className="h-4 w-4" />{" "}
                {isGrandFinal ? "Confirmar Título & Celebrar" : "Confirmar Resultado"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
