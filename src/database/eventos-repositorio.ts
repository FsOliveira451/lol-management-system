import type Database from "better-sqlite3";
import { ErroValidacao } from "../core/erros";
import {
  encontrarConflitos,
  type EventoParaConflito,
  type NovoEvento,
} from "../core/eventos/conflitos";
import { dataHoraValida, emMinutos } from "../core/eventos/tempo";
import {
  DURACAO_PADRAO,
  NOME_TIPO_EVENTO,
  type CampoHistoricoEvento,
  type DadosEvento,
  type EntradaHistoricoEvento,
  type EquipeDoEvento,
  type Evento,
  type NivelAdversario,
  type StatusEvento,
  type TipoEvento,
} from "../core/eventos/tipos";
import { validarDadosEvento } from "../core/eventos/validacao";

// ---------- formatos que chegam do banco ----------

interface LinhaEvento {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  inicio: string;
  duracao_min: number;
  status: StatusEvento;
  adversario: string | null;
  nivel_adversario: NivelAdversario | null;
  partidas_previstas: number | null;
  objetivo: string | null;
  local: string | null;
  regras: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface LinhaHistoricoEvento {
  id: number;
  evento_id: number;
  campo: CampoHistoricoEvento;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registrado_em: string;
}

export interface FiltrosEventos {
  de?: string; // "AAAA-MM-DD", inclusive
  ate?: string; // "AAAA-MM-DD", inclusive
  tipo?: TipoEvento;
  equipeId?: number;
  status?: StatusEvento;
  incluirCancelados?: boolean;
}

export interface OpcoesEvento {
  ignorarConflitos?: boolean;
  motivo?: string;
  responsavel?: string;
}

// ---------- ajudantes ----------

function textoOuNull(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

// Limpa os dados recebidos (espacos, vazio = null)
function normalizarDadosEvento(dados: DadosEvento): DadosEvento {
  const limpos: DadosEvento = { ...dados };
  if (dados.inicio !== undefined) limpos.inicio = dados.inicio.trim();
  if (dados.titulo !== undefined) limpos.titulo = textoOuNull(dados.titulo);
  if (dados.adversario !== undefined) limpos.adversario = textoOuNull(dados.adversario);
  if (dados.objetivo !== undefined) limpos.objetivo = textoOuNull(dados.objetivo);
  if (dados.local !== undefined) limpos.local = textoOuNull(dados.local);
  if (dados.regras !== undefined) limpos.regras = textoOuNull(dados.regras);
  if (dados.observacoes !== undefined) limpos.observacoes = textoOuNull(dados.observacoes);
  return limpos;
}

// Tira os campos "nao enviados" (undefined), para nao apagarem o que ja estava gravado
function semUndefined(dados: DadosEvento): DadosEvento {
  return Object.fromEntries(
    Object.entries(dados).filter(([, valor]) => valor !== undefined),
  ) as DadosEvento;
}

// As equipes de varios eventos de uma vez (evita uma consulta por evento)
function carregarEquipes(
  banco: Database.Database,
  eventoIds: number[],
): Map<number, EquipeDoEvento[]> {
  const mapa = new Map<number, EquipeDoEvento[]>();
  if (eventoIds.length === 0) return mapa;

  // Os "?" sao so marcadores: os valores vao separados, nunca dentro do texto SQL
  const marcadores = eventoIds.map(() => "?").join(", ");
  const linhas = banco
    .prepare(
      `SELECT ee.evento_id, e.id AS equipe_id, e.nome
       FROM eventos_equipes ee
       JOIN equipes e ON e.id = ee.equipe_id
       WHERE ee.evento_id IN (${marcadores})
       ORDER BY e.nome COLLATE NOCASE`,
    )
    .all(...eventoIds) as { evento_id: number; equipe_id: number; nome: string }[];

  for (const linha of linhas) {
    const lista = mapa.get(linha.evento_id) ?? [];
    lista.push({ id: linha.equipe_id, nome: linha.nome });
    mapa.set(linha.evento_id, lista);
  }
  return mapa;
}

function montarEventos(banco: Database.Database, linhas: LinhaEvento[]): Evento[] {
  const equipes = carregarEquipes(
    banco,
    linhas.map((linha) => linha.id),
  );

  return linhas.map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    inicio: linha.inicio,
    duracaoMin: linha.duracao_min,
    status: linha.status,
    adversario: linha.adversario,
    nivelAdversario: linha.nivel_adversario,
    partidasPrevistas: linha.partidas_previstas,
    objetivo: linha.objetivo,
    local: linha.local,
    regras: linha.regras,
    observacoes: linha.observacoes,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    equipes: equipes.get(linha.id) ?? [],
  }));
}

