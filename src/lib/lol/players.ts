import type { Player, PlayerAttrs, PlayerRole, Team } from "./types";
import { REAL_ROSTERS, type ScoutedPlayer, type ScoutedTeam } from "./real-rosters";
import { uid } from "./generate";

// ---------------------------------------------------------------------------
// Hash determinístico (mesmo input → mesmo output; sem Math.random em lugar
// nenhum do sistema de evolução — a simulação de placar é o único sorteio).
// ---------------------------------------------------------------------------

export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export const clampAttr = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * ID ESTÁVEL de jogador derivado (banco real / sintético / legado).
 *
 * O id precisa sobreviver ao reload: os deltas de evolução ficam guardados
 * em `Match.formEffect.playerDeltas` indexados por `player.id`. Se o id fosse
 * sorteado a cada derivação, o roster podado no save voltaria com ids
 * diferentes e a reversão da evolução (limpar o placar) não acharia o
 * jogador. O id deriva do ign+função, então é o mesmo sempre.
 */
export const playerId = (ign: string, role: PlayerRole) =>
  `p_${hashStr(`player:${ign.trim().toLowerCase()}:${role}`).toString(36)}`;

const normalizeName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// ---------------------------------------------------------------------------
// Idade — o scrape do Leaguepedia não traz nascimentos (CargoDB rate-limita),
// então a idade parte de uma distribuição realista de elenco de LoL fixada
// por hash do ign: mesma idade sempre que o elenco for recarregado, e
// editável na mão no editor de elenco.
// ---------------------------------------------------------------------------

const AGE_DISTRIBUTION = [19, 20, 20, 21, 21, 22, 22, 23, 24, 25];

export function ageForIgn(ign: string): number {
  return AGE_DISTRIBUTION[hashStr(`age:${ign}`) % AGE_DISTRIBUTION.length];
}

// ---------------------------------------------------------------------------
// Atributos base por função — faixas por posição (jungler e suporte leem o
// jogo, mid/adc exigem mais mecânica), variação fixa por hash do ign.
// ---------------------------------------------------------------------------

const ROLE_RANGES: Record<
  PlayerRole,
  { m: [number, number]; i: [number, number]; c: [number, number] }
> = {
  top: { m: [68, 88], i: [64, 84], c: [60, 82] },
  jungle: { m: [64, 84], i: [70, 90], c: [60, 82] },
  mid: { m: [72, 92], i: [68, 88], c: [64, 86] },
  adc: { m: [74, 94], i: [64, 84], c: [64, 86] },
  support: { m: [60, 80], i: [72, 92], c: [64, 86] },
};

const inRange = (r: [number, number], seed: number) => r[0] + (seed % (r[1] - r[0] + 1));

/**
 * Garante que todos os 8 atributos de um jogador estejam presentes,
 * preenchendo os novos atributos (mentalidade, experiência internacional, etc.)
 * de forma determinística e realista se vierem de saves legados.
 */
export function getResolvedAttrs(
  attrs: PlayerAttrs,
  ign: string,
  role: PlayerRole = "mid",
  country?: string,
  age?: number,
): Required<PlayerAttrs> {
  const h = hashStr(`ext_attrs:${role}:${ign}`);
  const baseConsistency = Math.round(attrs.gameIq * 0.55 + attrs.clutch * 0.35 + (h % 11) - 5);
  const baseAggression = Math.round(attrs.mechanics * 0.6 + ((h >> 4) % 15) - 5);
  const baseAdaptability = Math.round(attrs.gameIq * 0.6 + attrs.mechanics * 0.2 + ((h >> 8) % 15) - 5);

  const upperCountry = (country ?? "").trim().toUpperCase();
  const isMajorRegion = ["KR", "CN"].includes(upperCountry);
  const isMedRegion = ["EU", "US", "CA", "DE", "FR", "ES", "DK"].includes(upperCountry);
  const intlBase = isMajorRegion ? 55 + (h % 25) : isMedRegion ? 35 + (h % 20) : 15 + (h % 20);
  const ageBonus = age && age >= 23 ? Math.min(20, (age - 22) * 5) : 0;

  const baseMentality = Math.round(attrs.clutch * 0.65 + attrs.gameIq * 0.25 + ((h >> 12) % 11) - 5);

  return {
    mechanics: attrs.mechanics,
    gameIq: attrs.gameIq,
    clutch: attrs.clutch,
    consistency: attrs.consistency ?? clampAttr(baseConsistency, 25, 98),
    aggression: attrs.aggression ?? clampAttr(baseAggression, 25, 98),
    adaptability: attrs.adaptability ?? clampAttr(baseAdaptability, 25, 98),
    intlExperience: attrs.intlExperience ?? clampAttr(intlBase + ageBonus, 5, 95),
    mentality: attrs.mentality ?? clampAttr(baseMentality, 25, 98),
  };
}

/** Atributos determinísticos de um jogador real (hash do ign + função). */
export function attrsFromIdentity(ign: string, role: PlayerRole, country?: string): PlayerAttrs {
  const h = hashStr(`attrs:${role}:${ign}`);
  const ranges = ROLE_RANGES[role] ?? ROLE_RANGES.mid;
  const initial = {
    mechanics: inRange(ranges.m, h),
    gameIq: inRange(ranges.i, Math.floor(h / 97)),
    clutch: inRange(ranges.c, Math.floor(h / 104729)),
  };
  return getResolvedAttrs(initial, ign, role, country);
}

/**
 * Cria um jogador à mão a partir de UMA nota (0–100) — a nota vira mecânica
 * cheia e os demais atributos derivam dela com variações realistas.
 */
