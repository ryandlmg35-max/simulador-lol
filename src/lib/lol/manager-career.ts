import { REAL_ROSTERS } from "./real-rosters";
import {
  playerFromScout,
  playerOverall,
  makeCustomPlayer,
  pickStarters,
  effectiveRating,
  clampAttr,
  hashStr,
  evolveRoster,
} from "./players";
import { getOfficialLogo } from "./official-logos";
import { uid } from "./generate";
import { electMatchMvp } from "./mvp";
import type { BestOf, Match, Player, PlayerRole, Team } from "./types";

export const MANAGER_STORAGE_KEY = "esports-manager-career-v1";

export type LeagueId = "LCK" | "LPL" | "LEC" | "LCS" | "CBLOL" | "LCP";

export const ALL_LEAGUES: LeagueId[] = ["LCK", "LPL", "LEC", "LCS", "CBLOL", "LCP"];

export const LEAGUE_META: Record<
  LeagueId,
  {
    name: string;
    fullName: string;
    prestige: number; // 0-100 prestígio competitivo global
    baseCashK: number; // caixa inicial padrão em $k
    matchdayIncomeK: number; // receita base de patrocínio/transmissão por rodada em $k
    prizePoolK: { champion: number; runnerUp: number; top4: number; playoff: number };
    regionCountries: string[];
    intlSlots: number;
  }
> = {
  LCK: {
    name: "LCK",
    fullName: "League of Legends Champions Korea",
    prestige: 96,
    baseCashK: 2600,
    matchdayIncomeK: 135,
    prizePoolK: { champion: 1400, runnerUp: 800, top4: 420, playoff: 200 },
    regionCountries: ["KR"],
    intlSlots: 2,
  },
  LPL: {
    name: "LPL",
    fullName: "League of Legends Pro League",
    prestige: 94,
    baseCashK: 2800,
    matchdayIncomeK: 145,
    prizePoolK: { champion: 1500, runnerUp: 850, top4: 450, playoff: 220 },
    regionCountries: ["CN", "TW", "HK", "KR"],
    intlSlots: 2,
  },
  LEC: {
    name: "LEC",
    fullName: "LoL EMEA Championship",
    prestige: 83,
    baseCashK: 2100,
    matchdayIncomeK: 105,
    prizePoolK: { champion: 950, runnerUp: 520, top4: 280, playoff: 130 },
    regionCountries: ["DE", "FR", "ES", "PL", "DK", "SE", "GB", "BE", "NL", "TR", "CZ", "RO", "NO", "FI"],
    intlSlots: 2,
  },
  LCS: {
    name: "LCS",
    fullName: "League Championship Series",
    prestige: 80,
    baseCashK: 2250,
    matchdayIncomeK: 110,
    prizePoolK: { champion: 950, runnerUp: 520, top4: 270, playoff: 120 },
    regionCountries: ["US", "CA", "AU"],
    intlSlots: 2,
  },
  CBLOL: {
    name: "CBLOL",
    fullName: "Campeonato Brasileiro de LoL",
    prestige: 71,
    baseCashK: 1650,
    matchdayIncomeK: 82,
    prizePoolK: { champion: 650, runnerUp: 350, top4: 180, playoff: 85 },
    regionCountries: ["BR", "AR", "CL", "PE", "UY"],
    intlSlots: 1,
  },
  LCP: {
    name: "LCP",
    fullName: "LoL Championship Pacific",
    prestige: 69,
    baseCashK: 1600,
    matchdayIncomeK: 78,
    prizePoolK: { champion: 620, runnerUp: 330, top4: 170, playoff: 80 },
    regionCountries: ["TW", "VN", "JP", "AU", "TH", "PH", "SG", "HK"],
    intlSlots: 1,
  },
};

export type ManagerStyle = "tactical" | "scout" | "tycoon" | "locker_room";

export const MANAGER_STYLES: Record<
  ManagerStyle,
  {
    label: string;
    subtitle: string;
    perk: string;
  }
> = {
  tactical: {
    label: "Estrategista Tático",
    subtitle: "Foco em draft, leitura de mapa e preparação de séries",
    perk: "+2.5 de força efetiva em jogo e +4 de sinergia inicial",
  },
  scout: {
    label: "Olheiro Visionário",
    subtitle: "Especialista em mercado global e convencimento de talentos",
    perk: "+14% de aceitação em propostas e leitura exata de mercado",
  },
  tycoon: {
    label: "Magnata Corporativo",
    subtitle: "Gestão agressiva de marca, receita e grandes contratos",
    perk: "+35% de caixa inicial e +22% de receita comercial por rodada",
  },
  locker_room: {
    label: "Lenda do Vestiário",
    subtitle: "Gestão humana que blinda o elenco sob pressão",
    perk: "+12 cultura inicial e -40% impacto negativo em crises/demissões",
  },
};

export type StaffRole = "head_coach" | "analyst" | "psychologist" | "scout" | "commercial";

export const STAFF_ROLE_META: Record<
  StaffRole,
  {
    label: string;
    description: string;
    impactSummary: string;
  }
> = {
  head_coach: {
    label: "Técnico Principal",
    description: "Comanda o draft, macrogame e entrosamento diário.",
    impactSummary: "Aumenta força tática em partidas (+0.08 por pt acima de 60) e acelera sinergia.",
  },
  analyst: {
    label: "Analista de Desempenho",
    description: "Estuda adversários, tendências de meta e evolução individual.",
    impactSummary: "Melhora consistência nas séries e aumenta chance de evolução dos jogadores.",
  },
  psychologist: {
    label: "Psicólogo Esportivo",
    description: "Gerencia pressão, clima de vestiário e controle emocional.",
    impactSummary: "Recupera moral após derrotas/demissões e protege cultura do elenco.",
  },
  scout: {
    label: "Olheiro Chefe",
    description: "Negocia com agentes e avalia jogadores ao redor do mundo.",
    impactSummary: "Aumenta probabilidade de jogadores aceitarem suas propostas.",
  },
  commercial: {
    label: "Diretor Comercial",
    description: "Atrai patrocinadores, ativações de marca e acordos de mídia.",
    impactSummary: "Multiplica a receita por rodada e bônus de visibilidade nos playoffs.",
  },
};

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  country: string;
  age: number;
  rating: number; // 55 - 97
  salaryPerRoundK: number;
  hireFeeK: number;
  specialty: string;
  morale: number;
}

export interface CareerPlayer extends Player {
  teamId: string | null; // null = Free Agent
  teamName: string | null;
  league: LeagueId | "FREE_AGENT";
  overall: number;
  marketValueK: number;
  salaryPerRoundK: number;
  contractSplits: number;
  morale: number; // 0-100
  refusalUntilStep?: number;
  rejectionCount?: number;
  wins: number;
  losses: number;
  mvps: number;
}

export interface CareerTeam extends Team {
  league: LeagueId;
  elo: number;
  fanSupport: number; // 0-100
  isUserTeam?: boolean;
  /** Dinheiro em caixa apenas para exibição/referência da IA (usuário usa career.cashK). */
  aiBudgetK: number;
}

export interface CareerMatch {
  id: string;
  round: number;
  stage: "regular" | "playoff" | "international";
  label?: string;
  bestOf: BestOf;
  teamAId: string | null;
  teamBId: string | null;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string | null;
  loserId?: string | null;
  mvpIgn?: string;
  mvpRole?: PlayerRole;
  nextMatchId?: string;
  nextSlot?: "A" | "B";
  isFinal?: boolean;
}

export interface FinanceTransaction {
  id: string;
  step: number;
  splitLabel: string;
  type: "income" | "expense" | "prize" | "transfer";
  title: string;
  amountK: number; // positivo = entrada, negativo = saída
}

export interface ClubEvent {
  id: string;
  step: number;
  splitLabel: string;
  category: "match" | "transfer" | "staff" | "morale" | "finance" | "trophy";
  headline: string;
  detail: string;
  impactTags: string[];
}

export interface ManagerProfile {
  name: string;
  country: string;
  age: number;
  style: ManagerStyle;
  reputation: number; // 15-100
  titlesWon: number;
  intlTitlesWon: number;
  playoffsReached: number;
  matchesCoached: number;
  matchesWon: number;
}

export interface LeagueSeasonState {
  league: LeagueId;
  stage: "regular" | "playoffs" | "completed";
  currentRound: number;
  totalRegularRounds: number;
  regularMatches: CareerMatch[];
  playoffMatches: CareerMatch[];
  championId?: string | null;
  runnerUpId?: string | null;
  standingsIds: string[]; // cached sorted teamIds
}

export interface InternationalState {
  name: "MSI" | "Worlds";
  active: boolean;
  completed: boolean;
  qualifiedTeamIds: string[];
  matches: CareerMatch[];
  championId?: string | null;
  runnerUpId?: string | null;
}

export interface CareerTitleRecord {
  id: string;
  seasonYear: number;
  splitNumber: 1 | 2;
  tournament: string;
  championTeamId: string;
  championName: string;
  championTag: string;
  runnerUpName: string;
  userPlacement: string;
}

export type SponsorTier = "safe" | "balanced" | "aggressive";

export interface SponsorContract {
  id: string;
  tier: SponsorTier;
  brandName: string;
  tagline: string;
  signingBonusK: number;
  perRoundBonusK: number;
  goalLabel: string;
  goalType: "regular_top6" | "playoffs_top4" | "finalist_top2";
  rewardBonusK: number;
  penaltyK: number;
  status: "pending" | "active" | "fulfilled" | "failed";
}

export interface IncomingTransferOffer {
  id: string;
  playerId: string;
  playerIgn: string;
  playerRole: PlayerRole;
  playerOvr: number;
  fromTeamId: string;
  fromTeamName: string;
  fromTeamTag: string;
  fromLeague: LeagueId;
  offeredFeeK: number;
  offeredSalaryK: number;
  reason: string;
  playerDesire: "eager" | "open" | "loyal";
  createdAtStep: number;
  expiresAtStep: number;
}

export interface WorldTransferRecord {
  id: string;
  step: number;
  splitLabel: string;
  playerIgn: string;
  playerRole: PlayerRole;
  playerOvr: number;
  fromTeamName: string;
  fromLeague: LeagueId | "FREE_AGENT";
  toTeamName: string;
  toTeamTag: string;
  toLeague: LeagueId;
  feeK: number;
}

export interface ManagerCareerState {
  id: string;
  createdAt: number;
  updatedAt: number;
  seasonYear: number;
  splitNumber: 1 | 2; // Split 1 -> MSI, Split 2 -> Worlds
  step: number; // contador global de rodadas/eventos para cooldowns
  manager: ManagerProfile;
  userTeamId: string;
  userLeague: LeagueId;
  cashK: number; // dinheiro disponível do usuário em $k
  fanApproval: number; // 0-100 aprovação da torcida/diretoria
  teams: CareerTeam[];
  players: CareerPlayer[];
  staff: StaffMember[]; // funcionários contratados pelo usuário
  staffMarket: StaffMember[]; // candidatos disponíveis
  leagues: Record<LeagueId, LeagueSeasonState>;
  international: InternationalState | null;
  transactions: FinanceTransaction[];
  events: ClubEvent[];
  history: CareerTitleRecord[];
  sponsorOffers?: SponsorContract[];
  activeSponsor?: SponsorContract | null;
  incomingOffers?: IncomingTransferOffer[];
  worldTransfers?: WorldTransferRecord[];
}

export function generateSponsorOffers(league: LeagueId, seed = 1): SponsorContract[] {
  const baseMatch = LEAGUE_META[league].matchdayIncomeK;
  const brands = [
    {
      tier: "safe" as const,
      names: ["HyperX Gaming", "RedBull Regional", "Logitech G Pro"],
      tagline: "Cota garantida com meta acessível para manter o caixa estável.",
      signingMult: 1.8,
      roundMult: 0.14,
      goalLabel: "Terminar no Top 6 da Fase Regular",
      goalType: "regular_top6" as const,
      rewardMult: 1.6,
      penaltyMult: 0,
    },
    {
      tier: "balanced" as const,
      names: ["Mastercard Esports", "Secretlab Pro", "Alienware Official"],
      tagline: "Equilíbrio entre receita recorrente e bônus de classificação aos Playoffs.",
      signingMult: 2.5,
      roundMult: 0.25,
      goalLabel: "Classificar para os Playoffs (Top 4)",
      goalType: "playoffs_top4" as const,
      rewardMult: 3.4,
      penaltyMult: 0.9,
    },
    {
      tier: "aggressive" as const,
      names: ["Mercedes-Benz Global", "Aramco Masters", "Samsung Galaxy"],
      tagline: "Investimento pesado para clubes que miram a Grande Final e títulos.",
      signingMult: 3.6,
      roundMult: 0.42,
      goalLabel: "Chegar à Grande Final da Liga (Top 2)",
      goalType: "finalist_top2" as const,
      rewardMult: 6.5,
      penaltyMult: 2.2,
    },
  ];

  return brands.map((b, i) => {
    const brandName = b.names[(seed + i) % b.names.length];
    return {
      id: uid(),
      tier: b.tier,
      brandName,
      tagline: b.tagline,
      signingBonusK: Math.round((baseMatch * b.signingMult) / 5) * 5,
      perRoundBonusK: Math.max(8, Math.round(baseMatch * b.roundMult)),
      goalLabel: b.goalLabel,
      goalType: b.goalType,
      rewardBonusK: Math.round((baseMatch * b.rewardMult) / 10) * 10,
      penaltyK: Math.round((baseMatch * b.penaltyMult) / 5) * 5,
      status: "pending" as const,
    };
  });
}

// ---------------------------------------------------------------------------
// Persistência 100% isolada do simulador normal
// ---------------------------------------------------------------------------

export function loadManagerCareer(): ManagerCareerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MANAGER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManagerCareerState;
    if (!parsed || !parsed.manager || !parsed.userTeamId || !Array.isArray(parsed.teams)) {
      return null;
    }
    if (!parsed.sponsorOffers || parsed.sponsorOffers.length === 0) {
      parsed.sponsorOffers = generateSponsorOffers(parsed.userLeague, parsed.step ?? 1);
    }
    if (!parsed.incomingOffers) parsed.incomingOffers = [];
    if (!parsed.worldTransfers) parsed.worldTransfers = [];
    return parsed;
  } catch {
    return null;
  }
}

