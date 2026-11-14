import type {
  CareerTeam,
  CareerTitle,
  Championship,
  Phase,
  Player,
  PlayerRole,
  Team,
} from "./types";
import { buildPhaseMatches, uid } from "./generate";
import { getOfficialLogo } from "./official-logos";
import { playerId } from "./players";

interface Cs2SeedPlayerSpec {
  ign: string;
  real: string;
  country: string;
  age: number;
  role: PlayerRole; // top=Entry/Anchor, jungle=Support, mid=Star Rifler, adc=AWPer, support=IGL
  ovr: number;
  clutch?: number;
  iq?: number;
  intl?: number;
}

export interface Cs2SeedTeamSpec {
  rank: number;
  name: string;
  tag: string;
  region: string;
  color: string;
  coach: string;
  elo: number;
  points: number;
  wins: number;
  losses: number;
  titles: number;
  players: Cs2SeedPlayerSpec[];
}

function makeCs2Player(spec: Cs2SeedPlayerSpec): Player {
  const mech = spec.ovr;
  const gameIq = spec.iq ?? (spec.role === "support" ? Math.min(97, spec.ovr + 6) : Math.max(66, spec.ovr - 2));
  const clutch = spec.clutch ?? Math.max(66, spec.ovr - 1);
  const intl = spec.intl ?? Math.min(95, Math.max(50, spec.ovr - 6));
  return {
    id: playerId(spec.ign, spec.role),
    ign: spec.ign,
    real: spec.real,
    country: spec.country,
    age: spec.age,
    role: spec.role,
    attrs: {
      mechanics: mech,
      gameIq,
      clutch,
      consistency: Math.max(65, spec.ovr - 2),
      aggression: spec.role === "top" || spec.role === "mid" ? Math.min(97, spec.ovr + 2) : Math.max(62, spec.ovr - 4),
      adaptability: Math.max(66, gameIq - 2),
      intlExperience: intl,
      mentality: Math.max(68, Math.round((clutch + gameIq) / 2)),
    },
  };
}

/**
 * Top 24 times reais do circuito competitivo de CS2 (Ranking HLTV / VRS Novembro 2026)
 * com elencos oficiais de 2026, técnicos, nacionalidades e atributos calibrados.
 */
