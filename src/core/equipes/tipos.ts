import type { Posicao, StatusJogador } from "../jogadores/tipos";

// Listas oficiais (a "fonte da verdade") e os tipos derivados delas
export const NIVEIS_EQUIPE = ["principal", "secundaria", "academia"] as const;
export const STATUS_EQUIPE = ["em_formacao", "ativa", "inativa"] as const;
export const FUNCOES_EQUIPE = ["titular", "reserva", "academia", "capitao", "coach"] as const;

// Funcoes em que a pessoa JOGA (as outras duas sao de staff)
export const FUNCOES_DE_JOGO = ["titular", "reserva", "academia"] as const;

export type NivelEquipe = (typeof NIVEIS_EQUIPE)[number];
export type StatusEquipe = (typeof STATUS_EQUIPE)[number];
export type FuncaoEquipe = (typeof FUNCOES_EQUIPE)[number];

export function ehFuncaoDeJogo(funcao: FuncaoEquipe): boolean {
  return (FUNCOES_DE_JOGO as readonly string[]).includes(funcao);
}

// Dados que o usuario informa ao criar ou editar uma equipe
export interface DadosEquipe {
  nome?: string;
  tag?: string | null;
  nivel?: NivelEquipe;
  status?: StatusEquipe;
  objetivo?: string | null;
  observacoes?: string | null;
}

// Uma participacao que ainda esta valendo (a pessoa nao saiu da equipe)
export interface ParticipacaoAtiva {
  equipeId: number;
  jogadorId: number;
  funcao: FuncaoEquipe;
  posicao: Posicao | null;
}

// O pedido: "colocar esta pessoa nesta equipe com esta funcao"
export interface NovaParticipacao {
  equipeId: number;
  jogadorId: number;
  funcao: FuncaoEquipe;
  posicao?: Posicao | null;
}

// Tudo que a regra precisa saber para decidir
export interface ContextoParticipacao {
  statusJogador: StatusJogador;
  statusEquipe: StatusEquipe;
  ativasDoJogador: ParticipacaoAtiva[]; // todas as participacoes ativas da pessoa, em qualquer equipe
  ativasDaEquipe: ParticipacaoAtiva[]; // todas as participacoes ativas da equipe, de qualquer pessoa
}