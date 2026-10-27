import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import type { DadosEquipe, FuncaoEquipe } from "../core/equipes/tipos";
import type { DadosDesempenho } from "../core/desempenho/tipos";
import type { DadosJogador, Posicao } from "../core/jogadores/tipos";
import { CANAIS } from "../compartilhado/api";
import {
  exigirId,
  extrairMotivo,
  lerBooleano,
  lerObjeto,
  lerTexto,
} from "../compartilhado/entrada";
import { executar } from "../compartilhado/executar";
import { agoraLocal } from "../core/eventos/tempo";
import type { DadosEvento, TipoEvento } from "../core/eventos/tipos";
import type { DadosPartida } from "../core/partidas/tipos";
import type { EstadoPresenca } from "../core/presenca/tipos";
import {
  apagarDesempenho,
  corrigirDesempenho,
  estatisticasDaPessoa,
  listarHistoricoDeDesempenhos,
  obterDesempenhosDaPartida,
  registrarDesempenho,
} from "../database/desempenho-repositorio";
import {
  buscarEventoPorId,
  cancelarEvento,
  editarEvento,
  listarConflitos,
  listarEventos,
  listarHistoricoDoEvento,
  marcarComoRealizado,
  type FiltrosEventos,
} from "../database/eventos-repositorio";
import {
  adicionarMembro,
  buscarEquipePorId,
  criarEquipe,
  editarEquipe,
  encerrarParticipacao,
  listarEquipes,
  listarMembros,
  listarParticipacoesAtivasDaPessoa,
  designarStaff,
  escalarTitular,
  inativarEquipe,
  inativarPessoa,
  trocarFuncao,
  type FiltrosEquipes,
} from "../database/equipes-repositorio";
import { listarHistoricoDoJogador } from "../database/historico-repositorio";
import {
  buscarJogadorPorId,
  criarJogador,
  editarJogador,
  listarJogadores,
  type FiltrosJogadores,
} from "../database/jogadores-repositorio";
import {
  apagarPartida,
  corrigirPartida,
  estatisticasDaEquipe,
  listarHistoricoDasPartidas,
  listarPendenciasDeResultado,
  obterPartidasDoEvento,
  registrarPartida,
} from "../database/partidas-repositorio";
import {
  adicionarConvocado,
  convocarAutomaticamente,
  criarEventoComConvocacao,
  definirEstado,
  listarConflitosDePessoas,
  listarConvocados,
  removerConvocado,
  resumirPresencaDaPessoa,
} from "../database/presenca-repositorio";

// Le um numero inteiro opcional vindo da tela: ausente = "nao enviado" (undefined);
// null e um valor valido onde a regra permite.
function lerNumeroOuNulo(valor: unknown): number | null | undefined {
  if (valor === null) return null;
  if (typeof valor === "number") return valor;
  return undefined;
}

// Le os dados de uma partida vindos da tela com desconfianca: so entra o que tem o tipo certo.
function lerDadosPartida(bruto: unknown): DadosPartida {
  const d = lerObjeto(bruto);
  const dados: DadosPartida = {};

  if (typeof d.numero === "number") dados.numero = d.numero;

  if (d.vencedorEquipeId === null) dados.vencedorEquipeId = null;
  else if (typeof d.vencedorEquipeId === "number") dados.vencedorEquipeId = d.vencedorEquipeId;

  if (d.duracaoMin === null) dados.duracaoMin = null;
  else if (typeof d.duracaoMin === "number") dados.duracaoMin = d.duracaoMin;

  if (d.observacoes === null) dados.observacoes = null;
  else if (typeof d.observacoes === "string") dados.observacoes = d.observacoes;

  return dados;
}

