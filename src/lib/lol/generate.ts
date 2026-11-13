import type {
  BestOf,
  CustomBracketSpec,
  CustomRoundSpec,
  GroupsConfig,
  Group,
  Match,
  Phase,
  PlayoffsConfig,
  SwissConfig,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Cria grupos já preenchidos com os times informados.
 * GSL precisa de 4 times por grupo; se o campo for maior, abre grupos extras.
 */
export function createGroupsForTeams(
  config: GroupsConfig,
  teamIds: string[],
  assignments: Record<string, number> = {},
): Group[] {
  let groupCount = Math.max(1, config.groupCount);
  if (config.format === "gsl" && teamIds.length > 0) {
    groupCount = Math.max(groupCount, Math.ceil(teamIds.length / 4));
  }
  const groups: Group[] = Array.from({ length: groupCount }, (_, index) => ({
    id: uid(),
    name: groupCount === 1 ? "Grupo Único" : `Grupo ${String.fromCharCode(65 + index)}`,
    teamIds: [],
  }));
  teamIds.forEach((teamId, index) => {
    const raw = assignments[teamId] ?? index % groupCount;
    const group = groups[Math.max(0, Math.min(groupCount - 1, Math.floor(raw)))];
    group?.teamIds.push(teamId);
  });
  return groups;
}

/** Round-robin match list for a group. */
export function generateGroupMatches(groups: Group[], bestOf: BestOf, doubleRR: boolean): Match[] {
  const matches: Match[] = [];
  for (const g of groups) {
    const ids = g.teamIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matches.push({
          id: uid(),
          teamAId: ids[i],
          teamBId: ids[j],
          winnerId: null,
          bestOf,
          groupId: g.id,
        });
        if (doubleRR) {
          matches.push({
            id: uid(),
            teamAId: ids[j],
            teamBId: ids[i],
            winnerId: null,
            bestOf,
            groupId: g.id,
          });
        }
      }
    }
  }
  return matches;
}

/**
 * GSL-style mini double-elimination bracket inside a single group of up to 4 teams.
 * Produces:
 *   M1 (Round 1) — seed 1 vs seed 4
 *   M2 (Round 1) — seed 2 vs seed 3
 *   WM (Round 2) — winner M1 vs winner M2  → primeiro classificado
 *   LM (Chave dos Perdedores) — loser M1 vs loser M2
 *   DM (Decider) — winner LM vs loser WM  → segundo classificado
 */
export function generateGSLGroup(
  group: Group,
  r1Bo: BestOf,
  winnersBo: BestOf,
  losersBo: BestOf,
  deciderBo: BestOf,
): Match[] {
  const t = group.teamIds;
  const m1Id = uid();
  const m2Id = uid();
  const wmId = uid();
  const lmId = uid();
  const dmId = uid();
  const mkUpper = (
    id: string,
    slot: number,
    round: number,
    roundName: string,
    bo: BestOf,
    teamAId: string | null,
    teamBId: string | null,
    nextMatchId: string | null,
    loserNextMatchId: string | null,
  ): Match => ({
    id,
    teamAId,
    teamBId,
    winnerId: null,
    bestOf: bo,
    round,
    slot,
    bracketSide: "upper",
    nextMatchId,
    loserNextMatchId,
    groupId: group.id,
    roundName,
  });
  const m1 = mkUpper(m1Id, 0, 0, "Rodada 1", r1Bo, t[0] ?? null, t[3] ?? null, wmId, lmId);
  const m2 = mkUpper(m2Id, 1, 0, "Rodada 1", r1Bo, t[1] ?? null, t[2] ?? null, wmId, lmId);
  const wm: Match = {
    id: wmId,
    teamAId: null,
    teamBId: null,
    winnerId: null,
    bestOf: winnersBo,
    round: 1,
    slot: 0,
    bracketSide: "upper",
    nextMatchId: null,
    loserNextMatchId: dmId,
    groupId: group.id,
    roundName: "Partida de qualificação",
  };
  const lm: Match = {
    id: lmId,
    teamAId: null,
    teamBId: null,
    winnerId: null,
    bestOf: losersBo,
    round: 1,
    slot: 0,
    bracketSide: "lower",
    nextMatchId: dmId,
    groupId: group.id,
    roundName: "Chave dos Perdedores",
  };
  const dm: Match = {
    id: dmId,
    teamAId: null,
    teamBId: null,
    winnerId: null,
    bestOf: deciderBo,
    round: 2,
    slot: 0,
    bracketSide: "lower",
    nextMatchId: null,
    groupId: group.id,
    roundName: "Partida de qualificação",
  };
  return [m1, m2, wm, lm, dm];
}

/**
 * Round 1 da suíça com SORTEIO real dos confrontos (embaralha antes de parear
 * — nunca a ordem de cadastro dos times). Campo ímpar: o time que sobra ganha
 * a vaga (bye) e conta 1 vitória, igual swiss de Worlds.
 */
export function generateSwissRound1(teamIds: string[], bestOf: BestOf): Match[] {
  const ids = shuffle(teamIds);
  const matches: Match[] = [];
  const half = Math.floor(ids.length / 2);
  for (let i = 0; i < half; i++) {
    matches.push({
      id: uid(),
      teamAId: ids[i] ?? null,
      teamBId: ids[i + half] ?? null,
      winnerId: null,
      bestOf,
      round: 0,
      roundName: "Rodada 1",
    });
  }
  if (ids.length % 2 === 1) {
    const bye = ids[ids.length - 1]!;
    matches.push({
      id: uid(),
      teamAId: bye,
      teamBId: null,
      winnerId: bye,
      bye: true,
      bestOf,
      round: 0,
      roundName: "Rodada 1",
    });
  }
  return matches;
}

/** Next power of two >= n. */
function nextPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

