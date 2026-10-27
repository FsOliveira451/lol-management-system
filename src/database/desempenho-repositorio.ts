import type Database from "better-sqlite3";
import { chaveCampeao, resolverCampeao } from "../core/desempenho/campeoes";
import {
  calcularDesempenhoDaPessoa,
  type DesempenhoDaPessoa,
  type RegistroDesempenho,
} from "../core/desempenho/estatisticas";
import type { DadosDesempenho, Desempenho } from "../core/desempenho/tipos";
import {
  avisosDeDesempenho,
  resolverLado,
  validarDesempenho,
  type ContextoDesempenho,
  type RegistroDoLado,
} from "../core/desempenho/validacao";
import { ErroValidacao } from "../core/erros";
import type { Evento, TipoEvento } from "../core/eventos/tipos";
import type { Posicao } from "../core/jogadores/tipos";
import type { Partida } from "../core/partidas/tipos";
import { buscarEventoPorId } from "./eventos-repositorio";
import { buscarPartidaPorId } from "./partidas-repositorio";
import { buscarConvocacao } from "./presenca-repositorio";

// ---------- formatos ----------

interface LinhaDesempenho {
  id: number;
  partida_id: number;
  jogador_id: number;
  equipe_id: number;
  posicao: Posicao;
  campeao: string;
  abates: number | null;
  mortes: number | null;
  assistencias: number | null;
  criado_em: string;
  atualizado_em: string;
  apelido: string;
  equipe_nome: string;
}

// O registro com os nomes, para mostrar na tela
export interface DesempenhoDetalhado extends Desempenho {
  apelido: string;
  equipeNome: string;
}

export interface DesempenhosDaPartida {
  registros: DesempenhoDetalhado[];
  avisos: string[]; // nao bloqueiam: a tela mostra
}

export type CampoHistoricoDesempenho = "posicao" | "campeao" | "kda" | "situacao";

export interface EntradaHistoricoDesempenho {
  id: number;
  eventoId: number;
  partidaId: number;
  jogadorId: number;
  apelido: string;
  campo: CampoHistoricoDesempenho;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registradoEm: string;
}

interface LinhaHistoricoDesempenho {
  id: number;
  evento_id: number;
  partida_id: number;
  jogador_id: number;
  apelido: string | null;
  campo: CampoHistoricoDesempenho;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registrado_em: string;
}

export interface OpcoesDesempenho {
  motivo?: string;
  responsavel?: string;
}

// ---------- ajudantes ----------

const SQL_DESEMPENHO = `
  SELECT d.*, j.apelido, e.nome AS equipe_nome
  FROM desempenhos_partida d
  JOIN jogadores j ON j.id = d.jogador_id
  JOIN equipes e ON e.id = d.equipe_id`;

const ORDEM_DESEMPENHO = `
  ORDER BY e.nome COLLATE NOCASE,
    CASE d.posicao WHEN 'Top' THEN 1 WHEN 'Jungle' THEN 2 WHEN 'Mid' THEN 3
                   WHEN 'ADC' THEN 4 ELSE 5 END`;