export function makeCustomPlayer(params: {
  ign: string;
  role: PlayerRole;
  overall: number;
  age?: number;
  country?: string;
  sub?: boolean;
}): Player {
  const overall = Math.round(clampAttr(params.overall, 1, 99));
  const h = hashStr(`custom:${params.ign}`);
  const initial: PlayerAttrs = {
    mechanics: overall,
    gameIq: clampAttr(overall + (h % 9) - 4, 1, 99),
    clutch: clampAttr(overall + (Math.floor(h / 7) % 9) - 4, 1, 99),
    consistency: clampAttr(overall + ((h >> 2) % 9) - 4, 1, 99),
    aggression: clampAttr(overall + ((h >> 4) % 11) - 5, 1, 99),
    adaptability: clampAttr(overall + ((h >> 6) % 9) - 4, 1, 99),
    intlExperience: clampAttr(Math.round(overall * 0.5) + ((h >> 8) % 15), 1, 99),
    mentality: clampAttr(overall + ((h >> 10) % 9) - 4, 1, 99),
  };
  return {
    id: uid(),
    ign: params.ign.trim().slice(0, 24) || "Novato",
    role: params.role,
    country: params.country,
    age: params.age ?? ageForIgn(params.ign),
    attrs: initial,
    sub: params.sub,
    custom: true,
  };
}

/** Converte uma linha do scrape (lol.fandom.com) em Player. */
export function playerFromScout(s: ScoutedPlayer): Player {
  return {
    id: playerId(s.ign, s.role),
    ign: s.ign,
    real: s.real ?? undefined,
    role: s.role,
    country: s.country || undefined,
    age: ageForIgn(s.ign),
    attrs: attrsFromIdentity(s.ign, s.role),
    sub: s.sub || undefined,
  };
}

/**
 * O wiki usa siglas no lugar do nome completo em várias ligas (LEC: "FNC",
 * "HTICS"; LCS: "C9", "TL"; CBLOL: "VKS"). Chave = sigla do wiki; valor =
 * nome(s) completo(s) que o catálogo legado conhece. Um único mapa serve
 * pra direção inversa também — ver aliasForms().
 */
export const WIKI_NAME_ALIASES: Record<string, string[]> = {
  // CBLOL / LTA South
  vks: ["vivo keyd stars", "vivo keyd", "keyd stars", "keyd"],
  pain: ["pain gaming", "pain", "png"],
  loud: ["loud", "loud esports", "lll"],
  red: ["red canids", "red canids kalunga", "redc"],
  fur: ["furia", "furia esports"],
  fx: ["fluxo", "fluxo w7m", "w7m"],
  kbm: ["kabum! esports", "kabum esports", "kabum"],
  intz: ["intz", "intz esports", "itz"],
  lbr: ["liberty", "liberty esports"],
  los: ["los grandes", "los", "løs"],
  fla: ["flamengo esports", "flamengo", "fla"],
  lev: ["leviatan", "leviatán"],
  est: ["estral esports", "estral"],
  isg: ["isurus", "isurus gaming"],
  "9z": ["9z globant", "9z", "9zg"],

  // LCK
  t1: ["t1", "sk telecom t1", "skt", "skt t1"],
  geng: ["gen.g", "geng", "gen.g esports", "samsung galaxy", "ssg"],
  hle: ["hanwha life esports", "hanwha life", "hanwha"],
  dk: ["dplus kia", "dplus", "damwon gaming", "dwg", "damwon kia"],
  kt: ["kt rolster", "kt"],
  drx: ["drx", "kiwoom drx", "dragonx", "kingzone dragonx", "kz"],
  kdf: ["kwangdong freecs", "kwangdong", "kdf", "dn soopers", "afreeca freecs", "af"],
  bro: ["ok brion", "brion", "bro", "oksavingsbank brion", "hanjin brion", "fredit brion"],
  fox: ["bnk fearx", "fearx", "fox", "liiv sandbox", "sandbox gaming", "sandbox", "sb"],
  ns: ["nongshim redforce", "nongshim", "ns", "team dynamics"],

  // LPL
  blg: ["bilibili gaming", "bilibili"],
  tes: ["top esports", "topsports gaming", "topsports"],
  jdg: ["jd gaming"],
  wbg: ["weibo gaming", "weibo", "suning", "sn"],
  lng: ["lng esports", "lng", "snake esports"],
  ig: ["invictus gaming", "invictus"],
  edg: ["edward gaming"],
  rng: ["royal never give up", "royal club"],
  fpx: ["funplus phoenix"],
  nip: ["ninjas in pyjamas", "ninjas in pyjamas.cn", "victory five", "v5"],
  al: ["anyone's legend", "anyone legend"],
  we: ["team we", "world elite"],
  tt: ["thundertalk gaming", "thundertalk"],
  lgd: ["lgd gaming"],
  omg: ["oh my god"],
  up: ["ultra prime", "estar"],
  ra: ["rare atom", "vici gaming", "vg"],

  // LEC
  g2: ["g2 esports"],
  fnc: ["fnatic"],
  bds: ["team bds"],
  mkoi: ["movistar koi", "mad lions koi", "mad lions", "koi", "mdk"],
  kc: ["karmine corp", "kcorp"],
  vit: ["team vitality", "vitality"],
  th: ["team heretics", "heretics", "htics"],
  sk: ["sk gaming"],
  gx: ["giantx", "giants gaming", "giants", "excel esports", "xl"],
  rge: ["rogue", "navi", "natus vincere"],

  // LCS
  fly: ["flyquest"],
  tl: ["team liquid", "liquid"],
  c9: ["cloud9", "cloud 9"],
  "100t": ["100 thieves", "100thieves", "100 t"],
  dig: ["dignitas"],
  sr: ["shopify rebellion", "shopify"],
  dsg: ["disguised", "disguised gaming"],
  lyon: ["lyon gaming", "lyon 2024"],
  nrg: ["nrg esports", "nrg"],
  imt: ["immortals"],

  // LCP
  cfo: ["ctbc flying oyster", "flying oyster"],
  gam: ["gam esports"],
  shg: ["fukuoka softbank hawks gaming", "softbank hawks", "softbank"],
  dfm: ["detonation focusme", "detonation focus me"],
  psg: ["psg talon", "talon esports", "talon"],
  dcg: ["deep cross gaming"],
  gz: ["ground zero gaming", "ground zero"],
  vke: ["vikings esports", "vikings", "mvk esports", "mvk"],
  tw: ["team whales", "secret whales", "whales"],
  ts: ["team secret"],
};

