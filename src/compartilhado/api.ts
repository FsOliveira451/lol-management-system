import type {
  DadosEquipe,
  Equipe,
  FuncaoEquipe,
  Membro,
  Participacao,
  ParticipacaoDaPessoa,
} from "../core/equipes/tipos";
import type {
  DadosEvento,
  EntradaHistoricoEvento,
  Evento,
} from "../core/eventos/tipos";
import type { DadosJogador, Jogador, Posicao } from "../core/jogadores/tipos";
import type { ConvocacaoEvento, EstadoPresenca } from "../core/presenca/tipos";
import type { FiltrosEquipes } from "../database/equipes-repositorio";
import type { FiltrosEventos } from "../database/eventos-repositorio";
import type { FiltrosJogadores } from "../database/jogadores-repositorio";
import type { EntradaHistorico } from "../database/historico-repositorio";
import type {
  ConflitoDePessoa,
  PedidoConflitosPessoas,
  PresencaDaPessoa,
  ResultadoConvocacao,
} from "../database/presenca-repositorio";

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
  jogadoresInativar: "jogadores:inativar",
  jogadoresParticipacoes: "jogadores:participacoes",
  equipesListar: "equipes:listar",
  equipesCriar: "equipes:criar",
  equipesBuscar: "equipes:buscar",
  equipesEditar: "equipes:editar",
  equipesMembros: "equipes:membros",
  equipesAdicionarMembro: "equipes:adicionar-membro",
  equipesEncerrarParticipacao: "equipes:encerrar-participacao",
  equipesTrocarFuncao: "equipes:trocar-funcao",
  equipesEscalarTitular: "equipes:escalar-titular",
  equipesDesignarStaff: "equipes:designar-staff",
  equipesInativar: "equipes:inativar",
  eventosListar: "eventos:listar",
  eventosCriar: "eventos:criar",
  eventosBuscar: "eventos:buscar",
  eventosEditar: "eventos:editar",
  eventosCancelar: "eventos:cancelar",
  eventosRealizado: "eventos:realizado",
  eventosConflitos: "eventos:conflitos",
  eventosHistorico: "eventos:historico",
  presencaConvocados: "presenca:convocados",
  presencaConvocarEquipes: "presenca:convocar-equipes",
  presencaAdicionar: "presenca:adicionar",
  presencaRemover: "presenca:remover",
  presencaDefinirEstado: "presenca:definir-estado",
  presencaDaPessoa: "presenca:da-pessoa",
  presencaConflitosPessoas: "presenca:conflitos-pessoas",
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

export interface PedidoEscalarTitular {
  equipeId: number;
  posicao: Posicao;
  jogadorId: number;
  anteriorVaiParaReserva: boolean;
  liberarEmOutraEquipe: boolean;
  outraEquipeVaiParaReserva: boolean;
  motivo?: string;
}

export interface PedidoDesignarStaff {
  equipeId: number;
  jogadorId: number;
  funcao: "capitao" | "coach";
  motivo?: string;
}

export interface PedidoInativarEquipe {
  equipeId: number;
  motivo: string;
}

export interface PedidoInativarPessoa {
  jogadorId: number;
  status: "inativo" | "fora_do_projeto";
  motivo: string;
}

// Os "pedidos" sobre eventos
export interface PedidoCriarEvento {
  dados: DadosEvento;
  ignorarConflitos?: boolean;
}

export interface PedidoEditarEvento {
  id: number;
  dados: DadosEvento;
  motivo?: string;
  ignorarConflitos?: boolean;
}

export interface PedidoCancelarEvento {
  id: number;
  motivo: string;
}

export interface PedidoConflitos {
  dados: { inicio: string; duracaoMin: number; equipeIds: number[] };
  ignorarId?: number;
}

// Os "pedidos" sobre presenca. Tambem sem "responsavel" e sem "agora".
export interface PedidoConvocado {
  eventoId: number;
  jogadorId: number;
}

export interface PedidoEstadoPresenca {
  eventoId: number;
  jogadorId: number;
  estado: EstadoPresenca;
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
    // Inativa a pessoa E a retira de todas as equipes
    inativar(pedido: PedidoInativarPessoa): Promise<Resultado<Jogador>>;
    // As equipes em que a pessoa esta agora
    participacoes(id: number): Promise<Resultado<ParticipacaoDaPessoa[]>>;
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
    escalarTitular(pedido: PedidoEscalarTitular): Promise<Resultado<Participacao>>;
    designarStaff(pedido: PedidoDesignarStaff): Promise<Resultado<Participacao>>;
    // Inativa a equipe E encerra todas as participacoes dela
    inativar(pedido: PedidoInativarEquipe): Promise<Resultado<Equipe>>;
  };
  eventos: {
    listar(filtros?: FiltrosEventos): Promise<Resultado<Evento[]>>;
    // Ao criar, o programa ja convoca os membros ativos das equipes
    criar(pedido: PedidoCriarEvento): Promise<Resultado<Evento>>;
    buscar(id: number): Promise<Resultado<Evento | null>>;
    editar(pedido: PedidoEditarEvento): Promise<Resultado<Evento>>;
    cancelar(pedido: PedidoCancelarEvento): Promise<Resultado<Evento>>;
    // O "agora" e definido pelo programa, nao pela tela
    marcarRealizado(id: number): Promise<Resultado<Evento>>;
    // Para a tela avisar do conflito enquanto o formulario e preenchido
    conflitos(pedido: PedidoConflitos): Promise<Resultado<Evento[]>>;
    historico(id: number): Promise<Resultado<EntradaHistoricoEvento[]>>;
  };
  presenca: {
    convocados(eventoId: number): Promise<Resultado<ConvocacaoEvento[]>>;
    // Convoca quem falta das equipes do evento (nunca remove ninguem)
    convocarEquipes(eventoId: number): Promise<Resultado<ResultadoConvocacao>>;
    adicionar(pedido: PedidoConvocado): Promise<Resultado<ConvocacaoEvento>>;
    remover(pedido: PedidoConvocado): Promise<Resultado<ConvocacaoEvento>>;
    definirEstado(pedido: PedidoEstadoPresenca): Promise<Resultado<ConvocacaoEvento>>;
    // Presenca calculada de uma pessoa (percentual, tendencia, alerta)
    daPessoa(jogadorId: number): Promise<Resultado<PresencaDaPessoa>>;
    // Pessoas que seriam convocadas e ja estao em outro evento no mesmo horario
    conflitosPessoas(pedido: PedidoConflitosPessoas): Promise<Resultado<ConflitoDePessoa[]>>;
  };
}