const roundNameFor = (remaining: number) =>
  remaining === 1
    ? "Final"
    : remaining === 2
      ? "Semifinal"
      : remaining === 3
        ? "Quartas"
        : `Oitavas +${remaining}`;

/** Single-elimination bracket for `slots` teams (padded to power of 2 with byes). */
export function generateSingleElim(slots: number, defaultBo: BestOf, finalBo: BestOf): Match[] {
  const size = nextPow2(slots);
  const rounds = Math.log2(size);
  const matches: Match[] = [];
  let prev: Match[] = [];
  for (let r = 0; r < rounds; r++) {
    const roundSize = size / Math.pow(2, r + 1);
    const curr: Match[] = [];
    const remaining = rounds - r;
    for (let s = 0; s < roundSize; s++) {
      curr.push({
        id: uid(),
        teamAId: null,
        teamBId: null,
        winnerId: null,
        bestOf: remaining === 1 ? finalBo : defaultBo,
        round: r,
        slot: s,
        bracketSide: "upper",
        nextMatchId: null,
        roundName: roundNameFor(remaining),
      });
    }
    if (r > 0) {
      prev.forEach((pm, idx) => {
        pm.nextMatchId = curr[Math.floor(idx / 2)].id;
      });
    }
    matches.push(...curr);
    prev = curr;
  }
  return matches;
}

/** Double-elimination bracket. Slots padded to power of 2. */
export function generateDoubleElim(
  slots: number,
  defaultBo: BestOf,
  finalBo: BestOf,
  bracketReset: boolean,
): Match[] {
  const size = nextPow2(slots);
  const ubRounds = Math.log2(size);
  const matches: Match[] = [];

  // Upper bracket
  const upper: Match[][] = [];
  let prev: Match[] = [];
  for (let r = 0; r < ubRounds; r++) {
    const roundSize = size / Math.pow(2, r + 1);
    const curr: Match[] = [];
    const remaining = ubRounds - r;
    for (let s = 0; s < roundSize; s++) {
      curr.push({
        id: uid(),
        teamAId: null,
        teamBId: null,
        winnerId: null,
        bestOf: defaultBo,
        round: r,
        slot: s,
        bracketSide: "upper",
        nextMatchId: null,
        loserNextMatchId: null,
        roundName: remaining === 1 ? "Final Chave Superior" : roundNameFor(remaining),
      });
    }
    if (r > 0) {
      prev.forEach((pm, idx) => {
        pm.nextMatchId = curr[Math.floor(idx / 2)].id;
      });
    }
    upper.push(curr);
    prev = curr;
  }

  // Lower bracket: 2 * (ubRounds - 1) rounds
  const lower: Match[][] = [];
  const lbRoundCount = Math.max(0, 2 * (ubRounds - 1));
  let currentLbSize = size / 4; // First LB round pairs losers of UB R1 (size/2 losers → size/4 matches)
  for (let lr = 0; lr < lbRoundCount; lr++) {
    const isMinor = lr % 2 === 0; // minor = only lower-bracket survivors play
    const size2 = currentLbSize;
    const round: Match[] = [];
    for (let s = 0; s < size2; s++) {
      round.push({
        id: uid(),
        teamAId: null,
        teamBId: null,
        winnerId: null,
        bestOf: defaultBo,
        round: lr,
        slot: s,
        bracketSide: "lower",
        nextMatchId: null,
        roundName: `Chave Inferior R${lr + 1}`,
      });
    }
    lower.push(round);
    if (!isMinor) currentLbSize = Math.max(1, Math.floor(currentLbSize / 2));
  }
  // Wire LB → LB
  for (let lr = 0; lr < lower.length - 1; lr++) {
    const curr = lower[lr];
    const next = lower[lr + 1];
    const isMinor = lr % 2 === 0;
    if (isMinor) {
      // Minor round: winners go to same-index major round
      curr.forEach((m, idx) => (m.nextMatchId = next[idx].id));
    } else {
      // Major round: winners go to next minor round paired
      curr.forEach((m, idx) => (m.nextMatchId = next[Math.floor(idx / 2)].id));
    }
  }
  // Wire UB losers → LB
  // R1 UB losers → LB round 0 (minor). Losers of ub[0] fill LB[0] slots.
  if (upper[0] && lower[0]) {
    upper[0].forEach((m, idx) => {
      m.loserNextMatchId = lower[0][Math.floor(idx / 2)].id;
    });
  }
  // Subsequent UB round losers drop into LB minor rounds
  for (let r = 1; r < upper.length; r++) {
    const lbMinorIdx = 2 * r - 1; // major rounds fed by UB
    if (lower[lbMinorIdx]) {
      upper[r].forEach((m, idx) => {
        m.loserNextMatchId = lower[lbMinorIdx][idx]?.id ?? null;
      });
    }
  }

  // Grand final: winner UB Final vs winner LB Final
  const grand: Match = {
    id: uid(),
    teamAId: null,
    teamBId: null,
    winnerId: null,
    bestOf: finalBo,
    round: ubRounds,
    slot: 0,
    bracketSide: "grand",
    nextMatchId: null,
    roundName: "Grande Final",
  };
  const ubFinal = upper[upper.length - 1]?.[0];
  const lbFinal = lower[lower.length - 1]?.[0];
  if (ubFinal) ubFinal.nextMatchId = grand.id;
  if (lbFinal) lbFinal.nextMatchId = grand.id;

  matches.push(...upper.flat(), ...lower.flat(), grand);

  if (bracketReset) {
    const reset: Match = {
      id: uid(),
      teamAId: null,
      teamBId: null,
      winnerId: null,
      bestOf: finalBo,
      round: ubRounds + 1,
      slot: 0,
      bracketSide: "reset",
      roundName: "Reset da Chave",
    };
    grand.loserNextMatchId = reset.id; // triggered only if UB winner loses
    matches.push(reset);
  }

  return matches;
}

