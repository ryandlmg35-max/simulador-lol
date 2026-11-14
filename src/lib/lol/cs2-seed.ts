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

type Tier2SeedTuple = [
  name: string,
  tag: string,
  region: "EU" | "CIS" | "SA" | "NA" | "ASIA",
  country: string,
  color: string,
  coach: string,
  elo: number,
  points: number,
  wins: number,
  losses: number,
];

const REGIONAL_NICK_POOLS: Record<string, string[]> = {
  EU: [
    "k0nfig", "FASHR", "syrsoN", "tabseN", "jks", "Krimbo", "neaLaN", "k1to", "kyuubii", "tiziaN",
    "hades", "Goofy", "kRaSnaL", "Maka", "bodyy", "Lucky", "afro", "Djoko", "Ex3rcice", "Bymas",
    "niko", "acoR", "regali", "Patti", "Cabbi", "nodios", "Queenix", "nota", "sl3nd", "volt",
    "CYPHER", "Thomas", "Surreal", "MiGHTYMAX", "roman", "story", "ewjerkz", "arrozdoce", "ag1l", "rmn",
    "Plopski", "nawwk", "ztr", "bobeksde", "hampus", "isak", "joel", "Silence", "Sjuush", "Staehr",
  ],
  CIS: [
    "lollipop21k", "Forester", "KENSI", "Norwi", "NickelBack", "dek0", "sdy", "w0nderful", "npl", "headtr1ck",
    "fear", "DemQQ", "bondik", "j3kie", "OWNER", "glowiing", "d1Ledez", "tN1R", "TRAVIS", "clax",
    "Lack1", "r3salt", "FinigaN", "Aunkere", "Sdaim", "sh1geo", "Magnojez", "zweih", "zorte", "Jerry",
    "Krad", "El1an", "kelieN", "Patsi", "KaiR0N", "Djon8", "gokushima", "sm3t", "Alv", "m1QUSE",
  ],
  SA: [
    "vsm", "lucaozy", "biguzera", "nqz", "chelo", "drop", "saffee", "exit", "brnz4n", "tuurtle",
    "skullz", "decenty", "noway", "hardzao", "wood7", "chay", "piriajr", "koala", "togs", "drg",
    "b4rtiN", "maluk3", "zeph", "detr0it", "meyern", "nbl", "deco", "tomaszin", "noktse", "1962",
    "kauez", "snowzin", "gafolo", "card", "ckzao", "history", "ponter", "lash", "keiz", "shz",
  ],
  NA: [
    "Grim", "floppy", "hallzerk", "Sonic", "junior", "oSee", "Fang", "cxzi", "swisher", "reck",
    "Lake", "SLIGHT", "wiz", "Jeorge", "JBa", "stanislaw", "daps", "autimatic", "Brehze", "HexT",
    "nitr0", "Walco", "clasitas", "PwnAlone", "cooper", "motm", "Bwills", "cynic", "NosraC", "nosrac",
    "marKE", "Infinite", "viz", "RUSH", "Jonji", "PoseidoNN", "wolffe", "K4mr0", "MisteM", "D4rty",
  ],
  ASIA: [
    "Liazz", "INS", "aliStair", "vexite", "dexter", "HaZR", "Jynx", "Sico", "nettik", "sterling",
    "Westmelon", "z4kr", "EmiliaQAQ", "Starry", "flying", "Jee", "Mercury", "JamYoung", "Moseyuh", "Attacker",
    "somebody", "advent", "kaze", "B1NGO", "Summer", "ChildKing", "aumaN", "bottle", "cy1", "k4Mi",
    "dobu", "kabal", "erkaSt", "yAmi", "sk0R", "Bart4k", "H4rn", "BnTeT", "f0rsakeN", "xccurate",
  ],
};

