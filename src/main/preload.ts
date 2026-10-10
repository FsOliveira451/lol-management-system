import { contextBridge, ipcRenderer } from "electron";
import { CANAIS, type ApiLol } from "../compartilhado/api";

// O "guichê": cada funcao aqui vira um pedido ao processo principal.
// A tela NUNCA recebe o ipcRenderer em si, so estas duas funcoes.
const api: ApiLol = {
  jogadores: {
    listar: (filtros) => ipcRenderer.invoke(CANAIS.jogadoresListar, filtros),
    criar: (dados) => ipcRenderer.invoke(CANAIS.jogadoresCriar, dados),
  },
};

// Expoe como "window.api" dentro da tela
contextBridge.exposeInMainWorld("api", api);