export function saveManagerCareer(state: ManagerCareerState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!state) {
      window.localStorage.removeItem(MANAGER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MANAGER_STORAGE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {
    /* ignore storage quota edge */
  }
}

// ---------------------------------------------------------------------------
// Economia, valoração e geração de elenco/staff
// ---------------------------------------------------------------------------

export function formatMoneyK(k: number): string {
  const abs = Math.abs(Math.round(k));
  const sign = k < 0 ? "-" : "";
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(2)}M`;
  }
  return `${sign}$${abs.toLocaleString("en-US")}k`;
}

export function computePlayerMarketValueK(ovr: number, age = 21, league: LeagueId | "FREE_AGENT" = "LCS"): number {
  const norm = Math.max(0, ovr - 58);
  let val = 85 + Math.pow(norm, 1.88) * 3.1;
  if (age <= 20) val *= 1.18;
  else if (age >= 27) val *= 0.78;
  const leagueBoost =
    league === "LCK" || league === "LPL" ? 1.15 : league === "LEC" || league === "LCS" ? 1.0 : 0.88;
  val *= leagueBoost;
  if (league === "FREE_AGENT") val = 0; // livre sem multa de transferência
  return Math.round(val / 5) * 5;
}

export function computeFairSalaryK(ovr: number, league: LeagueId | "FREE_AGENT" = "LCS"): number {
  const norm = Math.max(0, ovr - 56);
  let sal = 8 + Math.pow(norm, 1.55) * 0.44;
  if (league === "LCK" || league === "LPL") sal *= 1.12;
  else if (league === "CBLOL" || league === "LCP") sal *= 0.88;
  return Math.max(6, Math.round(sal));
}

function buildFreeAgentPool(existingIgns: Set<string>): CareerPlayer[] {
  const specs: Array<{ ign: string; role: PlayerRole; country: string; ovr: number; age: number }> = [
    { ign: "Rascal", role: "top", country: "KR", ovr: 81, age: 26 },
    { ign: "Tay", role: "top", country: "BR", ovr: 76, age: 27 },
    { ign: "Wunder", role: "top", country: "DK", ovr: 80, age: 25 },
    { ign: "Licorice", role: "top", country: "US", ovr: 78, age: 26 },
    { ign: "Croco", role: "jungle", country: "KR", ovr: 81, age: 24 },
    { ign: "Ranger", role: "jungle", country: "BR", ovr: 77, age: 25 },
    { ign: "Markoon", role: "jungle", country: "NL", ovr: 79, age: 22 },
    { ign: "Spica", role: "jungle", country: "US", ovr: 79, age: 23 },
    { ign: "Fate", role: "mid", country: "KR", ovr: 82, age: 24 },
    { ign: "Hauz", role: "mid", country: "BR", ovr: 77, age: 23 },
    { ign: "Abbedagge", role: "mid", country: "DE", ovr: 79, age: 25 },
    { ign: "Angel", role: "mid", country: "CN", ovr: 82, age: 24 },
    { ign: "Netuno", role: "adc", country: "BR", ovr: 79, age: 21 },
    { ign: "Teddy", role: "adc", country: "KR", ovr: 84, age: 26 },
    { ign: "Zven", role: "adc", country: "DK", ovr: 80, age: 27 },
    { ign: "Crownie", role: "adc", country: "SI", ovr: 81, age: 25 },
    { ign: "Effort", role: "support", country: "KR", ovr: 80, age: 23 },
    { ign: "Damage", role: "support", country: "BR", ovr: 77, age: 25 },
    { ign: "Trymbi", role: "support", country: "PL", ovr: 82, age: 24 },
    { ign: "Koala", role: "support", country: "TW", ovr: 78, age: 23 },
  ];

  return specs
    .filter((s) => !existingIgns.has(s.ign.toLowerCase()))
    .map((s) => {
      const p = makeCustomPlayer({
        ign: s.ign,
        role: s.role,
        overall: s.ovr,
        age: s.age,
        country: s.country,
      });
      const ovr = Math.round(playerOverall(p));
      return {
        ...p,
        teamId: null,
        teamName: null,
        league: "FREE_AGENT" as const,
        overall: ovr,
        marketValueK: 0,
        salaryPerRoundK: computeFairSalaryK(ovr, "CBLOL"),
        contractSplits: 0,
        morale: 75,
        wins: 0,
        losses: 0,
        mvps: 0,
      };
    });
}

const STAFF_NAMES_BY_COUNTRY: Array<{ name: string; country: string; specialty: string }> = [
  { name: "Kim 'kkOma' Jeong-gyun", country: "KR", specialty: "Draft & Gestão de Campeões" },
  { name: "Yang 'Daeny' Dae-in", country: "KR", specialty: "Macro & Adaptação em BO5" },
  { name: "Dylan Falco", country: "CA", specialty: "Planejamento Estratégico" },
  { name: "Rodrigo 'Kalec' Rodrigues", country: "BR", specialty: "Desenvolvimento de Jovens" },
  { name: "Gabriel 'Turtle' Peixoto", country: "BR", specialty: "Controle de Tempo & Objetivos" },
  { name: "Fabian 'GrabbZ' Lohmann", country: "DE", specialty: "Vestiário & Mentalidade" },
  { name: "Jake 'Spawn' Tiberi", country: "AU", specialty: "Disciplina & Estrutura" },
  { name: "Ken 'Kenma' Pham", country: "US", specialty: "Scouting de Dados" },
  { name: "Chen 'Homme' Sung-young", country: "CN", specialty: "Sinergia de Equipe" },
  { name: "Lucas 'Dionrray' Barbosa", country: "BR", specialty: "Preparação de Playoffs" },
  { name: "Dr. Helena Vasconcelos", country: "BR", specialty: "Psicologia de Alta Pressão" },
  { name: "Dr. Min-jun Park", country: "KR", specialty: "Prevenção de Tilt & Foco" },
  { name: "Dra. Claire Moreau", country: "FR", specialty: "Coesão de Vestiário" },
  { name: "Rafael 'RafaScouts' Costa", country: "BR", specialty: "Negociação Sul-Americana" },
  { name: "Seung-ho 'Eagle' Choi", country: "KR", specialty: "Rede de Agentes LCK/LPL" },
  { name: "Marcus 'DealMaker' Vance", country: "US", specialty: "Redução de Multas" },
  { name: "Camila Mendonça", country: "BR", specialty: "Patrocínios Master & Mídia" },
  { name: "Hana Takahashi", country: "JP", specialty: "Expansão Comercial Global" },
  { name: "Henrik 'DataMind' Lind", country: "DK", specialty: "Analytics & Matchups" },
  { name: "Mateus 'Stat' Oliveira", country: "BR", specialty: "Leitura de Rotas & Draft" },
];

export function generateStaffMarket(seedOffset = 1): StaffMember[] {
  const roles: StaffRole[] = ["head_coach", "analyst", "psychologist", "scout", "commercial"];
  const list: StaffMember[] = [];
  let idx = 0;

  for (const role of roles) {
    // 3 candidatos por cargo (Regional, Veterano, Elite)
    const tiers = [
      { min: 62, max: 70, age: 27 },
      { min: 73, max: 82, age: 32 },
      { min: 85, max: 94, age: 36 },
    ];
    for (let t = 0; t < tiers.length; t++) {
      const profile = STAFF_NAMES_BY_COUNTRY[(idx + seedOffset) % STAFF_NAMES_BY_COUNTRY.length];
      idx++;
      const h = hashStr(`staff:${role}:${t}:${seedOffset}:${profile.name}`);
      const rating = tiers[t].min + (h % (tiers[t].max - tiers[t].min + 1));
      const salaryPerRoundK = Math.round(4 + Math.pow(Math.max(0, rating - 55), 1.35) * 0.34);
      const hireFeeK = salaryPerRoundK * (t === 2 ? 5 : t === 1 ? 4 : 3);
      list.push({
        id: uid(),
        name:
          role === "psychologist" && !profile.name.startsWith("Dr")
            ? `Dr(a). ${profile.name.replace(/'[^']+'\s*/, "")}`
            : profile.name,
        role,
        country: profile.country,
        age: tiers[t].age + (h % 6),
        rating,
        salaryPerRoundK,
        hireFeeK,
        specialty: profile.specialty,
        morale: 80,
      });
    }
  }
  return list;
}

function starterStaffForLeague(league: LeagueId): StaffMember[] {
  const baseRating = league === "LCK" || league === "LPL" ? 76 : league === "LEC" || league === "LCS" ? 71 : 66;
  return [
    {
      id: uid(),
      name: league === "CBLOL" ? "Lucas 'Mentor' Prado" : "Coach Principal Interno",
      role: "head_coach",
      country: LEAGUE_META[league].regionCountries[0] ?? "US",
      age: 31,
      rating: baseRating,
      salaryPerRoundK: 11,
      hireFeeK: 35,
      specialty: "Rotação & Draft Padrão",
      morale: 76,
    },
    {
      id: uid(),
      name: "Analista da Comissão",
      role: "analyst",
      country: LEAGUE_META[league].regionCountries[0] ?? "US",
      age: 26,
      rating: baseRating - 2,
      salaryPerRoundK: 8,
      hireFeeK: 25,
      specialty: "Revisão de VODs",
      morale: 75,
    },
  ];
}

// ---------------------------------------------------------------------------
// Calendário da Liga e Geração de Partidas
// ---------------------------------------------------------------------------

function generateDoubleRoundRobin(teamIds: string[], bestOf: BestOf): CareerMatch[] {
  if (teamIds.length < 2) return [];
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push("__BYE__");
  const n = ids.length;
  const roundsFirstHalf = n - 1;
  const matches: CareerMatch[] = [];

  // Garante um número equilibrado de rodadas (máx 10-14 rodadas)
  const arr = [...ids];
  const singleLeg: Array<{ round: number; a: string; b: string }> = [];

  for (let r = 0; r < roundsFirstHalf; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") {
        singleLeg.push({
          round: r + 1,
          a: r % 2 === 0 ? a : b,
          b: r % 2 === 0 ? b : a,
        });
      }
    }
    const fixed = arr[0];
    const rest = arr.slice(1);
    const last = rest.pop()!;
    arr.splice(0, arr.length, fixed, last, ...rest);
  }

  for (const m of singleLeg) {
    matches.push({
      id: uid(),
      round: m.round,
      stage: "regular",
      label: `Rodada ${m.round}`,
      bestOf,
      teamAId: m.a,
      teamBId: m.b,
    });
  }

  // Se a liga tiver <= 8 times, faz 2º turno para dar pelo menos 10-14 jogos por split
  if (teamIds.length <= 9) {
    for (const m of singleLeg) {
      matches.push({
        id: uid(),
        round: m.round + roundsFirstHalf,
        stage: "regular",
        label: `Rodada ${m.round + roundsFirstHalf}`,
        bestOf,
        teamAId: m.b,
        teamBId: m.a,
      });
    }
  }

  return matches;
}

function buildPlayoffsForLeague(sortedIds: string[]): CareerMatch[] {
  // Top 4 Playoffs (Semifinais BO5 + Grande Final BO5)
  const top = sortedIds.slice(0, Math.min(4, sortedIds.length));
  if (top.length < 2) return [];
  if (top.length < 4) {
    return [
      {
        id: uid(),
        round: 1,
        stage: "playoff",
        label: "Grande Final",
        bestOf: 5,
        teamAId: top[0],
        teamBId: top[1],
        isFinal: true,
      },
    ];
  }
  const finalId = uid();
  return [
    {
      id: uid(),
      round: 1,
      stage: "playoff",
      label: "Semifinal 1",
      bestOf: 5,
      teamAId: top[0],
      teamBId: top[3],
      nextMatchId: finalId,
      nextSlot: "A",
    },
    {
      id: uid(),
      round: 1,
      stage: "playoff",
      label: "Semifinal 2",
      bestOf: 5,
      teamAId: top[1],
      teamBId: top[2],
      nextMatchId: finalId,
      nextSlot: "B",
    },
    {
      id: finalId,
      round: 2,
      stage: "playoff",
      label: "Grande Final",
      bestOf: 5,
      teamAId: null,
      teamBId: null,
      isFinal: true,
    },
  ];
}

export function computeLeagueStandings(
  teamIds: string[],
  matches: CareerMatch[],
  teamsMap: Map<string, CareerTeam>,
  playersMap: Map<string, CareerPlayer[]>,
): Array<{ teamId: string; wins: number; losses: number; form: ("W" | "L")[]; ovr: number }> {
  const stats = new Map<string, { wins: number; losses: number; form: ("W" | "L")[] }>();
  for (const id of teamIds) stats.set(id, { wins: 0, losses: 0, form: [] });

  for (const m of matches) {
    if (m.stage !== "regular" || !m.winnerId || !m.loserId) continue;
    const w = stats.get(m.winnerId);
    const l = stats.get(m.loserId);
    if (w) {
      w.wins++;
      w.form.push("W");
    }
    if (l) {
      l.losses++;
      l.form.push("L");
    }
  }

  return teamIds
    .map((id) => {
      const s = stats.get(id) ?? { wins: 0, losses: 0, form: [] };
      const team = teamsMap.get(id);
      const roster = playersMap.get(id) ?? [];
      const ovr = team ? teamCurrentStrength(team, roster) : 65;
      return {
        teamId: id,
        wins: s.wins,
        losses: s.losses,
        form: s.form.slice(-5),
        ovr,
      };
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.ovr - a.ovr);
}

// ---------------------------------------------------------------------------
// Inicialização de Nova Carreira
// ---------------------------------------------------------------------------

export interface NewCareerConfig {
  managerName: string;
  managerCountry: string;
  managerAge: number;
  managerStyle: ManagerStyle;
  mode: "existing" | "custom";
  /** Quando mode === "existing", nome e liga do time real escolhido. */
  existingTeamName?: string;
  existingLeague?: LeagueId;
  /** Quando mode === "custom", dados do clube criado pelo usuário. */
  customTeamName?: string;
  customTeamTag?: string;
  customTeamColor?: string;
  customLeague?: LeagueId;
}

export function getRealTeamsCatalog(): Array<{
  name: string;
  tag: string;
  league: LeagueId;
  logo?: string;
  ovr: number;
  players: Array<{ ign: string; role: PlayerRole; country: string; ovr: number; sub?: boolean }>;
}> {
  const out: ReturnType<typeof getRealTeamsCatalog> = [];
  for (const league of ALL_LEAGUES) {
    const list = REAL_ROSTERS[league] ?? [];
    for (const st of list) {
      const converted = st.players.map((sp) => {
        const p = playerFromScout(sp);
        return {
          ign: p.ign,
          role: p.role,
          country: p.country ?? "KR",
          ovr: Math.round(playerOverall(p)),
          sub: p.sub,
        };
      });
      const starters = (["top", "jungle", "mid", "adc", "support"] as PlayerRole[])
        .map((r) => converted.find((x) => x.role === r && !x.sub) ?? converted.find((x) => x.role === r))
        .filter(Boolean);
      const avgOvr =
        starters.length > 0
          ? Math.round(starters.reduce((acc, x) => acc + (x?.ovr ?? 68), 0) / starters.length)
          : 68;
      const tag = st.name
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(0, 3)
        .toUpperCase();
      out.push({
        name: st.name,
        tag,
        league,
        logo: getOfficialLogo(st.name, tag),
        ovr: avgOvr,
        players: converted,
      });
    }
  }
  return out;
}

function makeTeamTag(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join("")
      .slice(0, 4)
      .toUpperCase();
  }
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "CLB";
}

