import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CareerLedger,
  CareerTeam,
  Championship,
  ChampionHistoryEntry,
  GroupsConfig,
  InternationalLevel,
  IntlEditionRecord,
  IntlRegionPerf,
  Match,
  MomentumEvent,
  MomentumState,
  Phase,
  PlayoffsConfig,
  SerieB,
  SwissConfig,
  Team,
} from "./types";
import {
  automaticPlayInAdvanceCount,
  adaptPlayoffConfig,
  buildPhaseMatches,
  createGroupsForTeams,
  generateSwissRound1,
  isPhaseComplete,
  getQualifiers,
  propagateBracketWinner,
  renameDecider,
  resolveByes,
  syncSwiss,
  uid,
} from "./generate";
import { electMatchMvp } from "./mvp";
import {
  canonicalTournamentName,
  extractSeasonFromChampName,
  getOfficialRegionRanking,
  inferTeamRegion,
  isPlayInPhase,
  normalizeRegion,
  phaseTeamIdsInOrder,
  planInternationalField,
  playInStructure,
} from "./international";
import { planPhaseAdvance } from "./advance";
export { propagateBracketWinner };
import { buildCs2SeedChampionships } from "./cs2-seed";
import { detectLeaguePreset, getOfficialLogo } from "./official-logos";
import { advanceInternationalEdition } from "./circuit";
import { compressExistingLogo, deepCompressLogos, getStorageUsage } from "./image";
import { applyMatchEffects, revertMatchEffects, seasonRecords } from "./momentum";
import {
  applyPlayerDeltas,
  effectiveRating,
  ensureRoster,
  isGenericRoster,
  matchPlayerDeltas,
  pickStarters,
  revertPlayerDeltas,
  stripDerivedRoster,
} from "./players";
import {
  advanceChampionshipToNextSplit,
  buildNextSplitChampionship,
  archiveCompletedChampions,
  buildPromotionBracket,
  promotionOutcome,
  seriesBottomTwo,
  seriesFinalists,
} from "./promotion";
import {
  GLOBAL_FREE_AGENT_POOL,
  LEGACY_FICTIONAL_FREE_AGENTS,
  isLegacyClonedPlayer,
  runMidSplitMarketTick,
} from "./transfers";

const STORAGE_KEY = "lol-esports-sim:v2";
const CS2_SEED_FLAG = "lol-esports-sim:cs2-seeded";
const CAREER_KEY = "lol-esports-sim:career:v1";
const CAREER_SEED_FLAG = "lol-esports-sim:career-seeded:v1";

export type Division = 1 | 2;

const normKey = (s: string) => s.trim().toLowerCase();

function emptyLedger(): CareerLedger {
  return { lol: {}, cs2: {}, seen: {} };
}

function loadCareer(): CareerLedger {
  if (typeof window === "undefined") return emptyLedger();
  try {
    const raw = window.localStorage.getItem(CAREER_KEY);
    if (!raw) return emptyLedger();
    return pruneSeen(
      normalizeCareerLedger({ ...emptyLedger(), ...(JSON.parse(raw) as CareerLedger) }),
    );
  } catch {
    return emptyLedger();
  }
}

/**
 * Multiplicador de pontos de carreira baseado no prestígio do campeonato.
 * Major (Worlds/MSI): 2x · Secundário / Minor (First Stand, Rift Rivals, etc.): 1.35x · Liga local: 1x.
 */
export function careerMultiplier(c: Championship): number {
  if (c.internationalLevel === "major") return 2;
  if (c.internationalLevel === "minor") return 1.35;
  if (c.isInternational === true) return 1.35;
  return 1;
}

/**
 * Um campeonato é "internacional" se marcado como tal OU se tiver times
 * de 2+ regiões distintas (auto-detecção para dados antigos).
 */
export function isInternationalChamp(c: Championship): boolean {
  if (c.internationalLevel === "major" || c.internationalLevel === "minor") return true;
  if (c.isInternational === true) return true;
  if (c.isInternational === false) return false;
  // Auto-detecção: times de 2+ regiões diferentes
  const regions = new Set(
    c.teams.map((t) => t.region?.trim().toUpperCase()).filter((r): r is string => !!r),
  );
  return regions.size > 1;
}

/**
 * Detecta o nível de prestígio pelo nome (usado na seed).
 * Worlds/MSI/Mundial = Major; Torneios Secundários / 2+ regiões = Minor; senão = None.
 */
export function detectInternationalLevel(c: Championship): InternationalLevel {
  if (c.internationalLevel) return c.internationalLevel;
  const name = c.name.toLowerCase();
  if (/copa do mundo|world cup|seleções|selecoes/i.test(name)) return "minor";
  if (/worlds?|mundial|msi/i.test(name)) return "major";
  if (
    c.isInternational === true ||
    /first\s*stand|kickoff|rift\s*rivals|supercopa|global\s*masters|desafiante/i.test(name) ||
    isInternationalChamp(c)
  ) {
    return "minor";
  }
  return "none";
}

const STAGE_ORDER: Record<IntlRegionPerf["bestStage"], number> = {
  groups: 1,
  playoffs: 2,
  runnerup: 3,
  champion: 4,
};

function intlEditionKey(c: Championship): { editionKey: string; champName: string; season: string; level: "major" | "minor" } {
  const champName = canonicalTournamentName(c.name);
  const rawSeason = (c.season ?? "").trim() || "Atual";
  const season = extractSeasonFromChampName(c.name, rawSeason);
  const level: "major" | "minor" = detectInternationalLevel(c) === "major" ? "major" : "minor";
  return {
    editionKey: `${normKey(champName)}|${normKey(season)}`,
    champName,
    season,
    level,
  };
}

function upsertIntlEditionPerf(
  ledger: CareerLedger,
  c: Championship,
  region: string,
  delta: {
    wins?: number;
    losses?: number;
    played?: number;
    coefPoints?: number;
    stage?: IntlRegionPerf["bestStage"];
    setChampion?: boolean;
    setRunnerUp?: boolean;
  },
): CareerLedger {
  const reg = normalizeRegion(region);
  if (!reg) return ledger;
  const game = (c.game ?? "lol") as "lol" | "cs2";
  const meta = intlEditionKey(c);
  const prevList = [...(ledger.intlHistory?.[game] ?? [])];
  const idx = prevList.findIndex((ed) => ed.editionKey === meta.editionKey);
  const existing: IntlEditionRecord =
    idx >= 0
      ? {
          ...prevList[idx],
          regionScores: { ...prevList[idx].regionScores },
        }
      : {
          editionKey: meta.editionKey,
          champName: meta.champName,
          season: meta.season,
          level: meta.level,
          at: new Date().toISOString(),
          regionScores: {},
        };

  const prevPerf: IntlRegionPerf = existing.regionScores[reg] ?? {
    wins: 0,
    losses: 0,
    played: 0,
    coefPoints: 0,
    bestStage: "groups",
  };
  const nextStage =
    delta.stage && STAGE_ORDER[delta.stage] > STAGE_ORDER[prevPerf.bestStage]
      ? delta.stage
      : prevPerf.bestStage;

  existing.regionScores[reg] = {
    wins: prevPerf.wins + (delta.wins ?? 0),
    losses: prevPerf.losses + (delta.losses ?? 0),
    played: prevPerf.played + (delta.played ?? 0),
    coefPoints: prevPerf.coefPoints + (delta.coefPoints ?? 0),
    bestStage: nextStage,
  };
  if (delta.setChampion) existing.championRegion = reg;
  if (delta.setRunnerUp) existing.runnerUpRegion = reg;

  if (idx >= 0) {
    prevList[idx] = existing;
  } else {
    prevList.push(existing);
  }
  const trimmed = prevList.slice(-12);
  return {
    ...ledger,
    intlHistory: {
      ...(ledger.intlHistory ?? {}),
      [game]: trimmed,
    },
  };
}

/**
 * Credita um resultado de partida no ranking de carreira PERMANENTE.
 * Idempotente: a MESMA partida nunca credita duas vezes — a chave é do
 * confronto, não do vencedor. Antes a chave levava o vencedor, então trocar
 * o resultado de uma partida credita o novo vencedor DE NOVO e o ranking
 * inflava sem limite. Limpar o placar NÃO devolve o que já foi creditado —
 * carreira é carreira.
 */
function creditMatch(
  ledger: CareerLedger,
  c: Championship,
  match: Pick<Match, "id" | "teamAId" | "teamBId" | "bye">,
  winnerId: string,
  isPlayoff: boolean,
): CareerLedger {
  if ((c.countsTowardsRanking ?? true) === false) return ledger;
  if (!match.teamAId || !match.teamBId || match.bye) return ledger;
  const key = `m:${c.id}:${match.id}`;
  if (ledger.seen?.[key]) return ledger;
  const pool = [...c.teams, ...(c.formerTeams ?? [])];
  const a = pool.find((t) => t.id === match.teamAId);
  const b = pool.find((t) => t.id === match.teamBId);
  if (!a || !b) return ledger;
  const winner = winnerId === match.teamAId ? a : b;
  const loser = winnerId === match.teamAId ? b : a;
  const game = (c.game ?? "lol") as "lol" | "cs2";
  const next: CareerLedger = {
    ...ledger,
    lol: ledger.lol ?? {},
    cs2: ledger.cs2 ?? {},
    seen: { ...(ledger.seen ?? {}), [key]: true },
  };
  const table = { ...(next[game] ?? {}) };
  const ensure = (t: Team): CareerTeam => {
    const fallbackReg = t.region || c.region || inferTeamRegion(t.name);
    return (
      table[normKey(t.name)] ?? {
        name: t.name,
        tag: t.tag,
        logo: t.logo,
        region: fallbackReg,
        points: 0,
        wins: 0,
        losses: 0,
        played: 0,
        titles: 0,
      }
    );
  };
  const w = { ...ensure(winner) };
  if (!w.region) w.region = winner.region || c.region || inferTeamRegion(winner.name);
  const mult = careerMultiplier(c);

  // ---------- IDENTIFICAÇÃO DINÂMICA DAS 2 MELHORES REGIÕES ----------
  // Baseado no Coeficiente de Momento atual da carreira (muda conforme desempenho recente).
  const currentRanking = getOfficialRegionRanking(ledger, game);
  const top2Regions = new Set(currentRanking.slice(0, 2).map((r) => r.region));

  const winnerRegionNorm = normalizeRegion(winner.region || w.region || inferTeamRegion(winner.name));
  const loserRegionNorm = normalizeRegion(loser.region || c.region || inferTeamRegion(loser.name));
  // Bônus especial ao derrotar uma das duas melhores regiões do momento:
  const beatTopRegion =
    !!loserRegionNorm &&
    top2Regions.has(loserRegionNorm) &&
    winnerRegionNorm !== loserRegionNorm;

  const isIntl = isInternationalChamp(c);
  const DOMESTIC_MAX_POINTS = 7;

  let winPoints: number;
  let lossPoints: number;

  if (isIntl) {
    const baseWin = isPlayoff ? 5 : 3;
    // Vitória contra time de uma das 2 melhores regiões concede bônus de gigante (+3 pts base):
    winPoints = Math.round((baseWin + (beatTopRegion ? 3 : 0)) * mult);
    lossPoints = Math.round((isPlayoff ? 1 : 2) * mult);
  } else {
    // Em liga doméstica, os pontos são reduzidos e o ganho total no campeonato nunca passa de 7 pontos
    const rawWin = isPlayoff ? 2 : 1;
    lossPoints = 1;
    const wCapKey = `${c.id}|${normKey(winner.name)}`;
    const lCapKey = `${c.id}|${normKey(loser.name)}`;
    const earnedW = next.domesticCap?.[wCapKey] ?? 0;
    const earnedL = next.domesticCap?.[lCapKey] ?? 0;
    const allowedGain = Math.max(0, DOMESTIC_MAX_POINTS - earnedW);
    winPoints = Math.min(rawWin, allowedGain);
    next.domesticCap = {
      ...(next.domesticCap ?? {}),
      [wCapKey]: earnedW + winPoints,
      [lCapKey]: Math.max(0, earnedL - lossPoints),
    };
  }

  w.points += winPoints;
  w.wins += 1;
  w.played += 1;
  w.tag = w.tag ?? winner.tag;
  w.logo = w.logo ?? winner.logo;
  w.region = w.region ?? winner.region;
  const l = { ...ensure(loser) };
  l.points -= lossPoints;
  l.losses += 1;
  l.played += 1;
  l.tag = l.tag ?? loser.tag;
  l.logo = l.logo ?? loser.logo;
  l.region = l.region ?? (loser.region || c.region || inferTeamRegion(loser.name));

  // ---------- RATING ELO (nível real do time) ----------
  // K maior em campeonatos de prestígio = rating mexe mais rápido.
  const K =
    c.internationalLevel === "major"
      ? 10
      : c.internationalLevel === "minor" || c.isInternational
        ? 8
        : 5;
  const ratingW = w.rating ?? 50;
  const ratingL = l.rating ?? 50;
  const expectedW = 1 / (1 + Math.pow(10, (ratingL - ratingW) / 25));
  const expectedL = 1 - expectedW;
  w.rating = Math.max(15, Math.min(85, ratingW + K * (1 - expectedW)));
  l.rating = Math.max(15, Math.min(85, ratingL + K * (0 - expectedL)));

  table[normKey(winner.name)] = w;
  table[normKey(loser.name)] = l;
  next[game] = table;

  // ---------- Desempenho INTERNACIONAL das regiões (Copa do Mundo de Seleções tem prestígio separado) ----------
  let result = next;
  if (isInternationalChamp(c) && !isWorldCupChamp(c)) {
    const intlTable = { ...(result.international?.[game] ?? {}) };
    const creditIntl = (
      region: string | undefined,
      points: number,
      wins: number,
      losses: number,
    ) => {
      const reg = normalizeRegion(region ?? "");
      if (!reg || reg === "OUTROS") return;
      const cur: CareerTeam = intlTable[reg] ?? {
        name: reg,
        points: 0,
        wins: 0,
        losses: 0,
        played: 0,
        titles: 0,
      };
      cur.points += points;
      cur.wins += wins;
      cur.losses += losses;
      cur.played += 1;
      intlTable[reg] = { ...cur };
    };
    creditIntl(winnerRegionNorm, winPoints, 1, 0);
    creditIntl(loserRegionNorm, -lossPoints, 0, 1);
    result.international = { ...result.international, [game]: intlTable };

    // Atualiza o histórico por edição (Coeficiente de Momento)
    const isMajor = detectInternationalLevel(c) === "major";
    const winCoef =
      (isPlayoff ? (isMajor ? 16 : 10) : isMajor ? 10 : 6) +
      (beatTopRegion ? (isMajor ? 6 : 4) : 0);
    const lossCoef = isMajor ? -4 : -2;
    const stage: IntlRegionPerf["bestStage"] = isPlayoff ? "playoffs" : "groups";
    if (winnerRegionNorm && winnerRegionNorm !== "OUTROS") {
      result = upsertIntlEditionPerf(result, c, winnerRegionNorm, {
        wins: 1,
        played: 1,
        coefPoints: winCoef,
        stage,
      });
    }
    if (loserRegionNorm && loserRegionNorm !== "OUTROS") {
      result = upsertIntlEditionPerf(result, c, loserRegionNorm, {
        losses: 1,
        played: 1,
        coefPoints: lossCoef,
        stage,
      });
    }
  }
  return result;
}

