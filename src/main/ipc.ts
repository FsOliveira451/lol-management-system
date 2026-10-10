import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import type { DadosEquipe } from "../core/equipes/tipos";
import type { DadosJogador } from "../core/jogadores/tipos";
import { CANAIS } from "../compartilhado/api";
import { exigirId, extrairMotivo } from "../compartilhado/entrada";
import { executar } from "../compartilhado/executar";
import {
  buscarEquipePorId,
  criarEquipe,
  editarEquipe,
  listarEquipes,
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

// Registra o que o "gerente" sabe responder.
// REGRA DE OURO: tudo que chega da tela e NAO CONFIAVEL. As funcoes
// chamadas aqui validam os dados, e os valores so entram no SQL como parametros.
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

  // Das opcoes da tela, so o MOTIVO e aproveitado. O "responsavel" ficara
  // vazio ate existir login (ai o proprio programa vai preencher).
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
}