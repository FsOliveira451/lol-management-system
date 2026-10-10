import type { DadosJogador, Jogador } from "../core/jogadores/tipos";
import type { FiltrosJogadores } from "../database/jogadores-repositorio";

// Toda resposta do programa para a tela e UMA destas duas formas:
// deu certo (com os dados) ou deu errado (com uma lista de mensagens)
export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; erros: string[] };

// Os nomes dos "canais" (os tipos de bilhete que existem)
export const CANAIS = {
  jogadoresListar: "jogadores:listar",
  jogadoresCriar: "jogadores:criar",
} as const;

// O que a tela enxerga em window.api: SO ISTO e nada mais
export interface ApiLol {
  jogadores: {
    listar(filtros?: FiltrosJogadores): Promise<Resultado<Jogador[]>>;
    criar(dados: DadosJogador): Promise<Resultado<Jogador>>;
  };
}