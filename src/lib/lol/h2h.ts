import type { Championship, Match, Team } from "./types";

export interface H2HClash {
  tournament: string;
  season?: string;
  roundOrPhase: string;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string;
  isTeamAWinner: boolean;
}

export interface HeadToHeadStats {
  teamA: Team;
  teamB: Team;
  totalSeries: number;
  teamASeriesWins: number;
  teamBSeriesWins: number;
  teamAGameWins: number;
  teamBGameWins: number;
  recentClashes: H2HClash[];
  streakLeader?: string;
  streakCount: number;
}

/**
 * Computa o histórico completo de confrontos diretos entre dois times
 * varrendo as fases da edição atual e o histórico dos outros campeonatos salvos.
 */
export function computeHeadToHead(
  teamA: Team,
  teamB: Team,
  currentChampionship: Championship,
  allChampionships: Championship[] = [],
): HeadToHeadStats {
  const normA = teamA.name.trim().toLowerCase();
  const normB = teamB.name.trim().toLowerCase();
  const tagA = (teamA.tag ?? "").trim().toLowerCase();
  const tagB = (teamB.tag ?? "").trim().toLowerCase();

  const isMatchForTeamA = (name: string, tag?: string) => {
    const n = name.trim().toLowerCase();
    const t = (tag ?? "").trim().toLowerCase();
    return n === normA || (tagA && t && t === tagA);
  };

  const isMatchForTeamB = (name: string, tag?: string) => {
    const n = name.trim().toLowerCase();
    const t = (tag ?? "").trim().toLowerCase();
    return n === normB || (tagB && t && t === tagB);
  };

  let teamASeriesWins = 0;
  let teamBSeriesWins = 0;
  let teamAGameWins = 0;
  let teamBGameWins = 0;
  const recentClashes: H2HClash[] = [];

  // 1. Processar partidas da edição atual (Série A e Série B)
  const inspectPhases = (
    phases: typeof currentChampionship.phases,
    teams: Team[],
    tourneyName: string,
    seasonName?: string,
  ) => {
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    for (const phase of phases) {
      for (const m of phase.matches) {
        if (!m.winnerId || m.bye) continue;
        if (!m.teamAId || !m.teamBId) continue;

        const tA = teamMap.get(m.teamAId);
        const tB = teamMap.get(m.teamBId);
        if (!tA || !tB) continue;

        const aIsOurA = isMatchForTeamA(tA.name, tA.tag) && isMatchForTeamB(tB.name, tB.tag);
        const aIsOurB = isMatchForTeamB(tA.name, tA.tag) && isMatchForTeamA(tB.name, tB.tag);

        if (!aIsOurA && !aIsOurB) continue;

        const scoreOfOurA = aIsOurA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
        const scoreOfOurB = aIsOurA ? (m.scoreB ?? 0) : (m.scoreA ?? 0);

        const winnerIsOurA = aIsOurA ? m.winnerId === tA.id : m.winnerId === tB.id;

        if (winnerIsOurA) {
          teamASeriesWins++;
        } else {
          teamBSeriesWins++;
        }

        teamAGameWins += scoreOfOurA;
        teamBGameWins += scoreOfOurB;

        recentClashes.push({
          tournament: tourneyName,
          season: seasonName,
          roundOrPhase: m.roundName || phase.name,
          scoreA: scoreOfOurA,
          scoreB: scoreOfOurB,
          winnerTeamId: winnerIsOurA ? teamA.id : teamB.id,
          isTeamAWinner: winnerIsOurA,
        });
      }
    }
  };

  // Avalia o campeonato atual
  const allCurrentTeams = [
    ...currentChampionship.teams,
    ...(currentChampionship.serieB?.teams ?? []),
    ...(currentChampionship.formerTeams ?? []),
  ];
  inspectPhases(
    currentChampionship.phases,
    allCurrentTeams,
    currentChampionship.name,
    currentChampionship.season,
  );
  if (currentChampionship.serieB) {
    inspectPhases(
      currentChampionship.serieB.phases,
      allCurrentTeams,
      `${currentChampionship.name} (Série B)`,
      currentChampionship.season,
    );
  }

  // Avalia edições passadas de campeonatos na lista
  for (const c of allChampionships) {
    if (c.id === currentChampionship.id) continue;
    const pool = [...c.teams, ...(c.serieB?.teams ?? []), ...(c.formerTeams ?? [])];
    inspectPhases(c.phases, pool, c.name, c.season);
    if (c.serieB) {
      inspectPhases(c.serieB.phases, pool, `${c.name} (Série B)`, c.season);
    }
  }

  // Se não houver histórico jogado, gera uma base sintética coerente com a rivalidade / forma
  if (recentClashes.length === 0) {
    // 0 confrontos oficiais registrados ainda
  }

  // Calcular sequência recente
  let streakLeader: string | undefined = undefined;
  let streakCount = 0;
  for (let i = recentClashes.length - 1; i >= 0; i--) {
    const clash = recentClashes[i];
    const leader = clash.isTeamAWinner ? teamA.name : teamB.name;
    if (streakLeader === undefined) {
      streakLeader = leader;
      streakCount = 1;
    } else if (streakLeader === leader) {
      streakCount++;
    } else {
      break;
    }
  }

  return {
    teamA,
    teamB,
    totalSeries: teamASeriesWins + teamBSeriesWins,
    teamASeriesWins,
    teamBSeriesWins,
    teamAGameWins,
    teamBGameWins,
    recentClashes: recentClashes.reverse(), // Mais recentes primeiro
    streakLeader,
    streakCount,
  };
}
