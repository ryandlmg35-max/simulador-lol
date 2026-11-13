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

function getOutletsForContext(game: string, region?: string, isIntl?: boolean) {
  if (game === "cs2") {
    return [
      { outlet: "HLTV.org", journalist: "Striker" },
      { outlet: "Draft5", journalist: " Roque" },
      { outlet: "Dust2 Brasil", journalist: " Bida" },
      { outlet: "ESL Broadcast Desk", journalist: "SPUNJ" },
      { outlet: "GameArena CS", journalist: "Mch" },
    ];
  }
  if (game === "valorant") {
    return [
      { outlet: "VLR.gg", journalist: " Sideshow" },
      { outlet: "Valorant Zone", journalist: " Nyang" },
      { outlet: "Mais Esports VAL", journalist: " Tixinha" },
      { outlet: "Sheep Esports", journalist: " Brieuc Seeger" },
      { outlet: "Dot Esports", journalist: " George Geddes" },
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
  if (reg === "CBLOL") {
    return [
      { outlet: "Mais Esports", journalist: "Eric Teixeira" },
      { outlet: "Ilha das Lendas", journalist: "Baiano" },
      { outlet: "ge.globo Esports", journalist: "Chandy Teixeira" },
      { outlet: " MGG Brasil", journalist: "Schaeppi" },
      { outlet: "Coletiva Oficial CBLOL", journalist: "Takeshi" },
    ];
  }
  if (reg === "LCK") {
    return [
      { outlet: "Inven Global", journalist: "Ashley Kang" },
      { outlet: "Daily Esports KR", journalist: "Kenzi" },
      { outlet: "FOMOS Korea", journalist: " Kim Yong-woo" },
      { outlet: "LCK Press Room", journalist: " Wolf" },
      { outlet: "Korizon Esports", journalist: " Kevin Kim" },
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

  const winnerScore = Math.max(match.scoreA ?? 0, match.scoreB ?? 0) || (match.bestOf === 5 ? 3 : match.bestOf === 3 ? 2 : 1);
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
  const wElo = Math.round(effectiveRating(winnerTeam, wCareer?.rating));
  const lElo = Math.round(effectiveRating(loserTeam, lCareer?.rating));
  const wTitles = wCareer?.titles ?? 0;
  const lTitles = lCareer?.titles ?? 0;

  const isUpset = lElo - wElo >= 5 || (lMech - wMech >= 4 && lTitles > wTitles);
  const isIntlChoke =
    isIntl &&
    ((lMech >= wMech && lIntl + 6 < wIntl) ||
      (lElo >= wElo && lMental < wMental) ||
      (lTitles >= 2 && loserScore <= 1));

  // Identificar protagonistas do time vencedor
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
      .sort((a, b) => b.resolved.gameIq + b.resolved.adaptability - (a.resolved.gameIq + a.resolved.adaptability))[0] ??
    wStarters[0];

  const wClutchPlayer =
    [...wStarters]
      .filter((p) => p.id !== wMvpPlayer?.id && p.id !== wIglPlayer?.id)
      .sort((a, b) => b.resolved.clutch + b.resolved.mentality - (a.resolved.clutch + a.resolved.mentality))[0] ??
    wStarters[1] ??
    wStarters[0];

  const wAggressivePlayer =
    [...wStarters]
      .filter((p) => p.id !== wMvpPlayer?.id && p.id !== wIglPlayer?.id && p.id !== wClutchPlayer?.id)
      .sort((a, b) => b.resolved.aggression + b.resolved.mechanics - (a.resolved.aggression + a.resolved.mechanics))[0] ??
    wStarters[2] ??
    wStarters[0];

  // Identificar protagonistas do time eliminado / vice
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
      .sort((a, b) => b.resolved.mechanics + b.resolved.consistency - (a.resolved.mechanics + a.resolved.consistency))[0] ??
    lStarters[0];

  const lCaptain =
    [...lStarters]
      .filter((p) => p.id !== lChokePlayer?.id && p.id !== lLoneStar?.id)
      .sort((a, b) => (b.age ?? 20) * 3 + b.resolved.gameIq - ((a.age ?? 20) * 3 + a.resolved.gameIq))[0] ??
    lStarters[1] ??
    lStarters[0];

  const lTacticalPlayer =
    [...lStarters]
      .filter((p) => p.id !== lChokePlayer?.id && p.id !== lLoneStar?.id && p.id !== lCaptain?.id)
      .sort((a, b) => a.resolved.adaptability - b.resolved.adaptability)[0] ??
    lStarters[2] ??
    lStarters[0];

  const loserCounterpartToMvp =
    lStarters.find((p) => p.role === wMvpPlayer?.role) ?? lChokePlayer;

  const outlets = getOutletsForContext(game, championship.region, isIntl);
  const stageLabel = isGrandFinal
    ? `Grande Final do ${championship.name} (${championship.season ?? " Edição Atual"})`
    : `${match.roundName ?? "Fase Eliminatória"} do ${championship.name}`;

  // Storyline & Headline
  let storylineBadge = isGrandFinal ? "COLETIVA PÓS-TÍTULO" : "COLETIVA DE ELIMINAÇÃO";
  let headline = "";
  let subheadline = "";
  let tacticalSummary = "";

  if (isGrandFinal) {
    if (isSweep) {
      storylineBadge = "DOMINÂNCIA ABSOLUTA NA FINAL";
      headline = `${winnerTeam.name} atropela ${loserTeam.name} por ${scoreStr} e ergue a taça do ${championship.name}`;
      subheadline = `Com atuação implacável de ${wMvpPlayer?.ign ?? winnerTeam.tag} e leitura macro superior (${wIq} vs ${lIq}), ${winnerTeam.name} não deu margem para reação.`;
    } else if (isSilverScrapes) {
      storylineBadge = "SILVER SCRAPES HISTÓRICO";
      headline = `No limite dos nervos! ${winnerTeam.name} vence ${loserTeam.name} por ${scoreStr} em final épica`;
      subheadline = `Decidida nos detalhes do último mapa, a frieza sob pressão (Clutch ${wClutch} vs ${lClutch} e Mentalidade ${wMental} vs ${lMental}) coroou a campanha da ${winnerTeam.tag}.`;
    } else if (isUpset) {
      storylineBadge = "ZEBRA HISTÓRICA PELO TÍTULO";
      headline = `Contra todas as projeções, ${winnerTeam.name} derruba a favorita ${loserTeam.name} (${scoreStr}) e é campeã!`;
      subheadline = `Mesmo entrando com ELO inferior (${wElo} vs ${lElo}), a ${winnerTeam.tag} puniu o nervosismo adversário e escreveu seu nome no Hall da Fama.`;
    } else {
      storylineBadge = isIntl ? "CONSAGRAÇÃO INTERNACIONAL" : "HEGEMONIA CONFIRMADA";
      headline = `${winnerTeam.name} supera ${loserTeam.name} por ${scoreStr} e conquista o ${championship.name}`;
      subheadline = `Liderada por ${wMvpPlayer?.ign ?? winnerTeam.tag} (${match.mvp ? `KDA ${match.mvp.kda} · Rating ${match.mvp.rating}` : `Mecânica ${wMvpPlayer?.resolved.mechanics}`}), a equipe controlou os momentos críticos da decisão.`;
    }
  } else {
    if (isIntlChoke) {
      storylineBadge = "CHOQUE DE REALIDADE INTERNACIONAL";
      headline = `Fim da linha precoce: ${loserTeam.name} sente o peso do palco internacional e cai para ${winnerTeam.name} (${scoreStr})`;
      subheadline = `Apesar do talento mecânico (${lMech}), a baixa bagagem internacional (${lIntl} vs ${wIntl}) e a queda mental nos momentos críticos custaram a sobrevivência no ${championship.name}.`;
    } else if (isUpset) {
      storylineBadge = "GIANT SLAYER NOS PLAYOFFS";
      headline = `Choque no ${championship.name}: ${winnerTeam.name} elimina ${loserTeam.name} por ${scoreStr}!`;
      subheadline = `A favorita ${loserTeam.tag} (ELO ${lElo}) não conseguiu responder à adaptação tática (${wAdapt}) e ao ritmo agressivo imposto por ${wMvpPlayer?.ign ?? winnerTeam.tag}.`;
    } else if (isSweep) {
      storylineBadge = "ATROPELO ELIMINATÓRIO";
      headline = `Sem resposta tática, ${loserTeam.name} sofre ${scoreStr} da ${winnerTeam.name} e dá adeus ao ${championship.name}`;
      subheadline = `Do draft à execução de mapa, a ${winnerTeam.tag} dominou todas as rotas e encerrou a campanha da ${loserTeam.tag} de forma categórica.`;
    } else {
      storylineBadge = "DRAMA DE ELIMINAÇÃO";
      headline = `${winnerTeam.name} elimina ${loserTeam.name} por ${scoreStr} e avança no ${championship.name}`;
      subheadline = `Em série tensa na ${match.roundName ?? "chave eliminatória"}, a consistência de ${wMvpPlayer?.ign ?? winnerTeam.tag} pesou mais que as tentativas de reação de ${lLoneStar?.ign ?? loserTeam.tag}.`;
    }
  }

  tacticalSummary = isIntl
    ? `Radiografia da Série (${scoreStr}): No palco internacional do ${championship.name}, a diferença de Bagagem Internacional (${winnerTeam.tag} ${wIntl} vs ${loserTeam.tag} ${lIntl}) e Blindagem Mental (${wMental} vs ${lMental}) foi determinante. Enquanto ${wMvpPlayer?.ign} (${ROLE_PT[wMvpPlayer?.role ?? "mid"]}) ditou o ritmo com ${wMvpPlayer?.resolved.mechanics} de Mecânica e ${wMvpPlayer?.resolved.clutch} de Clutch, o lado da ${loserTeam.tag} sofreu com hesitações críticas sob pressão — especialmente na rota de ${lChokePlayer?.ign} (Exp. Int. ${lChokePlayer?.resolved.intlExperience}, Mentalidade ${lChokePlayer?.resolved.mentality}).`
    : `Radiografia da Série (${scoreStr}): A vitória da ${winnerTeam.name} passou diretamente pelo controle de objetivos e leitura de mapa (QI de Jogo médio ${wIq} vs ${lIq}) somado ao poder de decisão no late-game (Clutch ${wClutch} vs ${lClutch}). ${wMvpPlayer?.ign} venceu o duelo direto contra ${loserCounterpartToMvp?.ign} e abriu espaço para ${wIglPlayer?.ign} comandar as rotações, enquanto ${loserTeam.name} viu sua estrutura mental (${lMental}) ceder após perder o controle do meio de jogo.`;

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
  // PERGUNTAS DO TIME VENCEDOR (Pós-Título ou Pós-Classificação)
  // =========================================================================
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
      question: `${wMvpPlayer?.ign}, você foi o grande nome desse ${scoreStr} contra a ${loserTeam.name} na ${stageLabel}${match.mvp ? `, fechando com KDA ${match.mvp.kda} e rating ${match.mvp.rating}` : ""}. Onde você sentiu que quebrou a resistência de ${loserCounterpartToMvp?.ign} no duelo direto?`,
      answer: `"Sinceramente, desde a preparação a gente sabia que a ${loserTeam.name} dependia muito de como ${loserCounterpartToMvp?.ign} e ${lLoneStar?.ign} iam ditar os primeiros 10 minutos. Quando entrei no servidor hoje, senti que ${loserCounterpartToMvp?.ign} estava jogando mais recuado do que o normal — provavelmente sentindo o peso da série. Meu foco foi forçar trocas no limite da mecânica desde a fase de rotas. A partir do momento em que abrimos vantagem de tempo e ${wIglPlayer?.ign} conectou comigo nas rotações, o mapa deles desmoronou. ${
        isGrandFinal
          ? `Levantar esse troféu do ${championship.name} pela ${winnerTeam.name} fechando por ${scoreStr} é a recompensa por cada treino pesado que fizemos.`
          : `Eliminar um adversário do calibre da ${loserTeam.name} por ${scoreStr} mostra que estamos prontos pra buscar a taça.`
      }"`,
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
      question: `Vocês neutralizaram completamente as principais condições de vitória da ${loserTeam.name}. Como funcionou a comunicação interna para adaptar o macro entre os mapas e punir as rotações deles?`,
      answer: `"O segredo hoje não foi só mão, foi leitura de mapa. A ${loserTeam.name} tem jogadores mecanicamente fortes como ${lLoneStar?.ign} (${lLoneStar?.resolved.mechanics} de Mecânica), mas percebemos na análise que quando eles são forçados a tomar decisões rápidas fora do script, a adaptação deles (${lAdapt} de média) cai bastante. No meio da série, falei pro pessoal: 'Não deem luta franca onde eles querem; puxem as ondas laterais e forcem ${lChokePlayer?.ign} a dar facecheck nos objetivos'. Funcionou exatamente como desenhamos. Tivemos frieza para controlar visão e estrangular o ouro até fechar o ${scoreStr}."`,
      statCallout: `QI de Jogo Coletivo: ${winnerTeam.tag} ${wIq} vs ${loserTeam.tag} ${lIq} · Adaptação: ${wAdapt} vs ${lAdapt}`,
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
        ? `A série foi até o último mapa (${scoreStr}) com a arena inteira em tensão máxima. Como o elenco manteve o pulso firme quando a ${loserTeam.name} empatou a série?`
        : `Mesmo nos momentos em que a ${loserTeam.name} tentou acelerar o jogo com ${lLoneStar?.ign}, vocês não perderam a compostura. O quanto o fator mental pesou hoje?`,
      answer: isSilverScrapes
        ? `"Jogo 5 separa quem treina só mecânica de quem tem cabeça pra ser campeão. Quando fomos pro mapa decisivo no ${scoreStr.slice(0, 1)}×${loserScore}, olhei pro lado e vi todo mundo calmo, revisando os timers de flash e preparação de objetivo, enquanto do lado da ${loserTeam.tag} dava pra notar nas chamadas deles no início do jogo que a pressão estava pesando. Naquela última luta, com tudo em jogo, confiei 100% na chamada do ${wIglPlayer?.ign} e na proteção do time. É pra esse tipo de momento que a gente vive."`
        : `"Em série eliminatória Bo${match.bestOf}, o primeiro time que tilta perde. A gente sabia que se segurássemos o ímpeto inicial de ${lLoneStar?.ign}, a frustração ia bater do lado deles. Nosso índice de consistência e mentalidade (${wMental} de média) nos permitiu absorver a pressão sem entregar abates gratuitos. Quando vencemos a luta decisiva pelo objetivo principal no mapa ${winnerScore}, sentimos que o psicológico da ${loserTeam.name} já tinha quebrado."`,
      statCallout: `Poder de Decisão (Clutch): ${winnerTeam.tag} ${wClutch} vs ${loserTeam.tag} ${lClutch} · Mentalidade: ${wMental} vs ${lMental}`,
    },
    {
      id: "w-4",
      outlet: outlets[3].outlet,
      journalist: outlets[3].journalist,
      topicTag: isIntl ? "IMPACTO INTERNACIONAL" : "AGRESSIVIDADE & RITMO",
      speakerName: `${wAggressivePlayer?.ign ?? winnerTeam.tag}`,
      speakerRole: `${ROLE_PT[wAggressivePlayer?.role ?? "top"]} · ${winnerTeam.name}`,
      speakerBadge: `AGRESSIVIDADE ${wAggressivePlayer?.resolved.aggression} · EXP INT ${wAggressivePlayer?.resolved.intlExperience}`,
      speakerTone: "purple",
      question: isIntl
        ? `Bater a ${loserTeam.name} (${loserTeam.region ?? "rival internacional"}) por ${scoreStr} no ${championship.name} manda um recado direto para o resto do mundo. Como você avalia o peso dessa vitória para a região ${winnerTeam.region ?? "de vocês"}?`
        : `Muitos analistas questionavam se o estilo agressivo da ${winnerTeam.name} funcionaria contra a estrutura da ${loserTeam.name}. Essa vitória por ${scoreStr} cala os críticos?`,
      answer: isIntl
        ? `"Muita gente olha só pro nome da região ou pros pontos antigos antes do torneio começar, mas dentro do servidor o que conta é o momento e quem tem coragem de impor seu jogo. Viemos pro ${championship.name} sem medo de ninguém. Sabíamos que a ${loserTeam.name} sentia desconforto quando tirada da zona de conforto cedo. Jogamos no nosso ritmo, punimos cada erro de posicionamento de ${lChokePlayer?.ign} e provamos que a ${winnerTeam.region ?? winnerTeam.tag} veio pra brigar no topo."`
        : `"Falar de fora é fácil, difícil é aguentar a pressão que colocamos no mapa durante ${winnerScore + loserScore} jogos seguidos. Nossa agressividade não é moeda pro alto — é calculada em cima de tempo de resposta. Hoje deixamos claro que quando ${wMvpPlayer?.ign} e eu temos prioridade nas rotas, nenhum time da liga consegue respirar contra a ${winnerTeam.name}."`,
      statCallout: isIntl
        ? `Bagagem Internacional: ${winnerTeam.tag} ${wIntl} vs ${loserTeam.tag} ${lIntl} · Região: ${winnerTeam.region ?? "Local"} vs ${loserTeam.region ?? "Local"}`
        : `Agressividade Controlada: ${wAggressivePlayer?.ign} (${wAggressivePlayer?.resolved.aggression}) · Consistência (${wAggressivePlayer?.resolved.consistency})`,
    },
    {
      id: "w-5",
      outlet: outlets[4].outlet,
      journalist: outlets[4].journalist,
      topicTag: "COMISSÃO TÉCNICA",
      speakerName: `Head Coach (${winnerTeam.tag})`,
      speakerRole: `Diretor Técnico · ${winnerTeam.name}`,
      speakerBadge: `ELO ${wElo} · ${wTitles + (isGrandFinal ? 1 : 0)} TÍTULOS`,
      speakerTone: "gold",
      question: isGrandFinal
        ? `Coach, título conquistado com um ${scoreStr} sobre a ${loserTeam.name}. Qual foi o pilar invisível nos bastidores que transformou esse elenco no campeão do ${championship.name}?`
        : `Coach, classificação garantida em cima da ${loserTeam.name} (${scoreStr}). O que mais te agradou na execução do plano de jogo hoje e o que ainda precisa de ajuste?`,
      answer: isGrandFinal
        ? `"O que construiu esse título foi a evolução contínua dos jogadores ao longo de todo o split. Não dependemos de um único carregador: hoje ${wMvpPlayer?.ign} brilhou intensamente, mas a preparação de draft que fizemos para anular ${lLoneStar?.ign} e explorar a rota de ${lChokePlayer?.ign} foi executada à perfeição pelos cinco titulares. Subimos nosso patamar competitivo para ${wElo} de ELO e esse troféu do ${championship.name} consolida um trabalho de longo prazo da organização."`
        : `"Estou muito orgulhoso da disciplina tática do grupo. Vencer a ${loserTeam.name} por ${scoreStr} exige preparo mental e leitura de draft afiada, porque eles têm talentos como ${lLoneStar?.ign} que podem virar um jogo sozinhos se tiverem espaço. Cumprimos nosso plano à risca, mas os pés continuam no chão: vamos revisar os pequenos erros de transição que cometemos no início das partidas para chegarmos ainda mais fortes na próxima rodada."`,
      statCallout: `Balanço Técnico: ${winnerTeam.name} (ELO ${wElo}) supera ${loserTeam.name} (ELO ${lElo}) por ${scoreStr}`,
    },
  ];

  // =========================================================================
  // PERGUNTAS DO TIME ELIMINADO / VICE-CAMPEÃO (Pós-Eliminação)
  // =========================================================================
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
      question: `${lCaptain?.ign}, uma derrota dura por ${scoreStr} contra a ${winnerTeam.name} que ${
        isGrandFinal
          ? `deixa a ${loserTeam.name} com o vice-campeonato do ${championship.name}`
          : `encerra a caminhada da ${loserTeam.name} no ${championship.name}`
      }. Em que momento exato da série você sentiu que o controle escapou das mãos de vocês?`,
      answer: `"É difícil digerir agora porque trabalhamos o split inteiro para ${
        isGrandFinal ? "erguer essa taça" : "chegar na final"
      }, e cair por ${scoreStr} dói demais. Sendo totalmente transparente: nós perdemos a série na nossa incapacidade de conter o ritmo que ${wMvpPlayer?.ign} e ${wIglPlayer?.ign} impuseram entre os 12 e 20 minutos. Nós tínhamos o plano no papel, mas dentro do jogo ficamos reativos demais. Quando você dá iniciativa de graça para um time com ${wIq} de leitura de mapa como a ${winnerTeam.name}, eles não perdoam. Faltou voz ativa minha e calma coletiva para estancar o sangramento antes que virasse bola de neve."`,
      statCallout: `Déficit de Controle: ${loserTeam.tag} cedeu o ritmo de meio de jogo diante de ${wMvpPlayer?.ign}`,
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
        ? `${lChokePlayer?.ign}, regionalmente você costuma jogar com muita confiança (${lChokePlayer?.resolved.mechanics} de Mecânica), mas hoje no palco internacional do ${championship.name} vimos hesitações incomuns nas trocas contra a ${winnerTeam.name}. O peso do torneio internacional travou o seu jogo?`
        : `${lChokePlayer?.ign}, a ${winnerTeam.name} focou muita pressão na sua rota e vimos erros de execução nos momentos mais críticos da série. Como você explica essa queda de rendimento sob pressão hoje?`,
      answer: isIntl
        ? `"Não vou me esconder atrás de desculpas. Na nossa liga local você conhece os vícios de cada adversário e tem margem pra errar uma janela de tempo e ainda recuperar na mecânica. Aqui no ${championship.name}, contra um time como a ${winnerTeam.name}, meio segundo de hesitação custa um objetivo inteiro. Eu senti a diferença de ritmo internacional hoje — quando tentei forçar as jogadas que normalmente dão certo na liga regional, ${wMvpPlayer?.ign} e ${wIglPlayer?.ign} já estavam um passo à frente. A responsabilidade é minha e preciso transformar essa dor em bagagem real."`
        : `"A verdade é que depois que perdemos as primeiras disputas importantes de mapa, eu comecei a forçar jogadas tentando resolver tudo de uma vez e acabei entregando exatamente o que a ${winnerTeam.name} queria. Tenho ${lChokePlayer?.resolved.mechanics} de capacidade mecânica, mas hoje deixei a ansiedade falar mais alto nos momentos de decisão. Peço desculpas aos meus companheiros e à torcida da ${loserTeam.name}; é uma lição amarga que vou ter que carregar."`,
      statCallout: isIntl
        ? `Choque Internacional: ${lChokePlayer?.ign} tem ${lChokePlayer?.resolved.mechanics} MEC, mas apenas ${lChokePlayer?.resolved.intlExperience} de Exp. Internacional e ${lChokePlayer?.resolved.mentality} de Mentalidade`
        : `Sob Pressão: ${lChokePlayer?.ign} registrou Mentalidade ${lChokePlayer?.resolved.mentality} e Clutch ${lChokePlayer?.resolved.clutch} nos momentos decisivos`,
    },
    {
      id: "l-3",
      outlet: outlets[2].outlet,
      journalist: outlets[2].journalist,
      topicTag: "FRUSTRAÇÃO INDIVIDUAL",
      speakerName: `${lLoneStar?.ign ?? loserTeam.tag}`,
      speakerRole: `${ROLE_PT[lLoneStar?.role ?? "adc"]} · Destaque da ${loserTeam.name}`,
      speakerBadge: `MECÂNICA ${lLoneStar?.resolved.mechanics} · CONSIST ${lLoneStar?.resolved.consistency}`,
      speakerTone: "gold",
      question: `${lLoneStar?.ign}, individualmente você tentou manter a ${loserTeam.name} viva em várias lutas da série, mas o coletivo não acompanhou o ritmo da ${winnerTeam.name}. Qual é o sentimento de sair derrotado por ${scoreStr} sabendo que tinha nível para ir além?`,
      answer: `"É extremamente frustrante. Eu me preparei no limite, mantive minha fase de rotas sólida e tentei buscar espaço em todas as teamfights, mas esports de alto nível não se ganha no 1v5. A ${winnerTeam.name} jogou como uma unidade muito mais coesa hoje — sempre que eu conseguia abrir uma vantagem lateral, ${wMvpPlayer?.ign} e ${wClutchPlayer?.ign} já tinham cobrado um preço maior do outro lado do mapa. Sair ${
        isGrandFinal ? "vendo eles levantarem o troféu na nossa frente" : "eliminado nessa fase"
      } deixa um gosto amargo demais, porque sabemos que o potencial bruto desse elenco era muito maior do que mostramos hoje."`,
      statCallout: `Esforço Isolado: ${lLoneStar?.ign} liderou a ${loserTeam.tag} com ${lLoneStar?.resolved.mechanics} de Mecânica e ${lLoneStar?.resolved.consistency} de Consistência`,
    },
    {
      id: "l-4",
      outlet: outlets[3].outlet,
      journalist: outlets[3].journalist,
      topicTag: "FALHA DE ADAPTAÇÃO",
      speakerName: `${lTacticalPlayer?.ign ?? loserTeam.tag}`,
      speakerRole: `${ROLE_PT[lTacticalPlayer?.role ?? "top"]} · ${loserTeam.name}`,
      speakerBadge: `ADAPTAÇÃO ${lTacticalPlayer?.resolved.adaptability} · QI ${lTacticalPlayer?.resolved.gameIq}`,
      speakerTone: "blue",
      question: `Ao longo dos ${winnerScore + loserScore} mapas, a impressão de quem assistia era que a ${winnerTeam.name} sempre tinha uma resposta pronta para os drafts de vocês. Faltou repertório tático para mudar o rumo da série?`,
      answer: `"Faltou velocidade de leitura entre um jogo e outro. Quando a ${winnerTeam.name} ajustou o posicionamento de visão e passou a acelerar o mapa pelo lado de ${wMvpPlayer?.ign}, nós insistimos na mesma abordagem padrão achando que ia funcionar apenas na execução. Contra um time que tem ${wAdapt} de adaptação coletiva, você não pode ser previsível. Quando finalmente tentamos mudar o estilo no último mapa, eles já estavam com a confiança lá no alto e não nos deixaram respirar."`,
      statCallout: `Diferença de Adaptação na Série: ${loserTeam.tag} (${lAdapt}) vs ${winnerTeam.tag} (${wAdapt})`,
    },
    {
      id: "l-5",
      outlet: outlets[4].outlet,
      journalist: outlets[4].journalist,
      topicTag: "FUTURO & RECONSTRUÇÃO",
      speakerName: `Head Coach (${loserTeam.tag})`,
      speakerRole: `Diretor Técnico · ${loserTeam.name}`,
      speakerBadge: `ELO ${lElo} · ANÁLISE PÓS-SÉRIE`,
      speakerTone: "purple",
      question: `Coach, após essa ${
        isGrandFinal ? `derrota por ${scoreStr} na Grande Final` : `eliminação por ${scoreStr}`
      } diante da ${winnerTeam.name}, qual é a avaliação fria da comissão técnica? O que precisa mudar na ${loserTeam.name} para a sequência da temporada?`,
      answer: `"Primeiro, a responsabilidade pelo plano tático e pela preparação emocional para enfrentar a ${winnerTeam.name} começa em mim. Hoje ficou evidente uma lacuna clara: não basta termos média mecânica de ${lMech} se na hora da pressão máxima nossa estabilidade mental (${lMental}) e nosso poder de decisão (${lClutch}) caem abaixo do exigido ${
        isIntl ? "em um torneio internacional desse porte" : "numa decisão de playoffs"
      }. Vamos fazer uma autocrítica profunda nos bastidores. ${
        isIntl
          ? `Voltamos para a ${loserTeam.region ?? "nossa liga"} sabendo exatamente onde está a distância para o topo internacional.`
          : "A janela e o próximo split vão exigir maturidade real de todo o grupo para voltarmos mais fortes."
      }"`,
      statCallout: `Pontos Críticos para Evolução da ${loserTeam.tag}: Mentalidade (${lMental}), Clutch (${lClutch})${isIntl ? ` e Bagagem Int. (${lIntl})` : ""}`,
    },
  ];

  // Garantir determinismo caso precise de tie-break visual
  void hashStr(`${championship.id}:${match.id}:${winnerTeam.id}:${loserTeam.id}`);

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
