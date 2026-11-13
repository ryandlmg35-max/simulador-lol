import { REAL_ROSTERS, type ScoutedPlayer } from "./real-rosters";
import { WIKI_NAME_ALIASES } from "./players";
import { getOfficialLogo, OFFICIAL_REGION_LOGOS } from "./official-logos";

export interface CatalogTeam {
  name: string;
  tag: string;
  region?: string;
  logo?: string;
  /** Elenco real de 2026 (scrape) — vira Player[] na importação. */
  roster?: ScoutedPlayer[];
}

export interface CatalogRegion {
  id: string;
  name: string;
  logo: string;
  teams: CatalogTeam[];
}

const LEGACY_CBLOL_TEAMS: CatalogTeam[] = [
  {
    "name": "7REX",
    "tag": "7REX",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/4/40/7REXlogo_square.png&w=100"
  },
  {
    "name": "9z Globant",
    "tag": "9ZG",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/8/86/9z_Globantlogo_square.png&w=100"
  },
  {
    "name": "Azules Esports",
    "tag": "UCH",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/a/a8/Azules_Esportslogo_square.png&w=100"
  },
  {
    "name": "Azules Esports Academy",
    "tag": "UCH.A",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/9/9d/Azules_Esports_Academylogo_square.png&w=100"
  },
  {
    "name": "Azules Esports Fem",
    "tag": "UCH.F",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/d/d4/Azules_Esports_Femlogo_square.png&w=100"
  },
  {
    "name": "Botafogo Esports",
    "tag": "BOT",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/7/77/Botafogo_Esportslogo_profile.png&w=100"
  },
  {
    "name": "Clã NKZ",
    "tag": "NKZ",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/f/f5/Cl%C3%A3_NKZlogo_square.png&w=100"
  },
  {
    "name": "Clã NKZ Vórax",
    "tag": "NKZV",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/6/69/Cl%C3%A3_NKZ_V%C3%93RAXlogo_square.png&w=100"
  },
  {
    "name": "Coscu Army",
    "tag": "CA",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/9/92/Coscu_Armylogo_square.png&w=100"
  },
  {
    "name": "Docta Esports",
    "tag": "DOH",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/c/c0/Docta_Esportslogo_square.png&w=100"
  },
  {
    "name": "Docta Esports Club",
    "tag": "DOC",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/4/44/Docta_Esports_Clublogo_square.png&w=100"
  },
  {
    "name": "e-Champ Gaming Trainee",
    "tag": "ECG.T",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/d/d9/E-Champ_Gaming_Traineelogo_square.png&w=100"
  },
  {
    "name": "Ei Nerd Esports",
    "tag": "NERD",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/5/58/Ei_Nerd_Esportslogo_profile.png&w=100"
  },
  {
    "name": "emBRAZA! Esports",
    "tag": "BRA",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/4/44/EmBRAZA!_Esportslogo_square.png&w=100"
  },
  {
    "name": "Estral Esports",
    "tag": "EST",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/6/69/Estral_Esportslogo_profile.png&w=100"
  },
  {
    "name": "Eternals Gaming",
    "tag": "ESG",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/e/ec/Eternals_Gaminglogo_square.png&w=100"
  },
  {
    "name": "Farenvehn Fem",
    "tag": "FVN.F",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/0/08/Farenvehn_Femlogo_square.png&w=100"
  },
  {
    "name": "Filhos do Moita",
    "tag": "FDM",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/6/66/Filhos_do_Moitalogo_square.png&w=100"
  },
  {
    "name": "Fluxo W7M",
    "tag": "FX",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/1/14/Fluxo_W7Mlogo_square.png&w=100"
  },
  {
    "name": "KaBuM! Esports",
    "tag": "KBM",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/1/1b/KaBuM%21_Esportslogo_square.png&w=128"
  },
  {
    "name": "INTZ",
    "tag": "INTZ",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/0/03/INTZ_e-Sportslogo_square.png&w=128"
  },
  {
    "name": "Flamengo Esports",
    "tag": "FLA",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/b/b4/Flamengo_Esportslogo_std.png&w=128"
  },
  {
    "name": "Liberty",
    "tag": "LIB",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/d/d3/Libertylogo_square.png&w=128"
  },
  {
    "name": "Vivo Keyd Stars",
    "tag": "VKS",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/1/15/Vivo_Keyd_Starslogo_square.png&w=128"
  },
  {
    "name": "RED Canids",
    "tag": "RED",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/2/27/RED_Canidslogo_square.png&w=128"
  },
  {
    "name": "paiN Gaming",
    "tag": "PNG",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/7/7c/PaiN_Gaminglogo_square.png&w=128"
  },
  {
    "name": "LOUD",
    "tag": "LLL",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/7/76/LOUDlogo_square.png&w=128"
  },
  {
    "name": "FURIA",
    "tag": "FUR",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/f/f2/FURIAlogo_square.png&w=128"
  },
  {
    "name": "Los Grandes",
    "tag": "LOS",
    "region": "CBLOL",
    "logo": "https://wsrv.nl/?url=static.wikia.nocookie.net/lolesports_gamepedia_en/images/b/bc/L%C3%98Slogo_square.png&w=128"
  }
];

