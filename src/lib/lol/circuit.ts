import type {
  CareerLedger,
  Championship,
  DraftPhase,
  GameId,
  InternationalLevel,
  Phase,
  PhaseConfig,
  Team,
} from "./types";
import {
  adaptPlayoffConfig,
  buildPhaseMatches,
  createGroupsForTeams,
  renameDecider,
  uid,
} from "./generate";
import {
  computeRegionSlots,
  getOfficialRegionRanking,
  normalizeRegion,
  planInternationalField,
  playInStructure,
} from "./international";
import { detectLeaguePreset, OFFICIAL_REGION_LOGOS } from "./official-logos";
import {
  archiveCompletedChampions,
  buildFreshPhases,
  nextSeasonLabel,
  seriesRanking,
} from "./promotion";

export interface CircuitEventDef {
  id: string;
  name: string;
  shortName: string;
  month: number; // 1 to 12
  level: InternationalLevel;
  accentColor: string;
  logo: string;
  category: "major" | "minor" | "regional";
  cycle: 1 | 2 | 3; // 1 = Pós-Split 1, 2 = Pós-Split 2, 3 = Pós-Split 3
  qualifiesFrom: string;
  description: string;
  formatSummary: string;
  matchPatterns: string[];
  buildPhases: () => { name: string; kind: Phase["kind"]; config: PhaseConfig }[];
  suggestedTeamCount: number;
}

