import type { CareerTeam, Championship, Match, Player, Team } from "./types";
import { effectiveRating, ensureRoster, getResolvedAttrs, hashStr, pickStarters } from "./players";
import { isInternationalChamp } from "./store";

export interface ResolvedPlayer extends Player {
  resolved: Required<Player["attrs"]>;
  overall: number;
}

export interface PressQuestion {
  id: string;
  outlet: string;
  journalist: string;
  topicTag: string;
  speakerName: string;
  speakerRole: string;
  speakerBadge: string;
  speakerTone: "gold" | "emerald" | "blood" | "blue" | "purple";
  question: string;
  answer: string;
  statCallout: string;
}

export interface PressFactorComparison {
  label: string;
  winnerVal: string | number;
  loserVal: string | number;
  advantage: "winner" | "loser" | "even";
  detail: string;
}

export interface PressConferenceData {
  isGrandFinal: boolean;
  isInternational: boolean;
  storylineBadge: string;
  headline: string;
  subheadline: string;
  tacticalSummary: string;
  winnerScore: number;
  loserScore: number;
  keyFactors: PressFactorComparison[];
  winnerQuestions: PressQuestion[];
  loserQuestions: PressQuestion[];
}

const ROLE_PT: Record<string, string> = {
  top: "TOP LANER",
  jungle: "JUNGLER",
  mid: "MID LANER",
  adc: "ATIRADOR (ADC)",
  support: "SUPORTE",
};

type ExpectationTier = "major_contender" | "regional_power" | "underdog";
type SeriesCause =
  | "mechanics_gap"
  | "macro_iq"
  | "clutch_mentality"
  | "intl_experience"
  | "adapt_draft"
  | "balanced";

function pickVariant<T>(seedBase: string, salt: string, options: T[]): T {
  const idx = hashStr(`${seedBase}:${salt}`) % options.length;
  return options[idx];
}

function resolveTeamStarters(team: Team): ResolvedPlayer[] {
  const raw = pickStarters(ensureRoster(team) ?? []);
  return raw.map((p) => {
    const resolved = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
    const overall = Math.round(
      resolved.mechanics * 0.32 +
        resolved.gameIq * 0.28 +
        resolved.clutch * 0.2 +
        resolved.consistency * 0.1 +
        resolved.mentality * 0.1,
    );
    return { ...p, resolved, overall };
  });
}

function avgAttr(players: ResolvedPlayer[], key: keyof Required<Player["attrs"]>): number {
  if (players.length === 0) return 70;
  const sum = players.reduce((acc, p) => acc + (p.resolved[key] ?? 70), 0);
  return Math.round(sum / players.length);
}

function classifyExpectation(
  team: Team,
  elo: number,
  titles: number,
  isIntl: boolean,
  isWorldCup: boolean,
): ExpectationTier {
  const reg = (team.region ?? "").trim().toUpperCase();
  const isTraditionalMajor = ["LCK", "LPL", "KR", "CN"].includes(reg);
  const isMidMajor = ["LEC", "LCS", "EU", "US", "NA", "DK", "FR", "DE", "ES"].includes(reg);

  if (isWorldCup) {
    if (["KR", "CN", "LCK", "LPL"].includes(reg) || elo >= 74) return "major_contender";
    if (elo >= 63 || isMidMajor) return "regional_power";
    return "underdog";
  }

  if (isIntl) {
    if (isTraditionalMajor || elo >= 76 || titles >= 3) return "major_contender";
    if (isMidMajor || elo >= 67) return "regional_power";
    return "underdog";
  }

  // Liga local
  if (elo >= 68 || titles >= 2) return "major_contender";
  if (elo >= 56) return "regional_power";
  return "underdog";
}

function detectSeriesCause(diffs: {
  mech: number;
  iq: number;
  clutch: number;
  mental: number;
  intl: number;
  adapt: number;
  isIntl: boolean;
  isSilverScrapes: boolean;
}): SeriesCause {
  if (diffs.isIntl && diffs.intl >= 6 && diffs.mental >= 2) return "intl_experience";
  if (diffs.isSilverScrapes && diffs.clutch >= 1) return "clutch_mentality";

  const ranked: { cause: SeriesCause; score: number }[] = [
    { cause: "mechanics_gap", score: diffs.mech },
    { cause: "macro_iq", score: diffs.iq },
    { cause: "clutch_mentality", score: Math.round((diffs.clutch + diffs.mental) / 2) },
    { cause: "adapt_draft", score: diffs.adapt },
  ];
  ranked.sort((a, b) => b.score - a.score);
  if (ranked[0].score >= 3) return ranked[0].cause;
  return "balanced";
}

function getOutletsForContext(game: string, region?: string, isIntl?: boolean, isWorldCup?: boolean) {
  if (game === "cs2") {
    return [
      { outlet: "HLTV.org", journalist: "Striker" },
      { outlet: "Draft5", journalist: "Roque" },
      { outlet: "Dust2 Brasil", journalist: "Bida" },
      { outlet: "ESL Broadcast Desk", journalist: "SPUNJ" },
      { outlet: "GameArena CS", journalist: "Mch" },
    ];
  }
  if (isWorldCup) {
    return [
      { outlet: "World Cup Press Pool", journalist: "Sjokz" },
      { outlet: "Inven Global", journalist: "Ashley Kang" },
      { outlet: "Mais Esports", journalist: "Eric Teixeira" },
      { outlet: "Sheep Esports", journalist: "Wooloo" },
      { outlet: "Bancada das Seleções", journalist: "Caedrel" },
    ];
  }
  if (isIntl) {
    return [
      { outlet: "Inven Global", journalist: "Ashley Kang" },
      { outlet: "Mais Esports", journalist: "Eric Teixeira" },
      { outlet: "Sheep Esports", journalist: "Wooloo" },
      { outlet: "PentaQ China", journalist: "Ran" },
      { outlet: "LoL Esports Global Desk", journalist: "Sjokz" },
    ];
  }
  const reg = (region ?? "").toUpperCase();
  if (reg === "CBLOL" || reg === "BR") {
    return [
      { outlet: "Mais Esports", journalist: "Eric Teixeira" },
      { outlet: "Ilha das Lendas", journalist: "Baiano" },
      { outlet: "ge.globo Esports", journalist: "Chandy Teixeira" },
      { outlet: "MGG Brasil", journalist: "Schaeppi" },
      { outlet: "Coletiva Oficial CBLOL", journalist: "Takeshi" },
    ];
  }
  if (reg === "LCK" || reg === "KR") {
    return [
      { outlet: "Inven Global", journalist: "Ashley Kang" },
      { outlet: "Daily Esports KR", journalist: "Kenzi" },
      { outlet: "FOMOS Korea", journalist: "Kim Yong-woo" },
      { outlet: "LCK Press Room", journalist: "Wolf" },
      { outlet: "Korizon Esports", journalist: "Kevin Kim" },
    ];
  }
  return [
    { outlet: "Sheep Esports", journalist: "Brieuc Seeger" },
    { outlet: "Mais Esports", journalist: "Eric Teixeira" },
    { outlet: "Inven Global", journalist: "Ashley Kang" },
    { outlet: "Dot Esports", journalist: "Tyler Esguerra" },
    { outlet: "Bancada Oficial", journalist: "Caedrel" },
  ];
}