/** Credita um bônus (título/vice) no ranking de carreira permanente. */
function creditBonus(
  ledger: CareerLedger,
  c: Championship,
  kind: "title" | "runnerup",
  label: string,
  team: Team | { name: string; tag?: string; logo?: string; region?: string },
): CareerLedger {
  if ((c.countsTowardsRanking ?? true) === false) return ledger;
  // Nome canônico do torneio (MSI 2026 -> Mid-Season Invitational (MSI), Worlds 2026 -> World Championship (Worlds))
  // garante que edições futuras agrupem no mesmo torneio histórico em vez de criar um título isolado.
  const canonicalName = canonicalTournamentName(c.name);
  const canonicalLabel =
    /^(atual|campeão)$/i.test(label.trim()) && c.season
      ? c.season.trim()
      : extractSeasonFromChampName(c.name, label.trim());
  const key = `${kind}:${normKey(canonicalName)}|${normKey(canonicalLabel)}|${normKey(team.name)}`;
  if (ledger.seen?.[key]) return ledger;
  const game = (c.game ?? "lol") as "lol" | "cs2";
  const next: CareerLedger = {
    ...ledger,
    lol: ledger.lol ?? {},
    cs2: ledger.cs2 ?? {},
    international: ledger.international ?? {},
    seen: { ...(ledger.seen ?? {}), [key]: true },
  };
  const table = { ...(next[game] ?? {}) };
  const entry: CareerTeam = {
    ...(table[normKey(team.name)] ?? {
      name: team.name,
      tag: team.tag,
      logo: team.logo,
      region: team.region,
      points: 0,
      wins: 0,
      losses: 0,
      played: 0,
      titles: 0,
    }),
  };
  const isIntl = isInternationalChamp(c);
  const DOMESTIC_MAX_POINTS = 7;
  const capKey = `${c.id}|${normKey(team.name)}`;
  const earnedSoFar = next.domesticCap?.[capKey] ?? 0;

  if (kind === "title") {
    const rawTitlePts = isIntl ? Math.round(20 * careerMultiplier(c)) : DOMESTIC_MAX_POINTS;
    const creditPts = isIntl
      ? rawTitlePts
      : Math.max(0, Math.min(rawTitlePts, DOMESTIC_MAX_POINTS - earnedSoFar));
    entry.points += creditPts;
    entry.titles += 1;
    if (!isIntl) {
      next.domesticCap = {
        ...(next.domesticCap ?? {}),
        [capKey]: Math.min(DOMESTIC_MAX_POINTS, earnedSoFar + creditPts),
      };
    }
    // Registra na lista de títulos (alimento do pódio permanente).
    next.titles = [
      ...(next.titles ?? []),
      {
        champName: canonicalName,
        label: canonicalLabel || "Campeão",
        teamName: team.name,
        teamTag: team.tag,
        teamLogo: team.logo,
        at: new Date().toISOString(),
        game,
        points: creditPts,
      },
    ];
  } else {
    const rawRunnerPts = isIntl ? Math.round(10 * careerMultiplier(c)) : 4;
    const creditPts = isIntl
      ? rawRunnerPts
      : Math.max(0, Math.min(rawRunnerPts, 5 - earnedSoFar));
    entry.points += creditPts;
    if (!isIntl) {
      next.domesticCap = {
        ...(next.domesticCap ?? {}),
        [capKey]: Math.min(DOMESTIC_MAX_POINTS, earnedSoFar + creditPts),
      };
    }
  }
  entry.tag = entry.tag ?? team.tag;
  entry.logo = entry.logo ?? team.logo;
  entry.region = entry.region ?? (team.region || c.region || inferTeamRegion(team.name));
  table[normKey(team.name)] = entry;
  next[game] = table;

  // ---------- Desempenho INTERNACIONAL da região (Copa do Mundo de Seleções não altera vagas de clubes) ----------
  let result = next;
  if (isInternationalChamp(c) && !isWorldCupChamp(c)) {
    const region = normalizeRegion(team.region || entry.region || inferTeamRegion(team.name));
    if (region && region !== "OUTROS") {
      const intlTable = { ...(result.international?.[game] ?? {}) };
      const intl: CareerTeam = {
        ...(intlTable[region] ?? {
          name: region,
          points: 0,
          wins: 0,
          losses: 0,
          played: 0,
          titles: 0,
        }),
      };
      intl.points += Math.round((kind === "title" ? 20 : 10) * careerMultiplier(c));
      intl.played += 1;
      if (kind === "title") intl.titles += 1;
      intlTable[region] = intl;
      result.international = { ...result.international, [game]: intlTable };

      const isMajor = detectInternationalLevel(c) === "major";
      const bonusCoef =
        kind === "title" ? (isMajor ? 50 : 28) : (isMajor ? 28 : 16);
      result = upsertIntlEditionPerf(result, c, region, {
        coefPoints: bonusCoef,
        stage: kind === "title" ? "champion" : "runnerup",
        setChampion: kind === "title",
        setRunnerUp: kind === "runnerup",
      });
    }
  }
  return result;
}

/**
 * O mapa `seen` cresce 1 chave por partida jogada e nunca era podado —
 * 5000 partidas ≈ 113 KB só de chaves dentro do mesmo localStorage que já
 * lota por causa das logos. Mantém só as chaves de partida mais recentes;
 * as de título (poucas) nunca são podadas.
 */
const SEEN_MATCH_LIMIT = 4000;

function pruneSeen(ledger: CareerLedger, limit = SEEN_MATCH_LIMIT): CareerLedger {
  const seen = ledger.seen ?? {};
  const matchKeys = Object.keys(seen).filter((k) => k.startsWith("m:"));
  if (matchKeys.length <= limit) return ledger;
  const keep = new Set(matchKeys.slice(matchKeys.length - limit));
  const nextSeen: Record<string, true> = {};
  for (const [k, v] of Object.entries(seen)) {
    if (!k.startsWith("m:") || keep.has(k)) nextSeen[k] = v;
  }
  return { ...ledger, seen: nextSeen };
}

/**
 * Deduplicação NUCLEAR do ranking de carreira: para cada combinação
 * campeonato+time, mantém APENAS UM título (o mais recente). Remove qualquer
 * duplicata — placeholder, rótulo diferente, chave repetida, sobreposição.
 */
function normalizeCareerLedger(ledger: CareerLedger): CareerLedger {
  const rawTitles = ledger.titles ?? [];
  // Normaliza nomes de campeonatos e labels de edições para agrupar no torneio histórico canônico
  const titles = rawTitles.map((t) => ({
    ...t,
    champName: canonicalTournamentName(t.champName),
    label: extractSeasonFromChampName(t.champName, t.label),
  }));

  // Agrupa por JOGO + campeonato + split/edição + time e mantém só o mais
  // recente de cada grupo. Sem o split na chave, títulos de splits diferentes
  // colapsavam em um (−20 pts cada) e times homônimos de LoL/CS2 se
  // contaminavam.
  const best = new Map<string, { index: number; at: string }>();
  titles.forEach((t, i) => {
    const pair = `${t.game ?? "lol"}|${normKey(t.champName)}|${normKey(t.label)}|${normKey(t.teamName)}`;
    const cur = best.get(pair);
    if (!cur || t.at > cur.at) {
      best.set(pair, { index: i, at: t.at });
    }
  });

  const keepIndices = new Set(Array.from(best.values()).map((v) => v.index));
  const kept: typeof titles = [];
  const removed: typeof titles = [];
  titles.forEach((t, i) => {
    if (keepIndices.has(i)) kept.push(t);
    else removed.push(t);
  });

  const next: CareerLedger = { ...ledger, titles: kept };
  if (removed.length === 0) return next;

  // RECALCULA títulos/points do zero a partir do array limpo.
  for (const game of ["lol", "cs2"] as const) {
    const table = { ...(next[game] ?? {}) };
    for (const row of Object.values(table)) {
      if (row.titles === 0) continue;
      // Só títulos DESTE jogo (legado sem game conta como "lol").
      const mine = (t: (typeof titles)[number]) =>
        normKey(t.teamName) === normKey(row.name) && (t.game ?? "lol") === game;
      const uniqueTitles = kept.filter(mine).length;
      if (uniqueTitles < row.titles) {
        // Perde os pontos QUEM SÃO os títulos removidos (com multiplicador
        // real da hora do crédito — não um −20 fixo).
        const pointsLost = removed.filter(mine).reduce((sum, t) => sum + (t.points ?? 20), 0);
        table[normKey(row.name)] = {
          ...row,
          titles: uniqueTitles,
          points: Math.max(0, row.points - pointsLost),
        };
      }
    }
    next[game] = table;
  }

  // Recalcula internacional por região
  for (const game of ["lol", "cs2"] as const) {
    const intlTable = next.international?.[game];
    if (!intlTable) continue;
    const cleanIntl = { ...intlTable };
    for (const [region, row] of Object.entries(cleanIntl)) {
      if (row.titles === 0) continue;
      const mine = (t: (typeof titles)[number]) => {
        if ((t.game ?? "lol") !== game) return false;
        const teamRow = next[game]?.[normKey(t.teamName)];
        return teamRow?.region?.trim().toUpperCase() === region;
      };
      const uniqueTitles = kept.filter(mine).length;
      if (uniqueTitles < row.titles) {
        const pointsLost = removed.filter(mine).reduce((sum, t) => sum + (t.points ?? 20), 0);
        cleanIntl[region] = {
          ...row,
          titles: uniqueTitles,
          points: Math.max(0, row.points - pointsLost),
        };
      }
    }
    next.international = { ...next.international, [game]: cleanIntl };
  }

  // Garante que todo time cadastrado no ranking tenha região oficial preenchida
  for (const game of ["lol", "cs2"] as const) {
    const table = { ...(next[game] ?? {}) };
    let changed = false;
    for (const [key, row] of Object.entries(table)) {
      if (!row.region || normalizeRegion(row.region) === "OUTROS") {
        const inferred = inferTeamRegion(row.name);
        if (inferred) {
          table[key] = { ...row, region: inferred };
          changed = true;
        }
      }
    }
    if (changed) next[game] = table;
  }

  return next;
}

/** Prioridade da partida decisiva (reset > grande final > última). */
const decisivePriority = (m: Match) =>
  m.bracketSide === "reset" ? 4 : m.bracketSide === "grand" ? 3 : !m.nextMatchId ? 2 : 0;

/**
 * Migra os campeonatos atuais para o ranking de carreira na primeira
 * execução (idempotente — créditos repetidos são ignorados pelas chaves).
 */
function seedCareer(championships: Championship[]): CareerLedger {
  let ledger = loadCareer();
  for (const c of championships) {
    if ((c.countsTowardsRanking ?? true) === false) continue;
    for (const p of c.phases) {
      const isPlayoff = p.kind === "bracket";
      for (const m of p.matches) {
        if (m.winnerId) ledger = creditMatch(ledger, c, m, m.winnerId, isPlayoff);
      }
    }
    const pool = [...c.teams, ...(c.formerTeams ?? [])];
    for (const e of c.history ?? []) {
      ledger = creditBonus(ledger, c, "title", e.splitLabel, {
        name: e.teamName,
        tag: e.teamTag,
        logo: e.teamLogo,
      });
    }
    const finalPhase = [...c.phases].reverse().find((p) => p.kind === "bracket");
    if (finalPhase) {
      const last = [...finalPhase.matches].sort(
        (a, b) => decisivePriority(b) - decisivePriority(a) || (b.round ?? 0) - (a.round ?? 0),
      )[0];
      if (last?.winnerId && last.teamAId && last.teamBId) {
        const seasonLabel = (c.season ?? "Atual").trim() || "Atual";
        const champion = pool.find((t) => t.id === last.winnerId);
        const runnerUpId = last.winnerId === last.teamAId ? last.teamBId : last.teamAId;
        const runnerUp = pool.find((t) => t.id === runnerUpId);
        if (champion) {
          ledger = creditBonus(ledger, c, "title", seasonLabel, champion);
        }
        if (runnerUp) {
          ledger = creditBonus(ledger, c, "runnerup", seasonLabel, runnerUp);
        }
      }
    }
  }
  return ledger;
}

/**
 * Migra saves antigos para o novo histórico por edição (`intlHistory`)
 * sem alterar os pontos permanentes nem as chaves `seen`.
 */
