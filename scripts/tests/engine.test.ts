/**
 * Testes de regressão do motor de simulação.
 *
 * Roda com `npm test` (tsc compila src/lib/lol + estes testes para
 * `.test-build/` e o runner nativo do Node executa). Sem dependência nova.
 *
 * Cada teste aqui existe porque um bug REAL foi medido em runtime.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPhaseMatches,
  createGroupsForTeams,
  fillPendingSlots,
  generateSwissRound1,
  getBracketStandings,
  getQualifiers,
  isPhaseComplete,
  pendingSlotCount,
  propagateBracketWinner,
  renameDecider,
  syncSwiss,
} from "../../src/lib/lol/generate";
import { planPhaseAdvance } from "../../src/lib/lol/advance";
import { applyMatchEffects, seasonRecords } from "../../src/lib/lol/momentum";
import { ensureRoster, evolveRoster, playerId } from "../../src/lib/lol/players";
import { buildFreshPhases, nextSeasonLabel } from "../../src/lib/lol/promotion";
import { planInternationalField, playInStructure } from "../../src/lib/lol/international";
import type {
  CareerLedger,
  GroupsConfig,
  Match,
  Phase,
  PlayoffsConfig,
  Team,
} from "../../src/lib/lol/types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const teamsOf = (ids: string[]): Team[] =>
  ids.map((id, i) => ({ id, name: `Team ${id}`, tag: id.toUpperCase(), region: "LCK" }));

/** Resolve todas as partidas jogáveis de uma chave (vencedor sempre o A). */
const playAll = (matches: Match[], except: string[] = []): Match[] => {
  let out = matches;
  let guard = 0;
  while (guard++ < 400) {
    const pending = out.filter(
      (m) => m.teamAId && m.teamBId && !m.winnerId && !except.includes(m.id),
    );
    if (pending.length === 0) break;
    for (const m of pending) {
      out = propagateBracketWinner(
        out.map((x) => (x.id === m.id ? { ...x, winnerId: x.teamAId } : x)),
        m.id,
      );
    }
  }
  return out;
};

const singleElim = (ids: string[]) =>
  buildPhaseMatches(
    {
      kind: "bracket",
      slots: ids.length,
      type: "single",
      defaultBestOf: 3,
      finalBestOf: 5,
      bracketReset: false,
    },
    ids,
    [],
  );

// ---------------------------------------------------------------------------
// BUG-1 · limpar resultado tem que invalidar a chave INTEIRA
// ---------------------------------------------------------------------------

test("BUG-1: limpar resultado na 1a rodada esvazia a final (sem time fantasma)", () => {
  let ms = singleElim(["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"]);
  const first = ms.filter((m) => (m.round ?? 0) === 0);
  ms = playAll(ms);

  const finalBefore = ms.find((m) => (m.round ?? 0) === 2);
  assert.ok(finalBefore?.teamAId, "a final deveria estar populada antes do reset");

  // limpa o resultado da primeira partida
  ms = propagateBracketWinner(
    ms.map((x) => (x.id === first[0]!.id ? { ...x, winnerId: null } : x)),
    first[0]!.id,
  );

  const finalAfter = ms.find((m) => (m.round ?? 0) === 2);
  assert.equal(finalAfter?.teamAId, null, "a final não pode manter o time da semifinal");
  assert.equal(finalAfter?.winnerId, null, "a final não pode manter vencedor");
});

test("BUG-1b: propagação normal continua funcionando (slot A/B determinístico)", () => {
  let ms = singleElim(["t1", "t2", "t3", "t4"]);
  const r1 = ms.filter((m) => (m.round ?? 0) === 0);
  for (const m of r1) {
    ms = propagateBracketWinner(
      ms.map((x) => (x.id === m.id ? { ...x, winnerId: x.teamAId } : x)),
      m.id,
    );
  }
  const final = ms.find((m) => (m.round ?? 0) === 1);
  assert.ok(final?.teamAId && final?.teamBId, "a final deve receber os 2 vencedores");
  assert.notEqual(final.teamAId, final.teamBId, "não pode repetir time na final");
});

// ---------------------------------------------------------------------------
// BUG-2 · suíça com campo ímpar não pode deixar time sem confronto
// ---------------------------------------------------------------------------

test("BUG-2: suíça com 7 times — todo ativo joga ou recebe vaga", () => {
  const ids = Array.from({ length: 7 }, (_, i) => `s${i}`);
  const ms = generateSwissRound1(ids, 3).map((m) => (m.bye ? m : { ...m, winnerId: m.teamAId }));
  const cfg = {
    kind: "swiss" as const,
    winsToAdvance: 3,
    lossesToEliminate: 3,
    defaultBestOf: 3 as const,
  };
  const after = syncSwiss(ms, cfg);
  const round2 = after.filter((m) => (m.round ?? 0) === 1);
  const participants = new Set(round2.flatMap((m) => [m.teamAId, m.teamBId]));
  const byeTeams = new Set(round2.filter((m) => m.bye).map((m) => m.teamAId));

  for (const id of ids) {
    assert.ok(
      participants.has(id) || byeTeams.has(id),
      `time ${id} ficou fora da rodada 2 sem receber vaga`,
    );
  }
  // Ninguém pode ficar sem confronto E sem vaga.
  const semJogo = ids.filter((id) => !participants.has(id) && !byeTeams.has(id));
  assert.deepEqual(semJogo, []);
});

