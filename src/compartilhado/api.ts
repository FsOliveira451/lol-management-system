import type {
  DadosEquipe,
  Equipe,
  FuncaoEquipe,
  Membro,
  Participacao,
} from "../core/equipes/tipos";
import type { DadosJogador, Jogador, Posicao } from "../core/jogadores/tipos";
import type { FiltrosEquipes } from "../database/equipes-repositorio";
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
  equipesListar: "equipes:listar",
  equipesCriar: "equipes:criar",
  equipesBuscar: "equipes:buscar",
  equipesEditar: "equipes:editar",
  equipesMembros: "equipes:membros",
  equipesAdicionarMembro: "equipes:adicionar-membro",
  equipesEncerrarParticipacao: "equipes:encerrar-participacao",
  equipesTrocarFuncao: "equipes:trocar-funcao",
  equipesSubstituirTitular: "equipes:substituir-titular",
} as const;

// Os "pedidos" que a tela pode fazer sobre membros de equipes.
// Repare: NENHUM deles tem campo "responsavel". Quem fez a acao sera definido
// pelo proprio programa (hoje vazio; amanha, quem estiver logado).
export interface PedidoNovaParticipacao {
  equipeId: number;
  jogadorId: number;
  funcao: FuncaoEquipe;
  posicao?: Posicao | null;
  motivo?: string;
}

export interface PedidoEncerrar {
  participacaoId: number;
  motivo: string;
}

export interface PedidoTrocaFuncao {
  participacaoId: number;
  funcao: FuncaoEquipe;
  posicao?: Posicao | null;
  motivo: string;
}

export interface PedidoSubstituicaoTitular {
  equipeId: number;
  posicao: Posicao;
  novoJogadorId: number;
  anteriorVaiParaReserva: boolean;
  motivo: string;
}

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
  equipes: {
    listar(filtros?: FiltrosEquipes): Promise<Resultado<Equipe[]>>;
    criar(dados: DadosEquipe): Promise<Resultado<Equipe>>;
    buscar(id: number): Promise<Resultado<Equipe | null>>;
    editar(id: number, dados: DadosEquipe): Promise<Resultado<Equipe>>;
    membros(equipeId: number, incluirHistorico?: boolean): Promise<Resultado<Membro[]>>;
    adicionarMembro(pedido: PedidoNovaParticipacao): Promise<Resultado<Participacao>>;
    encerrarParticipacao(pedido: PedidoEncerrar): Promise<Resultado<Participacao>>;
    trocarFuncao(pedido: PedidoTrocaFuncao): Promise<Resultado<Participacao>>;
    substituirTitular(pedido: PedidoSubstituicaoTitular): Promise<Resultado<Participacao>>;
  };
}