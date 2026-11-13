import type { Championship, GameId, MatchMvp, Player, PlayerRole, Team } from "./types";
import { ensureRoster, pickStarters, playerOverall } from "./players";

const LOL_CHAMPIONS: Record<PlayerRole, string[]> = {
  top: ["Aatrox", "Jax", "Renekton", "Gnar", "Camille", "K'Sante", "Jayce", "Rumble"],
  jungle: ["Viego", "Lee Sin", "Sejuani", "Jarvan IV", "Xin Zhao", "Nocturne", "Elise"],
  mid: ["Ahri", "Azir", "Orianna", "Sylas", "Yone", "Syndra", "LeBlanc", "Taliyah"],
  adc: ["Kai'Sa", "Jinx", "Varus", "Ezreal", "Xayah", "Ashe", "Kalista", "Lucian"],
  support: ["Thresh", "Nautilus", "Leona", "Rakan", "Renata Glasc", "Alistar", "Braum"],
};

const CS2_HIGHLIGHTS: Record<PlayerRole, string[]> = {
  top: ["AK-47 Entry King", "Opening Duel Specialist", "First Blood Machine"],
  jungle: ["AWP High-Impact Sniper", "No-Scope Master", "Clutch AWP Defense"],
  mid: ["M4A1-S Headshot Precision", "Multi-kill Anchor", "Site Retake Hero"],
  adc: ["1v3 Post-Plant Clutch", "Lurker Precision", "Deagle Ace"],
  support: ["Flash Assist Tactician", "Smoke Master", "Round Saver"],
};

const HIGHLIGHT_DESCRIPTIONS = [
  "Dominou a série com lutas decisivas e presença impecável.",
  "Decidiu as teamfights cruciais com jogadas de alto impacto.",
  "Consistência absoluta do início ao fim com dano avassalador.",
  "Clutch sensacional nos momentos mais tensos da série.",
  "Ditou o ritmo do mapa com controle magistral de objetivos.",
  "Liderança inabalável e execução mecânica cirúrgica.",
];

/**
 * Eleger o MVP da partida/série baseado nos atributos dos jogadores do time vencedor
 * e na margem do placar.
 */
export function electMatchMvp(params: {
  winnerTeam: Team;
  loserTeam?: Team;
  scoreA?: number;
  scoreB?: number;
  isWinnerA?: boolean;
  game?: GameId;
  isPlayoff?: boolean;
}): MatchMvp {
  const { winnerTeam, scoreA = 0, scoreB = 0, isWinnerA = true, game = "lol", isPlayoff = false } = params;
  const roster = ensureRoster(winnerTeam) ?? [];
  const starters = pickStarters(roster);

  const winScore = isWinnerA ? scoreA : scoreB;
  const loseScore = isWinnerA ? scoreB : scoreA;
  const isStomp = winScore > 0 && loseScore === 0;

  // Se não houver jogadores no elenco, cria um placeholder crível com a tag do time
  if (starters.length === 0) {
    const roles: PlayerRole[] = ["mid", "adc", "jungle", "top", "support"];
    const chosenRole = roles[Math.floor(Math.random() * roles.length)];
    const rating = Number((8.5 + Math.random() * 1.3).toFixed(1));
    const k = Math.floor(Math.random() * 6) + (isStomp ? 7 : 5);
    const d = Math.floor(Math.random() * 2) + (isStomp ? 0 : 1);
    const a = Math.floor(Math.random() * 8) + 6;

    return {
      playerName: `${winnerTeam.tag || winnerTeam.name.slice(0, 4).toUpperCase()} Star`,
      role: chosenRole,
      teamId: winnerTeam.id,
      teamTag: winnerTeam.tag,
      kda: `${k}/${d}/${a}`,
      rating,
      champion: game === "cs2" ? "AK-47 Precision" : LOL_CHAMPIONS[chosenRole][0],
      highlight: HIGHLIGHT_DESCRIPTIONS[0],
    };
  }

  // Pontuação ponderada: mecânica + clutch (se playoff) + aleatoriedade controlada
  const scoredStarters = starters.map((player) => {
    const attrs = player.attrs;
    const baseWeight = attrs.mechanics * 0.4 + attrs.gameIq * 0.3 + attrs.clutch * (isPlayoff ? 0.3 : 0.15);
    // Variação de forma na série
    const formRoll = (Math.random() - 0.5) * 20;
    return {
      player,
      score: baseWeight + formRoll,
    };
  });

  scoredStarters.sort((a, b) => b.score - a.score);
  const mvpPlayer = scoredStarters[0].player;

  // Gerar estatísticas proporcionais
  const ratingBase = isStomp ? 9.2 : isPlayoff ? 9.0 : 8.6;
  const rating = Number(Math.min(9.9, ratingBase + Math.random() * 0.8).toFixed(1));

  let kills: number;
  let deaths: number;
  let assists: number;

  if (mvpPlayer.role === "support") {
    kills = Math.floor(Math.random() * 3) + 1;
    deaths = Math.floor(Math.random() * 2) + (isStomp ? 0 : 1);
    assists = Math.floor(Math.random() * 8) + (isStomp ? 14 : 10);
  } else if (mvpPlayer.role === "adc" || mvpPlayer.role === "mid") {
    kills = Math.floor(Math.random() * 6) + (isStomp ? 8 : 6);
    deaths = Math.floor(Math.random() * 2) + (isStomp ? 0 : 1);
    assists = Math.floor(Math.random() * 6) + 4;
  } else {
    // top / jungle
    kills = Math.floor(Math.random() * 5) + (isStomp ? 6 : 4);
    deaths = Math.floor(Math.random() * 2) + (isStomp ? 0 : 1);
    assists = Math.floor(Math.random() * 7) + 6;
  }

  const roleChamps = LOL_CHAMPIONS[mvpPlayer.role] || LOL_CHAMPIONS.mid;
  const roleWeapons = CS2_HIGHLIGHTS[mvpPlayer.role] || CS2_HIGHLIGHTS.mid;

  const signaturePick =
    game === "cs2"
      ? roleWeapons[Math.floor(Math.random() * roleWeapons.length)]
      : roleChamps[Math.floor(Math.random() * roleChamps.length)];

  const highlight = HIGHLIGHT_DESCRIPTIONS[Math.floor(Math.random() * HIGHLIGHT_DESCRIPTIONS.length)];

  return {
    playerId: mvpPlayer.id,
    playerName: mvpPlayer.ign,
    role: mvpPlayer.role,
    teamId: winnerTeam.id,
    teamTag: winnerTeam.tag,
    kda: `${kills}/${deaths}/${assists}`,
    rating,
    champion: signaturePick,
    highlight,
  };
}

