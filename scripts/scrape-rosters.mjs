/**
 * Scrape de elencos reais do Leaguepedia (lol.fandom.com) -> src/lib/lol/real-rosters.ts
 *
 * Roda UMA vez na mão (build-time seed). Nunca em runtime (CORS/rate-limit/offline).
 *   node scripts/scrape-rosters.mjs
 *
 * Fontes por liga (paginas de temporada 2026 que contem os rosters):
 *  - Formato TeamRoster:    {{TeamRoster|team=X}} + {{TeamRoster/Line|player=Y|flag=zz|role=t}}
 *      roles: t=top, j=jungle, m=mid, b|a=adc(bot), s=support, c|coach=staff
 *  - Formato ExtendedRoster (LCK): ==={{team|X}}=== + {{ExtendedRoster/Line|player=Y|role1=Top}}
 *      roles1: Top/Jungle/Mid/Bot/Support
 *
 * Throttle: sequencial com delay fixo (Fandom limita ~30 req/min para anon).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://lol.fandom.com/api.php";
const DELAY_MS = 2500;
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/lol/real-rosters.ts",
);

/** Candidatos em ordem de preferencia (mais atual primeiro). */
const LEAGUE_PAGES = {
  CBLOL: ["CBLOL/2026 Season/Split 2", "CBLOL/2026 Season/Split 1"],
  LCK: ["LCK/2026 Season/Rounds 3-4/Team Rosters", "LCK/2026 Season/Season Playoffs/Team Rosters"],
  LPL: ["LPL/2026 Season/Split 2", "LPL/2026 Season/Split 1", "LPL/2026 Season/Summer"],
  LEC: ["LEC/2026 Season/Summer Season", "LEC/2026 Season/Spring Season", "LEC/2026 Season/Winter Season"],
  LCS: ["LCS/2026 Season/Spring Season", "LTA North/2026 Season/Spring Season"],
  LCP: ["LCP/2026 Season/Split 2", "LCP/2026 Season/Split 1"],
};

const ROLE_MAP = { t: "top", j: "jungle", m: "mid", b: "adc", a: "adc", s: "support" };
const EXT_ROLE_MAP = { top: "top", jungle: "jungle", mid: "mid", bot: "adc", adc: "adc", support: "support" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, attempt = 0) {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await fetch(`${API}?${qs}`, {
    headers: { "User-Agent": "esports-bracket-builder seed script (build-time)" },
  });
  if (res.status === 429 && attempt < 3) {
    await sleep(DELAY_MS * 2 ** (attempt + 1));
    return api(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const countryOf = (flag) => {
  if (!flag) return "";
  const f = flag.trim().toLowerCase();
  if (f === "south korea") return "KR";
  if (f === "china") return "CN";
  return flag.trim().toUpperCase().slice(0, 2);
};

function extractPlayer(params) {
  if (!params.player) return null;
  const pm = params.player.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    ign: (pm ? pm[1] : params.player).trim(),
    real: pm ? pm[2].trim() : null,
    country: countryOf(params.flag),
    sub: /sub/i.test(params.position || ""),
  };
}

function parseParams(raw) {
  const params = {};
  for (const part of raw.split("|")) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  return params;
}

/** Formato TeamRoster (CBLOL, LPL, LEC, LCS, LCP). */
function parseTeamRosterFormat(wikitext) {
  const teams = [];
  const blockRe = /\{\{TeamRoster\|team=([\s\S]*?)\n\}\}/g;
  let bm;
  while ((bm = blockRe.exec(wikitext)) !== null) {
    const block = bm[1];
    const name = (block.match(/^([^|}]+)/) || [])[1]?.trim();
    if (!name) continue;
    const players = [];
    const lineRe = /\{\{TeamRoster\/Line\|([^}]*)\}\}/g;
    let lm;
    while ((lm = lineRe.exec(block)) !== null) {
      const params = parseParams(lm[1]);
      const player = extractPlayer(params);
      if (!player) continue;
      // role pode ter multiplas opcoes ("coach,j") — pega a primeira que for posicao
      const roles = (params.role || "").toLowerCase().split(",").map((r) => r.trim());
      const role = roles.find((r) => ROLE_MAP[r]);
      if (!role) continue; // staff puro fica de fora
      players.push({ ...player, role: ROLE_MAP[role] });
    }
    if (players.length >= 5) teams.push({ name, players });
  }
  return teams;
}

