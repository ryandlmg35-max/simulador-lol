export type BestOf = 1 | 3 | 5;
export type PhaseKind = "groups" | "swiss" | "bracket";
export type GameId = "lol" | "cs2";
/** Nível de prestígio internacional (afeta a pontuação de carreira). */
export type InternationalLevel = "none" | "minor" | "major";

export type PlayerRole = "top" | "jungle" | "mid" | "adc" | "support";

/** Atributos de um jogador (0–100). */
export interface PlayerAttrs {
  /** Mecânica crua (laning, micro, execução rápida). Cai com a idade. */
  mechanics: number;
  /** Game IQ: macro, liderança, leitura de mapa. Cresce com a idade e experiência. */
  gameIq: number;
  /** Clutch: frieza em finais e jogos de eliminação. */
  clutch: number;
  /** Consistência: regularidade de jogo para jogo, reduz oscilações e eliminações para azarões. */
  consistency?: number;
  /** Agressividade: busca de lutas e iniciativa proativa early game. */
  aggression?: number;
  /** Adaptabilidade: capacidade de ler o adversário e virar séries BO3/BO5. */
  adaptability?: number;
  /** Experiência Internacional: bagagem contra outras regiões (evita a "pipocada" no palco mundial). */
  intlExperience?: number;
  /** Fortaleza Mental: resistência à pressão, público contra e desvantagem no placar. */
  mentality?: number;
}

/** Jogador do elenco — real (scrape do Leaguepedia) ou criado à mão. */
export interface Player {
  id: string;
  ign: string;
  role: PlayerRole;
  /** Sigla do país (ex: BR, KR). */
  country?: string;
  /** Idade atual (envelhece a cada split novo). */
  age?: number;
  attrs: PlayerAttrs;
  /** Sub (não entra na força do elenco enquanto há titular na função). */
  sub?: boolean;
  /** Criado manualmente pelo usuário (não vem do banco real). */
  custom?: boolean;
  /** Nome civil (quando o scrape trouxe). */
  real?: string;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  region?: string;
  logo?: string;
  color?: string;
  /** Escalação textual (dados antigos / busca com IA). Legado — ver `roster`. */
  players?: string[];
  /**
   * Elenco estruturado (fonte de verdade do sistema de evolução).
   * Preenchido pelo banco real (real-rosters.ts) ou editado à mão.
   */
  roster?: Player[];
  /** Sinergia (0–50): splits jogados juntos com ESTE elenco. Zera ao remontar. */
  synergy?: number;
  /** Cultura/vestiário (0–100, neutro = 50). Sobe com títulos, cai com crises. */
  culture?: number;
  coach?: string;
  /** Orçamento / teto financeiro anual da equipe em K dólares (ex: 1200 = $1.2M). */
  budget?: number;
}

export interface TransferNews {
  id: string;
  headline: string;
  fromTeam?: string;
  toTeam: string;
  playerIgn: string;
  role: PlayerRole;
  kind: "signing" | "release" | "trade" | "promotion";
  value?: number;
  date?: string;
}

export interface MatchMvp {
  playerId?: string;
  playerName: string;
  role: PlayerRole;
  teamId: string;
  teamTag?: string;
  kda: string;
  rating: number; // ex: 9.6
  champion?: string;
  highlight?: string;
}

export interface Match {
  id: string;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  scoreA?: number;
  scoreB?: number;
  bestOf: BestOf;
  round?: number;
  slot?: number;
  nextMatchId?: string | null;
  loserNextMatchId?: string | null;
  bracketSide?: "upper" | "lower" | "grand" | "reset";
  groupId?: string;
  roundName?: string;
  /** Destaque / MVP eleito para o confronto */
  mvp?: MatchMvp;
  /** Confronto sem adversário possível (bye) — o time passa direto e o card fica oculto. */
  bye?: boolean;
  /**
   * Slot RESERVADO: vazio de propósito, esperando o classificado do play-in
   * internacional. Não é bye (só se resolve quando o classificado entra) e
   * trava a conclusão da fase enquanto estiver pendente.
   */
  pendingA?: boolean;
  pendingB?: boolean;
  /** Efeito de momentum aplicado por este resultado (revertido se limpar o placar). */
  formEffect?: {
    /** Variação aplicada à forma do time A. */
    a: number;
    /** Variação aplicada à forma do time B. */
    b: number;
    /** Vencedor registrado na hora do efeito. */
    winnerId: string;
    /** Ids dos eventos narrativos gerados (removidos do log se limpar). */
    eventIds?: string[];
    /**
     * Evolução de jogadores aplicada por este resultado (removida se limpar
     * o placar). playerId → delta aplicado em cada atributo.
     */
    playerDeltas?: Record<string, Partial<PlayerAttrs>>;
  };
}

