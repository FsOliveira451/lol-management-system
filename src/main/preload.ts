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
};

// Expoe como "window.api" dentro da tela
contextBridge.exposeInMainWorld("api", api);