export const CS2_TEAMS_DB: Cs2SeedTeamSpec[] = [
  {
    rank: 1,
    name: "MOUZ",
    tag: "MOUZ",
    region: "EU",
    color: "#ef4444",
    coach: "sycrone",
    elo: 84,
    points: 980,
    wins: 46,
    losses: 15,
    titles: 1,
    players: [
      { ign: "xertioN", real: "Dorian Berman", country: "IL", age: 22, role: "top", ovr: 86, clutch: 84 },
      { ign: "PR", real: "Oldřich Nový", country: "CZ", age: 21, role: "jungle", ovr: 81 },
      { ign: "Spinx", real: "Lotan Giladi", country: "IL", age: 26, role: "mid", ovr: 87, clutch: 88, intl: 90 },
      { ign: "torzsi", real: "Ádám Torzsás", country: "HU", age: 24, role: "adc", ovr: 86, clutch: 85, intl: 86 },
      { ign: "xelex", real: "Adrian Vincze", country: "HU", age: 19, role: "support", ovr: 80, iq: 84 },
    ],
  },
  {
    rank: 2,
    name: "FURIA",
    tag: "FUR",
    region: "SA",
    color: "#f59e0b",
    coach: "sidde",
    elo: 83,
    points: 945,
    wins: 44,
    losses: 16,
    titles: 0,
    players: [
      { ign: "YEKINDAR", real: "Mareks Gaļinskis", country: "LV", age: 27, role: "top", ovr: 84, intl: 88 },
      { ign: "yuurih", real: "Yuri Santos", country: "BR", age: 26, role: "jungle", ovr: 84, clutch: 83, intl: 86 },
      { ign: "KSCERATO", real: "Kaike Cerato", country: "BR", age: 27, role: "mid", ovr: 89, clutch: 90, intl: 90 },
      { ign: "molodoy", real: "Danil Golubenko", country: "KZ", age: 21, role: "adc", ovr: 86, clutch: 84 },
      { ign: "FalleN", real: "Gabriel Toledo", country: "BR", age: 35, role: "support", ovr: 79, iq: 95, clutch: 88, intl: 95 },
    ],
  },
  {
    rank: 3,
    name: "Vitality",
    tag: "VIT",
    region: "EU",
    color: "#eab308",
    coach: "XTQZZZ",
    elo: 83,
    points: 930,
    wins: 45,
    losses: 17,
    titles: 2,
    players: [
      { ign: "flameZ", real: "Shahar Shushan", country: "IL", age: 23, role: "top", ovr: 85, intl: 86 },
      { ign: "mezii", real: "William Merriman", country: "GB", age: 28, role: "jungle", ovr: 81, iq: 84 },
      { ign: "ropz", real: "Robin Kool", country: "EE", age: 26, role: "mid", ovr: 90, clutch: 93, iq: 92, intl: 94 },
      { ign: "ZywOo", real: "Mathieu Herbaut", country: "FR", age: 26, role: "adc", ovr: 95, clutch: 94, iq: 92, intl: 95 },
      { ign: "apEX", real: "Dan Madesclaire", country: "FR", age: 33, role: "support", ovr: 77, iq: 93, intl: 95 },
    ],
  },
  {
    rank: 4,
    name: "Team Spirit",
    tag: "SPR",
    region: "CIS",
    color: "#38bdf8",
    coach: "hally",
    elo: 82,
    points: 910,
    wins: 43,
    losses: 15,
    titles: 1,
    players: [
      { ign: "tN1R", real: "Andrey Tatarinovich", country: "BY", age: 22, role: "top", ovr: 82 },
      { ign: "zont1x", real: "Myroslav Plakhotia", country: "UA", age: 21, role: "jungle", ovr: 83, clutch: 86 },
      { ign: "donk", real: "Danil Kryshkovets", country: "RU", age: 19, role: "mid", ovr: 96, clutch: 90, intl: 90 },
      { ign: "sh1ro", real: "Dmitry Sokolov", country: "RU", age: 25, role: "adc", ovr: 90, clutch: 92, intl: 91 },
      { ign: "magixx", real: "Boris Vorobiev", country: "RU", age: 23, role: "support", ovr: 79, iq: 86, clutch: 85 },
    ],
  },
  {
    rank: 5,
    name: "Aurora",
    tag: "AUR",
    region: "EU",
    color: "#22d3ee",
    coach: "ash",
    elo: 79,
    points: 795,
    wins: 38,
    losses: 19,
    titles: 0,
    players: [
      { ign: "Wicadia", real: "Ali Haydar Yalçın", country: "TR", age: 21, role: "top", ovr: 83 },
      { ign: "Jimpphat", real: "Jimi Salo", country: "FI", age: 20, role: "jungle", ovr: 85, clutch: 87, intl: 85 },
      { ign: "XANTARES", real: "Ismailcan Dörtkardeş", country: "TR", age: 31, role: "mid", ovr: 89, clutch: 85, intl: 88 },
      { ign: "woxic", real: "Özgür Eker", country: "TR", age: 28, role: "adc", ovr: 84, clutch: 85, intl: 86 },
      { ign: "kyxsan", real: "Damjan Stoilkovski", country: "MK", age: 26, role: "support", ovr: 78, iq: 87 },
    ],
  },
  {
    rank: 6,
    name: "Falcons",
    tag: "FLC",
    region: "EU",
    color: "#10b981",
    coach: "zonic",
    elo: 81,
    points: 865,
    wins: 40,
    losses: 18,
    titles: 2,
    players: [
      { ign: "TeSeS", real: "René Madsen", country: "DK", age: 25, role: "top", ovr: 82, intl: 84 },
      { ign: "kyousuke", real: "Maksim Lukin", country: "RU", age: 18, role: "jungle", ovr: 86, clutch: 83 },
      { ign: "NiKo", real: "Nikola Kovač", country: "BA", age: 29, role: "mid", ovr: 92, clutch: 89, iq: 90, intl: 95 },
      { ign: "m0NESY", real: "Ilya Osipov", country: "RU", age: 21, role: "adc", ovr: 93, clutch: 92, intl: 91 },
      { ign: "karrigan", real: "Finn Andersen", country: "DK", age: 36, role: "support", ovr: 75, iq: 96, clutch: 86, intl: 95 },
    ],
  },
  {
    rank: 7,
    name: "BetBoom",
    tag: "BB",
    region: "CIS",
    color: "#f97316",
    coach: "Fierce",
    elo: 76,
    points: 685,
    wins: 35,
    losses: 20,
    titles: 0,
    players: [
      { ign: "d1Ledez", real: "Vladislav Shutov", country: "RU", age: 22, role: "top", ovr: 80 },
      { ign: "S1ren", real: "Pavel Ogorodnik", country: "RU", age: 23, role: "jungle", ovr: 79 },
      { ign: "Magnojez", real: "Maxim Kapustin", country: "RU", age: 21, role: "mid", ovr: 83 },
      { ign: "zorte", real: "Aleksandr Zagodyrenko", country: "RU", age: 28, role: "adc", ovr: 81 },
      { ign: "Boombl4", real: "Kirill Mikhailov", country: "RU", age: 27, role: "support", ovr: 77, iq: 88, intl: 88 },
    ],
  },
  {
    rank: 8,
    name: "Natus Vincere",
    tag: "NAVI",
    region: "EU",
    color: "#facc15",
    coach: "B1ad3",
    elo: 78,
    points: 740,
    wins: 36,
    losses: 21,
    titles: 0,
    players: [
      { ign: "iM", real: "Mihai Ivan", country: "RO", age: 27, role: "top", ovr: 83, intl: 87 },
      { ign: "makazze", real: "Drin Shaqiri", country: "XK", age: 20, role: "jungle", ovr: 81 },
      { ign: "b1t", real: "Valeriy Vakhovskiy", country: "UA", age: 23, role: "mid", ovr: 86, clutch: 87, intl: 91 },
      { ign: "w0nderful", real: "Ihor Zhdanov", country: "UA", age: 21, role: "adc", ovr: 83, intl: 85 },
      { ign: "Aleksib", real: "Aleksi Virolainen", country: "FI", age: 29, role: "support", ovr: 76, iq: 92, intl: 91 },
    ],
  },
  {
    rank: 9,
    name: "FUT",
    tag: "FUT",
    region: "EU",
    color: "#a855f7",
    coach: "coolio",
    elo: 75,
    points: 630,
    wins: 33,
    losses: 21,
    titles: 0,
    players: [
      { ign: "Krabeni", real: "Aulon Fazlija", country: "XK", age: 21, role: "top", ovr: 79 },
      { ign: "dziugss", real: "Džiugas Steponavičius", country: "LT", age: 20, role: "jungle", ovr: 79 },
      { ign: "xfl0ud", real: "Yasin Koç", country: "TR", age: 24, role: "mid", ovr: 82 },
      { ign: "SunPayus", real: "Álvaro García", country: "ES", age: 28, role: "adc", ovr: 83, intl: 84 },
      { ign: "dem0n", real: "Dmytro Myroshnychenko", country: "UA", age: 22, role: "support", ovr: 77, iq: 82 },
    ],
  },
  {
    rank: 10,
    name: "The MongolZ",
    tag: "MGLZ",
    region: "ASIA",
    color: "#fbbf24",
    coach: "maaRaa",
    elo: 76,
    points: 615,
    wins: 34,
    losses: 20,
    titles: 0,
    players: [
      { ign: "Techno", real: "Sodbayar Munkhbold", country: "MN", age: 21, role: "top", ovr: 82, intl: 83 },
      { ign: "cobrazera", real: "Anarbileg Uuganbayar", country: "MN", age: 20, role: "jungle", ovr: 78 },
      { ign: "nin9", real: "Yesuntumur Gantulga", country: "MN", age: 24, role: "mid", ovr: 80 },
      { ign: "910", real: "Usukhbayar Banzragch", country: "MN", age: 24, role: "adc", ovr: 84, clutch: 85, intl: 84 },
      { ign: "bLitz", real: "Garidmagnai Byambasuren", country: "MN", age: 25, role: "support", ovr: 79, iq: 88, intl: 85 },
    ],
  },
  {
    rank: 11,
    name: "Nemiga",
    tag: "NEM",
    region: "CIS",
    color: "#dc2626",
    coach: "boX",
    elo: 72,
    points: 540,
    wins: 31,
    losses: 22,
    titles: 0,
    players: [
      { ign: "Xant3r", real: "Daniil Konnikov", country: "RU", age: 22, role: "top", ovr: 78 },
      { ign: "syph0", real: "Maxim Syph0", country: "KZ", age: 19, role: "jungle", ovr: 77 },
      { ign: "KaiR0N-", real: "Aleksandr Anashkin", country: "RU", age: 22, role: "mid", ovr: 81 },
      { ign: "khaN", real: "Ibragim Khadjiev", country: "KZ", age: 21, role: "adc", ovr: 80 },
      { ign: "robo", real: "Aleksandr Nenshev", country: "RU", age: 23, role: "support", ovr: 75, iq: 80 },
    ],
  },
  {
    rank: 12,
    name: "G2",
    tag: "G2",
    region: "EU",
    color: "#e11d48",
    coach: "sAw",
    elo: 75,
    points: 525,
    wins: 30,
    losses: 22,
    titles: 0,
    players: [
      { ign: "MATYS", real: "Matúš Šimko", country: "SK", age: 24, role: "top", ovr: 81 },
      { ign: "NertZ", real: "Guy Iluz", country: "IL", age: 27, role: "jungle", ovr: 83, intl: 84 },
      { ign: "HeavyGod", real: "Nikita Martynenko", country: "IL", age: 24, role: "mid", ovr: 84, clutch: 84 },
      { ign: "r1nkle", real: "Artem Moroz", country: "UA", age: 22, role: "adc", ovr: 83 },
      { ign: "huNter-", real: "Nemanja Kovač", country: "BA", age: 30, role: "support", ovr: 79, iq: 87, intl: 91 },
    ],
  },
  {
    rank: 13,
    name: "PARIVISION",
    tag: "PARI",
    region: "CIS",
    color: "#8b5cf6",
    coach: "dastan",
    elo: 74,
    points: 505,
    wins: 29,
    losses: 20,
    titles: 0,
    players: [
      { ign: "zweih", real: "Ivan Gogin", country: "RU", age: 19, role: "top", ovr: 80 },
      { ign: "HObbit", real: "Abay Khassenov", country: "KZ", age: 32, role: "jungle", ovr: 79, clutch: 84, intl: 90 },
      { ign: "FL1T", real: "Evgeniy Lebedev", country: "RU", age: 25, role: "mid", ovr: 84, intl: 86 },
      { ign: "Jame", real: "Dzhami Ali", country: "RU", age: 28, role: "adc", ovr: 82, iq: 91, clutch: 88, intl: 89 },
      { ign: "xiELO", real: "Vladislav Lysov", country: "RU", age: 20, role: "support", ovr: 77, iq: 81 },
    ],
  },
  {
    rank: 14,
    name: "Legacy",
    tag: "LEG",
    region: "SA",
    color: "#f59e0b",
    coach: "adrrr",
    elo: 73,
    points: 485,
    wins: 32,
    losses: 21,
    titles: 0,
    players: [
      { ign: "ksloks", real: "Lucas Lopes", country: "BR", age: 21, role: "top", ovr: 78 },
      { ign: "latto", real: "Bruno Rebelatto", country: "BR", age: 23, role: "jungle", ovr: 80, clutch: 81 },
      { ign: "dumau", real: "Eduardo Wolkmer", country: "BR", age: 23, role: "mid", ovr: 82, intl: 80 },
      { ign: "try", real: "Santino Rigal", country: "AR", age: 22, role: "adc", ovr: 82, clutch: 81 },
      { ign: "arT", real: "Andrei Piovezan", country: "BR", age: 30, role: "support", ovr: 76, iq: 85, intl: 87 },
    ],
  },
  {
    rank: 15,
    name: "1win",
    tag: "1WIN",
    region: "CIS",
    color: "#3b82f6",
    coach: "kuben",
    elo: 72,
    points: 460,
    wins: 28,
    losses: 20,
    titles: 0,
    players: [
      { ign: "BELCHONOKK", real: "Andrey Yasinskiy", country: "RU", age: 21, role: "top", ovr: 78 },
      { ign: "fame", real: "Petr Bolyshev", country: "RU", age: 23, role: "jungle", ovr: 81, intl: 83 },
      { ign: "Ax1Le", real: "Sergey Rykhtorov", country: "RU", age: 24, role: "mid", ovr: 83, clutch: 83, intl: 87 },
      { ign: "ArtFr0st", real: "Artem Kharitonov", country: "RU", age: 25, role: "adc", ovr: 80 },
      { ign: "nafany", real: "Vladislav Gorshkov", country: "RU", age: 25, role: "support", ovr: 76, iq: 85, intl: 83 },
    ],
  },
  {
    rank: 16,
    name: "MIBR",
    tag: "MIBR",
    region: "SA",
    color: "#2563eb",
    coach: "LETN1",
    elo: 72,
    points: 440,
    wins: 29,
    losses: 22,
    titles: 0,
    players: [
      { ign: "venomzera", real: "Cauã Martins", country: "BR", age: 20, role: "top", ovr: 78 },
      { ign: "tomaszin", real: "Tomás Corna", country: "AR", age: 22, role: "jungle", ovr: 79 },
      { ign: "insani", real: "Felipe Yuji", country: "BR", age: 22, role: "mid", ovr: 84, clutch: 82, intl: 80 },
      { ign: "nqz", real: "Lucas Soares", country: "BR", age: 21, role: "adc", ovr: 81, intl: 79 },
      { ign: "LNZ", real: "Linus Holtäng", country: "SE", age: 24, role: "support", ovr: 77, iq: 84 },
    ],
  },
  {
    rank: 17,
    name: "Team Liquid",
    tag: "TL",
    region: "NA",
    color: "#0ea5e9",
    coach: "flashie",
    elo: 73,
    points: 420,
    wins: 27,
    losses: 23,
    titles: 0,
    players: [
      { ign: "malbsMd", real: "Mario Samayoa", country: "GT", age: 24, role: "top", ovr: 84, intl: 83 },
      { ign: "NAF", real: "Keith Markovic", country: "CA", age: 28, role: "jungle", ovr: 82, clutch: 85, intl: 90 },
      { ign: "EliGE", real: "Jonathan Jablonowski", country: "US", age: 29, role: "mid", ovr: 84, clutch: 84, intl: 91 },
      { ign: "Jorko", real: "Georgi Mitev", country: "BG", age: 21, role: "adc", ovr: 79 },
      { ign: "JT", real: "Johnny Theodosiou", country: "ZA", age: 27, role: "support", ovr: 76, iq: 85, intl: 80 },
    ],
  },
  {
    rank: 18,
    name: "FaZe",
    tag: "FAZE",
    region: "EU",
    color: "#ef4444",
    coach: "enkay J",
    elo: 73,
    points: 405,
    wins: 26,
    losses: 23,
    titles: 0,
    players: [
      { ign: "jcobbb", real: "Jakub Pietruszewski", country: "PL", age: 22, role: "top", ovr: 79 },
      { ign: "Neityu", real: "Enzo Henriques", country: "FR", age: 21, role: "jungle", ovr: 79 },
      { ign: "frozen", real: "David Čerňanský", country: "SK", age: 24, role: "mid", ovr: 86, clutch: 86, intl: 89 },
      { ign: "JBOEN", real: "Jason Boe Nielsen", country: "DK", age: 20, role: "adc", ovr: 79 },
      { ign: "Twistzz", real: "Russell Van Dulken", country: "CA", age: 26, role: "support", ovr: 84, iq: 86, clutch: 88, intl: 92 },
    ],
  },
  {
    rank: 19,
    name: "9z",
    tag: "9Z",
    region: "SA",
    color: "#a855f7",
    coach: "tge",
    elo: 70,
    points: 380,
    wins: 27,
    losses: 22,
    titles: 0,
    players: [
      { ign: "HUASOPEEK", real: "Matias Ibañez", country: "CL", age: 23, role: "top", ovr: 78 },
      { ign: "luchov", real: "Luciano Herrera", country: "AR", age: 22, role: "jungle", ovr: 77 },
      { ign: "dgt", real: "Franco Garcia", country: "UY", age: 25, role: "mid", ovr: 81, intl: 79 },
      { ign: "history", real: "Allan Lawrenz", country: "BR", age: 22, role: "adc", ovr: 79 },
      { ign: "max", real: "Maximiliano Gonzalez", country: "UY", age: 27, role: "support", ovr: 76, iq: 83, intl: 79 },
    ],
  },
  {
    rank: 20,
    name: "Astralis",
    tag: "AST",
    region: "EU",
    color: "#dc2626",
    coach: "NEO",
    elo: 71,
    points: 365,
    wins: 25,
    losses: 24,
    titles: 0,
    players: [
      { ign: "cmtry", real: "Nikita Samolotov", country: "RU", age: 21, role: "top", ovr: 78 },
      { ign: "ryu", real: "Gytis Glušauskas", country: "LT", age: 21, role: "jungle", ovr: 78 },
      { ign: "Staehr", real: "Victor Staehr", country: "DK", age: 22, role: "mid", ovr: 81, intl: 82 },
      { ign: "phzy", real: "Love Smidebrant", country: "SE", age: 24, role: "adc", ovr: 80, intl: 79 },
      { ign: "siuhy", real: "Kamil Szkaradek", country: "PL", age: 24, role: "support", ovr: 78, iq: 88, intl: 86 },
    ],
  },
  {
    rank: 21,
    name: "paiN",
    tag: "PNG",
    region: "SA",
    color: "#e11d48",
    coach: "rikz",
    elo: 70,
    points: 340,
    wins: 25,
    losses: 22,
    titles: 0,
    players: [
      { ign: "Tatu", real: "Pedro Seixas", country: "BR", age: 19, role: "top", ovr: 77 },
      { ign: "rkzinho", real: "Rafael Costa", country: "BR", age: 20, role: "jungle", ovr: 76 },
      { ign: "snow", real: "João Vinicius", country: "BR", age: 19, role: "mid", ovr: 81, clutch: 80 },
      { ign: "saffee", real: "Rafael Costa", country: "BR", age: 31, role: "adc", ovr: 79, intl: 82 },
      { ign: "biguzera", real: "Rodrigo Bittencourt", country: "BR", age: 29, role: "support", ovr: 78, iq: 86, intl: 83 },
    ],
  },
  {
    rank: 22,
    name: "Imperial",
    tag: "IMP",
    region: "SA",
    color: "#10b981",
    coach: "tacitus",
    elo: 69,
    points: 315,
    wins: 24,
    losses: 23,
    titles: 0,
    players: [
      { ign: "chelo", real: "Marcelo Cespedes", country: "BR", age: 28, role: "top", ovr: 78, intl: 82 },
      { ign: "decenty", real: "Lucas Bacelar", country: "BR", age: 22, role: "jungle", ovr: 79 },
      { ign: "noway", real: "Kaiky Santos", country: "BR", age: 21, role: "mid", ovr: 80 },
      { ign: "saadzin", real: "Henrique Pacheco", country: "BR", age: 21, role: "adc", ovr: 79 },
      { ign: "VINI", real: "Vinicius Figueiredo", country: "BR", age: 27, role: "support", ovr: 76, iq: 83, intl: 83 },
    ],
  },
  {
    rank: 23,
    name: "HEROIC",
    tag: "HER",
    region: "EU",
    color: "#f97316",
    coach: "Snappi",
    elo: 69,
    points: 290,
    wins: 23,
    losses: 24,
    titles: 0,
    players: [
      { ign: "susp", real: "Tim Ångström", country: "SE", age: 21, role: "top", ovr: 78 },
      { ign: "nilo", real: "Linus Bergman", country: "SE", age: 21, role: "jungle", ovr: 80 },
      { ign: "Brollan", real: "Ludvig Brolin", country: "SE", age: 24, role: "mid", ovr: 82, intl: 86 },
      { ign: "MartinezSa", real: "Antonio Martinez", country: "ES", age: 25, role: "adc", ovr: 79 },
      { ign: "Chr1zN", real: "Christoffer Storgaard", country: "DK", age: 20, role: "support", ovr: 76, iq: 83 },
    ],
  },
  {
    rank: 24,
    name: "Virtus.pro",
    tag: "VP",
    region: "CIS",
    color: "#f97316",
    coach: "ProbLeM",
    elo: 68,
    points: 265,
    wins: 21,
    losses: 25,
    titles: 0,
    players: [
      { ign: "tO0RO", real: "Vladislav Arkhireev", country: "RU", age: 20, role: "top", ovr: 77 },
      { ign: "AquaRS", real: "Roman Savinov", country: "RU", age: 21, role: "jungle", ovr: 77 },
      { ign: "mir", real: "Nikolay Bityukov", country: "RU", age: 30, role: "mid", ovr: 79, intl: 83 },
      { ign: "b1st", real: "Vladimir Krasikov", country: "RU", age: 20, role: "adc", ovr: 79 },
      { ign: "Patsi", real: "Robert Isyanov", country: "RU", age: 23, role: "support", ovr: 77, intl: 81 },
    ],
  },
];

