import type { CareerTeam, Championship, Team } from "./types";
import { rosterStrength } from "./players";

export interface TeamIdentity {
  key: string;
  name: string;
  tag: string;
  logo?: string;
  region?: string;
  strength: number;
}

export interface RivalryEntry {
  teamA: TeamIdentity;
  teamB: TeamIdentity;
  winsA: number;
  winsB: number;
  total: number;
  playoffMeetings: number;
  finalsMeetings: number;
  lastTournament: string;
  intensityScore: number;
}

export interface PaternityEntry {
  father: TeamIdentity;
  son: TeamIdentity;
  fatherWins: number;
  sonWins: number;
  total: number;
  isKryptonite: boolean; // Pai tem força/rating igual ou menor que o filho!
  lastTournament: string;
  dominanceScore: number;
}

export interface PlayoffBeastEntry {
  team: TeamIdentity;
  wins: number;
  losses: number;
  winRate: number;
}

export interface UpsetKingEntry {
  team: TeamIdentity;
  upsets: number;
  biggestVictim?: string;
}

export interface ChampionshipNarratives {
  rivalries: RivalryEntry[];
  paternities: PaternityEntry[];
  playoffBeasts: PlayoffBeastEntry[];
  upsetKings: UpsetKingEntry[];
}

const normName = (s: string) => s.trim().toLowerCase();

function teamStrengthValue(
  team: Team,
  careerTable?: Record<string, CareerTeam>,
): number {
  const rs = rosterStrength(team.roster);
  const c = careerTable?.[normName(team.name)];
  const rating = c?.rating ?? 50;
  if (rs != null) return Math.round(rs * 0.7 + rating * 0.3);
  return rating;
}