export interface Group {
  id: string;
  name: string;
  teamIds: string[];
}

export interface GroupsConfig {
  kind: "groups";
  groupCount: number;
  doubleRoundRobin: boolean;
  bestOf: BestOf;
  qualifiersPerGroup: number;
  /** "round-robin" (default) ou "gsl" (mini chave dupla por grupo, 4 times). */
  format?: "round-robin" | "gsl";
}

export interface SwissConfig {
  kind: "swiss";
  winsToAdvance: number;
  lossesToEliminate: number;
  defaultBestOf: BestOf;
}

export interface CustomRoundSpec {
  id: string;
  name: string;
  /** Quantidade de confrontos nesta rodada. */
  matches: number;
  bestOf: BestOf;
}

export interface CustomBracketSpec {
  upper: CustomRoundSpec[];
  lower: CustomRoundSpec[];
  grandFinal: boolean;
  grandFinalBestOf: BestOf;
  bracketReset: boolean;
}

export interface PlayoffsConfig {
  kind: "bracket";
  slots: number;
  type: "single" | "double";
  defaultBestOf: BestOf;
  finalBestOf: BestOf;
  bracketReset: boolean;
  /** "auto" (padrão) gera a chave sozinho; "custom" usa `custom`. */
  mode?: "auto" | "custom";
  custom?: CustomBracketSpec;
}

export type PhaseConfig = GroupsConfig | SwissConfig | PlayoffsConfig;

export interface Phase {
  id: string;
  name: string;
  kind: PhaseKind;
  config: PhaseConfig;
  groups?: Group[];
  matches: Match[];
  /**
   * Fase dispensada (play-in internacional sem inscritos): conta como
   * concluída e não trava o avanço da fase principal.
   */
  skipped?: boolean;
  /**
   * Play-in internacional (Worlds/MSI). Partidas aqui NÃO valem pontos,
   * ELO nem histórico no Hall da Fama — só classificam para o evento principal.
   */
  internationalPlayIn?: boolean;
  /** Ordem dos times que já foram semeados nesta fase. */
  seededTeamIds?: string[];
  /** Times pré-classificados que devem permanecer ao atualizar os classificados da fase anterior. */
  directTeamIds?: string[];
  /** Quantos times sobrevivem desta fase para a próxima (play-in entrega 4). */
  advanceCount?: number;
}

export interface ChampionHistoryEntry {
  /** Identificador único desta entrada */
  id: string;
  /** Nome do time campeão */
  teamName: string;
  /** Tag do time campeão */
  teamTag: string;
  /** Logo do time campeão no momento do título */
  teamLogo?: string;
  /** Descrição do split/temporada (ex: "2026 Split 1") */
  splitLabel: string;
  /** Timestamp de quando foi registrado */
  savedAt: string;
}

/** Self-contained 2nd division (Série B) — completely independent from Série A */
export interface SerieB {
  teams: Team[];
  phases: Phase[];
  history?: ChampionHistoryEntry[];
}

/**
 * Play-in de promoção/rebaixamento entre as séries: 2 confrontos
 * (últimos da Série A × finalistas da Série B). Os vencedores garantem vaga
 * na Série A do próximo split; os perdedores, na Série B.
 */
export interface PromotionSeries {
  matches: Match[];
}

/** Estado de momentum/forma de um time na temporada. */
export interface MomentumState {
  /** Forma atual (0–100; neutra = 50). */
  form: number;
  /** Sequência atual: >0 vitórias seguidas, <0 derrotas seguidas. */
  streak: number;
  /** Humor visual do time. */
  mood?: "hot" | "cold" | "tilted" | "rising";
  /** Última variação de forma sofrida (define "rising"/"tilted"). */
  lastDelta?: number;
}

/** Evento narrativo do sistema de momentum (log separado). */
export interface MomentumEvent {
  id: string;
  /** Momento do evento (ISO). */
  at: string;
  /** Série onde aconteceu ("play-in" para o mata-mata de promoção). */
  division: 1 | 2 | "play-in";
  teamId: string;
  title: string;
  detail: string;
  /** Variação de forma aplicada pelo evento. */
  delta: number;
}

