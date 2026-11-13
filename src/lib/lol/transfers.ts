import type { CareerLedger, Championship, GameId, Player, PlayerRole, Team, TransferNews } from "./types";
import { uid } from "./generate";
import { ensureRoster, getResolvedAttrs, pickStarters } from "./players";
import { getOfficialRegionRanking, normalizeRegion } from "./international";

// ---------------------------------------------------------------------------
// Sistema Financeiro e Teto Salarial (Economia de Esports)
// ---------------------------------------------------------------------------

export type FinancialTier = "superteam" | "rich" | "mid" | "budget";

/**
 * Retorna o tier financeiro da região no simulador.
 * As TOP 2 regiões no Ranking Regional Oficial do Hall da Fama são as regiões Major / Superteam!
 */
export function getRegionFinancialTier(
  regionRaw?: string,
  career?: CareerLedger,
  game: GameId = "lol",
): FinancialTier {
  const norm = normalizeRegion(regionRaw ?? "");
  const ranking = getOfficialRegionRanking(career, game);
  const entry = ranking.find((r) => r.region === norm);
  const rank = entry ? entry.rank : 99;

  if (rank <= 2) return "superteam"; // Top 2 do Ranking Regional = Major
  if (rank <= 4) return "rich";      // #3 e #4
  if (rank <= 6) return "mid";       // #5 e #6
  return "budget";
}

/** Teto orçamentário anual base da equipe (em milhares de dólares) */
export function getTeamBaseBudget(
  team: Team,
  regionRaw?: string,
  isChampion = false,
  isSerieB = false,
  career?: CareerLedger,
  game: GameId = "lol",
): number {
  if (team.budget && team.budget > 0) return team.budget;

  const tier = getRegionFinancialTier(team.region || regionRaw, career, game);
  let base = 1000;

  switch (tier) {
    case "superteam":
      base = 3200; // Top 2 do Ranking (Major): $3.2M base
      break;
    case "rich":
      base = 2200; // #3-#4: $2.2M base
      break;
    case "mid":
      base = 1100; // #5-#6: $1.1M base
      break;
    case "budget":
      base = 650;
      break;
  }

  // Grandes organizações históricas têm patrocínios maiores
  const normName = team.name.toLowerCase();
  const isGiant = /t1|gen\.g|g2|fnatic|cloud9|liquid|furia|loud|pain|edg|bilibili|wbg|jdg/i.test(
    normName,
  );
  if (isGiant) base += 500;

  // Bônus por título recente
  if (isChampion) base += 350;

  // Penalidade de 2ª divisão
  if (isSerieB) base = Math.round(base * 0.55);

  return base;
}

/**
 * Salário anual estimado de um jogador (em K dólares).
 * Jogadores vindos das 2 melhores regiões do ranking mundial possuem custo salarial muito maior
 * se contratados por ligas de escalões inferiores (taxa de importação, moradia, moeda forte).
 */
export function getPlayerSalary(
  player: Player,
  teamRegionRaw?: string,
  career?: CareerLedger,
  game: GameId = "lol",
): number {
  const attrs = getResolvedAttrs(player.attrs, player.ign, player.role, player.country, player.age);
  const overall = Math.round(
    attrs.mechanics * 0.35 +
      attrs.gameIq * 0.25 +
      attrs.clutch * 0.15 +
      attrs.mentality * 0.15 +
      attrs.intlExperience * 0.1,
  );

  let baseSalary = 60;
  if (overall >= 90) baseSalary = 500 + (overall - 90) * 35; // 500k - 800k
  else if (overall >= 84) baseSalary = 280 + (overall - 84) * 30; // 280k - 460k
  else if (overall >= 78) baseSalary = 160 + (overall - 78) * 18; // 160k - 260k
  else if (overall >= 70) baseSalary = 90 + (overall - 70) * 8; // 90k - 150k
  else baseSalary = 45 + Math.max(0, overall - 50) * 2; // 45k - 85k

  // Identifica dinamicamente quais são os países das 2 melhores regiões do ranking do save:
  const ranking = getOfficialRegionRanking(career, game);
  const top2Regions = ranking.filter((r) => r.isTop2).map((r) => r.region);

  const majorCountries = new Set<string>();
  for (const reg of top2Regions) {
    if (reg === "LCK") majorCountries.add("KR");
    else if (reg === "LPL") majorCountries.add("CN");
    else if (reg === "CBLOL") majorCountries.add("BR");
    else if (reg === "LEC") ["EU", "FR", "DE", "ES", "DK", "SE", "PL", "GB"].forEach((c) => majorCountries.add(c));
    else if (reg === "LCS") ["US", "CA"].forEach((c) => majorCountries.add(c));
    else if (reg === "LCP") ["TW", "HK", "VN", "SG", "PH"].forEach((c) => majorCountries.add(c));
  }

  const playerCountry = (player.country ?? "").toUpperCase();
  const teamRegNorm = normalizeRegion(teamRegionRaw ?? "");
  const isTeamInTop2 = top2Regions.includes(teamRegNorm);
  const isPlayerFromTop2 = majorCountries.has(playerCountry);

  if (isPlayerFromTop2 && !isTeamInTop2) {
    // Para um time de região que não está no Top 2, importar jogador de região elite custa 60% a mais!
    baseSalary = Math.round(baseSalary * 1.6);
  }

  return baseSalary;
}