export function buscarEventoPorId(banco: Database.Database, id: number): Evento | null {
  const linha = banco.prepare("SELECT * FROM eventos WHERE id = ?").get(id) as
    | LinhaEvento
    | undefined;
  return linha ? (montarEventos(banco, [linha])[0] ?? null) : null;
}

// ---------- conflitos de horario ----------

// Eventos (nao cancelados) que envolvem ao menos uma destas equipes
function eventosDasEquipes(banco: Database.Database, equipeIds: number[]): Evento[] {
  if (equipeIds.length === 0) return [];

  const marcadores = equipeIds.map(() => "?").join(", ");
  const linhas = banco
    .prepare(
      `SELECT DISTINCT e.*
       FROM eventos e
       JOIN eventos_equipes ee ON ee.evento_id = e.id
       WHERE e.status <> 'cancelado' AND ee.equipe_id IN (${marcadores})
       ORDER BY e.inicio, e.id`,
    )
    .all(...equipeIds) as LinhaEvento[];

  return montarEventos(banco, linhas);
}

function paraConflito(evento: Evento): EventoParaConflito {
  return {
    id: evento.id,
    tipo: evento.tipo,
    titulo: evento.titulo,
    inicio: evento.inicio,
    duracaoMin: evento.duracaoMin,
    status: evento.status,
    equipeIds: evento.equipes.map((equipe) => equipe.id),
  };
}

// Quais eventos ja existentes colidem com este? (dados incompletos: lista vazia)
export function listarConflitos(
  banco: Database.Database,
  novo: NovoEvento,
  ignorarId?: number,
): Evento[] {
  if (
    !dataHoraValida(novo.inicio) ||
    !Number.isInteger(novo.duracaoMin) ||
    novo.duracaoMin < 1 ||
    novo.equipeIds.length === 0
  ) {
    return [];
  }

  const candidatos = eventosDasEquipes(banco, novo.equipeIds);
  const idsEmConflito = new Set(
    encontrarConflitos(novo, candidatos.map(paraConflito), ignorarId).map((e) => e.id),
  );
  return candidatos.filter((evento) => idsEmConflito.has(evento.id));
}

function descreverConflitos(conflitos: Evento[]): string {
  return conflitos
    .map(
      (e) =>
        `${e.titulo ?? NOME_TIPO_EVENTO[e.tipo]} em ${e.inicio} (${e.equipes.map((q) => q.nome).join(", ")})`,
    )
    .join("; ");
}

// ---------- equipes do evento ----------

// As equipes existem? Equipes inativas nao recebem eventos novos
// ("jaNoEvento": equipes que ja estavam no evento nao sao conferidas de novo)
function conferirEquipes(
  banco: Database.Database,
  equipeIds: number[],
  jaNoEvento: number[] = [],
): void {
  if (equipeIds.length === 0) return;

  const marcadores = equipeIds.map(() => "?").join(", ");
  const linhas = banco
    .prepare(`SELECT id, nome, status FROM equipes WHERE id IN (${marcadores})`)
    .all(...equipeIds) as { id: number; nome: string; status: string }[];

  if (linhas.length !== equipeIds.length) {
    throw new ErroValidacao(["Equipe não encontrada."]);
  }
  for (const linha of linhas) {
    if (linha.status === "inativa" && !jaNoEvento.includes(linha.id)) {
      throw new ErroValidacao([
        `A equipe ${linha.nome} está inativa e não pode receber eventos novos.`,
      ]);
    }
  }
}

function nomesDasEquipes(banco: Database.Database, equipeIds: number[]): string {
  if (equipeIds.length === 0) return "";

  const marcadores = equipeIds.map(() => "?").join(", ");
  const linhas = banco
    .prepare(`SELECT nome FROM equipes WHERE id IN (${marcadores}) ORDER BY nome COLLATE NOCASE`)
    .all(...equipeIds) as { nome: string }[];
  return linhas.map((linha) => linha.nome).join(", ");
}

