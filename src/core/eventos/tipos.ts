// Listas oficiais (a "fonte da verdade") e os tipos derivados delas
export const TIPOS_EVENTO = [
  "treino",
  "scrim",
  "amistoso",
  "tryout",
  "vod",
  "reuniao",
  "campeonato",
] as const;

export const STATUS_EVENTO = ["agendado", "realizado", "cancelado"] as const;

export const NIVEIS_ADVERSARIO = ["inferior", "semelhante", "superior", "desconhecido"] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type StatusEvento = (typeof STATUS_EVENTO)[number];
export type NivelAdversario = (typeof NIVEIS_ADVERSARIO)[number];

// Tipos em que existe um "outro lado" (um adversario externo ou outra equipe nossa)
export const TIPOS_COM_ADVERSARIO = ["scrim", "amistoso", "campeonato"] as const;

export function temAdversario(tipo: TipoEvento): boolean {
  return (TIPOS_COM_ADVERSARIO as readonly string[]).includes(tipo);
}

// Duracao padrao, em minutos
export const DURACAO_PADRAO: Record<TipoEvento, number> = {
  treino: 120,
  scrim: 120,
  amistoso: 120,
  tryout: 120,
  vod: 60,
  reuniao: 60,
  campeonato: 180,
};

// Dados que o usuario informa ao criar ou editar um evento
export interface DadosEvento {
  tipo?: TipoEvento;
  titulo?: string | null;
  inicio?: string; // "AAAA-MM-DD HH:MM", horario local da organizacao
  duracaoMin?: number;
  equipeIds?: number[]; // as equipes DA ORGANIZACAO envolvidas
  adversario?: string | null; // adversario externo (texto livre)
  nivelAdversario?: NivelAdversario | null;
  partidasPrevistas?: number | null;
  objetivo?: string | null;
  local?: string | null; // canal, lobby, link...
  regras?: string | null; // restricoes de campeoes, observador, transmissao...
  observacoes?: string | null;
}


// Nomes para mostrar na tela e em mensagens
export const NOME_TIPO_EVENTO: Record<TipoEvento, string> = {
  treino: "Treino",
  scrim: "Scrim",
  amistoso: "Amistoso",
  tryout: "Tryout",
  vod: "Análise de VOD",
  reuniao: "Reunião",
  campeonato: "Campeonato",
};

export interface EquipeDoEvento {
  id: number;
  nome: string;
}

// Um evento, como ele existe no sistema
export interface Evento {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  inicio: string; // "AAAA-MM-DD HH:MM", horario local da organizacao
  duracaoMin: number;
  status: StatusEvento;
  adversario: string | null;
  nivelAdversario: NivelAdversario | null;
  partidasPrevistas: number | null;
  objetivo: string | null;
  local: string | null;
  regras: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  equipes: EquipeDoEvento[];
}

export type CampoHistoricoEvento = "inicio" | "duracao_min" | "status" | "equipes";

export interface EntradaHistoricoEvento {
  id: number;
  eventoId: number;
  campo: CampoHistoricoEvento;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registradoEm: string;
}