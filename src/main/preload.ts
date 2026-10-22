import { contextBridge, ipcRenderer } from "electron";
import { CANAIS, type ApiLol } from "../compartilhado/api";

// O "guichê": cada funcao aqui vira um pedido ao processo principal.
// A tela NUNCA recebe o ipcRenderer em si, so estas funcoes.
const api: ApiLol = {
  jogadores: {
    listar: (filtros) => ipcRenderer.invoke(CANAIS.jogadoresListar, filtros),
    criar: (dados) => ipcRenderer.invoke(CANAIS.jogadoresCriar, dados),
    buscar: (id) => ipcRenderer.invoke(CANAIS.jogadoresBuscar, id),
    editar: (id, dados, opcoes) =>
      ipcRenderer.invoke(CANAIS.jogadoresEditar, id, dados, opcoes),
    historico: (id) => ipcRenderer.invoke(CANAIS.jogadoresHistorico, id),
    inativar: (pedido) => ipcRenderer.invoke(CANAIS.jogadoresInativar, pedido),
    participacoes: (id) => ipcRenderer.invoke(CANAIS.jogadoresParticipacoes, id),
  },
  equipes: {
    listar: (filtros) => ipcRenderer.invoke(CANAIS.equipesListar, filtros),
    criar: (dados) => ipcRenderer.invoke(CANAIS.equipesCriar, dados),
    buscar: (id) => ipcRenderer.invoke(CANAIS.equipesBuscar, id),
    editar: (id, dados) => ipcRenderer.invoke(CANAIS.equipesEditar, id, dados),
    membros: (equipeId, incluirHistorico) =>
      ipcRenderer.invoke(CANAIS.equipesMembros, equipeId, incluirHistorico),
    adicionarMembro: (pedido) => ipcRenderer.invoke(CANAIS.equipesAdicionarMembro, pedido),
    encerrarParticipacao: (pedido) =>
      ipcRenderer.invoke(CANAIS.equipesEncerrarParticipacao, pedido),
    trocarFuncao: (pedido) => ipcRenderer.invoke(CANAIS.equipesTrocarFuncao, pedido),
    escalarTitular: (pedido) => ipcRenderer.invoke(CANAIS.equipesEscalarTitular, pedido),
    designarStaff: (pedido) => ipcRenderer.invoke(CANAIS.equipesDesignarStaff, pedido),
    inativar: (pedido) => ipcRenderer.invoke(CANAIS.equipesInativar, pedido),
  },
  eventos: {
    listar: (filtros) => ipcRenderer.invoke(CANAIS.eventosListar, filtros),
    criar: (pedido) => ipcRenderer.invoke(CANAIS.eventosCriar, pedido),
    buscar: (id) => ipcRenderer.invoke(CANAIS.eventosBuscar, id),
    editar: (pedido) => ipcRenderer.invoke(CANAIS.eventosEditar, pedido),
    cancelar: (pedido) => ipcRenderer.invoke(CANAIS.eventosCancelar, pedido),
    marcarRealizado: (id) => ipcRenderer.invoke(CANAIS.eventosRealizado, id),
    conflitos: (pedido) => ipcRenderer.invoke(CANAIS.eventosConflitos, pedido),
    historico: (id) => ipcRenderer.invoke(CANAIS.eventosHistorico, id),
  },
  presenca: {
    convocados: (eventoId) => ipcRenderer.invoke(CANAIS.presencaConvocados, eventoId),
    convocarEquipes: (eventoId) => ipcRenderer.invoke(CANAIS.presencaConvocarEquipes, eventoId),
    adicionar: (pedido) => ipcRenderer.invoke(CANAIS.presencaAdicionar, pedido),
    remover: (pedido) => ipcRenderer.invoke(CANAIS.presencaRemover, pedido),
    definirEstado: (pedido) => ipcRenderer.invoke(CANAIS.presencaDefinirEstado, pedido),
    daPessoa: (jogadorId) => ipcRenderer.invoke(CANAIS.presencaDaPessoa, jogadorId),
    conflitosPessoas: (pedido) => ipcRenderer.invoke(CANAIS.presencaConflitosPessoas, pedido),
  },
};

// Expoe como "window.api" dentro da tela
contextBridge.exposeInMainWorld("api", api);