/** Formas alternativas de um nome (normalizado): sigla ↔ nome completo. */
export function aliasForms(normalized: string): string[] {
  const out = [...(WIKI_NAME_ALIASES[normalized] ?? [])];
  for (const [sigla, completos] of Object.entries(WIKI_NAME_ALIASES)) {
    if (completos.some((c) => normalizeName(c) === normalized)) out.push(sigla);
  }
  return out;
}

/** Mapa pré-indexado de times para lookup instantâneo O(1). */
const PRE_INDEXED_TEAMS = new Map<string, ScoutedTeam>();

function initTeamIndex() {
  const cleanNoise = (s: string) =>
    s.replace(/\b(gaming|esports|esport|team|club)\b/gi, "").trim();

  for (const list of Object.values(REAL_ROSTERS)) {
    for (const t of list) {
      const rawNorm = normalizeName(t.name);
      PRE_INDEXED_TEAMS.set(rawNorm, t);

      const cleaned = normalizeName(cleanNoise(t.name));
      if (cleaned.length >= 2 && !PRE_INDEXED_TEAMS.has(cleaned)) {
        PRE_INDEXED_TEAMS.set(cleaned, t);
      }

      const aliases = aliasForms(rawNorm);
      for (const a of aliases) {
        const normA = normalizeName(a);
        if (!PRE_INDEXED_TEAMS.has(normA)) PRE_INDEXED_TEAMS.set(normA, t);
      }
    }
  }

  for (const [sigla, completos] of Object.entries(WIKI_NAME_ALIASES)) {
    const normSigla = normalizeName(sigla);
    let matchedTeam = PRE_INDEXED_TEAMS.get(normSigla);
    if (!matchedTeam) {
      for (const c of completos) {
        matchedTeam = PRE_INDEXED_TEAMS.get(normalizeName(c));
        if (matchedTeam) break;
      }
    }
    if (matchedTeam) {
      PRE_INDEXED_TEAMS.set(normSigla, matchedTeam);
      for (const c of completos) {
        const nc = normalizeName(c);
        if (!PRE_INDEXED_TEAMS.has(nc)) PRE_INDEXED_TEAMS.set(nc, matchedTeam);
      }
    }
  }
}
initTeamIndex();

/** Cache do lookup no banco (estático pós-import; o save poda elenco a cada tecla). */
const realTeamCache = new Map<string, ScoutedTeam | undefined>();

/** Elenco do banco real por nome de time (qualquer liga), se existir. */
export function findRealTeam(teamName: string, teamTag?: string): ScoutedTeam | undefined {
  if (!teamName || !teamName.trim()) return undefined;
  const n = normalizeName(teamName);
  const tagKey = teamTag ? normalizeName(teamTag) : "";
  const cacheKey = `${n}:${tagKey}`;
  if (realTeamCache.has(cacheKey)) return realTeamCache.get(cacheKey);

  // 1. O(1) no índice rápido
  let found = PRE_INDEXED_TEAMS.get(n);
  if (!found && tagKey) {
    found = PRE_INDEXED_TEAMS.get(tagKey);
  }

  // 2. O(1) sem palavras comuns ("gaming", "esports")
  if (!found) {
    const clean = normalizeName(teamName.replace(/\b(gaming|esports|esport|team|club)\b/gi, "").trim());
    if (clean) found = PRE_INDEXED_TEAMS.get(clean);
  }

  // 3. Containment bidirecional (fallback raro)
  if (!found && n.length >= 3) {
    for (const teams of Object.values(REAL_ROSTERS)) {
      const hit = teams.find((t) => {
        const tn = normalizeName(t.name);
        return tn.includes(n) || n.includes(tn);
      });
      if (hit) {
        found = hit;
        break;
      }
    }
  }

  realTeamCache.set(cacheKey, found);
  return found;
}

// ---------------------------------------------------------------------------
// Elenco sintético — time sem banco real e sem escalação não fica sem
// elenco: 5 titulares determinísticos (mesmo nome de time → mesmos nicks),
// editáveis na mão no editor.
// ---------------------------------------------------------------------------

const NICK_PREFIX = [
  "Kae",
  "Zir",
  "Nox",
  "Vex",
  "Ari",
  "Bol",
  "Cyra",
  "Drex",
  "Eko",
  "Fenris",
  "Gor",
  "Hex",
  "Iri",
  "Jax",
  "Kron",
  "Luxor",
  "Mir",
  "Nix",
  "Oru",
  "Pyx",
  "Quill",
  "Rax",
  "Syn",
  "Tor",
  "Ulf",
  "Vyn",
  "Wex",
  "Xar",
  "Yor",
  "Zan",
];
const NICK_SUFFIX = [
  "dus",
  "vek",
  "mira",
  "zon",
  "tahl",
  "ric",
  "vorn",
  "sei",
  "kaz",
  "lith",
  "moor",
  "nash",
  "pell",
  "quor",
  "riss",
  "senn",
  "torr",
  "ulf",
  "vash",
  "wynn",
];

/** País padrão do elenco sintético, pela região do time. */
const REGION_COUNTRY: Record<string, string> = {
  CBLOL: "BR",
  BR: "BR",
  LCS: "US",
  LEC: "EU",
  LCK: "KR",
  LPL: "CN",
  LCP: "TW",
};

/** Gera um elenco de 5 titulares determinístico a partir do nome do time. */
export function synthesizeRoster(team: Team): Player[] {
  const roles: PlayerRole[] = ["top", "jungle", "mid", "adc", "support"];
  const country = REGION_COUNTRY[(team.region ?? "").trim().toUpperCase()];
  return roles.map((role) => {
    const h = hashStr(`${team.name}:${role}`);
    const ign = `${NICK_PREFIX[h % NICK_PREFIX.length]}${NICK_SUFFIX[(h >>> 5) % NICK_SUFFIX.length]}`;
    return {
      id: playerId(ign, role),
      ign,
      role,
      country,
      age: ageForIgn(ign),
      attrs: attrsFromIdentity(ign, role),
    };
  });
}

