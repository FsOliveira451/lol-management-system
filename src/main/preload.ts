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
    substituirTitular: (pedido) => ipcRenderer.invoke(CANAIS.equipesSubstituirTitular, pedido),
  },
};

// Expoe como "window.api" dentro da tela
contextBridge.exposeInMainWorld("api", api);