function textoOuNull(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function linhaParaDesempenho(linha: LinhaDesempenho): DesempenhoDetalhado {
  return {
    id: linha.id,
    partidaId: linha.partida_id,
    jogadorId: linha.jogador_id,
    equipeId: linha.equipe_id,
    posicao: linha.posicao,
    campeao: linha.campeao,
    abates: linha.abates,
    mortes: linha.mortes,
    assistencias: linha.assistencias,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    apelido: linha.apelido,
    equipeNome: linha.equipe_nome,
  };
}

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { code?: unknown }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

function marcadores(quantidade: number): string {
  return Array.from({ length: quantidade }, () => "?").join(", ");
}

// Tira os campos "nao enviados" (undefined). null e valor valido (ex.: limpar o KDA) e permanece.
function semUndefined(dados: DadosDesempenho): DadosDesempenho {
  return Object.fromEntries(
    Object.entries(dados).filter(([, valor]) => valor !== undefined),
  ) as DadosDesempenho;
}

function nomeDoCampeao(texto: string | undefined): string {
  return (texto === undefined ? null : resolverCampeao(texto))?.nome ?? "";
}

function textoKda(
  abates: number | null,
  mortes: number | null,
  assistencias: number | null,
): string | null {
  return abates === null || mortes === null || assistencias === null
    ? null
    : `${abates}/${mortes}/${assistencias}`;
}

function exigirPartidaEEvento(
  banco: Database.Database,
  partidaId: number,
): { partida: Partida; evento: Evento } {
  const partida = buscarPartidaPorId(banco, partidaId);
  if (partida === null) {
    throw new ErroValidacao(["Partida não encontrada."]);
  }
  const evento = buscarEventoPorId(banco, partida.eventoId);
  if (evento === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  return { partida, evento };
}

function registrosDoLado(
  banco: Database.Database,
  partidaId: number,
  ignorarDesempenhoId?: number,
): RegistroDoLado[] {
  const linhas = banco
    .prepare(
      `SELECT jogador_id, equipe_id, posicao, campeao
       FROM desempenhos_partida
       WHERE partida_id = ? AND id <> ?`,
    )
    .all(partidaId, ignorarDesempenhoId ?? 0) as {
    jogador_id: number;
    equipe_id: number;
    posicao: Posicao;
    campeao: string;
  }[];

  return linhas.map((linha) => ({
    jogadorId: linha.jogador_id,
    equipeId: linha.equipe_id,
    posicao: linha.posicao,
    campeao: linha.campeao,
  }));
}

function registrarHistorico(
  banco: Database.Database,
  eventoId: number,
  partidaId: number,
  jogadorId: number,
  campo: CampoHistoricoDesempenho,
  valorAnterior: string | null,
  valorNovo: string | null,
  opcoes: OpcoesDesempenho,
): void {
  banco
    .prepare(
      `INSERT INTO historico_desempenho
         (evento_id, partida_id, jogador_id, campo, valor_anterior, valor_novo, motivo, responsavel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      eventoId,
      partidaId,
      jogadorId,
      campo,
      valorAnterior,
      valorNovo,
      textoOuNull(opcoes.motivo),
      opcoes.responsavel ?? null,
    );
}

// ---------- consultar ----------

export function buscarDesempenhoPorId(
  banco: Database.Database,
  id: number,
): DesempenhoDetalhado | null {
  const linha = banco.prepare(`${SQL_DESEMPENHO} WHERE d.id = ?`).get(id) as
    | LinhaDesempenho
    | undefined;
  return linha ? linhaParaDesempenho(linha) : null;
}

// Quem jogou na partida + avisos (menos de 5 por lado, mesmo campeao nos dois lados)
export function obterDesempenhosDaPartida(
  banco: Database.Database,
  partidaId: number,
): DesempenhosDaPartida {
  const { evento } = exigirPartidaEEvento(banco, partidaId);

  const linhas = banco
    .prepare(`${SQL_DESEMPENHO} WHERE d.partida_id = ? ${ORDEM_DESEMPENHO}`)
    .all(partidaId) as LinhaDesempenho[];
  const registros = linhas.map(linhaParaDesempenho);

  return {
    registros,
    avisos: avisosDeDesempenho(
      registros.map((r) => ({
        jogadorId: r.jogadorId,
        equipeId: r.equipeId,
        posicao: r.posicao,
        campeao: r.campeao,
      })),
      evento.equipes,
    ),
  };
}

// ---------- registrar ----------

export function registrarDesempenho(
  banco: Database.Database,
  partidaId: number,
  dados: DadosDesempenho,
  opcoes: OpcoesDesempenho = {},
): DesempenhoDetalhado {
  const gravar = banco.transaction((): DesempenhoDetalhado => {
    const { partida, evento } = exigirPartidaEEvento(banco, partidaId);
    const equipeIds = evento.equipes.map((equipe) => equipe.id);

    const convocacao =
      typeof dados.jogadorId === "number"
        ? buscarConvocacao(banco, evento.id, dados.jogadorId)
        : null;

    const contexto: ContextoDesempenho = {
      equipeIds,
      convocacao,
      outrosRegistros: registrosDoLado(banco, partidaId),
    };
    const erros = validarDesempenho(dados, contexto);
    if (erros.length > 0) {
      throw new ErroValidacao(erros);
    }

    const jogadorId = dados.jogadorId as number;
    const lado = resolverLado(dados.equipeId, equipeIds, convocacao).equipeId as number;
    const posicao = dados.posicao as Posicao;
    const campeao = nomeDoCampeao(dados.campeao);

    let resultado: Database.RunResult;
    try {
      resultado = banco
        .prepare(
          `INSERT INTO desempenhos_partida
             (partida_id, jogador_id, equipe_id, posicao, campeao, abates, mortes, assistencias)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          partidaId,
          jogadorId,
          lado,
          posicao,
          campeao,
          dados.abates ?? null,
          dados.mortes ?? null,
          dados.assistencias ?? null,
        );
    } catch (erro) {
      // O "cinto de seguranca" do banco disparou (as regras acima ja deveriam ter pego)
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ErroValidacao([
          "Este registro conflita com outro já existente na partida. Atualize a tela e tente de novo.",
        ]);
      }
      throw erro;
    }

    const criado = buscarDesempenhoPorId(banco, Number(resultado.lastInsertRowid));
    if (criado === null) {
      throw new Error("Falha ao ler o desempenho recém-registrado.");
    }

    registrarHistorico(
      banco,
      evento.id,
      partida.id,
      jogadorId,
      "situacao",
      null,
      `Registrado: ${criado.apelido} (${posicao}, ${campeao})`,
      opcoes,
    );
    return criado;
  });

  return gravar();
}