export const ANNUAL_CIRCUIT: CircuitEventDef[] = [
  // ==========================================
  // CICLO 1: PÓS-SPLIT 1 REGIONAL
  // ==========================================
  {
    id: "first-stand",
    name: "First Stand Tournament",
    shortName: "First Stand",
    month: 3, // Março (após o término do Split 1 em Jan/Fev)
    level: "minor",
    accentColor: "#00e5ff",
    logo: OFFICIAL_REGION_LOGOS.FirstStand,
    category: "minor",
    cycle: 1,
    qualifiesFrom: "Campeões do Split 1 Regional",
    description: "1º Internacional do ano! Disputado imediatamente após o Split 1 regional. Reúne apenas os campeões de cada conferência.",
    formatSummary: "Fase Suíça Relâmpago 2V/2D Bo3 → Final Four Chave Dupla Bo5",
    matchPatterns: ["first stand", "kickoff"],
    suggestedTeamCount: 8,
    buildPhases: () => [
      {
        name: "Fase Suíça Relâmpago",
        kind: "swiss",
        config: {
          kind: "swiss",
          winsToAdvance: 2,
          lossesToEliminate: 2,
          defaultBestOf: 3,
        },
      },
      {
        name: "Final Four (Chave Dupla)",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 4,
          type: "double",
          defaultBestOf: 5,
          finalBestOf: 5,
          bracketReset: false,
          mode: "auto",
        },
      },
    ],
  },

  // ==========================================
  // CICLO 2: PÓS-SPLIT 2 REGIONAL
  // ==========================================
  {
    id: "msi",
    name: "Mid-Season Invitational (MSI)",
    shortName: "MSI",
    month: 6, // Junho (após o término do Split 2 em Abr/Mai)
    level: "major",
    accentColor: "#eab308",
    logo: OFFICIAL_REGION_LOGOS.MSI,
    category: "major",
    cycle: 2,
    qualifiesFrom: "Campeões & Vices do Split 2",
    description: "Primeiro Major do ano! Disputado após os playoffs do Split 2. A elite global duela pelo troféu e vaga direta no Worlds.",
    formatSummary: "Play-In Chave Dupla Bo3 → Bracket Stage 8 Equipes Chave Dupla Bo5",
    matchPatterns: ["msi", "mid-season", "mid season", "midseason"],
    suggestedTeamCount: 12,
    buildPhases: () => [
      {
        name: "Play-in",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 8,
          type: "double",
          defaultBestOf: 3,
          finalBestOf: 3,
          bracketReset: false,
          mode: "auto",
        },
      },
      {
        name: "Bracket Stage",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 8,
          type: "double",
          defaultBestOf: 5,
          finalBestOf: 5,
          bracketReset: false,
          mode: "auto",
        },
      },
    ],
  },
  {
    id: "rift-rivals",
    name: "Rift Rivals: Batalha Continental",
    shortName: "Rift Rivals",
    month: 7, // Julho (pós-MSI)
    level: "minor",
    accentColor: "#ff4500",
    logo: OFFICIAL_REGION_LOGOS.RiftRivals,
    category: "minor",
    cycle: 2,
    qualifiesFrom: "Classificados do Split 2 (Top 2-4)",
    description: "Confronto de rivalidades continentais pós-Split 2 (Ásia LCK vs LPL, Américas CBLOL vs LCS, Ocidente LEC vs LCS).",
    formatSummary: "Grupos Continentais Turno/Returno Bo3 → King of the Hill (Gauntlet) Bo5",
    matchPatterns: ["rift rivals", "rift-rivals"],
    suggestedTeamCount: 8,
    buildPhases: () => [
      {
        name: "Fase de Grupos Continental",
        kind: "groups",
        config: {
          kind: "groups",
          format: "round-robin",
          groupCount: 2,
          doubleRoundRobin: true,
          bestOf: 3,
          qualifiersPerGroup: 2,
        },
      },
      {
        name: "King of the Hill (Gauntlet)",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 4,
          type: "single",
          defaultBestOf: 5,
          finalBestOf: 5,
          bracketReset: false,
          mode: "auto",
        },
      },
    ],
  },

  // ==========================================
  // CICLO 3: PÓS-SPLIT 3 (CHAMPIONSHIP SPLIT)
  // ==========================================
  {
    id: "global-masters",
    name: "Global Masters",
    shortName: "Global Masters",
    month: 8, // Agosto (após Split 3)
    level: "minor",
    accentColor: "#3b82f6",
    logo: OFFICIAL_REGION_LOGOS.GlobalMasters,
    category: "minor",
    cycle: 3,
    qualifiesFrom: "Top Clubes do Split 3",
    description: "Copa Mundial de Clubes com as principais forças globais do Split 3 em grupos duplos GSL e playoffs eliminatórios.",
    formatSummary: "Grupos em Chave Dupla (GSL) Bo3 → Finais Knockout Bo5",
    matchPatterns: ["global masters", "global master", "iem"],
    suggestedTeamCount: 8,
    buildPhases: () => [
      {
        name: "Grupos Estilo GSL",
        kind: "groups",
        config: {
          kind: "groups",
          format: "gsl",
          groupCount: 2,
          doubleRoundRobin: false,
          bestOf: 3,
          qualifiersPerGroup: 2,
        },
      },
      {
        name: "Finais Knockout",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 4,
          type: "single",
          defaultBestOf: 5,
          finalBestOf: 5,
          bracketReset: false,
          mode: "auto",
        },
      },
    ],
  },
  {
    id: "supercopa",
    name: "Supercopa Intercontinental",
    shortName: "Supercopa",
    month: 8, // Agosto
    level: "minor",
    accentColor: "#a855f7",
    logo: OFFICIAL_REGION_LOGOS.SuperCup,
    category: "minor",
    cycle: 3,
    qualifiesFrom: "Elite do Split 3 Regional",
    description: "Torneio de tiro curto de elite com 8 equipes e regra de Bracket Reset na Grande Final.",
    formatSummary: "Chave Dupla 8 Slots com Bracket Reset Bo5",
    matchPatterns: ["supercopa"],
    suggestedTeamCount: 8,
    buildPhases: () => [
      {
        name: "Chave Dupla com Reset",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 8,
          type: "double",
          defaultBestOf: 3,
          finalBestOf: 5,
          bracketReset: true,
          mode: "auto",
        },
      },
    ],
  },
  {
    id: "underdogs-cup",
    name: "Copa dos Desafiantes Internacional",
    shortName: "Copa Desafiantes",
    month: 9, // Setembro (antessala do Worlds)
    level: "minor",
    accentColor: "#10b981",
    logo: OFFICIAL_REGION_LOGOS.UnderdogsCup,
    category: "minor",
    cycle: 3,
    qualifiesFrom: "Regiões Desafiantes do Split 3 (CBLOL, LCP/PCS, etc.)",
    description: "Palco internacional para regiões desafiantes como CBLOL e LCP somarem pontos internacionais cruciais e lutarem por mais vagas no Mundial.",
    formatSummary: "Fase Suíça 3V/3D Bo1 → Playoffs Chave Dupla Bo5",
    matchPatterns: ["desafiante", "underdog"],
    suggestedTeamCount: 8,
    buildPhases: () => [
      {
        name: "Fase Suíça Desafiante",
        kind: "swiss",
        config: {
          kind: "swiss",
          winsToAdvance: 3,
          lossesToEliminate: 3,
          defaultBestOf: 1,
        },
      },
      {
        name: "Playoffs Chave Dupla",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 4,
          type: "double",
          defaultBestOf: 5,
          finalBestOf: 5,
          bracketReset: false,
          mode: "auto",
        },
      },
    ],
  },
  {
    id: "worlds",
    name: "Mundial (Worlds)",
    shortName: "Worlds",
    month: 10, // Outubro & Novembro (Ápice do ano)
    level: "major",
    accentColor: "#c8aa6e",
    logo: OFFICIAL_REGION_LOGOS.Worlds,
    category: "major",
    cycle: 3,
    qualifiesFrom: "Melhores dos 3 Splits & Ranking Mundial de Vagas",
    description: "O ápice supremo da temporada competitiva! Reúne as melhores equipes consagradas ao longo dos 3 splits pelo título de Campeão Mundial.",
    formatSummary: "Play-in Chave Dupla Bo3 → Fase Suíça 16 Times Bo1/Bo3 → Playoffs Knockout Bo5",
    matchPatterns: ["world", "mundial"],
    suggestedTeamCount: 16,
    buildPhases: () => [
      {
        name: "Play-in",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 8,
          type: "double",
          defaultBestOf: 3,
          finalBestOf: 3,
          bracketReset: false,
          mode: "auto",
        },
      },
      {
        name: "Fase Suíça",
        kind: "swiss",
        config: {
          kind: "swiss",
          winsToAdvance: 3,
          lossesToEliminate: 3,
          defaultBestOf: 1,
        },
      },
      {
        name: "Knockout Stage",
        kind: "bracket",
        config: {
          kind: "bracket",
          slots: 8,
          type: "double",
          defaultBestOf: 5,
          finalBestOf: 5,
          bracketReset: false,
          mode: "auto",
        },
      },
    ],
  },
];