const TIER2_TEAMS_RAW: Tier2SeedTuple[] = [
  ["Complexity", "COL", "NA", "US", "#3b82f6", "T.c", 67, 250, 22, 20],
  ["BIG", "BIG", "EU", "DE", "#1d4ed8", "kakafu", 67, 242, 23, 21],
  ["fnatic", "FNC", "EU", "GB", "#f97316", "casle", 66, 234, 21, 20],
  ["NIP", "NIP", "EU", "SE", "#a3e635", "Xizt", 66, 226, 21, 21],
  ["ENCE", "ENCE", "EU", "FI", "#facc15", "enkay J", 66, 218, 20, 20],
  ["SAW", "SAW", "EU", "PT", "#ef4444", "NABOWOW", 65, 210, 24, 22],
  ["GamerLegion", "GL", "EU", "DE", "#2563eb", "ash", 65, 204, 22, 21],
  ["B8", "B8", "CIS", "UA", "#38bdf8", "maddened", 65, 198, 24, 20],
  ["Passion UA", "PUA", "CIS", "UA", "#fbbf24", "Kane", 64, 192, 22, 19],
  ["Monte", "MNT", "EU", "UA", "#06b6d4", "lmbt", 64, 186, 21, 20],
  ["Sangal", "SNG", "EU", "TR", "#ef4444", "Jumpy", 64, 180, 22, 20],
  ["M80", "M80", "NA", "US", "#22c55e", "dephh", 64, 175, 25, 19],
  ["FlyQuest", "FLY", "ASIA", "AU", "#16a34a", "erkaSt", 63, 170, 23, 20],
  ["Wildcard", "WC", "NA", "US", "#dc2626", "vinS", 63, 165, 22, 20],
  ["Lynn Vision", "LVG", "ASIA", "CN", "#8b5cf6", "GUM", 63, 160, 23, 21],
  ["TYLOO", "TYL", "ASIA", "CN", "#ef4444", "zhokiNg", 62, 155, 22, 21],
  ["Fluxo", "FLX", "SA", "BR", "#a855f7", "tacitus", 62, 150, 24, 21],
  ["RED Canids", "RED", "SA", "BR", "#dc2626", "felippe1", 62, 146, 22, 21],
  ["Sharks", "SHK", "SA", "BR", "#0ea5e9", "coachi", 61, 142, 23, 22],
  ["ODDIK", "ODK", "SA", "BR", "#22d3ee", "rikz", 61, 138, 21, 21],
  ["NRG", "NRG", "NA", "US", "#ef4444", "daps", 61, 134, 20, 21],
  ["ECSTATIC", "ECS", "EU", "DK", "#6366f1", "casle", 61, 130, 21, 21],
  ["Sashi", "SAS", "EU", "DK", "#f43f5e", "HUNDEN", 60, 126, 20, 21],
  ["9INE", "9INE", "EU", "PL", "#8b5cf6", "nawrot", 60, 122, 20, 21],
  ["Sinners", "SIN", "EU", "CZ", "#2563eb", "Tomkeejs", 60, 118, 21, 22],
  ["500", "500", "EU", "BG", "#eab308", "djL", 60, 115, 20, 21],
  ["Zero Tenacity", "ZT", "EU", "RS", "#14b8a6", "fajkus", 59, 112, 21, 22],
  ["Dynamo Eclot", "ECL", "EU", "CZ", "#ec4899", "replay", 59, 109, 20, 21],
  ["GUN5", "GUN5", "CIS", "RU", "#f59e0b", "n0rb3r7", 59, 106, 20, 21],
  ["CYBERSHOKE", "CYB", "CIS", "RU", "#38bdf8", "brain", 59, 103, 19, 21],
  ["AMKAL", "AMK", "CIS", "RU", "#f97316", "svyat", 58, 100, 19, 22],
  ["9 Pandas", "9P", "CIS", "RU", "#ec4899", "Xoma", 58, 97, 19, 22],
  ["FORZE", "FRZ", "CIS", "RU", "#ef4444", "Fierce", 58, 94, 18, 22],
  ["RUSH B", "RUSH", "CIS", "RU", "#22c55e", "liTTle", 58, 91, 19, 22],
  ["OG", "OG", "EU", "DK", "#3b82f6", "Lambert", 58, 88, 18, 22],
  ["Endpoint", "END", "EU", "GB", "#06b6d4", "Rejin", 57, 85, 18, 22],
  ["Metizport", "MTZ", "EU", "SE", "#6366f1", "abdi", 57, 82, 19, 22],
  ["Eyeballers", "EYE", "EU", "SE", "#facc15", "JW", 57, 80, 18, 22],
  ["Johnny Speeds", "JS", "EU", "SE", "#f43f5e", "chrille", 57, 78, 18, 22],
  ["Alliance", "ALL", "EU", "SE", "#14b8a6", "Hawk", 56, 76, 17, 22],
  ["Rebels", "RBL", "EU", "PL", "#dc2626", "SZPERO", 56, 74, 18, 22],
  ["Permitta", "PRM", "EU", "PL", "#8b5cf6", "Loord", 56, 72, 17, 22],
  ["Partizan", "PTZ", "EU", "RS", "#64748b", "emi", 56, 70, 17, 22],
  ["Apeks", "APK", "EU", "NO", "#f97316", "kuben", 55, 68, 16, 23],
  ["Into The Breach", "ITB", "EU", "GB", "#ef4444", "Juve", 55, 66, 16, 23],
  ["Guild Eagles", "GE", "EU", "XK", "#f59e0b", "stikle-", 55, 64, 16, 23],
  ["ALTERNATE aTTaX", "ATN", "EU", "DE", "#3b82f6", "xenn", 55, 62, 16, 23],
  ["Sprout", "SPRT", "EU", "DE", "#22c55e", "berry", 54, 60, 15, 23],
  ["BLEED", "BLD", "EU", "SG", "#dc2626", "kassad", 54, 58, 15, 23],
  ["BESTIA", "BST", "SA", "AR", "#ef4444", "pino", 54, 56, 18, 22],
  ["Solid", "SLD", "SA", "BR", "#f59e0b", "luq", 54, 54, 17, 22],
  ["CASE", "CASE", "SA", "BR", "#38bdf8", "urban0", 53, 52, 17, 22],
  ["KRÜ", "KRU", "SA", "AR", "#ec4899", "betony", 53, 50, 16, 22],
  ["Bounty Hunters", "BH", "SA", "BR", "#a855f7", "kaiky", 53, 48, 16, 22],
  ["Galorys", "GAL", "SA", "BR", "#10b981", "delboNi", 52, 46, 15, 23],
  ["W7M", "W7M", "SA", "BR", "#dc2626", "raafa", 52, 44, 15, 23],
  ["inSanitY", "INS", "SA", "BR", "#8b5cf6", "f4stzin", 52, 42, 15, 23],
  ["2Game", "2G", "SA", "BR", "#22d3ee", "vaz", 51, 40, 14, 23],
  ["Yawara", "YAW", "SA", "BR", "#facc15", "j0w", 51, 38, 14, 23],
  ["Dusty Roots", "DR", "SA", "AR", "#a16207", "maxujas", 50, 36, 14, 24],
  ["Nouns", "NNS", "NA", "US", "#ec4899", "adreN", 54, 55, 17, 22],
  ["BOSS", "BOSS", "NA", "US", "#3b82f6", "warden", 53, 51, 16, 22],
  ["Party Astronauts", "PA", "NA", "US", "#a855f7", "ben1337", 52, 47, 15, 23],
  ["Elevate", "ELV", "NA", "US", "#ef4444", "walco", 51, 43, 14, 23],
  ["Mythic", "MYT", "NA", "US", "#22c55e", "fl0m", 50, 39, 13, 24],
  ["FLUFFY AIMERS", "FA", "NA", "US", "#f472b6", "brehze", 49, 35, 13, 24],
  ["LAG", "LAG", "NA", "US", "#06b6d4", "og", 48, 32, 12, 24],
  ["Take Flyte", "TF", "NA", "US", "#eab308", "zNf", 47, 29, 12, 25],
  ["Rare Atom", "RA", "ASIA", "CN", "#38bdf8", "k4Mi", 54, 53, 17, 22],
  ["The Huns", "HUNS", "ASIA", "MN", "#f59e0b", "maaRaa2", 53, 49, 16, 22],
  ["ATOX", "ATOX", "ASIA", "MN", "#ef4444", "dobu", 52, 45, 16, 23],
  ["Chinggis Warriors", "CW", "ASIA", "MN", "#dc2626", "ariucle", 51, 41, 15, 23],
  ["Rooster", "RST", "ASIA", "AU", "#f97316", "asap", 50, 37, 14, 23],
  ["Talon", "TLN", "ASIA", "HK", "#ef4444", "djL", 50, 34, 14, 24],
  ["Housebets", "HB", "ASIA", "AU", "#22c55e", "pz", 49, 31, 13, 24],
  ["Mindfreak", "MF", "ASIA", "AU", "#3b82f6", "texta", 48, 28, 12, 24],
  ["Vantage", "VNT", "ASIA", "AU", "#a855f7", "vision", 47, 25, 12, 25],
  ["Gods Reign", "GR", "ASIA", "IN", "#f59e0b", "Ph1NNN", 46, 22, 11, 25],
  ["JiJieHao", "JJH", "ASIA", "CN", "#06b6d4", "ISSAA", 46, 20, 11, 25],
  ["Alter Ego", "AE", "ASIA", "ID", "#ef4444", "BnTeT", 45, 18, 10, 26],
];