/**
 * Detecta se um elenco é genérico / sintético (Kaedus, Zirvek, etc.)
 * ou se é de um time real mas com jogadores fictícios.
 */
export function isGenericRoster(roster?: Player[], teamName?: string, teamTag?: string): boolean {
  if (!roster || roster.length === 0) return true;
  const prefixes = [
    "kae", "zir", "nox", "vex", "ari", "bol", "cyra", "drex", "eko",
    "fenris", "gor", "hex", "iri", "jax", "kron", "luxor", "mir", "nix",
    "oru", "pyx", "quill", "rax", "syn", "tor", "ulf", "vyn", "wex", "xar", "yor", "zan"
  ];
  const genericCount = roster.filter((p) => {
    const low = p.ign.toLowerCase().trim();
    return prefixes.some((pre) => low.startsWith(pre) && low.length > pre.length);
  }).length;
  if (genericCount >= 2) return true;

  if (teamName) {
    const real = findRealTeam(teamName, teamTag);
    if (real && real.players.length > 0) {
      const realIgns = new Set(real.players.map((p) => p.ign.toLowerCase().trim()));
      const matchCount = roster.filter((p) => realIgns.has(p.ign.toLowerCase().trim())).length;
      if (matchCount === 0) return true;
    }
  }
  return false;
}

/**
 * Elenco DERIVADO de um time — IGNORA `team.roster`: monta do banco real
 * (nome casa → elenco verdadeiro da Liquipedia); senão da escalação textual
 * legada (players: string[]); e no fim gera um sintético determinístico.
 */
export function deriveRoster(team: Team): Player[] | undefined {
  const real = findRealTeam(team.name, team.tag);
  if (real) return real.players.map(playerFromScout);
  if (team.players && team.players.length > 0) {
    return team.players.slice(0, 5).map((ign) => {
      const h = hashStr(`legacy:${ign}`);
      const role: PlayerRole = (["top", "jungle", "mid", "adc", "support"] as const)[h % 5];
      return {
        id: playerId(ign, role),
        ign,
        role,
        age: ageForIgn(ign),
        attrs: attrsFromIdentity(ign, role),
      };
    });
  }
  return team.name.trim() ? synthesizeRoster(team) : undefined;
}

/**
 * Elenco de um time: usa `roster` se existir e não for genérico;
 * senão deriva do banco oficial real. Nenhum time real fica com elenco genérico.
 */
export function ensureRoster(team: Team): Player[] | undefined {
  if (team.roster && team.roster.length > 0 && !isGenericRoster(team.roster, team.name, team.tag)) {
    return team.roster;
  }
  return deriveRoster(team);
}

/** Igualdade de jogador IGNORANDO o id (ids são regenerados na derivação). */
function samePlayerContent(a: Player, b: Player): boolean {
  return (
    a.ign === b.ign &&
    a.role === b.role &&
    (a.country ?? "") === (b.country ?? "") &&
    (a.age ?? 0) === (b.age ?? 0) &&
    a.attrs.mechanics === b.attrs.mechanics &&
    a.attrs.gameIq === b.attrs.gameIq &&
    a.attrs.clutch === b.attrs.clutch &&
    (a.attrs.consistency ?? 0) === (b.attrs.consistency ?? 0) &&
    (a.attrs.aggression ?? 0) === (b.attrs.aggression ?? 0) &&
    (a.attrs.adaptability ?? 0) === (b.attrs.adaptability ?? 0) &&
    (a.attrs.intlExperience ?? 0) === (b.attrs.intlExperience ?? 0) &&
    (a.attrs.mentality ?? 0) === (b.attrs.mentality ?? 0) &&
    !!a.sub === !!b.sub &&
    !!a.custom === !!b.custom &&
    (a.real ?? "") === (b.real ?? "")
  );
}

/**
 * Remove o `roster` de um time se (e só se) ele for idêntico ao que a
 * derivação produziria — nunca foi editado, nunca evoluiu e não tem delta
 * pendente (delta muda attrs → não casa → o elenco fica). Usado SÓ na
 * serialização (store.tsx): o estado em memória mantém o elenco inteiro e o
 * load() regenera o que foi podado, então UI e deltas continuam vendo os
 * mesmos jogadores. Economiza ~1KB por time salvo — dezenas de campeonatos
 * viram megabytes.
 */
/** Cache de serialização de elencos podados (evita re-derivação redundante a cada render). */
const stripCache = new WeakMap<Team, Team>();

export function stripDerivedRoster(team: Team): Team {
  if (!team.roster || team.roster.length === 0) return team;
  const cached = stripCache.get(team);
  if (cached) return cached;

  const derived = deriveRoster(team);
  if (!derived || derived.length !== team.roster.length) {
    stripCache.set(team, team);
    return team;
  }
  if (!team.roster.every((p, i) => samePlayerContent(p, derived[i]))) {
    stripCache.set(team, team);
    return team;
  }
  const rest = { ...team };
  delete rest.roster;
  stripCache.set(team, rest);
  return rest;
}

// ---------------------------------------------------------------------------
// Curvas de idade — mecânica tem pico jovem e cai depois; IQ cresce e segura.
// ---------------------------------------------------------------------------

export function mechanicsAgeMultiplier(age?: number): number {
  if (age == null) return 1;
  if (age <= 19) return 0.94;
  if (age <= 21) return 0.98;
  if (age <= 24) return 1;
  if (age === 25) return 0.97;
  if (age === 26) return 0.93;
  if (age === 27) return 0.88;
  return 0.82;
}

export function iqAgeMultiplier(age?: number): number {
  if (age == null) return 1;
  if (age <= 20) return 0.93;
  if (age <= 23) return 0.97;
  if (age <= 27) return 1;
  return 1; // veterano segura o jogo mesmo com a mão mais lenta
}