export const MONTH_THEMES: Record<
  number,
  {
    title: string;
    subtitle: string;
    cycleBadge: string;
    cycleNumber: 1 | 2 | 3 | 4;
    icon: string;
    isSplitStage: boolean;
    splitLabel?: string;
  }
> = {
  1: {
    title: "Split 1 Regional · Início da Temporada",
    subtitle: "Abertura oficial do 1º Split das ligas regionais pelo mundo (LCK, LPL, LEC, LCS, CBLOL, LCP).",
    cycleBadge: "CICLO 1 · SPLIT 1",
    cycleNumber: 1,
    icon: "⚔️",
    isSplitStage: true,
    splitLabel: "Split 1 (Fase Regular)",
  },
  2: {
    title: "Split 1 Regional · Playoffs & Vagas",
    subtitle: "Finais do 1º Split regional: consagração dos campeões e classificação direta para o First Stand!",
    cycleBadge: "CICLO 1 · SPLIT 1",
    cycleNumber: 1,
    icon: "🏆",
    isSplitStage: true,
    splitLabel: "Split 1 (Playoffs)",
  },
  3: {
    title: "⚡ First Stand Tournament (Kickoff)",
    subtitle: "1º Internacional do ano! Disputado pelos campeões do Split 1 de cada região.",
    cycleBadge: "CICLO 1 · PÓS-SPLIT 1",
    cycleNumber: 1,
    icon: "⚡",
    isSplitStage: false,
  },
  4: {
    title: "Split 2 Regional · Início da 2ª Etapa",
    subtitle: "Início do 2º Split das ligas regionais, valendo as cobiçadas vagas no MSI e Rift Rivals.",
    cycleBadge: "CICLO 2 · SPLIT 2",
    cycleNumber: 2,
    icon: "🔥",
    isSplitStage: true,
    splitLabel: "Split 2 (Fase Regular)",
  },
  5: {
    title: "Split 2 Regional · Playoffs & Finais",
    subtitle: "Finais do 2º Split regional: campeões e vices carimbam o passaporte para o MSI!",
    cycleBadge: "CICLO 2 · SPLIT 2",
    cycleNumber: 2,
    icon: "🏆",
    isSplitStage: true,
    splitLabel: "Split 2 (Playoffs)",
  },
  6: {
    title: "👑 Mid-Season Invitational (MSI)",
    subtitle: "Primeiro Major do ano! O confronto global entre os melhores do Split 2 valendo vaga no Worlds.",
    cycleBadge: "CICLO 2 · PÓS-SPLIT 2",
    cycleNumber: 2,
    icon: "👑",
    isSplitStage: false,
  },
  7: {
    title: "⚔️ Rift Rivals & Início do Split 3",
    subtitle: "Duelo de rivalidades continentais (Rift Rivals) e abertura do 3º e decisivo Split do ano.",
    cycleBadge: "CICLO 2/3 · TRANSIÇÃO",
    cycleNumber: 3,
    icon: "⚔️",
    isSplitStage: true,
    splitLabel: "Split 3 (Início)",
  },
  8: {
    title: "Split 3 Regional (Finais) & Copas",
    subtitle: "Decisão do 3º Split regional, Global Masters e Supercopa Intercontinental com Bracket Reset.",
    cycleBadge: "CICLO 3 · SPLIT 3",
    cycleNumber: 3,
    icon: "🌐",
    isSplitStage: true,
    splitLabel: "Split 3 (Playoffs)",
  },
  9: {
    title: "🛡️ Copa dos Desafiantes & Finais de Vagas",
    subtitle: "Repescagem global para regiões emergentes somarem pontos e qualificatórias finais do Mundial.",
    cycleBadge: "CICLO 3 · PÓS-SPLIT 3",
    cycleNumber: 3,
    icon: "🛡️",
    isSplitStage: false,
  },
  10: {
    title: "🏆 World Championship · Fase Suíça",
    subtitle: "O ápice do ano! Play-In e Fase Suíça do Mundial reunindo os melhores dos 3 splits.",
    cycleBadge: "CICLO 3 · WORLDS",
    cycleNumber: 3,
    icon: "🏆",
    isSplitStage: false,
  },
  11: {
    title: "🏆 World Championship · Grande Final",
    subtitle: "Quartas, Semis e a Grande Final Mundial Bo5 para coroar o Campeão do Planeta.",
    cycleBadge: "CICLO 3 · WORLDS",
    cycleNumber: 3,
    icon: "👑",
    isSplitStage: false,
  },
  12: {
    title: "Offseason, All-Star & Hall da Fama",
    subtitle: "Janela de transferências, mercado de entressafra e coroação dos melhores da temporada.",
    cycleBadge: "OFFSEASON",
    cycleNumber: 4,
    icon: "⭐",
    isSplitStage: false,
  },
};

