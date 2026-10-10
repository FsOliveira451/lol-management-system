import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import type { DadosJogador } from "../core/jogadores/tipos";
import { CANAIS } from "../compartilhado/api";
import { executar } from "../compartilhado/executar";
import {
  criarJogador,
  listarJogadores,
  type FiltrosJogadores,
} from "../database/jogadores-repositorio";

// Registra o que o "gerente" sabe responder.
// REGRA DE OURO: tudo que chega da tela e NAO CONFIAVEL. As funcoes
// chamadas aqui ja validam os dados, e os valores so entram no SQL como parametros.
export function registrarIpc(banco: Database.Database): void {
  ipcMain.handle(CANAIS.jogadoresListar, (_evento, filtros?: FiltrosJogadores) =>
    executar(() => listarJogadores(banco, filtros)),
  );

  ipcMain.handle(CANAIS.jogadoresCriar, (_evento, dados: DadosJogador) =>
    executar(() => criarJogador(banco, dados)),
  );
}