function specToTeam(spec: Cs2SeedTeamSpec): Team {
  return {
    id: uid(),
    name: spec.name,
    tag: spec.tag,
    region: spec.region,
    logo: getOfficialLogo(spec.name, spec.tag),
    color: spec.color,
    coach: spec.coach,
    roster: spec.players.map(makeCs2Player),
    synergy: Math.max(12, 34 - spec.rank),
    culture: Math.max(48, 72 - Math.floor(spec.rank / 2)),
  };
}

/** Busca o elenco real de 2026 de um time de CS2 pelo nome ou tag. */
export function getCs2TeamRoster(name?: string | null, tag?: string | null): Player[] | undefined {
  const n = (name ?? "").trim().toLowerCase();
  const t = (tag ?? "").trim().toLowerCase();
  const found = CS2_TEAMS_DB.find(
    (s) =>
      (n && (s.name.toLowerCase() === n || n.includes(s.name.toLowerCase()))) ||
      (t && s.tag.toLowerCase() === t),
  );
  return found ? found.players.map(makeCs2Player) : undefined;
}

/** Gera o ranking inicial HLTV / VRS de 2026 para `career.cs2`. */
export function buildCs2InitialCareer(): {
  teams: Record<string, CareerTeam>;
  titles: CareerTitle[];
} {
  const teams: Record<string, CareerTeam> = {};
  for (const spec of CS2_TEAMS_DB) {
    teams[spec.name.toLowerCase()] = {
      name: spec.name,
      tag: spec.tag,
      logo: getOfficialLogo(spec.name, spec.tag),
      region: spec.region,
      points: spec.points,
      wins: spec.wins,
      losses: spec.losses,
      played: spec.wins + spec.losses,
      titles: spec.titles,
      rating: spec.elo,
    };
  }

  const now = new Date().toISOString();
  const titles: CareerTitle[] = [
    {
      champName: "IEM Cologne Major 2026",
      label: "2026",
      teamName: "Falcons",
      teamTag: "FLC",
      teamLogo: getOfficialLogo("Falcons", "FLC"),
      at: now,
      game: "cs2",
      points: 180,
    },
    {
      champName: "ESL Pro League S24",
      label: "2026",
      teamName: "Vitality",
      teamTag: "VIT",
      teamLogo: getOfficialLogo("Vitality", "VIT"),
      at: now,
      game: "cs2",
      points: 120,
    },
    {
      champName: "IEM Beijing 2026",
      label: "2026",
      teamName: "MOUZ",
      teamTag: "MOUZ",
      teamLogo: getOfficialLogo("MOUZ", "MOUZ"),
      at: now,
      game: "cs2",
      points: 120,
    },
    {
      champName: "PGL Astana 2026",
      label: "2026",
      teamName: "Team Spirit",
      teamTag: "SPR",
      teamLogo: getOfficialLogo("Team Spirit", "SPR"),
      at: now,
      game: "cs2",
      points: 120,
    },
    {
      champName: "PGL Cluj-Napoca 2026",
      label: "2026",
      teamName: "Vitality",
      teamTag: "VIT",
      teamLogo: getOfficialLogo("Vitality", "VIT"),
      at: now,
      game: "cs2",
      points: 120,
    },
  ];

  return { teams, titles };
}