function backfillIntlHistory(ledger: CareerLedger, championships: Championship[]): CareerLedger {
  if (ledger.intlHistory && Object.keys(ledger.intlHistory).length > 0) return ledger;
  let next: CareerLedger = { ...ledger, intlHistory: { ...(ledger.intlHistory ?? {}) } };
  const intlChamps = [...championships]
    .filter((c) => isInternationalChamp(c) && (c.countsTowardsRanking ?? true) !== false)
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));

  for (const c of intlChamps) {
    const pool = [...c.teams, ...(c.formerTeams ?? [])];
    const isMajor = detectInternationalLevel(c) === "major";
    for (const p of c.phases) {
      if (p.internationalPlayIn) continue;
      const isPlayoff = p.kind === "bracket";
      for (const m of p.matches) {
        if (!m.winnerId || !m.teamAId || !m.teamBId || m.bye) continue;
        const winner = pool.find((t) => t.id === m.winnerId);
        const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
        const loser = pool.find((t) => t.id === loserId);
        if (!winner || !loser) continue;
        const wReg = normalizeRegion(winner.region || inferTeamRegion(winner.name));
        const lReg = normalizeRegion(loser.region || inferTeamRegion(loser.name));
        const stage: IntlRegionPerf["bestStage"] = isPlayoff ? "playoffs" : "groups";
        if (wReg && wReg !== "OUTROS") {
          next = upsertIntlEditionPerf(next, c, wReg, {
            wins: 1,
            played: 1,
            coefPoints: isPlayoff ? (isMajor ? 16 : 10) : isMajor ? 10 : 6,
            stage,
          });
        }
        if (lReg && lReg !== "OUTROS") {
          next = upsertIntlEditionPerf(next, c, lReg, {
            losses: 1,
            played: 1,
            coefPoints: isMajor ? -4 : -2,
            stage,
          });
        }
      }
    }
    const finalPhase = [...c.phases].reverse().find((p) => p.kind === "bracket");
    if (finalPhase) {
      const last = [...finalPhase.matches].sort(
        (a, b) => decisivePriority(b) - decisivePriority(a) || (b.round ?? 0) - (a.round ?? 0),
      )[0];
      if (last?.winnerId && last.teamAId && last.teamBId) {
        const champ = pool.find((t) => t.id === last.winnerId);
        const runner = pool.find((t) => t.id === (last.winnerId === last.teamAId ? last.teamBId : last.teamAId));
        if (champ) {
          const cReg = normalizeRegion(champ.region || inferTeamRegion(champ.name));
          if (cReg && cReg !== "OUTROS") {
            next = upsertIntlEditionPerf(next, c, cReg, {
              coefPoints: isMajor ? 50 : 28,
              stage: "champion",
              setChampion: true,
            });
          }
        }
        if (runner) {
          const rReg = normalizeRegion(runner.region || inferTeamRegion(runner.name));
          if (rReg && rReg !== "OUTROS") {
            next = upsertIntlEditionPerf(next, c, rReg, {
              coefPoints: isMajor ? 28 : 16,
              stage: "runnerup",
              setRunnerUp: true,
            });
          }
        }
      }
    }
  }
  return next;
}

/** Campos legados da implementação antiga de divisões (tag no time/fase). */
interface LegacyDivisionFields {
  division?: unknown;
}

/**
 * Migra um campeonato do modelo antigo (times/fases marcados com
 * `division: 2`) para o novo modelo, em que a Série B é um bloco
 * totalmente separado (`serieB.teams` / `serieB.phases`).
 */
function sanitizePlayInPhase(phase: Phase): Phase {
  if (!phase.internationalPlayIn && !isPlayInPhase(phase)) return phase;
  const entrants = phaseTeamIdsInOrder(phase);
  if (entrants.length < 2) return phase;

  const properAdvance = automaticPlayInAdvanceCount(entrants.length);
  // Se o advanceCount for >= total de participantes, ninguém seria eliminado!
  const invalidAdvance = !phase.advanceCount || phase.advanceCount >= entrants.length;
  const advanceCount = invalidAdvance ? properAdvance : phase.advanceCount;

  let config = phase.config;
  const groups = phase.groups;

  if (phase.kind === "groups" && groups && groups.length > 0) {
    const groupCfg = config as GroupsConfig;
    const perGroup = Math.max(1, Math.round(advanceCount / groups.length));
    const allQualifyInGroup = groups.some(
      (g) => (groupCfg.qualifiersPerGroup ?? 0) >= g.teamIds.length,
    );
    if (invalidAdvance || allQualifyInGroup) {
      config = {
        ...groupCfg,
        qualifiersPerGroup: perGroup,
      };
    }
  }

  return {
    ...phase,
    advanceCount,
    config,
    groups,
  };
}

function sanitizePhases(phases: Phase[]): Phase[] {
  return phases.map(sanitizePlayInPhase);
}

/**
 * Migra um campeonato do modelo antigo (times/fases marcados com
 * `division: 2`) para o novo modelo, em que a Série B é um bloco
 * totalmente separado (`serieB.teams` / `serieB.phases`), e sanitiza
 * configurações de play-in internacional inválidas.
 */
function migrateChampionship(c: Championship): Championship {
  let base: Championship = c;
  if (!c.serieB) {
    const teams = c.teams as (Team & LegacyDivisionFields)[];
    const phases = c.phases as (Phase & LegacyDivisionFields)[];
    const strip = <T extends LegacyDivisionFields>(x: T): T => {
      const copy: T = { ...x };
      delete copy.division;
      return copy;
    };
    const bTeams = teams.filter((t) => t.division === 2).map(strip);
    const bPhases = phases.filter((p) => p.division === 2).map(strip);
    if (bTeams.length === 0 && bPhases.length === 0) {
      base = {
        ...c,
        teams: teams.map(strip),
        phases: phases.map(strip),
      };
    } else {
      base = {
        ...c,
        hasSecondDivision: c.hasSecondDivision ?? true,
        teams: teams.filter((t) => t.division !== 2).map(strip),
        phases: phases.filter((p) => p.division !== 2).map(strip),
        serieB: { teams: bTeams, phases: bPhases, history: [] },
      };
    }
  }

  return {
    ...base,
    phases: sanitizePhases(base.phases),
    serieB: base.serieB ? { ...base.serieB, phases: sanitizePhases(base.serieB.phases) } : undefined,
  };
}

/** Em qual série (1 = A, 2 = B) está a fase com este id. */
function phaseDivision(c: Championship, phaseId: string): Division {
  return c.serieB?.phases.some((p) => p.id === phaseId) ? 2 : 1;
}

/** Times da série indicada. */
function divisionTeams(c: Championship, division: Division): Team[] {
  return division === 2 ? (c.serieB?.teams ?? []) : c.teams;
}

/** Fases da série indicada. */
function divisionPhases(c: Championship, division: Division): Phase[] {
  return division === 2 ? (c.serieB?.phases ?? []) : c.phases;
}

/** Garante que `serieB` existe. */
function ensureSerieB(c: Championship): SerieB {
  return c.serieB ?? { teams: [], phases: [], history: [] };
}

/** Monta uma fase completa (grupos + confrontos) para um campo de times. */
function phaseWithTeams(
  phase: Phase,
  teamIds: string[],
  assignments?: Record<string, number>,
  /** Vagas RESERVADAS para os classificados do play-in (evento principal). */
  reservedSlots = 0,
): Phase {
  const config = adaptPlayoffConfig(phase.config, teamIds.length + reservedSlots);
  const groups = config.kind === "groups" ? createGroupsForTeams(config, teamIds, assignments) : [];
  return {
    ...phase,
    config,
    groups: config.kind === "groups" ? groups : undefined,
    matches: buildPhaseMatches(config, teamIds, groups, reservedSlots),
    seededTeamIds: teamIds,
  };
}

function clearPhaseParticipants(phase: Phase): Phase {
  return {
    ...phase,
    groups: phase.config.kind === "groups" ? [] : undefined,
    matches: [],
    seededTeamIds: [],
    directTeamIds: undefined,
    advanceCount: undefined,
  };
}

/** Aplica `fn` sobre a lista de fases da série indicada. */
function mapDivisionPhases(
  c: Championship,
  division: Division,
  fn: (phases: Phase[]) => Phase[],
): Championship {
  if (division === 2) {
    const serieB = ensureSerieB(c);
    return { ...c, serieB: { ...serieB, phases: fn(serieB.phases) } };
  }
  return { ...c, phases: fn(c.phases) };
}