// ---------- CUSTOM (manual) BRACKET ----------

const mapIdx = (i: number, count: number, nextCount: number) => {
  if (nextCount <= 0) return 0;
  if (nextCount >= count) return Math.min(i, nextCount - 1);
  return Math.min(Math.floor(i / Math.ceil(count / nextCount)), nextCount - 1);
};

/** Espec. vazia: o usuário monta a chave do zero. */
export function emptyCustomSpec(): CustomBracketSpec {
  return {
    upper: [],
    lower: [],
    grandFinal: false,
    grandFinalBestOf: 5,
    bracketReset: false,
  };
}

/** Espec. padrão equivalente à chave automática, ponto de partida do modo manual. */
export function defaultCustomSpec(
  slots: number,
  type: "single" | "double",
  defaultBo: BestOf,
  finalBo: BestOf,
  bracketReset: boolean,
): CustomBracketSpec {
  const size = nextPow2(Math.max(2, slots));
  const ubRounds = Math.max(1, Math.log2(size));
  const upper: CustomRoundSpec[] = [];
  for (let r = 0; r < ubRounds; r++) {
    upper.push({
      id: uid(),
      name:
        r === ubRounds - 1
          ? type === "double"
            ? "Final Chave Superior"
            : "Final"
          : `Rodada ${r + 1}`,
      matches: size / Math.pow(2, r + 1),
      bestOf: defaultBo,
    });
  }
  const lower: CustomRoundSpec[] = [];
  if (type === "double") {
    let currentLbSize = Math.max(1, size / 4);
    const lbCount = Math.max(0, 2 * (ubRounds - 1));
    for (let lr = 0; lr < lbCount; lr++) {
      lower.push({
        id: uid(),
        name: `Chave Inferior R${lr + 1}`,
        matches: Math.max(1, currentLbSize),
        bestOf: defaultBo,
      });
      if (lr % 2 === 1) currentLbSize = Math.max(1, Math.floor(currentLbSize / 2));
    }
  }
  return {
    upper,
    lower,
    grandFinal: type === "double",
    grandFinalBestOf: finalBo,
    bracketReset: type === "double" ? bracketReset : false,
  };
}

/** Gera uma chave totalmente definida pelo usuário. */
export function generateCustomBracket(spec: CustomBracketSpec): Match[] {
  const mk = (
    side: "upper" | "lower",
    r: CustomRoundSpec,
    ri: number,
    fallbackName: string,
  ): Match[] =>
    Array.from({ length: Math.max(1, Math.floor(r.matches)) }, (_, s) => ({
      id: uid(),
      teamAId: null,
      teamBId: null,
      winnerId: null,
      bestOf: r.bestOf,
      round: ri,
      slot: s,
      bracketSide: side,
      nextMatchId: null,
      loserNextMatchId: null,
      roundName: r.name?.trim() || fallbackName,
    }));

  const upper = spec.upper.map((r, ri) => mk("upper", r, ri, `Rodada ${ri + 1}`));
  const lower = spec.lower.map((r, ri) => mk("lower", r, ri, `Chave Inferior R${ri + 1}`));

  const wire = (rounds: Match[][]) => {
    for (let r = 0; r < rounds.length - 1; r++) {
      const curr = rounds[r];
      const next = rounds[r + 1];
      curr.forEach((m, i) => {
        m.nextMatchId = next[mapIdx(i, curr.length, next.length)].id;
      });
    }
  };
  wire(upper);
  wire(lower);

  // Perdedores da chave superior caem na chave inferior.
  if (lower.length > 0) {
    upper.forEach((round, ri) => {
      const targetIdx = Math.min(ri === 0 ? 0 : 2 * ri - 1, lower.length - 1);
      const target = lower[targetIdx];
      round.forEach((m, i) => {
        m.loserNextMatchId = target[mapIdx(i, round.length, target.length)].id;
      });
    });
  }

  const matches: Match[] = [...upper.flat(), ...lower.flat()];
  const ubFinal = upper[upper.length - 1]?.[0];
  const lbFinal = lower[lower.length - 1]?.[0];

  if (spec.grandFinal) {
    const grand: Match = {
      id: uid(),
      teamAId: null,
      teamBId: null,
      winnerId: null,
      bestOf: spec.grandFinalBestOf,
      round: upper.length,
      slot: 0,
      bracketSide: "grand",
      nextMatchId: null,
      roundName: "Grande Final",
    };
    if (ubFinal) ubFinal.nextMatchId = grand.id;
    if (lbFinal) {
      lbFinal.nextMatchId = grand.id;
      lbFinal.loserNextMatchId = null;
    }
    matches.push(grand);
    if (spec.bracketReset) {
      const reset: Match = {
        id: uid(),
        teamAId: null,
        teamBId: null,
        winnerId: null,
        bestOf: spec.grandFinalBestOf,
        round: upper.length + 1,
        slot: 0,
        bracketSide: "reset",
        roundName: "Reset da Chave",
      };
      grand.loserNextMatchId = reset.id;
      matches.push(reset);
    }
  } else if (lbFinal) {
    lbFinal.loserNextMatchId = null;
  }

  // Última rodada da chave superior não deve mandar perdedor pra lugar nenhum
  // quando não há rodada inferior correspondente disponível.
  if (ubFinal && lower.length === 0) {
    upper.flat().forEach((m) => (m.loserNextMatchId = null));
  }

  return matches;
}