export function createNewManagerCareer(cfg: NewCareerConfig): ManagerCareerState {
  const teams: CareerTeam[] = [];
  const players: CareerPlayer[] = [];
  const existingIgns = new Set<string>();

  const targetLeague: LeagueId =
    cfg.mode === "existing" ? cfg.existingLeague ?? "CBLOL" : cfg.customLeague ?? "CBLOL";

  const colorPalette = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#dc2626"];

  // 1. Popula todas as 6 ligas reais do mundo
  for (const league of ALL_LEAGUES) {
    const scoutTeams = REAL_ROSTERS[league] ?? [];
    for (let i = 0; i < scoutTeams.length; i++) {
      const st = scoutTeams[i];
      const tId = uid();
      const tag = makeTeamTag(st.name);
      const leaguePrestige = LEAGUE_META[league].prestige;
      const convertedPlayers: CareerPlayer[] = st.players.map((sp) => {
        const base = playerFromScout(sp);
        existingIgns.add(base.ign.toLowerCase());
        const ovr = Math.round(playerOverall(base));
        return {
          ...base,
          teamId: tId,
          teamName: st.name,
          league,
          overall: ovr,
          marketValueK: computePlayerMarketValueK(ovr, base.age, league),
          salaryPerRoundK: computeFairSalaryK(ovr, league),
          contractSplits: 2 + (hashStr(base.ign) % 3),
          morale: 74 + (hashStr(base.ign) % 12),
          wins: 0,
          losses: 0,
          mvps: 0,
        };
      });
      players.push(...convertedPlayers);

      const starters = convertedPlayers.filter((p) => !p.sub).slice(0, 5);
      const avgOvr = starters.length
        ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length)
        : 70;
      const elo = Math.round(leaguePrestige * 0.45 + avgOvr * 0.55);

      teams.push({
        id: tId,
        name: st.name,
        tag,
        region: league,
        league,
        logo: getOfficialLogo(st.name, tag),
        color: colorPalette[(i + league.length) % colorPalette.length],
        synergy: cfg.managerStyle === "tactical" ? 22 : 18,
        culture: 55,
        elo,
        fanSupport: Math.min(95, Math.max(40, Math.round(elo - 12))),
        aiBudgetK: LEAGUE_META[league].baseCashK + avgOvr * 10,
      });
    }
  }

  // 2. Define ou cria o time do usuário
  let userTeamId = "";
  if (cfg.mode === "existing") {
    const found = teams.find(
      (t) => t.league === targetLeague && t.name.toLowerCase() === (cfg.existingTeamName ?? "").toLowerCase(),
    );
    const fallback = found ?? teams.find((t) => t.league === targetLeague) ?? teams[0];
    fallback.isUserTeam = true;
    userTeamId = fallback.id;
    if (cfg.managerStyle === "tactical") fallback.synergy = Math.min(50, (fallback.synergy ?? 18) + 4);
    if (cfg.managerStyle === "locker_room") fallback.culture = Math.min(100, (fallback.culture ?? 55) + 12);
  } else {
    // Time customizado entra na liga escolhida (substituindo o time de menor elo para manter tamanho ideal da liga)
    const leagueTeams = teams.filter((t) => t.league === targetLeague).sort((a, b) => a.elo - b.elo);
    if (leagueTeams.length >= 10) {
      const removed = leagueTeams[0];
      const idx = teams.findIndex((t) => t.id === removed.id);
      if (idx >= 0) teams.splice(idx, 1);
      // Jogadores do time removido viram Free Agents!
      for (const p of players) {
        if (p.teamId === removed.id) {
          p.teamId = null;
          p.teamName = null;
          p.league = "FREE_AGENT";
          p.marketValueK = 0;
          p.contractSplits = 0;
        }
      }
    }

    const customName = (cfg.customTeamName ?? "New Legacy Esports").trim();
    const customTag = (cfg.customTeamTag ?? makeTeamTag(customName)).toUpperCase().slice(0, 4);
    const newTeamId = uid();
    const leagueBaseOvr = targetLeague === "LCK" || targetLeague === "LPL" ? 73 : targetLeague === "LEC" || targetLeague === "LCS" ? 70 : 67;
    const starterSpecs: Array<{ role: PlayerRole; suffix: string; ovr: number; age: number }> = [
      { role: "top", suffix: "Kuro", ovr: leagueBaseOvr, age: 20 },
      { role: "jungle", suffix: "Blitz", ovr: leagueBaseOvr + 1, age: 19 },
      { role: "mid", suffix: "Zenith", ovr: leagueBaseOvr + 3, age: 20 },
      { role: "adc", suffix: "Vortex", ovr: leagueBaseOvr + 1, age: 21 },
      { role: "support", suffix: "Shield", ovr: leagueBaseOvr - 1, age: 22 },
    ];
    const country = LEAGUE_META[targetLeague].regionCountries[0] ?? cfg.managerCountry;
    for (const sp of starterSpecs) {
      const ign = `${customTag}_${sp.suffix}`;
      existingIgns.add(ign.toLowerCase());
      const p = makeCustomPlayer({
        ign,
        role: sp.role,
        overall: sp.ovr,
        age: sp.age,
        country,
      });
      const ovr = Math.round(playerOverall(p));
      players.push({
        ...p,
        teamId: newTeamId,
        teamName: customName,
        league: targetLeague,
        overall: ovr,
        marketValueK: computePlayerMarketValueK(ovr, sp.age, targetLeague),
        salaryPerRoundK: computeFairSalaryK(ovr, targetLeague),
        contractSplits: 2,
        morale: 78,
        wins: 0,
        losses: 0,
        mvps: 0,
      });
    }

    const newTeam: CareerTeam = {
      id: newTeamId,
      name: customName,
      tag: customTag,
      region: targetLeague,
      league: targetLeague,
      color: cfg.customTeamColor ?? "#d97706",
      synergy: cfg.managerStyle === "tactical" ? 16 : 12,
      culture: cfg.managerStyle === "locker_room" ? 68 : 56,
      elo: leagueBaseOvr,
      fanSupport: 48,
      isUserTeam: true,
      aiBudgetK: LEAGUE_META[targetLeague].baseCashK,
    };
    teams.push(newTeam);
    userTeamId = newTeamId;
  }

  // 3. Adiciona Pool de Free Agents globais
  players.push(...buildFreeAgentPool(existingIgns));

  // 4. Dinheiro inicial pré-definido
  const baseCash = LEAGUE_META[targetLeague].baseCashK;
  const startingCashK =
    cfg.managerStyle === "tycoon" ? Math.round(baseCash * 1.35) : baseCash;

  // 5. Inicializa calendário das 6 ligas
  const leagues = {} as Record<LeagueId, LeagueSeasonState>;
  for (const league of ALL_LEAGUES) {
    const lTeams = teams.filter((t) => t.league === league);
    const lIds = lTeams.map((t) => t.id);
    const regMatches = generateDoubleRoundRobin(lIds, league === "LCK" || league === "LPL" ? 3 : 1);
    const totalRounds = regMatches.reduce((mx, m) => Math.max(mx, m.round), 0);
    leagues[league] = {
      league,
      stage: "regular",
      currentRound: 1,
      totalRegularRounds: totalRounds,
      regularMatches: regMatches,
      playoffMatches: [],
      standingsIds: lIds,
    };
  }

  const userTeam = teams.find((t) => t.id === userTeamId)!;

  return {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seasonYear: 2026,
    splitNumber: 1,
    step: 1,
    manager: {
      name: cfg.managerName.trim() || "Manager",
      country: cfg.managerCountry || "BR",
      age: cfg.managerAge || 29,
      style: cfg.managerStyle,
      reputation: cfg.mode === "existing" ? Math.round(userTeam.elo * 0.65) : 45,
      titlesWon: 0,
      intlTitlesWon: 0,
      playoffsReached: 0,
      matchesCoached: 0,
      matchesWon: 0,
    },
    userTeamId,
    userLeague: targetLeague,
    cashK: startingCashK,
    fanApproval: userTeam.fanSupport,
    teams,
    players,
    staff: starterStaffForLeague(targetLeague),
    staffMarket: generateStaffMarket(1),
    leagues,
    international: null,
    transactions: [
      {
        id: uid(),
        step: 1,
        splitLabel: "2026 Split 1",
        type: "income",
        title: `Orçamento inicial do clube (${userTeam.tag})`,
        amountK: startingCashK,
      },
    ],
    events: [
      {
        id: uid(),
        step: 1,
        splitLabel: "2026 Split 1",
        category: "staff",
        headline: `${cfg.managerName || "Novo Manager"} assume o comando da ${userTeam.name}`,
        detail: `Diretoria liberou ${formatMoneyK(startingCashK)} em caixa para o Split 1 da ${targetLeague}.`,
        impactTags: [`Caixa ${formatMoneyK(startingCashK)}`, `Torcida ${userTeam.fanSupport}%`],
      },
    ],
    history: [],
    sponsorOffers: generateSponsorOffers(targetLeague, 1),
    activeSponsor: null,
    incomingOffers: [],
    worldTransfers: [],
  };
}

// ---------------------------------------------------------------------------
// Força do Time, Bônus de Staff e Simulação de Partidas
// ---------------------------------------------------------------------------

export function getTeamRoster(players: CareerPlayer[], teamId: string): CareerPlayer[] {
  return players.filter((p) => p.teamId === teamId);
}

export function teamCurrentStrength(
  team: CareerTeam,
  roster: CareerPlayer[],
  staff?: StaffMember[],
  manager?: ManagerProfile,
): number {
  const base = effectiveRating(team.elo, roster, team.synergy ?? 15, team.culture ?? 50);
  let bonus = 0;

  // Moral média dos titulares pesa no desempenho real
  const starters = pickStarters(roster) as CareerPlayer[];
  if (starters.length > 0) {
    const avgMorale = starters.reduce((s, p) => s + (p.morale ?? 75), 0) / starters.length;
    bonus += (avgMorale - 70) * 0.08; // ±2.4 pts
  }

  if (team.isUserTeam && staff) {
    const coach = staff.find((s) => s.role === "head_coach");
    const analyst = staff.find((s) => s.role === "analyst");
    const psych = staff.find((s) => s.role === "psychologist");
    if (coach) bonus += (coach.rating - 60) * 0.1;
    else bonus -= 2.5; // sem técnico principal sofre no draft!
    if (analyst) bonus += (analyst.rating - 60) * 0.05;
    if (psych) bonus += (psych.rating - 60) * 0.04;
  }

  if (team.isUserTeam && manager?.style === "tactical") {
    bonus += 2.5;
  }

  return clampAttr(Math.round(base + bonus), 20, 98);
}

export function getUserPayrollPerRoundK(state: ManagerCareerState): number {
  const rosterPay = getTeamRoster(state.players, state.userTeamId).reduce(
    (s, p) => s + p.salaryPerRoundK,
    0,
  );
  const staffPay = state.staff.reduce((s, st) => s + st.salaryPerRoundK, 0);
  return rosterPay + staffPay;
}

export function getUserSponsorIncomePerRoundK(state: ManagerCareerState): number {
  const base = LEAGUE_META[state.userLeague].matchdayIncomeK;
  const fanMult = 0.72 + (state.fanApproval / 100) * 0.56; // ~0.72x a 1.28x
  const commercial = state.staff.find((s) => s.role === "commercial");
  const commMult = commercial ? 1 + (commercial.rating - 50) * 0.0085 : 1;
  const tycoonMult = state.manager.style === "tycoon" ? 1.22 : 1;
  const repMult = 0.9 + (state.manager.reputation / 100) * 0.25;
  const sponsorBonus =
    state.activeSponsor && state.activeSponsor.status === "active"
      ? state.activeSponsor.perRoundBonusK
      : 0;
  return Math.round(base * fanMult * commMult * tycoonMult * repMult) + sponsorBonus;
}

function simulateSeriesScore(
  ratingA: number,
  ratingB: number,
  bestOf: BestOf,
): { a: number; b: number } {
  const winsNeeded = Math.ceil(bestOf / 2);
  const diff = ratingA - ratingB;
  const pWinA = clampAttr(1 / (1 + Math.pow(10, -diff / 14)), 0.12, 0.88);
  let a = 0;
  let b = 0;
  while (a < winsNeeded && b < winsNeeded) {
    if (Math.random() < pWinA) a++;
    else b++;
  }
  return { a, b };
}

// ---------------------------------------------------------------------------
// Negociação Realista de Transferências
// ---------------------------------------------------------------------------

export interface TransferEvaluationReason {
  label: string;
  impact: "positive" | "neutral" | "negative";
  points: number;
  detail: string;
}

export interface TransferEvaluationResult {
  canAfford: boolean;
  inCooldown: boolean;
  clubAccepted: boolean;
  playerAccepted: boolean;
  overallChancePct: number;
  expectedSalaryK: number;
  minClubFeeK: number;
  reasons: TransferEvaluationReason[];
  headline: string;
  quote: string;
  counterSuggestion?: {
    feeK: number;
    salaryK: number;
  };
}

