import type {
  CareerLedger,
  CareerTeam,
  GameId,
  GroupsConfig,
  Phase,
  PlayoffsConfig,
  Team,
} from "./types";

/**
 * Classificação automática de play-in internacional.
 *
 * Regra:
 * - Região com 2+ vagas no Hall da Fama para o torneio: todos os inscritos vão direto.
 * - Região com 1 vaga: todos os inscritos jogam o play-in.
 * - Até 4 times avançam do play-in; a fase principal se ajusta ao total real.
 *
 * A força regional usa a mesma distribuição dinâmica de vagas do Hall da Fama.
 * A quantidade de vagas não remove times inscritos do campeonato.
 */

export type InternationalDestination = "direct" | "play-in" | "out";

export type InternationalTournament = "worlds" | "msi";

export interface InternationalEntry {
  teamId: string;
  teamName: string;
  teamTag: string;
  region: string;
  seed: number;
  regionSlots: number;
  regionScore: number;
  strongRegion: boolean;
  eliteRegion: boolean;
  strength: number;
  destination: InternationalDestination;
}

export interface InternationalPlan {
  active: boolean;
  tournament: InternationalTournament;
  playInPhaseIndex: number;
  mainPhaseIndex: number;
  /** Times inscritos no play-in (os seeds extras das regiões). */
  playInSlots: number;
  /** Tamanho oficial do evento = soma das vagas do Hall da Fama por região. */
  mainTargetSlots: number;
  /** Times que realmente entram no evento principal (diretos + qualificados). */
  eventTeamCount: number;
  qualifiersToMain: number;
  totalQualified: number;
  directTeamIds: string[];
  playInTeamIds: string[];
  outTeamIds: string[];
  strongRegions: string[];
  weakRegions: string[];
  eliteRegions: string[];
  /**
   * Regiões que NUNCA disputam o play-in (as 2 melhores do ranking de
   * regiões do Hall da Fama): todos os times delas vão direto.
   */
  playInExemptRegions: string[];
  entries: InternationalEntry[];
  /** Nenhum inscrito no play-in: a fase é dispensada e todos vão direto. */
  playInEmpty: boolean;
  /** Vaga direta de cada time dentro da sua região (seed <= vagas). */
  directSlotsByRegion: Record<string, number>;
}

type PhaseShape = Pick<Phase, "name" | "kind" | "config">;

const DIRECT_ENTRY_MIN_REGION_SLOTS = 2;

const REGION_BASE_SCORE: Record<string, number> = {
  LCK: 96,
  LPL: 95,
  LEC: 88,
  LCS: 84,
  LCP: 78,
  CBLOL: 72,
  INT: 60,
  OUTROS: 55,
};