/** Seed teams into the first upper-bracket round (1vN, 2vN-1 ...). */
export function seedBracket(matches: Match[], teamIds: string[], reservedSlots = 0): Match[] {
  if (teamIds.length === 0) return matches;
  const firstRound = matches
    .filter((m) => (m.bracketSide ?? "upper") === "upper" && (m.round ?? 0) === 0)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  const n = firstRound.length * 2;
  // Ordem padrão de chave (1v8, 4v5, 2v7, 3v6...): cabeças 1 e 2 só se cruzam na final.
  let order = [0, 1];
  while (order.length < n) {
    const len = order.length * 2;
    order = order.flatMap((s) => [s, len - 1 - s]);
  }
  if (order.length !== n)
    order = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? i / 2 : n - 1 - (i - 1) / 2));
  let pendingLeft = Math.max(0, reservedSlots);
  firstRound.forEach((m, s) => {
    // Os slots RESERVADOS são as posições da ordem que ficariam vazias: em
    // vez de virar bye (o time passaria direto e a fase começaria adiantada),
    // o slot fica PENDENTE esperando o classificado do play-in.
    // Só as `reservedSlots` primeiras vagas vazias são reservadas — o resto
    // (a chave completada para potencia de 2) continua bye normal.
    const aIdx = order[2 * s];
    const bIdx = order[2 * s + 1];
    const aPending = aIdx >= teamIds.length && pendingLeft > 0;
    if (aPending) pendingLeft -= 1;
    const bPending = bIdx >= teamIds.length && pendingLeft > 0;
    if (bPending) pendingLeft -= 1;
    m.teamAId = aPending ? null : (teamIds[aIdx] ?? null);
    m.teamBId = bPending ? null : (teamIds[bIdx] ?? null);
    m.pendingA = aPending || undefined;
    m.pendingB = bPending || undefined;
  });
  return matches;
}

/**
 * Preenche os slots RESERVADOS (pendentes) com os classificados do play-in.
 * Não reconstrói a chave: os resultados já jogados no evento principal
 * continuam intactos — é o que permite o play-in e a fase principal rodarem
 * EM PARALELO (formato Worlds/MSI).
 *
 * Idempotente: times já colocados na chave não são repetidos, então puxar
 * classificados de novo não duplica ninguém.
 */
export function fillPendingSlots(matches: Match[], teamIds: string[]): Match[] {
  if (teamIds.length === 0) return matches;
  const out = matches.map((m) => ({ ...m }));
  const placed = new Set(
    out.flatMap((m) => [m.teamAId, m.teamBId]).filter((id): id is string => !!id),
  );
  let next = 0;
  const take = (): string | null => {
    while (next < teamIds.length) {
      const id = teamIds[next++]!;
      if (placed.has(id)) continue;
      placed.add(id);
      return id;
    }
    return null;
  };
  for (const m of out) {
    if (m.pendingA) {
      const id = take();
      if (id) {
        m.teamAId = id;
        m.pendingA = undefined;
      } else {
        // Não há mais classificados para preencher: remove a espera para não travar a chave
        m.pendingA = undefined;
      }
    }
    if (m.pendingB) {
      const id = take();
      if (id) {
        m.teamBId = id;
        m.pendingB = undefined;
      } else {
        // Não há mais classificados para preencher: remove a espera para não travar a chave
        m.pendingB = undefined;
      }
    }
  }
  return resolveByes(out);
}

/** Quantos slots reservados (pendentes) a fase ainda tem. */
export function pendingSlotCount(matches: Match[]): number {
  return matches.reduce((sum, m) => sum + (m.pendingA ? 1 : 0) + (m.pendingB ? 1 : 0), 0);
}

/**
 * Renomeia o confronto que decide a fase (play-in de UMA vaga): vira
 * "Classificação" em vez de "Grande Final" — no play-in não existe final.
 */
export function renameDecider(matches: Match[], label: string): Match[] {
  const decider = matches
    .filter((m) => !m.nextMatchId && !m.loserNextMatchId)
    .sort((a, b) => (b.round ?? 0) - (a.round ?? 0) || (b.slot ?? 0) - (a.slot ?? 0))[0];
  if (!decider) return matches;
  return matches.map((m) => (m.id === decider.id ? { ...m, roundName: label } : m));
}

/**
 * Seed para chave manual: preenche em ordem os confrontos da 1ª rodada da chave
 * superior e, se sobrarem times, os confrontos da 1ª rodada da chave inferior.
 */
export function seedCustomBracket(matches: Match[], teamIds: string[]): Match[] {
  if (teamIds.length === 0) return matches;
  const slotsInOrder = (side: "upper" | "lower") =>
    matches
      .filter((m) => m.bracketSide === side && (m.round ?? 0) === 0)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  const queue = teamIds.slice();
  for (const side of ["upper", "lower"] as const) {
    for (const m of slotsInOrder(side)) {
      if (queue.length === 0) return matches;
      m.teamAId = queue.shift() ?? null;
      m.teamBId = queue.length > 0 ? (queue.shift() ?? null) : null;
    }
  }
  return matches;
}

function limitIds(ids: string[], limit?: number): string[] {
  return limit === undefined ? ids : ids.slice(0, Math.max(0, limit));
}

/** Default play-in advancement: roughly half the entrants, ensuring elimination. */
export function automaticPlayInAdvanceCount(teamCount: number): number {
  if (teamCount <= 1) return 0;
  if (teamCount === 2 || teamCount === 3) return 1;
  if (teamCount === 4 || teamCount === 5) return 2;
  if (teamCount === 6 || teamCount === 7) return 3;
  return Math.min(4, Math.floor(teamCount / 2));
}

type BracketLoss = {
  side: NonNullable<Match["bracketSide"]>;
  round: number;
  slot: number;
};

const BRACKET_SIDE_SCORE: Record<NonNullable<Match["bracketSide"]>, number> = {
  upper: 10_000,
  lower: 50_000,
  grand: 90_000,
  reset: 100_000,
};