/** Overall efetivo de um jogador (curvas de idade e todos os 8 atributos ponderados). */
export function playerOverall(p: Player): number {
  const res = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
  const m = res.mechanics * mechanicsAgeMultiplier(p.age);
  const i = res.gameIq * iqAgeMultiplier(p.age);
  return clampAttr(
    0.30 * m +
    0.25 * i +
    0.15 * res.clutch +
    0.10 * res.consistency +
    0.10 * res.mentality +
    0.10 * res.adaptability
  );
}

/** Médias dos 8 atributos dos titulares de um elenco. */
export function rosterAverageAttrs(roster: Player[] | undefined): Required<PlayerAttrs> {
  if (!roster || roster.length === 0) {
    return {
      mechanics: 65,
      gameIq: 65,
      clutch: 65,
      consistency: 65,
      aggression: 65,
      adaptability: 65,
      intlExperience: 20,
      mentality: 65,
    };
  }
  const starters = pickStarters(roster);
  const pool = starters.length > 0 ? starters : roster;
  const sums = pool.reduce(
    (acc, p) => {
      const res = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
      return {
        mechanics: acc.mechanics + res.mechanics,
        gameIq: acc.gameIq + res.gameIq,
        clutch: acc.clutch + res.clutch,
        consistency: acc.consistency + res.consistency,
        aggression: acc.aggression + res.aggression,
        adaptability: acc.adaptability + res.adaptability,
        intlExperience: acc.intlExperience + res.intlExperience,
        mentality: acc.mentality + res.mentality,
      };
    },
    {
      mechanics: 0,
      gameIq: 0,
      clutch: 0,
      consistency: 0,
      aggression: 0,
      adaptability: 0,
      intlExperience: 0,
      mentality: 0,
    },
  );
  const len = pool.length;
  return {
    mechanics: Math.round(sums.mechanics / len),
    gameIq: Math.round(sums.gameIq / len),
    clutch: Math.round(sums.clutch / len),
    consistency: Math.round(sums.consistency / len),
    aggression: Math.round(sums.aggression / len),
    adaptability: Math.round(sums.adaptability / len),
    intlExperience: Math.round(sums.intlExperience / len),
    mentality: Math.round(sums.mentality / len),
  };
}

/** Um titular por função: o MELHOR entre os não-subs (empate → o primeiro). */
export function pickStarters(roster: Player[]): Player[] {
  const order: PlayerRole[] = ["top", "jungle", "mid", "adc", "support"];
  const starters: Player[] = [];
  for (const role of order) {
    const pool = roster.filter((p) => p.role === role);
    const notSub = pool.filter((p) => !p.sub);
    const pick =
      notSub.length > 0
        ? notSub.reduce((best, p) => (playerOverall(p) > playerOverall(best) ? p : best))
        : pool[0];
    if (pick) starters.push(pick);
  }
  return starters;
}

/**
 * Força bruta do elenco (0–100): média dos titulares com ajuste de idade.
 * Elenco remontado com nota alta derruba/joga o time na hora.
 */
export function rosterStrength(roster: Player[] | undefined): number | null {
  if (!roster || roster.length === 0) return null;
  const starters = pickStarters(roster);
  const pool = starters.length > 0 ? starters : roster;
  const total = pool.reduce((sum, p) => sum + playerOverall(p), 0);
  return clampAttr(total / pool.length);
}

/**
 * Bônus de estrela: um craque no elenco (nota bruta alta — o jovem de 95
 * ainda é craque mesmo com a curva de idade puxando o overall pra baixo)
 * muda o patamar do time.
 */
function starBonus(roster: Player[]): number {
  const starters = pickStarters(roster);
  if (starters.length === 0) return 0;
  const best = Math.max(
    ...starters.map((p) => (p.attrs.mechanics + p.attrs.gameIq + p.attrs.clutch) / 3),
  );
  if (best >= 93) return 4;
  if (best >= 88) return 2;
  return 0;
}

/**
 * Rating EFETIVO usado na win probability: mistura a história (ELO da
 * carreira — ancoragem) com o elenco AGORA (força dos titulares + sinergia +
 * cultura). Elenco pesa mais que a história: quem monta time com nota alta
 * sobe na hora; quem perde os craques cai.
 */
export function effectiveRating(
  ledgerRating: number | undefined,
  roster: Player[] | undefined,
  synergy = 0,
  culture = 50,
): number {
  const base = ledgerRating ?? 50;
  const strength = rosterStrength(roster);
  const synergyPart = Math.max(0, Math.min(50, synergy)) * 0.06; // +3 máx
  const culturePart = (Math.max(0, Math.min(100, culture)) - 50) * 0.1; // ±5
  if (strength === null) return clampAttr(base + culturePart, 15, 95);
  const star = roster ? starBonus(roster) : 0;
  return clampAttr(base * 0.3 + strength * 0.65 + star + synergyPart + culturePart, 15, 95);
}

// ---------------------------------------------------------------------------
// Evolução entre splits (recesso): envelhece, desenvolve jovens, desgasta
// veteranos, ajusta sinergia e cultura. Determinística (hash do id + split).
// ---------------------------------------------------------------------------

export interface OffseasonContext {
  /** Rótulo do split novo (ex: "2026 Split 2") — alimenta o hash. */
  splitLabel: string;
  /** Campanha da temporada que acabou (0–1; null = sem dados). */
  winRate?: number | null;
  /** Time campeão da temporada. */
  champion?: boolean;
  /** Time caiu/rebaixado (Série B). */
  relegated?: boolean;
  /** Região do time (para gerar novatos da base com nacionalidade coerente). */
  region?: string;
  /** Nomes já em uso na liga (evita duplicar IGN de novatos). */
  usedIgns?: Set<string>;
  /** Permite aposentadoria nesta transição (padrão: true). */
  allowRetirement?: boolean;
}

export interface RetiredPlayerSummary {
  player: Player;
  age: number;
  finalOverall: number;
  replacedByIgn?: string;
  replacementKind?: "sub" | "rookie";
}