const REGION_ALIASES: Record<string, string> = {
  LCK: "LCK",
  KR: "LCK",
  KOR: "LCK",
  KOREA: "LCK",
  "SOUTH KOREA": "LCK",
  LPL: "LPL",
  CN: "LPL",
  CHN: "LPL",
  CHINA: "LPL",
  LEC: "LEC",
  EU: "LEC",
  EUROPE: "LEC",
  EUW: "LEC",
  EUNE: "LEC",
  LCS: "LCS",
  NA: "LCS",
  "NORTH AMERICA": "LCS",
  USA: "LCS",
  US: "LCS",
  CANADA: "LCS",
  LCP: "LCP",
  APAC: "LCP",
  "ASIA PACIFIC": "LCP",
  PCS: "LCP",
  TW: "LCP",
  TAIWAN: "LCP",
  VCS: "LCP",
  VN: "LCP",
  VIETNAM: "LCP",
  LJL: "LCP",
  JP: "LCP",
  JAPAN: "LCP",
  LCO: "LCP",
  OCE: "LCP",
  OCEANIA: "LCP",
  AU: "LCP",
  AUSTRALIA: "LCP",
  CBLOL: "CBLOL",
  BR: "CBLOL",
  BRAZIL: "CBLOL",
  BRASIL: "CBLOL",
  LLA: "CBLOL",
  LATAM: "CBLOL",
  LAN: "CBLOL",
  LAS: "CBLOL",
  "LATIN AMERICA": "CBLOL",
  INTERNACIONAL: "INT",
  INTERNATIONAL: "INT",
  GLOBAL: "INT",
  WORLD: "INT",
  MUNDIAL: "INT",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function normalizeRegion(region?: string): string {
  const raw = normalizeKey(region ?? "");
  if (!raw) return "";
  return REGION_ALIASES[raw] ?? raw;
}

const KNOWN_TEAM_REGIONS: Record<string, string> = {
  // CBLOL
  furia: "CBLOL",
  loud: "CBLOL",
  pain: "CBLOL",
  "pain gaming": "CBLOL",
  kabum: "CBLOL",
  "kabum! esports": "CBLOL",
  fluxo: "CBLOL",
  "fluxo w7m": "CBLOL",
  "vivo keyd": "CBLOL",
  "vivo keyd stars": "CBLOL",
  "red canids": "CBLOL",
  "red canids kalunga": "CBLOL",
  "los grandes": "CBLOL",
  los: "CBLOL",
  intz: "CBLOL",
  liberty: "CBLOL",
  "7rex": "CBLOL",
  "9z": "CBLOL",
  "9z globant": "CBLOL",
  "azules esports": "CBLOL",
  isurus: "CBLOL",
  estrall: "CBLOL",
  leviatan: "CBLOL",
  allknights: "CBLOL",

  // LCK
  t1: "LCK",
  "gen.g": "LCK",
  geng: "LCK",
  hle: "LCK",
  "hanwha life esports": "LCK",
  dk: "LCK",
  dplus: "LCK",
  "dplus kia": "LCK",
  kt: "LCK",
  "kt rolster": "LCK",
  bnk: "LCK",
  "bnk fearx": "LCK",
  drx: "LCK",
  kdf: "LCK",
  "kwangdong freecs": "LCK",
  ns: "LCK",
  "nongshim redforce": "LCK",
  bro: "LCK",
  okbrion: "LCK",
  "hanjin brion": "LCK",

  // LPL
  blg: "LPL",
  "bilibili gaming": "LPL",
  tes: "LPL",
  "top esports": "LPL",
  jdg: "LPL",
  "jd gaming": "LPL",
  wbg: "LPL",
  "weibo gaming": "LPL",
  edg: "LPL",
  "edward gaming": "LPL",
  rng: "LPL",
  "royal never give up": "LPL",
  lng: "LPL",
  "lng esports": "LPL",
  ig: "LPL",
  "invictus gaming": "LPL",
  fpx: "LPL",
  "funplus phoenix": "LPL",
  ninj: "LPL",
  "ninjas in pyjamas": "LPL",
  omg: "LPL",
  we: "LPL",
  "team we": "LPL",
  tt: "LPL",
  al: "LPL",
  up: "LPL",
  ra: "LPL",
  lgd: "LPL",

  // LEC
  g2: "LEC",
  "g2 esports": "LEC",
  fnc: "LEC",
  fnatic: "LEC",
  kc: "LEC",
  karmine: "LEC",
  "karmine corp": "LEC",
  mroi: "LEC",
  mad: "LEC",
  "mad lions": "LEC",
  gx: "LEC",
  giantx: "LEC",
  sk: "LEC",
  "sk gaming": "LEC",
  bds: "LEC",
  "team bds": "LEC",
  vit: "LEC",
  "team vitality": "LEC",
  th: "LEC",
  "team heretics": "LEC",
  rge: "LEC",
  rogue: "LEC",

  // LCS
  fly: "LCS",
  flyquest: "LCS",
  tl: "LCS",
  "team liquid": "LCS",
  c9: "LCS",
  cloud9: "LCS",
  "100t": "LCS",
  "100 thieves": "LCS",
  dig: "LCS",
  dignitas: "LCS",
  dsg: "LCS",
  disguised: "LCS",
  sr: "LCS",
  "shopify rebellion": "LCS",
  shop: "LCS",
  imt: "LCS",
  immortals: "LCS",
  lyon: "LCS",

  // LCP
  psg: "LCP",
  "psg talon": "LCP",
  cfo: "LCP",
  "ctbc flying oyster": "LCP",
  gam: "LCP",
  "gam esports": "LCP",
  tw: "LCP",
  "team whales": "LCP",
  vke: "LCP",
  "vikings esports": "LCP",
  shg: "LCP",
  "fukuoka softbank hawks": "LCP",
  dfm: "LCP",
  "detonation focusme": "LCP",
  chf: "LCP",
  chiefs: "LCP",
  deep: "LCP",
  "deep cross gaming": "LCP",
};

/**
 * Deduz a região oficial ativa de um time a partir do seu nome ou apelido.
 * Garante que times cadastrados sem região explícita não percam seus pontos no ranking.
 */
export function inferTeamRegion(teamName?: string, fallback?: string): string {
  if (!teamName) return fallback ? normalizeRegion(fallback) : "";
  const norm = teamName.trim().toLowerCase();
  if (KNOWN_TEAM_REGIONS[norm]) return KNOWN_TEAM_REGIONS[norm];
  for (const [key, reg] of Object.entries(KNOWN_TEAM_REGIONS)) {
    if (norm.includes(key) || key.includes(norm)) return reg;
  }
  if (fallback) {
    const n = normalizeRegion(fallback);
    if (n && n !== "OUTROS" && n !== "INT") return n;
  }
  return "";
}

/**
 * Retorna o nome canônico do campeonato para agrupamento no Hall da Fama e Pódio.
 * Evita criar cards separados para cada ano ("MSI 2026", "MSI 2027", "Worlds 2026", etc.).
 */
export function canonicalTournamentName(rawName?: string | null): string {
  if (!rawName) return "Campeonato Oficial";
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  // MSI / Mid-Season Invitational
  if (
    lower.includes("msi") ||
    lower.includes("mid-season") ||
    lower.includes("mid season") ||
    lower.includes("midseason")
  ) {
    return "Mid-Season Invitational (MSI)";
  }

  // Worlds / World Championship / Mundial
  if (
    lower.includes("world") ||
    lower.includes("mundial")
  ) {
    return "World Championship (Worlds)";
  }

  // First Stand Tournament / Kickoff
  if (lower.includes("first stand") || lower.includes("kickoff")) {
    return "First Stand Tournament";
  }

  // Rift Rivals
  if (lower.includes("rift rivals") || lower.includes("rift-rivals")) {
    return "Rift Rivals: Batalha Continental";
  }

  // Supercopa Intercontinental
  if (lower.includes("supercopa")) {
    return "Supercopa Intercontinental";
  }

  // Global Masters
  if (lower.includes("global masters") || lower.includes("global master") || lower.includes("iem")) {
    return "Global Masters";
  }

  // Copa dos Desafiantes Internacional
  if (lower.includes("desafiante") || lower.includes("underdog")) {
    return "Copa dos Desafiantes Internacional";
  }

  // Ligas com ano no final (ex: "CBLOL 2026" -> "CBLOL", "LCK 2025" -> "LCK")
  const strippedYear = trimmed.replace(/\s+20\d{2}(\s*[-/]\s*\d+)?$/i, "").trim();
  if (strippedYear && strippedYear.length >= 2) {
    return strippedYear;
  }

  return trimmed;
}

/**
 * Extrai o rótulo da temporada/edição caso venha embutido no nome do torneio.
 */
export function extractSeasonFromChampName(name: string, fallbackSeason?: string): string {
  const cleanFallback = (fallbackSeason ?? "").trim();
  if (cleanFallback && !/^(atual|campeão)$/i.test(cleanFallback)) {
    return cleanFallback;
  }
  const match = name.match(/\b(20\d{2})\b/);
  if (match) return match[1];
  return cleanFallback || "Edição Oficial";
}

export const ACTIVE_CIRCUIT_REGIONS = ["LCK", "LPL", "LEC", "LCS", "CBLOL", "LCP"] as const;

export interface RegionSlotInfo {
  region: string;
  intlPoints: number;
  ratio: number;
  worlds: number;
  msi: number;
}

export interface RegionRankingEntry {
  region: string;
  points: number;
  titles: number;
  teamsCount: number;
  intlPoints: number;
  /** Coeficiente ponderado das últimas 4 edições internacionais (define o momento). */
  momentumScore: number;
  /** Quantas edições internacionais recentes compõem o coeficiente. */
  recentEditions: number;
  /** Variação direta nas vagas de Worlds por conquista ou pipocada no último internacional. */
  slotDelta: number;
  /** Motivo resumido da alocação atual de vagas. */
  slotReason?: string;
  /** Tendência recente comparando a última edição internacional com a anterior. */
  trend: "up" | "down" | "stable";
  rank: number;
  isTop2: boolean;
  worldsSlots: number;
  msiSlots: number;
  globalMastersSlots: number;
}

const RECENCY_WEIGHTS = [1.0, 0.7, 0.45, 0.25];
const MAX_RECENT_EDITIONS = 4;

export function getOfficialRegionRanking(
  career?: CareerLedger,
  game: GameId = "lol",
): RegionRankingEntry[] {
  const table = career?.[game] ?? {};
  const careerTeams = Object.values(table).filter((t) => (t.played ?? 0) > 0 || (t.points ?? 0) !== 0);

  const statsMap = new Map<
    string,
    {
      points: number;
      titles: number;
      teamsCount: number;
      intlPoints: number;
      momentumScore: number;
      recentEditions: number;
      latestEdCoef: number | null;
      prevEdCoef: number | null;
    }
  >();

  for (const reg of ACTIVE_CIRCUIT_REGIONS) {
    statsMap.set(reg, {
      points: 0,
      titles: 0,
      teamsCount: 0,
      intlPoints: 0,
      momentumScore: 0,
      recentEditions: 0,
      latestEdCoef: null,
      prevEdCoef: null,
    });
  }

  // Agrega pontos e títulos históricos do Hall da Fama (vitrine permanente, NÃO trava vagas!)
  for (const stats of careerTeams) {
    const raw = stats.region?.trim() || "";
    let reg = normalizeRegion(raw);
    if (!reg) {
      reg = inferTeamRegion(stats.name);
    }
    if (!reg) continue;
    const entry = statsMap.get(reg) || {
      points: 0,
      titles: 0,
      teamsCount: 0,
      intlPoints: 0,
      momentumScore: 0,
      recentEditions: 0,
      latestEdCoef: null,
      prevEdCoef: null,
    };
    entry.points += stats.points ?? 0;
    entry.titles += stats.titles ?? 0;
    entry.teamsCount += 1;
    statsMap.set(reg, entry);
  }

  // Agrega pontos internacionais acumulados (histórico geral internacional)
  for (const [rawReg, row] of Object.entries(career?.international?.[game] ?? {})) {
    const reg = normalizeRegion(rawReg);
    if (!reg) continue;
    const entry = statsMap.get(reg) || {
      points: 0,
      titles: 0,
      teamsCount: 0,
      intlPoints: 0,
      momentumScore: 0,
      recentEditions: 0,
      latestEdCoef: null,
      prevEdCoef: null,
    };
    entry.intlPoints = row.points ?? 0;
    statsMap.set(reg, entry);
  }

  // ---------- COEFICIENTE DE MOMENTO (Janela das últimas 4 edições internacionais) ----------
  const fullIntlHistory = career?.intlHistory?.[game] ?? [];
  const recentWindow = fullIntlHistory.slice(-MAX_RECENT_EDITIONS);
  const hasIntlHistory = recentWindow.some((ed) => Object.keys(ed.regionScores ?? {}).length > 0);

  if (hasIntlHistory) {
    const total = recentWindow.length;
    for (let i = total - 1; i >= 0; i--) {
      const ed = recentWindow[i];
      const distFromLatest = total - 1 - i; // 0 = mais recente
      const weight = RECENCY_WEIGHTS[distFromLatest] ?? 0.25;

      for (const [rawReg, perf] of Object.entries(ed.regionScores ?? {})) {
        const reg = normalizeRegion(rawReg);
        if (!reg) continue;
        const entry = statsMap.get(reg) || {
          points: 0,
          titles: 0,
          teamsCount: 0,
          intlPoints: 0,
          momentumScore: 0,
          recentEditions: 0,
          latestEdCoef: null,
          prevEdCoef: null,
        };

        // Bônus de mérito e penalidade de pipocada entram DIRETO no Coeficiente de Momento,
        // fazendo a região subir ou cair de posição na tabela de forma limpa e sequencial!
        const wr = perf.played > 0 ? perf.wins / perf.played : 0;
        const floped =
          perf.played >= 2 &&
          perf.bestStage === "groups" &&
          (wr < 0.35 || perf.coefPoints <= -6);
        const playoffBoost =
          perf.bestStage === "champion"
            ? 35
            : perf.bestStage === "runnerup"
              ? 20
              : perf.bestStage === "playoffs" && wr >= 0.5
                ? 15
                : 0;
        const flopPenalty = floped ? 35 : 0;
        const effectiveEdCoef = perf.coefPoints + playoffBoost - flopPenalty;

        entry.momentumScore += effectiveEdCoef * weight;
        entry.recentEditions += 1;
        if (distFromLatest === 0) entry.latestEdCoef = effectiveEdCoef;
        if (distFromLatest === 1) entry.prevEdCoef = effectiveEdCoef;

        statsMap.set(reg, entry);
      }
    }

    for (const entry of statsMap.values()) {
      entry.momentumScore = Math.round(entry.momentumScore);
    }
  } else {
    // Fallback para saves antigos que ainda não têm intlHistory, mas já jogaram internacional
    for (const entry of statsMap.values()) {
      entry.momentumScore = entry.intlPoints;
    }
  }

  const hasAnyIntlActivity =
    hasIntlHistory || Array.from(statsMap.values()).some((s) => s.intlPoints !== 0);

  // Ordenação EXCLUSIVAMENTE pelo Coeficiente de Momento Internacional (nunca por pontos locais infinitos!)
  const sorted = Array.from(statsMap.entries()).sort(([regA, a], [regB, b]) => {
    if (hasAnyIntlActivity) {
      if (a.momentumScore !== b.momentumScore) return b.momentumScore - a.momentumScore;
      if (a.intlPoints !== b.intlPoints) return b.intlPoints - a.intlPoints;
    }
    const baseA = REGION_BASE_SCORE[regA] ?? 50;
    const baseB = REGION_BASE_SCORE[regB] ?? 50;
    if (baseA !== baseB) return baseB - baseA;
    return b.points - a.points;
  });

  return sorted.map(([region, data], index) => {
    const rank = index + 1;
    const isTop2 = rank <= 2;

    // Sequência 100% organizada pela posição no ranking:
    // #1 e #2 (Top 2): 4 Worlds · 2 MSI · 2 Global Masters
    // #3 e #4:         3 Worlds · 2 MSI · 1 Global Masters
    // #5 e #6:         2 Worlds · 1 MSI · 1 Global Masters
    const worldsSlots = rank <= 2 ? 4 : rank <= 4 ? 3 : 2;
    const msiSlots = rank <= 4 ? 2 : 1;
    const globalMastersSlots = isTop2 ? 2 : 1;

    let trend: "up" | "down" | "stable" = "stable";
    if (data.latestEdCoef !== null) {
      if (data.prevEdCoef !== null) {
        if (data.latestEdCoef >= data.prevEdCoef + 6) trend = "up";
        else if (data.latestEdCoef <= data.prevEdCoef - 6) trend = "down";
      } else {
        if (data.latestEdCoef >= 15) trend = "up";
        else if (data.latestEdCoef <= -5) trend = "down";
      }
    }

    return {
      region,
      points: data.points,
      titles: data.titles,
      teamsCount: data.teamsCount,
      intlPoints: data.intlPoints,
      momentumScore: data.momentumScore,
      recentEditions: data.recentEditions,
      slotDelta: 0,
      trend,
      rank,
      isTop2,
      worldsSlots,
      msiSlots,
      globalMastersSlots,
    };
  });
}

export function computeRegionSlots(
  career: CareerLedger | undefined,
  game: GameId = "lol",
  extraRegions: Iterable<string> = [],
): Map<string, RegionSlotInfo> {
  const ranking = getOfficialRegionRanking(career, game);
  const out = new Map<string, RegionSlotInfo>();

  for (const entry of ranking) {
    const ratio = entry.rank <= 2 ? 1.5 : entry.rank <= 4 ? 1.0 : 0.7;
    out.set(entry.region, {
      region: entry.region,
      intlPoints: entry.momentumScore,
      ratio,
      worlds: entry.worldsSlots,
      msi: entry.msiSlots,
    });
  }

  for (const raw of extraRegions) {
    const key = normalizeRegion(raw);
    if (key && !out.has(key)) {
      out.set(key, { region: key, intlPoints: 0, ratio: 0.5, worlds: 1, msi: 1 });
    }
  }

  return out;
}

export interface RegionProfile {
  region: string;
  score: number;
  strong: boolean;
  elite: boolean;
  intlPoints: number;
  ratio: number;
  regionSlots: number;
}

export function regionProfile(
  region: string,
  career?: CareerLedger,
  game: GameId = "lol",
  eliteRegions: string[] = [],
  tournament: InternationalTournament = "worlds",
): RegionProfile {
  const key = normalizeRegion(region) || "OUTROS";
  const ranking = getOfficialRegionRanking(career, game);
  const entry = ranking.find((e) => e.region === key);
  const rank = entry?.rank ?? 6;
  const isTop2 = entry?.isTop2 ?? false;
  const score = Math.max(40, 100 - (rank - 1) * 8 + Math.min(20, Math.round((entry?.points ?? 0) / 10)));
  const tournamentSlots = tournament === "worlds" ? (entry?.worldsSlots ?? 2) : (entry?.msiSlots ?? 1);
  const strong = rank <= 4;
  const elite = eliteRegions.length > 0 ? eliteRegions.includes(key) : isTop2;
  return {
    region: key,
    score,
    strong,
    elite,
    intlPoints: entry?.momentumScore ?? 0,
    ratio: entry?.rank ? (entry.rank <= 2 ? 1.5 : 1.0) : 0,
    regionSlots: tournamentSlots,
  };
}

export function isPlayInPhaseName(name: string): boolean {
  const s = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return (
    /\bplay\s?in\b/.test(s) ||
    s.includes("playin") ||
    s.includes("repescagem") ||
    s.includes("qualificat")
  );
}

export function isPlayInPhase(phase: Pick<Phase, "name">): boolean {
  return isPlayInPhaseName(phase.name);
}

export function detectTournamentType(
  championshipName: string,
  phases: PhaseShape[],
): InternationalTournament {
  const name = normalizeKey(championshipName);
  if (name.includes("MSI") || name.includes("MID SEASON") || name.includes("MIDSEASON")) {
    return "msi";
  }
  if (name.includes("WORLD") || name.includes("MUNDIAL") || name.includes("WORLDS")) {
    return "worlds";
  }
  if (phases.some((phase) => phase.kind === "swiss")) return "worlds";
  return "msi";
}

function rosterAverage(roster: Team["roster"]): number | null {
  if (!roster || roster.length === 0) return null;
  const starters = roster.filter((p) => !p.sub);
  const pool = starters.length > 0 ? starters : roster;
  if (pool.length === 0) return null;
  const total = pool.reduce(
    (sum, p) => sum + (p.attrs.mechanics + p.attrs.gameIq + p.attrs.clutch) / 3,
    0,
  );
  return total / pool.length;
}

function teamStrength(team: Team, ledger?: CareerTeam): number {
  const base = ledger?.rating ?? 50;
  const culture = clamp(team.culture ?? 50, 0, 100);
  const synergy = clamp(team.synergy ?? 0, 0, 50);
  const average = rosterAverage(team.roster);
  if (average === null) {
    return clamp(base + (culture - 50) * 0.1, 5, 99);
  }
  const starters = (team.roster ?? []).filter((p) => !p.sub);
  const pool = starters.length > 0 ? starters : (team.roster ?? []);
  const best = pool.reduce(
    (max, p) => Math.max(max, (p.attrs.mechanics + p.attrs.gameIq + p.attrs.clutch) / 3),
    0,
  );
  const star = best >= 93 ? 4 : best >= 88 ? 2 : 0;
  const pointsBonus = Math.min(4, (ledger?.points ?? 0) * 0.002);
  return clamp(
    base * 0.3 + average * 0.65 + star + synergy * 0.06 + (culture - 50) * 0.1 + pointsBonus,
    5,
    99,
  );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function inactivePlan(teams: Team[]): InternationalPlan {
  return {
    active: false,
    tournament: "worlds",
    playInPhaseIndex: -1,
    mainPhaseIndex: -1,
    playInSlots: 0,
    mainTargetSlots: 0,
    eventTeamCount: teams.length,
    qualifiersToMain: 0,
    totalQualified: 0,
    directTeamIds: teams.map((t) => t.id),
    playInTeamIds: [],
    outTeamIds: [],
    strongRegions: [],
    weakRegions: [],
    eliteRegions: [],
    playInExemptRegions: [],
    entries: [],
    playInEmpty: true,
    directSlotsByRegion: {},
  };
}

/**
 * É um torneio internacional (Worlds/MSI)? O play-in só existe nesse
 * contexto — qualquer outro campeonato (liga, CBLOL, Serie B, promoção)
 * mantém todos os times na primeira fase.
 */
export function isInternationalTournamentName(championshipName: string): boolean {
  const name = normalizeKey(championshipName);
  return /\b(WORLD|WORLDS|MUNDIAL)\b/.test(name) || /\bMSI\b|MID SEASON|MIDSEASON/.test(name);
}

export function planInternationalField(params: {
  teams: Team[];
  phases: PhaseShape[];
  game?: GameId;
  career?: CareerLedger;
  fallbackRegion?: string;
  championshipName?: string;
  tournament?: InternationalTournament;
}): InternationalPlan {
  const {
    teams,
    phases,
    game = "lol",
    career,
    fallbackRegion,
    championshipName = "",
    tournament,
  } = params;

  if (teams.length < 2 || phases.length < 2) return inactivePlan(teams);

  // ---------- O PLAY-IN SÓ EXISTE EM WORLDS/MSI ----------
  // A classificação regional (vagas por região) só faz sentido nesses
  // eventos. Um campeonato comum que tenha uma fase chamada "Play-in"
  // (play-in de promoção, repescagem de liga) mantém TODOS os times.
  const normalizedChampionshipName = normalizeKey(championshipName);
  const isWorlds = /\b(WORLD|WORLDS|MUNDIAL)\b/.test(normalizedChampionshipName);
  const isMsi = /\bMSI\b|MID SEASON|MIDSEASON/.test(normalizedChampionshipName);
  if (!isWorlds && !isMsi) return inactivePlan(teams);

  // A fase de play-in tem que ser a PRIMEIRA (é dela que saem os classificados).
  const playInPhaseIndex = phases.findIndex((phase) => isPlayInPhaseName(phase.name));
  if (playInPhaseIndex !== 0) return inactivePlan(teams);

  const mainPhaseIndex = 1;
  const tournamentType: InternationalTournament = tournament ?? (isWorlds ? "worlds" : "msi");

  const careerTable = career?.[game] ?? {};
  const byRegion = new Map<string, Team[]>();
  const ledgerByName = new Map<string, CareerTeam | undefined>();

  for (const team of teams) {
    const ledger = careerTable[team.name.trim().toLowerCase()];
    ledgerByName.set(team.id, ledger);
    const region = normalizeRegion(team.region || ledger?.region || fallbackRegion) || "OUTROS";
    const list = byRegion.get(region) ?? [];
    list.push(team);
    byRegion.set(region, list);
  }

  const regions = Array.from(byRegion.keys());
  const slotTable = computeRegionSlots(career, game, regions);

  for (const list of byRegion.values()) {
    list.sort((a, b) => {
      const la = ledgerByName.get(a.id);
      const lb = ledgerByName.get(b.id);
      const sa = teamStrength(a, la);
      const sb = teamStrength(b, lb);
      return (
        sb - sa ||
        (lb?.points ?? 0) - (la?.points ?? 0) ||
        (lb?.titles ?? 0) - (la?.titles ?? 0) ||
        a.name.localeCompare(b.name)
      );
    });
  }

  // Elite regions & isentas de Play-In = Top 2 do Coeficiente de Momento atual!
  const officialRanking = getOfficialRegionRanking(career, game);
  const rankIndexMap = new Map(officialRanking.map((r, i) => [r.region, i]));
  const hasMomentum = officialRanking.some((r) => r.momentumScore !== 0);

  const eliteRegions = officialRanking
    .filter((r) => r.isTop2)
    .map((r) => r.region);

  // As 2 melhores do ranking do Momento nunca disputam o play-in.
  // Se ainda não houver nenhum histórico internacional, desempata por quem tem mais times inscritos.
  const rankingDeRegions = Array.from(slotTable.values()).sort((a, b) => {
    if (hasMomentum) {
      const ra = rankIndexMap.get(a.region) ?? 99;
      const rb = rankIndexMap.get(b.region) ?? 99;
      if (ra !== rb) return ra - rb;
    }
    return (
      b.intlPoints - a.intlPoints ||
      (byRegion.get(b.region)?.length ?? 0) - (byRegion.get(a.region)?.length ?? 0) ||
      a.region.localeCompare(b.region)
    );
  });
  const playInExemptRegions = new Set(rankingDeRegions.slice(0, 2).map((info) => info.region));

  // Rebuild profiles with elite info
  const profilesWithElite = new Map<string, RegionProfile>();
  for (const region of regions) {
    profilesWithElite.set(
      region,
      regionProfile(region, career, game, eliteRegions, tournamentType),
    );
  }

  // ---------- ALOCAÇÃO POR VAGA REGIONAL ----------
  // Regras (formato Worlds/MSI):
  // 1. As 2 MELHORES regiões do ranking do Hall da Fama NUNCA disputam o
  //    play-in: TODOS os times delas vão direto pro evento principal.
  // 2. Região com 1 vaga: o time vai DIRETO pro play-in (é a vaga dela).
  // 3. Região com 2+ vagas: os melhores seeds vão direto (até a cota) e o
  //    PIOR seed da região disputa o play-in.
  const entries: InternationalEntry[] = [];
  let unusedRegionalSlots = 0;
  for (const [region, list] of byRegion) {
    const profile = profilesWithElite.get(region)!;
    const slots = profile.regionSlots;
    const exempt = playInExemptRegions.has(region);
    // Quantos times da região entram direto:
    // - top 2 regiões: TODOS (nunca vão pro play-in);
    // - demais: os melhores, até a cota, mas SEMPU reserving a última vaga
    //   pro play-in (o pior seed da região disputa essa vaga).
    const directCount = exempt ? list.length : Math.min(slots, Math.max(0, list.length - 1));
    // Vaga regional que NINGUÉM usa (a que o play-in disputa).
    unusedRegionalSlots += Math.max(0, slots - directCount);
    list.forEach((team, index) => {
      const seed = index + 1;
      entries.push({
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        region,
        seed,
        regionSlots: slots,
        regionScore: profile.score,
        strongRegion: profile.strong,
        eliteRegion: profile.elite,
        strength: teamStrength(team, ledgerByName.get(team.id)),
        destination: index < directCount ? "direct" : "play-in",
      });
    });
  }

  const directEntries: InternationalEntry[] = entries.filter((e) => e.destination === "direct");
  const playInEntries: InternationalEntry[] = entries.filter((e) => e.destination === "play-in");

  if (unusedRegionalSlots === 0 || playInEntries.length === 0) {
    // Sem vaga regional sobrando (todo mundo usou a cota) OU sem seed extra
    // disputando: não existe play-in possível — todo mundo vai direto e o
    // evento cresce para caber.
    for (const e of playInEntries) {
      e.destination = "direct";
      directEntries.push(e);
    }
    playInEntries.length = 0;
  } else if (playInEntries.length === 1 && unusedRegionalSlots === 1) {
    // UM time disputando UMA vaga: ele pega a vaga direto. Play-in de um time
    // só não é formato nenhum.
    const lone = playInEntries[0]!;
    lone.destination = "direct";
    directEntries.push(lone);
    playInEntries.length = 0;
  }
  // Fora dos casos acima o play-in fica com TODOS os seeds extras e disputa
  // as vagas regionais sobrantes. Se houver mais times do que vagas, o
  // excedente é ELIMINADO no play-in (é o formato do Worlds/MSI).

  // Vagas diretas: região mais forte primeiro, seed menor antes.
  directEntries.sort(
    (a, b) =>
      b.regionSlots - a.regionSlots ||
      a.seed - b.seed ||
      b.regionScore - a.regionScore ||
      b.strength - a.strength ||
      a.teamName.localeCompare(b.teamName),
  );
  // Play-in: o mais forte da lista é o seed 1 do play-in.
  playInEntries.sort(
    (a, b) =>
      b.strength - a.strength ||
      b.regionScore - a.regionScore ||
      a.seed - b.seed ||
      a.teamName.localeCompare(b.teamName),
  );

  const directCount = directEntries.length;
  const playInCount = playInEntries.length;
  // O play-in é fase de ELIMINAÇÃO: JAMAIS pode classificar 100% dos times.
  // No formato real de Worlds e MSI:
  // - 2 times disputam 1 vaga (1 classificado, 1 eliminado)
  // - 4 times disputam 2 vagas (2 classificados, 2 eliminados)
  // - 8 times disputam 4 vagas (4 classificados, 4 eliminados)
  // O número de classificados não pode ultrapassar a cota ideal do formato nem
  // as vagas regionais sobrantes (se menores), garantindo que sempre haja eliminação.
  const targetQualifiers = computePlayInQualifiers(playInCount);
  const qualifiersToMain =
    playInCount <= 1
      ? 0
      : Math.max(
          1,
          Math.min(
            playInCount - 1,
            targetQualifiers,
            unusedRegionalSlots > 0 ? unusedRegionalSlots : targetQualifiers,
          ),
        );

  // ---------- TAMANHO DO EVENTO = VAGAS DO HALL DA FAMA ----------
  // Em evento internacional NÃO existe "número de vagas fixo": o tamanho do
  // evento principal é a SOMA das vagas que cada região ganhou no Hall da
  // Fama. Vaga de região que ninguém usou volta pro play-in; se o play-in
  // não tem time pra preencher, a vaga simplesmente fica vazia.
  const regionalSlotsTotal = regions.reduce(
    (sum, region) => sum + (profilesWithElite.get(region)?.regionSlots ?? 0),
    0,
  );
  const eventSlots = Math.max(2, regionalSlotsTotal);
  // Quantos times realmente jogam o evento principal (diretos + classificados).
  const eventTeamCount = directCount + qualifiersToMain;

  const totalQualified = entries.length;
  const active = directCount >= 2;
  if (!active) return inactivePlan(teams);

  const directSlotsByRegion: Record<string, number> = {};
  for (const e of directEntries) {
    directSlotsByRegion[e.region] = (directSlotsByRegion[e.region] ?? 0) + 1;
  }

  return {
    active,
    tournament: tournamentType,
    playInPhaseIndex,
    mainPhaseIndex,
    playInSlots: playInCount,
    /** Tamanho oficial do evento = soma das vagas do Hall da Fama por região. */
    mainTargetSlots: eventSlots,
    /** Times que realmente entram no evento principal (diretos + qualificados). */
    eventTeamCount,
    qualifiersToMain,
    totalQualified,
    directTeamIds: directEntries.map((e) => e.teamId),
    playInTeamIds: playInEntries.map((e) => e.teamId),
    outTeamIds: [],
    strongRegions: regions.filter((r) => profilesWithElite.get(r)?.strong),
    weakRegions: regions.filter((r) => !profilesWithElite.get(r)?.strong),
    eliteRegions,
    /** As 2 melhores regiões do ranking: nunca disputam o play-in. */
    playInExemptRegions: Array.from(playInExemptRegions),
    entries,
    playInEmpty: playInCount === 0,
    directSlotsByRegion,
  };
}

export function phaseTeamIdsInOrder(phase: Phase): string[] {
  if (phase.seededTeamIds && phase.seededTeamIds.length > 0) {
    return unique(phase.seededTeamIds);
  }
  if (phase.groups && phase.groups.length > 0) {
    return unique(phase.groups.flatMap((group) => group.teamIds));
  }
  const sideOrder = (side: Phase["matches"][number]["bracketSide"]) =>
    side === "upper" ? 0 : side === "lower" ? 1 : side === "grand" ? 2 : 3;
  const matches = phase.matches
    .slice()
    .sort(
      (a, b) =>
        sideOrder(a.bracketSide) - sideOrder(b.bracketSide) ||
        (a.round ?? 0) - (b.round ?? 0) ||
        (a.slot ?? 0) - (b.slot ?? 0),
    );
  const ids: string[] = [];
  for (const match of matches) {
    if (match.teamAId) ids.push(match.teamAId);
    if (match.teamBId) ids.push(match.teamBId);
  }
  return unique(ids);
}

/** Rótulo do confronto que decide a vaga única do play-in. */
export const PLAY_IN_CLASSIFICATION_LABEL = "Classificação";

/**
 * Quantidade ideal de classificados do play-in com base no número de inscritos.
 * O play-in é fase de eliminação (nunca classifica 100% dos participantes):
 * - 2 ou 3 times: 1 classificado
 * - 4 ou 5 times: 2 classificados (50% de avanço)
 * - 6 ou 7 times: 3 classificados
 * - 8+ times: 4 classificados (teto oficial de Worlds/MSI)
 */
export function computePlayInQualifiers(playInCount: number): number {
  if (playInCount <= 1) return 0;
  if (playInCount === 2 || playInCount === 3) return 1;
  if (playInCount === 4 || playInCount === 5) return 2;
  if (playInCount === 6 || playInCount === 7) return 3;
  return 4;
}

export interface PlayInStructure {
  kind: "groups" | "bracket";
  config: GroupsConfig | PlayoffsConfig;
  groupCount: number;
  qualifiersPerGroup: number;
  /** Rótulo do confronto decisivo (play-in de UMA vaga). */
  deciderLabel: string | null;
}

/**
 * Formato do play-in internacional (Worlds/MSI).
 *
 * - MAIS DE UMA VAGA: o play-in é GRUPO (2 grupos, mini-chave dupla GSL com
 *   4 times cada — é o formato real do Worlds/MSI). Não existe "Grande Final"
 *   no play-in: quem classifica é o grupo.
 * - UMA VAGA: confronto único de CLASSIFICAÇÃO (não é final).
 */
export function playInStructure(playInCount: number, qualifiersToMain: number): PlayInStructure {
  if (qualifiersToMain <= 1) {
    return {
      kind: "bracket",
      config: {
        kind: "bracket",
        slots: 2,
        type: "single",
        defaultBestOf: 3,
        finalBestOf: 3,
        bracketReset: false,
        mode: "auto",
      },
      groupCount: 1,
      qualifiersPerGroup: 1,
      deciderLabel: PLAY_IN_CLASSIFICATION_LABEL,
    };
  }

  // 2 grupos somente quando houver pelo menos 8 times (no mínimo 4 times por grupo).
  // Com menos de 8 times (ex: 4, 5, 6 times), é sempre GRUPO ÚNICO onde todos se
  // enfrentam (round-robin), garantindo que nenhum time dispute só 1 partida.
  const groupCount = playInCount >= 8 && qualifiersToMain % 2 === 0 ? 2 : 1;
  const qualifiersPerGroup = Math.max(1, Math.round(qualifiersToMain / groupCount));
  const teamsPerGroup = Math.max(1, Math.floor(playInCount / groupCount));
  // GSL (dupla eliminação) só quando há 4 times por grupo em 2 grupos (ex: 8 times no total).
  const format: "gsl" | "round-robin" = groupCount >= 2 && teamsPerGroup === 4 ? "gsl" : "round-robin";
  return {
    kind: "groups",
    config: {
      kind: "groups",
      groupCount,
      format,
      qualifiersPerGroup,
      bestOf: 3,
      // Fallback sem GSL: round-robin simples (o grupo classifica por
      // vitórias; o desempate é derrota).
      doubleRoundRobin: false,
    },
    groupCount,
    qualifiersPerGroup,
    deciderLabel: null,
  };
}