/** Registro de carreira de um time no ranking mundial permanente. */
export interface CareerTeam {
  name: string;
  tag?: string;
  logo?: string;
  region?: string;
  points: number;
  wins: number;
  losses: number;
  played: number;
  titles: number;
  /** Rating ELO do time (0–100, começa em 50). É o "nível real" — persiste. */
  rating?: number;
}

/** Título de campeonato creditado na carreira (alimento do pódio). */
export interface CareerTitle {
  champName: string;
  label: string;
  teamName: string;
  teamTag?: string;
  teamLogo?: string;
  at: string;
  /** Jogo de origem — títulos legados (sem o campo) assumem "lol". */
  game?: GameId;
  /** Pontos realmente creditados (com multiplicador) — usa na normalização. */
  points?: number;
}

export interface IntlRegionPerf {
  wins: number;
  losses: number;
  played: number;
  /** Pontos de coeficiente obtidos nesta edição internacional. */
  coefPoints: number;
  /** Melhor estágio atingido por um time da região nesta edição. */
  bestStage: "groups" | "playoffs" | "runnerup" | "champion";
}

export interface IntlEditionRecord {
  editionKey: string;
  champName: string;
  season: string;
  level: "major" | "minor";
  at: string;
  regionScores: Record<string, IntlRegionPerf>;
  championRegion?: string;
  runnerUpRegion?: string;
}

/**
 * RANKING DE CARREIRA (permanente): créditos de pontos/títulos por time,
 * por jogo. Uma vez creditado, NUNCA é recalculado — resetar campeonatos,
 * remover times ou criar novas edições não mexe no que já foi ganho.
 */
export interface CareerLedger {
  /** game → nome do time (minúsculo) → registro de carreira */
  lol?: Record<string, CareerTeam>;
  cs2?: Record<string, CareerTeam>;
  /** Lista de todos os títulos creditados (pódio permanente). */
  titles?: CareerTitle[];
  /**
   * Desempenho internacional histórico acumulado por REGIÃO (game → região → stats).
   */
  international?: Record<string, Record<string, CareerTeam>>;
  /**
   * Janela cronológica das edições internacionais disputadas (game → lista de edições).
   * Base do Coeficiente de Momento + mérito/perda direta de vagas.
   */
  intlHistory?: Record<string, IntlEditionRecord[]>;
  /** Créditos já aplicados (idempotência: mesma partida/vencedor não credita 2x). */
  seen?: Record<string, true>;
  /** Controle do teto máximo de pontos (+7) ganho por time em cada edição de liga doméstica. */
  domesticCap?: Record<string, number>;
}

export interface Championship {
  id: string;
  name: string;
  game?: GameId;
  region?: string;
  season?: string;
  logo?: string;
  accentColor?: string;
  teams: Team[];
  phases: Phase[];
  countsTowardsRanking?: boolean;
  /** Nível de prestígio internacional (multiplicador de pontos na carreira). */
  internationalLevel?: InternationalLevel;
  /** @deprecated usar internationalLevel */
  isInternational?: boolean;
  hasSecondDivision?: boolean;
  /** 2ª Divisão — completamente separada da principal */
  serieB?: SerieB;
  /** Play-in de promoção/rebaixamento (disparado quando as duas séries terminam) */
  promotion?: PromotionSeries;
  /** Sistema de momentum: forma por time (id do time → estado). */
  momentum?: Record<string, MomentumState>;
  /** Log de eventos narrativos de momentum (mais recentes primeiro). */
  momentumLog?: MomentumEvent[];
  /**
   * Times removidos do campeonato — a identidade fica arquivada para que a
   * HISTÓRIA (títulos, ranking, confrontos antigos) não suma quando um time
   * sai do elenco.
   */
  formerTeams?: Team[];
  /** Momento da última alteração (ms) — ordena a página inicial. */
  updatedAt?: number;
  /** Histórico de campeões de splits da Série A */
  history?: ChampionHistoryEntry[];
  /** Histórico e notícias das janelas de transferências */
  transferHistory?: TransferNews[];
  /**
   * Mês agendado no calendário de temporada (1 = Janeiro … 12 = Dezembro).
   * Usado para ordenar e exibir o calendário anual.
   */
  scheduledMonth?: number;
}