function bracketLossScore(info: BracketLoss): number {
  return BRACKET_SIDE_SCORE[info.side] + info.round * 100 + info.slot;
}

function bracketFinalScore(match: Match): number {
  const side = match.bracketSide ?? "upper";
  return BRACKET_SIDE_SCORE[side] + (match.round ?? 0) * 100 + (match.slot ?? 0);
}

/**
 * Ordem de classificação de uma chave: campeão, vice, e depois quem foi
 * eliminado mais tarde. Funciona para eliminação simples e dupla e é o que
 * permite o play-in entregar os 4 primeiros para a fase principal.
 */
export function getBracketStandings(phase: Phase): string[] {
  const lastLoss = new Map<string, BracketLoss>();
  for (const match of phase.matches) {
    if (!match.winnerId || !match.teamAId || !match.teamBId) continue;
    const loserId = match.winnerId === match.teamAId ? match.teamBId : match.teamAId;
    const info: BracketLoss = {
      side: match.bracketSide ?? "upper",
      round: match.round ?? 0,
      slot: match.slot ?? 0,
    };
    const previous = lastLoss.get(loserId);
    if (!previous || bracketLossScore(info) >= bracketLossScore(previous)) {
      lastLoss.set(loserId, info);
    }
  }

  const finalMatch = phase.matches
    .filter(
      (m) =>
        m.winnerId &&
        m.teamAId &&
        m.teamBId &&
        (m.bracketSide === "grand" || m.bracketSide === "reset" || !m.nextMatchId),
    )
    .sort((a, b) => bracketFinalScore(b) - bracketFinalScore(a))[0];

  const finalWinner = finalMatch?.winnerId ?? null;
  const finalLoser =
    finalMatch && finalMatch.teamAId && finalMatch.teamBId
      ? finalMatch.winnerId === finalMatch.teamAId
        ? finalMatch.teamBId
        : finalMatch.teamAId
      : null;

  const out: string[] = [];
  if (finalWinner) out.push(finalWinner);
  if (finalLoser && finalLoser !== finalWinner) out.push(finalLoser);

  const rest = Array.from(lastLoss.entries())
    .filter(([id]) => id !== finalWinner && id !== finalLoser)
    .sort((a, b) => bracketLossScore(b[1]) - bracketLossScore(a[1]) || a[0].localeCompare(b[0]))
    .map(([id]) => id);
  out.push(...rest);
  return out;
}

/** Compute qualified team ids from a finished phase, in seed order. */
export function getQualifiers(phase: Phase, limit?: number): string[] {
  if (phase.kind === "groups" && phase.groups) {
    const cfg = phase.config as GroupsConfig;
    if (cfg.format === "gsl") {
      const out: string[] = [];
      // First all group winners (WM), then second seeds (DM).
      for (const g of phase.groups) {
        const winner = phase.matches.find(
          (m) => m.groupId === g.id && !m.nextMatchId && m.bracketSide === "upper" && m.winnerId,
        );
        if (winner?.winnerId) out.push(winner.winnerId);
      }
      for (const g of phase.groups) {
        const decider = phase.matches.find(
          (m) => m.groupId === g.id && !m.nextMatchId && m.bracketSide === "lower" && m.winnerId,
        );
        if (decider?.winnerId) out.push(decider.winnerId);
      }
      return limitIds(out, limit);
    }
    const perGroup: string[][] = phase.groups.map((g) => {
      const rec = new Map<string, { w: number; l: number }>();
      g.teamIds.forEach((id) => rec.set(id, { w: 0, l: 0 }));
      for (const m of phase.matches) {
        if (m.groupId !== g.id || !m.winnerId || !m.teamAId || !m.teamBId) continue;
        const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
        const w = rec.get(m.winnerId);
        const l = rec.get(loserId);
        if (w) w.w += 1;
        if (l) l.l += 1;
      }
      return g.teamIds
        .slice()
        .sort((a, b) => {
          const ra = rec.get(a)!;
          const rb = rec.get(b)!;
          return rb.w - ra.w || ra.l - rb.l;
        })
        .slice(0, cfg.qualifiersPerGroup);
    });
    // Interleave: all 1st places, then 2nd places, etc.
    const out: string[] = [];
    const maxLen = Math.max(0, ...perGroup.map((x) => x.length));
    for (let i = 0; i < maxLen; i++) {
      for (const g of perGroup) if (g[i]) out.push(g[i]);
    }
    return limitIds(out, limit);
  }
  if (phase.kind === "swiss") {
    const cfg = phase.config as SwissConfig;
    const rec = new Map<string, { w: number; l: number }>();
    for (const m of phase.matches) {
      // Vaga (bye de campo ímpar) conta como vitória, igual swiss de Worlds.
      if (m.bye && m.winnerId) {
        rec.set(m.winnerId, {
          w: (rec.get(m.winnerId)?.w ?? 0) + 1,
          l: rec.get(m.winnerId)?.l ?? 0,
        });
        continue;
      }
      if (!m.winnerId || !m.teamAId || !m.teamBId) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      rec.set(m.winnerId, {
        w: (rec.get(m.winnerId)?.w ?? 0) + 1,
        l: rec.get(m.winnerId)?.l ?? 0,
      });
      rec.set(loserId, {
        w: rec.get(loserId)?.w ?? 0,
        l: (rec.get(loserId)?.l ?? 0) + 1,
      });
    }
    return limitIds(
      Array.from(rec.entries())
        // Time que já/eliminou (derrotas >= lossesToEliminate) NÃO classifica,
        // mesmo que também tenha as vitórias necessárias.
        .filter(([, r]) => r.w >= cfg.winsToAdvance && r.l < cfg.lossesToEliminate)
        .sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l)
        .map(([id]) => id),
      limit,
    );
  }
  if (phase.kind === "bracket") {
    return limitIds(getBracketStandings(phase), limit);
  }
  return [];
}