const ROOKIE_IGN_POOL: Record<string, string[]> = {
  KR: ["Haru", "Kael", "Siwoo", "Calix", "Zinnie", "Duro", "Hype", "Peyz", "Lucid", "Berserker", "Raptor", "Jiwoo", "Sponge", "Paduck", "Pollu", "Roamer"],
  CN: ["Milkyway", "JiaQi", "Creme", "Sheer", "1xn", "Vampire", "Feather", "tangyuan", "Heng", "Assum", "xiaolaohu", "Kepler", "naiyou", "Leave", "Starry"],
  BR: ["Tatu", "Guigo", "Makes", "Curty", "Grevthar", "Marvin", "Kaze", "Ayu", "scary", "ProDelta", "Wos", "Fuuu", "Frosty", "Sting", "Yampi"],
  EU: ["SkewMond", "Caliste", "Vladi", "Parus", "Myrwn", "Alvaro", "Supa", "Naak Nako", "Jackies", "Luon", "Isma", "Zoelys", "Thayger", "Oscarinin"],
  NA: ["Sniper", "Yeon", "APA", "Massu", "Busio", "Meech", "DarkWings", "Cryogen", "Srtty", "Exyu", "Castle", "Sheiden", "Zeyzal"],
  APAC: ["Rest", "JunJia", "HongQ", "Doggo", "Kaiwing", "Taki", "Kati", "Eddie", "Aress", "Pun", "Lived", "Yutapon", "Evi"],
};

const ROOKIE_GENERIC_POOL = [
  "Kairo", "Nyx", "DravenX", "Vexel", "Soren", "Aether", "Koda", "Rivenge",
  "Lumen", "Zeph", "Kaizen", "Noctis", "Talin", "Valkyr", "Orin", "Jinxed",
];

function countryForRegion(regionRaw?: string, fallbackCountry?: string): string {
  const r = (regionRaw ?? "").trim().toUpperCase();
  if (r.includes("LCK") || r === "KR") return "KR";
  if (r.includes("LPL") || r === "CN") return "CN";
  if (r.includes("CBLOL") || r === "BR") return "BR";
  if (r.includes("LEC") || r === "EU") return "EU";
  if (r.includes("LCS") || r === "NA") return "US";
  if (r.includes("LCP") || r.includes("PCS") || r === "APAC") return "TW";
  return fallbackCountry || "BR";
}

function rookiePoolKey(country: string): string {
  const c = country.toUpperCase();
  if (c === "KR") return "KR";
  if (c === "CN") return "CN";
  if (c === "BR") return "BR";
  if (["US", "CA"].includes(c)) return "NA";
  if (["TW", "HK", "VN", "JP", "SG", "PH", "TH"].includes(c)) return "APAC";
  return "EU";
}

/**
 * Gera um jovem talento da base (17–20 anos) para substituir um jogador aposentado.
 */
export function generateAcademyRookie(params: {
  role: PlayerRole;
  region?: string;
  fallbackCountry?: string;
  seedKey: string;
  baseOverall?: number;
  usedIgns?: Set<string>;
}): Player {
  const country = countryForRegion(params.region, params.fallbackCountry);
  const poolKey = rookiePoolKey(country);
  const candidates = [...(ROOKIE_IGN_POOL[poolKey] ?? []), ...ROOKIE_GENERIC_POOL];
  const h = hashStr(`rookie:${params.seedKey}:${params.role}`);

  let chosenIgn = "";
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[(h + i) % candidates.length];
    if (!params.usedIgns || !params.usedIgns.has(candidate.toLowerCase())) {
      chosenIgn = candidate;
      break;
    }
  }
  if (!chosenIgn) {
    const base = candidates[h % candidates.length];
    let suffix = 2;
    while (params.usedIgns?.has(`${base}${suffix}`.toLowerCase())) suffix++;
    chosenIgn = `${base}${suffix}`;
  }
  params.usedIgns?.add(chosenIgn.toLowerCase());

  const age = 17 + (h % 4); // 17 a 20 anos
  const regionFloor = poolKey === "KR" || poolKey === "CN" ? 72 : poolKey === "EU" || poolKey === "NA" ? 68 : 65;
  const targetOvr = clampAttr(
    Math.round((params.baseOverall ?? regionFloor) - 3 + (h % 8)),
    regionFloor - 2,
    80,
  );

  const rookie = makeCustomPlayer({
    ign: chosenIgn,
    role: params.role,
    overall: targetOvr,
    age,
    country,
    sub: false,
  });
  return {
    ...rookie,
    id: playerId(`${chosenIgn}_${params.seedKey}`, params.role),
    custom: false,
  };
}

/**
 * Probabilidade (0–100) de aposentadoria ao atingir `nextAge` no fim do split.
 * Garante renovação natural: jogadores de 30+ têm chance crescente e 34+ é compulsório.
 */
export function retirementChanceForPlayer(
  player: Player,
  nextAge: number,
  ctx: Pick<OffseasonContext, "champion" | "relegated">,
): number {
  if (nextAge < 28) return 0;
  if (nextAge >= 34) return 100;

  let base = 0;
  if (nextAge === 28) base = 6;
  else if (nextAge === 29) base = 14;
  else if (nextAge === 30) base = 28;
  else if (nextAge === 31) base = 46;
  else if (nextAge === 32) base = 66;
  else if (nextAge === 33) base = 84;

  const ovr = Math.round(playerOverall(player));
  if (ovr < 72) base += 12;
  else if (ovr >= 84) base -= 12;

  if (player.sub) base += 10;
  if (ctx.champion) base -= 8;
  if (ctx.relegated) base += 10;

  return Math.max(0, Math.min(100, base));
}

export function shouldPlayerRetire(
  player: Player,
  nextAge: number,
  ctx: Pick<OffseasonContext, "splitLabel" | "champion" | "relegated">,
): boolean {
  const chance = retirementChanceForPlayer(player, nextAge, ctx);
  if (chance <= 0) return false;
  if (chance >= 100) return true;
  const roll = hashStr(`retire:${player.id}:${ctx.splitLabel}`) % 100;
  return roll < chance;
}