export function computeChampionshipNarratives(params: {
  championship: Championship;
  allChampionships: Championship[];
  poolTeams: Team[];
  careerTable?: Record<string, CareerTeam>;
  isInternational: boolean;
}): ChampionshipNarratives {
  const { championship, allChampionships, poolTeams, careerTable, isInternational } = params;
  const game = championship.game ?? "lol";

  // Considera apenas times que participam deste campeonato (para que o painel seja relevante ao torneio atual)
  const poolMap = new Map<string, TeamIdentity>();
  for (const t of poolTeams) {
    const k = normName(t.name);
    poolMap.set(k, {
      key: k,
      name: t.name,
      tag: t.tag || t.name.slice(0, 3).toUpperCase(),
      logo: t.logo,
      region: t.region,
      strength: teamStrengthValue(t, careerTable),
    });
  }

  type PairAgg = {
    aKey: string;
    bKey: string;
    winsA: number;
    winsB: number;
    playoffMeetings: number;
    finalsMeetings: number;
    lastTournament: string;
  };
  const pairs = new Map<string, PairAgg>();
  const playoffStats = new Map<string, { w: number; l: number }>();
  const upsetStats = new Map<string, { count: number; biggestVictim?: string; maxGap: number }>();

  const champsToScan = Array.from(
    new Map(
      [championship, ...allChampionships]
        .filter((c) => (c.game ?? "lol") === game)
        .map((c) => [c.id, c]),
    ).values(),
  );

  for (const ch of champsToScan) {
    const chTeams = [
      ...ch.teams,
      ...(ch.serieB?.teams ?? []),
      ...(ch.formerTeams ?? []),
    ];
    const byId = new Map(chTeams.map((t) => [t.id, t]));
    const chIsIntl =
      ch.isInternational === true ||
      ch.internationalLevel === "major" ||
      ch.internationalLevel === "minor";

    // Em torneio internacional, prioriza confrontos históricos em mundiais/internacionais;
    // em liga local, olha todo o histórico dos times da liga.
    if (isInternational && !chIsIntl && ch.id !== championship.id) {
      // Ainda conta confrontos domésticos com peso normal se os dois times forem do mesmo pool,
      // mas só se já houver confrontos internacionais? Na verdade, incluir tudo garante dados ricos!
    }

    const phases = [...ch.phases, ...(ch.serieB?.phases ?? [])];
    for (const phase of phases) {
      const isPlayoff = phase.kind === "bracket";
      for (const m of phase.matches) {
        if (!m.winnerId || m.bye || !m.teamAId || !m.teamBId) continue;
        const tA = byId.get(m.teamAId);
        const tB = byId.get(m.teamBId);
        if (!tA || !tB) continue;

        const kA = normName(tA.name);
        const kB = normName(tB.name);
        const idA = poolMap.get(kA);
        const idB = poolMap.get(kB);
        if (!idA || !idB || kA === kB) continue;

        const winnerKey = m.winnerId === tA.id ? kA : kB;
        const loserKey = m.winnerId === tA.id ? kB : kA;
        const winnerId = poolMap.get(winnerKey)!;
        const loserId = poolMap.get(loserKey)!;

        // Par ordenado alfabeticamente
        const [first, second] = kA < kB ? [kA, kB] : [kB, kA];
        const pairKey = `${first}::${second}`;
        const cur = pairs.get(pairKey) ?? {
          aKey: first,
          bKey: second,
          winsA: 0,
          winsB: 0,
          playoffMeetings: 0,
          finalsMeetings: 0,
          lastTournament: ch.name,
        };
        if (winnerKey === first) cur.winsA += 1;
        else cur.winsB += 1;
        if (isPlayoff) cur.playoffMeetings += 1;
        if (
          m.bracketSide === "grand" ||
          (m.roundName && /grande final|^final$/i.test(m.roundName.trim()))
        ) {
          cur.finalsMeetings += 1;
        }
        cur.lastTournament = ch.name;
        pairs.set(pairKey, cur);

        if (isPlayoff) {
          const pw = playoffStats.get(winnerKey) ?? { w: 0, l: 0 };
          pw.w += 1;
          playoffStats.set(winnerKey, pw);
          const pl = playoffStats.get(loserKey) ?? { w: 0, l: 0 };
          pl.l += 1;
          playoffStats.set(loserKey, pl);
        }

        // Upset: vencedor tinha força/rating pelo menos 6 pts menor que o perdedor
        const gap = loserId.strength - winnerId.strength;
        if (gap >= 6) {
          const u = upsetStats.get(winnerKey) ?? { count: 0, maxGap: 0 };
          u.count += 1;
          if (gap > u.maxGap) {
            u.maxGap = gap;
            u.biggestVictim = loserId.tag || loserId.name;
          }
          upsetStats.set(winnerKey, u);
        }
      }
    }
  }

  const rivalries: RivalryEntry[] = [];
  const paternities: PaternityEntry[] = [];
  const minMatches = isInternational ? 2 : 3;

  for (const p of pairs.values()) {
    const total = p.winsA + p.winsB;
    if (total < minMatches) continue;
    const teamA = poolMap.get(p.aKey)!;
    const teamB = poolMap.get(p.bKey)!;
    const maxW = Math.max(p.winsA, p.winsB);
    const minW = Math.min(p.winsA, p.winsB);
    const dominance = maxW / total;

    // Paternidade ("É pai"): domínio claro (>= 75% de vitórias, ou >= 2-0 se minMatches=2 com >=1 playoff)
    const qualifiesPaternity =
      total >= 3
        ? dominance >= 0.75 && maxW - minW >= 2
        : isInternational && total === 2 && maxW === 2 && p.playoffMeetings >= 1;

    if (qualifiesPaternity) {
      const aIsFather = p.winsA >= p.winsB;
      const father = aIsFather ? teamA : teamB;
      const son = aIsFather ? teamB : teamA;
      const fatherWins = aIsFather ? p.winsA : p.winsB;
      const sonWins = aIsFather ? p.winsB : p.winsA;
      const isKryptonite = father.strength <= son.strength + 2;
      const dominanceScore =
        (fatherWins - sonWins) * 3 +
        fatherWins +
        (isKryptonite ? 5 : 0) +
        p.playoffMeetings * 1.5;

      paternities.push({
        father,
        son,
        fatherWins,
        sonWins,
        total,
        isKryptonite,
        lastTournament: p.lastTournament,
        dominanceScore,
      });
    }

    // Rivalidade: confrontos frequentes e equilibrados (ou múltiplas finais/playoffs)
    if (total >= minMatches && (dominance <= 0.68 || p.finalsMeetings >= 1 || p.playoffMeetings >= 2)) {
      const balance = 1 - Math.abs(p.winsA - p.winsB) / total;
      const intensityScore =
        total * (0.6 + balance) + p.playoffMeetings * 2 + p.finalsMeetings * 4;
      rivalries.push({
        teamA,
        teamB,
        winsA: p.winsA,
        winsB: p.winsB,
        total,
        playoffMeetings: p.playoffMeetings,
        finalsMeetings: p.finalsMeetings,
        lastTournament: p.lastTournament,
        intensityScore,
      });
    }
  }

  rivalries.sort((a, b) => b.intensityScore - a.intensityScore);
  paternities.sort((a, b) => b.dominanceScore - a.dominanceScore);

  const playoffBeasts: PlayoffBeastEntry[] = Array.from(playoffStats.entries())
    .filter(([, s]) => s.w + s.l >= 3 && s.w > s.l)
    .map(([key, s]) => ({
      team: poolMap.get(key)!,
      wins: s.w,
      losses: s.l,
      winRate: Math.round((s.w / (s.w + s.l)) * 100),
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

  const upsetKings: UpsetKingEntry[] = Array.from(upsetStats.entries())
    .filter(([, u]) => u.count >= 1)
    .map(([key, u]) => ({
      team: poolMap.get(key)!,
      upsets: u.count,
      biggestVictim: u.biggestVictim,
    }))
    .sort((a, b) => b.upsets - a.upsets);

  return {
    rivalries: rivalries.slice(0, 4),
    paternities: paternities.slice(0, 4),
    playoffBeasts: playoffBeasts.slice(0, 3),
    upsetKings: upsetKings.slice(0, 3),
  };
}