interface Cs2TournamentTemplate {
  name: string;
  season: string;
  region: string;
  scheduledMonth: number;
  internationalLevel: "none" | "minor" | "major";
  accentColor: string;
  format: "swiss_playoffs" | "groups_playoffs" | "bracket";
  teamNames?: string[]; // se omitido, usa Top N do ranking HLTV
  teamCount: number;
}

const CS2_CIRCUIT_2026: Cs2TournamentTemplate[] = [
  {
    name: "IEM Cologne Major 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 6,
    internationalLevel: "major",
    accentColor: "#f59e0b",
    format: "swiss_playoffs",
    teamCount: 16,
  },
  {
    name: "PGL Major Singapore 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 11,
    internationalLevel: "major",
    accentColor: "#eab308",
    format: "swiss_playoffs",
    teamCount: 16,
  },
  {
    name: "IEM Kraków 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 2,
    internationalLevel: "major",
    accentColor: "#38bdf8",
    format: "groups_playoffs",
    teamCount: 16,
  },
  {
    name: "ESL Pro League S24",
    season: "2026",
    region: "INT",
    scheduledMonth: 10,
    internationalLevel: "minor",
    accentColor: "#22c55e",
    format: "swiss_playoffs",
    teamCount: 16,
  },
  {
    name: "Esports World Cup 2026",
    season: "2026",
    region: "KSA",
    scheduledMonth: 8,
    internationalLevel: "major",
    accentColor: "#facc15",
    format: "bracket",
    teamCount: 16,
  },
  {
    name: "PGL Astana 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 5,
    internationalLevel: "minor",
    accentColor: "#a855f7",
    format: "swiss_playoffs",
    teamCount: 16,
  },
  {
    name: "IEM Rio 2026",
    season: "2026",
    region: "BR",
    scheduledMonth: 4,
    internationalLevel: "minor",
    accentColor: "#10b981",
    format: "groups_playoffs",
    teamCount: 8,
    teamNames: ["FURIA", "Vitality", "MOUZ", "Natus Vincere", "Legacy", "MIBR", "9z", "paiN"],
  },
  {
    name: "BLAST Bounty Summer 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 7,
    internationalLevel: "minor",
    accentColor: "#ef4444",
    format: "bracket",
    teamCount: 8,
  },
  {
    name: "BLAST Rivals Fall 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 11,
    internationalLevel: "minor",
    accentColor: "#f97316",
    format: "groups_playoffs",
    teamCount: 8,
  },
  {
    name: "Liga Sul-Americana CS2",
    season: "2026 Split 1",
    region: "SA",
    scheduledMonth: 3,
    internationalLevel: "none",
    accentColor: "#00ff88",
    format: "groups_playoffs",
    teamCount: 6,
    teamNames: ["FURIA", "Legacy", "MIBR", "9z", "paiN", "Imperial"],
  },
];