test("BUG-2b: a vaga gerada conta como vitória", () => {
  const ids = ["a", "b", "c"];
  const ms = generateSwissRound1(ids, 3);
  const rec = seasonRecords([
    {
      kind: "swiss",
      config: { kind: "swiss", winsToAdvance: 2, lossesToEliminate: 2, defaultBestOf: 3 },
      matches: ms,
    } as Phase,
  ]);
  const bye = ms.find((m) => m.bye)!;
  assert.equal(rec.get(bye.teamAId!)?.w, 1, "vaga tem de valer como vitória no aproveitamento");
});

// ---------------------------------------------------------------------------
// BUG-3 · apurador da suíça não pode classificar time eliminado
// ---------------------------------------------------------------------------

test("BUG-3: time eliminado (derrotas >= lossesToEliminate) não classifica", () => {
  const phase = {
    kind: "swiss",
    config: { kind: "swiss", winsToAdvance: 2, lossesToEliminate: 2, defaultBestOf: 3 },
    matches: [
      { id: "m1", teamAId: "a", teamBId: "b", winnerId: "a", bestOf: 3, round: 0 },
      { id: "m2", teamAId: "a", teamBId: "c", winnerId: "a", bestOf: 3, round: 1 },
      { id: "m3", teamAId: "a", teamBId: "d", winnerId: "d", bestOf: 3, round: 2 },
      { id: "m4", teamAId: "a", teamBId: "e", winnerId: "e", bestOf: 3, round: 3 },
      { id: "m5", teamAId: "d", teamBId: "f", winnerId: "d", bestOf: 3, round: 4 },
    ],
  } as unknown as Phase;
  // "a" tem 2 vitórias (basta para advance) MAS 2 derrotas (já eliminado).
  // "d" tem 2 vitórias e nenhuma derrota → classifica normalmente.
  const qualified = getQualifiers(phase);
  assert.ok(!qualified.includes("a"), "time com 2 derrotas não pode classificar");
  assert.ok(qualified.includes("d"), "time vivo com vitórias tem que classificar");
});

// ---------------------------------------------------------------------------
// BUG-4 · identidade do jogador sobrevive ao reload
// ---------------------------------------------------------------------------

test("BUG-4: id do jogador derivado é estável entre derivações", () => {
  const team: Team = { id: "x", name: "T1", tag: "T1", region: "LCK" };
  const a = ensureRoster(team)!;
  const b = ensureRoster(team)!;
  assert.deepEqual(
    a.map((p) => p.id),
    b.map((p) => p.id),
    "o id do jogador precisa ser o mesmo em toda derivação",
  );
  assert.equal(playerId("Faker", "mid"), playerId("faker", "mid"), "id ignora caixa");
});

// ---------------------------------------------------------------------------
// BUG-6 · split novo não pode criar grupo vazio
// ---------------------------------------------------------------------------

test("BUG-6: split novo recalcula os grupos (sem grupo vazio)", () => {
  const src: Phase[] = [
    {
      id: "p1",
      name: "Fase de Grupos",
      kind: "groups",
      config: {
        kind: "groups",
        groupCount: 4,
        doubleRoundRobin: false,
        bestOf: 3,
        qualifiersPerGroup: 2,
      },
      matches: [],
    },
  ];
  const fresh = buildFreshPhases(src, ["a", "b", "c", "d", "e"]);
  const groups = fresh[0]!.groups ?? [];
  assert.equal(
    groups.filter((g) => g.teamIds.length === 0).length,
    0,
    "nenhum grupo pode ficar vazio",
  );
  assert.equal(
    groups.reduce((sum, g) => sum + g.teamIds.length, 0),
    5,
    "todo time tem que estar em algum grupo",
  );
  // distribuição equilibrada: nenhum grupo com o dobro de times do outro
  const sizes = groups.map((g) => g.teamIds.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `grupos desbalanceados: ${sizes}`);
});

// ---------------------------------------------------------------------------
// 3.2 · rótulo de split não degrada
// ---------------------------------------------------------------------------

test("3.2: nextSeasonLabel incrementa sem acumular sufixo", () => {
  assert.equal(nextSeasonLabel("2026 Split 1"), "2026 Split 2");
  assert.equal(nextSeasonLabel("2026 Split 2"), "2026 Split 3");
  assert.equal(nextSeasonLabel("Temporada"), "Temporada (2)");
  assert.equal(nextSeasonLabel("Temporada (2)"), "Temporada (3)");
  assert.equal(nextSeasonLabel("Temporada (3)"), "Temporada (4)");
});

// ---------------------------------------------------------------------------
// 3.1 · upset decidido pela FORÇA, não pelo retrospecto
// ---------------------------------------------------------------------------