function registrarHistoricoEvento(
  banco: Database.Database,
  eventoId: number,
  campo: CampoHistoricoEvento,
  valorAnterior: string | null,
  valorNovo: string | null,
  opcoes: OpcoesEvento,
): void {
  banco
    .prepare(
      `INSERT INTO historico_evento (evento_id, campo, valor_anterior, valor_novo, motivo, responsavel)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      eventoId,
      campo,
      valorAnterior,
      valorNovo,
      textoOuNull(opcoes.motivo),
      opcoes.responsavel ?? null,
    );
}

// ---------- criar ----------

export function criarEvento(
  banco: Database.Database,
  dados: DadosEvento,
  opcoes: OpcoesEvento = {},
): Evento {
  const completos = normalizarDadosEvento(dados);

  // Sem duracao informada, vale a padrao do tipo
  const padrao = completos.tipo !== undefined ? DURACAO_PADRAO[completos.tipo] : undefined;
  completos.duracaoMin = completos.duracaoMin ?? padrao;

  const erros = validarDadosEvento(completos);
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  const tipo = completos.tipo as TipoEvento;
  const inicio = completos.inicio as string;
  const duracaoMin = completos.duracaoMin as number;
  const equipeIds = completos.equipeIds ?? [];

  conferirEquipes(banco, equipeIds);

  if (!opcoes.ignorarConflitos) {
    const conflitos = listarConflitos(banco, { inicio, duracaoMin, equipeIds });
    if (conflitos.length > 0) {
      throw new ErroValidacao([
        `Conflito de horário: ${descreverConflitos(conflitos)}. Confirme para agendar mesmo assim.`,
      ]);
    }
  }

  // Transacao: o evento e as suas equipes sao gravados juntos
  const gravar = banco.transaction((): number => {
    const resultado = banco
      .prepare(
        `INSERT INTO eventos
           (tipo, titulo, inicio, duracao_min, adversario, nivel_adversario,
            partidas_previstas, objetivo, local, regras, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tipo,
        completos.titulo ?? null,
        inicio,
        duracaoMin,
        completos.adversario ?? null,
        completos.nivelAdversario ?? null,
        completos.partidasPrevistas ?? null,
        completos.objetivo ?? null,
        completos.local ?? null,
        completos.regras ?? null,
        completos.observacoes ?? null,
      );

    const eventoId = Number(resultado.lastInsertRowid);
    const ligar = banco.prepare("INSERT INTO eventos_equipes (evento_id, equipe_id) VALUES (?, ?)");
    for (const equipeId of equipeIds) {
      ligar.run(eventoId, equipeId);
    }
    return eventoId;
  });

  const criado = buscarEventoPorId(banco, gravar());
  if (criado === null) {
    throw new Error("Falha ao ler o evento recém-criado.");
  }
  return criado;
}

// ---------- listar ----------