interface StoreCtx {
  championships: Championship[];
  hydrated: boolean;
  career: CareerLedger;
  /** Comprime todas as logos antigas (data URLs grandes) e retorna KB salvos. */
  optimizeStorage: () => Promise<number>;
  getChampionship: (id: string) => Championship | undefined;
  updateChampionship: (id: string, updater: (c: Championship) => Championship) => void;
  addChampionship: (c: Championship) => void;
  removeChampionship: (id: string) => void;
  setMatchResult: (
    championshipId: string,
    phaseId: string,
    matchId: string,
    winnerId: string | null,
    score?: { a: number; b: number },
  ) => void;
  batchSetMatchResults: (
    championshipId: string,
    phaseId: string,
    results: Array<{
      matchId: string;
      winnerId: string;
      score: { a: number; b: number };
    }>,
  ) => void;
  resetPhase: (championshipId: string, phaseId: string) => void;
  /** Zera TODOS os resultados do campeonato (fases, Série B e play-in). */
  resetChampionship: (championshipId: string) => void;
  advanceToPhase: (championshipId: string, targetPhaseId: string) => void;
  /** Preenche a primeira fase (vazia) de uma série com os times da própria série. */
  seedPhaseTeams: (championshipId: string, phaseId: string) => void;
  updateTeam: (championshipId: string, team: Team) => void;
  assignSlotTeam: (
    championshipId: string,
    phaseId: string,
    matchId: string,
    slot: "A" | "B",
    newTeamId: string,
  ) => void;
  /**
   * Re-sorteia os confrontos da Rodada 1 de uma fase suíça (mantém o mesmo
   * campo de times, descarta resultados da fase). Só age em fases suíças.
   */
  redrawSwiss: (championshipId: string, phaseId: string) => void;
  /** Adiciona times à série indicada (1 = A, 2 = B). */
  addTeamsToDivision: (championshipId: string, teams: Team[], division: Division) => void;
  /**
   * Monta a Série B de uma vez: adiciona os times enviados (sem duplicar quem
   * já existe na A ou na B) e, se a Série B ainda não tem fases, cria
   * "Fase de Grupos" + "Playoffs" prontas.
   */
  setupSerieB: (championshipId: string, teams: Team[]) => void;
  /**
   * Apaga TODA a Série B: times, fases, resultados e histórico próprios dela.
   * A Série A não é afetada em nada.
   */
  clearSerieB: (championshipId: string) => void;
  /** Gera o play-in de promoção/rebaixamento (2 últimos de A × 2 finalistas de B). */
  setupPromotion: (championshipId: string) => void;
  /** Registra resultado de um confronto do play-in de promoção. */
  setPromotionResult: (
    championshipId: string,
    matchId: string,
    winnerId: string | null,
    score?: { a: number; b: number },
  ) => void;
  /**
   * Cria o campeonato do próximo split com a promoção/rebaixamento aplicado
   * (vencedores do play-in na Série A, perdedores na B). Retorna o id novo.
   */
  createNextSplit: (championshipId: string) => string | null;
  /**
   * Avança a liga atual para o próximo split/temporada no mesmo campeonato,
   * preservando 100% das fases, formato, histórico e metadados.
   */
  advanceToNextSplit: (championshipId: string) => boolean;
  /**
   * Avança campeonato internacional (Worlds, MSI, etc.) para nova edição:
   * arquiva campeão, remove times antigos, puxa os novos classificados das ligas locais
   * e remonta o formato preservando todo o histórico acumulado.
   */
  /**
   * Arquiva o campeão da edição atual, avança a temporada e limpa os times/fases
   * para o usuário puxar os classificados manualmente via UI.
   * Retorna true se bem-sucedido.
   */
  advanceInternationalEdition: (championshipId: string) => boolean;
  exportChampionship: (id: string) => string;
  importChampionship: (json: string) => { ok: boolean; error?: string };
  saveChampionToHistory: (
    championshipId: string,
    entry: Omit<ChampionHistoryEntry, "id" | "savedAt">,
    division: Division,
  ) => void;
  resetCareer: (options?: {
    game?: "lol" | "cs2" | "all";
    clearChampionshipHistory?: boolean;
  }) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

/**
 * Migração de elenco: todo time carregado ganha `roster` estruturado — casa
 * com o banco real (lol.fandom.com) pelo nome; se não achar, monta a partir
 * da escalação textual legada. É isso que ativa o sistema de evolução nos
 * campeonatos salvos antes do recurso existir.
 */
function ensureTeamRosters(c: Championship): Championship {
  const fix = (t: Team): Team =>
    t.roster && t.roster.length > 0 && !isGenericRoster(t.roster, t.name, t.tag)
      ? t
      : { ...t, roster: ensureRoster(t) };
  return {
    ...c,
    teams: c.teams.map(fix),
    formerTeams: c.formerTeams?.map(fix),
    serieB: c.serieB ? { ...c.serieB, teams: c.serieB.teams.map(fix) } : c.serieB,
  };
}

/**
 * Serialização ENXUTA (só no caminho de save — o estado em memória nunca é
 * tocado): poda elencos idênticos ao que a derivação produziria. O load()
 * já regenera via ensureTeamRosters, então nada se perde e a cota do
 * navegador respira: ~1KB × time × campeonato.
 */
function storableChampionship(c: Championship): Championship {
  const out: Championship = { ...c, teams: c.teams.map(stripDerivedRoster) };
  if (c.formerTeams) out.formerTeams = c.formerTeams.map(stripDerivedRoster);
  if (c.serieB) out.serieB = { ...c.serieB, teams: c.serieB.teams.map(stripDerivedRoster) };
  return out;
}

const storableList = (list: Championship[]): Championship[] => list.map(storableChampionship);

/** Mensagem padrão do erro de cota, com medição real do uso. */
function quotaMessage(detail: string): string {
  const usage = getStorageUsage();
  return (
    `Não foi possível salvar os dados do navegador (armazenamento cheio: ` +
    `${usage.usedKB} de ~${usage.limitKB} KB). A última alteração NÃO foi salva — ` +
    `tente "Otimizar armazenamento" ou exporte um backup e remova campeonatos/` +
    `logos antigos. Detalhe: ${detail}`
  );
}

/** Aplica uma transformação de elenco nos times vivos (Série A + Série B). */
function mapLiveRosters(
  c: Championship,
  fn: (roster: Team["roster"]) => Team["roster"],
): Championship {
  return {
    ...c,
    teams: c.teams.map((t) => ({ ...t, roster: fn(t.roster) })),
    serieB: c.serieB
      ? { ...c.serieB, teams: c.serieB.teams.map((t) => ({ ...t, roster: fn(t.roster) })) }
      : c.serieB,
  };
}

/**
 * Reverte os efeitos de TODAS as partidas de uma fase: a evolução dos
 * jogadores (deltas de clutch no elenco) e a forma/momentum gerada por elas.
 *
 * Usado pelo reset de UMA fase e pelo reset do campeonato inteiro — os dois
 * precisam devolver o estado ao que era ANTES das partidas. Sem isso a
 * evolução ficava órfã no elenco (+1 de clutch que nunca maisvoltava) e o
 * momentum acumulava em cima de um resultado que já não existia.
 */
function revertPhaseEffects(
  c: Championship,
  phase: Phase,
  momentum: Record<string, MomentumState>,
  log: MomentumEvent[],
): {
  championship: Championship;
  momentum: Record<string, MomentumState>;
  log: MomentumEvent[];
} {
  const updated = c;
  let currentMomentum = momentum;
  let currentLog = log;
  for (const m of phase.matches) {
    if (!m.formEffect) continue;
    // NUNCA reverte playerDeltas: toda evolução conquistada pelos jogadores é permanente!
    const reverted = revertMatchEffects({
      momentum: currentMomentum,
      log: currentLog,
      formEffect: m.formEffect,
      match: { ...m, winnerId: null },
    });
    currentMomentum = reverted.momentum;
    currentLog = reverted.log;
  }
  return { championship: updated, momentum: currentMomentum, log: currentLog };
}

/**
 * Propaga a evolução de elencos, sinergia e cultura dos times de `source`
 * para todos os outros campeonatos do mesmo jogo (assim o que o time evolui
 * no MSI/Worlds fica salvo na liga local e vice-versa!).
 */
function isWorldCupChamp(c: Championship): boolean {
  return /copa do mundo|world cup|seleções|selecoes/i.test(c.name ?? "");
}

function clampAttr0100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function applyWorldCupFinalClubBonus(
  list: Championship[],
  worldCupChamp: Championship,
  championNation: Team,
  runnerUpNation?: Team,
): Championship[] {
  const champStarterKeys = new Set(
    (championNation.roster ?? [])
      .filter((p) => !p.sub)
      .map((p) => `${normKey(p.ign)}|${p.role}`),
  );
  const runnerStarterKeys = new Set(
    (runnerUpNation?.roster ?? [])
      .filter((p) => !p.sub)
      .map((p) => `${normKey(p.ign)}|${p.role}`),
  );

  const boostPlayer = (p: Player): Player => {
    const key = `${normKey(p.ign)}|${p.role}`;
    if (champStarterKeys.has(key)) {
      return {
        ...p,
        attrs: {
          ...p.attrs,
          mechanics: clampAttr0100(p.attrs.mechanics + 1),
          clutch: clampAttr0100(p.attrs.clutch + 2),
          mentality: clampAttr0100((p.attrs.mentality ?? 65) + 1),
          intlExperience: clampAttr0100((p.attrs.intlExperience ?? 50) + 2),
        },
      };
    }
    if (runnerStarterKeys.has(key)) {
      return {
        ...p,
        attrs: {
          ...p.attrs,
          clutch: clampAttr0100(p.attrs.clutch + 1),
          intlExperience: clampAttr0100((p.attrs.intlExperience ?? 50) + 1),
        },
      };
    }
    return p;
  };

  const patchClub = (t: Team): Team => {
    const roster = t.roster ?? [];
    let champCount = 0;
    let runnerCount = 0;
    const nextRoster = roster.map((p) => {
      const key = `${normKey(p.ign)}|${p.role}`;
      if (champStarterKeys.has(key)) champCount += 1;
      else if (runnerStarterKeys.has(key)) runnerCount += 1;
      return boostPlayer(p);
    });
    if (champCount === 0 && runnerCount === 0) return t;
    const currentBudget = t.budget ?? 1000;
    const budgetBonus = champCount * 250 + runnerCount * 120;
    const cultureBonus = champCount * 4 + runnerCount * 2;
    return {
      ...t,
      roster: nextRoster,
      budget: currentBudget + budgetBonus,
      culture: clampAttr0100((t.culture ?? 50) + cultureBonus),
    };
  };

  return list.map((c) => {
    if (c.id === worldCupChamp.id || (c.game ?? "lol") !== (worldCupChamp.game ?? "lol")) return c;
    if (isWorldCupChamp(c)) return c;
    return {
      ...c,
      teams: c.teams.map(patchClub),
      serieB: c.serieB ? { ...c.serieB, teams: c.serieB.teams.map(patchClub) } : undefined,
    };
  });
}

function syncTeamRostersAcrossChampionships(
  list: Championship[],
  source: Championship,
): Championship[] {
  const game = source.game ?? "lol";

  // Na Copa do Mundo, os jogadores defendem seleções nacionais: sincroniza a evolução
  // dos atributos (mechanics, clutch, intlExperience, etc.) de volta para seus clubes!
  if (isWorldCupChamp(source)) {
    const playerByKey = new Map<string, Player>();
    for (const t of source.teams) {
      for (const p of t.roster ?? []) {
        playerByKey.set(`${normKey(p.ign)}|${p.role}`, p);
      }
    }
    if (playerByKey.size === 0) return list;

    const patchClubRoster = (t: Team): Team => {
      if (!t.roster || t.roster.length === 0) return t;
      let changed = false;
      const nextRoster = t.roster.map((p) => {
        const ref = playerByKey.get(`${normKey(p.ign)}|${p.role}`);
        if (!ref) return p;
        changed = true;
        return { ...p, attrs: ref.attrs };
      });
      return changed ? { ...t, roster: nextRoster } : t;
    };

    return list.map((c) => {
      if (c.id === source.id || (c.game ?? "lol") !== game || isWorldCupChamp(c)) return c;
      return {
        ...c,
        teams: c.teams.map(patchClubRoster),
        serieB: c.serieB ? { ...c.serieB, teams: c.serieB.teams.map(patchClubRoster) } : undefined,
      };
    });
  }

  const byName = new Map<string, Team>();
  for (const t of [...source.teams, ...(source.serieB?.teams ?? [])]) {
    if (t.name && t.roster && t.roster.length > 0) {
      byName.set(normKey(t.name), t);
    }
  }
  if (byName.size === 0) return list;

  const patchTeam = (t: Team): Team => {
    const ref = t.name ? byName.get(normKey(t.name)) : undefined;
    if (!ref || !ref.roster) return t;
    return {
      ...t,
      roster: ref.roster,
      synergy: ref.synergy ?? t.synergy,
      culture: ref.culture ?? t.culture,
    };
  };

  return list.map((c) => {
    if (c.id === source.id || (c.game ?? "lol") !== game) return c;
    const touchesA = c.teams.some((t) => t.name && byName.has(normKey(t.name)));
    const touchesB = c.serieB?.teams.some((t) => t.name && byName.has(normKey(t.name))) ?? false;
    if (!touchesA && !touchesB) return c;
    return {
      ...c,
      teams: touchesA ? c.teams.map(patchTeam) : c.teams,
      serieB:
        touchesB && c.serieB
          ? { ...c.serieB, teams: c.serieB.teams.map(patchTeam) }
          : c.serieB,
    };
  });
}

function patchTeamLogo(t: Team): Team {
  if (t.logo) return t;
  const official = getOfficialLogo(t.name, t.tag);
  return official ? { ...t, logo: official } : t;
}

function patchChampionshipLogo(c: Championship): Championship {
  if (c.logo) return c;
  const detected = detectLeaguePreset(c.name);
  return detected ? { ...c, logo: detected.logo } : c;
}

function ensureTeamLogos(c: Championship): Championship {
  const withChampLogo = patchChampionshipLogo(c);
  return {
    ...withChampLogo,
    teams: withChampLogo.teams.map(patchTeamLogo),
    formerTeams: withChampLogo.formerTeams?.map(patchTeamLogo),
    serieB: withChampLogo.serieB
      ? { ...withChampLogo.serieB, teams: withChampLogo.serieB.teams.map(patchTeamLogo) }
      : withChampLogo.serieB,
  };
}

/**
 * Higieniza saves antigos que tinham jogadores fictícios clonados entre várias ligas
 * (ex.: "Aegis" Support KR 86 OVR aparecendo em SK Gaming, LCS, LCK, etc., ou Zephyr/Predator).
 * Restaura o titular real da equipe para aquela rota e corrige os MVPs de partidas passadas.
 */
function sanitizeLegacyClonedRosters(list: Championship[]): Championship[] {
  const globalSeenInDomestic = new Set<string>();

  return list.map((c) => {
    if ((c.game ?? "lol") !== "lol") return c;
    const isIntl = isInternationalChamp(c);
    const replacedByTeamAndOldIgn = new Map<string, string>();
    const replacedByTeamAndRole = new Map<string, string>();

    const cleanTeam = (t: Team): Team => {
      if (!t.roster || t.roster.length === 0) return t;
      const authenticRoster = ensureRoster({ ...t, roster: undefined, players: undefined }) ?? [];
      let changed = false;
      const usedInTeam = new Set(
        t.roster
          .filter((p) => !isLegacyClonedPlayer(p, t.name))
          .map((p) => p.ign.trim().toLowerCase()),
      );

      const nextRoster = t.roster.map((p) => {
        const key = p.ign.trim().toLowerCase();
        const isClonedFictional = isLegacyClonedPlayer(p, t.name);
        const isDuplicateAcrossLeagues = !isIntl && !p.sub && globalSeenInDomestic.has(key);

        if (!isClonedFictional && !isDuplicateAcrossLeagues) {
          if (!isIntl && !p.sub) globalSeenInDomestic.add(key);
          usedInTeam.add(key);
          return p;
        }

        changed = true;
        // 1. Tenta restaurar o titular real do time naquela rota (do banco real-rosters.ts)
        const authenticCandidate = authenticRoster.find(
          (ap) =>
            ap.role === p.role &&
            !usedInTeam.has(ap.ign.trim().toLowerCase()) &&
            (isIntl || !globalSeenInDomestic.has(ap.ign.trim().toLowerCase())) &&
            !isLegacyClonedPlayer(ap, t.name),
        );

        let replacement = authenticCandidate;
        if (!replacement) {
          // 2. Fallback: escolhe um pro player real único do pool global
          const fa = GLOBAL_FREE_AGENT_POOL.find(
            (cand) =>
              cand.role === p.role &&
              !usedInTeam.has(cand.ign.trim().toLowerCase()) &&
              !globalSeenInDomestic.has(cand.ign.trim().toLowerCase()),
          );
          if (fa) {
            replacement = {
              ...p,
              id: uid(),
              ign: fa.ign,
              country: fa.country,
              attrs: { ...fa.attrs },
              pot: fa.pot,
              age: fa.age,
            };
          }
        }

        if (!replacement) return p;

        const newKey = replacement.ign.trim().toLowerCase();
        usedInTeam.add(newKey);
        if (!isIntl && !p.sub) globalSeenInDomestic.add(newKey);
        replacedByTeamAndOldIgn.set(`${t.id}:${key}`, replacement.ign);
        replacedByTeamAndRole.set(`${t.id}:${p.role}`, replacement.ign);
        return {
          ...replacement,
          sub: p.sub,
        };
      });

      return changed ? { ...t, roster: nextRoster } : t;
    };

    const nextTeams = c.teams.map(cleanTeam);
    const nextSerieBTeams = c.serieB?.teams.map(cleanTeam);

    const fixPhases = (phases: Phase[]): Phase[] =>
      phases.map((ph) => ({
        ...ph,
        matches: ph.matches.map((m) => {
          if (!m.mvp) return m;
          const mvpIgnKey = m.mvp.playerName.trim().toLowerCase();
          const directReplacement = replacedByTeamAndOldIgn.get(`${m.mvp.teamId}:${mvpIgnKey}`);
          const isFakeMvp =
            LEGACY_FICTIONAL_FREE_AGENTS.has(mvpIgnKey) ||
            (mvpIgnKey === "aegis" && m.mvp.role === "support");
          const roleReplacement = isFakeMvp
            ? replacedByTeamAndRole.get(`${m.mvp.teamId}:${m.mvp.role}`)
            : undefined;
          const finalName = directReplacement ?? roleReplacement;
          if (!finalName) return m;
          return {
            ...m,
            mvp: {
              ...m.mvp,
              playerName: finalName,
            },
          };
        }),
      }));

    const nextTransferHistory = c.transferHistory?.filter((item) => {
      const k = item.playerName.trim().toLowerCase();
      if (LEGACY_FICTIONAL_FREE_AGENTS.has(k)) return false;
      if (k === "aegis" && item.role === "support") return false;
      return true;
    });

    return {
      ...c,
      teams: nextTeams,
      phases: fixPhases(c.phases),
      transferHistory: nextTransferHistory,
      serieB: c.serieB
        ? {
            ...c.serieB,
            teams: nextSerieBTeams ?? c.serieB.teams,
            phases: fixPhases(c.serieB.phases),
          }
        : c.serieB,
    };
  });
}

function normalizeHistorySplitKey(label: string): string {
  return label
    .replace(/\s*\(Série B\)\s*$/i, "")
    .replace(/[·\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function deduplicateHistoryList(
  entries: Championship["history"],
): Championship["history"] {
  if (!entries || entries.length <= 1) return entries;
  const seen = new Set<string>();
  const out: NonNullable<Championship["history"]> = [];
  for (const e of entries) {
    const splitKey = normalizeHistorySplitKey(e.splitLabel || "");
    const teamKey = e.teamName.trim().toLowerCase();
    const composite = `${teamKey}:::${splitKey}`;
    // Evita duplicar exatamente o mesmo time no mesmo split
    if (seen.has(composite)) {
      continue;
    }
    seen.add(composite);
    out.push(e);
  }
  return out;
}

function load(): Championship[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Championship[];
    // Legacy migration: pre-CS2 championships default to LoL; old division
    // tags are split into the standalone `serieB` block.
    const migrated = parsed.map((c) => {
      const base = ensureTeamLogos(ensureTeamRosters(migrateChampionship({ ...c, game: c.game ?? "lol" })));
      return {
        ...base,
        history: deduplicateHistoryList(base.history),
        serieB: base.serieB
          ? { ...base.serieB, history: deduplicateHistoryList(base.serieB.history) }
          : base.serieB,
      };
    });
    return sanitizeLegacyClonedRosters(migrated);
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  // Ranking de carreira: créditos PERMANENTES (nunca recalculados).
  const [career, setCareer] = useState<CareerLedger>(() => loadCareer());
  const championshipsRef = useRef<Championship[]>([]);
  const careerRef = useRef<CareerLedger>(career);
  /** Recuperação automática de cota: só tenta comprimir 1x por episódio. */
  const storageRecoveryRef = useRef(false);
  const careerRecoveryRef = useRef(false);
  useEffect(() => {
    championshipsRef.current = championships;
  }, [championships]);
  useEffect(() => {
    careerRef.current = career;
  }, [career]);

  useEffect(() => {
    const initial = load();
    let next = initial;
    try {
      if (!window.localStorage.getItem(CS2_SEED_FLAG)) {
        const hasCs2 = initial.some((c) => c.game === "cs2");
        if (!hasCs2) {
          next = [...initial, ...buildCs2SeedChampionships()];
        }
        window.localStorage.setItem(CS2_SEED_FLAG, "1");
      }
    } catch {
      /* ignore */
    }
    // Primeira execução: migra os campeonatos atuais para a carreira
    // (idempotente pelas chaves de crédito — roda 1x só).
    try {
      if (!window.localStorage.getItem(CAREER_SEED_FLAG)) {
        setCareer(seedCareer(next));
        window.localStorage.setItem(CAREER_SEED_FLAG, "1");
      } else {
        setCareer((prev) => backfillIntlHistory(prev, next));
      }
    } catch {
      /* ignore */
    }
    championshipsRef.current = next;
    setChampionships(next);
    setHydrated(true);
  }, []);

  const pendingSaveRef = useRef<Championship[] | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storableList(pendingSaveRef.current)));
        } catch {
          /* ignore */
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    pendingSaveRef.current = championships;
    const timer = setTimeout(() => {
      try {
        // Serialização enxuta: poda elencos regeneráveis antes de escrever.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storableList(championships)));
        pendingSaveRef.current = null;
        // Limpa só o erro DESTE escopo; preserva o da carreira (outro efeito).
        setStorageError((prev) => (prev?.startsWith("Ranking") ? prev : null));
        storageRecoveryRef.current = false;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const msg = quotaMessage(detail);
        if (storageRecoveryRef.current) {
          setStorageError(msg);
          return;
        }
        storageRecoveryRef.current = true;
        const snapshot = championships;
        void deepCompressLogos(snapshot).then(({ value, saved }) => {
          if (saved > 0 && championshipsRef.current === snapshot) {
            setChampionships(value);
          } else {
            setStorageError(msg);
          }
        });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [championships, hydrated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CAREER_KEY, JSON.stringify(pruneSeen(career)));
      careerRecoveryRef.current = false;
      setStorageError((prev) => (prev?.startsWith("Ranking") ? null : prev));
    } catch (err) {
      // Ranking PERMANENTE — perda silenciosa seria pior que qualquer banner.
      const detail = err instanceof Error ? err.message : String(err);
      const usage = getStorageUsage();
      const msg =
        `Ranking de carreira não coube no armazenamento (${usage.usedKB} de ` +
        `~${usage.limitKB} KB). Detalhe: ${detail}`;
      if (careerRecoveryRef.current) {
        setStorageError(msg);
        return;
      }
      careerRecoveryRef.current = true;
      const snapshot = career;
      void deepCompressLogos(snapshot).then(({ value, saved }) => {
        if (saved > 0 && careerRef.current === snapshot) {
          setCareer(value);
        } else {
          setStorageError(msg);
        }
      });
    }
  }, [career]);

  const updateChampionship = useCallback(
    (id: string, updater: (c: Championship) => Championship) =>
      setChampionships((prev) =>
        prev.map((c) => (c.id === id ? { ...updater(c), updatedAt: Date.now() } : c)),
      ),
    [],
  );

  const addChampionship = useCallback((c: Championship) => {
    // Campeonato novo nasce com elenco: times vindos do banco ganham o
    // roster real de 2026 na hora.
    setChampionships((prev) => [
      ...prev,
      { ...ensureTeamLogos(ensureTeamRosters(c)), updatedAt: Date.now() },
    ]);
  }, []);

  const removeChampionship = useCallback((id: string) => {
    setChampionships((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setMatchResult: StoreCtx["setMatchResult"] = useCallback(
    (championshipId, phaseId, matchId, winnerId, score) => {
      // ---------- RANKING DE CARREIRA (permanente) ----------
      // Credita os pontos assim que o resultado é registrado. Resetar/remover
      // depois NÃO retira o que já foi ganho.
      const champ = championshipsRef.current.find((x) => x.id === championshipId);
      if (champ && winnerId) {
        const division = phaseDivision(champ, phaseId);
        if (division === 1) {
          const phase = champ.phases.find((p) => p.id === phaseId);
          const target = phase?.matches.find((m) => m.id === matchId);
          // O PLAY-IN INTERNACIONAL (Worlds/MSI) NÃO vale nada no Hall da
          // Fama: nem pontos, nem ELO, nem histórico. Ele existe só para
          // classificar para o evento principal.
          const isIntlPlayIn = !!phase?.internationalPlayIn;
          if (phase && target && target.teamAId && target.teamBId && !target.bye && !isIntlPlayIn) {
            const isPlayoff = phase.kind === "bracket";
            setCareer((prev) => creditMatch(prev, champ, target, winnerId, isPlayoff));
            // Se for a partida decisiva da Série A: título + vice na carreira.
            const lastBracket = [...champ.phases].reverse().find((p) => p.kind === "bracket");
            if (lastBracket && lastBracket.id === phaseId) {
              const decisive = [...lastBracket.matches].sort(
                (a, b) =>
                  decisivePriority(b) - decisivePriority(a) || (b.round ?? 0) - (a.round ?? 0),
              )[0];
              if (decisive?.id === matchId) {
                const pool = [...champ.teams, ...(champ.formerTeams ?? [])];
                const champion = pool.find((t) => t.id === winnerId);
                const loserId = winnerId === target.teamAId ? target.teamBId : target.teamAId;
                const runnerUp = pool.find((t) => t.id === loserId);
                const label = (champ.season ?? "Atual").trim() || "Atual";
                setCareer((prev) => {
                  let next = prev;
                  if (champion) next = creditBonus(next, champ, "title", label, champion);
                  if (runnerUp) next = creditBonus(next, champ, "runnerup", label, runnerUp);
                  return next;
                });
              }
            }
          }
        }
      }

      setChampionships((prev) => {
        const nextList = prev.map((c) => {
          if (c.id !== championshipId) return c;
          const division = phaseDivision(c, phaseId);

          // Resultado anterior (para reverter momentum ao trocar/limpar).
          const oldMatch = divisionPhases(c, division)
            .flatMap((p) => p.matches)
            .find((m) => m.id === matchId);
          const prevEffect = oldMatch?.formEffect;
          const hadResult = !!oldMatch?.winnerId;

          // Aproveitamento PRÉ-partida (o estado antigo ainda não tem o resultado).
          const records = seasonRecords(divisionPhases(c, division));
          const allTeams = [...c.teams, ...(c.serieB?.teams ?? [])];
          const nameOf = (id: string) => allTeams.find((t) => t.id === id)?.name ?? "time";

          let updated = mapDivisionPhases(c, division, (phases) =>
            phases.map((p) => {
              if (p.id !== phaseId) return p;
              let matches = p.matches.map((m) => {
                if (m.id !== matchId) return m;
                let mvp = m.mvp;
                if (winnerId) {
                  const winnerTeam = allTeams.find((t) => t.id === winnerId);
                  if (winnerTeam) {
                    mvp = electMatchMvp({
                      winnerTeam,
                      scoreA: score?.a,
                      scoreB: score?.b,
                      isWinnerA: winnerId === m.teamAId,
                      game: c.game ?? "lol",
                      isPlayoff: p.kind === "bracket",
                    });
                  }
                } else {
                  mvp = undefined;
                }
                return { ...m, winnerId, scoreA: score?.a, scoreB: score?.b, mvp };
              });
              const src = matches.find((m) => m.id === matchId);
              if (src && (src.nextMatchId || src.loserNextMatchId)) {
                matches = propagateBracketWinner(matches, matchId);
              }
              if (p.kind === "bracket" && matches.some((m) => m.bye)) {
                matches = resolveByes(matches);
              }
              if (p.kind === "swiss" && src) {
                matches = syncSwiss(matches, p.config as SwissConfig, src.round ?? 0);
              }
              return { ...p, matches };
            }),
          );

          // Psicologia DETERMINÍSTICA do time (substitui os Math.random da
          // antiga simulação): clutch médio dos titulares + cultura decide se
          // o gigante derrubado acorda ou tilta e que tipo de crise vem.
          // Definidos DEPOIS de `updated` porque leem os elencos já
          // revertidos — antes isso vivia em TDZ e quebrava se a ordem
          // mudasse.
          const liveTeams = [...updated.teams, ...(updated.serieB?.teams ?? [])];
          const teamOf = (id: string) => liveTeams.find((t) => t.id === id);
          const psychOf = (id: string): { clutch: number; culture: number } => {
            const team = teamOf(id);
            if (!team) return { clutch: 60, culture: 50 };
            const starters = pickStarters(ensureRoster(team) ?? []);
            const clutch = starters.length
              ? starters.reduce((s, p) => s + p.attrs.clutch, 0) / starters.length
              : 60;
            return { clutch, culture: team.culture ?? 50 };
          };
          // FORÇA REAL do time: mesma métrica da `winProbability` (ELO da
          // carreira + elenco + sinergia + cultura). É ela que define quem é
          // o favorito na narrativa de upset.
          const careerGame = (c.game ?? "lol") as "lol" | "cs2";
          const strengthOf = (id: string): number => {
            const team = teamOf(id);
            if (!team) return 50;
            const ledgerRating = team.name
              ? (careerRef.current[careerGame]?.[team.name.trim().toLowerCase()]?.rating ?? 50)
              : 50;
            return effectiveRating(ledgerRating, ensureRoster(team), team.synergy, team.culture);
          };

          // ---------- MOMENTUM ----------
          if (hadResult && prevEffect) {
            // Placar trocado ou limpo: desfaz apenas o efeito temporário de momentum (NUNCA a evolução dos jogadores).
            const reverted = revertMatchEffects({
              momentum: updated.momentum ?? {},
              log: updated.momentumLog ?? [],
              formEffect: prevEffect,
              match: { ...oldMatch!, winnerId: null },
            });
            updated = { ...updated, momentum: reverted.momentum, momentumLog: reverted.log };
          }
          const newMatch = divisionPhases(updated, division)
            .flatMap((p) => p.matches)
            .find((m) => m.id === matchId);
          if (winnerId && newMatch?.teamAId && newMatch.teamBId && !newMatch.bye) {
            const recordsPre = hadResult
              ? seasonRecords(
                  divisionPhases(updated, division).map((p) => ({
                    ...p,
                    matches: p.matches.filter((m) => m.id !== matchId),
                  })),
                )
              : records;
            const effect = applyMatchEffects({
              momentum: updated.momentum ?? {},
              log: updated.momentumLog ?? [],
              records: recordsPre,
              match: newMatch,
              division,
              teamName: nameOf,
              psychology: psychOf,
              strength: strengthOf,
            });

            // ---------- EVOLUÇÃO DE JOGADORES (playoffs) ----------
            // Série de playoff mexe no elenco: vencedor fecha série (clutch+1,
            // jovem cresce mecânica), perdedor perde clutch. Fica no
            // formEffect — limpar o placar desfaz tudo.
            const loserTeamId = winnerId === newMatch.teamAId ? newMatch.teamBId : newMatch.teamAId;
            const livePool = [...updated.teams, ...(updated.serieB?.teams ?? [])];
            const winnerTeam = livePool.find((t) => t.id === winnerId);
            const loserTeam = livePool.find((t) => t.id === loserTeamId);
            const isPlayoff = divisionPhases(updated, division).some(
              (p) => p.id === phaseId && p.kind === "bracket",
            );
            const isIntl =
              updated.internationalLevel === "minor" ||
              updated.internationalLevel === "major" ||
              /world|msi|global master|supercopa|desafiante|rift|kickoff|first stand/i.test(
                updated.name ?? "",
              );
            const isFinal =
              newMatch.bracketSide === "grand" ||
              (newMatch.roundName && /grande final|final/i.test(newMatch.roundName));
            const playerDeltas = matchPlayerDeltas({
              winnerRoster: winnerTeam ? ensureRoster(winnerTeam) : undefined,
              loserRoster: loserTeam ? ensureRoster(loserTeam) : undefined,
              isPlayoff,
              isIntl,
              isFinal: !!isFinal,
            });
            if (Object.keys(playerDeltas).length > 0) {
              updated = mapLiveRosters(updated, (roster) =>
                applyPlayerDeltas(roster, playerDeltas),
              );
            }

            updated = mapDivisionPhases(updated, division, (phases) =>
              phases.map((p) => ({
                ...p,
                matches: p.matches.map((m) =>
                  m.id === matchId
                    ? {
                        ...m,
                        formEffect: {
                          ...effect.formEffect,
                          ...(Object.keys(playerDeltas).length > 0 ? { playerDeltas } : {}),
                        },
                      }
                    : m,
                ),
              })),
            );
            updated = {
              ...updated,
              momentum: effect.momentum,
              momentumLog: effect.log,
            };

            // ---------- JANELA DE TRANSFERÊNCIAS LIVRE DURANTE O SPLIT (APENAS LIGAS LOCAIS) ----------
            // Em ligas locais, os times avaliam desempenho e orçamento após os jogos e contratam,
            // trocam ou dispensam jogadores sozinhos, sem precisar clicar ou aprovar nada.
            // Em campeonatos internacionais, os elencos ficam 100% travados.
            if (!hadResult && !isInternationalChamp(updated)) {
              const marketTick = runMidSplitMarketTick({
                championship: updated,
                career: careerRef.current,
                loserTeamId,
                division,
                allChampionships: prev,
              });
              if (marketTick.news.length > 0) {
                updated = {
                  ...updated,
                  teams: marketTick.teams,
                  serieB:
                    marketTick.serieBTeams && updated.serieB
                      ? { ...updated.serieB, teams: marketTick.serieBTeams }
                      : updated.serieB,
                  transferHistory: [...marketTick.news, ...(updated.transferHistory ?? [])].slice(0, 40),
                };
              }
            }
          }
          return updated;
        });
        const targetChamp = nextList.find((x) => x.id === championshipId);
        let synced = targetChamp ? syncTeamRostersAcrossChampionships(nextList, targetChamp) : nextList;
        if (targetChamp && isWorldCupChamp(targetChamp) && winnerId) {
          const lastBracket = [...targetChamp.phases].reverse().find((p) => p.kind === "bracket");
          const decisive = lastBracket
            ? [...lastBracket.matches].sort(
                (a, b) => decisivePriority(b) - decisivePriority(a) || (b.round ?? 0) - (a.round ?? 0),
              )[0]
            : null;
          if (decisive?.id === matchId && decisive.teamAId && decisive.teamBId) {
            const championNation = targetChamp.teams.find((t) => t.id === winnerId);
            const runnerId = winnerId === decisive.teamAId ? decisive.teamBId : decisive.teamAId;
            const runnerNation = targetChamp.teams.find((t) => t.id === runnerId);
            if (championNation) {
              synced = applyWorldCupFinalClubBonus(synced, targetChamp, championNation, runnerNation);
            }
          }
        }
        return synced;
      });
    },
    [],
  );

  const batchSetMatchResults: StoreCtx["batchSetMatchResults"] = useCallback(
    (championshipId, phaseId, results) => {
      if (!results || results.length === 0) return;

      const champ = championshipsRef.current.find((x) => x.id === championshipId);
      if (champ) {
        const division = phaseDivision(champ, phaseId);
        if (division === 1) {
          const phase = champ.phases.find((p) => p.id === phaseId);
          const isIntlPlayIn = !!phase?.internationalPlayIn;
          if (phase && !isIntlPlayIn) {
            const isPlayoff = phase.kind === "bracket";
            const lastBracket = [...champ.phases].reverse().find((p) => p.kind === "bracket");
            const decisive =
              lastBracket && lastBracket.id === phaseId
                ? [...lastBracket.matches].sort(
                    (a, b) =>
                      decisivePriority(b) - decisivePriority(a) || (b.round ?? 0) - (a.round ?? 0),
                  )[0]
                : null;

            setCareer((prev) => {
              let nextCareer = prev;
              for (const res of results) {
                const target = phase.matches.find((m) => m.id === res.matchId);
                if (target && target.teamAId && target.teamBId && !target.bye && res.winnerId) {
                  nextCareer = creditMatch(nextCareer, champ, target, res.winnerId, isPlayoff);
                  if (decisive?.id === res.matchId) {
                    const pool = [...champ.teams, ...(champ.formerTeams ?? [])];
                    const champion = pool.find((t) => t.id === res.winnerId);
                    const loserId = res.winnerId === target.teamAId ? target.teamBId : target.teamAId;
                    const runnerUp = pool.find((t) => t.id === loserId);
                    const label = (champ.season ?? "Atual").trim() || "Atual";
                    if (champion) nextCareer = creditBonus(nextCareer, champ, "title", label, champion);
                    if (runnerUp) nextCareer = creditBonus(nextCareer, champ, "runnerup", label, runnerUp);
                  }
                }
              }
              return nextCareer;
            });
          }
        }
      }

      setChampionships((prev) => {
        const nextList = prev.map((c) => {
          if (c.id !== championshipId) return c;
          const division = phaseDivision(c, phaseId);
          let updated = c;

          const isPlayoff = divisionPhases(updated, division).some(
            (p) => p.id === phaseId && p.kind === "bracket",
          );
          const isIntl =
            updated.internationalLevel === "minor" ||
            updated.internationalLevel === "major" ||
            /world|msi|global master|supercopa|desafiante|rift|kickoff|first stand/i.test(
              updated.name ?? "",
            );
          const careerGame = (updated.game ?? "lol") as "lol" | "cs2";

          for (const res of results) {
            const { matchId, winnerId, score } = res;
            const allTeams = [...updated.teams, ...(updated.serieB?.teams ?? [])];
            const nameOf = (id: string) => allTeams.find((t) => t.id === id)?.name ?? "time";
            const teamOf = (id: string) => allTeams.find((t) => t.id === id);
            const psychOf = (id: string): { clutch: number; culture: number } => {
              const team = teamOf(id);
              if (!team) return { clutch: 60, culture: 50 };
              const starters = pickStarters(ensureRoster(team) ?? []);
              const clutch = starters.length
                ? starters.reduce((s, p) => s + p.attrs.clutch, 0) / starters.length
                : 60;
              return { clutch, culture: team.culture ?? 50 };
            };
            const strengthOf = (id: string): number => {
              const team = teamOf(id);
              if (!team) return 50;
              const ledgerRating = team.name
                ? (careerRef.current[careerGame]?.[team.name.trim().toLowerCase()]?.rating ?? 50)
                : 50;
              return effectiveRating(ledgerRating, ensureRoster(team), team.synergy, team.culture);
            };

            const oldMatch = divisionPhases(updated, division)
              .flatMap((p) => p.matches)
              .find((m) => m.id === matchId);
            const prevEffect = oldMatch?.formEffect;
            const hadResult = !!oldMatch?.winnerId;

            if (hadResult && prevEffect) {
              const reverted = revertMatchEffects({
                momentum: updated.momentum ?? {},
                log: updated.momentumLog ?? [],
                formEffect: prevEffect,
                match: { ...oldMatch!, winnerId: null },
              });
              updated = { ...updated, momentum: reverted.momentum, momentumLog: reverted.log };
            }

            const records = seasonRecords(divisionPhases(updated, division));

            updated = mapDivisionPhases(updated, division, (phases) =>
              phases.map((p) => {
                if (p.id !== phaseId) return p;
                let matches = p.matches.map((m) => {
                  if (m.id !== matchId) return m;
                  let mvp = m.mvp;
                  if (winnerId) {
                    const winnerTeam = allTeams.find((t) => t.id === winnerId);
                    if (winnerTeam) {
                      mvp = electMatchMvp({
                        winnerTeam,
                        scoreA: score?.a,
                        scoreB: score?.b,
                        isWinnerA: winnerId === m.teamAId,
                        game: updated.game ?? "lol",
                        isPlayoff: p.kind === "bracket",
                      });
                    }
                  } else {
                    mvp = undefined;
                  }
                  return { ...m, winnerId, scoreA: score?.a, scoreB: score?.b, mvp };
                });
                const src = matches.find((m) => m.id === matchId);
                if (src && (src.nextMatchId || src.loserNextMatchId)) {
                  matches = propagateBracketWinner(matches, matchId);
                }
                if (p.kind === "bracket" && matches.some((m) => m.bye)) {
                  matches = resolveByes(matches);
                }
                if (p.kind === "swiss" && src) {
                  matches = syncSwiss(matches, p.config as SwissConfig, src.round ?? 0);
                }
                return { ...p, matches };
              }),
            );

            const newMatch = divisionPhases(updated, division)
              .flatMap((p) => p.matches)
              .find((m) => m.id === matchId);

            if (winnerId && newMatch?.teamAId && newMatch.teamBId && !newMatch.bye) {
              const effect = applyMatchEffects({
                momentum: updated.momentum ?? {},
                log: updated.momentumLog ?? [],
                records,
                match: newMatch,
                division,
                teamName: nameOf,
                psychology: psychOf,
                strength: strengthOf,
              });

              const loserTeamId = winnerId === newMatch.teamAId ? newMatch.teamBId : newMatch.teamAId;
              const livePool = [...updated.teams, ...(updated.serieB?.teams ?? [])];
              const winnerTeam = livePool.find((t) => t.id === winnerId);
              const loserTeam = livePool.find((t) => t.id === loserTeamId);
              const isFinal =
                newMatch.bracketSide === "grand" ||
                (newMatch.roundName && /grande final|final/i.test(newMatch.roundName));
              const playerDeltas = matchPlayerDeltas({
                winnerRoster: winnerTeam ? ensureRoster(winnerTeam) : undefined,
                loserRoster: loserTeam ? ensureRoster(loserTeam) : undefined,
                isPlayoff,
                isIntl,
                isFinal: !!isFinal,
              });
              if (Object.keys(playerDeltas).length > 0) {
                updated = mapLiveRosters(updated, (roster) =>
                  applyPlayerDeltas(roster, playerDeltas),
                );
              }

              updated = mapDivisionPhases(updated, division, (phases) =>
                phases.map((p) => ({
                  ...p,
                  matches: p.matches.map((m) =>
                    m.id === matchId
                      ? {
                          ...m,
                          formEffect: {
                            ...effect.formEffect,
                            ...(Object.keys(playerDeltas).length > 0 ? { playerDeltas } : {}),
                          },
                        }
                      : m,
                  ),
                })),
              );
              updated = {
                ...updated,
                momentum: effect.momentum,
                momentumLog: effect.log,
              };

              if (!hadResult && !isInternationalChamp(updated)) {
                const marketTick = runMidSplitMarketTick({
                  championship: updated,
                  career: careerRef.current,
                  loserTeamId,
                  division,
                  allChampionships: prev,
                });
                if (marketTick.news.length > 0) {
                  updated = {
                    ...updated,
                    teams: marketTick.teams,
                    serieB:
                      marketTick.serieBTeams && updated.serieB
                        ? { ...updated.serieB, teams: marketTick.serieBTeams }
                        : updated.serieB,
                    transferHistory: [...marketTick.news, ...(updated.transferHistory ?? [])].slice(0, 40),
                  };
                }
              }
            }
          }
          return updated;
        });

        const targetChamp = nextList.find((x) => x.id === championshipId);
        let synced = targetChamp ? syncTeamRostersAcrossChampionships(nextList, targetChamp) : nextList;
        if (targetChamp && isWorldCupChamp(targetChamp)) {
          const lastBracket = [...targetChamp.phases].reverse().find((p) => p.kind === "bracket");
          const decisive = lastBracket
            ? [...lastBracket.matches].sort(
                (a, b) => decisivePriority(b) - decisivePriority(a) || (b.round ?? 0) - (a.round ?? 0),
              )[0]
            : null;
          const finalRes = decisive ? results.find((r) => r.matchId === decisive.id) : undefined;
          if (decisive && finalRes?.winnerId && decisive.teamAId && decisive.teamBId) {
            const championNation = targetChamp.teams.find((t) => t.id === finalRes.winnerId);
            const runnerId =
              finalRes.winnerId === decisive.teamAId ? decisive.teamBId : decisive.teamAId;
            const runnerNation = targetChamp.teams.find((t) => t.id === runnerId);
            if (championNation) {
              synced = applyWorldCupFinalClubBonus(synced, targetChamp, championNation, runnerNation);
            }
          }
        }
        return synced;
      });
    },
    [],
  );

  const resetPhase = useCallback((championshipId: string, phaseId: string) => {
    const champ = championshipsRef.current.find((x) => x.id === championshipId);
    if (champ) {
      const targetPhase = [
        ...champ.phases,
        ...(champ.serieB?.phases ?? []),
      ].find((p) => p.id === phaseId);
      if (targetPhase) {
        const matchKeysToClear = new Set(targetPhase.matches.map((m) => `m:${championshipId}:${m.id}`));
        setCareer((prev) => {
          if (!prev.seen) return prev;
          const nextSeen: Record<string, true> = {};
          for (const [k, v] of Object.entries(prev.seen)) {
            if (!matchKeysToClear.has(k)) nextSeen[k] = v;
          }
          return { ...prev, seen: nextSeen };
        });
      }
    }

    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;
        const division = phaseDivision(c, phaseId);
        const target = divisionPhases(c, division).find((p) => p.id === phaseId);
        if (!target) return c;

        const reverted = revertPhaseEffects(c, target, c.momentum ?? {}, c.momentumLog ?? []);
        const updated = reverted.championship;
        const momentum = reverted.momentum;
        const log = reverted.log;

        const cleared = mapDivisionPhases(updated, division, (phases) =>
          phases.map((p) => {
            if (p.id !== phaseId) return p;
            const fedIds = new Set<string>();
            for (const m of p.matches) {
              if (m.nextMatchId) fedIds.add(m.nextMatchId);
              if (m.loserNextMatchId) fedIds.add(m.loserNextMatchId);
            }
            const matches = p.matches.map((m) => {
              const isSeeded = !fedIds.has(m.id);
              return {
                ...m,
                winnerId: null,
                scoreA: undefined,
                scoreB: undefined,
                formEffect: undefined,
                teamAId: isSeeded ? m.teamAId : null,
                teamBId: isSeeded ? m.teamBId : null,
              };
            });
            return { ...p, matches };
          }),
        );

        return { ...cleared, momentum, momentumLog: log };
      }),
    );
  }, []);

  /**
   * Zera SÓ O PLACAR de um campeonato: limpa os resultados de todas as fases
   * (Série A e Série B) para recomeçar a simulação. ELO dos times e evolução
   * dos jogadores NUNCA são perdidos, o campeão é arquivado se já concluído,
   * e as partidas voltam a valer ELO/pontos para a nova rodada!
   */
  const resetChampionship = useCallback((championshipId: string) => {
    setCareer((prev) => {
      if (!prev.seen) return prev;
      const prefix = `m:${championshipId}:`;
      const nextSeen: Record<string, true> = {};
      for (const [k, v] of Object.entries(prev.seen)) {
        if (!k.startsWith(prefix)) nextSeen[k] = v;
      }
      return { ...prev, seen: nextSeen };
    });

    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;

        // Arquiva o campeão antes de zerar os placares, caso a edição estivesse concluída!
        let updated = archiveCompletedChampions(c);
        let momentum = updated.momentum ?? {};
        let log = updated.momentumLog ?? [];
        const revertAll = (phases: Phase[]) => {
          for (const p of phases) {
            const r = revertPhaseEffects(updated, p, momentum, log);
            updated = r.championship;
            momentum = r.momentum;
            log = r.log;
          }
        };
        revertAll(updated.phases);
        if (updated.serieB) revertAll(updated.serieB.phases);

        const clearPhases = (phases: Phase[]): Phase[] =>
          phases.map((p) => {
            const fedIds = new Set<string>();
            for (const m of p.matches) {
              if (m.nextMatchId) fedIds.add(m.nextMatchId);
              if (m.loserNextMatchId) fedIds.add(m.loserNextMatchId);
            }
            return {
              ...p,
              matches: p.matches.map((m) => ({
                ...m,
                winnerId: null,
                scoreA: undefined,
                scoreB: undefined,
                formEffect: undefined,
                teamAId: fedIds.has(m.id) ? null : m.teamAId,
                teamBId: fedIds.has(m.id) ? null : m.teamBId,
              })),
            };
          });

        return {
          ...updated,
          phases: clearPhases(updated.phases),
          serieB: updated.serieB
            ? { ...updated.serieB, phases: clearPhases(updated.serieB.phases) }
            : updated.serieB,
          momentum,
          momentumLog: log,
        };
      }),
    );
  }, []);