/** A phase can advance only after every scheduled match with entrants is resolved. */
export function isPhaseComplete(phase: Phase): boolean {
  // Fase dispensada (play-in internacional sem inscritos): conta como pronta.
  if (phase.skipped) return true;
  if (phase.matches.length === 0) return false;
  return phase.matches.every((match) => {
    // Slot RESERVADO esperando o classificado do play-in: a fase ainda não
    // termina enquanto a vaga estiver vazia.
    if (match.pendingA || match.pendingB) return false;
    const hasA = !!match.teamAId;
    const hasB = !!match.teamBId;
    if (!hasA && !hasB) return true;
    if (match.bye) {
      return (
        hasA !== hasB &&
        !!match.winnerId &&
        (match.winnerId === match.teamAId || match.winnerId === match.teamBId)
      );
    }
    if (!hasA || !hasB) return false;
    return match.winnerId === match.teamAId || match.winnerId === match.teamBId;
  });
}

/** Build initial matches for a phase based on its config. */
export function buildPhaseMatches(
  config: GroupsConfig | SwissConfig | PlayoffsConfig,
  teamIdsForPhase: string[],
  groups: Group[],
  /** Slots RESERVADOS para os classificados do play-in (vagas TBD do evento). */
  reservedSlots = 0,
): Match[] {
  if (config.kind === "groups") {
    if (config.format === "gsl") {
      const gsl = groups.flatMap((g) =>
        generateGSLGroup(g, config.bestOf, config.bestOf, config.bestOf, config.bestOf),
      );
      // Grupos com menos de 4 times (sobra do sorteio): resolve os byes do
      // mini-bracket igual o mata-mata faz — sem isso o time de sobra nunca
      // ganhava adversário e a fase travava.
      return resolveByes(gsl);
    }
    return generateGroupMatches(groups, config.bestOf, config.doubleRoundRobin);
  }
  if (config.kind === "swiss") {
    return generateSwissRound1(teamIdsForPhase, config.defaultBestOf);
  }
  if (config.mode === "custom" && config.custom) {
    const built = generateCustomBracket(config.custom);
    const upperR0 = built.filter((m) => m.bracketSide === "upper" && (m.round ?? 0) === 0).length;
    const seeded =
      teamIdsForPhase.length <= upperR0 * 2
        ? seedBracket(built, teamIdsForPhase)
        : seedCustomBracket(built, teamIdsForPhase);
    return teamIdsForPhase.length > 0 ? resolveByes(seeded) : seeded;
  }
  const slots = teamIdsForPhase.length > 0 ? teamIdsForPhase.length + reservedSlots : config.slots;
  const bracket =
    config.type === "double"
      ? generateDoubleElim(slots, config.defaultBestOf, config.finalBestOf, config.bracketReset)
      : generateSingleElim(slots, config.defaultBestOf, config.finalBestOf);
  const seeded = seedBracket(bracket, teamIdsForPhase, reservedSlots);
  return teamIdsForPhase.length > 0 ? resolveByes(seeded) : seeded;
}

/** Recalcula a fase suíça: descarta rodadas inválidas e gera a próxima quando a atual termina. */
export function syncSwiss(matches: Match[], cfg: SwissConfig, editedRound?: number): Match[] {
  let ms = matches;
  if (editedRound !== undefined) {
    ms = ms.filter((m) => (m.round ?? 0) <= editedRound);
  }
  const teamIds = Array.from(
    new Set(
      ms
        .filter((m) => (m.round ?? 0) === 0)
        .flatMap((m) => [m.teamAId, m.teamBId])
        .filter((x): x is string => !!x),
    ),
  );
  if (teamIds.length < 2) return ms;
  const last = Math.max(...ms.map((m) => m.round ?? 0));
  const current = ms.filter((m) => (m.round ?? 0) === last);
  if (current.some((m) => m.teamAId && m.teamBId && !m.winnerId)) return ms;

  const rec = new Map(teamIds.map((id) => [id, { w: 0, l: 0 }]));
  const played = new Set<string>();
  for (const m of ms) {
    // Vaga (bye) conta vitória sem adversário — mesmo tratamento do getQualifiers.
    if (m.bye && m.winnerId) {
      const w = rec.get(m.winnerId);
      if (w) w.w++;
      continue;
    }
    if (!m.teamAId || !m.teamBId) continue;
    played.add(`${m.teamAId}|${m.teamBId}`);
    played.add(`${m.teamBId}|${m.teamAId}`);
    if (!m.winnerId) continue;
    const loser = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    const w = rec.get(m.winnerId);
    const l = rec.get(loser);
    if (w) w.w++;
    if (l) l.l++;
  }
  const active = teamIds.filter((id) => {
    const r = rec.get(id)!;
    return r.w < cfg.winsToAdvance && r.l < cfg.lossesToEliminate;
  });
  if (active.length < 2) return ms;

  // agrupa por retrospecto e pareia evitando revanches
  const byRec = new Map<string, string[]>();
  for (const id of active) {
    const r = rec.get(id)!;
    const k = `${r.w}-${r.l}`;
    byRec.set(k, [...(byRec.get(k) ?? []), id]);
  }
  const keys = Array.from(byRec.keys()).sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return bw - aw || al - bl;
  });
  const next: Match[] = [];
  let carry: string[] = [];
  for (const k of keys) {
    // SORTEIO dentro da faixa de recorde — confronto nunca é a ordem de cadastro.
    const pool = shuffle([...carry, ...byRec.get(k)!]);
    carry = [];
    while (pool.length >= 2) {
      const a = pool.shift()!;
      let idx = pool.findIndex((b) => !played.has(`${a}|${b}`));
      if (idx < 0) idx = 0;
      const b = pool.splice(idx, 1)[0];
      const ra = rec.get(a)!;
      next.push({
        id: uid(),
        teamAId: a,
        teamBId: b,
        winnerId: null,
        bestOf: cfg.defaultBestOf,
        round: last + 1,
        roundName: `Rodada ${last + 2} · ${ra.w}-${ra.l}`,
      });
    }
    carry = pool;
  }
  // Sobrou UM time ativo sem confronto (campo ímpar): ele recebe VAGA, como
  // no sorteio da primeira rodada. Sem isso o time simplesmente sumia do
  // torneio e a fase nunca fechava.
  if (carry.length === 1) {
    const team = carry[0]!;
    next.push({
      id: uid(),
      teamAId: team,
      teamBId: null,
      winnerId: team,
      bye: true,
      bestOf: cfg.defaultBestOf,
      round: last + 1,
      roundName: `Rodada ${last + 2} · vaga`,
    });
  }
  return [...ms, ...next];
}

