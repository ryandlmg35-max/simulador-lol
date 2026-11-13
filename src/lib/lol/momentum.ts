import type {
  BestOf,
  CareerTeam,
  Championship,
  Match,
  MomentumEvent,
  MomentumState,
  Phase,
  Player,
  Team,
} from "./types";
import { uid } from "./generate";
import { effectiveRating, ensureRoster, rosterAverageAttrs } from "./players";

export const NEUTRAL_FORM = 50;

/** Diferença mínima de aproveitamento pra caracterizar "gigante x azarão". */
const UPSET_RATING_GAP = 0.2;
/** Gap pra azarão "aprender" jogando contra time melhor. */
const GROWTH_RATING_GAP = 0.15;
export type Mood = NonNullable<MomentumState["mood"]>;

export interface SeasonRecord {
  w: number;
  l: number;
  played: number;
  winRate: number;
}

/** Recupera o estado de momentum de um time (neutro se não existir). */
export function getMomentumState(
  momentum: Record<string, MomentumState> | undefined,
  teamId: string,
): MomentumState {
  return momentum?.[teamId] ?? { form: NEUTRAL_FORM, streak: 0 };
}

/** Recalcula o humor visual de um time após uma mudança de forma. */
function moodFor(state: MomentumState): Mood | undefined {
  if ((state.lastDelta ?? 0) <= -10) return "tilted";
  if (state.streak >= 3) return "hot";
  if (state.form <= 30) return "cold";
  if ((state.lastDelta ?? 0) >= 10) return "rising";
  return undefined;
}

function withMood(state: MomentumState): MomentumState {
  return { ...state, mood: moodFor(state) };
}

function applyDelta(
  momentum: Record<string, MomentumState>,
  teamId: string,
  delta: number,
  streakDelta: number,
): Record<string, MomentumState> {
  const cur = getMomentumState(momentum, teamId);
  const next: MomentumState = {
    form: Math.max(0, Math.min(100, cur.form + delta)),
    streak: cur.streak + streakDelta,
    lastDelta: delta,
  };
  return { ...momentum, [teamId]: withMood(next) };
}

/** Aproveitamento (winRate) de cada time de um conjunto de fases. */
export function seasonRecords(phases: Phase[]): Map<string, SeasonRecord> {
  const rec = new Map<string, SeasonRecord>();
  const ensure = (id: string) => {
    if (!rec.has(id)) rec.set(id, { w: 0, l: 0, played: 0, winRate: 0.5 });
    return rec.get(id)!;
  };
  for (const p of phases) {
    for (const m of p.matches) {
      // Vaga (bye) conta como VITÓRIA — mesma regra de `getQualifiers` e
      // `syncSwiss`. Sem isso, o time com vaga tinha winRate defasado no
      // cálculo de probabilidade.
      if (m.bye && m.winnerId) {
        const w = ensure(m.winnerId);
        w.w += 1;
        w.played += 1;
        continue;
      }
      if (!m.winnerId || !m.teamAId || !m.teamBId) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      const w = ensure(m.winnerId);
      const l = ensure(loserId);
      w.w += 1;
      w.played += 1;
      l.l += 1;
      l.played += 1;
    }
  }
  for (const r of rec.values()) r.winRate = r.played > 0 ? r.w / r.played : 0.5;
  return rec;
}

export interface MatchSimulationContext {
  isIntl?: boolean;
  isPlayoff?: boolean;
  isFinal?: boolean;
  rosterA?: Player[];
  rosterB?: Player[];
  teamA?: Team;
  teamB?: Team;
}

/**
 * Probabilidade avançada de A vencer B.
 * Combina o rating ELO estrutural e histórico com o impacto profundo dos
 * 8 atributos dos jogadores, penalidade de inexperiência internacional
 * (o clássico "bater na liga local e pipocar lá fora") e fortaleza mental sob pressão.
 */