/**
 * Normaliza a região de um campeonato para uma das 6 ligas oficiais ativas:
 * LCK, LPL, LEC, LCS, CBLOL, LCP.
 */
export function getChampionshipRegionNorm(c: Championship): string {
  if (c.region) {
    const n = normalizeRegion(c.region);
    if (n && n !== "OUTROS" && n !== "INT") return n;
  }
  const preset = detectLeaguePreset(c.name);
  if (preset) {
    return normalizeRegion(preset.defaultRegion);
  }
  const upper = c.name.toUpperCase();
  for (const reg of ["LCK", "LPL", "LEC", "LCS", "CBLOL", "LCP", "PCS"]) {
    if (upper.includes(reg)) return normalizeRegion(reg);
  }
  return "CBLOL";
}

/**
 * Encontra se um campeonato já existente corresponde a um evento oficial do circuito.
 */
export function matchChampionshipToCircuit(c: Championship): CircuitEventDef | undefined {
  const name = c.name.toLowerCase();
  for (const event of ANNUAL_CIRCUIT) {
    if (event.matchPatterns.some((pattern) => name.includes(pattern))) {
      return event;
    }
  }
  return undefined;
}

/**
 * Puxa estritamente os times qualificados para o campeonato internacional
 * baseado nos resultados do split correspondente e no ranking do Hall da Fama.
 */