test("3.1: favorito que ganha NÃO é tratado como azarão", () => {
  const rec = new Map([
    ["winner", { w: 4, l: 1, played: 5, winRate: 0.8 }],
    ["loser", { w: 1, l: 4, played: 5, winRate: 0.2 }],
  ]);
  const match: Match = {
    id: "m",
    teamAId: "winner",
    teamBId: "loser",
    winnerId: "winner",
    bestOf: 3,
  };
  const res = applyMatchEffects({
    momentum: {},
    log: [],
    records: rec,
    match,
    division: 1,
    teamName: (id) => id,
    strength: (id) => (id === "winner" ? 85 : 55),
  });
  assert.ok(
    !res.log.some((e) => e.title.includes("gigante")),
    `favorito não pode virar azarão: ${res.log.map((e) => e.title).join(", ")}`,
  );
});

test("3.1b: azarão que derruba o gigante é reconhecido pela força", () => {
  const rec = new Map([
    ["winner", { w: 1, l: 4, played: 5, winRate: 0.2 }],
    ["loser", { w: 4, l: 1, played: 5, winRate: 0.8 }],
  ]);
  const match: Match = {
    id: "m",
    teamAId: "winner",
    teamBId: "loser",
    winnerId: "winner",
    bestOf: 3,
  };
  const res = applyMatchEffects({
    momentum: {},
    log: [],
    records: rec,
    match,
    division: 1,
    teamName: (id) => id,
    strength: (id) => (id === "winner" ? 55 : 85),
  });
  assert.ok(
    res.log.some((e) => e.title.includes("gigante")),
    `azarão deveria derrubar o gigante: ${res.log.map((e) => e.title).join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// PLAY-IN · só existe em Worlds/MSI e usa a vaga regional por seed
// ---------------------------------------------------------------------------

const worldCareer = (ratings: Record<string, number>): CareerLedger => {
  const table: CareerLedger["lol"] = {};
  for (const [name, rating] of Object.entries(ratings)) {
    table[name.toLowerCase()] = {
      name,
      points: 100,
      wins: 10,
      losses: 2,
      played: 12,
      titles: 1,
      rating,
      region: name.startsWith("LCK") ? "LCK" : "LPL",
    };
  }
  const intl: Record<string, number> = { LCK: 100, LPL: 100 };
  const international: CareerLedger["international"] = { lol: {} };
  for (const [region, points] of Object.entries(intl)) {
    international!.lol![region] = {
      name: region,
      points,
      wins: 10,
      losses: 2,
      played: 12,
      titles: 1,
    };
  }
  return { lol: table, cs2: {}, titles: [], international, seen: {} };
};

const worldPhases = (): Phase[] =>
  [
    {
      name: "Play-in",
      kind: "bracket",
      config: {
        kind: "bracket",
        slots: 4,
        type: "single",
        defaultBestOf: 3,
        finalBestOf: 5,
        bracketReset: false,
      },
    },
    {
      name: "Playoffs",
      kind: "bracket",
      config: {
        kind: "bracket",
        slots: 8,
        type: "single",
        defaultBestOf: 3,
        finalBestOf: 5,
        bracketReset: false,
      },
    },
  ] as unknown as Phase[];

/**
 * Career de evento internacional: pontos internacionais POR REGIÃO (é o que
 * define as vagas e o ranking de regiões) + rating de cada time.
 */
const intlCareer = (
  ratings: Record<string, number>,
  regionPoints: Record<string, number>,
): CareerLedger => {
  const table: CareerLedger["lol"] = {};
  for (const [name, rating] of Object.entries(ratings)) {
    table[name.toLowerCase()] = {
      name,
      points: 100,
      wins: 10,
      losses: 2,
      played: 12,
      titles: 1,
      rating,
      region: name.split(" ")[0] ?? "LPL",
    };
  }
  const international: CareerLedger["international"] = { lol: {} };
  for (const [region, points] of Object.entries(regionPoints)) {
    international!.lol![region] = {
      name: region,
      points,
      wins: 10,
      losses: 2,
      played: 12,
      titles: 1,
    };
  }
  return { lol: table, cs2: {}, titles: [], international, seen: {} };
};

/** Monta N times de uma região (times fortes = seed 1). */
const mkRegion = (region: string, count: number, baseRating: number) => {
  const teams: Team[] = [];
  const ratings: Record<string, number> = {};
  for (let i = 0; i < count; i += 1) {
    const letter = String.fromCharCode(65 + i);
    teams.push({
      id: `${region.toLowerCase()}${letter}`,
      name: `${region} ${letter}`,
      tag: letter,
      region,
    });
    ratings[`${region} ${letter}`] = baseRating - i * 2;
  }
  return { teams, ratings };
};

test("PLAY-IN: campeonato comum com fase 'Play-in' NÃO usa a lógica internacional", () => {
  const teams = teamsOf(["a", "b", "c", "d"]).map((t) => ({ ...t, region: "LCK" }));
  const plan = planInternationalField({
    teams,
    phases: worldPhases(),
    career: worldCareer({ a: 80, b: 78, c: 76, d: 74 }),
    championshipName: "CBLOL Split 1",
  });
  assert.equal(plan.active, false, "liga comum não pode ter plano internacional");
  assert.equal(plan.playInTeamIds.length, 0);
  assert.equal(plan.directTeamIds.length, teams.length, "todos os times ficam na primeira fase");
});

test("PLAY-IN: só atica em Worlds/MSI", () => {
  const teams = teamsOf(["a", "b"]).map((t) => ({ ...t, region: "LCK" }));
  for (const name of ["CBLOL 2026", "LCS 2026", "Liga Minha"]) {
    const plan = planInternationalField({
      teams,
      phases: worldPhases(),
      career: worldCareer({ a: 80, b: 78 }),
      championshipName: name,
    });
    assert.equal(plan.active, false, `${name} não deveria usar o play-in internacional`);
  }
  const worlds = planInternationalField({
    teams,
    phases: worldPhases(),
    career: worldCareer({ a: 80, b: 78 }),
    championshipName: "Worlds 2026",
  });
  assert.equal(worlds.active, true, "Worlds precisa do plano internacional");
});

test("PLAY-IN: as 2 melhores regiões do ranking NUNCA disputam o play-in", () => {
  // Ranking de regiões (pontos internacionais): CBLOL 200 e LCS 200 são as
  // 2 melhores → ISENTAS (todos os times delas vão direto).
  // LPL/LCK (2 vagas cada) vão direto com o melhor seed e mandam o PIOR pro
  // play-in. LEC/LCP (1 vaga cada) vão direto pro play-in.
  const cblol = mkRegion("CBLOL", 3, 95);
  const lcs = mkRegion("LCS", 2, 85);
  const lpl = mkRegion("LPL", 2, 72);
  const lck = mkRegion("LCK", 2, 74);
  const lec = mkRegion("LEC", 1, 55);
  const lcp = mkRegion("LCP", 1, 50);
  const teams: Team[] = [
    ...cblol.teams,
    ...lcs.teams,
    ...lpl.teams,
    ...lck.teams,
    ...lec.teams,
    ...lcp.teams,
  ];
  const ratings = {
    ...cblol.ratings,
    ...lcs.ratings,
    ...lpl.ratings,
    ...lck.ratings,
    ...lec.ratings,
    ...lcp.ratings,
  };
  const plan = planInternationalField({
    teams,
    phases: worldPhases(),
    career: intlCareer(ratings, {
      CBLOL: 200,
      LCS: 200,
      LPL: 70,
      LCK: 70,
      LEC: 30,
      LCP: 30,
    }),
    championshipName: "Worlds 2026",
  });

  assert.equal(plan.active, true);
  assert.deepEqual(
    plan.playInExemptRegions,
    ["CBLOL", "LCS"],
    "as 2 melhores regiões do ranking são isentas do play-in",
  );
  // NENHUM time das regiões isentas disputa o play-in.
  for (const id of ["cblolA", "cblolB", "cblolC", "lcsA", "lcsB"]) {
    assert.ok(plan.directTeamIds.includes(id), `${id} vai direto`);
    assert.ok(!plan.playInTeamIds.includes(id), `${id} NUNCA joga o play-in`);
  }
  // Fora do top 2: o pior seed da região vai pro play-in e região com 1
  // vaga vai direto pro play-in.
  assert.deepEqual(
    plan.playInTeamIds.slice().sort(),
    ["lckB", "lcpA", "lecA", "lplB"].sort(),
    "pior seed de LPL/LCK + os times das regiões de 1 vaga",
  );
  assert.ok(plan.directTeamIds.includes("lplA"), "o melhor seed da LPL vai direto");
  assert.ok(plan.directTeamIds.includes("lckA"), "o melhor seed da LCK vai direto");
  assert.equal(plan.directTeamIds.length, 7, "3 CBLOL + 2 LCS + 1 LPL + 1 LCK");
  assert.equal(plan.qualifiersToMain, 4, "as 4 vagas em disputa saem do play-in");
});

test("PLAY-IN: mais times do que vagas → o play-in ELIMINA", () => {
  // CBLOL (8 vagas na HoF, 8 times) e LCS (4 vagas, 4 times) são as 2
  // melhores → isentas e SEM vaga sobrando.
  // LEC (2 vagas, 4 times): 2 diretos + 2 extras no play-in.
  // LPL (1 vaga, 1 time): vai pro play-in.
  // => play-in com 3 times disputando 1 vaga: 2 são eliminados.
  const cblol = mkRegion("CBLOL", 8, 95);
  const lcs = mkRegion("LCS", 4, 85);
  const lec = mkRegion("LEC", 4, 72);
  const lpl = mkRegion("LPL", 1, 60);
  const teams: Team[] = [...cblol.teams, ...lcs.teams, ...lec.teams, ...lpl.teams];
  const ratings = { ...cblol.ratings, ...lcs.ratings, ...lec.ratings, ...lpl.ratings };

  const plan = planInternationalField({
    teams,
    phases: worldPhases(),
    career: intlCareer(ratings, { CBLOL: 200, LCS: 100, LEC: 70, LPL: 30 }),
    championshipName: "Worlds 2026",
  });

  assert.equal(plan.active, true);
  assert.deepEqual(plan.playInExemptRegions, ["CBLOL", "LCS"]);
  assert.deepEqual(
    plan.playInTeamIds.slice().sort(),
    ["lecC", "lecD", "lplA"].sort(),
    "os 2 PIORES seeds da LEC e o time da LPL (1 vaga)",
  );
  assert.equal(plan.qualifiersToMain, 1, "só a vaga da LPL está em disputa");
  assert.equal(plan.directTeamIds.length, 14, "8 CBLOL + 4 LCS + 2 LEC");
});

test("PLAY-IN: o classificado do play-in entra na fase principal", () => {
  // Integração: play-in de 3 times disputando 1 vaga → 1 classificado,
  // os outros 2 eliminados. (CBLOL e LCS são isentas e enchem as vagas.)
  const cblol = mkRegion("CBLOL", 8, 95);
  const lcs = mkRegion("LCS", 4, 85);
  const lec = mkRegion("LEC", 4, 72);
  const lpl = mkRegion("LPL", 1, 60);
  const teams: Team[] = [...cblol.teams, ...lcs.teams, ...lec.teams, ...lpl.teams];
  const ratings = { ...cblol.ratings, ...lcs.ratings, ...lec.ratings, ...lpl.ratings };
  const plan = planInternationalField({
    teams,
    phases: worldPhases(),
    career: intlCareer(ratings, { CBLOL: 200, LCS: 100, LEC: 70, LPL: 30 }),
    championshipName: "Worlds 2026",
  });

  const playInPhase = {
    id: "pi",
    name: "Play-in",
    kind: "bracket",
    config: {
      kind: "bracket",
      slots: 4,
      type: "single",
      defaultBestOf: 3,
      finalBestOf: 5,
      bracketReset: false,
    },
    matches: buildPhaseMatches(
      {
        kind: "bracket",
        slots: 4,
        type: "single",
        defaultBestOf: 3,
        finalBestOf: 5,
        bracketReset: false,
      },
      plan.playInTeamIds,
      [],
    ),
    advanceCount: plan.qualifiersToMain,
  } as unknown as Phase;

  const played = playAll(playInPhase.matches);
  const qualified = getQualifiers(
    { ...playInPhase, matches: played } as Phase,
    plan.qualifiersToMain,
  );
  assert.equal(qualified.length, 1, "só 1 classificado no evento principal");
  assert.ok(
    qualified.every((id) => plan.playInTeamIds.includes(id)),
    "os classificados saem do play-in",
  );
  // quem não classificou some do evento
  const eliminated = plan.playInTeamIds.filter((id) => !qualified.includes(id));
  assert.equal(eliminated.length, 2, "2 times eliminados no play-in");
});

test("PLAY-IN: sem seeds extras não existe play-in", () => {
  const teams: Team[] = ["A", "B"].map((n) => ({
    id: `lck${n}`,
    name: `LCK ${n}`,
    tag: n,
    region: "LCK",
  }));
  const plan = planInternationalField({
    teams,
    phases: worldPhases(),
    career: worldCareer({ "LCK A": 90, "LCK B": 88 }),
    championshipName: "Worlds 2026",
  });
  assert.equal(plan.active, true);
  assert.equal(plan.playInTeamIds.length, 0);
  assert.equal(plan.playInEmpty, true, "play-in sem inscritos é fase dispensada");
  assert.equal(plan.directTeamIds.length, 2, "todos vão direto");
});

test("INTERNACIONAL: o nº de vagas do evento vem do Hall da Fama (sem número fixo)", () => {
  // LCK manda 6 (4 vagas na HoF) e LPL manda 2 (4 vagas na HoF).
  // => o evento tem 8 vagas (soma das vagas por região) e o play-in disputa
  //    as 2 vagas que a LPL não usou.
  const teams: Team[] = [
    ...["A", "B", "C", "D", "E", "F"].map((n) => ({
      id: `lck${n}`,
      name: `LCK ${n}`,
      tag: n,
      region: "LCK",
    })),
    ...["X", "Y"].map((n) => ({
      id: `lpl${n}`,
      name: `LPL ${n}`,
      tag: n,
      region: "LPL",
    })),
  ];
  const ratings: Record<string, number> = {
    "LCK A": 92,
    "LCK B": 88,
    "LCK C": 84,
    "LCK D": 80,
    "LCK E": 68,
    "LCK F": 64,
    "LPL X": 70,
    "LPL Y": 66,
  };
  const plan = planInternationalField({
    teams,
    phases: worldPhases(),
    career: worldCareer(ratings),
    championshipName: "Worlds 2026",
  });

  // Soma das vagas do Hall da Fama por região (fonte da verdade).
  const slotsByRegion = new Map<string, number>();
  for (const entry of plan.entries) slotsByRegion.set(entry.region, entry.regionSlots);
  const hofTotal = Array.from(slotsByRegion.values()).reduce((a, b) => a + b, 0);
  assert.equal(plan.mainTargetSlots, hofTotal, "o evento tem as vagas do Hall da Fama");
  assert.equal(
    plan.eventTeamCount,
    plan.directTeamIds.length + plan.qualifiersToMain,
    "os times do evento = diretos + classificados do play-in",
  );

  // O número fixo de vagas configurado na fase NÃO interfere no evento.
  const fasesVagasMinimas = worldPhases();
  fasesVagasMinimas[1]!.config = {
    ...fasesVagasMinimas[1]!.config,
    slots: 2,
  } as PlayoffsConfig;
  const plan2 = planInternationalField({
    teams,
    phases: fasesVagasMinimas,
    career: worldCareer(ratings),
    championshipName: "Worlds 2026",
  });
  assert.equal(
    plan2.mainTargetSlots,
    hofTotal,
    "número fixo de vagas na fase não muda o tamanho do evento",
  );
});

// ---------------------------------------------------------------------------
// PLAY-IN internacional: formato, sem "Grande Final", e evento em paralelo
// ---------------------------------------------------------------------------

/** Semeia uma fase de chave como o store faz (com vagas reservadas). */
const seedBracketPhase = (config: Phase["config"], teamIds: string[], reservedSlots = 0): Phase =>
  ({
    id: "p",
    name: "Fase",
    kind: "bracket",
    config,
    groups: undefined,
    matches: buildPhaseMatches(config, teamIds, [], reservedSlots),
    seededTeamIds: teamIds,
  }) as unknown as Phase;

test("PLAY-IN: NÃO existe 'Grande Final' no play-in — o play-in é grupo", () => {
  // 4 times disputando 2 vagas => 2 grupos (top 1 de cada), formato Worlds/MSI.
  const twoSlots = playInStructure(4, 2);
  assert.equal(twoSlots.kind, "groups", "play-in com 2+ vagas é grupo");
  assert.equal(twoSlots.groupCount, 2);
  assert.equal(twoSlots.qualifiersPerGroup, 1);
  assert.equal(twoSlots.deciderLabel, null);

  // 8 times disputando 4 vagas => 2 grupos de 4 em GSL (dupla eliminação).
  const fourSlots = playInStructure(8, 4);
  assert.equal(fourSlots.kind, "groups");
  assert.equal(fourSlots.groupCount, 2);
  assert.equal(fourSlots.qualifiersPerGroup, 2);
  assert.equal((fourSlots.config as { format?: string }).format, "gsl");

  // Nenhum confronto do play-in se chama "Grande Final".
  const groups = createGroupsForTeams(fourSlots.config as GroupsConfig, [
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p6",
    "p7",
    "p8",
  ]);
  const matches = buildPhaseMatches(fourSlots.config as GroupsConfig, [], groups);
  assert.equal(
    matches.filter((m) => m.roundName === "Grande Final").length,
    0,
    "play-in não pode ter Grande Final",
  );
});

test("PLAY-IN: UMA vaga só vira confronto de Classificação (não final)", () => {
  const one = playInStructure(2, 1);
  assert.equal(one.kind, "bracket");
  assert.equal(one.deciderLabel, "Classificação");
  const built = buildPhaseMatches(one.config as PlayoffsConfig, ["p1", "p2"], []);
  const matches = renameDecider(built, one.deciderLabel!);
  const decider = matches.find((m) => m.roundName);
  assert.equal(decider?.roundName, "Classificação");
  assert.equal(
    matches.filter((m) => m.roundName === "Grande Final").length,
    0,
    "play-in de uma vaga não é Grande Final",
  );
});

test("MSI: a fase principal começa JUNTO com o play-in (vagas reservadas)", () => {
  const config: PlayoffsConfig = {
    kind: "bracket",
    slots: 8,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
  };
  // 6 diretos + 2 vagas reservadas pro classificado do play-in.
  const main = seedBracketPhase(config, ["d1", "d2", "d3", "d4", "d5", "d6"], 2);

  assert.equal(pendingSlotCount(main.matches), 2, "as 2 vagas do play-in ficam reservadas");
  assert.equal(
    main.matches.filter((m) => m.bye).length,
    0,
    "ninguém passa direto: sem bye, todo mundo começa na mesma fase",
  );
  // Os 6 diretos já podem jogar (mesma fase do play-in).
  const playable = main.matches.filter((m) => m.teamAId && m.teamBId);
  assert.ok(playable.length >= 2, "os diretos já têm confronto na 1ª rodada");
  // As vagas reservadas estão vazias, esperando o classificado.
  assert.equal(
    main.matches.filter((m) => m.pendingA || m.pendingB).length,
    2,
    "as vagas reservadas continuam vazias",
  );
  // A fase principal NÃO está pronta enquanto o play-in não entregou ninguém.
  assert.equal(isPhaseComplete(main), false, "fase com vaga reservada não fecha antes do play-in");
});

test("Puxar classificados: o campeão do play-in entra na vaga reservada", () => {
  // Play-in de 4 times em 2 grupos de 2 (top 1 de cada) => 2 classificados.
  const structure = playInStructure(4, 2);
  const groups = createGroupsForTeams(structure.config as GroupsConfig, ["p1", "p2", "p3", "p4"]);
  const playIn: Phase = {
    id: "pi",
    name: "Play-in",
    kind: "groups",
    config: structure.config,
    groups,
    matches: buildPhaseMatches(structure.config as GroupsConfig, [], groups),
    advanceCount: 2,
  } as unknown as Phase;

  const played = playAll(playIn.matches);
  const donePlayIn = { ...playIn, matches: played } as Phase;
  assert.equal(isPhaseComplete(donePlayIn), true, "play-in jogado fecha");

  const config: PlayoffsConfig = {
    kind: "bracket",
    slots: 8,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
  };
  const main = seedBracketPhase(config, ["d1", "d2", "d3", "d4", "d5", "d6"], 2);
  // O time direto já jogou o primeiro confronto (paralelo ao play-in).
  const firstMatch = main.matches.find((m) => m.teamAId && m.teamBId)!;
  const mainWithResult: Phase = {
    ...main,
    matches: main.matches.map((m) => (m.id === firstMatch.id ? { ...m, winnerId: m.teamAId } : m)),
  } as Phase;

  const advance = planPhaseAdvance({
    previous: donePlayIn,
    target: mainWithResult,
    divisionTeamIds: new Set(["d1", "d2", "d3", "d4", "d5", "d6", "p1", "p2", "p3", "p4"]),
  });
  assert.ok(advance, "o avanço tem que acontecer");
  assert.equal(advance.kind, "fill", "o classificado entra na vaga reservada");
  assert.equal(pendingSlotCount(advance.matches), 0, "nenhuma vaga ficou pendente");
  const filled = advance.matches.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean) as string[];
  assert.ok(
    advance.qualified.every((id) => filled.includes(id)),
    "os classificados do play-in entraram na fase principal",
  );
  assert.ok(
    advance.matches.some((m) => m.id === firstMatch.id && m.winnerId),
    "o resultado já jogado na fase principal NÃO foi apagado",
  );
});

test("MSI: chave completada para potência de 2 NÃO vira vaga pendente extra", () => {
  const config: PlayoffsConfig = {
    kind: "bracket",
    slots: 16,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
  };
  // 11 diretos + 2 vagas do play-in = 13 times -> a chave vai para 16 slots.
  // As 3 sobras são bye NORMAL; só 2 vagas ficam reservadas pro play-in.
  const ids = Array.from({ length: 11 }, (_, i) => `d${i + 1}`);
  const main = seedBracketPhase(config, ids, 2);
  assert.equal(pendingSlotCount(main.matches), 2, "só as vagas do play-in ficam pendentes");
  assert.ok(
    main.matches.some((m) => m.bye),
    "a sobra da chave é bye comum",
  );
});

test("Puxar classificados: bye não trava o avanço (regressão do bug)", () => {
  // Fase principal semeada com os diretos: os byes são auto-resolvidos e
  // têm winnerId. Antes isso contava como "resultado" e o avanço não saía.
  const config: PlayoffsConfig = {
    kind: "bracket",
    slots: 8,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
  };
  const main = seedBracketPhase(config, ["d1", "d2", "d3"]);
  assert.ok(
    main.matches.some((m) => m.bye && m.winnerId),
    "o cenário tem bye auto-resolvido",
  );

  const previous: Phase = {
    id: "prev",
    name: "Fase anterior",
    kind: "bracket",
    config,
    matches: playAll(buildPhaseMatches({ ...config, slots: 4 }, ["p1", "p2", "p3", "p4"], [])),
    advanceCount: 1,
  } as unknown as Phase;

  const advance = planPhaseAdvance({
    previous,
    target: main,
    divisionTeamIds: new Set(["d1", "d2", "d3", "p1", "p2", "p3", "p4"]),
  });
  assert.ok(advance, "bye não pode bloquear o avanço");
  assert.equal(advance.kind, "reseed");
  assert.equal(advance.teamIds.length, 4, "diretos + classificado");
});

// ---------------------------------------------------------------------------
// regressões do motor (o que já funcionava tem que continuar funcionando)
// ---------------------------------------------------------------------------

test("motor: chave com byes fecha com campeão", () => {
  const ms = playAll(singleElim(["t1", "t2", "t3", "t4", "t5", "t6"]));
  const final = ms.find((m) => (m.round ?? 0) === 2);
  assert.ok(final?.winnerId, "a final precisa de campeão");
  assert.equal(ms.filter((m) => m.teamAId && m.teamBId && !m.winnerId).length, 0);
});

test("motor: eliminação dupla fecha e classifica todos", () => {
  const ids = Array.from({ length: 8 }, (_, i) => `d${i}`);
  const ms = playAll(
    buildPhaseMatches(
      {
        kind: "bracket",
        slots: 8,
        type: "double",
        defaultBestOf: 3,
        finalBestOf: 5,
        bracketReset: false,
      },
      ids,
      [],
    ),
  );
  const grand = ms.find((m) => m.bracketSide === "grand");
  assert.ok(grand?.winnerId, "a grande final precisa de campeão");
  const standings = getBracketStandings({ kind: "bracket", matches: ms, config: {} } as Phase);
  assert.equal(standings.length, 8, "classificação com os 8 times");
  assert.equal(new Set(standings).size, 8, "sem repetição na classificação");
});

test("motor: fase com bye é considerada concluída", () => {
  const ms = generateSwissRound1(["a", "b", "c"], 3);
  const phase = {
    kind: "swiss",
    config: { kind: "swiss", winsToAdvance: 2, lossesToEliminate: 2, defaultBestOf: 3 },
    matches: ms,
  } as Phase;
  assert.equal(isPhaseComplete(phase), false, "rodada 1 com jogo em aberto não está pronta");
});

test("motor: recesso continua determinístico", () => {
  const roster = ensureRoster({ id: "x", name: "T1", tag: "T1", region: "LCK" } as Team)!;
  const a = evolveRoster(roster, { splitLabel: "2026 Split 2", winRate: 0.5 });
  const b = evolveRoster(roster, { splitLabel: "2026 Split 2", winRate: 0.5 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("PLAY-IN: o fim da fase separa classificados de eliminados", () => {
  // 6 times em 2 grupos de 3, 1 vaga por grupo => 2 classificados, 4 eliminados.
  const structure = playInStructure(6, 2);
  const groups = createGroupsForTeams(structure.config as GroupsConfig, [
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p6",
  ]);
  const playIn: Phase = {
    id: "pi",
    name: "Play-in",
    kind: "groups",
    config: structure.config,
    groups,
    matches: buildPhaseMatches(structure.config as GroupsConfig, [], groups),
    advanceCount: 2,
  } as unknown as Phase;

  const entrants = groups.flatMap((g) => g.teamIds);
  const done = { ...playIn, matches: playAll(playIn.matches) } as Phase;
  assert.equal(isPhaseComplete(done), true, "play-in com todos os jogos fechados");

  const qualified = getQualifiers(done, done.advanceCount);
  const eliminated = entrants.filter((id) => !qualified.includes(id));
  assert.equal(qualified.length, 2, "2 vagas em disputa => 2 classificados");
  assert.equal(eliminated.length, 4, "os outros 4 saem do evento");
  assert.equal(new Set([...qualified, ...eliminated]).size, entrants.length, "nenhum time sumiu");
});

test("Puxar classificados: puxar de novo não duplica ninguém", () => {
  const structure = playInStructure(4, 2);
  const groups = createGroupsForTeams(structure.config as GroupsConfig, ["p1", "p2", "p3", "p4"]);
  const playIn: Phase = {
    id: "pi",
    name: "Play-in",
    kind: "groups",
    config: structure.config,
    groups,
    matches: buildPhaseMatches(structure.config as GroupsConfig, [], groups),
    advanceCount: 2,
  } as unknown as Phase;
  const done = { ...playIn, matches: playAll(playIn.matches) } as Phase;
  const qualified = getQualifiers(done, 2);

  const config: PlayoffsConfig = {
    kind: "bracket",
    slots: 8,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
  };
  const main = seedBracketPhase(config, ["d1", "d2", "d3", "d4"], 2);

  const first = fillPendingSlots(main.matches, qualified);
  assert.equal(pendingSlotCount(first), 0, "as 2 vagas foram preenchidas");
  const second = fillPendingSlots(first, qualified);
  assert.equal(pendingSlotCount(second), 0, "puxar de novo não abre vaga nova");
  const firstRound = second.filter((m) => (m.round ?? 0) === 0);
  const ids = firstRound.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean) as string[];
  assert.equal(new Set(ids).size, ids.length, "nenhum time duplicado na 1ª rodada");
  assert.equal(
    ids.filter((id) => qualified.includes(id)).length,
    qualified.length,
    "cada classificado entrou uma vez só",
  );
});

test("Puxar classificados: classificado a menos NÃO trava o avanço (vaga fica pendente)", () => {
  // O formato definiu 2 classificados, mas a fase principal tem 3 vagas
  // reservadas: o avanço tem que acontecer (preenchendo o que tem) em vez de
  // devolver null — o botão "Puxar classificados" não pode ser um no-op
  // silencioso, e a vaga sem classificado continua esperando.
  const structure = playInStructure(4, 2);
  const groups = createGroupsForTeams(structure.config as GroupsConfig, ["p1", "p2", "p3", "p4"]);
  const playIn: Phase = {
    id: "pi",
    name: "Play-in",
    kind: "groups",
    config: structure.config,
    groups,
    matches: buildPhaseMatches(structure.config as GroupsConfig, [], groups),
    advanceCount: 2,
  } as unknown as Phase;
  const done = { ...playIn, matches: playAll(playIn.matches) } as Phase;

  const config: PlayoffsConfig = {
    kind: "bracket",
    slots: 8,
    type: "single",
    defaultBestOf: 3,
    finalBestOf: 5,
    bracketReset: false,
  };
  const main = seedBracketPhase(config, ["d1", "d2", "d3", "d4"], 3);

  const advance = planPhaseAdvance({
    previous: done,
    target: main,
    divisionTeamIds: new Set(["d1", "d2", "d3", "d4", "p1", "p2", "p3", "p4"]),
  });
  assert.ok(advance, "o avanço acontece mesmo faltando classificado");
  assert.equal(advance.kind, "fill");
  assert.equal(pendingSlotCount(advance.matches), 1, "a vaga sem classificado continua pendente");
  const filled = advance.matches.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean) as string[];
  assert.ok(advance.qualified.every((id) => filled.includes(id)), "o classificado entrou");
});