export function winProbability(
  recA: SeasonRecord | undefined,
  recB: SeasonRecord | undefined,
  formA: number,
  formB: number,
  ratingA?: number,
  ratingB?: number,
  ctx?: MatchSimulationContext,
): number {
  const ra = recA?.winRate ?? 0.5;
  const rb = recB?.winRate ?? 0.5;
  const eloA = ratingA ?? 50;
  const eloB = ratingB ?? 50;

  let prob =
    0.5 +
    (eloA - eloB) * 0.006 + // Rating ELO estrutural
    (formA - formB) * 0.0015 + // Forma recente e moral
    (ra - rb) * 0.10; // Aproveitamento na temporada

  if (ctx) {
    const attrsA = rosterAverageAttrs(ctx.rosterA);
    const attrsB = rosterAverageAttrs(ctx.rosterB);

    // 1. IMPACTO INTERNACIONAL (O choque de realidade fora da liga local):
    // Em palcos internacionais (Worlds, MSI, etc.), quem tem pouca bagagem
    // internacional sofre com a pressão do palco e a velocidade do meta estrangeiro.
    if (ctx.isIntl) {
      const expDiff = attrsA.intlExperience - attrsB.intlExperience;
      prob += (expDiff / 100) * 0.14;

      // Penalidade de inexperiência: time com menos de 28 de exp intl
      // contra alguém cascudo (55+) treme a mão e perde foco:
      if (attrsA.intlExperience < 28 && attrsB.intlExperience >= 55) {
        prob -= 0.07;
      } else if (attrsB.intlExperience < 28 && attrsA.intlExperience >= 55) {
        prob += 0.07;
      }
    }

    // 2. IMPACTO DE PLAYOFF / FINAIS (Sangue frio e Mentalidade):
    // Jogos de eliminação e finais exigem resiliência; times com baixa
    // mentalidade entregam vantagens sob o peso da torcida.
    if (ctx.isPlayoff || ctx.isFinal) {
      const mult = ctx.isFinal ? 1.6 : 1.1;
      const mentDiff = attrsA.mentality - attrsB.mentality;
      const clutchDiff = attrsA.clutch - attrsB.clutch;
      prob += ((mentDiff / 100) * 0.07 + (clutchDiff / 100) * 0.07) * mult;
    }

    // 3. CONSISTÊNCIA (Redução de Zebras para times sólidos):
    const consDiff = attrsA.consistency - attrsB.consistency;
    prob += (consDiff / 100) * 0.04;
  }

  return Math.max(0.04, Math.min(0.96, prob));
}

/**
 * Simulação JOGO A JOGO de séries BO3 e BO5.
 * Permite que a adaptabilidade (leitura de draft do adversário) e
 * a frieza no jogo 5 (Silver Scrapes) façam a diferença de verdade.
 */
export function simulateSeriesGames(
  bestOf: BestOf,
  probA: number,
  ctx?: MatchSimulationContext,
): { a: number; b: number } {
  const needed = Math.ceil(bestOf / 2);
  let scoreA = 0;
  let scoreB = 0;
  const history: Array<"a" | "b"> = [];

  const attrsA = ctx?.rosterA ? rosterAverageAttrs(ctx.rosterA) : undefined;
  const attrsB = ctx?.rosterB ? rosterAverageAttrs(ctx.rosterB) : undefined;

  while (scoreA < needed && scoreB < needed) {
    const gameNum = scoreA + scoreB + 1;
    let gameProbA = probA;

    // ADAPTAÇÃO INTRA-SÉRIE (Jogos seguintes):
    if (attrsA && attrsB && gameNum > 1) {
      const lastWinner = history[history.length - 1];
      if (lastWinner === "b") {
        // A perdeu o jogo anterior: se tiver alta adaptabilidade, ajusta e responde;
        // se tiver mentalidade baixa, tilta com a derrota.
        const adaptBonus = (attrsA.adaptability / 100) * 0.05;
        const tiltPenalty = attrsA.mentality < 50 ? 0.03 : 0;
        gameProbA += adaptBonus - tiltPenalty;
      } else if (lastWinner === "a") {
        // B perdeu o anterior: B ajusta com adaptabilidade; tilta se mentalidade for fraca.
        const adaptBonus = (attrsB.adaptability / 100) * 0.05;
        const tiltPenalty = attrsB.mentality < 50 ? 0.03 : 0;
        gameProbA -= (adaptBonus - tiltPenalty);
      }

      // JOGO DECISIVO / SILVER SCRAPES (Ex: 2x2 em MD5 ou 1x1 em MD3):
      // Pressão absoluta: quem tem Clutch e Mentalidade superiores cresce!
      if (scoreA === needed - 1 && scoreB === needed - 1) {
        const clutchEdge = ((attrsA.clutch - attrsB.clutch) / 100) * 0.08;
        const mentEdge = ((attrsA.mentality - attrsB.mentality) / 100) * 0.06;
        gameProbA += clutchEdge + mentEdge;
      }
    }

    gameProbA = Math.max(0.04, Math.min(0.96, gameProbA));
    const aWon = Math.random() < gameProbA;
    if (aWon) {
      scoreA++;
      history.push("a");
    } else {
      scoreB++;
      history.push("b");
    }
  }

  return { a: scoreA, b: scoreB };
}