export function pickInternationalTeams(
  allChampionships: Championship[],
  def: CircuitEventDef,
  career?: CareerLedger,
): Team[] {
  const picked: Team[] = [];
  const seenNames = new Set<string>();

  // Filtra apenas ligas regionais locais
  const regionalChamps = allChampionships.filter(
    (c) => c.internationalLevel !== "major" && c.internationalLevel !== "minor" && !c.isInternational,
  );

  // Mapeia por região oficial (LCK, LPL, LEC, LCS, CBLOL, LCP)
  // Se houver múltiplas edições, escolhe a do split correspondente (ex: ciclo 1 -> split 1)
  const regionMap = new Map<string, Championship>();
  for (const c of regionalChamps) {
    const regNorm = getChampionshipRegionNorm(c);
    if (!regNorm || regNorm === "OUTROS") continue;

    const current = regionMap.get(regNorm);
    if (!current) {
      regionMap.set(regNorm, c);
    } else {
      const targetLabel = `split ${def.cycle}`;
      const isTarget =
        (c.season ?? "").toLowerCase().includes(targetLabel) ||
        c.name.toLowerCase().includes(targetLabel);
      if (isTarget) {
        regionMap.set(regNorm, c);
      }
    }
  }

  // Extrai o ranking de cada liga regional usando seriesRanking
  const regionalRankings = new Map<string, Team[]>();
  for (const [reg, champ] of regionMap.entries()) {
    try {
      const ranked = seriesRanking(champ.phases, champ.teams);
      regionalRankings.set(reg, ranked.length > 0 ? ranked : champ.teams);
    } catch {
      regionalRankings.set(reg, champ.teams);
    }
  }

  // Tabela de vagas dinâmicas do Hall da Fama (vagas por região para MSI e Worlds)
  const slotTable = computeRegionSlots(career, "lol", Array.from(regionMap.keys()));

  // Lista ordenada das 6 regiões oficiais ativas
  const officialRegions = ["LCK", "LPL", "LEC", "LCS", "CBLOL", "LCP"];

  // ==========================================
  // REGRAS DE CLASSIFICAÇÃO ESPECÍFICAS:
  // ==========================================
  if (def.id === "first-stand") {
    // ⚡ FIRST STAND: Estritamente o #1 (Campeão) de cada liga regional ativa!
    for (const reg of officialRegions) {
      const ranking = regionalRankings.get(reg);
      if (ranking && ranking.length > 0) {
        const champ = ranking[0];
        if (!seenNames.has(champ.name.toLowerCase().trim())) {
          seenNames.add(champ.name.toLowerCase().trim());
          picked.push({
            ...champ,
            id: uid(),
            region: champ.region || reg,
          });
        }
      }
    }
  } else if (def.id === "msi") {
    // 👑 MSI: Vagas dinâmicas calculadas pelo Hall da Fama (computeRegionSlots)!
    const officialRanking = getOfficialRegionRanking(career, "lol");
    for (const reg of officialRegions) {
      const ranking = regionalRankings.get(reg);
      if (!ranking || ranking.length === 0) continue;
      const quota =
        slotTable.get(reg)?.msi ??
        (officialRanking.find((r) => r.region === reg)?.msiSlots ?? 1);
      const toTake = ranking.slice(0, quota);
      for (const team of toTake) {
        if (!seenNames.has(team.name.toLowerCase().trim())) {
          seenNames.add(team.name.toLowerCase().trim());
          picked.push({
            ...team,
            id: uid(),
            region: team.region || reg,
          });
        }
      }
    }
  } else if (def.id === "rift-rivals") {
    // ⚔️ RIFT RIVALS: Top 2 de cada uma das 6 ligas regionais
    for (const reg of officialRegions) {
      const ranking = regionalRankings.get(reg);
      if (!ranking || ranking.length === 0) continue;
      const toTake = ranking.slice(0, 2);
      for (const team of toTake) {
        if (!seenNames.has(team.name.toLowerCase().trim())) {
          seenNames.add(team.name.toLowerCase().trim());
          picked.push({
            ...team,
            id: uid(),
            region: team.region || reg,
          });
        }
      }
    }
  } else if (def.id === "global-masters" || def.id === "supercopa") {
    // 🌐 GLOBAL MASTERS & 👑 SUPERCOPA: Exatamente 8 equipes
    // #1 de cada uma das 6 regiões + #2 das 2 regiões com maior pontuação no Hall da Fama
    for (const reg of officialRegions) {
      const ranking = regionalRankings.get(reg);
      if (ranking && ranking.length > 0) {
        const t = ranking[0];
        if (!seenNames.has(t.name.toLowerCase().trim())) {
          seenNames.add(t.name.toLowerCase().trim());
          picked.push({ ...t, id: uid(), region: t.region || reg });
        }
      }
    }
    // As 2 vagas extras vão para as 2 melhores regiões do ranking
    const officialRanking = getOfficialRegionRanking(career, "lol");
    const sortedByPower = officialRanking.map((r) => r.region);
    for (const reg of sortedByPower) {
      if (picked.length >= 8) break;
      const ranking = regionalRankings.get(reg);
      if (ranking && ranking.length > 1) {
        const t2 = ranking[1];
        if (!seenNames.has(t2.name.toLowerCase().trim())) {
          seenNames.add(t2.name.toLowerCase().trim());
          picked.push({ ...t2, id: uid(), region: t2.region || reg });
        }
      }
    }
  } else if (def.id === "underdogs-cup") {
    // 🛡️ COPA DOS DESAFIANTES: 4 vagas para as regiões Major (Top 2 do ranking) e 2 para as demais
    const officialRanking = getOfficialRegionRanking(career, "lol");
    for (const reg of officialRegions) {
      const ranking = regionalRankings.get(reg);
      if (!ranking || ranking.length === 0) continue;
      const isMajor = officialRanking.find((r) => r.region === reg)?.isTop2 ?? false;
      const toTake = ranking.slice(0, isMajor ? 4 : 2);
      for (const team of toTake) {
        if (!seenNames.has(team.name.toLowerCase().trim())) {
          seenNames.add(team.name.toLowerCase().trim());
          picked.push({
            ...team,
            id: uid(),
            region: team.region || reg,
          });
        }
      }
    }
  } else if (def.id === "worlds") {
    // 🏆 WORLDS: Vagas dinâmicas por região do Hall da Fama (computeRegionSlots)!
    const officialRanking = getOfficialRegionRanking(career, "lol");
    for (const reg of officialRegions) {
      const ranking = regionalRankings.get(reg);
      if (!ranking || ranking.length === 0) continue;
      const quota =
        slotTable.get(reg)?.worlds ??
        (officialRanking.find((r) => r.region === reg)?.worldsSlots ?? 2);
      const toTake = ranking.slice(0, quota);
      for (const team of toTake) {
        if (!seenNames.has(team.name.toLowerCase().trim())) {
          seenNames.add(team.name.toLowerCase().trim());
          picked.push({
            ...team,
            id: uid(),
            region: team.region || reg,
          });
        }
      }
    }
  }

  return picked;
}

