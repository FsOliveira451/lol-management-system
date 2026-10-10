import type { DadosJogador, Jogador } from "../core/jogadores/tipos";
import type { FiltrosJogadores } from "../database/jogadores-repositorio";
import type { EntradaHistorico } from "../database/historico-repositorio";

// Toda resposta do programa para a tela e UMA destas duas formas:
// deu certo (com os dados) ou deu errado (com uma lista de mensagens)
export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; erros: string[] };

// Os nomes dos "canais" (os tipos de bilhete que existem)
export const CANAIS = {
  jogadoresListar: "jogadores:listar",
  jogadoresCriar: "jogadores:criar",
  jogadoresBuscar: "jogadores:buscar",
  jogadoresEditar: "jogadores:editar",
  jogadoresHistorico: "jogadores:historico",
} as const;

// O que a tela enxerga em window.api: SO ISTO e nada mais
export interface ApiLol {
  jogadores: {
    listar(filtros?: FiltrosJogadores): Promise<Resultado<Jogador[]>>;
    criar(dados: DadosJogador): Promise<Resultado<Jogador>>;
    buscar(id: number): Promise<Resultado<Jogador | null>>;
    // A tela so pode informar o MOTIVO. O responsavel e definido pelo programa.
    editar(
      id: number,
      dados: DadosJogador,
      opcoes?: { motivo?: string },
    ): Promise<Resultado<Jogador>>;
    historico(id: number): Promise<Resultado<EntradaHistorico[]>>;
  };
}