export interface SeasonAwardWinner {
  playerId?: string;
  ign: string;
  real?: string;
  role: PlayerRole;
  teamId: string;
  teamName: string;
  teamTag: string;
  teamColor?: string;
  overall: number;
  mvpCount: number;
  teamWins: number;
  score: number;
  isChampion: boolean;
}

export interface ChampionshipAwards {
  hasMatches: boolean;
  isCompleted: boolean;
  splitMvp: SeasonAwardWinner | null;
  allPro: Record<PlayerRole, SeasonAwardWinner | null>;
}

const ALL_PRO_ROLES: PlayerRole[] = ["top", "jungle", "mid", "adc", "support"];

/**
 * Elege automaticamente o MVP do Campeonato e a Seleção do Campeonato (All-Pro Team:
 * melhor TOP, JG, MID, ADC e SUP) com base em MVPs de série, vitórias do time,
 * desempenho em playoffs e OVR do jogador.
 */
export function computeChampionshipAwards(
  championship: Championship,
  division: 1 | 2 = 1,
): ChampionshipAwards {
  const emptyAllPro: Record<PlayerRole, SeasonAwardWinner | null> = {
    top: null,
    jungle: null,
    mid: null,
    adc: null,
    support: null,
  };

  const phases =
    division === 2 && championship.serieB ? championship.serieB.phases : championship.phases;
  const teams =
    division === 2 && championship.serieB ? championship.serieB.teams : championship.teams;

  const allMatches = phases.flatMap((ph) =>
    ph.matches.map((m) => ({ match: m, isPlayoff: ph.kind === "bracket" })),
  );
  const completedMatches = allMatches.filter(({ match }) => !!match.winnerId && !match.bye);
  if (completedMatches.length === 0) {
    return {
      hasMatches: false,
      isCompleted: false,
      splitMvp: null,
      allPro: emptyAllPro,
    };
  }

  const finalPhase = phases[phases.length - 1];
  const lastBracketMatch =
    finalPhase?.kind === "bracket"
      ? [...finalPhase.matches].sort((a, b) => {
          const pA =
            a.bracketSide === "reset" ? 4 : a.bracketSide === "grand" ? 3 : !a.nextMatchId ? 2 : 0;
          const pB =
            b.bracketSide === "reset" ? 4 : b.bracketSide === "grand" ? 3 : !b.nextMatchId ? 2 : 0;
          return pB - pA || (b.round ?? 0) - (a.round ?? 0);
        })[0]
      : undefined;

  const championTeamId = lastBracketMatch?.winnerId;
  const finalistIds = new Set<string>(
    [lastBracketMatch?.teamAId, lastBracketMatch?.teamBId].filter(Boolean) as string[],
  );

  const teamWinsMap = new Map<string, number>();
  const playerMvpCount = new Map<string, number>();

  for (const { match: m, isPlayoff } of completedMatches) {
    if (m.winnerId) {
      const weight = isPlayoff ? 1.5 : 1;
      teamWinsMap.set(m.winnerId, (teamWinsMap.get(m.winnerId) ?? 0) + weight);
    }
    if (m.mvp?.playerName) {
      const key = `${m.mvp.teamId}::${m.mvp.playerName.trim().toLowerCase()}`;
      playerMvpCount.set(key, (playerMvpCount.get(key) ?? 0) + 1);
    }
  }

  const candidates: SeasonAwardWinner[] = [];

  for (const team of teams) {
    const starters = pickStarters(ensureRoster(team) ?? []);
    const wins = Math.round(teamWinsMap.get(team.id) ?? 0);
    const isChampion = championTeamId === team.id;
    const isFinalist = finalistIds.has(team.id);

    for (const p of starters) {
      const key = `${team.id}::${p.ign.trim().toLowerCase()}`;
      const mvpCount = playerMvpCount.get(key) ?? 0;
      const ovr = Math.round(playerOverall(p));
      const score =
        ovr * 1.1 +
        mvpCount * 14 +
        (teamWinsMap.get(team.id) ?? 0) * 5 +
        (isChampion ? 18 : isFinalist ? 9 : 0);

      candidates.push({
        playerId: p.id,
        ign: p.ign,
        real: p.real,
        role: p.role,
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        teamColor: team.color,
        overall: ovr,
        mvpCount,
        teamWins: wins,
        score: Math.round(score * 10) / 10,
        isChampion,
      });
    }
  }

  const allPro: Record<PlayerRole, SeasonAwardWinner | null> = { ...emptyAllPro };
  for (const role of ALL_PRO_ROLES) {
    const rolePool = candidates
      .filter((c) => c.role === role)
      .sort((a, b) => b.score - a.score || b.mvpCount - a.mvpCount || b.overall - a.overall);
    allPro[role] = rolePool[0] ?? null;
  }

  const sortedAll = [...candidates].sort(
    (a, b) =>
      b.score + (b.mvpCount > 0 ? 6 : 0) - (a.score + (a.mvpCount > 0 ? 6 : 0)) ||
      b.mvpCount - a.mvpCount ||
      b.overall - a.overall,
  );

  return {
    hasMatches: true,
    isCompleted: !!championTeamId,
    splitMvp: sortedAll[0] ?? null,
    allPro,
  };
}