/**
 * Cria um objeto completo de campeonato baseado na definição oficial do circuito,
 * nos classificados do split correspondente e gera TODAS as fases, chaves, grupos e confrontos prontos.
 */
export function buildChampionshipFromCircuitDef(
  def: CircuitEventDef,
  year: number,
  existingChampionships: Championship[],
  career?: CareerLedger,
): Championship {
  const teams = pickInternationalTeams(existingChampionships, def, career);
  const fullName = `${def.name} ${year}`;
  const draftPhases = def.buildPhases().map((p) => ({
    id: uid(),
    name: p.name,
    kind: p.kind,
    config: p.config,
  }));

  const plan = planInternationalField({
    teams,
    phases: draftPhases,
    game: "lol",
    career,
    fallbackRegion: "Internacional",
    championshipName: fullName,
  });

  const structure = plan.active ? playInStructure(plan.playInSlots, plan.qualifiersToMain) : null;

  const phases: Phase[] = draftPhases.map((dp, phaseIndex) => {
    let teamIdsForPhase: string[] = [];
    let reservedSlots = 0;
    if (plan.active) {
      if (phaseIndex === plan.playInPhaseIndex) teamIdsForPhase = plan.playInTeamIds;
      else if (phaseIndex === plan.mainPhaseIndex) {
        teamIdsForPhase = plan.directTeamIds;
        reservedSlots = plan.qualifiersToMain;
      }
    } else if (phaseIndex === 0) {
      teamIdsForPhase = teams.map((t) => t.id);
    }

    const isIntlPlayIn = plan.active && phaseIndex === plan.playInPhaseIndex;
    const isIntlMain = plan.active && phaseIndex === plan.mainPhaseIndex;
    const playInEmpty = isIntlPlayIn && teamIdsForPhase.length === 0;

    const phaseConfig = isIntlPlayIn && structure ? structure.config : dp.config;
    const config = adaptPlayoffConfig(phaseConfig, teamIdsForPhase.length + reservedSlots);
    const groups =
      config.kind === "groups"
        ? createGroupsForTeams(config, teamIdsForPhase)
        : [];

    const built = playInEmpty
      ? []
      : buildPhaseMatches(config, teamIdsForPhase, groups, reservedSlots);
    const matches =
      isIntlPlayIn && structure?.deciderLabel
        ? renameDecider(built, structure.deciderLabel)
        : built;

    return {
      id: dp.id,
      name: dp.name,
      kind:
        isIntlPlayIn && structure
          ? structure.kind === "groups"
            ? "groups"
            : "bracket"
          : dp.kind,
      config,
      groups: config.kind === "groups" ? groups : undefined,
      matches,
      seededTeamIds: teamIdsForPhase,
      directTeamIds: isIntlMain ? plan.directTeamIds : undefined,
      advanceCount: isIntlPlayIn ? (playInEmpty ? 0 : plan.qualifiersToMain) : undefined,
      internationalPlayIn: isIntlPlayIn ? true : undefined,
      skipped: playInEmpty ? true : undefined,
    };
  });

  return {
    id: uid(),
    name: fullName,
    game: "lol",
    region: "Internacional",
    season: `${year}`,
    logo: def.logo,
    accentColor: def.accentColor,
    teams,
    phases,
    countsTowardsRanking: true,
    internationalLevel: def.level,
    scheduledMonth: def.month,
    updatedAt: Date.now(),
  };
}

/**
 * Avança um campeonato internacional (Worlds, MSI, First Stand, etc.) para uma nova edição:
 * - Arquiva o campeão atual no histórico da edição
 * - Avança o label da temporada (ex.: "2025" → "2026")
 * - Limpa os times e as fases para o usuário puxar os novos classificados manualmente
 * - Mantém o mesmo ID, formato e histórico acumulado intocados
 *
 * NÃO faz auto-pull de times — o usuário escolhe os classificados via UI.
 */
export function advanceInternationalEdition(
  c: Championship,
): Championship {
  const archived = archiveCompletedChampions(c);
  const nextSeason = nextSeasonLabel(c.season);

  // Preserva o formato exato (grupos, fases, regras) mas limpa os confrontos e times
  const freshPhases = buildFreshPhases(archived.phases, []);

  return {
    ...archived,
    id: c.id,          // Mantém o ID original — sem duplicar na tela inicial
    season: nextSeason,
    teams: [],         // Vazio: usuário puxa os classificados manualmente
    formerTeams: [
      ...(c.teams ?? []),
      ...(c.formerTeams ?? []),
    ],
    phases: freshPhases,
    history: archived.history ?? [],
    updatedAt: Date.now(),
  };
}