/** Catálogo base por liga com logos oficiais. */
const LEGACY_REGIONS: CatalogRegion[] = [
  {
    id: "CBLOL",
    name: "CBLOL",
    logo: OFFICIAL_REGION_LOGOS.CBLOL,
    teams: LEGACY_CBLOL_TEAMS,
  },
  {
    id: "LCK",
    name: "LCK",
    logo: OFFICIAL_REGION_LOGOS.LCK,
    teams: [],
  },
  {
    id: "LPL",
    name: "LPL",
    logo: OFFICIAL_REGION_LOGOS.LPL,
    teams: [],
  },
  {
    id: "LEC",
    name: "LEC",
    logo: OFFICIAL_REGION_LOGOS.LEC,
    teams: [],
  },
  {
    id: "LCS",
    name: "LCS",
    logo: OFFICIAL_REGION_LOGOS.LCS,
    teams: [],
  },
  {
    id: "LCP",
    name: "LCP",
    logo: OFFICIAL_REGION_LOGOS.LCP,
    teams: [],
  },
];

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function findLegacy(
  legacyTeams: ReadonlyArray<{ name: string; tag: string; logo?: string; region?: string }>,
  scoutedName: string,
): { name: string; tag: string; logo?: string; region?: string } | undefined {
  const n = norm(scoutedName);
  const byExact = (key: string) =>
    legacyTeams.find((t) => norm(t.name) === key || t.tag.toUpperCase() === key.toUpperCase());
  for (const alias of WIKI_NAME_ALIASES[n] ?? []) {
    const hit = byExact(norm(alias));
    if (hit) return hit;
  }
  return (
    byExact(n) ??
    legacyTeams.find((t) => n.length >= 3 && (norm(t.name).includes(n) || n.includes(norm(t.name))))
  );
}