/**
 * Placar simulado levando em consideração formato, probabilidade e atributos.
 */
export function simulatedResult(
  bestOf: BestOf,
  probA: number,
  ctx?: MatchSimulationContext,
): { a: number; b: number } {
  return simulateSeriesGames(bestOf, probA, ctx);
}

/**
 * Resolve uma partida completa calculando contexto de torneio (local vs internacional),
 * fase (grupos vs eliminatória/final), elencos de jogadores e seus atributos mentais.
 */
export function simulateForMatch(
  championship: Championship,
  match: Match,
  careerRatings?: Record<string, CareerTeam>,
): { a: number; b: number } {
  if (!match.teamAId || !match.teamBId) {
    const needed = Math.ceil(match.bestOf / 2);
    return { a: needed, b: 0 };
  }

  const inPlayoff = !!championship.promotion?.matches.some((m) => m.id === match.id);
  let records: Map<string, SeasonRecord>;
  if (inPlayoff) {
    const recA = seasonRecords(championship.phases);
    const recB = seasonRecords(championship.serieB?.phases ?? []);
    records = new Map([...recA, ...recB]);
  } else {
    const inSerieB = championship.serieB?.phases.some((p) =>
      p.matches.some((m) => m.id === match.id),
    );
    records = seasonRecords(inSerieB ? (championship.serieB?.phases ?? []) : championship.phases);
  }

  const m = championship.momentum ?? {};
  const pool: Team[] = [
    ...championship.teams,
    ...(championship.serieB?.teams ?? []),
    ...(championship.formerTeams ?? []),
  ];

  const teamA = pool.find((t) => t.id === match.teamAId);
  const teamB = pool.find((t) => t.id === match.teamBId);
  const rosterA = teamA ? ensureRoster(teamA) : undefined;
  const rosterB = teamB ? ensureRoster(teamB) : undefined;

  const ratingFor = (team?: Team): number => {
    if (!team) return 50;
    const ledger = team.name ? (careerRatings?.[team.name.trim().toLowerCase()]?.rating ?? 50) : 50;
    return effectiveRating(ledger, ensureRoster(team), team.synergy, team.culture);
  };

  // Detecta se a partida é internacional:
  const isIntlChamp =
    championship.internationalLevel === "minor" ||
    championship.internationalLevel === "major" ||
    (championship.name &&
      /world|msi|global master|supercopa|desafiante|rift|kickoff|first stand/i.test(
        championship.name,
      ));

  // Detecta se é fase eliminatória / playoff ou final:
  const isPlayoffMatch = match.bracketSide != null || (match.roundName && /playoff|semifinal|quartas|final|eliminat/i.test(match.roundName));
  const isFinalMatch = match.bracketSide === "grand" || (match.roundName && /grande final|final/i.test(match.roundName));

  const ctx: MatchSimulationContext = {
    isIntl: !!isIntlChamp,
    isPlayoff: !!isPlayoffMatch,
    isFinal: !!isFinalMatch,
    rosterA,
    rosterB,
    teamA,
    teamB,
  };

  const probA = winProbability(
    records.get(match.teamAId),
    records.get(match.teamBId),
    getMomentumState(m, match.teamAId).form,
    getMomentumState(m, match.teamBId).form,
    ratingFor(teamA),
    ratingFor(teamB),
    ctx,
  );

  return simulatedResult(match.bestOf, probA, ctx);
}

/** Resultados recentes (W/L) por time, ordenados por rodada. */
export function buildLast5(phases: Phase[]): Record<string, ("W" | "L")[]> {
  const sorted = phases.flatMap((p) =>
    p.matches
      .map((m, idx) => ({ m, order: (m.round ?? 0) * 10000 + idx }))
      .sort((x, y) => x.order - y.order)
      .map((x) => x.m),
  );
  const out: Record<string, ("W" | "L")[]> = {};
  for (const m of sorted) {
    if (!m.winnerId || !m.teamAId || !m.teamBId || m.bye) continue;
    const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    (out[m.winnerId] ??= []).push("W");
    (out[loserId] ??= []).push("L");
  }
  for (const id of Object.keys(out)) out[id] = out[id].slice(-5);
  return out;
}

const clampForm = (v: number) => Math.max(0, Math.min(100, v));

export interface MomentumUpdateResult {
  momentum: Record<string, MomentumState>;
  log: MomentumEvent[];
  /** Efeito registrado na partida (para reverter se o placar for limpo). */
  formEffect: NonNullable<Match["formEffect"]>;
}