export function evaluateTransferOffer(params: {
  state: ManagerCareerState;
  player: CareerPlayer;
  offeredFeeK: number;
  offeredSalaryK: number;
  promisedRole: "franchise_star" | "starter" | "sub";
}): TransferEvaluationResult {
  const { state, player, offeredFeeK, offeredSalaryK, promisedRole } = params;
  const userTeam = state.teams.find((t) => t.id === state.userTeamId)!;
  const userRoster = getTeamRoster(state.players, state.userTeamId);
  const userStrength = teamCurrentStrength(userTeam, userRoster, state.staff, state.manager);
  const userLeagueMeta = LEAGUE_META[state.userLeague];
  const playerLeagueMeta =
    player.league !== "FREE_AGENT" ? LEAGUE_META[player.league] : { prestige: 55 };

  const userLeagueState = state.leagues[state.userLeague];
  const userRank = Math.max(1, userLeagueState.standingsIds.indexOf(state.userTeamId) + 1);
  const totalLeagueTeams = Math.max(6, userLeagueState.standingsIds.length);

  const scoutStaff = state.staff.find((s) => s.role === "scout");
  const scoutBonus = scoutStaff ? Math.round((scoutStaff.rating - 60) * 0.35) : 0;
  const managerStyleBonus = state.manager.style === "scout" ? 14 : 0;

  const isFreeAgent = player.league === "FREE_AGENT" || !player.teamId;
  const inCooldown = !!(player.refusalUntilStep && state.step < player.refusalUntilStep);

  // 1. Avaliação do Clube Atual (taxa de transferência)
  const minClubFeeK = isFreeAgent
    ? 0
    : Math.round(
        player.marketValueK *
          (player.overall >= 88 ? 1.15 : player.overall >= 80 ? 1.05 : 0.95) *
          (1 - (scoutStaff ? Math.min(0.12, (scoutStaff.rating - 60) * 0.003) : 0)),
      );
  const clubAccepted = isFreeAgent || offeredFeeK >= minClubFeeK;

  // 2. Expectativa salarial realista do jogador
  const prestigeSalaryFactor =
    player.league !== "FREE_AGENT" && userLeagueMeta.prestige < playerLeagueMeta.prestige
      ? 1 + (playerLeagueMeta.prestige - userLeagueMeta.prestige) * 0.018
      : 1;
  const expectedSalaryK = Math.max(
    6,
    Math.round(
      computeFairSalaryK(player.overall, state.userLeague) *
        prestigeSalaryFactor *
        (promisedRole === "sub" && player.overall >= 76 ? 1.25 : 1),
    ),
  );

  // 3. Pilares de decisão do jogador
  const reasons: TransferEvaluationReason[] = [];
  let score = 46; // base neutra

  // A) Prestígio da Liga
  const prestigeDiff = userLeagueMeta.prestige - playerLeagueMeta.prestige;
  if (isFreeAgent) {
    const pts = 16;
    score += pts;
    reasons.push({
      label: "Agente Livre",
      impact: "positive",
      points: pts,
      detail: `Sem contrato ativo, ${player.ign} busca retornar ao competitivo rapidamente.`,
    });
  } else if (prestigeDiff >= 6) {
    const pts = Math.min(24, Math.round(prestigeDiff * 1.1));
    score += pts;
    reasons.push({
      label: "Salto de Liga",
      impact: "positive",
      points: pts,
      detail: `A ${state.userLeague} tem mais visibilidade e nível competitivo do que a ${player.league}.`,
    });
  } else if (prestigeDiff <= -8) {
    // Craque de liga major sendo chamado para liga menor
    const starPenalty = player.overall >= 85 ? -28 : -16;
    const pts = Math.max(-36, Math.round(prestigeDiff * 0.8) + (starPenalty + 12));
    score += pts;
    reasons.push({
      label: "Diferença de Prestígio da Liga",
      impact: "negative",
      points: pts,
      detail: `${player.ign} hesita em trocar a ${player.league} pela ${state.userLeague} nesta fase da carreira.`,
    });
  } else {
    reasons.push({
      label: "Nível da Liga",
      impact: "neutral",
      points: 2,
      detail: `A ${state.userLeague} mantém nível competitivo compatível com o que ele procura.`,
    });
    score += 2;
  }

  // B) Projeto Esportivo & Classificação do Seu Time
  const isTopHalf = userRank <= Math.ceil(totalLeagueTeams / 2);
  const projectScore =
    Math.round((userStrength - 68) * 0.7) +
    (userRank <= 2 ? 10 : isTopHalf ? 4 : -9) +
    Math.round(((userTeam.culture ?? 50) - 50) * 0.2);
  score += projectScore;
  reasons.push({
    label: "Projeto & Força do Clube",
    impact: projectScore >= 5 ? "positive" : projectScore <= -5 ? "negative" : "neutral",
    points: projectScore,
    detail:
      projectScore >= 5
        ? `${userTeam.name} (${userStrength} OVR, #${userRank} na tabela) passa confiança para brigar por títulos e internacionais.`
        : projectScore <= -5
          ? `O momento do time (#${userRank} na liga, ${userStrength} OVR) gera dúvidas no estafe do jogador.`
          : `Clube estável no meio da tabela (#${userRank}), ainda construindo elenco.`,
  });

  // C) Papel Prometido no Elenco
  let rolePts = 0;
  if (promisedRole === "franchise_star") {
    rolePts = 14;
    reasons.push({
      label: "Projeto de Estrela da Franquia",
      impact: "positive",
      points: rolePts,
      detail: "Status de protagonista absoluto agrada muito ao jogador.",
    });
  } else if (promisedRole === "starter") {
    rolePts = 6;
    reasons.push({
      label: "Titularidade Garantida",
      impact: "positive",
      points: rolePts,
      detail: "Garantia de titularidade na line principal dá segurança esportiva.",
    });
  } else {
    rolePts = player.overall >= 76 ? -26 : -6;
    reasons.push({
      label: "Função de Reserva",
      impact: rolePts < -10 ? "negative" : "neutral",
      points: rolePts,
      detail:
        player.overall >= 76
          ? `Com ${player.overall} OVR, ${player.ign} não aceita facilmente ficar no banco.`
          : "Aceita disputar espaço vindo da reserva.",
    });
  }
  score += rolePts;

  // D) Proposta Salarial
  const salaryRatio = offeredSalaryK / Math.max(1, expectedSalaryK);
  let salPts = 0;
  if (salaryRatio >= 1.35) salPts = 24;
  else if (salaryRatio >= 1.15) salPts = 14;
  else if (salaryRatio >= 0.98) salPts = 5;
  else if (salaryRatio >= 0.8) salPts = -12;
  else salPts = -28;
  score += salPts;
  reasons.push({
    label: "Proposta Salarial",
    impact: salPts >= 5 ? "positive" : salPts < 0 ? "negative" : "neutral",
    points: salPts,
    detail:
      salPts >= 14
        ? `Salário de ${formatMoneyK(offeredSalaryK)}/rodada supera com folga a pedida de mercado (${formatMoneyK(expectedSalaryK)}).`
        : salPts >= 0
          ? `Salário dentro do esperado (${formatMoneyK(expectedSalaryK)}/rodada).`
          : `Oferta de ${formatMoneyK(offeredSalaryK)} está abaixo dos ${formatMoneyK(expectedSalaryK)}/rodada pedidos.`,
  });

  // E) Afinidade Regional & Reputação do Manager
  const sameRegion =
    player.country && LEAGUE_META[state.userLeague].regionCountries.includes(player.country);
  if (sameRegion) {
    score += 9;
    reasons.push({
      label: "Afinidade Regional",
      impact: "positive",
      points: 9,
      detail: `Mesma região cultural (${player.country}) facilita adaptação imediata.`,
    });
  }

  const totalManagerPull =
    scoutBonus + managerStyleBonus + Math.round((state.manager.reputation - 50) * 0.22);
  if (totalManagerPull !== 0) {
    score += totalManagerPull;
    reasons.push({
      label: "Poder de Convencimento & Scouting",
      impact: totalManagerPull > 0 ? "positive" : "negative",
      points: totalManagerPull,
      detail:
        totalManagerPull > 0
          ? `Sua reputação (${state.manager.reputation}) e trabalho de olheiro pesam a favor.`
          : `Reputação ainda em construção reduz o apelo da conversa.`,
    });
  }

  if (!clubAccepted) {
    reasons.unshift({
      label: "Clube Atual Recusa Multa",
      impact: "negative",
      points: -30,
      detail: `${player.teamName} exige pelo menos ${formatMoneyK(minClubFeeK)} para liberar o contrato.`,
    });
  }

  const totalCostK = offeredFeeK + offeredSalaryK;
  const canAfford = state.cashK >= totalCostK;
  const overallChancePct = clampAttr(Math.round(score), 5, 97);
  const playerAccepted = overallChancePct >= 58;

  let headline = "";
  let quote = "";
  let counterSuggestion: { feeK: number; salaryK: number } | undefined;

  if (!canAfford) {
    headline = "Caixa Insuficiente";
    quote = "O clube não possui saldo em caixa suficiente para cobrir esta proposta.";
  } else if (inCooldown) {
    headline = "Agente Pediu Tempo";
    quote = `${player.ign} encerrou conversas temporariamente após recusas recentes. Tente novamente em algumas rodadas.`;
  } else if (!clubAccepted) {
    headline = `${player.teamName} rejeitou a taxa de compra`;
    quote = `"Não liberamos ${player.ign} por menos de ${formatMoneyK(minClubFeeK)} neste momento da temporada."`;
    counterSuggestion = {
      feeK: minClubFeeK,
      salaryK: Math.max(offeredSalaryK, expectedSalaryK),
    };
  } else if (playerAccepted) {
    headline = `${player.ign} aceitou assinar com a ${userTeam.name}!`;
    quote =
      promisedRole === "franchise_star"
        ? `"O projeto apresentado para liderar a ${userTeam.tag} na ${state.userLeague} me convenceu. Estou pronto para vencer!"`
        : `"Analisei a estrutura, os companheiros e a proposta salarial. Vamos buscar o título!"`;
  } else {
    headline = `${player.ign} recusou a proposta`;
    const worst = [...reasons].sort((a, b) => a.points - b.points)[0];
    if (worst?.label.includes("Salário")) {
      quote = `"Agradeço o interesse da ${userTeam.tag}, mas financeiramente preciso de algo perto de ${formatMoneyK(Math.round(expectedSalaryK * 1.15))}/rodada."`;
    } else if (worst?.label.includes("Liga")) {
      quote = `"Com todo respeito à ${state.userLeague}, sinto que preciso permanecer na ${player.league} — só uma oferta muito acima da média mudaria minha decisão."`;
    } else if (worst?.label.includes("Reserva")) {
      quote = `"Não saio do meu clube atual para ficar no banco de reservas."`;
    } else {
      quote = `"Ainda não me sinto seguro com o momento esportivo do time para fazer essa mudança."`;
    }
    counterSuggestion = {
      feeK: minClubFeeK,
      salaryK: Math.round(expectedSalaryK * (prestigeDiff <= -8 ? 1.45 : 1.18)),
    };
  }

  return {
    canAfford,
    inCooldown,
    clubAccepted,
    playerAccepted,
    overallChancePct,
    expectedSalaryK,
    minClubFeeK,
    reasons,
    headline,
    quote,
    counterSuggestion,
  };
}

// ---------------------------------------------------------------------------
// Ações de Gestão do Clube (Transferir, Demitir, Escalar, Staff)
// ---------------------------------------------------------------------------

export function executeTransferAttempt(
  state: ManagerCareerState,
  params: {
    playerId: string;
    offeredFeeK: number;
    offeredSalaryK: number;
    promisedRole: "franchise_star" | "starter" | "sub";
  },
): { nextState: ManagerCareerState; evalResult: TransferEvaluationResult } {
  const player = state.players.find((p) => p.id === params.playerId);
  if (!player) {
    throw new Error("Jogador não encontrado");
  }
  const evalResult = evaluateTransferOffer({
    state,
    player,
    offeredFeeK: params.offeredFeeK,
    offeredSalaryK: params.offeredSalaryK,
    promisedRole: params.promisedRole,
  });

  if (!evalResult.canAfford || evalResult.inCooldown) {
    return { nextState: state, evalResult };
  }

  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;
  const userTeam = state.teams.find((t) => t.id === state.userTeamId)!;

  if (!evalResult.clubAccepted || !evalResult.playerAccepted) {
    const nextPlayers = state.players.map((p) => {
      if (p.id !== player.id) return p;
      const rej = (p.rejectionCount ?? 0) + 1;
      return {
        ...p,
        rejectionCount: rej,
        refusalUntilStep: rej >= 2 ? state.step + 2 : undefined,
      };
    });
    const nextEvents: ClubEvent[] = [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "transfer" as const,
        headline: evalResult.headline,
        detail: evalResult.quote,
        impactTags: ["Proposta recusada"],
      },
      ...state.events,
    ].slice(0, 60);

    return {
      nextState: { ...state, players: nextPlayers, events: nextEvents },
      evalResult,
    };
  }

  // Aceitou! Processa transferência
  const signingBonusK = Math.round(params.offeredSalaryK * 0.5);
  const totalOutK = params.offeredFeeK + signingBonusK;
  const shouldBeSub = params.promisedRole === "sub";
  const currentTeamPlayers = state.players.filter((p) => p.teamId === state.userTeamId);
  const currentStarterSameRole = currentTeamPlayers.find(
    (p) => p.role === player.role && !p.sub,
  );

  // Atualiza elenco: se entrou como titular/estrela, o titular anterior vira reserva (e perde moral)
  const nextPlayers = state.players.map((p) => {
    if (p.id === player.id) {
      return {
        ...p,
        teamId: userTeam.id,
        teamName: userTeam.name,
        league: state.userLeague,
        sub: shouldBeSub,
        salaryPerRoundK: params.offeredSalaryK,
        marketValueK: computePlayerMarketValueK(p.overall, p.age, state.userLeague),
        contractSplits: 3,
        morale: params.promisedRole === "franchise_star" ? 92 : 84,
        rejectionCount: 0,
        refusalUntilStep: undefined,
      };
    }
    if (!shouldBeSub && currentStarterSameRole && p.id === currentStarterSameRole.id) {
      return {
        ...p,
        sub: true,
        morale: clampAttr(p.morale - 14, 15, 100),
      };
    }
    return p;
  });

  // Mudar titular mexe na sinergia (perde 4 pts por mudança de entrosamento), mas reforço estrela empolga torcida e cultura!
  const isUpgrade =
    !currentStarterSameRole || player.overall > currentStarterSameRole.overall + 2;
  const cultureDelta = isUpgrade ? 4 : -1;
  const fanDelta = player.overall >= 82 ? 7 : isUpgrade ? 4 : 1;
  const synergyDelta = shouldBeSub ? 0 : -4;

  const nextTeams = state.teams.map((t) => {
    if (t.id !== userTeam.id) return t;
    return {
      ...t,
      synergy: clampAttr((t.synergy ?? 18) + synergyDelta, 0, 50),
      culture: clampAttr((t.culture ?? 55) + cultureDelta, 0, 100),
    };
  });

  const nextState: ManagerCareerState = {
    ...state,
    cashK: state.cashK - totalOutK,
    fanApproval: clampAttr(state.fanApproval + fanDelta, 0, 100),
    teams: nextTeams,
    players: nextPlayers,
    transactions: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        type: "transfer" as const,
        title: `Contratação: ${player.ign} (${player.role.toUpperCase()})`,
        amountK: -totalOutK,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "transfer" as const,
        headline: `${userTeam.tag} anuncia contratação de ${player.ign} (${player.overall} OVR)!`,
        detail: `${evalResult.quote} Salário: ${formatMoneyK(params.offeredSalaryK)}/rodada.`,
        impactTags: [
          `Caixa -${formatMoneyK(totalOutK)}`,
          `Torcida +${fanDelta}`,
          synergyDelta < 0 ? `Sinergia ${synergyDelta}` : "Banco reforçado",
        ],
      },
      ...state.events,
    ].slice(0, 60),
  };

  return { nextState, evalResult };
}

