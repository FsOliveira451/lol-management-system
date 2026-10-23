// Partidas: so existem em eventos que tem "outro lado" (scrim, amistoso, campeonato).
export const MAXIMO_PARTIDAS = 9; // igual ao limite de "partidas previstas"
export const DURACAO_PARTIDA_MIN = 5;
export const DURACAO_PARTIDA_MAX = 180;
export const MAXIMO_OBSERVACOES = 500;

// De onde veio o registro: digitado a mao ou (no futuro) importado da Riot
export const ORIGENS_PARTIDA = ["manual", "riot"] as const;
export type OrigemPartida = (typeof ORIGENS_PARTIDA)[number];

// Dados que o usuario informa ao registrar ou corrigir uma partida.
// vencedorEquipeId:
//   - evento com adversario externo: o id da nossa equipe (vitoria) ou null (o adversario venceu)
//   - confronto interno (2 equipes nossas): o id da equipe vencedora (null nao vale)
export interface DadosPartida {
  numero?: number;
  vencedorEquipeId?: number | null;
  duracaoMin?: number | null;
  observacoes?: string | null;
}

// Uma partida como ela existe no sistema
export interface Partida {
  id: number;
  eventoId: number;
  numero: number;
  vencedorEquipeId: number | null;
  duracaoMin: number | null;
  observacoes: string | null;
  origem: OrigemPartida;
  riotMatchId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}