/**
 * Evolui UM elenco para o split seguinte. Retorna o elenco novo + o que
 * aconteceu (pra narrativa) + aposentadorias processadas (com promoção de
 * reserva ou revelação da base para nunca deixar o time desfalcado).
 */
export function evolveRoster(
  roster: Player[],
  ctx: OffseasonContext,
): { roster: Player[]; notes: string[]; retired: RetiredPlayerSummary[] } {
  const notes: string[] = [];
  const retired: RetiredPlayerSummary[] = [];
  const allowRetirement = ctx.allowRetirement !== false;

  const evolvedAll = roster.map((p, idx) => {
    const seed = hashStr(`${p.id}:${ctx.splitLabel}`);
    const age = (p.age ?? ageForIgn(p.ign)) + 1;
    const cur = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
    let { mechanics, gameIq, clutch, consistency, aggression, adaptability, intlExperience, mentality } = cur;

    if (age >= 26) {
      const decay = age >= 29 ? 4 : age === 28 ? 3 : 2;
      mechanics -= decay;
      if (mechanics < 35) mechanics = 35;
      consistency = Math.min(98, consistency + 1);
      mentality = Math.min(98, mentality + 1);
    } else if (age <= 21) {
      mechanics += 1 + (seed % 2); // +1..+2 de desenvolvimento
      aggression = Math.min(98, aggression + 1);
    }
    if (age <= 27 && age >= 20) {
      gameIq += 1 + ((seed >> 3) % 2);
      adaptability = Math.min(98, adaptability + 1);
    }

    // Campanha conta: campeão confia (clutch e mentalidade sobem), rebaixado afunda.
    if (ctx.champion) {
      clutch += 2;
      mentality += 2;
      consistency += 1;
    } else if (ctx.relegated) {
      clutch -= 3;
      mentality -= 3;
    } else if (ctx.winRate != null) {
      if (ctx.winRate >= 0.65) {
        clutch += 1;
        mentality += 1;
      } else if (ctx.winRate <= 0.3) {
        clutch -= 1;
        mentality -= 1;
      }
    }

    const evolved: Player = {
      ...p,
      age,
      attrs: {
        mechanics: Math.round(clampAttr(mechanics)),
        gameIq: Math.round(clampAttr(gameIq)),
        clutch: Math.round(clampAttr(clutch)),
        consistency: Math.round(clampAttr(consistency)),
        aggression: Math.round(clampAttr(aggression)),
        adaptability: Math.round(clampAttr(adaptability)),
        intlExperience: Math.round(clampAttr(intlExperience)),
        mentality: Math.round(clampAttr(mentality)),
      },
    };

    const overallBefore = Math.round(playerOverall(p));
    const overallAfter = Math.round(playerOverall(evolved));
    const retiring = allowRetirement && shouldPlayerRetire(evolved, age, ctx);

    if (!retiring) {
      if (overallAfter - overallBefore >= 3)
        notes.push(`${p.ign} evoluiu ${overallBefore}→${overallAfter}`);
      if (overallBefore - overallAfter >= 3)
        notes.push(`${p.ign} despencou ${overallBefore}→${overallAfter}`);
      if (age >= 30 && (p.age ?? 0) < 30)
        notes.push(`${p.ign} completou 30 — reta final da carreira`);
    }

    void idx;
    return { evolved, retiring, overallAfter, age };
  });

  const activeRoster: Player[] = evolvedAll.filter((x) => !x.retiring).map((x) => x.evolved);
  const retiringList = evolvedAll.filter((x) => x.retiring);

  // Garante que nenhuma função titular fique vazia após aposentadorias
  for (const r of retiringList) {
    const p = r.evolved;
    let replacedByIgn: string | undefined;
    let replacementKind: "sub" | "rookie" | undefined;

    if (!p.sub) {
      const hasActiveStarterInRole = activeRoster.some((a) => !a.sub && a.role === p.role);
      if (!hasActiveStarterInRole) {
        const subIdx = activeRoster.findIndex((a) => a.sub && a.role === p.role);
        if (subIdx >= 0) {
          activeRoster[subIdx] = { ...activeRoster[subIdx], sub: false };
          replacedByIgn = activeRoster[subIdx].ign;
          replacementKind = "sub";
        } else {
          const rookie = generateAcademyRookie({
            role: p.role,
            region: ctx.region,
            fallbackCountry: p.country,
            seedKey: `${ctx.splitLabel}:${p.id}`,
            baseOverall: r.overallAfter,
            usedIgns: ctx.usedIgns,
          });
          activeRoster.push(rookie);
          replacedByIgn = rookie.ign;
          replacementKind = "rookie";
        }
      }
    }

    retired.push({
      player: p,
      age: r.age,
      finalOverall: r.overallAfter,
      replacedByIgn,
      replacementKind,
    });

    const repText =
      replacementKind === "sub"
        ? ` (${replacedByIgn} assumiu a titularidade)`
        : replacementKind === "rookie"
          ? ` (base promoveu ${replacedByIgn}, ${activeRoster[activeRoster.length - 1]?.age ?? 18}a)`
          : "";
    notes.push(`${p.ign} (${r.age} anos) se aposentou${repText}`);
  }

  return { roster: activeRoster, notes, retired };
}

/** Recesso de sinergia: elenco mantido junta mais química (+10/split, teto 50);
 *  elenco remontado (edição manual) zera — a química é do grupo, não do nome. */
export function synergyForNewSplit(synergy: number | undefined, rosterKept: boolean): number {
  if (!rosterKept) return 0;
  return Math.min(50, (synergy ?? 0) + 10);
}

/** Cultura pós-temporada: campeão fortalece, rebaixamento corrói. */
export function updateCulture(culture: number | undefined, ctx: OffseasonContext): number {
  const base = culture ?? 50;
  let delta = 0;
  if (ctx.champion) delta += 6;
  if (ctx.relegated) delta -= 8;
  if (ctx.winRate != null) delta += (ctx.winRate - 0.5) * 10; // ±5
  return Math.round(clampAttr(base + delta, 5, 100));
}