export function firePlayer(state: ManagerCareerState, playerId: string): ManagerCareerState {
  const player = state.players.find((p) => p.id === playerId && p.teamId === state.userTeamId);
  if (!player) return state;

  const roster = getTeamRoster(state.players, state.userTeamId);
  if (roster.length <= 5) {
    // Não permite ficar com menos de 5 jogadores no clube
    return {
      ...state,
      events: [
        {
          id: uid(),
          step: state.step,
          splitLabel: `${state.seasonYear} Split ${state.splitNumber}`,
          category: "morale" as const,
          headline: `Não foi possível dispensar ${player.ign}`,
          detail: "A liga exige no mínimo 5 jogadores no elenco. Contrate um substituto antes de demitir.",
          impactTags: ["Mínimo 5 jogadores"],
        },
        ...state.events,
      ].slice(0, 60),
    };
  }

  const severanceK = player.salaryPerRoundK * 2;
  const lockerRoomShield = state.manager.style === "locker_room" ? 0.6 : 1;
  const psych = state.staff.find((s) => s.role === "psychologist");
  const psychShield = psych ? 0.8 : 1;
  const wasPopularStarter = !player.sub && player.overall >= 76;
  const cultureDrop = Math.round((wasPopularStarter ? 7 : 3) * lockerRoomShield * psychShield);
  const fanDrop = wasPopularStarter ? 6 : 2;
  const synergyDrop = player.sub ? 0 : 3;

  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;

  // Se era titular, promove automaticamente outro da mesma role se houver reserva
  let promotedOne = false;
  const nextPlayers = state.players.map((p) => {
    if (p.id === player.id) {
      return {
        ...p,
        teamId: null,
        teamName: null,
        league: "FREE_AGENT" as const,
        marketValueK: 0,
        contractSplits: 0,
        sub: false,
        morale: 60,
      };
    }
    if (p.teamId === state.userTeamId) {
      if (!player.sub && !promotedOne && p.role === player.role && p.sub) {
        promotedOne = true;
        return { ...p, sub: false, morale: clampAttr(p.morale + 8, 0, 100) };
      }
      return { ...p, morale: clampAttr(p.morale - Math.round(cultureDrop * 0.7), 10, 100) };
    }
    return p;
  });

  const nextTeams = state.teams.map((t) =>
    t.id === state.userTeamId
      ? {
          ...t,
          culture: clampAttr((t.culture ?? 55) - cultureDrop, 0, 100),
          synergy: clampAttr((t.synergy ?? 18) - synergyDrop, 0, 50),
        }
      : t,
  );

  return {
    ...state,
    cashK: state.cashK - severanceK,
    fanApproval: clampAttr(state.fanApproval - fanDrop, 0, 100),
    teams: nextTeams,
    players: nextPlayers,
    transactions: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        type: "expense" as const,
        title: `Rescisão de contrato: ${player.ign}`,
        amountK: -severanceK,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "morale" as const,
        headline: `${player.ign} foi dispensado do elenco`,
        detail: `Multa rescisória paga (${formatMoneyK(severanceK)}). Folha salarial reduzida em ${formatMoneyK(player.salaryPerRoundK)}/rodada.`,
        impactTags: [
          `Cultura -${cultureDrop}`,
          `Torcida -${fanDrop}`,
          `Folha -${formatMoneyK(player.salaryPerRoundK)}`,
        ],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

export function toggleStarterStatus(state: ManagerCareerState, playerId: string): ManagerCareerState {
  const target = state.players.find((p) => p.id === playerId && p.teamId === state.userTeamId);
  if (!target) return state;

  const sameRolePlayers = state.players.filter(
    (p) => p.teamId === state.userTeamId && p.role === target.role,
  );
  if (sameRolePlayers.length <= 1 && !target.sub) return state; // único da função não vira reserva vazio

  const becomingStarter = !!target.sub;
  const nextPlayers = state.players.map((p) => {
    if (p.teamId !== state.userTeamId || p.role !== target.role) return p;
    if (p.id === target.id) {
      return {
        ...p,
        sub: !becomingStarter,
        morale: clampAttr(p.morale + (becomingStarter ? 9 : -10), 10, 100),
      };
    }
    if (becomingStarter && !p.sub) {
      return { ...p, sub: true, morale: clampAttr(p.morale - 10, 10, 100) };
    }
    return p;
  });

  const nextTeams = state.teams.map((t) =>
    t.id === state.userTeamId
      ? { ...t, synergy: clampAttr((t.synergy ?? 18) - 2, 0, 50) }
      : t,
  );

  return {
    ...state,
    teams: nextTeams,
    players: nextPlayers,
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel: `${state.seasonYear} Split ${state.splitNumber}`,
        category: "morale" as const,
        headline: becomingStarter
          ? `${target.ign} promovido a titular (${target.role.toUpperCase()})`
          : `${target.ign} movido para a reserva`,
        detail: "Mudança na escalação principal altera o entrosamento imediato do time.",
        impactTags: ["Sinergia -2"],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

export function hireStaffMember(state: ManagerCareerState, staffId: string): ManagerCareerState {
  const candidate = state.staffMarket.find((s) => s.id === staffId);
  if (!candidate || state.cashK < candidate.hireFeeK) return state;

  const existingSameRole = state.staff.find((s) => s.role === candidate.role);
  const severanceK = existingSameRole ? existingSameRole.salaryPerRoundK : 0;
  const totalCost = candidate.hireFeeK + severanceK;
  if (state.cashK < totalCost) return state;

  const nextStaff = [...state.staff.filter((s) => s.role !== candidate.role), candidate];
  const nextMarket = state.staffMarket.filter((s) => s.id !== candidate.id);
  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;

  const cultureBonus = candidate.rating >= 82 ? 4 : 2;
  const nextTeams = state.teams.map((t) =>
    t.id === state.userTeamId
      ? { ...t, culture: clampAttr((t.culture ?? 55) + cultureBonus, 0, 100) }
      : t,
  );

  return {
    ...state,
    cashK: state.cashK - totalCost,
    teams: nextTeams,
    staff: nextStaff,
    staffMarket: nextMarket,
    transactions: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        type: "expense" as const,
        title: `Contratação de Staff: ${candidate.name} (${STAFF_ROLE_META[candidate.role].label})`,
        amountK: -totalCost,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "staff" as const,
        headline: `${candidate.name} contratado como ${STAFF_ROLE_META[candidate.role].label}`,
        detail: `Especialidade: ${candidate.specialty} (Rating ${candidate.rating}).`,
        impactTags: [`Caixa -${formatMoneyK(totalCost)}`, `Cultura +${cultureBonus}`],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

export function fireStaffMember(state: ManagerCareerState, staffId: string): ManagerCareerState {
  const target = state.staff.find((s) => s.id === staffId);
  if (!target) return state;

  const severanceK = target.salaryPerRoundK;
  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;
  const cultureDrop = target.role === "head_coach" ? 5 : 2;

  const nextTeams = state.teams.map((t) =>
    t.id === state.userTeamId
      ? { ...t, culture: clampAttr((t.culture ?? 55) - cultureDrop, 0, 100) }
      : t,
  );

  return {
    ...state,
    cashK: state.cashK - severanceK,
    teams: nextTeams,
    staff: state.staff.filter((s) => s.id !== staffId),
    transactions: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        type: "expense" as const,
        title: `Demissão de Staff: ${target.name}`,
        amountK: -severanceK,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "staff" as const,
        headline: `${target.name} desligado da comissão técnica`,
        detail: `Folha aliviada em ${formatMoneyK(target.salaryPerRoundK)}/rodada.`,
        impactTags: [`Cultura -${cultureDrop}`, `Folha -${formatMoneyK(target.salaryPerRoundK)}`],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

// ---------------------------------------------------------------------------
// Patrocinadores Master, Propostas Recebidas e Transferências da IA
// ---------------------------------------------------------------------------

export function selectSponsorContract(
  state: ManagerCareerState,
  sponsorId: string,
): ManagerCareerState {
  const offer = (state.sponsorOffers ?? []).find((s) => s.id === sponsorId);
  if (!offer || state.activeSponsor) return state;

  const active: SponsorContract = { ...offer, status: "active" };
  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;

  return {
    ...state,
    cashK: state.cashK + active.signingBonusK,
    activeSponsor: active,
    transactions: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        type: "income" as const,
        title: `Luvas de Patrocínio: ${active.brandName}`,
        amountK: active.signingBonusK,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "finance" as const,
        headline: `Acordo assinado com ${active.brandName}!`,
        detail: `Luvas de ${formatMoneyK(active.signingBonusK)} depositadas (+${formatMoneyK(active.perRoundBonusK)}/rodada). Meta: ${active.goalLabel}.`,
        impactTags: [
          `Caixa +${formatMoneyK(active.signingBonusK)}`,
          `+${formatMoneyK(active.perRoundBonusK)}/rod.`,
        ],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

export function acceptIncomingOffer(
  state: ManagerCareerState,
  offerId: string,
): ManagerCareerState {
  const offer = (state.incomingOffers ?? []).find((o) => o.id === offerId);
  if (!offer) return state;

  const targetPlayer = state.players.find(
    (p) => p.id === offer.playerId && p.teamId === state.userTeamId,
  );
  if (!targetPlayer) {
    return {
      ...state,
      incomingOffers: (state.incomingOffers ?? []).filter((o) => o.id !== offerId),
    };
  }

  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;
  const wasStarter = !targetPlayer.sub;
  let promotedSub = false;

  const nextPlayers = state.players.map((p) => {
    if (p.id === targetPlayer.id) {
      return {
        ...p,
        teamId: offer.fromTeamId,
        teamName: offer.fromTeamName,
        league: offer.fromLeague,
        sub: false,
        salaryPerRoundK: offer.offeredSalaryK,
        marketValueK: computePlayerMarketValueK(p.overall, p.age, offer.fromLeague),
        contractSplits: 3,
        morale: 88,
      };
    }
    if (wasStarter && !promotedSub && p.teamId === state.userTeamId && p.role === targetPlayer.role && p.sub) {
      promotedSub = true;
      return { ...p, sub: false, morale: clampAttr(p.morale + 10, 10, 100) };
    }
    return p;
  });

  // Se não tinha reserva naquela função, sobe automaticamente um talento livre ou da base para não deixar a posição vazia
  const userTeam = state.teams.find((t) => t.id === state.userTeamId)!;
  const stillHasRole = nextPlayers.some(
    (p) => p.teamId === state.userTeamId && p.role === targetPlayer.role,
  );
  if (!stillHasRole) {
    const freeSameRole = nextPlayers
      .filter((p) => !p.teamId && p.role === targetPlayer.role)
      .sort((a, b) => b.overall - a.overall)[0];
    if (freeSameRole) {
      const idx = nextPlayers.findIndex((p) => p.id === freeSameRole.id);
      if (idx >= 0) {
        nextPlayers[idx] = {
          ...freeSameRole,
          teamId: userTeam.id,
          teamName: userTeam.name,
          league: state.userLeague,
          sub: false,
          marketValueK: computePlayerMarketValueK(freeSameRole.overall, freeSameRole.age, state.userLeague),
          contractSplits: 2,
          morale: 82,
        };
      }
    } else {
      const academy = makeCustomPlayer({
        ign: `${userTeam.tag}_Acad`,
        role: targetPlayer.role,
        overall: Math.max(64, targetPlayer.overall - 8),
        age: 18,
        country: LEAGUE_META[state.userLeague].regionCountries[0] ?? "BR",
      });
      const ovr = Math.round(playerOverall(academy));
      nextPlayers.push({
        ...academy,
        teamId: userTeam.id,
        teamName: userTeam.name,
        league: state.userLeague,
        overall: ovr,
        marketValueK: computePlayerMarketValueK(ovr, 18, state.userLeague),
        salaryPerRoundK: computeFairSalaryK(ovr, state.userLeague),
        contractSplits: 2,
        morale: 80,
        wins: 0,
        losses: 0,
        mvps: 0,
      });
    }
  }

  const fanHit = targetPlayer.overall >= 82 ? -5 : -2;
  const synergyHit = wasStarter ? -4 : -1;
  const nextTeams = state.teams.map((t) =>
    t.id === state.userTeamId
      ? { ...t, synergy: clampAttr((t.synergy ?? 18) + synergyHit, 0, 50) }
      : t,
  );

  const worldRecord: WorldTransferRecord = {
    id: uid(),
    step: state.step,
    splitLabel,
    playerIgn: targetPlayer.ign,
    playerRole: targetPlayer.role,
    playerOvr: targetPlayer.overall,
    fromTeamName: userTeam.name,
    fromLeague: state.userLeague,
    toTeamName: offer.fromTeamName,
    toTeamTag: offer.fromTeamTag,
    toLeague: offer.fromLeague,
    feeK: offer.offeredFeeK,
  };

  return {
    ...state,
    cashK: state.cashK + offer.offeredFeeK,
    fanApproval: clampAttr(state.fanApproval + fanHit, 0, 100),
    teams: nextTeams,
    players: nextPlayers,
    incomingOffers: (state.incomingOffers ?? []).filter((o) => o.id !== offerId),
    worldTransfers: [worldRecord, ...(state.worldTransfers ?? [])].slice(0, 50),
    transactions: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        type: "transfer" as const,
        title: `Venda de ${targetPlayer.ign} para ${offer.fromTeamName} (${offer.fromLeague})`,
        amountK: offer.offeredFeeK,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "transfer" as const,
        headline: `💰 ${targetPlayer.ign} vendido para ${offer.fromTeamName} por ${formatMoneyK(offer.offeredFeeK)}!`,
        detail: `${offer.reason}. O caixa do clube recebeu ${formatMoneyK(offer.offeredFeeK)} à vista.`,
        impactTags: [
          `Caixa +${formatMoneyK(offer.offeredFeeK)}`,
          `Sinergia ${synergyHit}`,
          `Torcida ${fanHit}`,
        ],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

export function rejectIncomingOffer(
  state: ManagerCareerState,
  offerId: string,
  giveRetentionBonus = false,
): ManagerCareerState {
  const offer = (state.incomingOffers ?? []).find((o) => o.id === offerId);
  if (!offer) return state;

  const targetPlayer = state.players.find((p) => p.id === offer.playerId);
  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;
  const bonusK = giveRetentionBonus && targetPlayer ? targetPlayer.salaryPerRoundK * 2 : 0;

  const nextPlayers = state.players.map((p) => {
    if (p.id !== offer.playerId) return p;
    if (giveRetentionBonus) {
      return {
        ...p,
        salaryPerRoundK: p.salaryPerRoundK + 3,
        morale: clampAttr(p.morale + 10, 10, 100),
      };
    }
    const moraleDelta = offer.playerDesire === "eager" ? -6 : 2;
    return {
      ...p,
      morale: clampAttr(p.morale + moraleDelta, 10, 100),
    };
  });

  const nextTransactions =
    bonusK > 0 && targetPlayer
      ? [
          {
            id: uid(),
            step: state.step,
            splitLabel,
            type: "expense" as const,
            title: `Bônus de Retenção: ${targetPlayer.ign}`,
            amountK: -bonusK,
          },
          ...state.transactions,
        ].slice(0, 80)
      : state.transactions;

  return {
    ...state,
    cashK: state.cashK - bonusK,
    fanApproval: clampAttr(state.fanApproval + 2, 0, 100),
    players: nextPlayers,
    incomingOffers: (state.incomingOffers ?? []).filter((o) => o.id !== offerId),
    transactions: nextTransactions,
    events: [
      {
        id: uid(),
        step: state.step,
        splitLabel,
        category: "transfer" as const,
        headline: `Proposta da ${offer.fromTeamName} por ${offer.playerIgn} recusada`,
        detail: giveRetentionBonus
          ? `Você valorizou ${offer.playerIgn} com bônus de retenção (${formatMoneyK(bonusK)}) e garantiu sua permanência!`
          : `A diretoria bateu o pé e recusou os ${formatMoneyK(offer.offeredFeeK)} oferecidos pela ${offer.fromTeamTag}.`,
        impactTags: giveRetentionBonus
          ? [`Caixa -${formatMoneyK(bonusK)}`, "Moral +10", "Torcida +2"]
          : offer.playerDesire === "eager"
            ? ["Moral Jogador -6", "Torcida +2"]
            : ["Elenco Mantido", "Torcida +2"],
      },
      ...state.events,
    ].slice(0, 60),
  };
}

function runAiMarketTransfers(params: {
  teams: CareerTeam[];
  players: CareerPlayer[];
  userTeamId: string;
  step: number;
  splitLabel: string;
  maxMoves: number;
}): {
  players: CareerPlayer[];
  records: WorldTransferRecord[];
  events: ClubEvent[];
} {
  const { teams, userTeamId, step, splitLabel, maxMoves } = params;
  const nextPlayers = params.players.map((p) => ({ ...p }));
  const records: WorldTransferRecord[] = [];
  const events: ClubEvent[] = [];

  const aiTeams = teams.filter((t) => t.id !== userTeamId);
  if (aiTeams.length === 0) return { players: nextPlayers, records, events };

  for (let m = 0; m < maxMoves; m++) {
    const buyer = aiTeams[(step * 3 + m * 7) % aiTeams.length];
    const buyerRoster = nextPlayers.filter((p) => p.teamId === buyer.id && !p.sub);
    if (buyerRoster.length === 0) continue;

    // Encontra o titular de menor OVR do time comprador da IA
    const weakest = [...buyerRoster].sort((a, b) => a.overall - b.overall)[0];
    if (!weakest) continue;

    // Procura um Agente Livre melhor OU reserva/titular disponível de outro time da IA
    const candidates = nextPlayers.filter(
      (p) =>
        p.teamId !== userTeamId &&
        p.teamId !== buyer.id &&
        p.role === weakest.role &&
        p.overall >= weakest.overall + 2 &&
        p.overall <= weakest.overall + 9 &&
        (!p.teamId || p.sub || LEAGUE_META[buyer.league].prestige >= LEAGUE_META[p.league as LeagueId].prestige),
    );
    if (candidates.length === 0) continue;

    const chosen = candidates[(step + m) % candidates.length];
    const fromTeamName = chosen.teamName ?? "Agente Livre";
    const fromLeague = chosen.league;
    const feeK =
      chosen.league === "FREE_AGENT"
        ? 0
        : computePlayerMarketValueK(chosen.overall, chosen.age, chosen.league);

    // Se veio de outro time da IA, o antigo titular do comprador vai no lugar para não deixar o outro time desfalcado
    const oldSellerTeamId = chosen.teamId;
    const oldSellerTeamName = chosen.teamName;
    const oldSellerLeague = chosen.league;

    for (let i = 0; i < nextPlayers.length; i++) {
      if (nextPlayers[i].id === chosen.id) {
        nextPlayers[i] = {
          ...nextPlayers[i],
          teamId: buyer.id,
          teamName: buyer.name,
          league: buyer.league,
          sub: false,
          marketValueK: computePlayerMarketValueK(chosen.overall, chosen.age, buyer.league),
        };
      } else if (nextPlayers[i].id === weakest.id) {
        if (oldSellerTeamId && oldSellerLeague !== "FREE_AGENT") {
          nextPlayers[i] = {
            ...nextPlayers[i],
            teamId: oldSellerTeamId,
            teamName: oldSellerTeamName,
            league: oldSellerLeague,
            sub: chosen.sub,
            marketValueK: computePlayerMarketValueK(weakest.overall, weakest.age, oldSellerLeague),
          };
        } else {
          nextPlayers[i] = {
            ...nextPlayers[i],
            teamId: null,
            teamName: null,
            league: "FREE_AGENT",
            sub: false,
            marketValueK: 0,
          };
        }
      }
    }

    const rec: WorldTransferRecord = {
      id: uid(),
      step,
      splitLabel,
      playerIgn: chosen.ign,
      playerRole: chosen.role,
      playerOvr: chosen.overall,
      fromTeamName,
      fromLeague,
      toTeamName: buyer.name,
      toTeamTag: buyer.tag,
      toLeague: buyer.league,
      feeK,
    };
    records.push(rec);
    events.push({
      id: uid(),
      step,
      splitLabel,
      category: "transfer" as const,
      headline: `🔄 Mercado Global: ${buyer.name} (${buyer.league}) contrata ${chosen.ign} (${chosen.overall} OVR)`,
      detail:
        feeK > 0
          ? `Transferência junto à ${fromTeamName} fechada por ${formatMoneyK(feeK)}.`
          : `Assinou sem custos vindo do mercado de Agentes Livres.`,
      impactTags: [buyer.league, `${chosen.role.toUpperCase()}`],
    });
  }

  return { players: nextPlayers, records, events };
}

function maybeGenerateIncomingOffer(params: {
  state: ManagerCareerState;
  nextPlayers: CareerPlayer[];
  step: number;
  splitLabel: string;
}): { offer: IncomingTransferOffer | null; event: ClubEvent | null } {
  const { state, nextPlayers, step, splitLabel } = params;
  const activeOffers = (state.incomingOffers ?? []).filter((o) => o.expiresAtStep > step);
  if (activeOffers.length >= 2) return { offer: null, event: null };

  // Verifica se algum jogador do usuário se destacou (OVR >= 76 ou MVPs >= 1 ou vitórias >= 3)
  const userStarters = nextPlayers.filter(
    (p) =>
      p.teamId === state.userTeamId &&
      !p.sub &&
      !activeOffers.some((o) => o.playerId === p.id) &&
      (p.overall >= 76 || p.mvps >= 1 || p.wins >= 3),
  );
  if (userStarters.length === 0) return { offer: null, event: null };

  // Gera proposta a cada ~3 rodadas ou quando há destaque
  if (step % 3 !== 0) return { offer: null, event: null };

  const standout = [...userStarters].sort(
    (a, b) => b.mvps * 4 + b.overall - (a.mvps * 4 + a.overall),
  )[0];

  // Escolhe um clube gigante interessado (prioriza ligas de alto prestígio ou rivais fortes)
  const suitors = state.teams.filter(
    (t) =>
      t.id !== state.userTeamId &&
      (LEAGUE_META[t.league].prestige >= LEAGUE_META[state.userLeague].prestige || t.elo >= 78),
  );
  if (suitors.length === 0) return { offer: null, event: null };

  const suitor = suitors[(step * 5 + standout.overall) % suitors.length];
  const baseVal = Math.max(250, computePlayerMarketValueK(standout.overall, standout.age, suitor.league));
  const premiumMult = 1.28 + ((step * 7) % 35) / 100; // 1.28x a 1.62x
  const offeredFeeK = Math.round((baseVal * premiumMult) / 10) * 10;
  const offeredSalaryK = Math.round(standout.salaryPerRoundK * 1.35);

  const suitorPrestige = LEAGUE_META[suitor.league].prestige;
  const userPrestige = LEAGUE_META[state.userLeague].prestige;
  const playerDesire: IncomingTransferOffer["playerDesire"] =
    suitorPrestige >= userPrestige + 10
      ? "eager"
      : suitorPrestige >= userPrestige
        ? "open"
        : "loyal";

  const reason =
    standout.mvps >= 2
      ? `As atuações de gala (${standout.mvps} MVPs no split) colocaram ${standout.ign} no radar da ${suitor.league}`
      : `Olheiros da ${suitor.name} (${suitor.league}) buscam um ${standout.role.toUpperCase()} de impacto imediato`;

  const offer: IncomingTransferOffer = {
    id: uid(),
    playerId: standout.id,
    playerIgn: standout.ign,
    playerRole: standout.role,
    playerOvr: standout.overall,
    fromTeamId: suitor.id,
    fromTeamName: suitor.name,
    fromTeamTag: suitor.tag,
    fromLeague: suitor.league,
    offeredFeeK,
    offeredSalaryK,
    reason,
    playerDesire,
    createdAtStep: step,
    expiresAtStep: step + 4,
  };

  const event: ClubEvent = {
    id: uid(),
    step,
    splitLabel,
    category: "transfer" as const,
    headline: `📨 Proposta Oficial Recebida: ${suitor.name} (${suitor.league}) quer comprar ${standout.ign}!`,
    detail: `Oferta milionária de ${formatMoneyK(offeredFeeK)} na mesa. Decida no painel se vende para encher o caixa ou segura o jogador.`,
    impactTags: [`Oferta ${formatMoneyK(offeredFeeK)}`, suitor.league],
  };

  return { offer, event };
}

// ---------------------------------------------------------------------------
// Avanço da Simulação (Rodadas, Playoffs, Internacional, Próximo Split)
// ---------------------------------------------------------------------------

function resolveMatch(
  match: CareerMatch,
  teamsMap: Map<string, CareerTeam>,
  playersMap: Map<string, CareerPlayer[]>,
  staff: StaffMember[],
  manager: ManagerProfile,
  forcedResult?: { winnerId: string; scoreA: number; scoreB: number },
): CareerMatch {
  if (!match.teamAId || !match.teamBId) return match;
  const teamA = teamsMap.get(match.teamAId);
  const teamB = teamsMap.get(match.teamBId);
  if (!teamA || !teamB) return match;

  const strA = teamCurrentStrength(teamA, playersMap.get(teamA.id) ?? [], staff, manager);
  const strB = teamCurrentStrength(teamB, playersMap.get(teamB.id) ?? [], staff, manager);
  const res = forcedResult
    ? { a: forcedResult.scoreA, b: forcedResult.scoreB }
    : simulateSeriesScore(strA, strB, match.bestOf);
  const winnerId = forcedResult
    ? forcedResult.winnerId
    : res.a > res.b
      ? teamA.id
      : teamB.id;
  const loserId = winnerId === teamA.id ? teamB.id : teamA.id;
  const winnerTeam = winnerId === teamA.id ? teamA : teamB;
  const winnerRoster = playersMap.get(winnerId) ?? [];

  const mvp = electMatchMvp({
    winnerTeam: { ...winnerTeam, roster: winnerRoster },
    scoreA: res.a,
    scoreB: res.b,
    isWinnerA: winnerId === teamA.id,
    game: "lol",
    isPlayoff: match.stage !== "regular",
  });

  return {
    ...match,
    scoreA: res.a,
    scoreB: res.b,
    winnerId,
    loserId,
    mvpIgn: mvp?.playerName,
    mvpRole: mvp?.role,
  };
}

export function advanceCareerRound(
  state: ManagerCareerState,
  forcedUserMatchResult?: { matchId: string; winnerId: string; scoreA: number; scoreB: number },
): ManagerCareerState {
  const splitLabel = `${state.seasonYear} Split ${state.splitNumber}`;
  const teamsMap = new Map(state.teams.map((t) => [t.id, t]));
  const playersMap = new Map<string, CareerPlayer[]>();
  for (const p of state.players) {
    if (!p.teamId) continue;
    const arr = playersMap.get(p.teamId) ?? [];
    arr.push(p);
    playersMap.set(p.teamId, arr);
  }

  let nextCash = state.cashK;
  let nextFanApproval = state.fanApproval;
  const nextManager = { ...state.manager };
  const nextTeams = state.teams.map((t) => ({ ...t }));
  const nextTeamsMap = new Map(nextTeams.map((t) => [t.id, t]));
  const nextPlayers = state.players.map((p) => ({ ...p }));
  const newTransactions: FinanceTransaction[] = [];
  const newEvents: ClubEvent[] = [];

  const userLeagueState = state.leagues[state.userLeague];
  const nextLeagues = { ...state.leagues };
  let nextInternational = state.international ? { ...state.international } : null;

  // Caso A: Torneio Internacional ativo
  if (nextInternational && nextInternational.active && !nextInternational.completed) {
    const openRound = nextInternational.matches
      .filter((m) => !m.winnerId && m.teamAId && m.teamBId)
      .reduce((min, m) => Math.min(min, m.round), 999);

    if (openRound < 999) {
      const updatedMatches = nextInternational.matches.map((m) => ({ ...m }));
      for (let i = 0; i < updatedMatches.length; i++) {
        const m = updatedMatches[i];
        if (m.round !== openRound || m.winnerId || !m.teamAId || !m.teamBId) continue;
        const forced =
          forcedUserMatchResult && forcedUserMatchResult.matchId === m.id
            ? forcedUserMatchResult
            : undefined;
        const resolved = resolveMatch(m, teamsMap, playersMap, state.staff, state.manager, forced);
        updatedMatches[i] = resolved;

        if (resolved.nextMatchId && resolved.winnerId) {
          const target = updatedMatches.find((x) => x.id === resolved.nextMatchId);
          if (target) {
            if (resolved.nextSlot === "A") target.teamAId = resolved.winnerId;
            else target.teamBId = resolved.winnerId;
          }
        }

        const isUserMatch = m.teamAId === state.userTeamId || m.teamBId === state.userTeamId;
        if (isUserMatch && resolved.winnerId) {
          const won = resolved.winnerId === state.userTeamId;
          nextManager.matchesCoached++;
          if (won) nextManager.matchesWon++;
          const oppId = resolved.teamAId === state.userTeamId ? resolved.teamBId! : resolved.teamAId!;
          const opp = teamsMap.get(oppId);
          newEvents.push({
            id: uid(),
            step: state.step + 1,
            splitLabel,
            category: "match",
            headline: `${nextInternational.name}: ${won ? "Vitória" : "Derrota"} contra ${opp?.tag ?? "Rival"} (${resolved.scoreA}–${resolved.scoreB})`,
            detail: resolved.mvpIgn ? `MVP da série: ${resolved.mvpIgn}.` : "Série internacional disputada.",
            impactTags: won ? ["Moral +5", "Reputação +3"] : ["Moral -3"],
          });
          if (won) {
            nextManager.reputation = clampAttr(nextManager.reputation + 3, 15, 100);
            nextFanApproval = clampAttr(nextFanApproval + 5, 0, 100);
          } else {
            nextFanApproval = clampAttr(nextFanApproval - 2, 0, 100);
          }

          if (resolved.isFinal) {
            const intlPrize = won ? (nextInternational.name === "Worlds" ? 2400 : 1200) : (nextInternational.name === "Worlds" ? 1100 : 550);
            nextCash += intlPrize;
            newTransactions.push({
              id: uid(),
              step: state.step + 1,
              splitLabel,
              type: "prize",
              title: won
                ? `Campeão do ${nextInternational.name}!`
                : `Vice-campeão do ${nextInternational.name}`,
              amountK: intlPrize,
            });
            if (won) {
              nextManager.titlesWon++;
              nextManager.intlTitlesWon++;
              nextManager.reputation = clampAttr(nextManager.reputation + 12, 15, 100);
              nextFanApproval = clampAttr(nextFanApproval + 15, 0, 100);
            }
          }
        }
      }

      const finalMatch = updatedMatches.find((m) => m.isFinal);
      const isDone = !!finalMatch?.winnerId;
      nextInternational = {
        ...nextInternational,
        matches: updatedMatches,
        completed: isDone,
        championId: finalMatch?.winnerId,
        runnerUpId: finalMatch?.loserId,
      };

      const nextHistory = [...state.history];
      if (isDone && finalMatch?.winnerId) {
        const champ = teamsMap.get(finalMatch.winnerId);
        const runner = finalMatch.loserId ? teamsMap.get(finalMatch.loserId) : undefined;
        const userInIntl = nextInternational.qualifiedTeamIds.includes(state.userTeamId);
        const userPlacement =
          finalMatch.winnerId === state.userTeamId
            ? "🏆 Campeão Mundial"
            : finalMatch.loserId === state.userTeamId
              ? "🥈 Vice-Campeão"
              : userInIntl
                ? "Participação Internacional"
                : "Não classificado";
        if (champ) {
          nextHistory.unshift({
            id: uid(),
            seasonYear: state.seasonYear,
            splitNumber: state.splitNumber,
            tournament: nextInternational.name,
            championTeamId: champ.id,
            championName: champ.name,
            championTag: champ.tag,
            runnerUpName: runner?.name ?? "Finalista",
            userPlacement,
          });
        }
      }

      return {
        ...state,
        step: state.step + 1,
        cashK: nextCash,
        fanApproval: nextFanApproval,
        manager: nextManager,
        international: nextInternational,
        transactions: [...newTransactions, ...state.transactions].slice(0, 80),
        events: [...newEvents, ...state.events].slice(0, 60),
        history: nextHistory.slice(0, 40),
      };
    }
  }

  // Caso B: Temporada Regular ou Playoffs das Ligas
  let userWonThisStep: boolean | null = null;
  let userPrizeEarnedK = 0;

  for (const league of ALL_LEAGUES) {
    const ls = { ...state.leagues[league] };
    const lTeams = nextTeams.filter((t) => t.league === league);
    const lIds = lTeams.map((t) => t.id);

    if (ls.stage === "regular") {
      const roundToPlay = ls.currentRound;
      const updatedReg = ls.regularMatches.map((m) => {
        if (m.round !== roundToPlay || m.winnerId) return m;
        const forced =
          forcedUserMatchResult && forcedUserMatchResult.matchId === m.id
            ? forcedUserMatchResult
            : undefined;
        const resolved = resolveMatch(m, teamsMap, playersMap, state.staff, state.manager, forced);

        // Atualiza ELO e moral básica
        if (resolved.winnerId && resolved.loserId) {
          const wt = nextTeamsMap.get(resolved.winnerId);
          const lt = nextTeamsMap.get(resolved.loserId);
          if (wt) {
            wt.elo = clampAttr(wt.elo + 1, 20, 99);
            wt.synergy = clampAttr((wt.synergy ?? 18) + 1, 0, 50);
          }
          if (lt) {
            lt.elo = clampAttr(lt.elo - 1, 20, 99);
          }
          for (const p of nextPlayers) {
            if (p.teamId === resolved.winnerId && !p.sub) {
              p.wins++;
              p.morale = clampAttr(p.morale + 2, 10, 100);
              if (resolved.mvpIgn === p.ign) p.mvps++;
            } else if (p.teamId === resolved.loserId && !p.sub) {
              p.losses++;
              p.morale = clampAttr(p.morale - 2, 10, 100);
            }
          }

          if (resolved.teamAId === state.userTeamId || resolved.teamBId === state.userTeamId) {
            const won = resolved.winnerId === state.userTeamId;
            userWonThisStep = won;
            nextManager.matchesCoached++;
            if (won) nextManager.matchesWon++;
            const oppId = resolved.teamAId === state.userTeamId ? resolved.teamBId! : resolved.teamAId!;
            const opp = teamsMap.get(oppId);
            newEvents.push({
              id: uid(),
              step: state.step + 1,
              splitLabel,
              category: "match",
              headline: `Rodada ${roundToPlay}: ${won ? "Vitória" : "Derrota"} vs ${opp?.tag ?? "Rival"} (${resolved.scoreA}–${resolved.scoreB})`,
              detail: resolved.mvpIgn ? `Destaque da série: ${resolved.mvpIgn}.` : "Partida da temporada regular.",
              impactTags: won ? ["Moral +2", "Sinergia +1", "Torcida +3"] : ["Moral -2", "Torcida -2"],
            });
          }
        }
        return resolved;
      });

      const standings = computeLeagueStandings(lIds, updatedReg, nextTeamsMap, playersMap);
      ls.regularMatches = updatedReg;
      ls.standingsIds = standings.map((s) => s.teamId);

      if (roundToPlay >= ls.totalRegularRounds) {
        ls.stage = "playoffs";
        ls.playoffMatches = buildPlayoffsForLeague(ls.standingsIds);
        if (league === state.userLeague) {
          const rank = ls.standingsIds.indexOf(state.userTeamId) + 1;
          if (rank > 0 && rank <= 4) {
            nextManager.playoffsReached++;
            const poBonus = LEAGUE_META[league].prizePoolK.playoff;
            userPrizeEarnedK += poBonus;
            newTransactions.push({
              id: uid(),
              step: state.step + 1,
              splitLabel,
              type: "prize",
              title: `Classificação aos Playoffs (#${rank} na ${league})`,
              amountK: poBonus,
            });
            newEvents.push({
              id: uid(),
              step: state.step + 1,
              splitLabel,
              category: "trophy",
              headline: `Time classificado para os Playoffs da ${league} em #${rank}!`,
              detail: `Premiação pela vaga nos playoffs garante +${formatMoneyK(poBonus)} no caixa.`,
              impactTags: [`Caixa +${formatMoneyK(poBonus)}`, "Torcida +6"],
            });
            nextFanApproval = clampAttr(nextFanApproval + 6, 0, 100);
          } else {
            newEvents.push({
              id: uid(),
              step: state.step + 1,
              splitLabel,
              category: "match",
              headline: `Fim da temporada regular (#${rank} na ${league})`,
              detail: "A equipe ficou fora dos Playoffs neste split. Hora de planejar reforços!",
              impactTags: ["Torcida -6"],
            });
            nextFanApproval = clampAttr(nextFanApproval - 6, 0, 100);
          }
        }
      } else {
        ls.currentRound = roundToPlay + 1;
      }
    } else if (ls.stage === "playoffs") {
      const openRound = ls.playoffMatches
        .filter((m) => !m.winnerId && m.teamAId && m.teamBId)
        .reduce((min, m) => Math.min(min, m.round), 999);

      if (openRound < 999) {
        const updatedPo = ls.playoffMatches.map((m) => ({ ...m }));
        for (let i = 0; i < updatedPo.length; i++) {
          const m = updatedPo[i];
          if (m.round !== openRound || m.winnerId || !m.teamAId || !m.teamBId) continue;
          const forced =
            forcedUserMatchResult && forcedUserMatchResult.matchId === m.id
              ? forcedUserMatchResult
              : undefined;
          const resolved = resolveMatch(m, teamsMap, playersMap, state.staff, state.manager, forced);
          updatedPo[i] = resolved;

          if (resolved.nextMatchId && resolved.winnerId) {
            const target = updatedPo.find((x) => x.id === resolved.nextMatchId);
            if (target) {
              if (resolved.nextSlot === "A") target.teamAId = resolved.winnerId;
              else target.teamBId = resolved.winnerId;
            }
          }

          if (resolved.winnerId && (resolved.teamAId === state.userTeamId || resolved.teamBId === state.userTeamId)) {
            const won = resolved.winnerId === state.userTeamId;
            userWonThisStep = won;
            nextManager.matchesCoached++;
            if (won) nextManager.matchesWon++;

            if (resolved.isFinal) {
              const pPool = LEAGUE_META[league].prizePoolK;
              const prize = won ? pPool.champion : pPool.runnerUp;
              userPrizeEarnedK += prize;
              newTransactions.push({
                id: uid(),
                step: state.step + 1,
                splitLabel,
                type: "prize",
                title: won
                  ? `Campeão da ${league} (${splitLabel})!`
                  : `Vice-Campeão da ${league} (${splitLabel})`,
                amountK: prize,
              });
              if (won) {
                nextManager.titlesWon++;
                nextManager.reputation = clampAttr(nextManager.reputation + 10, 15, 100);
                nextFanApproval = clampAttr(nextFanApproval + 14, 0, 100);
              } else {
                nextManager.reputation = clampAttr(nextManager.reputation + 4, 15, 100);
                nextFanApproval = clampAttr(nextFanApproval + 5, 0, 100);
              }
              newEvents.push({
                id: uid(),
                step: state.step + 1,
                splitLabel,
                category: "trophy",
                headline: won
                  ? `🏆 CAMPEÃO DA ${league}! (${resolved.scoreA}–${resolved.scoreB})`
                  : `🥈 Vice-campeão da ${league} (${resolved.scoreA}–${resolved.scoreB})`,
                detail: `Premiação oficial de ${formatMoneyK(prize)} depositada no caixa do clube!`,
                impactTags: [`Caixa +${formatMoneyK(prize)}`, won ? "Reputação +10" : "Reputação +4"],
              });
            }
          }
        }
        ls.playoffMatches = updatedPo;
        const fin = updatedPo.find((m) => m.isFinal);
        if (fin?.winnerId) {
          ls.stage = "completed";
          ls.championId = fin.winnerId;
          ls.runnerUpId = fin.loserId;
        }
      } else {
        ls.stage = "completed";
      }
    }

    nextLeagues[league] = ls;
  }

  // Receita de Patrocínio vs Folha Salarial na rodada (apenas quando sua liga joga)
  if (userLeagueState.stage !== "completed") {
    const incomeK = getUserSponsorIncomePerRoundK(state);
    const payrollK = getUserPayrollPerRoundK(state);
    const netK = incomeK - payrollK;
    nextCash += netK;

    newTransactions.push({
      id: uid(),
      step: state.step + 1,
      splitLabel,
      type: "income",
      title: state.activeSponsor
        ? `Patrocínio (${state.activeSponsor.brandName}) & Bilheteria`
        : `Patrocínios & Bilheteria (Rodada)`,
      amountK: incomeK,
    });
    newTransactions.push({
      id: uid(),
      step: state.step + 1,
      splitLabel,
      type: "expense",
      title: `Folha Salarial (Jogadores + Staff)`,
      amountK: -payrollK,
    });
  }

  nextCash += userPrizeEarnedK;

  // Avaliação de Meta da Diretoria / Patrocinador Master
  let nextActiveSponsor = state.activeSponsor ? { ...state.activeSponsor } : null;
  if (nextActiveSponsor && nextActiveSponsor.status === "active") {
    const uLs = nextLeagues[state.userLeague];
    const regRank = uLs.standingsIds.indexOf(state.userTeamId) + 1;
    const missedPlayoffsJustNow =
      userLeagueState.stage === "regular" && uLs.stage === "playoffs" && regRank > 4;
    const finishedPlayoffsJustNow =
      userLeagueState.stage === "playoffs" && uLs.stage === "completed";

    if (missedPlayoffsJustNow || finishedPlayoffsJustNow) {
      const isFinalist =
        uLs.championId === state.userTeamId || uLs.runnerUpId === state.userTeamId;
      const fulfilled =
        nextActiveSponsor.goalType === "regular_top6"
          ? regRank > 0 && regRank <= 6
          : nextActiveSponsor.goalType === "playoffs_top4"
            ? regRank > 0 && regRank <= 4
            : isFinalist;

      nextActiveSponsor.status = fulfilled ? "fulfilled" : "failed";
      if (fulfilled) {
        nextCash += nextActiveSponsor.rewardBonusK;
        nextManager.reputation = clampAttr(nextManager.reputation + 4, 15, 100);
        newTransactions.push({
          id: uid(),
          step: state.step + 1,
          splitLabel,
          type: "prize",
          title: `Meta Cumprida: ${nextActiveSponsor.brandName} (${nextActiveSponsor.goalLabel})`,
          amountK: nextActiveSponsor.rewardBonusK,
        });
        newEvents.push({
          id: uid(),
          step: state.step + 1,
          splitLabel,
          category: "finance",
          headline: `🎯 Meta do Patrocinador Cumprida (${nextActiveSponsor.brandName})!`,
          detail: `Objetivo "${nextActiveSponsor.goalLabel}" alcançado! Bônus de ${formatMoneyK(nextActiveSponsor.rewardBonusK)} creditado.`,
          impactTags: [`Caixa +${formatMoneyK(nextActiveSponsor.rewardBonusK)}`, "Reputação +4"],
        });
      } else {
        if (nextActiveSponsor.penaltyK > 0) {
          nextCash -= nextActiveSponsor.penaltyK;
          newTransactions.push({
            id: uid(),
            step: state.step + 1,
            splitLabel,
            type: "expense",
            title: `Multa Contratual: ${nextActiveSponsor.brandName} (Meta não atingida)`,
            amountK: -nextActiveSponsor.penaltyK,
          });
        }
        nextManager.reputation = clampAttr(nextManager.reputation - 3, 15, 100);
        newEvents.push({
          id: uid(),
          step: state.step + 1,
          splitLabel,
          category: "finance",
          headline: `⚠️ Meta do Patrocinador Não Atingida (${nextActiveSponsor.brandName})`,
          detail:
            nextActiveSponsor.penaltyK > 0
              ? `O objetivo "${nextActiveSponsor.goalLabel}" falhou. Multa contratual de ${formatMoneyK(nextActiveSponsor.penaltyK)} aplicada.`
              : `O objetivo "${nextActiveSponsor.goalLabel}" não foi alcançado e o bônus de fim de split não foi pago.`,
          impactTags:
            nextActiveSponsor.penaltyK > 0
              ? [`Caixa -${formatMoneyK(nextActiveSponsor.penaltyK)}`, "Reputação -3"]
              : ["Sem Bônus", "Reputação -3"],
        });
      }
    }
  }

  // Propostas recebidas por jogadores destaque do usuário + Transferências entre times da IA
  let nextIncomingOffers = (state.incomingOffers ?? []).filter(
    (o) => o.expiresAtStep > state.step + 1,
  );
  const incomingRes = maybeGenerateIncomingOffer({
    state: { ...state, incomingOffers: nextIncomingOffers },
    nextPlayers,
    step: state.step + 1,
    splitLabel,
  });
  if (incomingRes.offer) {
    nextIncomingOffers = [incomingRes.offer, ...nextIncomingOffers];
  }
  if (incomingRes.event) {
    newEvents.push(incomingRes.event);
  }

  let finalPlayers = nextPlayers;
  let nextWorldTransfers = [...(state.worldTransfers ?? [])];
  if ((state.step + 1) % 2 === 0) {
    const aiMarket = runAiMarketTransfers({
      teams: nextTeams,
      players: finalPlayers,
      userTeamId: state.userTeamId,
      step: state.step + 1,
      splitLabel,
      maxMoves: 2,
    });
    finalPlayers = aiMarket.players;
    nextWorldTransfers = [...aiMarket.records, ...nextWorldTransfers].slice(0, 60);
    newEvents.push(...aiMarket.events);
  }

  // Ajuste de psicólogo / fanApproval por resultado
  const psych = state.staff.find((s) => s.role === "psychologist");
  if (userWonThisStep === true) {
    nextFanApproval = clampAttr(nextFanApproval + 3, 0, 100);
    nextManager.reputation = clampAttr(nextManager.reputation + 1, 15, 100);
  } else if (userWonThisStep === false) {
    const lossFanHit = state.manager.style === "locker_room" || psych ? 1 : 2;
    nextFanApproval = clampAttr(nextFanApproval - lossFanHit, 0, 100);
    if (psych) {
      for (const p of finalPlayers) {
        if (p.teamId === state.userTeamId) p.morale = clampAttr(p.morale + 1, 10, 100);
      }
    }
  }

  // Se todas as ligas concluíram Playoffs e ainda não começou o Internacional, cria MSI ou Worlds!
  const allCompleted = ALL_LEAGUES.every((l) => nextLeagues[l].stage === "completed");
  const nextHistory = [...state.history];
  if (allCompleted && !nextInternational) {
    const userLs = nextLeagues[state.userLeague];
    if (userLs.championId) {
      const champ = nextTeamsMap.get(userLs.championId);
      const run = userLs.runnerUpId ? nextTeamsMap.get(userLs.runnerUpId) : undefined;
      if (champ) {
        nextHistory.unshift({
          id: uid(),
          step: state.step + 1,
          seasonYear: state.seasonYear,
          splitNumber: state.splitNumber,
          tournament: `${state.userLeague} ${splitLabel}`,
          championTeamId: champ.id,
          championName: champ.name,
          championTag: champ.tag,
          runnerUpName: run?.name ?? "Vice",
          userPlacement:
            userLs.championId === state.userTeamId
              ? "🏆 Campeão"
              : userLs.runnerUpId === state.userTeamId
                ? "🥈 Vice-Campeão"
                : `#${userLs.standingsIds.indexOf(state.userTeamId) + 1}`,
        } as SeasonHistoryEntry);
      }
    }

    // Monta Internacional (Top 1 de cada liga para MSI, ou Campeões + Vices das top ligas para Worlds)
    const intlName = state.splitNumber === 1 ? "MSI" : "Worlds";
    const qualified: string[] = [];
    for (const l of ALL_LEAGUES) {
      const ls = nextLeagues[l];
      if (ls.championId) qualified.push(ls.championId);
      if (intlName === "Worlds" && LEAGUE_META[l].intlSlots >= 2 && ls.runnerUpId) {
        qualified.push(ls.runnerUpId);
      }
    }
    const qSlice = qualified.slice(0, 8);
    // Gera chave de quartas (ou semis) para o torneio internacional
    const finalId = uid();
    const semi1 = uid();
    const semi2 = uid();
    const intlMatches: CareerMatch[] =
      qSlice.length >= 8
        ? [
            { id: uid(), round: 1, stage: "international", label: "Quartas 1", bestOf: 5, teamAId: qSlice[0], teamBId: qSlice[7], nextMatchId: semi1, nextSlot: "A" },
            { id: uid(), round: 1, stage: "international", label: "Quartas 2", bestOf: 5, teamAId: qSlice[3], teamBId: qSlice[4], nextMatchId: semi1, nextSlot: "B" },
            { id: uid(), round: 1, stage: "international", label: "Quartas 3", bestOf: 5, teamAId: qSlice[1], teamBId: qSlice[6], nextMatchId: semi2, nextSlot: "A" },
            { id: uid(), round: 1, stage: "international", label: "Quartas 4", bestOf: 5, teamAId: qSlice[2], teamBId: qSlice[5], nextMatchId: semi2, nextSlot: "B" },
            { id: semi1, round: 2, stage: "international", label: "Semifinal 1", bestOf: 5, teamAId: null, teamBId: null, nextMatchId: finalId, nextSlot: "A" },
            { id: semi2, round: 2, stage: "international", label: "Semifinal 2", bestOf: 5, teamAId: null, teamBId: null, nextMatchId: finalId, nextSlot: "B" },
            { id: finalId, round: 3, stage: "international", label: `Grande Final ${intlName}`, bestOf: 5, teamAId: null, teamBId: null, isFinal: true },
          ]
        : [
            { id: semi1, round: 1, stage: "international", label: "Semifinal 1", bestOf: 5, teamAId: qSlice[0] ?? null, teamBId: qSlice[3] ?? null, nextMatchId: finalId, nextSlot: "A" },
            { id: semi2, round: 1, stage: "international", label: "Semifinal 2", bestOf: 5, teamAId: qSlice[1] ?? null, teamBId: qSlice[2] ?? null, nextMatchId: finalId, nextSlot: "B" },
            { id: finalId, round: 2, stage: "international", label: `Grande Final ${intlName}`, bestOf: 5, teamAId: null, teamBId: null, isFinal: true },
          ];

    nextInternational = {
      name: intlName,
      active: true,
      completed: false,
      qualifiedTeamIds: qSlice,
      matches: intlMatches,
    };

    const userQual = qSlice.includes(state.userTeamId);
    newEvents.push({
      id: uid(),
      step: state.step + 1,
      splitLabel,
      category: "trophy",
      headline: userQual
        ? `🌎 Seu time se classificou para o ${intlName}!`
        : `🌎 ${intlName} começou com os campeões regionais`,
      detail: userQual
        ? "Dispute o torneio internacional para multiplicar reputação e prêmios!"
        : "Simule o torneio internacional ou avance para o próximo Split.",
      impactTags: userQual ? [`Vaga ${intlName}`] : ["Offseason próxima"],
    });
  }

  return {
    ...state,
    step: state.step + 1,
    cashK: nextCash,
    fanApproval: nextFanApproval,
    manager: nextManager,
    teams: nextTeams,
    players: finalPlayers,
    leagues: nextLeagues,
    international: nextInternational,
    activeSponsor: nextActiveSponsor,
    incomingOffers: nextIncomingOffers,
    worldTransfers: nextWorldTransfers,
    transactions: [...newTransactions, ...state.transactions].slice(0, 80),
    events: [...newEvents, ...state.events].slice(0, 60),
    history: nextHistory.slice(0, 40),
  };
}

export function startNextCareerSplit(state: ManagerCareerState): ManagerCareerState {
  const nextSplitNumber: 1 | 2 = state.splitNumber === 1 ? 2 : 1;
  const nextSeasonYear = state.splitNumber === 2 ? state.seasonYear + 1 : state.seasonYear;
  const nextSplitLabel = `${nextSeasonYear} Split ${nextSplitNumber}`;

  const analyst = state.staff.find((s) => s.role === "analyst");
  const isNewYear = nextSplitNumber === 1;

  // Evolui atributos dos jogadores no fim de temporada (ou ajuste leve entre splits)
  const evolvedPlayers: CareerPlayer[] = [];
  for (const team of state.teams) {
    const roster = state.players.filter((p) => p.teamId === team.id);
    const res = isNewYear
      ? evolveRoster(roster, {
          splitLabel: nextSplitLabel,
          champion: state.leagues[team.league]?.championId === team.id,
          winRate: 0.6,
        }).roster
      : roster;

    for (let i = 0; i < roster.length; i++) {
      const orig = roster[i];
      const upd = res[i] ?? orig;
      let nextPlayer: CareerPlayer = {
        ...orig,
        ...upd,
        overall: Math.round(playerOverall(upd)),
        wins: 0,
        losses: 0,
        mvps: 0,
      };
      // Bônus do analista de desempenho para o clube do usuário
      if (team.isUserTeam && analyst && analyst.rating >= 75 && (nextPlayer.age ?? 21) <= 23) {
        nextPlayer = {
          ...nextPlayer,
          attrs: {
            ...nextPlayer.attrs,
            mechanics: clampAttr(nextPlayer.attrs.mechanics + 1, 1, 99),
            gameIq: clampAttr(nextPlayer.attrs.gameIq + 1, 1, 99),
          },
        };
        nextPlayer.overall = Math.round(playerOverall(nextPlayer));
      }
      nextPlayer.marketValueK = computePlayerMarketValueK(
        nextPlayer.overall,
        nextPlayer.age,
        nextPlayer.league,
      );
      evolvedPlayers.push(nextPlayer);
    }
  }

  // Preserva Free Agents
  for (const p of state.players) {
    if (!p.teamId) {
      evolvedPlayers.push({ ...p, wins: 0, losses: 0, mvps: 0 });
    }
  }

  // Janela de Transferências Offseason dos Times da IA pelo mundo
  const aiOffseason = runAiMarketTransfers({
    teams: state.teams,
    players: evolvedPlayers,
    userTeamId: state.userTeamId,
    step: state.step + 1,
    splitLabel: nextSplitLabel,
    maxMoves: 5,
  });

  // Reseta calendário das ligas para o novo Split e injeta renovação anual de patrocinador
  const leagues = {} as Record<LeagueId, LeagueSeasonState>;
  for (const league of ALL_LEAGUES) {
    const lIds = state.teams.filter((t) => t.league === league).map((t) => t.id);
    const regMatches = generateDoubleRoundRobin(lIds, league === "LCK" || league === "LPL" ? 3 : 1);
    leagues[league] = {
      league,
      stage: "regular",
      currentRound: 1,
      totalRegularRounds: regMatches.reduce((mx, m) => Math.max(mx, m.round), 0),
      regularMatches: regMatches,
      playoffMatches: [],
      standingsIds: lIds,
    };
  }

  const splitGrantK = Math.round(LEAGUE_META[state.userLeague].baseCashK * 0.35);

  return {
    ...state,
    seasonYear: nextSeasonYear,
    splitNumber: nextSplitNumber,
    step: state.step + 1,
    cashK: state.cashK + splitGrantK,
    players: aiOffseason.players,
    staffMarket: generateStaffMarket(state.step + 1),
    leagues,
    international: null,
    sponsorOffers: generateSponsorOffers(state.userLeague, state.step + 1),
    activeSponsor: null,
    incomingOffers: [],
    worldTransfers: [...aiOffseason.records, ...(state.worldTransfers ?? [])].slice(0, 60),
    transactions: [
      {
        id: uid(),
        step: state.step + 1,
        splitLabel: nextSplitLabel,
        type: "income" as const,
        title: `Cota da Liga & Abertura (${nextSplitLabel})`,
        amountK: splitGrantK,
      },
      ...state.transactions,
    ].slice(0, 80),
    events: [
      {
        id: uid(),
        step: state.step + 1,
        splitLabel: nextSplitLabel,
        category: "finance" as const,
        headline: `Início do ${nextSplitLabel} — Escolha seu Novo Patrocinador Master!`,
        detail: `Cota inicial de ${formatMoneyK(splitGrantK)} liberada, ${aiOffseason.records.length} transferências da IA concluídas e 3 propostas de patrocínio na mesa.`,
        impactTags: [`Caixa +${formatMoneyK(splitGrantK)}`, "Novos Patrocinadores"],
      },
      ...aiOffseason.events,
      ...state.events,
    ].slice(0, 60),
  };
}