/** País nativo correspondente à região */
export function getNativeCountryForRegion(regionRaw?: string): string {
  const r = (regionRaw ?? "").toUpperCase();
  if (["CBLOL", "BR"].includes(r)) return "BR";
  if (["LCK", "KR"].includes(r)) return "KR";
  if (["LPL", "CN"].includes(r)) return "CN";
  if (["LCS", "NA"].includes(r)) return "US";
  if (["LEC", "EU"].includes(r)) return "EU";
  if (["LCP", "PCS"].includes(r)) return "TW";
  return "BR";
}

/** Verifica se um jogador é considerado estrangeiro (import) naquela liga */
export function isPlayerImport(player: Player, teamRegionRaw?: string): boolean {
  const native = getNativeCountryForRegion(teamRegionRaw);
  const pCountry = (player.country ?? "").toUpperCase();
  if (!pCountry) return false;
  if (native === "US" && ["US", "CA"].includes(pCountry)) return false;
  if (native === "EU" && ["EU", "FR", "DE", "ES", "DK", "SE", "PL", "GB"].includes(pCountry))
    return false;
  if (native === "TW" && ["TW", "HK", "VN", "SG", "PH"].includes(pCountry)) return false;
  return pCountry !== native;
}

// ---------------------------------------------------------------------------
// Pool Global de Agentes Livres Reais (Separados por Região)
// ---------------------------------------------------------------------------

/** Nomes genéricos antigos que eram clonados entre várias ligas — removidos automaticamente na hidratação */
export const LEGACY_FICTIONAL_FREE_AGENTS = new Set([
  "zephyr",
  "predator",
  "horizon",
  "shadowaim",
  "colossus",
  "valkyrie",
  "titanclaw",
  "krypton",
  "vortex",
  "solari",
  "nightfall",
  "sparky",
  "bould",
  "raptor",
  "misty",
]);

export function isLegacyClonedPlayer(p: Player, teamName = ""): boolean {
  const norm = p.ign.trim().toLowerCase();
  if (LEGACY_FICTIONAL_FREE_AGENTS.has(norm)) return true;
  // O antigo pool tinha um "Aegis" fictício (Support, KR, 86 OVR) que entrava em todas as ligas;
  // o Aegis real é Jungler BR (RED Canids).
  if (norm === "aegis" && (p.role === "support" || p.country === "KR")) {
    return true;
  }
  return false;
}