// ---------- corrigir ----------

export function corrigirDesempenho(
  banco: Database.Database,
  desempenhoId: number,
  dados: DadosDesempenho,
  opcoes: OpcoesDesempenho = {},
): DesempenhoDetalhado {
  const gravar = banco.transaction((): DesempenhoDetalhado => {
    const atual = buscarDesempenhoPorId(banco, desempenhoId);
    if (atual === null) {
      throw new ErroValidacao(["Registro de desempenho não encontrado."]);
    }

    // Pessoa e lado nao mudam: para isso, apague e registre de novo
    const trocouPessoa = dados.jogadorId !== undefined && dados.jogadorId !== atual.jogadorId;
    const trocouLado =
      dados.equipeId !== undefined && dados.equipeId !== null && dados.equipeId !== atual.equipeId;
    if (trocouPessoa || trocouLado) {
      throw new ErroValidacao([
        "Para trocar a pessoa ou a equipe, apague o registro e registre de novo.",
      ]);
    }

    const { partida, evento } = exigirPartidaEEvento(banco, atual.partidaId);
    const equipeIds = evento.equipes.map((equipe) => equipe.id);

    // Valida o CONJUNTO: o que ja estava gravado + o que esta sendo alterado
    const combinado: DadosDesempenho = {
      jogadorId: atual.jogadorId,
      equipeId: atual.equipeId,
      posicao: atual.posicao,
      campeao: atual.campeao,
      abates: atual.abates,
      mortes: atual.mortes,
      assistencias: atual.assistencias,
      ...semUndefined(dados),
    };

    const contexto: ContextoDesempenho = {
      equipeIds,
      convocacao: buscarConvocacao(banco, evento.id, atual.jogadorId),
      outrosRegistros: registrosDoLado(banco, atual.partidaId, atual.id),
    };
    const erros = validarDesempenho(combinado, contexto);
    if (erros.length > 0) {
      throw new ErroValidacao(erros);
    }

    const posicao = combinado.posicao as Posicao;
    const campeao = nomeDoCampeao(combinado.campeao);
    const abates = combinado.abates ?? null;
    const mortes = combinado.mortes ?? null;
    const assistencias = combinado.assistencias ?? null;

    const mudouPosicao = posicao !== atual.posicao;
    const mudouCampeao = chaveCampeao(campeao) !== chaveCampeao(atual.campeao);
    const mudouKda =
      abates !== atual.abates || mortes !== atual.mortes || assistencias !== atual.assistencias;

    if (!mudouPosicao && !mudouCampeao && !mudouKda) {
      return atual; // nada mudou: nao grava nada
    }
    if (textoOuNull(opcoes.motivo) === null) {
      throw new ErroValidacao(["Informe o motivo da correção."]);
    }

    try {
      banco
        .prepare(
          `UPDATE desempenhos_partida
           SET posicao = ?, campeao = ?, abates = ?, mortes = ?, assistencias = ?,
               atualizado_em = datetime('now')
           WHERE id = ?`,
        )
        .run(posicao, campeao, abates, mortes, assistencias, desempenhoId);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ErroValidacao([
          "Este registro conflita com outro já existente na partida. Atualize a tela e tente de novo.",
        ]);
      }
      throw erro;
    }

    if (mudouPosicao) {
      registrarHistorico(banco, evento.id, partida.id, atual.jogadorId, "posicao", atual.posicao, posicao, opcoes);
    }
    if (mudouCampeao) {
      registrarHistorico(banco, evento.id, partida.id, atual.jogadorId, "campeao", atual.campeao, campeao, opcoes);
    }
    if (mudouKda) {
      registrarHistorico(
        banco,
        evento.id,
        partida.id,
        atual.jogadorId,
        "kda",
        textoKda(atual.abates, atual.mortes, atual.assistencias),
        textoKda(abates, mortes, assistencias),
        opcoes,
      );
    }

    const corrigido = buscarDesempenhoPorId(banco, desempenhoId);
    if (corrigido === null) {
      throw new Error("Falha ao ler o desempenho corrigido.");
    }
    return corrigido;
  });

  return gravar();
}

// ---------- apagar ----------