const ROLES_ORDER: PlayerRole[] = ["top", "jungle", "mid", "adc", "support"];

function buildTier2Roster(
  idx: number,
  region: Tier2SeedTuple[2],
  country: string,
  elo: number,
): Cs2SeedPlayerSpec[] {
  const pool = REGIONAL_NICK_POOLS[region] ?? REGIONAL_NICK_POOLS.EU;
  const baseOvr = Math.min(79, Math.max(62, elo + 8));
  return ROLES_ORDER.map((role, rIdx) => {
    const nick = pool[(idx * 5 + rIdx) % pool.length];
    const ign = idx >= Math.floor(pool.length / 5) ? `${nick}${(idx % 9) + 1}` : nick;
    const ovrOffset = rIdx === 2 ? 2 : rIdx === 3 ? 1 : rIdx === 4 ? -2 : 0;
    return {
      ign,
      real: `${ign} (${country})`,
      country,
      age: 19 + ((idx + rIdx * 3) % 10),
      role,
      ovr: Math.min(82, Math.max(60, baseOvr + ovrOffset)),
    };
  });
}

const CS2_TIER2_TEAMS: Cs2SeedTeamSpec[] = TIER2_TEAMS_RAW.map((tuple, idx) => {
  const [name, tag, region, country, color, coach, elo, points, wins, losses] = tuple;
  return {
    rank: 25 + idx,
    name,
    tag,
    region,
    color,
    coach,
    elo,
    points,
    wins,
    losses,
    titles: 0,
    players: buildTier2Roster(idx, region, country, elo),
  };
});