/**
 * Coração do sistema: aplica os efeitos de um resultado na forma dos times e
 * gera os eventos narrativos (crise, upset/tilt, crescimento do azarão).
 *
 * @param momentum estado atual (id → estado)
 * @param log       log atual (mais recente primeiro)
 * @param records   aproveitamento PRÉ-partida de cada time
 * @param match     partida já com o resultado registrado
 * @param division  onde a partida aconteceu
 */
export function applyMatchEffects(params: {
  momentum: Record<string, MomentumState>;
  log: MomentumEvent[];
  records: Map<string, SeasonRecord>;
  match: Match;
  division: 1 | 2 | "play-in";
  teamName: (id: string) => string;
  /**
   * Psicologia do time (clutch médio do elenco + cultura) — decide, SEM
   * aleatoriedade, se o gigante derrubado acorda ou tilta e se a sequência
   * de derrotas vira reunião de emergência ou crise de vestiário.
   */
  psychology?: (teamId: string) => { clutch: number; culture: number };
  /**
   * FORÇA REAL do time (ELO da carreira + elenco + sinergia + cultura) — a
   * MESMA métrica que decide a probabilidade de vitória. É ela que define
   * quem é o favorito: sem isso a narrativa discordava do jogo e o time que
   * o simulador tratava como favorito a 95% era anunciado como "azarão
   * derrubando gigante" só porque tinha um retrospecto ruim na temporada.
   */
  strength?: (teamId: string) => number;
}): MomentumUpdateResult {
  const { momentum, log, records, match, division, teamName } = params;
  const psychology = params.psychology ?? (() => ({ clutch: 60, culture: 50 }));
  const winnerId = match.winnerId as string;
  const loserId = (winnerId === match.teamAId ? match.teamBId : match.teamAId) as string;
  const events: MomentumEvent[] = [];

  let momentumNext = momentum;
  const deltas: Record<string, number> = { [winnerId]: 4, [loserId]: -4 };
  const streaks: Record<string, number> = {
    [winnerId]: 1,
    [loserId]: -1,
  };

  const recW = records.get(winnerId) ?? { w: 0, l: 0, played: 0, winRate: 0.5 };
  const recL = records.get(loserId) ?? { w: 0, l: 0, played: 0, winRate: 0.5 };
  // Gap de FORÇA: > 0 = quem perdeu era o mais forte (o vencedor derrubou um
  // gigante); < 0 = quem perdeu era o mais fraco (ele aprendeu jogando contra
  // um time melhor). Mesma escala do `winProbability`.
  const strengthW = params.strength?.(winnerId) ?? 50;
  const strengthL = params.strength?.(loserId) ?? 50;
  const gap = (strengthL - strengthW) / 100;
  const minPlayed = recW.played >= 2 && recL.played >= 2;

  // 💥 Upset: azarão derruba o gigante — gigante tilta ou acorda.
  if (minPlayed && gap >= UPSET_RATING_GAP) {
    deltas[winnerId] += 6;
    events.push({
      id: uid(),
      at: new Date().toISOString(),
      division,
      teamId: winnerId,
      title: "Derrubou um gigante! ⭐",
      detail: `${teamName(winnerId)} venceu o favorito ${teamName(loserId)} e ganhou uma injeção de confiança.`,
      delta: 6,
    });
    const loserPsych = psychology(loserId);
    // Time com porte (clutch + cultura altos) sacode e responde; o resto vai ao chão.
    const wakesUp = loserPsych.clutch + (loserPsych.culture - 50) * 0.5 >= 65;
    if (wakesUp) {
      // Gigante acorda
      deltas[loserId] += 14;
      events.push({
        id: uid(),
        at: new Date().toISOString(),
        division,
        teamId: loserId,
        title: "Se ligou! 🔔",
        detail: `A humilhante derrota para ${teamName(winnerId)} sacudiu o elenco de ${teamName(loserId)} — agora vai com tudo.`,
        delta: 14,
      });
    } else {
      // Gigante tilta
      deltas[loserId] -= 10;
      events.push({
        id: uid(),
        at: new Date().toISOString(),
        division,
        teamId: loserId,
        title: "Tiltou! 😤",
        detail: `Ninguém entende: ${teamName(loserId)} perdeu para ${teamName(winnerId)} e a cabeça foi ao chão.`,
        delta: -10,
      });
    }
  }

  // 📈 Azarão que aprende: jogar contra time melhor desenvolve o elenco.
  if (minPlayed && gap >= GROWTH_RATING_GAP) {
    deltas[winnerId] += 2;
  }
  if (minPlayed && gap <= -GROWTH_RATING_GAP) {
    // loserId enfrentou alguém claramente melhor
    deltas[loserId] += 3;
    events.push({
      id: uid(),
      at: new Date().toISOString(),
      division,
      teamId: loserId,
      title: "Aprendendo com os grandes 📈",
      detail: `${teamName(loserId)} evoluiu encarando ${teamName(winnerId)} — o rosto duro do jogo a jogo está aparecendo.`,
      delta: 3,
    });
  }

  // 😰 Crise: sequência longa de derrotas (ou vestiário fraco já em -3)
  // bifurca por CULTURA — time de cultura forte a comissão aperta e responde;
  // cultura fraca, o vestiário racha.
  const loserState = getMomentumState(momentumNext, loserId);
  const loserStreakAfter = (loserState.streak <= 0 ? loserState.streak : 0) - 1;
  const loserPsych = psychology(loserId);
  const crisisTriggered =
    loserStreakAfter <= -4 || (loserStreakAfter <= -3 && loserPsych.culture <= 40);
  if (crisisTriggered) {
    if (loserPsych.culture < 45) {
      deltas[loserId] -= 8;
      events.push({
        id: uid(),
        at: new Date().toISOString(),
        division,
        teamId: loserId,
        title: "Crise interna 🥶",
        detail: `O vestiário de ${teamName(loserId)} esquentou: rusgas internas após a sequência ruim.`,
        delta: -8,
      });
    } else {
      deltas[loserId] += 12;
      events.push({
        id: uid(),
        at: new Date().toISOString(),
        division,
        teamId: loserId,
        title: "Reunião de emergência 🔥",
        detail: `Comissão técnica de ${teamName(loserId)} apertou o elenco após mais uma derrota — resposta imediata na forma.`,
        delta: 12,
      });
    }
  }

  // Aplica os deltas
  momentumNext = applyDelta(momentumNext, winnerId, deltas[winnerId], streaks[winnerId]);
  momentumNext = applyDelta(momentumNext, loserId, deltas[loserId], streaks[loserId]);

  const formEffect: NonNullable<Match["formEffect"]> = {
    a: winnerId === match.teamAId ? deltas[winnerId] : deltas[loserId],
    b: winnerId === match.teamBId ? deltas[winnerId] : deltas[loserId],
    winnerId,
    eventIds: events.map((e) => e.id),
  };

  return {
    momentum: momentumNext,
    log: [...events.reverse(), ...log].slice(0, 40),
    formEffect,
  };
}

