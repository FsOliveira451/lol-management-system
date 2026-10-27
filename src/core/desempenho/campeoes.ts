// Lista de campeoes escrita de memoria: pode estar desatualizada.
// Nomes fora da lista sao aceitos como "outro" (veja resolverCampeao).
export const CAMPEOES = [
  "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia", "Annie",
  "Aphelios", "Ashe", "Aurelion Sol", "Aurora", "Azir", "Bard", "Bel'Veth", "Blitzcrank",
  "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia", "Cho'Gath", "Corki",
  "Darius", "Diana", "Dr. Mundo", "Draven", "Ekko", "Elise", "Evelynn", "Ezreal",
  "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen", "Gnar", "Gragas",
  "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei", "Illaoi", "Irelia", "Ivern",
  "Janna", "Jarvan IV", "Jax", "Jayce", "Jhin", "Jinx", "K'Sante", "Kai'Sa", "Kalista",
  "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn", "Kennen", "Kha'Zix",
  "Kindred", "Kled", "Kog'Maw", "LeBlanc", "Lee Sin", "Leona", "Lillia", "Lissandra",
  "Lucian", "Lulu", "Lux", "Maokai", "Master Yi", "Mel", "Milio", "Miss Fortune",
  "Mordekaiser", "Morgana", "Naafiri", "Nami", "Nasus", "Nautilus", "Neeko", "Nidalee",
  "Nilah", "Nocturne", "Nunu & Willump", "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy",
  "Pyke", "Qiyana", "Quinn", "Rakan", "Rammus", "Rek'Sai", "Rell", "Renata Glasc",
  "Renekton", "Rengar", "Riven", "Rumble", "Ryze", "Samira", "Sejuani", "Senna",
  "Seraphine", "Sett", "Shaco", "Shen", "Shyvana", "Singed", "Sion", "Sivir", "Skarner",
  "Smolder", "Sona", "Soraka", "Swain", "Sylas", "Syndra", "Tahm Kench", "Taliyah",
  "Talon", "Taric", "Teemo", "Thresh", "Tristana", "Trundle", "Tryndamere",
  "Twisted Fate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne", "Veigar", "Vel'Koz",
  "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear", "Warwick", "Wukong", "Xayah",
  "Xerath", "Xin Zhao", "Yasuo", "Yone", "Yorick", "Yunara", "Yuumi", "Zac", "Zed",
  "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra",
] as const;

// "Kai'Sa", "kaisa" e "KAI SA" viram a mesma chave: "kaisa"
export function chaveCampeao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const POR_CHAVE = new Map<string, string>(CAMPEOES.map((nome) => [chaveCampeao(nome), nome]));

// Apelidos comuns
const APELIDOS: Record<string, string> = {
  nunu: "Nunu & Willump",
  renata: "Renata Glasc",
  mundo: "Dr. Mundo",
  monkeyking: "Wukong",
};

export interface CampeaoResolvido {
  nome: string; // o nome oficial, se for conhecido
  conhecido: boolean; // false = nome fora da lista (campeao novo ou erro de digitacao)
}

// Aceita a lista oficial (qualquer escrita) e tambem nomes novos com formato de nome.
// Devolve null para texto que nao parece nome de campeao.
export function resolverCampeao(texto: string): CampeaoResolvido | null {
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (!/^[\p{L}0-9 '\u2019.&-]{2,30}$/u.test(limpo)) return null;
  if (!/\p{L}/u.test(limpo)) return null;

  const chave = chaveCampeao(limpo);
  if (chave === "") return null;

  const oficial = POR_CHAVE.get(chave) ?? APELIDOS[chave];
  return oficial !== undefined ? { nome: oficial, conhecido: true } : { nome: limpo, conhecido: false };
}