export function buildPressConference(params: {
  championship: Championship;
  match: Match;
  winnerTeam: Team;
  loserTeam: Team;
  isGrandFinal: boolean;
  career?: Record<string, CareerTeam>;
}): PressConferenceData {
  const { championship, match, winnerTeam, loserTeam, isGrandFinal, career } = params;
  const game = championship.game ?? "lol";
  const isIntl = isInternationalChamp(championship);
  const isWorldCup = /copa do mundo|world cup|seleções|selecoes/i.test(championship.name ?? "");
  const seedBase = `${championship.id}:${match.id}:${winnerTeam.id}:${loserTeam.id}`;

  const winnerScore =
    Math.max(match.scoreA ?? 0, match.scoreB ?? 0) ||
    (match.bestOf === 5 ? 3 : match.bestOf === 3 ? 2 : 1);
  const loserScore = Math.min(match.scoreA ?? 0, match.scoreB ?? 0);
  const scoreStr = `${winnerScore}×${loserScore}`;
  const isSweep = loserScore === 0 && winnerScore >= 2;
  const isSilverScrapes =
    (match.bestOf === 5 && winnerScore === 3 && loserScore === 2) ||
    (match.bestOf === 3 && winnerScore === 2 && loserScore === 1);

  const wStarters = resolveTeamStarters(winnerTeam);
  const lStarters = resolveTeamStarters(loserTeam);

  const wMech = avgAttr(wStarters, "mechanics");
  const lMech = avgAttr(lStarters, "mechanics");
  const wIq = avgAttr(wStarters, "gameIq");
  const lIq = avgAttr(lStarters, "gameIq");
  const wClutch = avgAttr(wStarters, "clutch");
  const lClutch = avgAttr(lStarters, "clutch");
  const wMental = avgAttr(wStarters, "mentality");
  const lMental = avgAttr(lStarters, "mentality");
  const wIntl = avgAttr(wStarters, "intlExperience");
  const lIntl = avgAttr(lStarters, "intlExperience");
  const wAdapt = avgAttr(wStarters, "adaptability");
  const lAdapt = avgAttr(lStarters, "adaptability");

  const wCareer = career?.[winnerTeam.name.trim().toLowerCase()];
  const lCareer = career?.[loserTeam.name.trim().toLowerCase()];
  const wElo = Math.round(
    effectiveRating(wCareer?.rating ?? 50, ensureRoster(winnerTeam), winnerTeam.synergy, winnerTeam.culture),
  );
  const lElo = Math.round(
    effectiveRating(lCareer?.rating ?? 50, ensureRoster(loserTeam), loserTeam.synergy, loserTeam.culture),
  );
  const wTitles = wCareer?.titles ?? 0;
  const lTitles = lCareer?.titles ?? 0;

  const wExpectation = classifyExpectation(winnerTeam, wElo, wTitles, isIntl, isWorldCup);
  const lExpectation = classifyExpectation(loserTeam, lElo, lTitles, isIntl, isWorldCup);

  const isUpset = lElo - wElo >= 5 || (lMech - wMech >= 4 && lTitles > wTitles);
  const isIntlChoke =
    isIntl &&
    ((lMech >= wMech && lIntl + 6 < wIntl) ||
      (lElo >= wElo && lMental < wMental) ||
      (lTitles >= 2 && loserScore <= 1));

  const seriesCause = detectSeriesCause({
    mech: wMech - lMech,
    iq: wIq - lIq,
    clutch: wClutch - lClutch,
    mental: wMental - lMental,
    intl: wIntl - lIntl,
    adapt: wAdapt - lAdapt,
    isIntl,
    isSilverScrapes,
  });

  // Protagonistas do time vencedor
  const mvpIgn = match.mvp?.playerName;
  const wMvpPlayer =
    wStarters.find((p) => p.ign.toLowerCase() === (mvpIgn ?? "").toLowerCase()) ??
    [...wStarters].sort(
      (a, b) =>
        b.resolved.mechanics + b.resolved.clutch - (a.resolved.mechanics + a.resolved.clutch),
    )[0];

  const wIglPlayer =
    [...wStarters]
      .filter((p) => p.id !== wMvpPlayer?.id)
      .sort(
        (a, b) =>
          b.resolved.gameIq + b.resolved.adaptability - (a.resolved.gameIq + a.resolved.adaptability),
      )[0] ?? wStarters[0];

  const wClutchPlayer =
    [...wStarters]
      .filter((p) => p.id !== wMvpPlayer?.id && p.id !== wIglPlayer?.id)
      .sort(
        (a, b) =>
          b.resolved.clutch + b.resolved.mentality - (a.resolved.clutch + a.resolved.mentality),
      )[0] ??
    wStarters[1] ??
    wStarters[0];

  const wAggressivePlayer =
    [...wStarters]
      .filter(
        (p) =>
          p.id !== wMvpPlayer?.id && p.id !== wIglPlayer?.id && p.id !== wClutchPlayer?.id,
      )
      .sort(
        (a, b) =>
          b.resolved.aggression + b.resolved.mechanics - (a.resolved.aggression + a.resolved.mechanics),
      )[0] ??
    wStarters[2] ??
    wStarters[0];

  // Protagonistas do time eliminado / vice
  const lChokePlayer =
    [...lStarters].sort((a, b) => {
      const aScore = isIntl
        ? a.resolved.intlExperience * 0.45 + a.resolved.mentality * 0.35 + a.resolved.clutch * 0.2
        : a.resolved.mentality * 0.5 + a.resolved.clutch * 0.5;
      const bScore = isIntl
        ? b.resolved.intlExperience * 0.45 + b.resolved.mentality * 0.35 + b.resolved.clutch * 0.2
        : b.resolved.mentality * 0.5 + b.resolved.clutch * 0.5;
      return aScore - bScore;
    })[0] ?? lStarters[0];

  const lLoneStar =
    [...lStarters]
      .filter((p) => p.id !== lChokePlayer?.id)
      .sort(
        (a, b) =>
          b.resolved.mechanics + b.resolved.consistency - (a.resolved.mechanics + a.resolved.consistency),
      )[0] ?? lStarters[0];

  const lCaptain =
    [...lStarters]
      .filter((p) => p.id !== lChokePlayer?.id && p.id !== lLoneStar?.id)
      .sort((a, b) => (b.age ?? 20) * 3 + b.resolved.gameIq - ((a.age ?? 20) * 3 + a.resolved.gameIq))[0] ??
    lStarters[1] ??
    lStarters[0];

  const lTacticalPlayer =
    [...lStarters]
      .filter(
        (p) =>
          p.id !== lChokePlayer?.id && p.id !== lLoneStar?.id && p.id !== lCaptain?.id,
      )
      .sort((a, b) => a.resolved.adaptability - b.resolved.adaptability)[0] ??
    lStarters[2] ??
    lStarters[0];

  const loserCounterpartToMvp =
    lStarters.find((p) => p.role === wMvpPlayer?.role) ?? lChokePlayer;

  const outlets = getOutletsForContext(game, championship.region, isIntl, isWorldCup);
  const stageLabel = isGrandFinal
    ? `Grande Final do ${championship.name} (${championship.season ?? "Edição Atual"})`
    : `${match.roundName ?? "Fase Eliminatória"} do ${championship.name}`;

  // Storyline & Headline
  let storylineBadge = isGrandFinal ? "COLETIVA PÓS-TÍTULO" : "COLETIVA DE ELIMINAÇÃO";
  let headline = "";
  let subheadline = "";

  if (isGrandFinal) {
    if (isWorldCup) {
      storylineBadge = "CAMPEÃ MUNDIAL DE SELEÇÕES";
      headline = `${winnerTeam.name} bate ${loserTeam.name} por ${scoreStr} e conquista a ${championship.name}!`;
      subheadline = `Com atuação decisiva de ${wMvpPlayer?.ign ?? winnerTeam.tag} e comando de ${winnerTeam.coach ?? "sua comissão técnica"}, a seleção fecha o ano no topo do mundo.`;
    } else if (isSweep) {
      storylineBadge = "DOMINÂNCIA ABSOLUTA NA FINAL";
      headline = `${winnerTeam.name} atropela ${loserTeam.name} por ${scoreStr} e ergue a taça do ${championship.name}`;
      subheadline = `Com atuação implacável de ${wMvpPlayer?.ign ?? winnerTeam.tag} e leitura macro superior (${wIq} vs ${lIq}), ${winnerTeam.name} não deu margem para reação.`;
    } else if (isSilverScrapes) {
      storylineBadge = "SILVER SCRAPES HISTÓRICO";
      headline = `No limite dos nervos! ${winnerTeam.name} vence ${loserTeam.name} por ${scoreStr} em final épica`;
      subheadline = `Decidida nos detalhes do último mapa, a frieza sob pressão (Clutch ${wClutch} vs ${lClutch}) coroou a campanha da ${winnerTeam.tag}.`;
    } else if (isUpset) {
      storylineBadge = "ZEBRA HISTÓRICA PELO TÍTULO";
      headline = `Contra todas as projeções, ${winnerTeam.name} derruba a favorita ${loserTeam.name} (${scoreStr}) e é campeã!`;
      subheadline = `Mesmo entrando como azarão (${wElo} vs ${lElo} de ELO), a ${winnerTeam.tag} puniu os erros adversários e levantou o troféu.`;
    } else {
      storylineBadge = isIntl ? "CONSAGRAÇÃO INTERNACIONAL" : "HEGEMONIA CONFIRMADA";
      headline = `${winnerTeam.name} supera ${loserTeam.name} por ${scoreStr} e conquista o ${championship.name}`;
      subheadline = `Liderada por ${wMvpPlayer?.ign ?? winnerTeam.tag} (${match.mvp ? `KDA ${match.mvp.kda} · Rating ${match.mvp.rating}` : `Mecânica ${wMvpPlayer?.resolved.mechanics}`}), a equipe controlou os momentos críticos da decisão.`;
    }
  } else {
    if (isIntlChoke) {
      storylineBadge = "CHOQUE NO PALCO INTERNACIONAL";
      headline = `${loserTeam.name} sente o peso da série e cai para ${winnerTeam.name} (${scoreStr})`;
      subheadline = `A diferença de experiência internacional (${lIntl} vs ${wIntl}) e a queda de controle sob pressão custaram a sequência no ${championship.name}.`;
    } else if (isUpset) {
      storylineBadge = "GIANT SLAYER NOS PLAYOFFS";
      headline = `Surpresa no ${championship.name}: ${winnerTeam.name} elimina ${loserTeam.name} por ${scoreStr}!`;
      subheadline = `Favorita no papel (ELO ${lElo}), a ${loserTeam.tag} não conseguiu conter a adaptação (${wAdapt}) e o ímpeto de ${wMvpPlayer?.ign ?? winnerTeam.tag}.`;
    } else if (isSweep) {
      storylineBadge = "ATROPELO ELIMINATÓRIO";
      headline = `Sem resposta tática, ${loserTeam.name} sofre ${scoreStr} da ${winnerTeam.name} e deixa o ${championship.name}`;
      subheadline = `Do draft à execução de mapa, a ${winnerTeam.tag} dominou o ritmo da série do início ao fim.`;
    } else {
      storylineBadge = "DRAMA DE ELIMINAÇÃO";
      headline = `${winnerTeam.name} supera ${loserTeam.name} por ${scoreStr} e avança no ${championship.name}`;
      subheadline = `Na ${match.roundName ?? "chave eliminatória"}, a consistência de ${wMvpPlayer?.ign ?? winnerTeam.tag} pesou nos momentos decisivos.`;
    }
  }

  const causeTextMap: Record<SeriesCause, string> = {
    mechanics_gap: `a superioridade mecânica nas rotas (${wMech} vs ${lMech}) abriu vantagens logo no early game`,
    macro_iq: `a leitura de mapa e controle de objetivos (${wIq} vs ${lIq} de QI coletivo) sufocou qualquer tentativa de resposta`,
    clutch_mentality: `a frieza nos momentos decisivos (Clutch ${wClutch} vs ${lClutch} e Mentalidade ${wMental} vs ${lMental}) definiu os mapas apertados`,
    intl_experience: `a bagagem internacional (${wIntl} vs ${lIntl}) pesou na hora de converter vantagens sob pressão de palco`,
    adapt_draft: `a velocidade de adaptação entre mapas (${wAdapt} vs ${lAdapt}) desmontou o plano de draft adversário`,
    balanced: `os detalhes de execução coletiva e tempo de resposta em lutas por objetivo desequilibraram uma série parelha`,
  };

  const tacticalSummary = `Radiografia da Série (${scoreStr}): No duelo pelo ${stageLabel}, ${causeTextMap[seriesCause]}. ${wMvpPlayer?.ign} (${ROLE_PT[wMvpPlayer?.role ?? "mid"]}) liderou o ritmo de ${winnerTeam.tag} contra ${loserCounterpartToMvp?.ign}, enquanto ${loserTeam.tag} dependeu demais de lampejos individuais de ${lLoneStar?.ign}.`;

  const keyFactors: PressFactorComparison[] = [
    {
      label: "Mecânica de Rota",
      winnerVal: wMech,
      loserVal: lMech,
      advantage: wMech > lMech ? "winner" : lMech > wMech ? "loser" : "even",
      detail: `${wMvpPlayer?.ign} (${wMvpPlayer?.resolved.mechanics}) vs ${lLoneStar?.ign} (${lLoneStar?.resolved.mechanics})`,
    },
    {
      label: "QI de Jogo & Macro",
      winnerVal: wIq,
      loserVal: lIq,
      advantage: wIq > lIq ? "winner" : lIq > wIq ? "loser" : "even",
      detail: `Adaptação tática: ${winnerTeam.tag} ${wAdapt} vs ${loserTeam.tag} ${lAdapt}`,
    },
    {
      label: "Decisão (Clutch)",
      winnerVal: wClutch,
      loserVal: lClutch,
      advantage: wClutch > lClutch ? "winner" : lClutch > wClutch ? "loser" : "even",
      detail: isSilverScrapes ? "Decisivo no mapa final" : "Execução em lutas de objetivo",
    },
    {
      label: isIntl ? "Bagagem Internacional" : "Blindagem Mental",
      winnerVal: isIntl ? wIntl : wMental,
      loserVal: isIntl ? lIntl : lMental,
      advantage: (isIntl ? wIntl : wMental) >= (isIntl ? lIntl : lMental) ? "winner" : "loser",
      detail: isIntl
        ? `Mentalidade: ${winnerTeam.tag} ${wMental} vs ${loserTeam.tag} ${lMental}`
        : `Resistência a tilt na série Bo${match.bestOf}`,
    },
    {
      label: "ELO & Histórico",
      winnerVal: `${wElo} pts`,
      loserVal: `${lElo} pts`,
      advantage: wElo >= lElo ? "winner" : "loser",
      detail: `Títulos na carreira: ${winnerTeam.tag} (${wTitles}) vs ${loserTeam.tag} (${lTitles})`,
    },
  ];

  // =========================================================================
  // RESPOSTAS CONTEXTUAIS DO TIME VENCEDOR
  // =========================================================================
  const wMvpContextClosing = isWorldCup
    ? isGrandFinal
      ? `Conquistar a ${championship.name} defendendo nosso país depois de reunir jogadores de ligas diferentes é algo que vamos lembrar pra sempre.`
      : `Representar nossa bandeira contra ${loserTeam.name} exige entrega máxima em cada luta.`
    : isGrandFinal
      ? wExpectation === "underdog"
        ? `Quase ninguém colocava a ${winnerTeam.name} como postulante ao título no começo, mas provamos dentro do servidor que merecemos esse troféu do ${championship.name}.`
        : `Erguer o troféu do ${championship.name} por ${scoreStr} confirma o nível de cobrança que temos todos os dias nos treinos.`
      : wExpectation === "underdog"
        ? `Sabíamos que entrávamos como azarões contra a ${loserTeam.name}, então cada mapa ganho foi comemorado com pé no chão. Agora é seguir sonhando jogo a jogo.`
        : `Passar pela ${loserTeam.name} por ${scoreStr} nos mantém vivos na briga, mas o objetivo aqui ainda não terminou.`;

  const wMvpAnswer = pickVariant(seedBase, "w-mvp", [
    `"Desde os treinos desta semana percebemos que a ${loserTeam.name} jogava muito em torno de ${loserCounterpartToMvp?.ign} e ${lLoneStar?.ign}. Quando senti no primeiro mapa que conseguia punir as janelas de ${loserCounterpartToMvp?.ign}, chamei o ${wIglPlayer?.ign} para acelerar o meu lado. A partir daí controlamos o ritmo da série. ${wMvpContextClosing}"`,
    `"Não foi um jogo simples contra a ${loserTeam.name}, principalmente porque ${loserCounterpartToMvp?.ign} tentou contestar bastante as primeiras ondas. Mas hoje minha leitura de troca encaixou muito bem e consegui transformar pequenas vantagens de rota em pressão para o time todo. ${wMvpContextClosing}"`,
    `"Quando entramos no servidor para esse ${scoreStr}, o combinado era não deixar ${lLoneStar?.ign} confortável. A gente respeita muito o histórico da ${loserTeam.tag}, mas hoje fomos mais precisos nas lutas de objetivo e isso fez a diferença. ${wMvpContextClosing}"`,
  ]);

  const wIglAnswerByCause: Record<SeriesCause, string[]> = {
    mechanics_gap: [
      `"Hoje nossos laners ganharam praticamente todos os duelos de 1v1 e 2v2 cedo, o que facilitou muito meu trabalho de shotcaller. Com pressão nas três rotas, eu e o ${wMvpPlayer?.ign} conseguíamos invadir a selva adversária sem risco e negar visão da ${loserTeam.name} antes mesmo dos objetivos nascerem."`,
    ],
    macro_iq: [
      `"O diferencial contra a ${loserTeam.name} foi disciplina de mapa. Mesmo quando eles tentaram forçar lutas fora de hora com ${lLoneStar?.ign}, nós mantivemos o controle das ondas laterais e só lutamos nos nossos timers de visão. Isso foi estrangulando o ouro deles até o ${scoreStr}."`,
    ],
    clutch_mentality: [
      `"Em séries assim a conversa no voice muda completamente. Quando a ${loserTeam.name} apertou o jogo, eu pedi pra todo mundo simplificar as chamadas: focar um alvo por vez, contar feitiços e esperar o erro de posicionamento de ${lChokePlayer?.ign}. A calma do elenco nos momentos críticos decidiu a série."`,
    ],
    intl_experience: [
      `"Em torneio internacional o ritmo de castigo é outro: você não pode dar um passo em falso na visão. Usamos nossa experiência para ditar o tempo do mapa e forçar ${lChokePlayer?.ign} a tomar decisões desconfortáveis sob pressão."`,
    ],
    adapt_draft: [
      `"Entre os mapas a comissão técnica leu muito bem o que a ${loserTeam.name} queria priorizar no draft. Ajustamos a ordem de picks para dar resposta confortável pro ${wMvpPlayer?.ign} e tiramos as escolhas de conforto deles — isso mudou a cara da série."`,
    ],
    balanced: [
      `"Foi um xadrez muito equilibrado contra a ${loserTeam.name}. Decidimos nos detalhes de preparação de objetivo e comunicação limpa nas teamfights. Quando ${wMvpPlayer?.ign} e ${wClutchPlayer?.ign} alinharam os engages, conseguimos fechar os jogos."`,
    ],
  };

  const wCoachName = winnerTeam.coach
    ? `${winnerTeam.coach} (${winnerTeam.tag})`
    : `Head Coach (${winnerTeam.tag})`;
  const lCoachName = loserTeam.coach
    ? `${loserTeam.coach} (${loserTeam.tag})`
    : `Head Coach (${loserTeam.tag})`;

  const wCoachAnswer = isWorldCup
    ? `"Montar uma seleção com jogadores que atuam em clubes e ligas diferentes em pouco tempo é sempre um desafio, mas esse grupo comprou a ideia desde o primeiro treino. Vencer a ${loserTeam.name} por ${scoreStr} mostra a força da nossa escola nacional e a entrega de atletas como ${wMvpPlayer?.ign} e ${wIglPlayer?.ign}."`
    : pickVariant(seedBase, "w-coach", [
        `"O plano da comissão era tirar ${lLoneStar?.ign} da zona de conforto e explorar as transições no lado de ${lChokePlayer?.ign}. Os jogadores executaram com muita maturidade. ${
          isGrandFinal
            ? `Fechar o ${championship.name} com esse ${scoreStr} coroa meses de ajustes.`
            : `Agora é recuperar a energia e corrigir os erros de início de jogo para o próximo desafio.`
        }"`,
        `"Estou satisfeito principalmente com a frieza do grupo nos momentos em que o mapa parecia travado. Contra um elenco como o da ${loserTeam.name}, qualquer hesitação custa caro, e hoje soubemos responder rápido tanto no draft quanto dentro de jogo."`,
      ]);

  const winnerQuestions: PressQuestion[] = [
    {
      id: "w-1",
      outlet: outlets[0].outlet,
      journalist: outlets[0].journalist,
      topicTag: isGrandFinal ? "MVP DA GRANDE FINAL" : "DESTAQUE DA SÉRIE",
      speakerName: `${wMvpPlayer?.ign ?? winnerTeam.tag}`,
      speakerRole: `${ROLE_PT[wMvpPlayer?.role ?? "mid"]} · ${winnerTeam.name}`,
      speakerBadge: match.mvp
        ? `MVP · KDA ${match.mvp.kda} · Rating ${match.mvp.rating}`
        : `MEC ${wMvpPlayer?.resolved.mechanics} · CLU ${wMvpPlayer?.resolved.clutch}`,
      speakerTone: "gold",
      question: `${wMvpPlayer?.ign}, você comandou esse ${scoreStr} contra a ${loserTeam.name} na ${stageLabel}${match.mvp ? ` (KDA ${match.mvp.kda}, rating ${match.mvp.rating})` : ""}. Qual foi a chave para superar ${loserCounterpartToMvp?.ign} hoje?`,
      answer: wMvpAnswer,
      statCallout: `${wMvpPlayer?.ign}: Mecânica ${wMvpPlayer?.resolved.mechanics} · Clutch ${wMvpPlayer?.resolved.clutch} vs ${loserCounterpartToMvp?.ign} (Mentalidade ${loserCounterpartToMvp?.resolved.mentality})`,
    },
    {
      id: "w-2",
      outlet: outlets[1].outlet,
      journalist: outlets[1].journalist,
      topicTag: "LEITURA MACRO & DRAFT",
      speakerName: `${wIglPlayer?.ign ?? winnerTeam.tag}`,
      speakerRole: `${ROLE_PT[wIglPlayer?.role ?? "jungle"]} · Shotcaller`,
      speakerBadge: `QI DE JOGO ${wIglPlayer?.resolved.gameIq} · ADAPT ${wIglPlayer?.resolved.adaptability}`,
      speakerTone: "emerald",
      question: `Como funcionou a leitura dentro do jogo para neutralizar os pontos fortes da ${loserTeam.name} ao longo desse ${scoreStr}?`,
      answer: pickVariant(seedBase, "w-igl", wIglAnswerByCause[seriesCause]),
      statCallout: `QI Coletivo: ${winnerTeam.tag} ${wIq} vs ${loserTeam.tag} ${lIq} · Adaptação: ${wAdapt} vs ${lAdapt}`,
    },
    {
      id: "w-3",
      outlet: outlets[2].outlet,
      journalist: outlets[2].journalist,
      topicTag: isSilverScrapes ? "SANGUE FRIO NO DECIDER" : "CONTROLE EMOCIONAL",
      speakerName: `${wClutchPlayer?.ign ?? winnerTeam.tag}`,
      speakerRole: `${ROLE_PT[wClutchPlayer?.role ?? "adc"]} · ${winnerTeam.name}`,
      speakerBadge: `CLUTCH ${wClutchPlayer?.resolved.clutch} · MENTAL ${wClutchPlayer?.resolved.mentality}`,
      speakerTone: "blue",
      question: isSilverScrapes
        ? `A série foi até o último mapa (${scoreStr}) sob tensão máxima. O que manteve a ${winnerTeam.name} calma na hora da decisão?`
        : `Mesmo quando a ${loserTeam.name} tentou acelerar com ${lLoneStar?.ign}, vocês mantiveram o controle. Como o grupo lidou com a pressão?`,
      answer: isSilverScrapes
        ? pickVariant(seedBase, "w-clutch-ss", [
            `"Quando empataram e fomos para o mapa decisivo, ninguém apontou dedo no voice. Revisamos onde estávamos perdendo tempo de visão e confiamos na chamada do ${wIglPlayer?.ign}. Na luta final, estava todo mundo na mesma página."`,
            `"Jogo decisivo se ganha na cabeça antes da mecânica. Olhei pro lado e vi o elenco tranquilo, ajustando os planos sem pânico. Sabíamos que se segurássemos o início de ${lLoneStar?.ign}, a nossa janela ia aparecer."`,
          ])
        : pickVariant(seedBase, "w-clutch-reg", [
            `"Em série eliminatória, quem perde a paciência primeiro entrega o mapa. Mantivemos a calma mesmo nos momentos em que a ${loserTeam.name} pressionou, e quando vencemos a primeira luta grande pelo objetivo, o ritmo passou a ser nosso."`,
            `"A preparação mental fez diferença hoje. Não nos desesperamos quando eles conseguiram abates cedo — continuamos farmando, protegendo visão e esperando nossa composição escalar para punir os avanços deles."`,
          ]),
      statCallout: `Clutch: ${winnerTeam.tag} ${wClutch} vs ${loserTeam.tag} ${lClutch} · Mentalidade: ${wMental} vs ${lMental}`,
    },
    {
      id: "w-4",
      outlet: outlets[3].outlet,
      journalist: outlets[3].journalist,
      topicTag: isWorldCup ? "ORGULHO NACIONAL" : isIntl ? "IMPACTO INTERNACIONAL" : "RITMO & IDENTIDADE",
      speakerName: `${wAggressivePlayer?.ign ?? winnerTeam.tag}`,
      speakerRole: `${ROLE_PT[wAggressivePlayer?.role ?? "top"]} · ${winnerTeam.name}`,
      speakerBadge: `AGRESSIVIDADE ${wAggressivePlayer?.resolved.aggression} · EXP INT ${wAggressivePlayer?.resolved.intlExperience}`,
      speakerTone: "purple",
      question: isWorldCup
        ? `Qual é a sensação de vencer a ${loserTeam.name} por ${scoreStr} defendendo a camisa do seu país na ${championship.name}?`
        : isIntl
          ? `Vencer a ${loserTeam.name} (${loserTeam.region ?? "rival internacional"}) por ${scoreStr} no ${championship.name} muda o respeito pela ${winnerTeam.region ?? "região de vocês"}?`
          : `O estilo agressivo da ${winnerTeam.name} prevaleceu nesse ${scoreStr}. Você sente que a equipe encontrou sua melhor identidade?`,
      answer: isWorldCup
        ? `"É diferente de qualquer campeonato de clubes. Aqui não tem rivalidade de torcida local — jogamos por uma bandeira só. Enfrentar uma seleção forte como a ${loserTeam.name} e sair com esse ${scoreStr} mostra a força dos nossos jogadores espalhados pelo mundo."`
        : isIntl
          ? wExpectation === "underdog"
            ? `"A gente sabe que muita gente de fora subestima a ${winnerTeam.region ?? "nossa liga"} antes do torneio começar. Entramos no servidor sem nada a perder, impondo nosso ritmo contra a ${loserTeam.name}, e mostramos que dá sim para competir de igual para igual."`
            : `"No palco internacional não basta ter nome ou histórico: tem que provar a cada série. Respeitamos a ${loserTeam.name}, mas impusemos nossa leitura desde cedo e confirmamos o favoritismo da ${winnerTeam.region ?? winnerTeam.tag}."`
          : `"Nossa força está em ditar o ritmo sem medo de errar. Quando eu e o ${wMvpPlayer?.ign} conseguimos empurrar as rotas com apoio do ${wIglPlayer?.ign}, fica muito difícil para qualquer adversário da liga segurar nossa pressão."`,
      statCallout: isIntl
        ? `Bagagem Internacional: ${winnerTeam.tag} ${wIntl} vs ${loserTeam.tag} ${lIntl} · Região: ${winnerTeam.region ?? "Local"} vs ${loserTeam.region ?? "Local"}`
        : `Agressividade: ${wAggressivePlayer?.ign} (${wAggressivePlayer?.resolved.aggression}) · Consistência (${wAggressivePlayer?.resolved.consistency})`,
    },
    {
      id: "w-5",
      outlet: outlets[4].outlet,
      journalist: outlets[4].journalist,
      topicTag: "COMISSÃO TÉCNICA",
      speakerName: wCoachName,
      speakerRole: `Diretor Técnico · ${winnerTeam.name}`,
      speakerBadge: `ELO ${wElo} · ${wTitles + (isGrandFinal ? 1 : 0)} TÍTULOS`,
      speakerTone: "gold",
      question: isGrandFinal
        ? `Coach, título conquistado com ${scoreStr} sobre a ${loserTeam.name}. O que definiu esse elenco no ${championship.name}?`
        : `Coach, vitória por ${scoreStr} diante da ${loserTeam.name}. Qual foi a maior virtude tática do grupo hoje?`,
      answer: wCoachAnswer,
      statCallout: `Balanço Técnico: ${winnerTeam.name} (ELO ${wElo}) supera ${loserTeam.name} (ELO ${lElo}) por ${scoreStr}`,
    },
  ];

  // =========================================================================
  // RESPOSTAS REALISTAS DO TIME ELIMINADO / VICE (RESPEITANDO EXPECTATIVA E REGIÃO!)
  // =========================================================================
  let lCaptainAnswer = "";
  if (isWorldCup) {
    lCaptainAnswer = isGrandFinal
      ? `"Ficar com o vice da Copa do Mundo por ${scoreStr} contra a ${winnerTeam.name} dói porque estávamos a um passo de dar esse título inédito para o nosso país. Mesmo com pouco tempo de treino juntos, o grupo se entregou ao máximo, mas hoje eles foram mais precisos nas lutas decisivas."`
      : `"Cair na ${match.roundName ?? "fase eliminatória"} contra a ${winnerTeam.name} frustra porque queríamos levar nossa seleção ainda mais longe. Tivemos bons momentos, mas quando ${wMvpPlayer?.ign} e ${wIglPlayer?.ign} aceleraram o mapa, nos faltou entrosamento para responder na mesma velocidade."`;
  } else if (isIntl) {
    if (lExpectation === "underdog") {
      lCaptainAnswer = isGrandFinal
        ? `"Chegar a uma final internacional representando a ${loserTeam.region ?? "nossa região"} já foi algo enorme, mas perder por ${scoreStr} mostra onde ainda precisamos evoluir contra o topo do mundo. Não viemos com obrigação de título, mas queríamos competir até o último segundo."`
        : pickVariant(seedBase, "l-cap-intl-underdog", [
            `"Sabíamos desde o início que enfrentar times como a ${winnerTeam.name} seria um teste duríssimo para a ${loserTeam.region ?? "nossa região"}. Nosso objetivo realista era passar de fase e provar evolução competitiva. Saímos frustrados por alguns erros bobos no meio de jogo, mas essa experiência contra ${wMvpPlayer?.ign} vale muito para quando voltarmos para casa."`,
            `"Não dá para mentir: existe uma diferença de ritmo entre a nossa liga local e o nível que a ${winnerTeam.name} joga aqui no ${championship.name}. Lutamos com as armas que tínhamos, tentamos incomodar, mas a leitura de mapa deles (${wIq} de média) puniu cada passo nosso fora de posição."`,
          ]);
    } else if (lExpectation === "regional_power") {
      lCaptainAnswer = isGrandFinal
        ? `"Bater na trave na final por ${scoreStr} contra a ${winnerTeam.name} é duro. Provamos que podemos bater de frente com qualquer região, mas nos detalhes de decisão eles foram superiores."`
        : `"Viemos para o ${championship.name} acreditando que tínhamos elenco para brigar por semifinais ou mais, então cair agora por ${scoreStr} fica abaixo do que esperávamos. Faltou transformar nossa força mecânica em controle de mapa contra ${wIglPlayer?.ign}."`;
    } else {
      // major_contender
      lCaptainAnswer = isGrandFinal
        ? `"Quando você representa um projeto feito para vencer o ${championship.name}, terminar com o vice por ${scoreStr} é uma decepção enorme. Trabalhamos para levantar essa taça e hoje falhamos nos momentos-chave diante da ${winnerTeam.name}."`
        : `"Para um elenco com a nossa ambição e histórico, cair antes da final por ${scoreStr} é inaceitável. Entramos como favoritos contra a ${winnerTeam.name}, mas subestimamos o ritmo deles e perdemos o controle da série."`;
    }
  } else {
    // Liga Local
    if (lExpectation === "underdog") {
      lCaptainAnswer = isGrandFinal
        ? `"Muita gente nem esperava ver a ${loserTeam.name} na final da liga, então chegar até aqui e lutar contra a ${winnerTeam.name} já mostra a evolução do elenco. Claro que perder por ${scoreStr} dói, mas saímos de cabeça erguida."`
        : `"Sabíamos das nossas limitações nesta temporada contra elencos mais caros como o da ${winnerTeam.name}. Chegar aos playoffs foi um passo importante, mas hoje a diferença de execução ficou clara no ${scoreStr}."`;
    } else {
      lCaptainAnswer = isGrandFinal
        ? `"Trabalhamos o split inteiro dentro da nossa liga com foco total nesse título, e perder a final por ${scoreStr} para a ${winnerTeam.name} é um golpe duro. Faltou calma minha e do time quando ${wMvpPlayer?.ign} abriu vantagem."`
        : `"Para os padrões que a ${loserTeam.name} estabeleceu nesta liga, ser eliminado aqui por ${scoreStr} está abaixo da meta. Tivemos o plano na mão, mas ficamos reativos demais quando a ${winnerTeam.name} acelerou o meio de jogo."`;
    }
  }

  const lCoachAnswer = isWorldCup
    ? `"Assumo total responsabilidade pelas escolhas táticas desta série contra a ${winnerTeam.name}. Em torneio curto de seleções, pequenas falhas de comunicação pesam dobrado. Mesmo com a eliminação por ${scoreStr}, os jogadores honraram nosso país e voltam para seus clubes ainda mais experientes."`
    : isIntl && lExpectation === "underdog"
      ? `"Precisamos ser honestos na análise: competir no ${championship.name} contra elencos com ELO ${wElo} e mais bagagem internacional (${wIntl} vs ${lIntl}) expõe qualquer falha de macro que passa batido na nossa região. Voltamos para a ${loserTeam.region ?? "nossa liga"} com lições claras do que precisa mudar para elevarmos o nível regional."`
      : pickVariant(seedBase, "l-coach", [
          `"A responsabilidade pela preparação tática e mental diante da ${winnerTeam.name} começa em mim. Hoje ficou claro que talento mecânico (${lMech}) sem estabilidade emocional (${lMental}) e leitura de adaptação (${lAdapt}) não sustenta série eliminatória. Vamos revisar tudo na pausa."`,
          `"Saímos com o ${scoreStr} sabendo exatamente onde perdemos a série: não conseguimos responder quando a ${winnerTeam.name} mudou o foco do draft. É um resultado duro para a torcida da ${loserTeam.name}, mas vai servir de choque para a próxima etapa."`,
        ]);

  const loserQuestions: PressQuestion[] = [
    {
      id: "l-1",
      outlet: outlets[0].outlet,
      journalist: outlets[0].journalist,
      topicTag: isGrandFinal ? "IMPACTO DO VICE-CAMPEONATO" : "DIAGNÓSTICO DA ELIMINAÇÃO",
      speakerName: `${lCaptain?.ign ?? loserTeam.tag}`,
      speakerRole: `${ROLE_PT[lCaptain?.role ?? "support"]} · Capitão da ${loserTeam.name}`,
      speakerBadge: `IDADE ${lCaptain?.age ?? 23} · QI ${lCaptain?.resolved.gameIq}`,
      speakerTone: "blood",
      question: `${lCaptain?.ign}, uma derrota por ${scoreStr} contra a ${winnerTeam.name} que ${
        isGrandFinal
          ? `deixa a ${loserTeam.name} com o vice do ${championship.name}`
          : `encerra a participação da ${loserTeam.name} no ${championship.name}`
      }. Qual foi a leitura do elenco sobre o que faltou hoje?`,
      answer: lCaptainAnswer,
      statCallout: `Expectativa (${lExpectation === "major_contender" ? "Candidato ao Título" : lExpectation === "regional_power" ? "Competitivo" : "Desafiante"}): ${loserTeam.tag} cedeu controle diante de ${wMvpPlayer?.ign}`,
    },
    {
      id: "l-2",
      outlet: outlets[1].outlet,
      journalist: outlets[1].journalist,
      topicTag: isIntl ? "PESO DO PALCO INTERNACIONAL" : "PRESSÃO & CONFIANÇA",
      speakerName: `${lChokePlayer?.ign ?? loserTeam.tag}`,
      speakerRole: `${ROLE_PT[lChokePlayer?.role ?? "mid"]} · ${loserTeam.name}`,
      speakerBadge: isIntl
        ? `EXP INT ${lChokePlayer?.resolved.intlExperience} · MENTAL ${lChokePlayer?.resolved.mentality}`
        : `MENTALIDADE ${lChokePlayer?.resolved.mentality} · CLUTCH ${lChokePlayer?.resolved.clutch}`,
      speakerTone: "blood",
      question: isIntl
        ? `${lChokePlayer?.ign}, no palco do ${championship.name} vimos hesitações suas contra a ${winnerTeam.name} que normalmente não acontecem. A diferença de ritmo internacional pesou?`
        : `${lChokePlayer?.ign}, a ${winnerTeam.name} concentrou muita pressão na sua rota nesse ${scoreStr}. O que aconteceu nos momentos críticos?`,
      answer: isIntl
        ? pickVariant(seedBase, "l-choke-intl", [
            `"Na nossa liga local você tem mais margem para errar um timing e recuperar depois. Aqui no ${championship.name}, contra ${wMvpPlayer?.ign} e ${wIglPlayer?.ign}, qualquer segundo de dúvida vira objetivo perdido. Senti o peso do palco em algumas chamadas e assumo minha parcela nisso."`,
            `"Tentei forçar algumas jogadas para tirar o time do sufoco, mas o nível de punição da ${winnerTeam.name} é muito alto. É frustrante não conseguir mostrar meus ${lChokePlayer?.resolved.mechanics} de mecânica com a mesma naturalidade que tenho em casa."`,
          ])
        : pickVariant(seedBase, "l-choke-dom", [
            `"Depois que perdemos as primeiras lutas pelo objetivo, tentei resolver no individual e acabei me expondo demais. Deixei a ansiedade falar mais alto do que a leitura de mapa e isso custou caro para a ${loserTeam.name}."`,
            `"Hoje a ${winnerTeam.name} leu muito bem minhas movimentações e eu demorei para ajustar o posicionamento. É difícil aceitar uma derrota assim, mas preciso responder melhor sob pressão."`,
          ]),
      statCallout: isIntl
        ? `Choque Internacional: ${lChokePlayer?.ign} (${lChokePlayer?.resolved.mechanics} MEC · ${lChokePlayer?.resolved.intlExperience} Exp. Int.)`
        : `Sob Pressão: ${lChokePlayer?.ign} (Mentalidade ${lChokePlayer?.resolved.mentality} · Clutch ${lChokePlayer?.resolved.clutch})`,
    },
    {
      id: "l-3",
      outlet: outlets[2].outlet,
      journalist: outlets[2].journalist,
      topicTag: "VISÃO INDIVIDUAL",
      speakerName: `${lLoneStar?.ign ?? loserTeam.tag}`,
      speakerRole: `${ROLE_PT[lLoneStar?.role ?? "adc"]} · Destaque da ${loserTeam.name}`,
      speakerBadge: `MECÂNICA ${lLoneStar?.resolved.mechanics} · CONSIST ${lLoneStar?.resolved.consistency}`,
      speakerTone: "gold",
      question: `${lLoneStar?.ign}, você foi o jogador mais consistente da ${loserTeam.name} na série, mas não foi suficiente contra a ${winnerTeam.name}. O que fica de sentimento após o ${scoreStr}?`,
      answer: pickVariant(seedBase, "l-star", [
        `"É duro porque você se prepara ao máximo para fazer sua parte na rota, mas LoL de alto nível não se resolve no 1v5. Sempre que eu buscava uma janela lateral, a ${winnerTeam.name} já estava cobrando um objetivo com ${wMvpPlayer?.ign} e ${wClutchPlayer?.ign}. Saímos frustrados por não termos conseguido jogar como unidade."`,
        `"Eu tentei puxar a responsabilidade nas lutas, mas hoje o coletivo da ${winnerTeam.name} funcionou muito melhor que o nosso. Mesmo quando conseguíamos abates, faltava coordenação para transformar isso em controle de mapa."`,
      ]),
      statCallout: `Destaque da ${loserTeam.tag}: ${lLoneStar?.ign} (${lLoneStar?.resolved.mechanics} MEC · ${lLoneStar?.resolved.consistency} CONS)`,
    },
    {
      id: "l-4",
      outlet: outlets[3].outlet,
      journalist: outlets[3].journalist,
      topicTag: "AJUSTE TÁTICO & DRAFT",
      speakerName: `${lTacticalPlayer?.ign ?? loserTeam.tag}`,
      speakerRole: `${ROLE_PT[lTacticalPlayer?.role ?? "top"]} · ${loserTeam.name}`,
      speakerBadge: `ADAPTAÇÃO ${lTacticalPlayer?.resolved.adaptability} · QI ${lTacticalPlayer?.resolved.gameIq}`,
      speakerTone: "blue",
      question: `Ao longo dos ${winnerScore + loserScore} mapas, pareceu que a ${winnerTeam.name} se adaptava mais rápido entre um jogo e outro. Faltou repertório para responder?`,
      answer: pickVariant(seedBase, "l-tactical", [
        `"Faltou agilidade para mudar a leitura entre os mapas. Quando a ${winnerTeam.name} passou a acelerar o lado de ${wMvpPlayer?.ign}, insistimos em um estilo muito parecido achando que ia encaixar na execução. Contra um time com ${wAdapt} de adaptação, insistir no erro é fatal."`,
        `"Nós tínhamos respostas preparadas no papel, mas dentro do servidor não conseguimos executar o plano alternativo. Quando finalmente tentamos mudar o ritmo no draft, eles já estavam muito confortáveis na série."`,
      ]),
      statCallout: `Adaptação na Série: ${loserTeam.tag} (${lAdapt}) vs ${winnerTeam.tag} (${wAdapt})`,
    },
    {
      id: "l-5",
      outlet: outlets[4].outlet,
      journalist: outlets[4].journalist,
      topicTag: "AVALIAÇÃO & PRÓXIMOS PASSOS",
      speakerName: lCoachName,
      speakerRole: `Diretor Técnico · ${loserTeam.name}`,
      speakerBadge: `ELO ${lElo} · ANÁLISE PÓS-SÉRIE`,
      speakerTone: "purple",
      question: `Coach, após esse ${scoreStr} diante da ${winnerTeam.name}, qual é a leitura fria da comissão técnica para a sequência?`,
      answer: lCoachAnswer,
      statCallout: `Pontos de Evolução da ${loserTeam.tag}: Mentalidade (${lMental}), Clutch (${lClutch})${isIntl ? ` e Exp. Int. (${lIntl})` : ""}`,
    },
  ];

  return {
    isGrandFinal,
    isInternational: isIntl,
    storylineBadge,
    headline,
    subheadline,
    tacticalSummary,
    winnerScore,
    loserScore,
    keyFactors,
    winnerQuestions,
    loserQuestions,
  };
}
