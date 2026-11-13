/**
 * Smoke test do sistema de evolução — roda com `npx tsx scripts/smoke-evolution.ts`.
 * Valida: nota do custom player afetando forte a força do time, determinismo
 * do recesso, curva de idade, titulares/subs e deltas de playoff.
 */
import {
  effectiveRating,
  ensureRoster,
  deriveRoster,
  evolveRoster,
  findRealTeam,
  makeCustomPlayer,
  matchPlayerDeltas,
  playerOverall,
  rosterStrength,
  pickStarters,
  stripDerivedRoster,
  synergyForNewSplit,
  updateCulture,
} from "../src/lib/lol/players";
import type { Player, Team } from "../src/lib/lol/types";

let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}`, extra ?? "");
  } else {
    console.log(`ok    ${label}`, extra ?? "");
  }
};

const mkRoster = (overall: number): Player[] =>
  (["top", "jungle", "mid", "adc", "support"] as const).map((role) =>
    makeCustomPlayer({ ign: `${role}-${overall}`, role, overall }),
  );

// 1) Nota alta puxa o time — cinco de 95 vs cinco de 60.
const weak = mkRoster(60);
const strong = mkRoster(95);
const base = 50;
const rWeak = effectiveRating(base, weak, 0, 50);
const rStrong = effectiveRating(base, strong, 0, 50);
check("cinco de 95 vs cinco de 60 dá swing grande", rStrong - rWeak >= 20, { rWeak, rStrong });

// 2) Um craque de 95 num time de 60 sobe o time de forma relevante.
const mixed = [...mkRoster(60).slice(0, 4), makeCustomPlayer({ ign: "supra", role: "mid", overall: 95 })];
const rMixed = effectiveRating(base, mixed, 0, 50);
check("um craque de 95 no meio de 60s soma bem", rMixed - rWeak >= 5, { rWeak, rMixed });

// 3) Clamp: sem elenco, só a história (ELO 50 → ~50).
check("sem elenco usa só a história", effectiveRating(50, undefined) === 50);

// 4) Determinismo total do recesso (mesmo input → mesmo output).
const e1 = evolveRoster(weak, { splitLabel: "2026 Split 2", winRate: 0.3 });
const e2 = evolveRoster(weak, { splitLabel: "2026 Split 2", winRate: 0.3 });
check("recesso determinístico", JSON.stringify(e1) === JSON.stringify(e2));

// 5) Idade +1 e veterano (28) perde mecânica; jovem (19) ganha.
const vet = [makeCustomPlayer({ ign: "vet", role: "mid", overall: 80, age: 28 })];
const young = [makeCustomPlayer({ ign: "prod", role: "mid", overall: 80, age: 19 })];
const evVet = evolveRoster(vet, { splitLabel: "S2", winRate: null });
const evYoung = evolveRoster(young, { splitLabel: "S2", winRate: null });
check("veterano envelhece e perde mecânica", evVet.roster[0].age === 29 && evVet.roster[0].attrs.mechanics < 80, evVet.roster[0]);
check("jovem desenvolve mecânica", evYoung.roster[0].age === 20 && evYoung.roster[0].attrs.mechanics > 80, evYoung.roster[0]);

// 6) Rebaixado perde clutch, campeão ganha.
const ch = evolveRoster(mkRoster(75), { splitLabel: "S2", champion: true });
const rel = evolveRoster(mkRoster(75), { splitLabel: "S2", relegated: true });
const avgClutch = (rs: Player[]) => rs.reduce((s, p) => s + p.attrs.clutch, 0) / rs.length;
check("campeão ganha clutch", avgClutch(ch.roster) > avgClutch(rel.roster) - 5 && avgClutch(ch.roster) >= 76);

// 7) Subs não contam na força (titular de baixo nota escondido por sub de 95).
const rosterSub: Player[] = [
  ...mkRoster(70).map((p) => (p.role === "mid" ? { ...p, sub: true } : p)),
  makeCustomPlayer({ ign: "rookie95", role: "mid", overall: 95 }),
];
check("sub de 95 só conta se não houver titular na função", pickStarters(rosterSub).length === 5 && rosterStrength(rosterSub)! > 70);

// 8) Curva de idade: overall de mecânica pura cai depois dos 26.
const at24 = playerOverall(makeCustomPlayer({ ign: "x", role: "mid", overall: 85, age: 24 }));
const at29 = playerOverall(makeCustomPlayer({ ign: "x", role: "mid", overall: 85, age: 29 }));
check("curva de idade derruba o overall do veterano", at29 < at24 - 3, { at24, at29 });

// 9) Deltas de playoff: vencedor +clutch, perdedor -clutch; sem playoff, nada.
const deltas = matchPlayerDeltas({ winnerRoster: mkRoster(70), loserRoster: mkRoster(70), isPlayoff: true });
const noPlayoff = matchPlayerDeltas({ winnerRoster: mkRoster(70), loserRoster: mkRoster(70), isPlayoff: false });
const anyPositive = Object.values(deltas).some((d) => d.clutch === 1);
const anyNegative = Object.values(deltas).some((d) => d.clutch === -1);
check("playoff gera deltas (vencedor +1, perdedor -1)", anyPositive && anyNegative);
check("fora de playoff não mexe em jogador", Object.keys(noPlayoff).length === 0);

// 10) Sinergia e cultura seguem as regras.
check("elenco mantido junta química (teto 50)", synergyForNewSplit(45, true) === 50 && synergyForNewSplit(0, false) === 0);
check("campeão fortalece cultura, rebaixado corrói", updateCulture(50, { splitLabel: "s", champion: true }) > updateCulture(50, { splitLabel: "s", relegated: true }));

// 11) ensureRoster casa o banco real pelo nome (T1 existe no seed de 2026).
const t1 = ensureRoster({ id: "x", name: "T1", tag: "T1" } as Team);
check("T1 ganha elenco real do banco", !!t1 && t1.length >= 5, t1?.map((p) => p.ign));

// ---------- Suíça: sorteio de verdade ----------
import {
  generateSwissRound1,
  getQualifiers,
  syncSwiss,
} from "../src/lib/lol/generate";
import type { Match, Phase, SwissConfig } from "../src/lib/lol/types";

const field16 = Array.from({ length: 16 }, (_, i) => `sw${i}`);
const naivePair = (ids: string[]) => {
  const half = ids.length / 2;
  return Array.from({ length: half }, (_, i) => `${ids[i]}|${ids[i + half]}`);
};
const naive16 = new Set(naivePair(field16));
// 40 sorteios: em algum momento os confrontos fogem da ordem de cadastro.
let anyDrawn = false;
for (let i = 0; i < 40; i++) {
  const ms = generateSwissRound1(field16, 3);
  if (ms.length !== 8) break;
  const pairs = ms.map((m) => `${m.teamAId}|${m.teamBId}`);
  if (pairs.some((p) => !naive16.has(p))) {
    anyDrawn = true;
    break;
  }
}
check("rodada 1 da suíça é sorteada (não a ordem de cadastro)", anyDrawn);
const drawOne = generateSwissRound1(field16, 3);
const seen = new Set(drawOne.flatMap((m) => [m.teamAId, m.teamBId]));
check(
  "sorteio cobre todos os 16 times uma única vez",
  seen.size === 16 && drawOne.every((m) => m.teamAId && m.teamBId),
);
const odd = generateSwissRound1(["a", "b", "c", "d", "e"], 3);
const byeMatch = odd.find((m) => m.bye);
check(
  "campo ímpar ganha vaga (bye) com vencedor já definido",
  odd.length === 3 && !!byeMatch && !!byeMatch.winnerId && !byeMatch.teamBId,
  odd.map((m) => `${m.teamAId} x ${m.teamBId ?? "BYE"}`),
);

// Vaga conta vitória: getQualifiers enxerga o time da vaga em 1-0.
const byeDraw = generateSwissRound1(["a", "b", "c", "d", "e"], 3);
const byeTeam = byeDraw.find((m) => m.bye)!.teamAId!;
const byePhase = {
  kind: "swiss",
  matches: [
    ...byeDraw,
    // Rodada 2: dois vencedores reais (1-0) e o time da vaga (1-0) entre eles.
    {
      id: "r2m1",
      teamAId: "a",
      teamBId: "b",
      winnerId: "a",
      bestOf: 3,
      round: 1,
    } as Match,
  ],
  config: { kind: "swiss", winsToAdvance: 2, lossesToEliminate: 2, defaultBestOf: 3 },
} as unknown as Phase;
check(
  "vaga conta como 1 vitória nos apuradores",
  (() => {
    // Só a vaga = 1 vitória < 2 → ainda não classifica.
    if (getQualifiers(byePhase).includes(byeTeam)) return false;
    // Vaga + vitória na rodada 2 = 2 → classifica.
    const sub = getQualifiers({
      ...byePhase,
      matches: [
        ...byePhase.matches,
        {
          id: "r2m2",
          teamAId: byeTeam,
          teamBId: "c",
          winnerId: byeTeam,
          bestOf: 3,
          round: 1,
        } as Match,
      ],
    });
    return sub.includes(byeTeam);
  })(),
  { byeTeam },
);

// syncSwiss agrupa por retrospecto e NÃO repete confronto.
const swiss16 = generateSwissRound1(field16, 3);
const withResults = swiss16.map((m, i) => ({
  ...m,
  winnerId: i % 2 === 0 ? m.teamAId! : m.teamBId!,
}));
const cfg: SwissConfig = {
  kind: "swiss",
  winsToAdvance: 3,
  lossesToEliminate: 3,
  defaultBestOf: 3,
};
const synced = syncSwiss(withResults, cfg);
const round2 = synced.filter((m) => (m.round ?? 0) === 1);
const recOf = (id: string) => {
  let w = 0;
  for (const m of withResults) if (m.winnerId === id) w++;
  return w;
};
check(
  "rodada 2 da suíça só pareia 1-0 contra 1-0 (e 0-1 contra 0-1)",
  round2.length === 8 &&
    round2.every((m) => m.teamAId && m.teamBId && recOf(m.teamAId) === recOf(m.teamBId)),
  round2.map((m) => `${m.teamAId}(${recOf(m.teamAId!)}) x ${m.teamBId}(${recOf(m.teamBId!)})`),
);
const r1Pairs = new Set(swiss16.map((m) => `${m.teamAId}|${m.teamBId}`));
check(
  "rodada 2 não repete confrontos da rodada 1",
  round2.every((m) => !r1Pairs.has(`${m.teamAId}|${m.teamBId}`)),
);

if (failures > 0) {
  console.error(`\n${failures} checagem(ões) falharam`);
  process.exit(1);
}
console.log("\nsmoke ok — motor de evolução passou em tudo");