/**
 * Soma todos os prêmios de MVP do Split, Seleções All-Pro e MVPs de Partida
 * conquistados por um jogador (pelo IGN) em todos os campeonatos salvos.
 */
export function getPlayerCareerAwards(
  playerIgn: string,
  allChampionships: Championship[],
): {
  splitMvpTitles: string[];
  allProSelections: string[];
  matchMvpCount: number;
} {
  const norm = playerIgn.trim().toLowerCase();
  const splitMvpTitles: string[] = [];
  const allProSelections: string[] = [];
  let matchMvpCount = 0;

  for (const c of allChampionships) {
    const allPhases = [...c.phases, ...(c.serieB?.phases ?? [])];
    for (const ph of allPhases) {
      for (const m of ph.matches) {
        if (m.mvp?.playerName && m.mvp.playerName.trim().toLowerCase() === norm) {
          matchMvpCount++;
        }
      }
    }
    const awards = computeChampionshipAwards(c, 1);
    if (!awards.hasMatches) continue;

    if (awards.splitMvp && awards.splitMvp.ign.trim().toLowerCase() === norm) {
      splitMvpTitles.push(`${c.name}${c.season ? ` (${c.season})` : ""}`);
    }
    const roleWinner = Object.values(awards.allPro).find(
      (w) => w && w.ign.trim().toLowerCase() === norm,
    );
    if (roleWinner) {
      allProSelections.push(`${c.name}${c.season ? ` (${c.season})` : ""}`);
    }
  }

  return {
    splitMvpTitles,
    allProSelections,
    matchMvpCount,
  };
}
