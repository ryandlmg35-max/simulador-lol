import type { Championship, Team } from "./types";
import { buildPhaseMatches, uid } from "./generate";
import { getOfficialLogo } from "./official-logos";

const CS2_TEAM_NAMES: Array<{ name: string; tag: string }> = [
  { name: "Team Spirit", tag: "SPR" },
  { name: "Falcons", tag: "FLC" },
  { name: "Vitality", tag: "VIT" },
  { name: "Natus Vincere", tag: "NAVI" },
  { name: "FURIA", tag: "FUR" },
  { name: "Legacy", tag: "LEG" },
  { name: "PARIVISION", tag: "PARI" },
];

const CS2_TOURNAMENTS: Array<{ name: string; season?: string; region?: string }> = [
  { name: "IEM Cologne Major 2026", season: "2026", region: "INT" },
  { name: "ESL Pro League", season: "2026", region: "INT" },
  { name: "BLAST Bounty", season: "2026", region: "INT" },
  { name: "BLAST Bounty Finals", season: "2026", region: "INT" },
  { name: "Esports World Cup 2026", season: "2026", region: "KSA" },
  { name: "BLAST Open Porto", season: "2026", region: "EU" },
];

function makeTeams(): Team[] {
  return CS2_TEAM_NAMES.map((t) => ({
    id: uid(),
    name: t.name,
    tag: t.tag,
    logo: getOfficialLogo(t.name, t.tag),
    color: "#f59e0b",
  }));
}

export function buildCs2SeedChampionships(): Championship[] {
  return CS2_TOURNAMENTS.map((t) => {
    const teams = makeTeams();
    const teamIds = teams.map((x) => x.id);
    const playoffsConfig = {
      kind: "bracket" as const,
      slots: 8,
      type: "single" as const,
      defaultBestOf: 3 as const,
      finalBestOf: 5 as const,
      bracketReset: false,
    };
    const matches = buildPhaseMatches(playoffsConfig, teamIds, []);
    return {
      id: uid(),
      name: t.name,
      game: "cs2",
      region: t.region,
      season: t.season,
      accentColor: "#f59e0b",
      teams,
      phases: [
        {
          id: uid(),
          name: "Playoffs",
          kind: "bracket",
          config: playoffsConfig,
          matches,
        },
      ],
    };
  });
}