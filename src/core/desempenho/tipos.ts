import type { Posicao } from "../jogadores/tipos";

export const MAXIMO_JOGADORES_POR_LADO = 5;
export const KDA_MAXIMO = 99;

// Dados que o usuario informa sobre quem jogou numa partida.
// equipeId e o "lado": no confronto interno diz por qual equipe a pessoa jogou.
// Os tres valores de KDA vem juntos ou ficam todos em branco (null).
export interface DadosDesempenho {
  jogadorId?: number;
  equipeId?: number | null;
  posicao?: Posicao;
  campeao?: string;
  abates?: number | null;
  mortes?: number | null;
  assistencias?: number | null;
}

// Um registro como ele existe no sistema
export interface Desempenho {
  id: number;
  partidaId: number;
  jogadorId: number;
  equipeId: number;
  posicao: Posicao;
  campeao: string;
  abates: number | null;
  mortes: number | null;
  assistencias: number | null;
  criadoEm: string;
  atualizadoEm: string;
}