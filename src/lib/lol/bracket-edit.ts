import type { CustomBracketSpec, CustomRoundSpec, Match } from "./types";
import { generateCustomBracket, uid } from "./generate";

export type BracketOp =
  | { type: "addMatch"; side: "upper" | "lower"; round: number }
  | { type: "removeMatch"; side: "upper" | "lower"; round: number }
  | { type: "addRound"; side: "upper" | "lower" }
  | { type: "removeRound"; side: "upper" | "lower"; round: number }
  | { type: "renameRound"; side: "upper" | "lower"; round: number; name: string }
  | { type: "toggleGrandFinal" }
  | { type: "toggleReset" };

/** Deriva a especificação editável a partir das partidas existentes. */
export function specFromMatches(matches: Match[]): CustomBracketSpec {
  const build = (side: "upper" | "lower"): CustomRoundSpec[] => {
    const ms = matches.filter((m) =>
      side === "upper" ? (m.bracketSide ?? "upper") === "upper" : m.bracketSide === "lower",
    );
    const rounds = Array.from(new Set(ms.map((m) => m.round ?? 0))).sort((a, b) => a - b);
    return rounds.map((r, i) => {
      const rm = ms.filter((m) => (m.round ?? 0) === r);
      return {
        id: uid(),
        name:
          rm[0]?.roundName ?? (side === "upper" ? `Rodada ${i + 1}` : `Chave Inferior R${i + 1}`),
        matches: rm.length,
        bestOf: rm[0]?.bestOf ?? 3,
      };
    });
  };
  const grand = matches.find((m) => m.bracketSide === "grand");
  return {
    upper: build("upper"),
    lower: build("lower"),
    grandFinal: !!grand,
    grandFinalBestOf: grand?.bestOf ?? 5,
    bracketReset: matches.some((m) => m.bracketSide === "reset"),
  };
}

export function applyBracketOp(spec: CustomBracketSpec, op: BracketOp): CustomBracketSpec {
  const next: CustomBracketSpec = {
    ...spec,
    upper: spec.upper.map((r) => ({ ...r })),
    lower: spec.lower.map((r) => ({ ...r })),
  };
  const list = (side: "upper" | "lower") => (side === "upper" ? next.upper : next.lower);

  switch (op.type) {
    case "addMatch": {
      const r = list(op.side)[op.round];
      if (r) r.matches = Math.min(32, r.matches + 1);
      break;
    }
    case "removeMatch": {
      const arr = list(op.side);
      const r = arr[op.round];
      if (r?.matches === 1) arr.splice(op.round, 1);
      else if (r) r.matches -= 1;
      break;
    }
    case "addRound": {
      const arr = list(op.side);
      const last = arr[arr.length - 1];
      arr.push({
        id: uid(),
        name:
          op.side === "upper" ? `Rodada ${arr.length + 1}` : `Chave Inferior R${arr.length + 1}`,
        matches: Math.max(1, Math.floor((last?.matches ?? 2) / 2) || 1),
        bestOf: last?.bestOf ?? 3,
      });
      break;
    }
    case "removeRound": {
      const arr = list(op.side);
      arr.splice(op.round, 1);
      break;
    }
    case "renameRound": {
      const r = list(op.side)[op.round];
      if (r) r.name = op.name.trim() || r.name;
      break;
    }
    case "toggleGrandFinal":
      next.grandFinal = !next.grandFinal;
      if (!next.grandFinal) next.bracketReset = false;
      break;
    case "toggleReset":
      next.bracketReset = !next.bracketReset;
      break;
  }
  return next;
}

const key = (m: Match) => `${m.bracketSide ?? "upper"}:${m.round ?? 0}:${m.slot ?? 0}`;

/** Regenera a chave preservando times/placares por posição. */
export function rebuildFromSpec(spec: CustomBracketSpec, previous: Match[]): Match[] {
  const fresh = generateCustomBracket(spec);
  const old = new Map(previous.map((m) => [key(m), m]));
  return fresh.map((m) => {
    const p = old.get(key(m));
    if (!p) return m;
    return {
      ...m,
      teamAId: p.teamAId ?? null,
      teamBId: p.teamBId ?? null,
      winnerId: p.winnerId ?? null,
      scoreA: p.scoreA,
      scoreB: p.scoreB,
      roundName: m.roundName,
    };
  });
}