/** Ajusta o playoff ao número real de classificados (cria/remove vagas). */
export function adaptPlayoffConfig<T extends GroupsConfig | SwissConfig | PlayoffsConfig>(
  config: T,
  count: number,
): T {
  if (config.kind !== "bracket" || count < 2) return config;
  const cfg = config as PlayoffsConfig;
  if (cfg.mode !== "custom" || !cfg.custom || cfg.custom.upper.length === 0) {
    return { ...cfg, slots: count, mode: "auto" } as T;
  }
  const spec = cfg.custom;
  const lowerCap = (spec.lower[0]?.matches ?? 0) * 2;
  const capacity = spec.upper[0].matches * 2 + lowerCap;
  // Cabe exatamente (ou com 1 bye): mantém a chave que o usuário montou.
  if (capacity === count || capacity === count + 1) return config;
  // Senão, refaz uma chave completa do tamanho certo (mesmo tipo e formatos).
  const isDouble = spec.lower.length > 0;
  const finalBo = spec.grandFinal
    ? spec.grandFinalBestOf
    : (spec.upper[spec.upper.length - 1]?.bestOf ?? cfg.finalBestOf);
  const custom = defaultCustomSpec(
    count,
    isDouble ? "double" : "single",
    spec.upper[0].bestOf,
    finalBo,
    spec.bracketReset,
  );
  return { ...cfg, slots: count, type: isDouble ? "double" : "single", custom } as T;
}

/** Ordem das metades da chave — usada para decidir qual slot cada alimentador ocupa. */
const bracketSideOrder = (s?: string) =>
  s === "lower" ? 1 : s === "grand" ? 2 : s === "reset" ? 3 : 0;

/**
 * Em qual slot (A ou B) da partida `targetId` o time de `sourceId` entra.
 * Os alimentadores são ORDENADOS de forma determinística (metade, rodada,
 * slot), então o resultado não depende da ordem em que as partidas foram
 * resolvidas — é isso que mantém o bracket coerente.
 */
function slotFedBy(matches: Match[], targetId: string, sourceId: string): "A" | "B" | null {
  const feeders = matches
    .filter((m) => m.nextMatchId === targetId || m.loserNextMatchId === targetId)
    .sort(
      (a, b) =>
        bracketSideOrder(a.bracketSide) - bracketSideOrder(b.bracketSide) ||
        (a.round ?? 0) - (b.round ?? 0) ||
        (a.slot ?? 0) - (b.slot ?? 0),
    );
  const idx = feeders.findIndex((m) => m.id === sourceId);
  if (idx < 0) return null;
  return feeders.length <= 1 || idx === 0 ? "A" : "B";
}

/**
 * Invalida a cadeia INTEIRA abaixo de `sourceId` (BFS). Sem isso, limpar o
 * resultado de uma partida só esvaziava o próximo nível e deixava times
 * fantasmas na final — o card mostrava times que já tinham sido eliminados.
 */