export function listarEventos(
  banco: Database.Database,
  filtros: FiltrosEventos = {},
): Evento[] {
  const condicoes: string[] = [];
  const valores: (string | number)[] = [];

  if (filtros.de) {
    condicoes.push("substr(inicio, 1, 10) >= ?");
    valores.push(filtros.de);
  }
  if (filtros.ate) {
    condicoes.push("substr(inicio, 1, 10) <= ?");
    valores.push(filtros.ate);
  }
  if (filtros.tipo) {
    condicoes.push("tipo = ?");
    valores.push(filtros.tipo);
  }
  if (filtros.status) {
    condicoes.push("status = ?");
    valores.push(filtros.status);
  } else if (!filtros.incluirCancelados) {
    condicoes.push("status <> 'cancelado'");
  }
  if (filtros.equipeId !== undefined) {
    condicoes.push("id IN (SELECT evento_id FROM eventos_equipes WHERE equipe_id = ?)");
    valores.push(filtros.equipeId);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  const linhas = banco
    .prepare(`SELECT * FROM eventos ${where} ORDER BY inicio, id`)
    .all(...valores) as LinhaEvento[];

  return montarEventos(banco, linhas);
}

// ---------- editar ----------

// Mapa: campo do sistema -> coluna do banco (as equipes ficam em outra tabela)
const COLUNAS_EVENTO: Record<Exclude<keyof DadosEvento, "equipeIds">, string> = {
  tipo: "tipo",
  titulo: "titulo",
  inicio: "inicio",
  duracaoMin: "duracao_min",
  adversario: "adversario",
  nivelAdversario: "nivel_adversario",
  partidasPrevistas: "partidas_previstas",
  objetivo: "objetivo",
  local: "local",
  regras: "regras",
  observacoes: "observacoes",
};

export function editarEvento(
  banco: Database.Database,
  id: number,
  dados: DadosEvento,
  opcoes: OpcoesEvento = {},
): Evento {
  const atual = buscarEventoPorId(banco, id);
  if (atual === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  if (atual.status === "cancelado") {
    throw new ErroValidacao(["Evento cancelado não pode ser editado."]);
  }

  // Valida o CONJUNTO: o que ja estava gravado + o que esta sendo alterado
  const equipeIdsAntes = atual.equipes.map((equipe) => equipe.id);
  const combinado: DadosEvento = {
    tipo: atual.tipo,
    titulo: atual.titulo,
    inicio: atual.inicio,
    duracaoMin: atual.duracaoMin,
    equipeIds: equipeIdsAntes,
    adversario: atual.adversario,
    nivelAdversario: atual.nivelAdversario,
    partidasPrevistas: atual.partidasPrevistas,
    objetivo: atual.objetivo,
    local: atual.local,
    regras: atual.regras,
    observacoes: atual.observacoes,
    ...semUndefined(normalizarDadosEvento(dados)),
  };

  const erros = validarDadosEvento(combinado);
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  const inicio = combinado.inicio as string;
  const duracaoMin = combinado.duracaoMin as number;
  const equipeIdsDepois = combinado.equipeIds ?? [];

  const mudouInicio = inicio !== atual.inicio;
  const mudouDuracao = duracaoMin !== atual.duracaoMin;
  const mudouEquipes =
    [...equipeIdsAntes].sort((a, b) => a - b).join(",") !==
    [...equipeIdsDepois].sort((a, b) => a - b).join(",");

  // Evento que ja aconteceu: o que importa para resultados e presenca fica travado
  if (
    atual.status === "realizado" &&
    (combinado.tipo !== atual.tipo ||
      combinado.adversario !== atual.adversario ||
      mudouInicio ||
      mudouDuracao ||
      mudouEquipes)
  ) {
    throw new ErroValidacao([
      "Evento realizado não pode ter tipo, data, duração, equipes ou adversário alterados.",
    ]);
  }

  if (mudouInicio && textoOuNull(opcoes.motivo) === null) {
    throw new ErroValidacao(["Informe o motivo da remarcação."]);
  }

  if (mudouEquipes) {
    conferirEquipes(banco, equipeIdsDepois, equipeIdsAntes);
  }

  if ((mudouInicio || mudouDuracao || mudouEquipes) && !opcoes.ignorarConflitos) {
    const conflitos = listarConflitos(
      banco,
      { inicio, duracaoMin, equipeIds: equipeIdsDepois },
      id,
    );
    if (conflitos.length > 0) {
      throw new ErroValidacao([
        `Conflito de horário: ${descreverConflitos(conflitos)}. Confirme para agendar mesmo assim.`,
      ]);
    }
  }

  // Quais colunas realmente mudaram?
  const alteracoes: string[] = [];
  const valores: (string | number | null)[] = [];

  for (const chave of Object.keys(COLUNAS_EVENTO) as (keyof typeof COLUNAS_EVENTO)[]) {
    const valor = combinado[chave];
    if (valor === undefined) continue;
    if (valor === atual[chave]) continue; // nada mudou: nao grava

    alteracoes.push(`${COLUNAS_EVENTO[chave]} = ?`);
    valores.push(valor);
  }

  if (alteracoes.length === 0 && !mudouEquipes) {
    return atual;
  }

  const gravar = banco.transaction(() => {
    if (alteracoes.length > 0) {
      banco
        .prepare(
          `UPDATE eventos SET ${alteracoes.join(", ")}, atualizado_em = datetime('now') WHERE id = ?`,
        )
        .run(...valores, id);
    }

    if (mudouEquipes) {
      banco.prepare("DELETE FROM eventos_equipes WHERE evento_id = ?").run(id);
      const ligar = banco.prepare(
        "INSERT INTO eventos_equipes (evento_id, equipe_id) VALUES (?, ?)",
      );
      for (const equipeId of equipeIdsDepois) {
        ligar.run(id, equipeId);
      }
      banco.prepare("UPDATE eventos SET atualizado_em = datetime('now') WHERE id = ?").run(id);
    }

    if (mudouInicio) {
      registrarHistoricoEvento(banco, id, "inicio", atual.inicio, inicio, opcoes);
    }
    if (mudouDuracao) {
      registrarHistoricoEvento(
        banco,
        id,
        "duracao_min",
        String(atual.duracaoMin),
        String(duracaoMin),
        opcoes,
      );
    }
    if (mudouEquipes) {
      registrarHistoricoEvento(
        banco,
        id,
        "equipes",
        atual.equipes.map((equipe) => equipe.nome).join(", ") || null,
        nomesDasEquipes(banco, equipeIdsDepois) || null,
        opcoes,
      );
    }
  });
  gravar();

  const editado = buscarEventoPorId(banco, id);
  if (editado === null) {
    throw new Error("Falha ao ler o evento editado.");
  }
  return editado;
}

// ---------- cancelar e marcar como realizado ----------

export function cancelarEvento(
  banco: Database.Database,
  id: number,
  opcoes: OpcoesEvento = {},
): Evento {
  const atual = buscarEventoPorId(banco, id);
  if (atual === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  if (atual.status === "cancelado") {
    throw new ErroValidacao(["Este evento já foi cancelado."]);
  }
  if (atual.status === "realizado") {
    throw new ErroValidacao(["Evento realizado não pode ser cancelado."]);
  }
  if (textoOuNull(opcoes.motivo) === null) {
    throw new ErroValidacao(["Informe o motivo do cancelamento."]);
  }

  const gravar = banco.transaction(() => {
    banco
      .prepare("UPDATE eventos SET status = 'cancelado', atualizado_em = datetime('now') WHERE id = ?")
      .run(id);
    registrarHistoricoEvento(banco, id, "status", "agendado", "cancelado", opcoes);
  });
  gravar();

  const cancelado = buscarEventoPorId(banco, id);
  if (cancelado === null) {
    throw new Error("Falha ao ler o evento cancelado.");
  }
  return cancelado;
}

// "agora" vem de QUEM CHAMA (o programa), nunca da tela, e no formato "AAAA-MM-DD HH:MM"
export function marcarComoRealizado(
  banco: Database.Database,
  id: number,
  agora: string,
  opcoes: OpcoesEvento = {},
): Evento {
  const atual = buscarEventoPorId(banco, id);
  if (atual === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  if (atual.status === "cancelado") {
    throw new ErroValidacao(["Evento cancelado não pode ser marcado como realizado."]);
  }
  if (atual.status === "realizado") {
    throw new ErroValidacao(["Este evento já foi marcado como realizado."]);
  }
  if (!dataHoraValida(agora)) {
    throw new ErroValidacao(["Horário atual inválido."]);
  }
  if (emMinutos(agora) < emMinutos(atual.inicio)) {
    throw new ErroValidacao(["O evento ainda não começou."]);
  }

  const gravar = banco.transaction(() => {
    banco
      .prepare("UPDATE eventos SET status = 'realizado', atualizado_em = datetime('now') WHERE id = ?")
      .run(id);
    registrarHistoricoEvento(banco, id, "status", "agendado", "realizado", opcoes);
  });
  gravar();

  const realizado = buscarEventoPorId(banco, id);
  if (realizado === null) {
    throw new Error("Falha ao ler o evento realizado.");
  }
  return realizado;
}

// ---------- historico ----------

// Do mais antigo para o mais recente
export function listarHistoricoDoEvento(
  banco: Database.Database,
  eventoId: number,
): EntradaHistoricoEvento[] {
  const linhas = banco
    .prepare("SELECT * FROM historico_evento WHERE evento_id = ? ORDER BY id")
    .all(eventoId) as LinhaHistoricoEvento[];

  return linhas.map((linha) => ({
    id: linha.id,
    eventoId: linha.evento_id,
    campo: linha.campo,
    valorAnterior: linha.valor_anterior,
    valorNovo: linha.valor_novo,
    motivo: linha.motivo,
    responsavel: linha.responsavel,
    registradoEm: linha.registrado_em,
  }));
}