export const GLOBAL_FREE_AGENT_POOL: Omit<Player, "id">[] = [
  // LCK / Coreia do Sul (Jogadores reais disponíveis no mercado)
  {
    ign: "Rascal",
    real: "Kim Kwang-hee",
    role: "top",
    country: "KR",
    age: 26,
    attrs: { mechanics: 79, gameIq: 81, clutch: 78, mentality: 80, intlExperience: 65 },
  },
  {
    ign: "Croco",
    real: "Kim Dong-beom",
    role: "jungle",
    country: "KR",
    age: 24,
    attrs: { mechanics: 80, gameIq: 79, clutch: 78, mentality: 77, intlExperience: 55 },
  },
  {
    ign: "Fate",
    real: "Yoo Su-hyeok",
    role: "mid",
    country: "KR",
    age: 24,
    attrs: { mechanics: 80, gameIq: 81, clutch: 77, mentality: 79, intlExperience: 50 },
  },
  {
    ign: "Teddy",
    real: "Park Jin-seong",
    role: "adc",
    country: "KR",
    age: 26,
    attrs: { mechanics: 82, gameIq: 81, clutch: 80, mentality: 82, intlExperience: 68 },
  },
  {
    ign: "Effort",
    real: "Lee Sang-ho",
    role: "support",
    country: "KR",
    age: 24,
    attrs: { mechanics: 77, gameIq: 80, clutch: 76, mentality: 78, intlExperience: 60 },
  },

  // LPL / China
  {
    ign: "Cube",
    real: "Dai Yi",
    role: "top",
    country: "CN",
    age: 22,
    attrs: { mechanics: 79, gameIq: 78, clutch: 77, mentality: 77, intlExperience: 45 },
  },
  {
    ign: "Meteor",
    real: "Zeng Guo-Hao",
    role: "jungle",
    country: "CN",
    age: 24,
    attrs: { mechanics: 80, gameIq: 80, clutch: 78, mentality: 79, intlExperience: 45 },
  },
  {
    ign: "Angel",
    real: "Xiang Tao",
    role: "mid",
    country: "CN",
    age: 24,
    attrs: { mechanics: 80, gameIq: 81, clutch: 79, mentality: 80, intlExperience: 68 },
  },
  {
    ign: "Lwx",
    real: "Lin Wei-Xiang",
    role: "adc",
    country: "CN",
    age: 26,
    attrs: { mechanics: 80, gameIq: 80, clutch: 81, mentality: 80, intlExperience: 75 },
  },
  {
    ign: "Mark",
    real: "Ling Xu",
    role: "support",
    country: "CN",
    age: 25,
    attrs: { mechanics: 78, gameIq: 81, clutch: 78, mentality: 79, intlExperience: 60 },
  },

  // LEC / Europa
  {
    ign: "Wunder",
    real: "Martin Hansen",
    role: "top",
    country: "EU",
    age: 26,
    attrs: { mechanics: 78, gameIq: 82, clutch: 80, mentality: 81, intlExperience: 78 },
  },
  {
    ign: "Markoon",
    real: "Mark van Woerkom",
    role: "jungle",
    country: "EU",
    age: 22,
    attrs: { mechanics: 78, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 40 },
  },
  {
    ign: "Abbedagge",
    real: "Felix Braun",
    role: "mid",
    country: "EU",
    age: 25,
    attrs: { mechanics: 78, gameIq: 79, clutch: 76, mentality: 77, intlExperience: 55 },
  },
  {
    ign: "Crownie",
    real: "Juš Marušič",
    role: "adc",
    country: "EU",
    age: 26,
    attrs: { mechanics: 79, gameIq: 79, clutch: 78, mentality: 78, intlExperience: 52 },
  },
  {
    ign: "Trymbi",
    real: "Adrian Trybus",
    role: "support",
    country: "EU",
    age: 24,
    attrs: { mechanics: 78, gameIq: 80, clutch: 78, mentality: 77, intlExperience: 62 },
  },

  // LCS / América do Norte
  {
    ign: "Licorice",
    real: "Eric Ritchie",
    role: "top",
    country: "US",
    age: 26,
    attrs: { mechanics: 77, gameIq: 80, clutch: 78, mentality: 80, intlExperience: 65 },
  },
  {
    ign: "Spica",
    real: "Mingyi Lu",
    role: "jungle",
    country: "US",
    age: 23,
    attrs: { mechanics: 78, gameIq: 78, clutch: 77, mentality: 77, intlExperience: 52 },
  },
  {
    ign: "Insanity",
    real: "David Challe",
    role: "mid",
    country: "US",
    age: 24,
    attrs: { mechanics: 76, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 35 },
  },
  {
    ign: "Zven",
    real: "Jesper Svenningsen",
    role: "adc",
    country: "US",
    age: 27,
    attrs: { mechanics: 79, gameIq: 82, clutch: 79, mentality: 81, intlExperience: 78 },
  },
  {
    ign: "Zeyzal",
    real: "Tristan Stidam",
    role: "support",
    country: "US",
    age: 25,
    attrs: { mechanics: 75, gameIq: 80, clutch: 76, mentality: 79, intlExperience: 58 },
  },

  // CBLOL / Brasil
  {
    ign: "Tay",
    real: "Rodrigo Panisa",
    role: "top",
    country: "BR",
    age: 27,
    attrs: { mechanics: 76, gameIq: 79, clutch: 77, mentality: 79, intlExperience: 55 },
  },
  {
    ign: "Ranger",
    real: "Filipe Brombilla",
    role: "jungle",
    country: "BR",
    age: 26,
    attrs: { mechanics: 76, gameIq: 80, clutch: 77, mentality: 80, intlExperience: 45 },
  },
  {
    ign: "Hauz",
    real: "Bruno Ferreira",
    role: "mid",
    country: "BR",
    age: 24,
    attrs: { mechanics: 78, gameIq: 76, clutch: 76, mentality: 75, intlExperience: 35 },
  },
  {
    ign: "Netuno",
    real: "Lucas Flores",
    role: "adc",
    country: "BR",
    age: 22,
    attrs: { mechanics: 78, gameIq: 75, clutch: 76, mentality: 75, intlExperience: 30 },
  },
  {
    ign: "Damage",
    real: "Yan Sales",
    role: "support",
    country: "BR",
    age: 25,
    attrs: { mechanics: 76, gameIq: 78, clutch: 77, mentality: 78, intlExperience: 45 },
  },

  // LCP / PCS
  {
    ign: "Rest",
    real: "Hsu Shih-Chieh",
    role: "top",
    country: "TW",
    age: 25,
    attrs: { mechanics: 77, gameIq: 78, clutch: 76, mentality: 77, intlExperience: 55 },
  },
  {
    ign: "Gemini",
    real: "Huang Chu-Xuan",
    role: "jungle",
    country: "TW",
    age: 24,
    attrs: { mechanics: 76, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 48 },
  },
  {
    ign: "Mission",
    real: "Chen Hsiao-Hsien",
    role: "mid",
    country: "TW",
    age: 25,
    attrs: { mechanics: 76, gameIq: 78, clutch: 75, mentality: 76, intlExperience: 45 },
  },
  {
    ign: "Shunn",
    real: "Chao Ying-Shun",
    role: "adc",
    country: "TW",
    age: 22,
    attrs: { mechanics: 77, gameIq: 75, clutch: 75, mentality: 75, intlExperience: 40 },
  },
  {
    ign: "Koala",
    real: "Lin Chih-Chiang",
    role: "support",
    country: "TW",
    age: 27,
    attrs: { mechanics: 75, gameIq: 79, clutch: 76, mentality: 78, intlExperience: 60 },
  },

  // Alemanha (DE)
  {
    ign: "Gilius",
    real: "Erberk Demir",
    role: "jungle",
    country: "DE",
    age: 27,
    attrs: { mechanics: 78, gameIq: 80, clutch: 79, mentality: 78, intlExperience: 62 },
  },

  // Dinamarca (DK)
  {
    ign: "Broxah",
    real: "Mads Brock-Pedersen",
    role: "jungle",
    country: "DK",
    age: 27,
    attrs: { mechanics: 79, gameIq: 82, clutch: 80, mentality: 83, intlExperience: 78 },
  },
  {
    ign: "Santorin",
    real: "Lucas Tao Kilmer Larsen",
    role: "jungle",
    country: "DK",
    age: 27,
    attrs: { mechanics: 78, gameIq: 82, clutch: 79, mentality: 82, intlExperience: 72 },
  },
  {
    ign: "TynX",
    real: "Kristian Hansen",
    role: "jungle",
    country: "DK",
    age: 25,
    attrs: { mechanics: 77, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 45 },
  },

  // Espanha (ES)
  {
    ign: "xPeke",
    real: "Enrique Cedeño Martínez",
    role: "mid",
    country: "ES",
    age: 30,
    attrs: { mechanics: 77, gameIq: 85, clutch: 86, mentality: 84, intlExperience: 88 },
  },
  {
    ign: "Pepiinero",
    real: "Isaac Alvarado",
    role: "mid",
    country: "ES",
    age: 28,
    attrs: { mechanics: 76, gameIq: 78, clutch: 76, mentality: 77, intlExperience: 50 },
  },

  // Polônia (PL)
  {
    ign: "Agresivoo",
    real: "Tobiasz Ciba",
    role: "top",
    country: "PL",
    age: 25,
    attrs: { mechanics: 78, gameIq: 78, clutch: 76, mentality: 77, intlExperience: 48 },
  },
  {
    ign: "Woolite",
    real: "Paweł Pruski",
    role: "adc",
    country: "PL",
    age: 28,
    attrs: { mechanics: 77, gameIq: 78, clutch: 75, mentality: 77, intlExperience: 52 },
  },

  // Japão (JP)
  {
    ign: "Ceros",
    real: "Kyohei Yoshida",
    role: "mid",
    country: "JP",
    age: 29,
    attrs: { mechanics: 75, gameIq: 81, clutch: 77, mentality: 80, intlExperience: 68 },
  },
  {
    ign: "Enty",
    real: "Ryosei Tanioka",
    role: "support",
    country: "JP",
    age: 27,
    attrs: { mechanics: 75, gameIq: 79, clutch: 76, mentality: 78, intlExperience: 60 },
  },

  // Chile (CL)
  {
    ign: "Warangelus",
    real: "Fabián Llanos",
    role: "adc",
    country: "CL",
    age: 27,
    attrs: { mechanics: 77, gameIq: 77, clutch: 76, mentality: 76, intlExperience: 55 },
  },
  {
    ign: "Slow",
    real: "Eduardo Garcés",
    role: "support",
    country: "CL",
    age: 27,
    attrs: { mechanics: 75, gameIq: 78, clutch: 76, mentality: 77, intlExperience: 55 },
  },

  // Turquia (TR)
  {
    ign: "Armut",
    real: "İrfan Tükek",
    role: "top",
    country: "TR",
    age: 26,
    attrs: { mechanics: 80, gameIq: 80, clutch: 81, mentality: 79, intlExperience: 74 },
  },
  {
    ign: "Serin",
    real: "Tolga Ölmez",
    role: "mid",
    country: "TR",
    age: 25,
    attrs: { mechanics: 77, gameIq: 78, clutch: 76, mentality: 76, intlExperience: 48 },
  },
  {
    ign: "HolyPhoenix",
    real: "Anıl Işık",
    role: "adc",
    country: "TR",
    age: 28,
    attrs: { mechanics: 78, gameIq: 79, clutch: 78, mentality: 79, intlExperience: 64 },
  },

  // República Tcheca (CZ)
  {
    ign: "Dreedy",
    real: "Jakub Viceník",
    role: "top",
    country: "CZ",
    age: 25,
    attrs: { mechanics: 77, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 46 },
  },
  {
    ign: "Jejky",
    real: "David Jakubec",
    role: "jungle",
    country: "CZ",
    age: 25,
    attrs: { mechanics: 76, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 44 },
  },
  {
    ign: "Denyk",
    real: "Petr Haramach",
    role: "support",
    country: "CZ",
    age: 27,
    attrs: { mechanics: 76, gameIq: 79, clutch: 76, mentality: 77, intlExperience: 54 },
  },

  // Reino Unido (GB)
  {
    ign: "Alphari",
    real: "Barney Morris",
    role: "top",
    country: "GB",
    age: 25,
    attrs: { mechanics: 82, gameIq: 81, clutch: 78, mentality: 79, intlExperience: 70 },
  },
  {
    ign: "Maxlore",
    real: "Nubar Sarafian",
    role: "jungle",
    country: "GB",
    age: 28,
    attrs: { mechanics: 77, gameIq: 81, clutch: 78, mentality: 80, intlExperience: 68 },
  },
  {
    ign: "Caedrel",
    real: "Marc Lamont",
    role: "mid",
    country: "GB",
    age: 28,
    attrs: { mechanics: 76, gameIq: 85, clutch: 78, mentality: 82, intlExperience: 65 },
  },
  {
    ign: "xMatty",
    real: "Matthew Coombs",
    role: "adc",
    country: "GB",
    age: 24,
    attrs: { mechanics: 78, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 48 },
  },
  {
    ign: "kaSing",
    real: "Raymond Tsang",
    role: "support",
    country: "GB",
    age: 30,
    attrs: { mechanics: 76, gameIq: 82, clutch: 78, mentality: 81, intlExperience: 72 },
  },

  // Países Baixos (NL)
  {
    ign: "Morsu",
    real: "Bram Knol",
    role: "top",
    country: "NL",
    age: 27,
    attrs: { mechanics: 76, gameIq: 77, clutch: 75, mentality: 76, intlExperience: 46 },
  },
  {
    ign: "Kirei",
    real: "Thomas Yuen",
    role: "jungle",
    country: "NL",
    age: 27,
    attrs: { mechanics: 78, gameIq: 79, clutch: 77, mentality: 77, intlExperience: 58 },
  },
  {
    ign: "Febiven",
    real: "Fabian Diepstraten",
    role: "mid",
    country: "NL",
    age: 28,
    attrs: { mechanics: 79, gameIq: 82, clutch: 81, mentality: 80, intlExperience: 78 },
  },
  {
    ign: "Tabzz",
    real: "Erik van Helvert",
    role: "adc",
    country: "NL",
    age: 30,
    attrs: { mechanics: 76, gameIq: 80, clutch: 78, mentality: 79, intlExperience: 70 },
  },
  {
    ign: "Hybrid",
    real: "Glenn Doornenbal",
    role: "support",
    country: "NL",
    age: 28,
    attrs: { mechanics: 76, gameIq: 80, clutch: 77, mentality: 79, intlExperience: 64 },
  },
];