function clearDownstream(list: Match[], sourceId: string): Match[] {
  const out = list.slice();
  const src = out.find((m) => m.id === sourceId);
  if (!src) return out;

  const queue: Array<{ fromId: string; teamId: string }> = [];
  for (const t of [src.teamAId, src.teamBId].filter((x): x is string => !!x)) {
    queue.push({ fromId: sourceId, teamId: t });
  }

  const seen = new Set<string>();
  while (queue.length > 0) {
    const job = queue.shift()!;
    const from = out.find((m) => m.id === job.fromId);
    if (!from) continue;
    for (const targetId of [from.nextMatchId, from.loserNextMatchId]) {
      if (!targetId) continue;
      const slot = slotFedBy(out, targetId, job.fromId);
      if (!slot) continue;
      const idx = out.findIndex((m) => m.id === targetId);
      if (idx < 0) continue;

      const key = `${targetId}:${slot}:${job.teamId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const target = { ...out[idx] };
      let removed = false;
      if (slot === "A" && target.teamAId === job.teamId) {
        target.teamAId = null;
        removed = true;
      }
      if (slot === "B" && target.teamBId === job.teamId) {
        target.teamBId = null;
        removed = true;
      }
      // Slot já estava vazio: nada a invalidar aqui.
      if (!removed) continue;

      target.winnerId = null;
      target.scoreA = undefined;
      target.scoreB = undefined;
      out[idx] = target;
      queue.push({ fromId: targetId, teamId: job.teamId });
    }
  }
  return out;
}

export function propagateBracketWinner(matches: Match[], sourceId: string): Match[] {
  const source = matches.find((m) => m.id === sourceId);
  if (!source) return matches;
  const out = matches.slice();
  const applyTo = (targetId: string | null | undefined, teamId: string | null) => {
    if (!targetId || !teamId) return;
    const idx = out.findIndex((m) => m.id === targetId);
    if (idx < 0) return;
    const target = { ...out[idx] };
    const slot = slotFedBy(out, targetId, source.id);
    const isASlot = slot === "A";
    const prevOccupant = isASlot ? target.teamAId : target.teamBId;
    if (isASlot) target.teamAId = teamId;
    else target.teamBId = teamId;
    if (target.winnerId && (target.winnerId === prevOccupant || target.winnerId !== teamId)) {
      if (target.winnerId !== target.teamAId && target.winnerId !== target.teamBId) {
        target.winnerId = null;
        target.scoreA = undefined;
        target.scoreB = undefined;
      }
    }
    out[idx] = target;
  };
  const winnerId = source.winnerId;
  const loserId =
    winnerId && source.teamAId && source.teamBId
      ? winnerId === source.teamAId
        ? source.teamBId
        : source.teamAId
      : null;
  // Resultado limpo: remove este jogo e TODA a cadeia abaixo dele.
  if (!winnerId) {
    return clearDownstream(out, sourceId);
  }
  applyTo(source.nextMatchId, winnerId);
  // Bracket reset: fill with both grand-final participants (rematch).
  const loserTarget = source.loserNextMatchId
    ? out.find((m) => m.id === source.loserNextMatchId)
    : null;
  if (loserTarget?.bracketSide === "reset") {
    const idx = out.findIndex((m) => m.id === loserTarget.id);
    out[idx] = {
      ...loserTarget,
      teamAId: winnerId ?? null,
      teamBId: loserId ?? null,
      winnerId: null,
      scoreA: undefined,
      scoreB: undefined,
    };
  } else {
    applyTo(source.loserNextMatchId, loserId);
  }
  return out;
}

/**
 * Resolve byes: calcula quantos times podem chegar em cada confronto. Confronto
 * com só 1 time possível passa o time direto (sem placar) e fica oculto; com 0
 * fica oculto. Assim a chave sempre chega até a final.
 */
export function resolveByes(input: Match[]): Match[] {
  let out = input.map((m) => ({ ...m }));
  for (let iter = 0; iter < 64; iter++) {
    const byId = new Map(out.map((m) => [m.id, m]));
    const feeders = new Map<string, { src: Match; loser: boolean }[]>();
    for (const m of out) {
      if (m.nextMatchId)
        feeders.set(m.nextMatchId, [
          ...(feeders.get(m.nextMatchId) ?? []),
          { src: m, loser: false },
        ]);
      if (m.loserNextMatchId)
        feeders.set(m.loserNextMatchId, [
          ...(feeders.get(m.loserNextMatchId) ?? []),
          { src: m, loser: true },
        ]);
    }
    const memo = new Map<string, number>();
    const entrants = (m: Match, depth = 0): number => {
      if (memo.has(m.id)) return memo.get(m.id)!;
      if (depth > 200) return 2;
      const present =
        (m.teamAId ? 1 : 0) +
        (m.teamBId ? 1 : 0) +
        // Slot RESERVADO (play-in): conta como possível entrant — o slot só
        // se resolve quando o classificado entra.
        (m.pendingA ? 1 : 0) +
        (m.pendingB ? 1 : 0);
      const fs = feeders.get(m.id) ?? [];
      let n: number;
      if (fs.length === 0) n = present;
      else if (m.bracketSide === "reset") n = 2;
      else {
        const live = fs.filter(({ src, loser }) => {
          const e = entrants(byId.get(src.id)!, depth + 1);
          return loser ? e >= 2 : e >= 1;
        }).length;
        n = Math.max(present, Math.min(2, live));
      }
      memo.set(m.id, n);
      return n;
    };
    let changedId: string | null = null;
    for (const m of out) {
      const e = entrants(m);
      if (m.bracketSide === "reset") continue;
      // Slot RESERVADO: o confronto espera o classificado do play-in — não é
      // bye (senão o time passaria direto e a fase começaria adiantada).
      if (m.pendingA || m.pendingB) continue;
      const isBye = e <= 1;
      if (m.bye !== isBye) m.bye = isBye || undefined;
      if (isBye) {
        const lone = m.teamAId ?? m.teamBId ?? null;
        if (lone && m.winnerId !== lone && !(m.teamAId && m.teamBId)) {
          m.winnerId = lone;
          m.scoreA = undefined;
          m.scoreB = undefined;
          changedId = m.id;
          break;
        }
        if (!lone && m.winnerId) {
          m.winnerId = null;
        }
      }
    }
    if (!changedId) break;
    out = propagateBracketWinner(out, changedId);
  }
  return out;
}

/** Placar aleatório válido para o formato BoX. */
export function randomResult(bestOf: BestOf): { a: number; b: number } {
  const needed = Math.ceil(bestOf / 2);
  const loser = Math.floor(Math.random() * needed);
  return Math.random() < 0.5 ? { a: needed, b: loser } : { a: loser, b: needed };
}

/** Rodada de cada partida da fase de grupos (ninguém joga duas vezes na mesma rodada). */
export function groupMatchRounds(phase: Phase): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of phase.groups ?? []) {
    const ms = phase.matches.filter((m) => m.groupId === g.id);
    if (ms.some((m) => m.round !== undefined)) {
      ms.forEach((m) => out.set(m.id, m.round ?? 0));
      continue;
    }
    const busy: Set<string>[] = [];
    for (const m of ms) {
      let r = 0;
      while (
        busy[r] &&
        ((m.teamAId && busy[r].has(m.teamAId)) || (m.teamBId && busy[r].has(m.teamBId)))
      )
        r++;
      busy[r] ??= new Set();
      if (m.teamAId) busy[r].add(m.teamAId);
      if (m.teamBId) busy[r].add(m.teamBId);
      out.set(m.id, r);
    }
  }
  return out;
}