// ---------------------------------------------------------------------------
// Evolução DENTRO da temporada (por partida de playoff/internacional)
// ---------------------------------------------------------------------------

export function matchPlayerDeltas(params: {
  winnerRoster: Player[] | undefined;
  loserRoster: Player[] | undefined;
  isPlayoff: boolean;
  isIntl?: boolean;
  isFinal?: boolean;
}): Record<string, Partial<PlayerAttrs>> {
  const { winnerRoster, loserRoster, isPlayoff, isIntl, isFinal } = params;
  const deltas: Record<string, Partial<PlayerAttrs>> = {};

  const winnerStarters = pickStarters(winnerRoster ?? []);
  const loserStarters = pickStarters(loserRoster ?? []);

  const avgIntlExp = (starters: Player[]): number => {
    if (starters.length === 0) return 0;
    const sum = starters.reduce(
      (acc, p) => acc + getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age).intlExperience,
      0,
    );
    return sum / starters.length;
  };

  const addDelta = (id: string, patch: Partial<PlayerAttrs>) => {
    const cur = deltas[id] ?? {};
    const next: Partial<PlayerAttrs> = { ...cur };
    for (const [k, v] of Object.entries(patch) as [keyof PlayerAttrs, number | undefined][]) {
      if (v) next[k] = (next[k] ?? 0) + v;
    }
    if (Object.keys(next).length > 0) deltas[id] = next;
  };

  if (isPlayoff || isIntl) {
    for (const p of winnerStarters) {
      const d: Partial<PlayerAttrs> = { clutch: 1 };
      if ((p.age ?? 22) <= 21) d.mechanics = 1;
      if (isIntl) {
        d.intlExperience = 2;
        d.mentality = 1;
      }
      if (isFinal) {
        d.clutch = (d.clutch ?? 0) + 1;
        d.mentality = (d.mentality ?? 0) + 1;
      }
      addDelta(p.id, d);
    }
    for (const p of loserStarters) {
      const d: Partial<PlayerAttrs> = { clutch: -1 };
      if (isIntl) {
        d.intlExperience = 1;
        if (isFinal) d.mentality = -1;
      }
      addDelta(p.id, d);
    }
  }

  // Evolução na liga local ao enfrentar times experientes que voltaram bem do internacional:
  // quem joga contra (ou vence) um elenco com alta experiência internacional absorve ritmo e macro.
  if (!isIntl && winnerStarters.length > 0 && loserStarters.length > 0) {
    const winnerIntl = avgIntlExp(winnerStarters);
    const loserIntl = avgIntlExp(loserStarters);

    if (loserIntl >= 58 && loserIntl - winnerIntl >= 10) {
      for (const p of winnerStarters) {
        const pIntl = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age).intlExperience;
        if (pIntl < loserIntl) {
          addDelta(p.id, { intlExperience: 1, gameIq: 1 });
        }
      }
    }

    if (winnerIntl >= 60 && winnerIntl - loserIntl >= 15) {
      for (const p of loserStarters) {
        const pIntl = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age).intlExperience;
        if (pIntl < winnerIntl - 10) {
          addDelta(p.id, { intlExperience: 1 });
        }
      }
    }
  }

  return deltas;
}

/** Aplica deltas de jogadores num elenco (usado por setMatchResult). */
export function applyPlayerDeltas(
  roster: Player[] | undefined,
  deltas: Record<string, Partial<PlayerAttrs>> | undefined,
): Player[] | undefined {
  if (!roster || !deltas || Object.keys(deltas).length === 0) return roster;
  return roster.map((p) => {
    const d = deltas[p.id];
    if (!d) return p;
    return {
      ...p,
      attrs: {
        mechanics: Math.round(clampAttr(p.attrs.mechanics + (d.mechanics ?? 0))),
        gameIq: Math.round(clampAttr(p.attrs.gameIq + (d.gameIq ?? 0))),
        clutch: Math.round(clampAttr(p.attrs.clutch + (d.clutch ?? 0))),
        consistency: p.attrs.consistency !== undefined || d.consistency ? Math.round(clampAttr((p.attrs.consistency ?? 60) + (d.consistency ?? 0))) : undefined,
        aggression: p.attrs.aggression !== undefined || d.aggression ? Math.round(clampAttr((p.attrs.aggression ?? 60) + (d.aggression ?? 0))) : undefined,
        adaptability: p.attrs.adaptability !== undefined || d.adaptability ? Math.round(clampAttr((p.attrs.adaptability ?? 60) + (d.adaptability ?? 0))) : undefined,
        intlExperience: p.attrs.intlExperience !== undefined || d.intlExperience ? Math.round(clampAttr((p.attrs.intlExperience ?? 20) + (d.intlExperience ?? 0))) : undefined,
        mentality: p.attrs.mentality !== undefined || d.mentality ? Math.round(clampAttr((p.attrs.mentality ?? 60) + (d.mentality ?? 0))) : undefined,
      },
    };
  });
}

/** Reverte deltas de jogadores (limpar placar desfaz a evolução da partida). */
export function revertPlayerDeltas(
  roster: Player[] | undefined,
  deltas: Record<string, Partial<PlayerAttrs>> | undefined,
): Player[] | undefined {
  if (!roster || !deltas) return roster;
  const inverse: Record<string, Partial<PlayerAttrs>> = {};
  for (const [id, d] of Object.entries(deltas)) {
    inverse[id] = {
      mechanics: -(d.mechanics ?? 0),
      gameIq: -(d.gameIq ?? 0),
      clutch: -(d.clutch ?? 0),
      consistency: -(d.consistency ?? 0),
      aggression: -(d.aggression ?? 0),
      adaptability: -(d.adaptability ?? 0),
      intlExperience: -(d.intlExperience ?? 0),
      mentality: -(d.mentality ?? 0),
    };
  }
  return applyPlayerDeltas(roster, inverse);
}