const deriveTag = (name: string) => {
  const customTags: Record<string, string> = {
    // CBLOL
    "paiN Gaming": "PNG",
    "LOUD": "LLL",
    "Vivo Keyd Stars": "VKS",
    "RED Canids": "RED",
    "FURIA": "FUR",
    "Fluxo W7M": "FX",
    "KaBuM! Esports": "KBM",
    "INTZ": "ITZ",
    "Liberty": "LBR",
    "Los Grandes": "LOS",
    "Leviatán": "LEV",
    "Isurus": "ISG",
    "Estral Esports": "EST",
    "Flamengo Esports": "FLA",
    "9z Globant": "9Z",

    // LCK
    "T1": "T1",
    "Gen.G": "GEN",
    "Hanwha Life Esports": "HLE",
    "Dplus KIA": "DK",
    "KT Rolster": "KT",
    "BNK FEARX": "FOX",
    "Kwangdong Freecs": "KDF",
    "DRX": "DRX",
    "Nongshim RedForce": "NS",
    "OK BRION": "BRO",

    // LPL
    "Bilibili Gaming": "BLG",
    "Top Esports": "TES",
    "Weibo Gaming": "WBG",
    "JD Gaming": "JDG",
    "Invictus Gaming": "IG",
    "EDward Gaming": "EDG",
    "Anyone's Legend": "AL",
    "LNG Esports": "LNG",
    "Ninjas in Pyjamas": "NIP",
    "Team WE": "WE",
    "Royal Never Give Up": "RNG",
    "FunPlus Phoenix": "FPX",
    "ThunderTalk Gaming": "TT",
    "LGD Gaming": "LGD",
    "Oh My God": "OMG",
    "Ultra Prime": "UP",
    "Rare Atom": "RA",

    // LEC
    "G2 Esports": "G2",
    "Fnatic": "FNC",
    "Movistar KOI": "MDK",
    "Karmine Corp": "KC",
    "Team BDS": "BDS",
    "Team Heretics": "TH",
    "Team Vitality": "VIT",
    "SK Gaming": "SK",
    "GIANTX": "GX",
    "Rogue": "RGE",

    // LCS
    "FlyQuest": "FLY",
    "Team Liquid": "TL",
    "Cloud9": "C9",
    "100 Thieves": "100T",
    "Dignitas": "DIG",
    "Shopify Rebellion": "SR",
    "Disguised": "DSG",
    "Lyon Gaming": "LYON",
    "NRG Esports": "NRG",
    "Immortals": "IMT",

    // LCP
    "CTBC Flying Oyster": "CFO",
    "GAM Esports": "GAM",
    "Fukuoka SoftBank HAWKS gaming": "SHG",
    "DetonatioN FocusMe": "DFM",
    "PSG Talon": "PSG",
    "Deep Cross Gaming": "DCG",
    "Ground Zero Gaming": "GZ",
    "Vikings Esports": "VKE",
    "Team Whales": "TW",
    "Team Secret": "TS"
  };
  if (customTags[name]) return customTags[name];
  return name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "TIME";
};

export const LOCAL_REGIONS: CatalogRegion[] = LEGACY_REGIONS.map((region) => {
  const scouted = REAL_ROSTERS[region.id];
  if (!scouted) {
    return {
      id: region.id,
      name: region.name,
      logo: region.logo,
      teams: region.teams.map((t) => ({
        ...t,
        logo: t.logo || getOfficialLogo(t.name, t.tag),
      })),
    };
  }

  const primaryTeams: CatalogTeam[] = scouted.map((t) => {
    const legacy = findLegacy(region.teams, t.name);
    const finalName = legacy?.name ?? t.name;
    const finalTag = legacy?.tag ?? deriveTag(t.name);
    const finalLogo = legacy?.logo || getOfficialLogo(finalName, finalTag);

    return {
      name: finalName,
      tag: finalTag,
      region: region.name,
      logo: finalLogo,
      roster: t.players,
    };
  });

  // Inclui times adicionais da base legada que não estão na Série A (para Série B / banco)
  const existingNames = new Set(primaryTeams.map((t) => norm(t.name)));
  const existingTags = new Set(primaryTeams.map((t) => t.tag.toUpperCase()));

  const additionalTeams: CatalogTeam[] = region.teams
    .filter((lt) => !existingNames.has(norm(lt.name)) && !existingTags.has(lt.tag.toUpperCase()))
    .map((lt) => ({
      name: lt.name,
      tag: lt.tag,
      region: region.name,
      logo: lt.logo || getOfficialLogo(lt.name, lt.tag),
    }));

  return {
    id: region.id,
    name: region.name,
    logo: region.logo,
    teams: [...primaryTeams, ...additionalTeams],
  };
});