function buildCs2Phases(tpl: Cs2TournamentTemplate, teamIds: string[]): Phase[] {
  if (tpl.format === "swiss_playoffs") {
    const swissConfig = {
      kind: "swiss" as const,
      winsToAdvance: 3,
      lossesToEliminate: 3,
      bestOf: 1 as const,
      deciderBestOf: 3 as const,
    };
    const playoffsConfig = {
      kind: "bracket" as const,
      slots: 8,
      type: "single" as const,
      defaultBestOf: 3 as const,
      finalBestOf: 5 as const,
      bracketReset: false,
    };
    return [
      {
        id: uid(),
        name: "Fase Suíça (Swiss)",
        kind: "swiss",
        config: swissConfig,
        matches: buildPhaseMatches(swissConfig, teamIds, []),
      },
      {
        id: uid(),
        name: "Playoffs",
        kind: "bracket",
        config: playoffsConfig,
        matches: buildPhaseMatches(playoffsConfig, [], []),
      },
    ];
  }

  if (tpl.format === "groups_playoffs") {
    const numGroups = tpl.teamCount >= 12 ? 2 : tpl.teamCount === 8 ? 2 : 1;
    const perGroup = Math.ceil(tpl.teamCount / numGroups);
    const groupsConfig = {
      kind: "groups" as const,
      numGroups,
      advancePerGroup: numGroups === 1 ? 4 : tpl.teamCount >= 12 ? 4 : 2,
      bestOf: 3 as const,
      doubleRoundRobin: false,
    };
    const groups = Array.from({ length: numGroups }, (_, idx) => {
      const start = idx * perGroup;
      return {
        id: uid(),
        name: numGroups === 1 ? "Grupo Único" : `Grupo ${String.fromCharCode(65 + idx)}`,
        teamIds: teamIds.slice(start, start + perGroup),
      };
    });
    const playoffSlots = numGroups === 1 ? 4 : tpl.teamCount >= 12 ? 8 : 4;
    const playoffsConfig = {
      kind: "bracket" as const,
      slots: playoffSlots,
      type: "single" as const,
      defaultBestOf: 3 as const,
      finalBestOf: 5 as const,
      bracketReset: false,
    };
    return [
      {
        id: uid(),
        name: "Fase de Grupos",
        kind: "groups",
        config: groupsConfig,
        groups,
        matches: buildPhaseMatches(groupsConfig, teamIds, groups),
      },
      {
        id: uid(),
        name: "Playoffs",
        kind: "bracket",
        config: playoffsConfig,
        matches: buildPhaseMatches(playoffsConfig, [], []),
      },
    ];
  }

  const playoffsConfig = {
    kind: "bracket" as const,
    slots: tpl.teamCount,
    type: "single" as const,
    defaultBestOf: 3 as const,
    finalBestOf: 5 as const,
    bracketReset: false,
  };
  return [
    {
      id: uid(),
      name: "Playoffs",
      kind: "bracket",
      config: playoffsConfig,
      matches: buildPhaseMatches(playoffsConfig, teamIds, []),
    },
  ];
}

export function buildCs2SeedChampionships(): Championship[] {
  return CS2_CIRCUIT_2026.map((tpl) => {
    const specs = tpl.teamNames
      ? tpl.teamNames
          .map((n) => CS2_TEAMS_DB.find((s) => s.name.toLowerCase() === n.toLowerCase()))
          .filter((x): x is Cs2SeedTeamSpec => !!x)
      : CS2_TEAMS_DB.slice(0, tpl.teamCount);

    const teams = specs.map(specToTeam);
    const teamIds = teams.map((t) => t.id);

    return {
      id: uid(),
      name: tpl.name,
      game: "cs2",
      region: tpl.region,
      season: tpl.season,
      scheduledMonth: tpl.scheduledMonth,
      internationalLevel: tpl.internationalLevel,
      isInternational: tpl.internationalLevel !== "none",
      countsTowardsRanking: true,
      accentColor: tpl.accentColor,
      teams,
      phases: buildCs2Phases(tpl, teamIds),
    };
  });
}