// ---------------------------------------------------------------------------
// IA Autônoma do Mercado de Transferências
// ---------------------------------------------------------------------------

export interface AutonomousMarketResult {
  updatedTeams: Team[];
  updatedSerieBTeams?: Team[];
  news: TransferNews[];
  remainingFreeAgents: Player[];
}

function isBlockedInternational(c: Championship): boolean {
  if (c.internationalLevel === "major" || c.internationalLevel === "minor") return true;
  if (c.isInternational === true) return true;
  if (
    /copa do mundo|world cup|seleções|selecoes|world|mundial|\bmsi\b|first\s*stand|kickoff|rift\s*rivals|global\s*master|supercopa|desafiante/i.test(
      c.name ?? "",
    )
  ) {
    return true;
  }
  const regs = new Set(
    c.teams.map((t) => normalizeRegion(t.region ?? "")).filter((r) => !!r && r !== "OUTROS"),
  );
  return regs.size > 1;
}

function collectUsedIgns(teams: Team[]): Set<string> {
  const used = new Set<string>();
  for (const t of teams) {
    for (const p of ensureRoster(t) ?? []) {
      used.add(p.ign.trim().toLowerCase());
    }
  }
  return used;
}

function moveSingleTeam(params: {
  team: Team;
  allLeagueTeams: Team[];
  pool: Player[];
  region: string;
  career?: CareerLedger;
  game: GameId;
  isSerieB: boolean;
}): { updatedTeam: Team; updatedAllTeams: Team[]; newsItem?: TransferNews } {
  const { team, allLeagueTeams, pool, region, career, game, isSerieB } = params;
  const roster = ensureRoster(team) ?? [];
  const starters = pickStarters(roster);
  if (starters.length === 0) return { updatedTeam: team, updatedAllTeams: allLeagueTeams };

  const budget = getTeamBaseBudget(team, region, false, isSerieB, career, game);
  const currentImports = starters.filter((p) => isPlayerImport(p, region)).length;

  const rankedStarters = [...starters].sort((a, b) => {
    const oa = getResolvedAttrs(a.attrs, a.ign, a.role, a.country, a.age).mechanics;
    const ob = getResolvedAttrs(b.attrs, b.ign, b.role, b.country, b.age).mechanics;
    return oa - ob;
  });

  const weakest = rankedStarters[0];
  const weakestAttrs = getResolvedAttrs(
    weakest.attrs,
    weakest.ign,
    weakest.role,
    weakest.country,
    weakest.age,
  );

  // 1. Tenta contratar/puxar jogador de outro time da mesma liga local (troca ou compra direta)
  let nextLeagueTeams = allLeagueTeams;
  if (Math.random() < 0.35 && allLeagueTeams.length >= 2) {
    for (const other of allLeagueTeams) {
      if (other.id === team.id) continue;
      const otherRoster = ensureRoster(other) ?? [];
      // Pega reserva ou jogador da mesma role de time menor/outro time
      const candidate = otherRoster.find((p) => {
        if (p.role !== weakest.role) return false;
        const pAttrs = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
        if (pAttrs.mechanics <= weakestAttrs.mechanics + 2) return false;
        const isImp = isPlayerImport(p, region);
        if (isImp && currentImports >= 2 && !isPlayerImport(weakest, region)) return false;
        const salary = getPlayerSalary(p, region, career, game);
        if (salary > budget * 0.45) return false;
        // Só puxa se for reserva lá ou se o comprador tiver orçamento maior
        const otherBudget = getTeamBaseBudget(other, region, false, isSerieB, career, game);
        return !!p.sub || budget > otherBudget + 150;
      });

      if (candidate) {
        const bought: Player = {
          ...candidate,
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sub: false,
        };
        const buyerRoster = roster.map((p) =>
          p.id === weakest.id ? bought : p,
        );
        // O antigo titular vai para o banco (ou vira moeda de troca se o vendedor perdeu titular)
        const sellerNeedsSub = !candidate.sub;
        const swappedForSeller: Player = { ...weakest, sub: false };
        const updatedSellerRoster = sellerNeedsSub
          ? otherRoster.map((p) => (p.id === candidate.id ? swappedForSeller : p))
          : otherRoster.filter((p) => p.id !== candidate.id);

        if (!sellerNeedsSub) {
          buyerRoster.push({ ...weakest, sub: true });
        }

        const updatedBuyer: Team = {
          ...team,
          roster: buyerRoster,
          synergy: Math.max(0, (team.synergy ?? 10) - 10),
        };
        nextLeagueTeams = allLeagueTeams.map((t) => {
          if (t.id === team.id) return updatedBuyer;
          if (t.id === other.id) {
            return {
              ...other,
              roster: updatedSellerRoster,
              synergy: Math.max(0, (other.synergy ?? 10) - 8),
            };
          }
          return t;
        });

        return {
          updatedTeam: updatedBuyer,
          updatedAllTeams: nextLeagueTeams,
          newsItem: {
            id: uid(),
            headline: sellerNeedsSub
              ? `TROCA NA LIGA: ${team.name} acerta com ${candidate.ign} (ex-${other.name}) e envia ${weakest.ign} em troca!`
              : `TRANSFERÊNCIA: ${team.name} contrata ${candidate.ign} junto à ${other.name} para a rota ${candidate.role.toUpperCase()}!`,
            fromTeam: other.name,
            toTeam: team.name,
            playerIgn: candidate.ign,
            role: candidate.role,
            kind: "trade",
            value: getPlayerSalary(candidate, region, career, game),
            date: new Date().toISOString(),
          },
        };
      }
    }
  }

  // 2. Procura no pool de Agentes Livres (prioriza jogadores da própria região; imports só raramente e dentro do limite de 2)
  const allowImportSearch = Math.random() < 0.22;
  const domesticIdx = pool.findIndex((fa) => {
    if (fa.role !== weakest.role) return false;
    if (isPlayerImport(fa, region)) return false;
    const faAttrs = getResolvedAttrs(fa.attrs, fa.ign, fa.role, fa.country, fa.age);
    if (faAttrs.mechanics <= weakestAttrs.mechanics + 1) return false;
    const salary = getPlayerSalary(fa, region, career, game);
    if (salary > budget * 0.42) return false;
    return true;
  });

  const candidateIdx =
    domesticIdx >= 0
      ? domesticIdx
      : allowImportSearch
        ? pool.findIndex((fa) => {
            if (fa.role !== weakest.role) return false;
            const faAttrs = getResolvedAttrs(fa.attrs, fa.ign, fa.role, fa.country, fa.age);
            if (faAttrs.mechanics <= weakestAttrs.mechanics + 2) return false;
            const isImp = isPlayerImport(fa, region);
            if (isImp && currentImports >= 2 && !isPlayerImport(weakest, region)) return false;
            const salary = getPlayerSalary(fa, region, career, game);
            if (salary > budget * 0.42) return false;
            return true;
          })
        : -1;

  if (candidateIdx >= 0) {
    const signed = pool.splice(candidateIdx, 1)[0];
    const newPlayer: Player = {
      ...signed,
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sub: false,
    };

    const releasedOld = (weakest.age ?? 22) >= 26 || weakestAttrs.mechanics < 70;
    let updatedRoster: Player[];
    let newsItem: TransferNews;

    if (releasedOld) {
      pool.push({ ...weakest, sub: false });
      updatedRoster = roster.filter((p) => p.id !== weakest.id).concat(newPlayer);
      newsItem = {
        id: uid(),
        headline: `${team.name} dispensa ${weakest.ign} para o mercado livre e contrata ${signed.ign}!`,
        fromTeam: "Agente Livre",
        toTeam: team.name,
        playerIgn: signed.ign,
        role: signed.role,
        kind: "signing",
        value: getPlayerSalary(signed, region, career, game),
        date: new Date().toISOString(),
      };
    } else {
      updatedRoster = roster
        .map((p) => (p.id === weakest.id ? newPlayer : p))
        .concat({ ...weakest, sub: true });
      const isImp = isPlayerImport(signed, region);
      newsItem = {
        id: uid(),
        headline: isImp
          ? `REFORÇO IMPORT: ${team.name} contrata ${signed.ign} [${signed.country}] e assume a rota ${signed.role.toUpperCase()}!`
          : `CONTRATAÇÃO: ${team.name} fecha com ${signed.ign} (Agente Livre) para assumir a titularidade!`,
        fromTeam: "Agente Livre",
        toTeam: team.name,
        playerIgn: signed.ign,
        role: signed.role,
        kind: "signing",
        value: getPlayerSalary(signed, region, career, game),
        date: new Date().toISOString(),
      };
    }

    const updatedTeam: Team = {
      ...team,
      roster: updatedRoster,
      synergy: Math.max(0, (team.synergy ?? 10) - 12),
    };
    nextLeagueTeams = allLeagueTeams.map((t) => (t.id === team.id ? updatedTeam : t));
    return { updatedTeam, updatedAllTeams: nextLeagueTeams, newsItem };
  }

  // 3. Se não contratou ninguém e tem reserva/veterano caro em baixa, pode dispensar para abrir caixa
  const subs = roster.filter((p) => p.sub);
  if (subs.length >= 2) {
    const releasedSub = subs[subs.length - 1];
    pool.push({ ...releasedSub, sub: false });
    const updatedTeam: Team = {
      ...team,
      roster: roster.filter((p) => p.id !== releasedSub.id),
    };
    nextLeagueTeams = allLeagueTeams.map((t) => (t.id === team.id ? updatedTeam : t));
    return {
      updatedTeam,
      updatedAllTeams: nextLeagueTeams,
      newsItem: {
        id: uid(),
        headline: `${team.name} libera ${releasedSub.ign} (${releasedSub.role.toUpperCase()}) para o Mercado Livre.`,
        fromTeam: team.name,
        toTeam: "Mercado Livre",
        playerIgn: releasedSub.ign,
        role: releasedSub.role,
        kind: "release",
        date: new Date().toISOString(),
      },
    };
  }

  return { updatedTeam: team, updatedAllTeams: allLeagueTeams };
}