/** Reverte os efeitos de um resultado limpo (placar apagado). */
export function revertMatchEffects(params: {
  momentum: Record<string, MomentumState>;
  log: MomentumEvent[];
  formEffect: NonNullable<Match["formEffect"]>;
  match: Match;
}): { momentum: Record<string, MomentumState>; log: MomentumEvent[] } {
  const { momentum, log, formEffect, match } = params;
  let next = momentum;
  const undo = (teamId: string | null, delta: number, streakDelta: number) => {
    if (!teamId) return;
    const cur = getMomentumState(next, teamId);
    next = {
      ...next,
      [teamId]: withMood({
        ...cur,
        form: clampForm(cur.form - delta),
        streak: cur.streak - streakDelta,
        lastDelta: -delta,
      }),
    };
  };
  const winnerWasA = formEffect.winnerId === match.teamAId;
  undo(match.teamAId, formEffect.a, winnerWasA ? 1 : -1);
  undo(match.teamBId, formEffect.b, winnerWasA ? -1 : 1);
  const removedIds = new Set(formEffect.eventIds ?? []);
  const logNext = removedIds.size ? log.filter((e) => !removedIds.has(e.id)) : log;
  return { momentum: next, log: logNext };
}

/** Zera a forma dos times de uma série (resetar fase = recomeço limpo). */
export function resetMomentumFor(
  momentum: Record<string, MomentumState> | undefined,
  teamIds: string[],
): Record<string, MomentumState> {
  const next = { ...(momentum ?? {}) };
  for (const id of teamIds) {
    if (next[id]) next[id] = { form: NEUTRAL_FORM, streak: 0 };
  }
  return next;
}

/** Recesso: forma carrega parcialmente entre splits (regressa ~70% ao neutro). */
export function regressMomentumForSplit(
  momentum: Record<string, MomentumState> | undefined,
): Record<string, MomentumState> | undefined {
  if (!momentum) return undefined;
  const next: Record<string, MomentumState> = {};
  for (const [id, s] of Object.entries(momentum)) {
    next[id] = {
      form: clampForm(NEUTRAL_FORM + (s.form - NEUTRAL_FORM) * 0.3),
      streak: 0,
    };
  }
  return next;
}