export function apagarDesempenho(
  banco: Database.Database,
  desempenhoId: number,
  opcoes: OpcoesDesempenho = {},
): DesempenhoDetalhado {
  const gravar = banco.transaction((): DesempenhoDetalhado => {
    const atual = buscarDesempenhoPorId(banco, desempenhoId);
    if (atual === null) {
      throw new ErroValidacao(["Registro de desempenho não encontrado."]);
    }
    if (textoOuNull(opcoes.motivo) === null) {
      throw new ErroValidacao(["Informe o motivo da exclusão do registro."]);
    }
    const { partida, evento } = exigirPartidaEEvento(banco, atual.partidaId);

    banco.prepare("DELETE FROM desempenhos_partida WHERE id = ?").run(desempenhoId);
    registrarHistorico(
      banco,
      evento.id,
      partida.id,
      atual.jogadorId,
      "situacao",
      `${atual.apelido} (${atual.posicao}, ${atual.campeao})`,
      "apagado",
      opcoes,
    );
    return atual;
  });

  return gravar();
}

// Do mais antigo para o mais recente. Sobrevive aos registros apagados.
export function listarHistoricoDeDesempenhos(
  banco: Database.Database,
  eventoId: number,
): EntradaHistoricoDesempenho[] {
  const linhas = banco
    .prepare(
      `SELECT h.*, j.apelido
       FROM historico_desempenho h
       LEFT JOIN jogadores j ON j.id = h.jogador_id
       WHERE h.evento_id = ?
       ORDER BY h.id`,
    )
    .all(eventoId) as LinhaHistoricoDesempenho[];

  return linhas.map((linha) => ({
    id: linha.id,
    eventoId: linha.evento_id,
    partidaId: linha.partida_id,
    jogadorId: linha.jogador_id,
    apelido: linha.apelido ?? "?",
    campo: linha.campo,
    valorAnterior: linha.valor_anterior,
    valorNovo: linha.valor_novo,
    motivo: linha.motivo,
    responsavel: linha.responsavel,
    registradoEm: linha.registrado_em,
  }));
}

// ---------- estatisticas da pessoa (CALCULADAS, nunca gravadas) ----------

export function estatisticasDaPessoa(
  banco: Database.Database,
  jogadorId: number,
): DesempenhoDaPessoa {
  const pessoa = banco.prepare("SELECT id FROM jogadores WHERE id = ?").get(jogadorId);
  if (pessoa === undefined) {
    throw new ErroValidacao(["Pessoa não encontrada."]);
  }

  // Eventos cancelados nao contam
  const linhas = banco
    .prepare(
      `SELECT d.equipe_id, d.posicao, d.campeao, d.abates, d.mortes, d.assistencias,
              p.evento_id, p.numero, p.vencedor_equipe_id, ev.tipo, ev.inicio
       FROM desempenhos_partida d
       JOIN partidas p ON p.id = d.partida_id
       JOIN eventos ev ON ev.id = p.evento_id
       WHERE d.jogador_id = ? AND ev.status <> 'cancelado'`,
    )
    .all(jogadorId) as {
    equipe_id: number;
    posicao: Posicao;
    campeao: string;
    abates: number | null;
    mortes: number | null;
    assistencias: number | null;
    evento_id: number;
    numero: number;
    vencedor_equipe_id: number | null;
    tipo: TipoEvento;
    inicio: string;
  }[];

  // As equipes de cada evento (para separar interno de externo)
  const eventoIds = [...new Set(linhas.map((linha) => linha.evento_id))];
  const equipesPorEvento = new Map<number, number[]>();
  if (eventoIds.length > 0) {
    const ligacoes = banco
      .prepare(
        `SELECT evento_id, equipe_id FROM eventos_equipes WHERE evento_id IN (${marcadores(eventoIds.length)})`,
      )
      .all(...eventoIds) as { evento_id: number; equipe_id: number }[];
    for (const ligacao of ligacoes) {
      const lista = equipesPorEvento.get(ligacao.evento_id) ?? [];
      lista.push(ligacao.equipe_id);
      equipesPorEvento.set(ligacao.evento_id, lista);
    }
  }

  const registros: RegistroDesempenho[] = linhas.map((linha) => ({
    eventoId: linha.evento_id,
    tipo: linha.tipo,
    inicio: linha.inicio,
    numero: linha.numero,
    equipeIds: equipesPorEvento.get(linha.evento_id) ?? [],
    vencedorEquipeId: linha.vencedor_equipe_id,
    equipeIdDoLado: linha.equipe_id,
    posicao: linha.posicao,
    campeao: linha.campeao,
    abates: linha.abates,
    mortes: linha.mortes,
    assistencias: linha.assistencias,
  }));

  return calcularDesempenhoDaPessoa(registros);
}