// Idem para o desempenho de uma pessoa numa partida. A validacao de verdade esta no core.
function lerDadosDesempenho(bruto: unknown): DadosDesempenho {
  const d = lerObjeto(bruto);
  const dados: DadosDesempenho = {};

  if (typeof d.jogadorId === "number") dados.jogadorId = d.jogadorId;

  const equipeId = lerNumeroOuNulo(d.equipeId);
  if (equipeId !== undefined) dados.equipeId = equipeId;

  if (typeof d.posicao === "string") dados.posicao = d.posicao as Posicao;
  if (typeof d.campeao === "string") dados.campeao = d.campeao;

  const abates = lerNumeroOuNulo(d.abates);
  if (abates !== undefined) dados.abates = abates;
  const mortes = lerNumeroOuNulo(d.mortes);
  if (mortes !== undefined) dados.mortes = mortes;
  const assistencias = lerNumeroOuNulo(d.assistencias);
  if (assistencias !== undefined) dados.assistencias = assistencias;

  return dados;
}

// Registra o que o "gerente" sabe responder.
// REGRA DE OURO: tudo que chega da tela e NAO CONFIAVEL. Cada campo e lido com
// desconfianca, as funcoes chamadas validam os dados, e os valores so entram
// no SQL como parametros. O "responsavel" e o "agora" NUNCA vem da tela.
export function registrarIpc(banco: Database.Database): void {
  // ---------- pessoas (jogadores e staff) ----------
  ipcMain.handle(CANAIS.jogadoresListar, (_evento, filtros?: FiltrosJogadores) =>
    executar(() => listarJogadores(banco, filtros)),
  );

  ipcMain.handle(CANAIS.jogadoresCriar, (_evento, dados: DadosJogador) =>
    executar(() => criarJogador(banco, dados)),
  );

  ipcMain.handle(CANAIS.jogadoresBuscar, (_evento, id: unknown) =>
    executar(() => buscarJogadorPorId(banco, exigirId(id))),
  );

  ipcMain.handle(
    CANAIS.jogadoresEditar,
    (_evento, id: unknown, dados: DadosJogador, opcoes: unknown) =>
      executar(() =>
        editarJogador(banco, exigirId(id), dados, { motivo: extrairMotivo(opcoes) }),
      ),
  );

  ipcMain.handle(CANAIS.jogadoresHistorico, (_evento, id: unknown) =>
    executar(() => listarHistoricoDoJogador(banco, exigirId(id))),
  );

  ipcMain.handle(CANAIS.jogadoresParticipacoes, (_evento, id: unknown) =>
    executar(() => listarParticipacoesAtivasDaPessoa(banco, exigirId(id))),
  );

  // ---------- eventos ----------
  ipcMain.handle(CANAIS.eventosListar, (_evento, filtros?: FiltrosEventos) =>
    executar(() => listarEventos(banco, filtros)),
  );

  // Cria o evento E convoca os membros ativos das equipes (tudo ou nada)
  ipcMain.handle(CANAIS.eventosCriar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return criarEventoComConvocacao(banco, lerObjeto(p.dados) as DadosEvento, {
        ignorarConflitos: lerBooleano(p.ignorarConflitos),
      });
    }),
  );

  ipcMain.handle(CANAIS.eventosBuscar, (_evento, id: unknown) =>
    executar(() => buscarEventoPorId(banco, exigirId(id))),
  );

  ipcMain.handle(CANAIS.eventosEditar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return editarEvento(banco, exigirId(p.id), lerObjeto(p.dados) as DadosEvento, {
        motivo: lerTexto(p.motivo),
        ignorarConflitos: lerBooleano(p.ignorarConflitos),
      });
    }),
  );

  ipcMain.handle(CANAIS.eventosCancelar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return cancelarEvento(banco, exigirId(p.id), { motivo: lerTexto(p.motivo) });
    }),
  );

  // O "agora" e do PROGRAMA: a tela nao tem como informar (ou forjar) a hora
  ipcMain.handle(CANAIS.eventosRealizado, (_evento, id: unknown) =>
    executar(() => marcarComoRealizado(banco, exigirId(id), agoraLocal())),
  );

  ipcMain.handle(CANAIS.eventosConflitos, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      const d = lerObjeto(p.dados);
      return listarConflitos(
        banco,
        {
          inicio: lerTexto(d.inicio) ?? "",
          duracaoMin: typeof d.duracaoMin === "number" ? d.duracaoMin : 0,
          equipeIds: Array.isArray(d.equipeIds)
            ? d.equipeIds.filter((id): id is number => typeof id === "number")
            : [],
        },
        p.ignorarId === undefined ? undefined : exigirId(p.ignorarId),
      );
    }),
  );

  ipcMain.handle(CANAIS.eventosHistorico, (_evento, id: unknown) =>
    executar(() => listarHistoricoDoEvento(banco, exigirId(id))),
  );

  // ---------- presenca e convocacao ----------
  ipcMain.handle(CANAIS.presencaConvocados, (_evento, eventoId: unknown) =>
    executar(() => listarConvocados(banco, exigirId(eventoId))),
  );

  ipcMain.handle(CANAIS.presencaConvocarEquipes, (_evento, eventoId: unknown) =>
    executar(() => convocarAutomaticamente(banco, exigirId(eventoId))),
  );

  ipcMain.handle(CANAIS.presencaAdicionar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return adicionarConvocado(banco, exigirId(p.eventoId), exigirId(p.jogadorId));
    }),
  );

  ipcMain.handle(CANAIS.presencaRemover, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return removerConvocado(banco, exigirId(p.eventoId), exigirId(p.jogadorId));
    }),
  );

  // O "agora" tambem e do PROGRAMA: ninguem registra presenca "do futuro"
  ipcMain.handle(CANAIS.presencaDefinirEstado, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return definirEstado(
        banco,
        exigirId(p.eventoId),
        exigirId(p.jogadorId),
        lerTexto(p.estado) as EstadoPresenca,
        agoraLocal(),
      );
    }),
  );

  ipcMain.handle(CANAIS.presencaDaPessoa, (_evento, jogadorId: unknown) =>
    executar(() => resumirPresencaDaPessoa(banco, exigirId(jogadorId))),
  );

  ipcMain.handle(CANAIS.presencaConflitosPessoas, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return listarConflitosDePessoas(banco, {
        tipo: lerTexto(p.tipo) as TipoEvento,
        inicio: lerTexto(p.inicio) ?? "",
        duracaoMin: typeof p.duracaoMin === "number" ? p.duracaoMin : 0,
        equipeIds: Array.isArray(p.equipeIds)
          ? p.equipeIds.filter((id): id is number => typeof id === "number")
          : [],
        ...(p.ignorarEventoId === undefined
          ? {}
          : { ignorarEventoId: exigirId(p.ignorarEventoId) }),
      });
    }),
  );

  // ---------- partidas e resultados ----------
  ipcMain.handle(CANAIS.partidasDoEvento, (_evento, eventoId: unknown) =>
    executar(() => obterPartidasDoEvento(banco, exigirId(eventoId))),
  );

  // O "agora" e do PROGRAMA: ninguem registra resultado "do futuro"
  ipcMain.handle(CANAIS.partidasRegistrar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return registrarPartida(banco, exigirId(p.eventoId), lerDadosPartida(p.dados), agoraLocal());
    }),
  );

  ipcMain.handle(CANAIS.partidasCorrigir, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return corrigirPartida(
        banco,
        exigirId(p.partidaId),
        lerDadosPartida(p.dados),
        agoraLocal(),
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );

  ipcMain.handle(CANAIS.partidasApagar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return apagarPartida(banco, exigirId(p.partidaId), { motivo: lerTexto(p.motivo) });
    }),
  );

  ipcMain.handle(CANAIS.partidasHistorico, (_evento, eventoId: unknown) =>
    executar(() => listarHistoricoDasPartidas(banco, exigirId(eventoId))),
  );

  ipcMain.handle(CANAIS.partidasEstatisticasEquipe, (_evento, equipeId: unknown) =>
    executar(() => estatisticasDaEquipe(banco, exigirId(equipeId))),
  );

  ipcMain.handle(CANAIS.partidasPendencias, () =>
    executar(() => listarPendenciasDeResultado(banco, agoraLocal())),
  );

  // ---------- desempenho individual ----------
  ipcMain.handle(CANAIS.desempenhoDaPartida, (_evento, partidaId: unknown) =>
    executar(() => obterDesempenhosDaPartida(banco, exigirId(partidaId))),
  );

  ipcMain.handle(CANAIS.desempenhoRegistrar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return registrarDesempenho(banco, exigirId(p.partidaId), lerDadosDesempenho(p.dados));
    }),
  );

  ipcMain.handle(CANAIS.desempenhoCorrigir, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return corrigirDesempenho(
        banco,
        exigirId(p.desempenhoId),
        lerDadosDesempenho(p.dados),
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );

  ipcMain.handle(CANAIS.desempenhoApagar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return apagarDesempenho(banco, exigirId(p.desempenhoId), { motivo: lerTexto(p.motivo) });
    }),
  );

  ipcMain.handle(CANAIS.desempenhoHistorico, (_evento, eventoId: unknown) =>
    executar(() => listarHistoricoDeDesempenhos(banco, exigirId(eventoId))),
  );

  ipcMain.handle(CANAIS.desempenhoDaPessoa, (_evento, jogadorId: unknown) =>
    executar(() => estatisticasDaPessoa(banco, exigirId(jogadorId))),
  );

  // ---------- equipes ----------
  ipcMain.handle(CANAIS.equipesListar, (_evento, filtros?: FiltrosEquipes) =>
    executar(() => listarEquipes(banco, filtros)),
  );

  ipcMain.handle(CANAIS.equipesCriar, (_evento, dados: DadosEquipe) =>
    executar(() => criarEquipe(banco, dados)),
  );

  ipcMain.handle(CANAIS.equipesBuscar, (_evento, id: unknown) =>
    executar(() => buscarEquipePorId(banco, exigirId(id))),
  );

  ipcMain.handle(CANAIS.equipesEditar, (_evento, id: unknown, dados: DadosEquipe) =>
    executar(() => editarEquipe(banco, exigirId(id), dados)),
  );

  // ---------- membros das equipes ----------
  ipcMain.handle(
    CANAIS.equipesMembros,
    (_evento, equipeId: unknown, incluirHistorico: unknown) =>
      executar(() =>
        listarMembros(banco, exigirId(equipeId), {
          incluirHistorico: lerBooleano(incluirHistorico),
        }),
      ),
  );

  ipcMain.handle(CANAIS.equipesAdicionarMembro, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return adicionarMembro(
        banco,
        {
          equipeId: exigirId(p.equipeId),
          jogadorId: exigirId(p.jogadorId),
          funcao: lerTexto(p.funcao) as FuncaoEquipe,
          posicao: (lerTexto(p.posicao) ?? null) as Posicao | null,
        },
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );

  ipcMain.handle(CANAIS.equipesEncerrarParticipacao, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return encerrarParticipacao(banco, exigirId(p.participacaoId), {
        motivo: lerTexto(p.motivo),
      });
    }),
  );

  ipcMain.handle(CANAIS.equipesTrocarFuncao, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return trocarFuncao(
        banco,
        exigirId(p.participacaoId),
        lerTexto(p.funcao) as FuncaoEquipe,
        (lerTexto(p.posicao) ?? null) as Posicao | null,
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );

  ipcMain.handle(CANAIS.equipesEscalarTitular, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return escalarTitular(
        banco,
        {
          equipeId: exigirId(p.equipeId),
          posicao: lerTexto(p.posicao) as Posicao,
          jogadorId: exigirId(p.jogadorId),
          anteriorVaiParaReserva: lerBooleano(p.anteriorVaiParaReserva),
          liberarEmOutraEquipe: lerBooleano(p.liberarEmOutraEquipe),
          outraEquipeVaiParaReserva: lerBooleano(p.outraEquipeVaiParaReserva),
        },
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );

  ipcMain.handle(CANAIS.equipesDesignarStaff, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return designarStaff(
        banco,
        {
          equipeId: exigirId(p.equipeId),
          jogadorId: exigirId(p.jogadorId),
          funcao: lerTexto(p.funcao) as "capitao" | "coach",
        },
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );

  ipcMain.handle(CANAIS.equipesInativar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return inativarEquipe(banco, exigirId(p.equipeId), { motivo: lerTexto(p.motivo) });
    }),
  );

  ipcMain.handle(CANAIS.jogadoresInativar, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return inativarPessoa(
        banco,
        exigirId(p.jogadorId),
        lerTexto(p.status) as "inativo" | "fora_do_projeto",
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );
}