  const advanceToPhase = useCallback((championshipId: string, targetPhaseId: string) => {
    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;
        const division = phaseDivision(c, targetPhaseId);
        const pool = divisionPhases(c, division);
        const idx = pool.findIndex((p) => p.id === targetPhaseId);
        if (idx <= 0) return c;
        // Classificados vêm SEMPRE da fase anterior da MESMA série —
        // as divisões nunca se misturam.
        const previous = pool[idx - 1];
        const target = pool[idx];
        // A decisão (puxar classificado / respeitar vaga reservada / não
        // apagar resultado) vive em `planPhaseAdvance` — puro e testado.
        const advance = planPhaseAdvance({
          previous,
          target,
          divisionTeamIds: new Set(divisionTeams(c, division).map((team) => team.id)),
        });
        if (!advance) return c;
        return mapDivisionPhases(c, division, (phases) =>
          phases.map((p) =>
            p.id === targetPhaseId
              ? advance.kind === "fill"
                ? {
                    ...p,
                    matches: advance.matches,
                    // O classificado entra na lista de semeados: a fase passa a
                    // "conhecer" ele (a UI deixa de pedir a semeadura de novo).
                    seededTeamIds: Array.from(
                      new Set([...(p.seededTeamIds ?? []), ...advance.qualified]),
                    ),
                  }
                : phaseWithTeams(p, advance.teamIds)
              : p,
          ),
        );
      }),
    );
  }, []);

  const seedPhaseTeams = useCallback(
    (championshipId: string, phaseId: string) => {
      setChampionships((prev) =>
        prev.map((c) => {
          if (c.id !== championshipId) return c;
          const division = phaseDivision(c, phaseId);
          const pool = divisionPhases(c, division);
          const idx = pool.findIndex((p) => p.id === phaseId);
          if (idx !== 0) return c; // só a primeira fase da série é semeada com os times
          const phase = pool[idx];
          const divisionPool = divisionTeams(c, division);
          const plan = planInternationalField({
            teams: divisionPool,
            phases: pool,
            game: c.game ?? "lol",
            career,
            fallbackRegion: c.region,
            championshipName: c.name,
          });

          if (plan.active) {
            // Formato do play-in internacional: GRUPO (Worlds/MSI de verdade)
            // ou confronto único de Classificação quando é só uma vaga.
            const structure = playInStructure(plan.playInSlots, plan.qualifiersToMain);
            // Semeia o play-in e já coloca os diretos na fase principal.
            // Isso também conserta campeonatos antigos que tinham todos no play-in.
            return mapDivisionPhases(c, division, (phases) =>
              phases.map((p, phaseIndex) => {
                if (phaseIndex === plan.playInPhaseIndex) {
                  // Play-in internacional (Worlds/MSI): NÃO vale pontos no
                  // Hall da Fama — só classifica para o evento principal.
                  if (plan.playInTeamIds.length === 0) {
                    // Nenhum inscrito: fase dispensada (conta como concluída).
                    return {
                      ...p,
                      groups: p.config.kind === "groups" ? [] : undefined,
                      matches: [],
                      seededTeamIds: [],
                      directTeamIds: undefined,
                      advanceCount: 0,
                      internationalPlayIn: true,
                      skipped: true,
                    };
                  }
                  const playInPhase: Phase = {
                    ...p,
                    kind: structure.kind === "groups" ? "groups" : "bracket",
                    config: structure.config,
                  };
                  const seeded = phaseWithTeams(playInPhase, plan.playInTeamIds);
                  return {
                    ...seeded,
                    matches: structure.deciderLabel
                      ? renameDecider(seeded.matches, structure.deciderLabel)
                      : seeded.matches,
                    advanceCount: plan.qualifiersToMain,
                    internationalPlayIn: true,
                    skipped: false,
                  };
                }
                if (phaseIndex === plan.mainPhaseIndex) {
                  // A fase principal começa JUNTO com o play-in: os diretos
                  // entram nas vagas fixas e as vagas do play-in ficam
                  // RESERVADAS (TBD) até o classificado aparecer.
                  const reserved = plan.qualifiersToMain;
                  return {
                    ...phaseWithTeams(p, plan.directTeamIds, undefined, reserved),
                    directTeamIds: plan.directTeamIds,
                    internationalPlayIn: false,
                    skipped: false,
                  };
                }
                return phaseIndex > plan.mainPhaseIndex ? clearPhaseParticipants(p) : p;
              }),
            );
          }

          const teamIds = divisionPool.map((t) => t.id);
          return mapDivisionPhases(c, division, (phases) =>
            phases.map((p, phaseIndex) => {
              if (p.id === phaseId) {
                return {
                  ...phaseWithTeams(p, teamIds),
                  advanceCount: undefined,
                  directTeamIds: undefined,
                };
              }
              return phaseIndex > 0 ? clearPhaseParticipants(p) : p;
            }),
          );
        }),
      );
    },
    [career],
  );

  /**
   * Re-sorteia a Rodada 1 de uma fase suíça: mantém o MESMO campo de times
   * (o que já estava dentro dos confrontos, ou os times da série se vazia),
   * gera confrontos novos embaralhados e descarta qualquer rodada/resulta
   * do anterior — serves para quando o sorteio inicial veio na ordem de cadastro.
   */
  const redrawSwiss: StoreCtx["redrawSwiss"] = useCallback((championshipId, phaseId) => {
    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;
        const division = phaseDivision(c, phaseId);
        const phase = divisionPhases(c, division).find((p) => p.id === phaseId);
        if (!phase || phase.config.kind !== "swiss") return c;
        const cfg = phase.config as SwissConfig;
        // Campo atual: quem já está nos confrontos da fase (ordem irrelevante,
        // generateSwissRound1 embaralha). Se a fase ainda está vazia, usa os
        // times da própria série — mesmo caminho do "Preencher".
        const field = Array.from(
          new Set(
            phase.matches.flatMap((m) => [m.teamAId, m.teamBId]).filter((x): x is string => !!x),
          ),
        );
        const teamIds = field.length >= 2 ? field : divisionTeams(c, division).map((t) => t.id);
        if (teamIds.length < 2) return c;
        return mapDivisionPhases(c, division, (phases) =>
          phases.map((p) =>
            p.id === phaseId
              ? { ...p, matches: generateSwissRound1(teamIds, cfg.defaultBestOf) }
              : p,
          ),
        );
      }),
    );
  }, []);

  const updateTeam = useCallback((championshipId: string, incoming: Team) => {
    // Time nomeado e ainda sem elenco ganha o banco real (casa pelo nome) —
    // digitar "T1" já traz o elenco real da T1. Elenco existente nunca é
    // sobrescrito (as edições do usuário mandam).
    const team: Team =
      !incoming.roster?.length && incoming.name.trim()
        ? { ...incoming, roster: ensureRoster(incoming) }
        : incoming;
    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;
        if (c.teams.some((t) => t.id === team.id)) {
          return { ...c, teams: c.teams.map((t) => (t.id === team.id ? team : t)) };
        }
        if (c.serieB?.teams.some((t) => t.id === team.id)) {
          return {
            ...c,
            serieB: {
              ...c.serieB,
              teams: c.serieB.teams.map((t) => (t.id === team.id ? team : t)),
            },
          };
        }
        return c;
      }),
    );
  }, []);

  const assignSlotTeam: StoreCtx["assignSlotTeam"] = useCallback(
    (championshipId, phaseId, matchId, slot, newTeamId) => {
      setChampionships((prev) =>
        prev.map((c) => {
          if (c.id !== championshipId) return c;
          const division = phaseDivision(c, phaseId);
          return mapDivisionPhases(c, division, (phases) =>
            phases.map((p) => {
              if (p.id !== phaseId) return p;
              const matches = p.matches.map((m) => ({ ...m }));
              const target = matches.find((m) => m.id === matchId);
              if (!target) return p;
              const oldTeamId = slot === "A" ? target.teamAId : target.teamBId;
              if (oldTeamId === newTeamId) return p;
              // find where the new team currently sits (same round if bracket)
              const donor = matches.find(
                (m) =>
                  m.id !== matchId &&
                  (p.kind !== "bracket" || (m.round ?? 0) === (target.round ?? 0)) &&
                  (m.teamAId === newTeamId || m.teamBId === newTeamId),
              );
              // also handle new team being in the other slot of the same match
              if (target.teamAId === newTeamId || target.teamBId === newTeamId) {
                if (target.teamAId === newTeamId) target.teamAId = oldTeamId ?? null;
                if (target.teamBId === newTeamId) target.teamBId = oldTeamId ?? null;
              } else if (donor) {
                if (donor.teamAId === newTeamId) donor.teamAId = oldTeamId ?? null;
                else if (donor.teamBId === newTeamId) donor.teamBId = oldTeamId ?? null;
                donor.winnerId = null;
                donor.scoreA = undefined;
                donor.scoreB = undefined;
              }
              if (slot === "A") target.teamAId = newTeamId;
              else target.teamBId = newTeamId;
              target.winnerId = null;
              target.scoreA = undefined;
              target.scoreB = undefined;
              return { ...p, matches };
            }),
          );
        }),
      );
    },
    [],
  );

  const addTeamsToDivision = useCallback(
    (championshipId: string, teams: Team[], division: Division) => {
      setChampionships((prev) =>
        prev.map((c) => {
          if (c.id !== championshipId) return c;
          if (division === 2) {
            const serieB = ensureSerieB(c);
            return { ...c, serieB: { ...serieB, teams: [...serieB.teams, ...teams] } };
          }
          return { ...c, teams: [...c.teams, ...teams] };
        }),
      );
    },
    [],
  );

  const setupSerieB: StoreCtx["setupSerieB"] = useCallback((championshipId, teams) => {
    if (teams.length === 0) return;
    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;
        const norm = (s: string) =>
          s
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        const existing = new Set([...c.teams, ...(c.serieB?.teams ?? [])].map((t) => norm(t.name)));
        const newTeams = teams.filter((t) => !existing.has(norm(t.name)));
        if (newTeams.length === 0) return c;

        const serieB = c.serieB ?? { teams: [], phases: [] };
        // Se a Série B ainda não tem fases, cria a estrutura padrão
        // (Grupos turno único Bo1 · top 4 → Playoffs 4 vagas).
        const phases: Phase[] =
          serieB.phases.length > 0
            ? serieB.phases
            : [
                {
                  id: uid(),
                  name: "Fase de Grupos",
                  kind: "groups",
                  config: {
                    kind: "groups",
                    groupCount: 1,
                    doubleRoundRobin: false,
                    bestOf: 1,
                    qualifiersPerGroup: 4,
                  } as GroupsConfig,
                  matches: [],
                },
                {
                  id: uid(),
                  name: "Playoffs",
                  kind: "bracket",
                  config: {
                    kind: "bracket",
                    slots: 4,
                    type: "single",
                    defaultBestOf: 3,
                    finalBestOf: 5,
                    bracketReset: false,
                    mode: "auto",
                  } as PlayoffsConfig,
                  matches: [],
                },
              ];

        return {
          ...c,
          hasSecondDivision: true,
          serieB: {
            ...serieB,
            teams: [...serieB.teams, ...newTeams],
            phases,
          },
        };
      }),
    );
  }, []);

  const clearSerieB: StoreCtx["clearSerieB"] = useCallback((championshipId) => {
    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId) return c;
        if (!c.serieB) return c;
        // Arquiva os times da Série B: a história deles (confrontos, ranking)
        // não desaparece por a liga ter sido apagada.
        const archived = [
          ...(c.formerTeams ?? []).filter((t) => !c.serieB!.teams.some((x) => x.id === t.id)),
          ...c.serieB.teams,
        ];
        return { ...c, formerTeams: archived, serieB: undefined };
      }),
    );
  }, []);

  const setupPromotion: StoreCtx["setupPromotion"] = useCallback((championshipId) => {
    setChampionships((prev) =>
      prev.map((c) => {
        if (c.id !== championshipId || c.promotion || !c.serieB) return c;
        const finalistsB = seriesFinalists(c.serieB.phases);
        const bottomA = seriesBottomTwo(c.phases, c.teams);
        if (!finalistsB || bottomA.length < 2) return c;
        return {
          ...c,
          promotion: { matches: buildPromotionBracket(bottomA, finalistsB) },
        };
      }),
    );
  }, []);

  const setPromotionResult: StoreCtx["setPromotionResult"] = useCallback(
    (championshipId, matchId, winnerId, score) => {
      setChampionships((prev) =>
        prev.map((c) => {
          if (c.id !== championshipId || !c.promotion) return c;
          const oldMatch = c.promotion.matches.find((m) => m.id === matchId);
          const hadResult = !!oldMatch?.winnerId;
          const prevEffect = oldMatch?.formEffect;

          let matches = c.promotion.matches.map((m) =>
            m.id === matchId ? { ...m, winnerId, scoreA: score?.a, scoreB: score?.b } : m,
          );
          // A chave é eliminação dupla: resultado avança/reprime como num bracket.
          const src = matches.find((m) => m.id === matchId);
          if (src && (src.nextMatchId || src.loserNextMatchId)) {
            matches = propagateBracketWinner(matches, matchId);
          }

          let momentum = c.momentum ?? {};
          let log = c.momentumLog ?? [];
          if (hadResult && prevEffect) {
            const reverted = revertMatchEffects({
              momentum,
              log,
              formEffect: prevEffect,
              match: { ...oldMatch!, winnerId: null },
            });
            momentum = reverted.momentum;
            log = reverted.log;
          }
          const newMatch = matches.find((m) => m.id === matchId);
          if (winnerId && newMatch?.teamAId && newMatch.teamBId && !newMatch.bye) {
            // Cada time carrega o aproveitamento da sua série de origem.
            const recA = seasonRecords(c.phases);
            const recB = seasonRecords(c.serieB?.phases ?? []);
            const records = new Map([...recA, ...recB]);
            const allTeams = [...c.teams, ...(c.serieB?.teams ?? [])];
            const teamOf = (id: string) => allTeams.find((t) => t.id === id);
            const careerGame = (c.game ?? "lol") as "lol" | "cs2";
            const effect = applyMatchEffects({
              momentum,
              log,
              records,
              match: newMatch,
              division: "play-in",
              teamName: (id) => teamOf(id)?.name ?? "time",
              psychology: (id) => {
                const team = teamOf(id);
                if (!team) return { clutch: 60, culture: 50 };
                const starters = pickStarters(ensureRoster(team) ?? []);
                const clutch = starters.length
                  ? starters.reduce((s, p) => s + p.attrs.clutch, 0) / starters.length
                  : 60;
                return { clutch, culture: team.culture ?? 50 };
              },
              strength: (id) => {
                const team = teamOf(id);
                if (!team) return 50;
                const ledgerRating = team.name
                  ? (careerRef.current[careerGame]?.[team.name.trim().toLowerCase()]?.rating ?? 50)
                  : 50;
                return effectiveRating(
                  ledgerRating,
                  ensureRoster(team),
                  team.synergy,
                  team.culture,
                );
              },
            });
            matches = matches.map((m) =>
              m.id === matchId ? { ...m, formEffect: effect.formEffect } : m,
            );
            momentum = effect.momentum;
            log = effect.log;
          }
          return {
            ...c,
            promotion: { ...c.promotion, matches },
            momentum,
            momentumLog: log,
          };
        }),
      );
    },
    [],
  );

  const advanceToNextSplit: StoreCtx["advanceToNextSplit"] = useCallback((championshipId) => {
    let ok = false;
    setCareer((prev) => {
      if (!prev.seen) return prev;
      const prefix = `m:${championshipId}:`;
      const nextSeen: Record<string, true> = {};
      for (const [k, v] of Object.entries(prev.seen)) {
        if (!k.startsWith(prefix)) nextSeen[k] = v;
      }
      return { ...prev, seen: nextSeen };
    });
    setChampionships((prev) => {
      const c = prev.find((x) => x.id === championshipId);
      if (!c) return prev;
      const archived = archiveCompletedChampions(c);
      const next = advanceChampionshipToNextSplit(archived, careerRef.current, prev);
      if (!next) return prev;
      ok = true;
      const nextList = prev.map((item) => (item.id === championshipId ? next : item));
      return syncTeamRostersAcrossChampionships(nextList, next);
    });
    return ok;
  }, []);

  const advanceInternationalEditionCallback: StoreCtx["advanceInternationalEdition"] = useCallback((championshipId) => {
    let ok = false;
    setChampionships((prev) => {
      const c = prev.find((x) => x.id === championshipId);
      if (!c) return prev;
      const next = advanceInternationalEdition(c);
      ok = true;
      return prev.map((item) => (item.id === championshipId ? next : item));
    });
    return ok;
  }, []);

  const createNextSplit: StoreCtx["createNextSplit"] = useCallback((championshipId) => {
    let newId: string | null = null;
    setChampionships((prev) => {
      const c = prev.find((x) => x.id === championshipId);
      if (!c) return prev;
      // O campeão ainda pode estar apenas nos resultados da edição atual.
      // Arquive-o antes de recriar as fases, para que resetar/zerar o split
      // nunca apague título ou pontos do ranking global.
      const archived = archiveCompletedChampions(c);
      const next = buildNextSplitChampionship(archived, careerRef.current, prev);
      if (!next) return prev;
      newId = next.id;
      return prev.map((item) => (item.id === championshipId ? archived : item)).concat(next);
    });
    return newId;
  }, []);

  /**
   * Comprime TODAS as logos antigas (data URLs > 20KB) de todos os
   * campeonatos. Retorna quantos KB foram economizados.
   */
  const optimizeStorage = useCallback(async (): Promise<number> => {
    let bytesSaved = 0;

    const compressTeam = async (team: Team): Promise<Team> => {
      if (team.logo && team.logo.startsWith("data:") && team.logo.length > 20000) {
        const original = team.logo.length;
        const compressed = await compressExistingLogo(team.logo);
        bytesSaved += original - compressed.length;
        return { ...team, logo: compressed };
      }
      return team;
    };

    const optimized: Championship[] = [];
    for (const c of championshipsRef.current) {
      const champ = { ...c };

      // Logo do campeonato
      if (champ.logo && champ.logo.startsWith("data:") && champ.logo.length > 20000) {
        const original = champ.logo.length;
        const compressed = await compressExistingLogo(champ.logo);
        champ.logo = compressed;
        bytesSaved += original - compressed.length;
      }

      // Times
      champ.teams = await Promise.all(champ.teams.map(compressTeam));

      // Times arquivados
      if (champ.formerTeams) {
        champ.formerTeams = await Promise.all(champ.formerTeams.map(compressTeam));
      }

      // Série B
      if (champ.serieB?.teams) {
        const serieBTeams = await Promise.all(champ.serieB.teams.map(compressTeam));
        champ.serieB = { ...champ.serieB, teams: serieBTeams };
      }

      // Histórico (logos nos campeões salvos)
      if (champ.history) {
        const history = [];
        for (const e of champ.history) {
          if (e.teamLogo && e.teamLogo.startsWith("data:") && e.teamLogo.length > 20000) {
            const original = e.teamLogo.length;
            const compressed = await compressExistingLogo(e.teamLogo);
            bytesSaved += original - compressed.length;
            history.push({ ...e, teamLogo: compressed });
          } else {
            history.push(e);
          }
        }
        champ.history = history;
      }

      optimized.push(champ);
    }

    setChampionships(optimized);
    return Math.round(bytesSaved / 1024);
  }, []);

  const saveChampionToHistory = useCallback(
    (
      championshipId: string,
      entry: Omit<ChampionHistoryEntry, "id" | "savedAt">,
      division: Division,
    ) => {
      const newEntry: ChampionHistoryEntry = {
        ...entry,
        id: Math.random().toString(36).slice(2, 10),
        savedAt: new Date().toISOString(),
      };
      const targetSplitKey = normalizeHistorySplitKey(entry.splitLabel || "");
      const targetTeamKey = entry.teamName.trim().toLowerCase();
      const upsertHistory = (list: ChampionHistoryEntry[] = []) => {
        const existsIdx = list.findIndex((h) => {
          const k = normalizeHistorySplitKey(h.splitLabel || "");
          return (
            k !== "" &&
            k === targetSplitKey &&
            h.teamName.trim().toLowerCase() === targetTeamKey
          );
        });
        if (existsIdx >= 0) {
          return list.map((h, i) => (i === existsIdx ? { ...h, ...newEntry, id: h.id } : h));
        }
        return [newEntry, ...list];
      };

      // Garante crédito na carreira caso a final ainda não tenha sido creditada para esta edição/temporada
      const targetChamp = championshipsRef.current.find((c) => c.id === championshipId);
      if (targetChamp && division === 1) {
        const autoLabel = (targetChamp.season ?? "Atual").trim() || "Atual";
        const autoKey = `title:${normKey(canonicalTournamentName(targetChamp.name))}|${normKey(autoLabel)}|${normKey(entry.teamName)}`;
        setCareer((prev) => {
          if (prev.seen?.[autoKey]) return prev;
          return creditBonus(prev, targetChamp, "title", entry.splitLabel || autoLabel, {
            name: entry.teamName,
            tag: entry.teamTag,
            logo: entry.teamLogo,
          });
        });
      }

      setChampionships((prev) =>
        prev.map((c) => {
          if (c.id !== championshipId) return c;
          if (division === 2) {
            const serieB = ensureSerieB(c);
            return {
              ...c,
              serieB: { ...serieB, history: upsertHistory(serieB.history) },
            };
          }
          return { ...c, history: upsertHistory(c.history) };
        }),
      );
    },
    [],
  );

  const resetCareer = useCallback(
    (options?: { game?: "lol" | "cs2" | "all"; clearChampionshipHistory?: boolean }) => {
      const targetGame = options?.game ?? "all";
      const clearHistory = options?.clearChampionshipHistory ?? false;

      setCareer((prev) => {
        let next: CareerLedger;
        if (targetGame === "all") {
          next = emptyLedger();
        } else {
          next = {
            ...prev,
            [targetGame]: {},
            titles: (prev.titles ?? []).filter((t) => t.game !== targetGame),
            international: {
              ...(prev.international ?? {}),
              [targetGame]: {},
            },
            intlHistory: {
              ...(prev.intlHistory ?? {}),
              [targetGame]: [],
            },
            seen: {},
          };
        }
        try {
          window.localStorage.setItem(CAREER_KEY, JSON.stringify(next));
          window.localStorage.setItem(CAREER_SEED_FLAG, "1");
        } catch {
          /* ignore */
        }
        return next;
      });

      if (clearHistory) {
        setChampionships((prev) =>
          prev.map((c) => {
            if (targetGame !== "all" && (c.game ?? "lol") !== targetGame) return c;
            return {
              ...c,
              history: [],
              serieB: c.serieB ? { ...c.serieB, history: [] } : c.serieB,
            };
          }),
        );
      }
    },
    [],
  );

  const value = useMemo<StoreCtx>(
    () => ({
      championships,
      hydrated,
      career,
      optimizeStorage,
      getChampionship: (id) => championships.find((c) => c.id === id),
      updateChampionship,
      addChampionship,
      removeChampionship,
      setMatchResult,
      batchSetMatchResults,
      resetPhase,
      resetChampionship,
      advanceToPhase,
      seedPhaseTeams,
      redrawSwiss,
      updateTeam,
      assignSlotTeam,
      addTeamsToDivision,
      setupSerieB,
      clearSerieB,
      setupPromotion,
      setPromotionResult,
      createNextSplit,
      advanceToNextSplit,
      advanceInternationalEdition: advanceInternationalEditionCallback,
      exportChampionship: (id) => {
        const c = championships.find((x) => x.id === id);
        // Exporta a versão ENXUTA (mesma que vai para o localStorage) para o
        // backup ter o mesmo tamanho do que está salvo.
        return c ? JSON.stringify(storableChampionship(c), null, 2) : "";
      },
      importChampionship: (json) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          return { ok: false, error: `JSON inválido: ${detail}` };
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { ok: false, error: "O conteúdo não tem o formato de um campeonato." };
        }
        const raw = parsed as Partial<Championship>;
        if (!raw.name || !Array.isArray(raw.teams) || !Array.isArray(raw.phases)) {
          return {
            ok: false,
            error: "Faltam campos obrigatórios no arquivo (name, teams, phases).",
          };
        }
        const c = migrateChampionship({
          ...(raw as Championship),
          id: uid(),
          game: raw.game ?? "lol",
        });
        setChampionships((prev) => [...prev, ensureTeamLogos(ensureTeamRosters(c))]);
        return { ok: true };
      },
      saveChampionToHistory,
      resetCareer,
    }),
    [
      championships,
      hydrated,
      career,
      optimizeStorage,
      updateChampionship,
      addChampionship,
      removeChampionship,
      setMatchResult,
      batchSetMatchResults,
      resetPhase,
      resetChampionship,
      advanceToPhase,
      seedPhaseTeams,
      redrawSwiss,
      updateTeam,
      assignSlotTeam,
      addTeamsToDivision,
      setupSerieB,
      clearSerieB,
      setupPromotion,
      setPromotionResult,
      createNextSplit,
      advanceToNextSplit,
      advanceInternationalEditionCallback,
      saveChampionToHistory,
      resetCareer,
    ],
  );

  // Medição real do uso — só calculada quando há erro (evita varrer o
  // localStorage a cada render).
  const usage = storageError ? getStorageUsage() : null;

  return (
    <Ctx.Provider value={value}>
      {storageError ? (
        <div className="sticky top-0 z-[999] border-b-2 border-blood bg-blood px-4 py-2 text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white">
            ⚠️ {storageError}
          </div>
          {usage ? (
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/80">
              armazenamento: {usage.usedKB} / ~{usage.limitKB} KB ({Math.round(usage.pct)}%)
            </div>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              const saved = await optimizeStorage();
              const after = getStorageUsage();
              setStorageError(null);
              alert(
                saved > 0
                  ? `Otimizado! Economizou ${saved} KB. Uso atual: ${after.usedKB} de ~${after.limitKB} KB.`
                  : `Nada para comprimir — os dados já estão leves (${after.usedKB} KB). Tente remover campeonatos antigos.`,
              );
            }}
            className="mt-1 border-2 border-white/60 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-white hover:text-blood"
          >
            🔧 Otimizar armazenamento (comprimir logos)
          </button>
        </div>
      ) : null}
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
