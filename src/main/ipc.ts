import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import type { DadosEquipe, FuncaoEquipe } from "../core/equipes/tipos";
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
import {
  adicionarMembro,
  buscarEquipePorId,
  criarEquipe,
  editarEquipe,
  encerrarParticipacao,
  listarEquipes,
  listarMembros,
  substituirTitular,
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

// Registra o que o "gerente" sabe responder.
// REGRA DE OURO: tudo que chega da tela e NAO CONFIAVEL. Cada campo e lido com
// desconfianca, as funcoes chamadas validam os dados, e os valores so entram
// no SQL como parametros. O "responsavel" NUNCA vem da tela.
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

  ipcMain.handle(CANAIS.equipesSubstituirTitular, (_evento, pedido: unknown) =>
    executar(() => {
      const p = lerObjeto(pedido);
      return substituirTitular(
        banco,
        {
          equipeId: exigirId(p.equipeId),
          posicao: lerTexto(p.posicao) as Posicao,
          novoJogadorId: exigirId(p.novoJogadorId),
          anteriorVaiParaReserva: lerBooleano(p.anteriorVaiParaReserva),
        },
        { motivo: lerTexto(p.motivo) },
      );
    }),
  );
}