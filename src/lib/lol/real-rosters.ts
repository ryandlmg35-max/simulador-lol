// AUTO-GERADO E ATUALIZADO VIA LIQUIPEDIA (https://liquipedia.net/leagueoflegends)
// Elencos oficiais reais com jogadores, países, posições e reservas.

export interface ScoutedPlayer {
  ign: string;
  real: string | null;
  country: string;
  role: "top" | "jungle" | "mid" | "adc" | "support";
  sub: boolean;
}

export interface ScoutedTeam {
  name: string;
  players: ScoutedPlayer[];
}

/** ligas -> times -> elenco real (titulares + subs marcados com sub:true). */
export const REAL_ROSTERS: Record<string, ScoutedTeam[]> = {
  "CBLOL": [
    {
      "name": "paiN Gaming",
      "players": [
        {
          "ign": "Wizer",
          "real": "Choi Ui-seok",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "CarioK",
          "real": "Marcos Santos",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Roamer",
          "real": "Lee Min-seok",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "TitaN",
          "real": "Alexandre Lima",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Kuri",
          "real": "Choi Won-yeong",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "dyNquedo",
          "real": "Matheus Rossini",
          "country": "BR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Ksta",
          "real": "Lucas Ksta",
          "country": "BR",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Celo",
          "real": "Marcelo Rovida",
          "country": "BR",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "LOUD",
      "players": [
        {
          "ign": "Robo",
          "real": "Leonardo Souza",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Gryffinn",
          "real": "Gryffin Nguyen",
          "country": "US",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Tinowns",
          "real": "Thiago Sartori",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Route",
          "real": "Moon Geom-su",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "RedBert",
          "real": "Ygor Freitas",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Croc",
          "real": "Park Jong-hoon",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Jool",
          "real": "Cho Han-wool",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Ceos",
          "real": "Denilson Oliveira",
          "country": "BR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Vivo Keyd Stars",
      "players": [
        {
          "ign": "Boal",
          "real": "Felipe Boal",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Disamis",
          "real": "Pedro Ribeiro",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Mireu",
          "real": "Jeong Jo-bin",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Morttheus",
          "real": "Matheus Vieira",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Trymbi",
          "real": "Adrian Trybus",
          "country": "PL",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Guigo",
          "real": "Guilherme Ruiz",
          "country": "BR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Toucouille",
          "real": "Loïc Dubois",
          "country": "FR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Smiley",
          "real": "Ludvig Granquist",
          "country": "SE",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "ProDelta",
          "real": "Fabio Marques",
          "country": "BR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "RED Canids",
      "players": [
        {
          "ign": "fNb",
          "real": "Francisco Braz",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Aegis",
          "real": "Gabriel Lemos",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Grevthar",
          "real": "Daniel Xavier",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Brance",
          "real": "Diego Amaral",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Frosty",
          "real": "Pedro Rossi",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Envy",
          "real": "Bruno Farias",
          "country": "BR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "JoJo",
          "real": "Gabriel Dzelme",
          "country": "BR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "FURIA",
      "players": [
        {
          "ign": "Guigo",
          "real": "Guilherme Ruiz",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Tatu",
          "real": "Pedro Seixas",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Tutsz",
          "real": "Arthur Machado",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Ayu",
          "real": "Andrey Saraiva",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "JoJo",
          "real": "Gabriel Dzelme",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Zothve",
          "real": "Cristóbal Arróspide",
          "country": "CL",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Luuukz",
          "real": "Lucas Rocha",
          "country": "BR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "Fluxo W7M",
      "players": [
        {
          "ign": "Kiari",
          "real": "Thiago Puerari",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Yampi",
          "real": "Yan Petermann",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Fuuu",
          "real": "Lucas Rehem",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Marvin",
          "real": "Marvin Vinicius",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "ProDelta",
          "real": "Fabio Marques",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "cody",
          "real": "Cristian Quispe",
          "country": "CL",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Peach",
          "real": "Lee Min-gyu",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "BAO",
          "real": "Jeong Hyeon-woo",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Scamber",
          "real": "Pedro Lemos",
          "country": "BR",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Momochi",
          "real": "Gabriel Momochi",
          "country": "BR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "KaBuM! Esports",
      "players": [
        {
          "ign": "Lonely",
          "real": "Han Gyu-joon",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Malrang",
          "real": "Kim Geun-seong",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Hauz",
          "real": "Bruno Felberge",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Netuno",
          "real": "Lucas Flores",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Ceos",
          "real": "Denilson Oliveira",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Betão",
          "real": "Lucas Leão",
          "country": "BR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Scary",
          "real": "Gabriel Fontes",
          "country": "BR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "INTZ",
      "players": [
        {
          "ign": "Tay",
          "real": "Rodrigo Panisa",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Damage",
          "real": "Yan Neves",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Dioge",
          "real": "Diogo Gaspar",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "NinjaKiwi",
          "real": "Yuji Tsutsui",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Woodboy",
          "real": "Guilherme Brizida",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Yupps",
          "real": "Lucas Yudi",
          "country": "BR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Aithusa",
          "real": "Lucas Minotti",
          "country": "BR",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Liberty",
      "players": [
        {
          "ign": "Makes",
          "real": "Gabriel Nemeth",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Drakehero",
          "real": "Luciano Júnior",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Piloto",
          "real": "Elvis Vergara",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "micaO",
          "real": "Micael Rodrigues",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Cavalo",
          "real": "Alexandre Fernandes",
          "country": "BR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Leleko",
          "real": "Alexandre Santos",
          "country": "BR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "Los Grandes",
      "players": [
        {
          "ign": "Boal",
          "real": "Felipe Boal",
          "country": "BR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Seize",
          "real": "Kim Chan-hee",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Lava",
          "real": "Kim Tae-hoon",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Celo",
          "real": "Marcelo Rovida",
          "country": "BR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Kabbie",
          "real": "Jeong Sang-hyeon",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "SuperCleber",
          "real": "Cleber Nantes",
          "country": "BR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Envy",
          "real": "Bruno Farias",
          "country": "BR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "Leviatán",
      "players": [
        {
          "ign": "Buggax",
          "real": "Mateo Aroztegui",
          "country": "UY",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Gankk",
          "real": "Ignacio Santamaria",
          "country": "AR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "cody",
          "real": "Cristian Quispe",
          "country": "CL",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Snaker",
          "real": "Brian Distefano",
          "country": "AR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Ackerman",
          "real": "Gabriel Sampaio",
          "country": "AR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "TopLop",
          "real": "Vicente Lopetegui",
          "country": "CL",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Isurus",
      "players": [
        {
          "ign": "Acce",
          "real": "Emmanuel Juárez",
          "country": "AR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Josedeodo",
          "real": "Brandon Villegas",
          "country": "AR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Kaze",
          "real": "Edgar Pastene",
          "country": "AR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Snaker",
          "real": "Brian Distefano",
          "country": "AR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Shadow",
          "real": "Eduardo Santos",
          "country": "AR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Lyonz",
          "real": "Pedro Peralta",
          "country": "AR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Estral Esports",
      "players": [
        {
          "ign": "Summit",
          "real": "Park Woo-tae",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Josedeodo",
          "real": "Brandon Villegas",
          "country": "AR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Leza",
          "real": "Fabián Gómez",
          "country": "MX",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Snaker",
          "real": "Brian Distefano",
          "country": "AR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Mia",
          "real": "Choi Sang-in",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Oddie",
          "real": "Sebastián Niño",
          "country": "PE",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "Flamengo Esports",
      "players": [
        {
          "ign": "Parang",
          "real": "Lee Sang-won",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Ranger",
          "real": "Filipe Brombilla",
          "country": "BR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Goku",
          "real": "Bruno Miyaguchi",
          "country": "BR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Bvoy",
          "real": "Ju Yeong-hoon",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Luci",
          "real": "Han Chang-hoon",
          "country": "KR",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "9z Globant",
      "players": [
        {
          "ign": "Nate",
          "real": "Damián Rea",
          "country": "AR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Froststrike",
          "real": "Sebastián Fetecua",
          "country": "CL",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Fix",
          "real": "Fabián Marchant",
          "country": "AR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Tsunami",
          "real": "Nicolás Gauto",
          "country": "AR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Crecre",
          "real": "Facundo Roverso",
          "country": "AR",
          "role": "support",
          "sub": false
        }
      ]
    }
  ],
  "LCK": [
    {
      "name": "T1",
      "players": [
        {
          "ign": "Doran",
          "real": "Choi Hyeon-joon",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Oner",
          "real": "Moon Hyeon-joon",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Faker",
          "real": "Lee Sang-hyeok",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Gumayusi",
          "real": "Lee Min-hyung",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Keria",
          "real": "Ryu Min-seok",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Rekkles",
          "real": "Carl Martin Erik Larsson",
          "country": "SE",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Smash",
          "real": "Sin Geum-jae",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Cloud",
          "real": "Mun Hyeon-seok",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Gen.G",
      "players": [
        {
          "ign": "Kiin",
          "real": "Kim Ki-in",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Canyon",
          "real": "Kim Geon-bu",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Chovy",
          "real": "Jeong Ji-hoon",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Ruler",
          "real": "Park Jae-hyuk",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Duro",
          "real": "Joo Min-kyu",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Peyz",
          "real": "Kim Su-hwan",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Lehends",
          "real": "Son Si-woo",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Hanwha Life Esports",
      "players": [
        {
          "ign": "Zeus",
          "real": "Choi Woo-je",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Peanut",
          "real": "Han Wang-ho",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Zeka",
          "real": "Kim Geon-woo",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Viper",
          "real": "Park Do-hyeon",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Delight",
          "real": "Yoo Hwan-joong",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Kanavi",
          "real": "Seo Jin-hyeok",
          "country": "KR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "Dplus KIA",
      "players": [
        {
          "ign": "Siwoo",
          "real": "Jeon Si-woo",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Lucid",
          "real": "Choi Yong-hyeok",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "ShowMaker",
          "real": "Heo Su",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Aiming",
          "real": "Kim Ha-ram",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "BeryL",
          "real": "Cho Geon-hee",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Kingen",
          "real": "Hwang Seong-hoon",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Moham",
          "real": "Jeong Jae-hun",
          "country": "KR",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Career",
          "real": "Oh Hyung-suk",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "KT Rolster",
      "players": [
        {
          "ign": "PerfecT",
          "real": "Lee Seung-min",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Pyosik",
          "real": "Hong Chang-hyeon",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Bdd",
          "real": "Gwak Bo-seong",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Deft",
          "real": "Kim Hyuk-kyu",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "BeryL",
          "real": "Cho Geon-hee",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Cuzz",
          "real": "Moon Woo-chan",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Paduck",
          "real": "Park Seok-hyeon",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Peter",
          "real": "Jeong Yoon-su",
          "country": "KR",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Way",
          "real": "Han Gil",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "BNK FEARX",
      "players": [
        {
          "ign": "Clear",
          "real": "Song Hyeon-min",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Raptor",
          "real": "Jeon Eo-jin",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Clozer",
          "real": "Lee Ju-hyeon",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Diable",
          "real": "Nam Dae-haeng",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Kellin",
          "real": "Kim Hyeong-gyu",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Hena",
          "real": "Park Jeung-hwan",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Execute",
          "real": "Lee Jeong-hoon",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Kwangdong Freecs",
      "players": [
        {
          "ign": "DuDu",
          "real": "Lee Dong-ju",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Cuzz",
          "real": "Moon Woo-chan",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "BuLLDoG",
          "real": "Lee Tae-heon",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Berserker",
          "real": "Kim Min-cheol",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Life",
          "real": "Kim Jeong-min",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Taeyoon",
          "real": "Kim Tae-yoon",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Andil",
          "real": "Kook Heon",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "DRX",
      "players": [
        {
          "ign": "Rich",
          "real": "Lee Jae-won",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Sponge",
          "real": "Bae Young-jun",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "kyeahoo",
          "real": "Kang Ye-hu",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Teddy",
          "real": "Park Jin-seong",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Pleata",
          "real": "Son Min-woo",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Rascal",
          "real": "Kim Kwang-hee",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Frog",
          "real": "Lee Min-hyeok",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Juhan",
          "real": "Lee Ju-han",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Setab",
          "real": "Song Kyeong-jin",
          "country": "KR",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Nongshim RedForce",
      "players": [
        {
          "ign": "DnDn",
          "real": "Park Geun-woo",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Sylvie",
          "real": "Lee Seung-bok",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Fisher",
          "real": "Lee Jeong-tae",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Jiwoo",
          "real": "Jung Ji-woo",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Lehends",
          "real": "Son Si-woo",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Mihile",
          "real": "Baek Sang-hwi",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Callme",
          "real": "Oh Ji-hoon",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Guger",
          "real": "Kim Do-yeop",
          "country": "KR",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Peter",
          "real": "Jeong Yoon-su",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "OK BRION",
      "players": [
        {
          "ign": "Morgan",
          "real": "Park Ru-han",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "HamBak",
          "real": "Ham Yu-jin",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Clozer",
          "real": "Lee Ju-hyeon",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Hype",
          "real": "Byeon Jeong-hyeon",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Effort",
          "real": "Lee Sang-ho",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "GIDEON",
          "real": "Kim Min-seong",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Karis",
          "real": "Kim Hong-jo",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Fate",
          "real": "Yoo Su-hyeok",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Envyy",
          "real": "Lee Myeong-joon",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Pollu",
          "real": "Oh Dong-gyu",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    }
  ],
  "LPL": [
    {
      "name": "Bilibili Gaming",
      "players": [
        {
          "ign": "Bin",
          "real": "Chen Ze-bin",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Wei",
          "real": "Yan Yang-wei",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "knight",
          "real": "Zhuo Ding",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Elk",
          "real": "Zhao Jia-hao",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "ON",
          "real": "Luo Wen-jun",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Xun",
          "real": "Peng Li-xun",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "LvMao",
          "real": "Zuo Ming-hao",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Top Esports",
      "players": [
        {
          "ign": "369",
          "real": "Bai Jia-hao",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Kanavi",
          "real": "Seo Jin-hyeok",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Creme",
          "real": "Lin Jian",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "JackeyLove",
          "real": "Yu Wen-bo",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Crisp",
          "real": "Liu Qing-song",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Tian",
          "real": "Gao Tian-peng",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Rookie",
          "real": "Song Eui-jin",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Hang",
          "real": "Fu Ming-hang",
          "country": "CN",
          "role": "support",
          "sub": true
        },
        {
          "ign": "Meiko",
          "real": "Tian Ye",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Weibo Gaming",
      "players": [
        {
          "ign": "Breathe",
          "real": "Chen Chen",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Tarzan",
          "real": "Lee Seung-yong",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Xiaohu",
          "real": "Li Yuan-hao",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Light",
          "real": "Wang Guang-yu",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Crisp",
          "real": "Liu Qing-song",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "TheShy",
          "real": "Kang Seung-lok",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Xiaohao",
          "real": "Peng Hao",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Erha",
          "real": "Shi Lin-han",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "JD Gaming",
      "players": [
        {
          "ign": "Flandre",
          "real": "Li Xuan-jun",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Xun",
          "real": "Peng Li-xun",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Scout",
          "real": "Lee Ye-chan",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Peyz",
          "real": "Kim Su-hwan",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "MISSING",
          "real": "Lou Yun-feng",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Ale",
          "real": "Hu Jia-le",
          "country": "CN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Xiaoxu",
          "real": "Xu Xing-zu",
          "country": "CN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Yagao",
          "real": "Zeng Qi",
          "country": "CN",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Ruler",
          "real": "Park Jae-hyuk",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Zhuo",
          "real": "Wang Xu-zhuo",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Invictus Gaming",
      "players": [
        {
          "ign": "TheShy",
          "real": "Kang Seung-lok",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Jiejie",
          "real": "Zhao Li-jie",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Rookie",
          "real": "Song Eui-jin",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "GALA",
          "real": "Chen Wei",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Meiko",
          "real": "Tian Ye",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Soboro",
          "real": "Lim Sung-min",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Leyan",
          "real": "Lu Jue",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Photic",
          "real": "Ying Qi-shen",
          "country": "CN",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Baolan",
          "real": "Wang Liu-yi",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "EDward Gaming",
      "players": [
        {
          "ign": "Ale",
          "real": "Hu Jia-le",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Jiejie",
          "real": "Zhao Li-jie",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Cryin",
          "real": "Yuan Cheng-wei",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Leave",
          "real": "Hu Hong-chao",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Wink",
          "real": "Zhang Rui",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Solokill",
          "real": "Mak Fu-keung",
          "country": "CN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Monki",
          "real": "Wang Meng-qi",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Fisher",
          "real": "Lee Jeong-tae",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Thesnake",
          "real": "Kang Gwang",
          "country": "CN",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Vampire",
          "real": "Zhao Zhe-lun",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Anyone's Legend",
      "players": [
        {
          "ign": "Flandre",
          "real": "Li Xuan-jun",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Tarzan",
          "real": "Lee Seung-yong",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Shanks",
          "real": "Cui Xiao-jun",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Hope",
          "real": "Wang Jie",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Kael",
          "real": "Kim Jin-hong",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Hery",
          "real": "Wang He-yong",
          "country": "CN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Croco",
          "real": "Kim Dong-beom",
          "country": "KR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "LNG Esports",
      "players": [
        {
          "ign": "Zika",
          "real": "Tang Hua-yu",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Weiwei",
          "real": "Wei Bo-han",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Scout",
          "real": "Lee Ye-chan",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "GALA",
          "real": "Chen Wei",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Hang",
          "real": "Fu Ming-hang",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Zdz",
          "real": "Zhu De-zhang",
          "country": "CN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Heng",
          "real": "Yang Cui-heng",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Mark",
          "real": "Ling Xu",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Ninjas in Pyjamas",
      "players": [
        {
          "ign": "Shanji",
          "real": "Deng Zi-jian",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Aki",
          "real": "Mao An",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Rookie",
          "real": "Song Eui-jin",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Photic",
          "real": "Ying Qi-shen",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Zhuo",
          "real": "Wang Xu-zhuo",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Doinb",
          "real": "Kim Tae-sang",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Tangyuan",
          "real": "Lin Yu-hong",
          "country": "CN",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Able",
          "real": "Dai Zhi-chun",
          "country": "CN",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "Team WE",
      "players": [
        {
          "ign": "Wayward",
          "real": "Huang Ren-xing",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Heng",
          "real": "Yang Cui-heng",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "FoFo",
          "real": "Chu Chun-lan",
          "country": "TW",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Prince",
          "real": "Lee Chae-hwan",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Iwandy",
          "real": "Liao Ding-yang",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Monki",
          "real": "Wang Meng-qi",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "LP",
          "real": "Li Fei",
          "country": "CN",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "Royal Never Give Up",
      "players": [
        {
          "ign": "Breathe",
          "real": "Chen Chen",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Wei",
          "real": "Yan Yang-wei",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Tangyuan",
          "real": "Lin Yu-hong",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Lwx",
          "real": "Lin Wei-xiang",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Ming",
          "real": "Shi Sen-ming",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "milkyway",
          "real": "Cai Zi-jun",
          "country": "CN",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "huanfeng",
          "real": "Tang Huan-feng",
          "country": "CN",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "FunPlus Phoenix",
      "players": [
        {
          "ign": "Xiaolaohu",
          "real": "Ping Xiao-hu",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "milkyway",
          "real": "Cai Zi-jun",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Care",
          "real": "Yang Jie",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "deokdam",
          "real": "Seo Dae-gil",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Life",
          "real": "Kim Jeong-min",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Zdz",
          "real": "Zhu De-zhang",
          "country": "CN",
          "role": "top",
          "sub": true
        }
      ]
    },
    {
      "name": "ThunderTalk Gaming",
      "players": [
        {
          "ign": "HOYA",
          "real": "Yoon Yong-ho",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Beichuan",
          "real": "Yang Ling",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "ucal",
          "real": "Son Woo-hyeon",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "1x",
          "real": "Sun Rui-xiang",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "QiuQiu",
          "real": "Zhang Ming",
          "country": "CN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Feather",
          "real": "Wang Lun",
          "country": "CN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "LGD Gaming",
      "players": [
        {
          "ign": "burdol",
          "real": "Noh Tae-yoon",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Meteor",
          "real": "Zeng Qi-kang",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "haichao",
          "real": "Zhang Hai-chao",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Shaoye",
          "real": "Gao Zhen-xiong",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Jinjiao",
          "real": "Xie Jin-shan",
          "country": "CN",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "Oh My God",
      "players": [
        {
          "ign": "Hery",
          "real": "Wang He-yong",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Tianzhen",
          "real": "Guo Qi-fan",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Angel",
          "real": "Xiang Tao",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Starry",
          "real": "Lei Ming",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "ppgod",
          "real": "Guo Peng",
          "country": "CN",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "Ultra Prime",
      "players": [
        {
          "ign": "Decade",
          "real": "Zhang Bo-cheng",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "H4cker",
          "real": "Yang Zhi-hao",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Yuekai",
          "real": "Zhang Yue-kai",
          "country": "CN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Doggo",
          "real": "Chiu Tzu-chuan",
          "country": "TW",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Niket",
          "real": "Li Hang-tao",
          "country": "CN",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "Rare Atom",
      "players": [
        {
          "ign": "Xiaoxu",
          "real": "Xu Xing-zu",
          "country": "CN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Naiyou",
          "real": "Gao Jin-long",
          "country": "CN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "VicLa",
          "real": "Lee Dae-kwang",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Assum",
          "real": "Zou Jun-hao",
          "country": "CN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Jwei",
          "real": "Sun Jun-wei",
          "country": "CN",
          "role": "support",
          "sub": false
        }
      ]
    }
  ],
  "LEC": [
    {
      "name": "G2 Esports",
      "players": [
        {
          "ign": "BrokenBlade",
          "real": "Sergen Çelik",
          "country": "DE",
          "role": "top",
          "sub": false
        },
        {
          "ign": "SkewMond",
          "real": "Théo Pichard",
          "country": "FR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Caps",
          "real": "Rasmus Winther",
          "country": "DK",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Hans Sama",
          "real": "Steven Liv",
          "country": "FR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Labrov",
          "real": "Petros Pavlos Evangelou",
          "country": "GR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Yike",
          "real": "Martin Sundelin",
          "country": "SE",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Mikyx",
          "real": "Mihael Mehle",
          "country": "SI",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Fnatic",
      "players": [
        {
          "ign": "Oscarinin",
          "real": "Óscar Muñoz",
          "country": "ES",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Razork",
          "real": "Iván Martín Díaz",
          "country": "ES",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Humanoid",
          "real": "Marek Brázda",
          "country": "CZ",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Upset",
          "real": "Elias Lipp",
          "country": "DE",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Mikyx",
          "real": "Mihael Mehle",
          "country": "SI",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Noah",
          "real": "Oh Hyeon-taek",
          "country": "KR",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Jun",
          "real": "Yoon Se-jun",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Movistar KOI",
      "players": [
        {
          "ign": "Myrwn",
          "real": "Álvaro Pastor",
          "country": "ES",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Elyoya",
          "real": "Javier Prades",
          "country": "ES",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Jojopyun",
          "real": "Joseph Joon Pyun",
          "country": "CA",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Supa",
          "real": "David Martínez",
          "country": "ES",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Alvaro",
          "real": "Álvaro Fernández",
          "country": "ES",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Fresskowy",
          "real": "Bartłomiej Przewoźnik",
          "country": "PL",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Karmine Corp",
      "players": [
        {
          "ign": "Canna",
          "real": "Kim Chang-dong",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Yike",
          "real": "Martin Sundelin",
          "country": "SE",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Vladi",
          "real": "Vladimiros Kourtidis",
          "country": "GR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Caliste",
          "real": "Caliste Henry-Hennebert",
          "country": "FR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Targamas",
          "real": "Raphaël Crabbé",
          "country": "BE",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Closer",
          "real": "Can Çelik",
          "country": "TR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Saken",
          "real": "Lucas Fayard",
          "country": "FR",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Team BDS",
      "players": [
        {
          "ign": "Adam",
          "real": "Adam Maanane",
          "country": "FR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Sheo",
          "real": "Théo Borile",
          "country": "FR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "nuc",
          "real": "Ilias Bizriken",
          "country": "FR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Ice",
          "real": "Yoon Sang-hoon",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Labrov",
          "real": "Petros Pavlos Evangelou",
          "country": "GR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Rooster",
          "real": "Shin Yoon-hwan",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Parus",
          "real": "Polat Furkan Çiçek",
          "country": "TR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Team Heretics",
      "players": [
        {
          "ign": "Wunder",
          "real": "Martin Hansen",
          "country": "DK",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Jankos",
          "real": "Marcin Jankowski",
          "country": "PL",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Zwyroo",
          "real": "Artur Trojan",
          "country": "PL",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Flakked",
          "real": "Víctor Lirola",
          "country": "ES",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Trymbi",
          "real": "Adrian Trybus",
          "country": "PL",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Carlsen",
          "real": "Carl Ulsted Carlsen",
          "country": "DK",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Perkz",
          "real": "Luka Perković",
          "country": "HR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Kaiser",
          "real": "Norman Kaiser",
          "country": "DE",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Team Vitality",
      "players": [
        {
          "ign": "Photon",
          "real": "Kyeong Gyu-tae",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Lyncas",
          "real": "Linas Nauncikas",
          "country": "LT",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Czajek",
          "real": "Jakub Czajka",
          "country": "PL",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Carzzy",
          "real": "Matyáš Orság",
          "country": "CZ",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Hylissang",
          "real": "Zdravets Galabov",
          "country": "BG",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Daglas",
          "real": "Kacper Dagiel",
          "country": "PL",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Vetheo",
          "real": "Vincent Berrié",
          "country": "FR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Nisqy",
          "real": "Yasin Dinçer",
          "country": "BE",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "SK Gaming",
      "players": [
        {
          "ign": "Irrelevant",
          "real": "İrfan Berk Vural",
          "country": "DE",
          "role": "top",
          "sub": false
        },
        {
          "ign": "ISMA",
          "real": "Ismaïl Boualem",
          "country": "FR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Reeker",
          "real": "Steven Chen",
          "country": "DE",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Rahel",
          "real": "Cho Min-seong",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Luon",
          "real": "Kim Hyun-ho",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "JNX",
          "real": "Janik Bartels",
          "country": "DE",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Doss",
          "real": "Mads Schwartz",
          "country": "DK",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "GIANTX",
      "players": [
        {
          "ign": "Th3Antonio",
          "real": "Antonio Espinosa",
          "country": "ES",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Juhan",
          "real": "Lee Ju-han",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Jackies",
          "real": "Adam Jeřábek",
          "country": "CZ",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Patrik",
          "real": "Patrik Jírů",
          "country": "CZ",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Jun",
          "real": "Yoon Se-jun",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Finn",
          "real": "Finn Wiestål",
          "country": "SE",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Peach",
          "real": "Lee Min-gyu",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "IgNar",
          "real": "Lee Dong-geun",
          "country": "KR",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Rogue",
      "players": [
        {
          "ign": "Szygenda",
          "real": "Mathias Jensen",
          "country": "DK",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Markoon",
          "real": "Mark van Woensel",
          "country": "NL",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Larssen",
          "real": "Emil Larsson",
          "country": "SE",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Comp",
          "real": "Markos Stamkopoulos",
          "country": "GR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Zoelys",
          "real": "Théo Le Scornec",
          "country": "FR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Finn",
          "real": "Finn Wiestål",
          "country": "SE",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Malrang",
          "real": "Kim Geun-seong",
          "country": "KR",
          "role": "jungle",
          "sub": true
        }
      ]
    }
  ],
  "LCS": [
    {
      "name": "FlyQuest",
      "players": [
        {
          "ign": "Bwipo",
          "real": "Gabriël Rau",
          "country": "BE",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Inspired",
          "real": "Kacper Słoma",
          "country": "PL",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Quad",
          "real": "Song Su-hyeong",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Massu",
          "real": "Fahad Abdulmalek",
          "country": "CA",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Busio",
          "real": "Alan Cwalina",
          "country": "US",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "Team Liquid",
      "players": [
        {
          "ign": "Impact",
          "real": "Jeong Eon-young",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "UmTi",
          "real": "Eom Seong-hyeon",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Quid",
          "real": "Lim Hyeon-seung",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Yeon",
          "real": "Sean Sung",
          "country": "US",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "CoreJJ",
          "real": "Jo Yong-in",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "APA",
          "real": "Eain Stearns",
          "country": "US",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Cloud9",
      "players": [
        {
          "ign": "Thanatos",
          "real": "Park Seung-gyu",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Blaber",
          "real": "Robert Huang",
          "country": "US",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Jojopyun",
          "real": "Joseph Joon Pyun",
          "country": "CA",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Berserker",
          "real": "Kim Min-cheol",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Vulcan",
          "real": "Philippe Laflamme",
          "country": "CA",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Loki",
          "real": "Lee Sang-min",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Zven",
          "real": "Jesper Svenningsen",
          "country": "DK",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "100 Thieves",
      "players": [
        {
          "ign": "Sniper",
          "real": "Rayyan Roux",
          "country": "CA",
          "role": "top",
          "sub": false
        },
        {
          "ign": "River",
          "real": "Kim Dong-woo",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Quid",
          "real": "Lim Hyeon-seung",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "FBI",
          "real": "Ian Victor Huang",
          "country": "AU",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Eyla",
          "real": "Bill Nguyen",
          "country": "AU",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Meech",
          "real": "Frank Shen",
          "country": "CA",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "Dignitas",
      "players": [
        {
          "ign": "Srtty",
          "real": "Richie Ngo",
          "country": "US",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Spica",
          "real": "Mingyi Lu",
          "country": "US",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Jensen",
          "real": "Nicolaj Jensen",
          "country": "DK",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Tomo",
          "real": "Frank Lam",
          "country": "US",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Isles",
          "real": "Jonah Rosario",
          "country": "AU",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Licorice",
          "real": "Eric Ritchie",
          "country": "CA",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Dove",
          "real": "Kim Jae-yeon",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Bvoy",
          "real": "Ju Yeong-hoon",
          "country": "KR",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "Shopify Rebellion",
      "players": [
        {
          "ign": "Revenge",
          "real": "Mohamed Kaddoura",
          "country": "US",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Contractz",
          "real": "Juan Arturo Garcia",
          "country": "US",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Palafox",
          "real": "Cristian Palafox",
          "country": "US",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Bvoy",
          "real": "Ju Yeong-hoon",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Zeyzal",
          "real": "Tristan Stidam",
          "country": "US",
          "role": "support",
          "sub": false
        },
        {
          "ign": "FakeGod",
          "real": "Aaron Lee",
          "country": "US",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Bugi",
          "real": "Lee Seong-yeop",
          "country": "KR",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Insanity",
          "real": "David Challe",
          "country": "US",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Disguised",
      "players": [
        {
          "ign": "FakeGod",
          "real": "Aaron Lee",
          "country": "US",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Anda",
          "real": "Andy Hoang",
          "country": "CA",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Young",
          "real": "Young-seo Park",
          "country": "US",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Rahel",
          "real": "Cho Min-seong",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Huhi",
          "real": "Choi Jae-hyun",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Castle",
          "real": "Cho Hyeon-min",
          "country": "KR",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Yukino",
          "real": "Anthony Liu",
          "country": "US",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Poome",
          "real": "Philippe Lavoie-Giguere",
          "country": "CA",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Lyon Gaming",
      "players": [
        {
          "ign": "Acce",
          "real": "Emmanuel Juárez",
          "country": "AR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Josedeodo",
          "real": "Brandon Villegas",
          "country": "AR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Leza",
          "real": "Fabián Gómez",
          "country": "MX",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Snaker",
          "real": "Brian Distefano",
          "country": "AR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Mia",
          "real": "Choi Sang-in",
          "country": "KR",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "NRG Esports",
      "players": [
        {
          "ign": "Dhokla",
          "real": "Niship Doshi",
          "country": "US",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Contractz",
          "real": "Juan Arturo Garcia",
          "country": "US",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Palafox",
          "real": "Cristian Palafox",
          "country": "US",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "FBI",
          "real": "Ian Victor Huang",
          "country": "AU",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "huhi",
          "real": "Choi Jae-hyun",
          "country": "KR",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "Immortals",
      "players": [
        {
          "ign": "Castle",
          "real": "Cho Hyeon-min",
          "country": "KR",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Armao",
          "real": "Robert Spungin",
          "country": "US",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Mask",
          "real": "Lee Sang-hun",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Tactical",
          "real": "Edward Ra",
          "country": "US",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Olleh",
          "real": "Kim Joo-sung",
          "country": "KR",
          "role": "support",
          "sub": false
        }
      ]
    }
  ],
  "LCP": [
    {
      "name": "CTBC Flying Oyster",
      "players": [
        {
          "ign": "Rest",
          "real": "Hsu Shih-chieh",
          "country": "TW",
          "role": "top",
          "sub": false
        },
        {
          "ign": "JunJia",
          "real": "Yu Chun-chia",
          "country": "TW",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "HongQ",
          "real": "Huang Chien-huang",
          "country": "TW",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Doggo",
          "real": "Chiu Tzu-chuan",
          "country": "TW",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Kaiwing",
          "real": "Ling Kai Wing",
          "country": "HK",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Driver",
          "real": "Shen Fu-ting",
          "country": "TW",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Karsa",
          "real": "Hung Hao-hsuan",
          "country": "TW",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Gori",
          "real": "Kim Tae-woo",
          "country": "KR",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Shunn",
          "real": "Chao Sheng-shun",
          "country": "TW",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "SwordArt",
          "real": "Hu Shuo-chieh",
          "country": "TW",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "GAM Esports",
      "players": [
        {
          "ign": "Kiaya",
          "real": "Trần Duy Sang",
          "country": "VN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Levi",
          "real": "Đỗ Duy Khánh",
          "country": "VN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Emo",
          "real": "Nguyễn Thái Vinh",
          "country": "VN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Artemis",
          "real": "Trần Quốc Hưng",
          "country": "VN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Elio",
          "real": "Nguyễn Kim Phụng",
          "country": "VN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Blck",
          "real": "Lê Hoàng Phúc",
          "country": "VN",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "EasyLove",
          "real": "Hứa Thành An",
          "country": "VN",
          "role": "adc",
          "sub": true
        },
        {
          "ign": "Taki",
          "real": "Đinh Anh Tài",
          "country": "VN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Fukuoka SoftBank HAWKS gaming",
      "players": [
        {
          "ign": "Evi",
          "real": "Shunsuke Murase",
          "country": "JP",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Forest",
          "real": "Lee Hyeon-seo",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "DasheR",
          "real": "Kim Deok-beom",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Marble",
          "real": "Yoon Min-woo",
          "country": "KR",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Vsta",
          "real": "Oh Hyo-seok",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Courage",
          "real": "Kim In-cheol",
          "country": "KR",
          "role": "jungle",
          "sub": true
        }
      ]
    },
    {
      "name": "DetonatioN FocusMe",
      "players": [
        {
          "ign": "RayFarky",
          "real": "Shin Ryutaro",
          "country": "JP",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Citrus",
          "real": "Byun Ji-woong",
          "country": "KR",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Aria",
          "real": "Lee Ga-eul",
          "country": "KR",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Milan",
          "real": "Kengo Masuda",
          "country": "JP",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Harp",
          "real": "Lee Ji-yoong",
          "country": "KR",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Steal",
          "real": "Moon Geon-yeong",
          "country": "JP",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Yutapon",
          "real": "Yuta Sugiura",
          "country": "JP",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "PSG Talon",
      "players": [
        {
          "ign": "Azhi",
          "real": "Huang Shang-chih",
          "country": "TW",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Karsa",
          "real": "Hung Hao-hsuan",
          "country": "TW",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Maple",
          "real": "Huang Yi-tang",
          "country": "TW",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Betty",
          "real": "Lu Yu-hung",
          "country": "TW",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Woody",
          "real": "Lin Yu-en",
          "country": "TW",
          "role": "support",
          "sub": false
        },
        {
          "ign": "JunJia",
          "real": "Yu Chun-chia",
          "country": "TW",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "FoFo",
          "real": "Chu Chun-lan",
          "country": "TW",
          "role": "mid",
          "sub": true
        }
      ]
    },
    {
      "name": "Deep Cross Gaming",
      "players": [
        {
          "ign": "Taco",
          "real": "Liao Yu-ting",
          "country": "TW",
          "role": "top",
          "sub": false
        },
        {
          "ign": "665",
          "real": "Chou Che-hsuan",
          "country": "TW",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Cryscythe",
          "real": "Chen Chien-hung",
          "country": "TW",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Tide",
          "real": "Li Ting-chun",
          "country": "TW",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Woody",
          "real": "Lin Yu-en",
          "country": "TW",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Leaky",
          "real": "Chang Tsu-hung",
          "country": "TW",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Husha",
          "real": "Huang Tzu-wei",
          "country": "TW",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Mission",
          "real": "Chen Hsiao-hsien",
          "country": "TW",
          "role": "mid",
          "sub": true
        },
        {
          "ign": "Atlen",
          "real": "Sung Ya-lun",
          "country": "TW",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "Ground Zero Gaming",
      "players": [
        {
          "ign": "BioPanther",
          "real": "Brandon Alexander",
          "country": "AU",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Shernfire",
          "real": "Shern Cherng Tai",
          "country": "MY",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Kisee",
          "real": "Vincent Tang",
          "country": "AU",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Raes",
          "real": "Quin Korebrits",
          "country": "NZ",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Dragku",
          "real": "David Boles",
          "country": "AU",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Thien",
          "real": "Nguyen Hai Thien",
          "country": "VN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Kevw",
          "real": "Kevin Wu",
          "country": "AU",
          "role": "jungle",
          "sub": true
        },
        {
          "ign": "Violet",
          "real": "Jesse Le",
          "country": "AU",
          "role": "adc",
          "sub": true
        }
      ]
    },
    {
      "name": "Vikings Esports",
      "players": [
        {
          "ign": "Kratos",
          "real": "Nguyen Le Hai Son",
          "country": "VN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Gury",
          "real": "Le Van Isak",
          "country": "VN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Kati",
          "real": "Dang Thanh Vinh",
          "country": "VN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Shogun",
          "real": "Nguyen Van Huy",
          "country": "VN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "Bie",
          "real": "Tran Duc Hieu",
          "country": "VN",
          "role": "support",
          "sub": false
        },
        {
          "ign": "Nanaue",
          "real": "Nguyen Thanh Cong",
          "country": "VN",
          "role": "top",
          "sub": true
        },
        {
          "ign": "Pago",
          "real": "Nguyen Quang Thang",
          "country": "VN",
          "role": "support",
          "sub": true
        }
      ]
    },
    {
      "name": "Team Whales",
      "players": [
        {
          "ign": "Spock",
          "real": "Le Hong Phong",
          "country": "VN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "BeanJ",
          "real": "Tran Van Chinh",
          "country": "VN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Gloryy",
          "real": "Le Ngoc Vinh",
          "country": "VN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Eddie",
          "real": "Hoang Cong Nghia",
          "country": "VN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "CBL",
          "real": "Nguyen Vo Anh Trieu",
          "country": "VN",
          "role": "support",
          "sub": false
        }
      ]
    },
    {
      "name": "Team Secret",
      "players": [
        {
          "ign": "Hiro02",
          "real": "Tran Le Trung Hau",
          "country": "VN",
          "role": "top",
          "sub": false
        },
        {
          "ign": "Qiang",
          "real": "Quach Khanh Hoang",
          "country": "VN",
          "role": "jungle",
          "sub": false
        },
        {
          "ign": "Aress",
          "real": "Doan Van Hien",
          "country": "VN",
          "role": "mid",
          "sub": false
        },
        {
          "ign": "Taki",
          "real": "Dinh Anh Tai",
          "country": "VN",
          "role": "adc",
          "sub": false
        },
        {
          "ign": "XuHao",
          "real": "Bui Hoang Son Vuong",
          "country": "VN",
          "role": "support",
          "sub": false
        }
      ]
    }
  ]
};

/** Pagina oficial usada como fonte por liga (Liquipedia). */
export const REAL_ROSTER_SOURCES: Record<string, string> = {
  CBLOL: "https://liquipedia.net/leagueoflegends/LTA_South/2025",
  LCK: "https://liquipedia.net/leagueoflegends/LCK/2025",
  LPL: "https://liquipedia.net/leagueoflegends/LPL/2025",
  LEC: "https://liquipedia.net/leagueoflegends/LEC/2025",
  LCS: "https://liquipedia.net/leagueoflegends/LTA_North/2025",
  LCP: "https://liquipedia.net/leagueoflegends/LCP/2025"
};
