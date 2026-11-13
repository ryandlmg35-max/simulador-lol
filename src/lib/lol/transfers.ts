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
// Pool Global de Agentes Livres & Scouting de Novos Talentos
// ---------------------------------------------------------------------------

export const GLOBAL_FREE_AGENT_POOL: Omit<Player, "id">[] = [
  // Superestrelas Coreanas & Chinesas (Caras, exigem orçamento de time grande)
  {
    ign: "Zephyr",
    role: "mid",
    country: "KR",
    age: 20,
    attrs: { mechanics: 92, gameIq: 84, clutch: 85, mentality: 82, intlExperience: 60 },
  },
  {
    ign: "Aegis",
    role: "support",
    country: "KR",
    age: 25,
    attrs: { mechanics: 80, gameIq: 94, clutch: 90, mentality: 92, intlExperience: 85 },
  },
  {
    ign: "Predator",
    role: "jungle",
    country: "CN",
    age: 23,
    attrs: { mechanics: 89, gameIq: 86, clutch: 83, mentality: 84, intlExperience: 70 },
  },
  {
    ign: "Horizon",
    role: "top",
    country: "KR",
    age: 22,
    attrs: { mechanics: 88, gameIq: 82, clutch: 80, mentality: 79, intlExperience: 50 },
  },
  // Talentos Ocidentais (LEC / LCS)
  {
    ign: "ShadowAim",
    role: "adc",
    country: "EU",
    age: 21,
    attrs: { mechanics: 91, gameIq: 78, clutch: 82, mentality: 77, intlExperience: 55 },
  },
  {
    ign: "Colossus",
    role: "top",
    country: "EU",
    age: 26,
    attrs: { mechanics: 82, gameIq: 90, clutch: 87, mentality: 89, intlExperience: 75 },
  },
  {
    ign: "Valkyrie",
    role: "adc",
    country: "NA",
    age: 22,
    attrs: { mechanics: 86, gameIq: 83, clutch: 81, mentality: 80, intlExperience: 50 },
  },
  // Talentos Nacionais / Brasileiros (CBLOL)
  {
    ign: "TitanClaw",
    role: "top",
    country: "BR",
    age: 21,
    attrs: { mechanics: 85, gameIq: 80, clutch: 86, mentality: 82, intlExperience: 25 },
  },
  {
    ign: "Krypton",
    role: "mid",
    country: "BR",
    age: 18,
    attrs: { mechanics: 89, gameIq: 73, clutch: 85, mentality: 76, intlExperience: 18 },
  },
  {
    ign: "Vortex",
    role: "jungle",
    country: "BR",
    age: 24,
    attrs: { mechanics: 84, gameIq: 87, clutch: 88, mentality: 86, intlExperience: 45 },
  },
  {
    ign: "Solari",
    role: "support",
    country: "BR",
    age: 22,
    attrs: { mechanics: 80, gameIq: 88, clutch: 84, mentality: 82, intlExperience: 30 },
  },
  {
    ign: "Nightfall",
    role: "adc",
    country: "BR",
    age: 19,
    attrs: { mechanics: 87, gameIq: 74, clutch: 83, mentality: 78, intlExperience: 15 },
  },
  // Revelações e Jovens Promessas de Baixo Custo (Acessíveis para times menores)
  {
    ign: "Sparky",
    role: "mid",
    country: "BR",
    age: 17,
    attrs: { mechanics: 83, gameIq: 68, clutch: 74, mentality: 70, intlExperience: 5 },
  },
  {
    ign: "Bould",
    role: "top",
    country: "BR",
    age: 18,
    attrs: { mechanics: 81, gameIq: 70, clutch: 75, mentality: 72, intlExperience: 5 },
  },
  {
    ign: "Raptor",
    role: "jungle",
    country: "BR",
    age: 19,
    attrs: { mechanics: 80, gameIq: 72, clutch: 77, mentality: 74, intlExperience: 5 },
  },
  {
    ign: "Misty",
    role: "support",
    country: "BR",
    age: 18,
    attrs: { mechanics: 77, gameIq: 76, clutch: 76, mentality: 73, intlExperience: 5 },
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
    /world|mundial|\bmsi\b|first\s*stand|kickoff|rift\s*rivals|global\s*master|supercopa|desafiante/i.test(
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

  // 2. Procura no pool de Agentes Livres respeitando orçamento e limite de 2 imports
  const candidateIdx = pool.findIndex((fa) => {
    if (fa.role !== weakest.role) return false;
    const faAttrs = getResolvedAttrs(fa.attrs, fa.ign, fa.role, fa.country, fa.age);
    if (faAttrs.mechanics <= weakestAttrs.mechanics + 1) return false;
    const isImp = isPlayerImport(fa, region);
    if (isImp && currentImports >= 2 && !isPlayerImport(weakest, region)) return false;
    const salary = getPlayerSalary(fa, region, career, game);
    if (salary > budget * 0.42) return false;
    return true;
  });

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
  career?: CareerLedger;
  freeAgentsPool?: Player[];
  intensity?: "normal" | "aggressive";
}): AutonomousMarketResult {
  const { championship, career, intensity = "normal" } = params;

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

  const usedIgns = collectUsedIgns([
    ...championship.teams,
    ...(championship.serieB?.teams ?? []),
  ]);

  let pool: Player[] = (
    params.freeAgentsPool
      ? [...params.freeAgentsPool]
      : GLOBAL_FREE_AGENT_POOL.map((fa, i) => ({ ...fa, id: `fa_${i + 1}_${Date.now()}` }))
  ).filter((p) => !usedIgns.has(p.ign.trim().toLowerCase()));

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
  career?: CareerLedger;
  loserTeamId?: string;
  division?: 1 | 2;
}): { teams: Team[]; serieBTeams?: Team[]; news: TransferNews[] } {
  const { championship, career, loserTeamId, division = 1 } = params;
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

  const usedIgns = collectUsedIgns([
    ...championship.teams,
    ...(championship.serieB?.teams ?? []),
  ]);
  const pool: Player[] = GLOBAL_FREE_AGENT_POOL
    .map((fa, i) => ({ ...fa, id: `fa_${i + 1}_${Date.now()}` }))
    .filter((p) => !usedIgns.has(p.ign.trim().toLowerCase()));

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