/**
 * Executa uma rodada completa de transferências de forma autônoma na entressafra.
 * NUNCA altera elencos de torneios internacionais.
 */
export function runAutonomousMarket(params: {
  championship: Championship;
  allChampionships?: Championship[];
  career?: CareerLedger;
  freeAgentsPool?: Player[];
  intensity?: "normal" | "aggressive";
}): AutonomousMarketResult {
  const { championship, allChampionships = [], career, intensity = "normal" } = params;

  if (isBlockedInternational(championship)) {
    return {
      updatedTeams: championship.teams,
      updatedSerieBTeams: championship.serieB?.teams,
      news: [],
      remainingFreeAgents: params.freeAgentsPool ?? [],
    };
  }

  const region = championship.region || "CBLOL";
  const game = (championship.game ?? "lol") as GameId;
  const news: TransferNews[] = [];

  const allGlobalTeams: Team[] = [
    ...championship.teams,
    ...(championship.serieB?.teams ?? []),
    ...allChampionships.flatMap((c) => [...c.teams, ...(c.serieB?.teams ?? [])]),
  ];
  const usedIgns = collectUsedIgns(allGlobalTeams);

  let pool: Player[] = (
    params.freeAgentsPool
      ? [...params.freeAgentsPool]
      : GLOBAL_FREE_AGENT_POOL.map((fa, i) => ({ ...fa, id: `fa_${i + 1}_${Date.now()}` }))
  )
    .filter((p) => !usedIgns.has(p.ign.trim().toLowerCase()))
    .sort(() => Math.random() - 0.5);

  const processTeamList = (teams: Team[], isSerieB = false): Team[] => {
    let current = [...teams];
    const moveChance = isSerieB ? 0.5 : intensity === "aggressive" ? 0.85 : 0.65;
    for (const original of teams) {
      if (Math.random() > moveChance) continue;
      const liveTeam = current.find((t) => t.id === original.id);
      if (!liveTeam) continue;
      const res = moveSingleTeam({
        team: liveTeam,
        allLeagueTeams: current,
        pool,
        region,
        career,
        game,
        isSerieB,
      });
      current = res.updatedAllTeams;
      if (res.newsItem) news.push(res.newsItem);
    }
    return current;
  };

  const updatedTeamsA = processTeamList(championship.teams, false);
  const updatedTeamsB = championship.serieB
    ? processTeamList(championship.serieB.teams, true)
    : undefined;

  return {
    updatedTeams: updatedTeamsA,
    updatedSerieBTeams: updatedTeamsB,
    news,
    remainingFreeAgents: pool,
  };
}