/** Formato ExtendedRoster (LCK). */
function parseExtendedRosterFormat(wikitext) {
  const teams = [];
  const blockRe = /===\s*\{\{team\|([^}]+)\}\}\s*===([\s\S]*?)(?====\s*\{\{team\||$)/g;
  let bm;
  while ((bm = blockRe.exec(wikitext)) !== null) {
    const name = bm[1].trim();
    const block = bm[2];
    const players = [];
    const lineRe = /\{\{ExtendedRoster\/Line\|([\s\S]*?)\}\}/g;
    let lm;
    while ((lm = lineRe.exec(block)) !== null) {
      const params = parseParams(lm[1]);
      const player = extractPlayer(params);
      if (!player) continue;
      const roles = Object.keys(params)
        .filter((k) => /^role\d+$/.test(k))
        .map((k) => EXT_ROLE_MAP[params[k].toLowerCase().trim()])
        .filter(Boolean);
      if (!roles[0]) continue;
      players.push({ ...player, role: roles[0] });
    }
    if (players.length >= 5) teams.push({ name, players });
  }
  return teams;
}

function detectFormat(wikitext) {
  return /\{\{ExtendedRoster\|/.test(wikitext) ? "extended" : "teamroster";
}

async function scrapeLeague(pages) {
  const errors = [];
  for (const page of pages) {
    try {
      const parsed = await api({ action: "parse", page, prop: "wikitext" });
      const wt = parsed.parse?.wikitext ?? "";
      const teams = detectFormat(wt) === "extended" ? parseExtendedRosterFormat(wt) : parseTeamRosterFormat(wt);
      if (teams.length >= 3) return { page, teams };
      errors.push(`${page}: so ${teams.length} times`);
    } catch (e) {
      errors.push(`${page}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  return { page: null, teams: [], errors };
}

const generated = {};
const meta = {};
const failures = [];

for (const [league, pages] of Object.entries(LEAGUE_PAGES)) {
  process.stdout.write(`scrape ${league} ... `);
  const { page, teams, errors } = await scrapeLeague(pages);
  if (teams.length > 0) {
    generated[league] = teams;
    meta[league] = page;
    console.log(`${teams.length} times (${page})`);
  } else {
    failures.push(`${league}: ${(errors || []).join(" | ")}`);
    console.log("FALHOU");
  }
  await sleep(DELAY_MS);
}

if (Object.keys(generated).length === 0) {
  console.error("nenhuma liga scrapeada:", failures);
  process.exit(1);
}

const ts = `// AUTO-GERADO POR scripts/scrape-rosters.mjs — NAO EDITAR NA MAO.
// Fonte: https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki (paginas de temporada 2026).
// Regenerar: node scripts/scrape-rosters.mjs

export interface ScoutedPlayer {
  ign: string;
  real: string | null;
  country: string;
  role: "top" | "jungle" | "mid" | "adc" | "support";
  sub: boolean;
}

export interface ScoutedTeam {
  name: string;
  players: ScoutedPlayer[];
}

/** ligas -> times -> elenco real (titulares + subs marcados com sub:true). */
export const REAL_ROSTERS: Record<string, ScoutedTeam[]> = ${JSON.stringify(generated, null, 2)};

/** pagina do wiki usada como fonte, por liga. */
export const REAL_ROSTER_SOURCES: Record<string, string> = ${JSON.stringify(meta, null, 2)};
`;

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, ts, "utf8");

const total = Object.values(generated).reduce((n, t) => n + t.length, 0);
const players = Object.values(generated).reduce(
  (n, t) => n + t.reduce((m, team) => m + team.players.length, 0),
  0,
);
console.log(`\nOK ${OUT_PATH}`);
console.log(`${Object.keys(generated).length} ligas / ${total} times / ${players} pessoas`);
if (failures.length) console.log("falhas:", failures);