export const CS2_ALL_TEAMS_DB: Cs2SeedTeamSpec[] = [...CS2_TEAMS_DB, ...CS2_TIER2_TEAMS];

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
  const found = CS2_ALL_TEAMS_DB.find(
    (s) =>
      (n && (s.name.toLowerCase() === n || n.includes(s.name.toLowerCase()))) ||
      (t && s.tag.toLowerCase() === t),
  );
  return found ? found.players.map(makeCs2Player) : undefined;
}

/** Gera o ranking inicial HLTV / VRS de 2026 para `career.cs2` (104 times). */
export function buildCs2InitialCareer(): {
  teams: Record<string, CareerTeam>;
  titles: CareerTitle[];
} {
  const teams: Record<string, CareerTeam> = {};
  for (const spec of CS2_ALL_TEAMS_DB) {
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
  format: "major_3swiss" | "swiss_playoffs" | "groups_playoffs" | "bracket";
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
    format: "major_3swiss",
    teamCount: 32,
  },
  {
    name: "PGL Major Singapore 2026",
    season: "2026",
    region: "INT",
    scheduledMonth: 11,
    internationalLevel: "major",
    accentColor: "#eab308",
    format: "major_3swiss",
    teamCount: 32,
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
  if (tpl.format === "major_3swiss") {
    // Major oficial de CS2 (32 times):
    // - #1..#8 convidados direto ao Stage 3 (Swiss)
    // - #9..#16 convidados direto ao Stage 2 (Swiss)
    // - #17..#32 iniciam no Stage 1 (Swiss)
    // - Top 8 de cada Swiss avança para o próximo estágio; Top 8 do Stage 3 vai aos Playoffs.
    const stage3DirectIds = teamIds.slice(0, 8);
    const stage2DirectIds = teamIds.slice(8, 16);
    const stage1Ids = teamIds.slice(16, 32);
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
        name: "Stage 1 (Swiss)",
        kind: "swiss",
        config: swissConfig,
        advanceCount: 8,
        matches: buildPhaseMatches(swissConfig, stage1Ids, []),
      },
      {
        id: uid(),
        name: "Stage 2 (Swiss)",
        kind: "swiss",
        config: swissConfig,
        advanceCount: 8,
        directTeamIds: stage2DirectIds,
        matches: buildPhaseMatches(swissConfig, stage2DirectIds, []),
      },
      {
        id: uid(),
        name: "Stage 3 (Swiss)",
        kind: "swiss",
        config: swissConfig,
        advanceCount: 8,
        directTeamIds: stage3DirectIds,
        matches: buildPhaseMatches(swissConfig, stage3DirectIds, []),
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
          .map((n) => CS2_ALL_TEAMS_DB.find((s) => s.name.toLowerCase() === n.toLowerCase()))
          .filter((x): x is Cs2SeedTeamSpec => !!x)
      : CS2_ALL_TEAMS_DB.slice(0, tpl.teamCount);

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
