// Listas oficiais de valores permitidos (a "fonte da verdade" do sistema)
export const ELOS = [
  "Ferro",
  "Bronze",
  "Prata",
  "Ouro",
  "Platina",
  "Esmeralda",
  "Diamante",
  "Mestre",
  "Graomestre",
  "Desafiante",
  "Desconhecido",
] as const;

export const POSICOES = ["Top", "Jungle", "Mid", "ADC", "Support"] as const;

export const STATUS_JOGADOR = [
  "ativo",
  "em_avaliacao",
  "titular",
  "reserva",
  "academia",
  "casual",
  "inativo",
  "fora_do_projeto",
] as const;

// Os tipos sao gerados a partir das listas acima
export type Elo = (typeof ELOS)[number];
export type Posicao = (typeof POSICOES)[number];
export type StatusJogador = (typeof STATUS_JOGADOR)[number];

// Dados que o usuario informa ao cadastrar ou editar (tudo opcional aqui;
// a validacao decide o que e obrigatorio em cada situacao)
export interface DadosJogador {
  apelido?: string;
  riotId?: string | null;
  eloAtual?: Elo;
  eloMaximo?: Elo | null;
  posicaoPrincipal?: Posicao | null;
  posicaoSecundaria?: Posicao | null;
  experienciaCompetitiva?: boolean;
  comunicacao?: number | null;
  lideranca?: number | null;
  comprometimento?: number | null;
  status?: StatusJogador;
  observacoes?: string | null;
}

// Um jogador completo, como ele existe no sistema (usaremos na Etapa 8)
export interface Jogador {
  id: number;
  apelido: string;
  riotId: string | null;
  eloAtual: Elo;
  eloMaximo: Elo | null;
  posicaoPrincipal: Posicao | null;
  posicaoSecundaria: Posicao | null;
  experienciaCompetitiva: boolean;
  comunicacao: number | null;
  lideranca: number | null;
  comprometimento: number | null;
  status: StatusJogador;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}