/**
 * Janela viva DURANTE o split em ligas locais:
 * Sem precisar clicar ou aprovar nada, após partidas da liga local os times avaliam
 * seu desempenho e fazem movimentações autônomas (contratações, trocas ou dispensas).
 * Bloqueado em campeonatos internacionais.
 */
export function runMidSplitMarketTick(params: {
  championship: Championship;
  allChampionships?: Championship[];
  career?: CareerLedger;
  loserTeamId?: string;
  division?: 1 | 2;
}): { teams: Team[]; serieBTeams?: Team[]; news: TransferNews[] } {
  const { championship, allChampionships = [], career, loserTeamId, division = 1 } = params;
  if (isBlockedInternational(championship)) {
    return {
      teams: championship.teams,
      serieBTeams: championship.serieB?.teams,
      news: [],
    };
  }

  const region = championship.region || "CBLOL";
  const game = (championship.game ?? "lol") as GameId;
  const list = division === 2 ? (championship.serieB?.teams ?? []) : championship.teams;
  if (list.length < 2) {
    return {
      teams: championship.teams,
      serieBTeams: championship.serieB?.teams,
      news: [],
    };
  }

  // Ritmo orgânico ao longo do split: perdedor em má fase tem mais chance de mexer
  const loserState = loserTeamId ? championship.momentum?.[loserTeamId] : undefined;
  const inCrisis = (loserState?.form ?? 50) < 46 || (loserState?.streak ?? 0) <= -2;
  const triggerChance = inCrisis ? 0.42 : 0.18;
  if (Math.random() > triggerChance) {
    return {
      teams: championship.teams,
      serieBTeams: championship.serieB?.teams,
      news: [],
    };
  }

  const allGlobalTeams: Team[] = [
    ...championship.teams,
    ...(championship.serieB?.teams ?? []),
    ...allChampionships.flatMap((c) => [...c.teams, ...(c.serieB?.teams ?? [])]),
  ];
  const usedIgns = collectUsedIgns(allGlobalTeams);
  const pool: Player[] = GLOBAL_FREE_AGENT_POOL
    .map((fa, i) => ({ ...fa, id: `fa_${i + 1}_${Date.now()}` }))
    .filter((p) => !usedIgns.has(p.ign.trim().toLowerCase()))
    .sort(() => Math.random() - 0.5);

  // Escolhe preferencialmente o perdedor em crise ou um time aleatório da divisão
  const target =
    (inCrisis && loserTeamId ? list.find((t) => t.id === loserTeamId) : undefined) ??
    list[Math.floor(Math.random() * list.length)];
  if (!target) {
    return {
      teams: championship.teams,
      serieBTeams: championship.serieB?.teams,
      news: [],
    };
  }

  const res = moveSingleTeam({
    team: target,
    allLeagueTeams: list,
    pool,
    region,
    career,
    game,
    isSerieB: division === 2,
  });

  if (!res.newsItem) {
    return {
      teams: championship.teams,
      serieBTeams: championship.serieB?.teams,
      news: [],
    };
  }

  return {
    teams: division === 1 ? res.updatedAllTeams : championship.teams,
    serieBTeams: division === 2 ? res.updatedAllTeams : championship.serieB?.teams,
    news: [res.newsItem],
  };
}
