import type Database from "better-sqlite3";
import { ErroValidacao } from "../core/erros";
import type { FuncaoEquipe, ParticipacaoAtiva } from "../core/equipes/tipos";
import { dataHoraValida } from "../core/eventos/tempo";
import type { DadosEvento, Evento, TipoEvento } from "../core/eventos/tipos";
import type { Posicao, StatusJogador } from "../core/jogadores/tipos";
import {
  avaliarFrequencia,
  calcularPresenca,
  calcularTendencia,
  type AlertaPresenca,
  type ResumoPresenca,
  type Tendencia,
} from "../core/presenca/calculo";
import { eventosEmConflitoDaPessoa, type EventoDaPessoa } from "../core/presenca/conflitos-pessoa";
import { sugerirConvocacao } from "../core/presenca/convocacao";
import {
  ehEstadoFinal,
  type ConvocacaoEvento,
  type EstadoPresenca,
  type PapelConvocado,
} from "../core/presenca/tipos";
import { validarEstadoPresenca } from "../core/presenca/validacao";
import { buscarEventoPorId, criarEvento, type OpcoesEvento } from "./eventos-repositorio";

// ---------- formatos que chegam do banco ----------

interface LinhaConvocacao {
  id: number;
  evento_id: number;
  jogador_id: number;
  apelido: string;
  equipe_id: number | null;
  equipe_nome: string | null;
  funcao: FuncaoEquipe | null;
  papel: PapelConvocado;
  estado: EstadoPresenca;
  atualizado_em: string;
}

export interface PessoaExcluidaNomeada {
  jogadorId: number;
  apelido: string;
  motivo: string;
}

export interface ResultadoConvocacao {
  adicionados: number;
  excluidos: PessoaExcluidaNomeada[]; // quem ficou de fora e POR QUE
}

export interface RegistroDaPessoa {
  eventoId: number;
  tipo: TipoEvento;
  titulo: string | null;
  inicio: string;
  estado: EstadoPresenca;
}

export interface PresencaDaPessoa {
  resumo: ResumoPresenca;
  tendencia: Tendencia | null;
  alerta: AlertaPresenca | null;
  registros: RegistroDaPessoa[]; // em ordem cronologica
}

export interface PedidoConflitosPessoas {
  tipo: TipoEvento;
  inicio: string;
  duracaoMin: number;
  equipeIds: number[];
  ignorarEventoId?: number;
}

export interface ConflitoDePessoa {
  jogadorId: number;
  apelido: string;
  eventos: { eventoId: number; tipo: TipoEvento; titulo: string | null; inicio: string }[];
}

// ---------- ajudantes ----------

const SQL_CONVOCACOES = `
  SELECT c.id, c.evento_id, c.jogador_id, j.apelido, c.equipe_id, e.nome AS equipe_nome,
         c.funcao, c.papel, c.estado, c.atualizado_em
  FROM eventos_participantes c
  JOIN jogadores j ON j.id = c.jogador_id
  LEFT JOIN equipes e ON e.id = c.equipe_id
  WHERE c.evento_id = ?`;

const ORDEM_CONVOCACOES = `
  ORDER BY e.nome COLLATE NOCASE,
    CASE c.funcao WHEN 'titular' THEN 0 WHEN 'reserva' THEN 1 WHEN 'academia' THEN 2
                  WHEN 'capitao' THEN 3 WHEN 'coach' THEN 4 ELSE 5 END,
    j.apelido COLLATE NOCASE`;

function linhaParaConvocacao(linha: LinhaConvocacao): ConvocacaoEvento {
  return {
    id: linha.id,
    eventoId: linha.evento_id,
    jogadorId: linha.jogador_id,
    apelido: linha.apelido,
    equipeId: linha.equipe_id,
    equipeNome: linha.equipe_nome,
    funcao: linha.funcao,
    papel: linha.papel,
    estado: linha.estado,
    atualizadoEm: linha.atualizado_em,
  };
}

function marcadores(quantidade: number): string {
  return Array.from({ length: quantidade }, () => "?").join(", ");
}

// Participacoes ativas de todas as equipes informadas
function participacoesAtivasDasEquipes(
  banco: Database.Database,
  equipeIds: number[],
): ParticipacaoAtiva[] {
  if (equipeIds.length === 0) return [];

  const linhas = banco
    .prepare(
      `SELECT equipe_id, jogador_id, funcao, posicao
       FROM participacoes_equipe
       WHERE saiu_em IS NULL AND equipe_id IN (${marcadores(equipeIds.length)})`,
    )
    .all(...equipeIds) as {
    equipe_id: number;
    jogador_id: number;
    funcao: FuncaoEquipe;
    posicao: Posicao | null;
  }[];

  return linhas.map((linha) => ({
    equipeId: linha.equipe_id,
    jogadorId: linha.jogador_id,
    funcao: linha.funcao,
    posicao: linha.posicao,
  }));
}

function apelidosDe(banco: Database.Database, ids: number[]): Map<number, string> {
  const mapa = new Map<number, string>();
  if (ids.length === 0) return mapa;

  const linhas = banco
    .prepare(`SELECT id, apelido FROM jogadores WHERE id IN (${marcadores(ids.length)})`)
    .all(...ids) as { id: number; apelido: string }[];
  for (const linha of linhas) mapa.set(linha.id, linha.apelido);
  return mapa;
}

function exigirEventoNaoCancelado(banco: Database.Database, eventoId: number): Evento {
  const evento = buscarEventoPorId(banco, eventoId);
  if (evento === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  if (evento.status === "cancelado") {
    throw new ErroValidacao(["Evento cancelado não tem convocação."]);
  }
  return evento;
}

function inserirConvocacao(
  banco: Database.Database,
  eventoId: number,
  c: { jogadorId: number; equipeId: number | null; funcao: FuncaoEquipe | null; papel: PapelConvocado },
): void {
  banco
    .prepare(
      `INSERT INTO eventos_participantes (evento_id, jogador_id, equipe_id, funcao, papel)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(eventoId, c.jogadorId, c.equipeId, c.funcao, c.papel);
}

// ---------- consultar ----------

export function listarConvocados(banco: Database.Database, eventoId: number): ConvocacaoEvento[] {
  const linhas = banco
    .prepare(`${SQL_CONVOCACOES} ${ORDEM_CONVOCACOES}`)
    .all(eventoId) as LinhaConvocacao[];
  return linhas.map(linhaParaConvocacao);
}

export function buscarConvocacao(
  banco: Database.Database,
  eventoId: number,
  jogadorId: number,
): ConvocacaoEvento | null {
  const linha = banco
    .prepare(`${SQL_CONVOCACOES} AND c.jogador_id = ?`)
    .get(eventoId, jogadorId) as LinhaConvocacao | undefined;
  return linha ? linhaParaConvocacao(linha) : null;
}

// ---------- convocar ----------

// Convoca os membros ativos das equipes do evento. Pode ser repetido sem medo:
// so adiciona quem ainda nao esta convocado e nunca remove ninguem.
export function convocarAutomaticamente(
  banco: Database.Database,
  eventoId: number,
): ResultadoConvocacao {
  const evento = exigirEventoNaoCancelado(banco, eventoId);
  const equipeIds = evento.equipes.map((equipe) => equipe.id);
  const sugestao = sugerirConvocacao(
    evento.tipo,
    equipeIds,
    participacoesAtivasDasEquipes(banco, equipeIds),
  );

  const jaConvocados = new Set(listarConvocados(banco, eventoId).map((c) => c.jogadorId));
  const novos = sugestao.convocados.filter((c) => !jaConvocados.has(c.jogadorId));

  banco.transaction(() => {
    for (const convocado of novos) {
      inserirConvocacao(banco, eventoId, convocado);
    }
  })();

  const apelidos = apelidosDe(
    banco,
    sugestao.excluidos.map((e) => e.jogadorId),
  );
  return {
    adicionados: novos.length,
    excluidos: sugestao.excluidos.map((e) => ({
      jogadorId: e.jogadorId,
      apelido: apelidos.get(e.jogadorId) ?? "?",
      motivo: e.motivo,
    })),
  };
}

// Cria o evento E convoca as equipes, tudo ou nada
export function criarEventoComConvocacao(
  banco: Database.Database,
  dados: DadosEvento,
  opcoes: OpcoesEvento = {},
): Evento {
  const gravar = banco.transaction((): Evento => {
    const evento = criarEvento(banco, dados, opcoes);
    convocarAutomaticamente(banco, evento.id);
    return evento;
  });
  return gravar();
}

// Convocacao manual de uma pessoa
export function adicionarConvocado(
  banco: Database.Database,
  eventoId: number,
  jogadorId: number,
): ConvocacaoEvento {
  const evento = exigirEventoNaoCancelado(banco, eventoId);

  const pessoa = banco.prepare("SELECT status FROM jogadores WHERE id = ?").get(jogadorId) as
    | { status: StatusJogador }
    | undefined;
  if (pessoa === undefined) {
    throw new ErroValidacao(["Pessoa não encontrada."]);
  }
  if (pessoa.status === "inativo" || pessoa.status === "fora_do_projeto") {
    throw new ErroValidacao(["Pessoa inativa ou fora do projeto não pode ser convocada."]);
  }
  if (buscarConvocacao(banco, eventoId, jogadorId) !== null) {
    throw new ErroValidacao(["Esta pessoa já está convocada para este evento."]);
  }

  // Se a pessoa e das equipes do evento, vale a mesma regra da convocacao automatica
  const equipeIds = evento.equipes.map((equipe) => equipe.id);
  const dela = participacoesAtivasDasEquipes(banco, equipeIds).filter(
    (p) => p.jogadorId === jogadorId,
  );
  const sugestao = sugerirConvocacao(evento.tipo, equipeIds, dela);

  const convocado = sugestao.convocados[0];
  const excluido = sugestao.excluidos[0];

  if (convocado !== undefined) {
    inserirConvocacao(banco, eventoId, convocado);
  } else if (excluido !== undefined) {
    throw new ErroValidacao([excluido.motivo]);
  } else {
    // Nao pertence a nenhuma equipe do evento: convocacao avulsa
    inserirConvocacao(banco, eventoId, { jogadorId, equipeId: null, funcao: null, papel: "jogador" });
  }

  const criada = buscarConvocacao(banco, eventoId, jogadorId);
  if (criada === null) {
    throw new Error("Falha ao ler a convocação recém-criada.");
  }
  return criada;
}

// Tira alguem da convocacao. Quem ja teve presenca registrada nao sai (corrija o estado).
export function removerConvocado(
  banco: Database.Database,
  eventoId: number,
  jogadorId: number,
): ConvocacaoEvento {
  exigirEventoNaoCancelado(banco, eventoId);

  const atual = buscarConvocacao(banco, eventoId, jogadorId);
  if (atual === null) {
    throw new ErroValidacao(["Esta pessoa não está convocada para este evento."]);
  }
  if (ehEstadoFinal(atual.estado)) {
    throw new ErroValidacao([
      "Esta pessoa já tem presença registrada. Para corrigir, altere o estado em vez de removê-la.",
    ]);
  }

  banco
    .prepare("DELETE FROM eventos_participantes WHERE evento_id = ? AND jogador_id = ?")
    .run(eventoId, jogadorId);
  return atual;
}

// ---------- presenca ----------

// "agora" vem do programa, nunca da tela
export function definirEstado(
  banco: Database.Database,
  eventoId: number,
  jogadorId: number,
  estado: EstadoPresenca,
  agora: string,
): ConvocacaoEvento {
  const evento = buscarEventoPorId(banco, eventoId);
  if (evento === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  if (!dataHoraValida(agora)) {
    throw new ErroValidacao(["Horário atual inválido."]);
  }

  const erros = validarEstadoPresenca(estado, evento, agora);
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  if (buscarConvocacao(banco, eventoId, jogadorId) === null) {
    throw new ErroValidacao(["Esta pessoa não está convocada para este evento."]);
  }

  banco
    .prepare(
      `UPDATE eventos_participantes
       SET estado = ?, atualizado_em = datetime('now')
       WHERE evento_id = ? AND jogador_id = ?`,
    )
    .run(estado, eventoId, jogadorId);

  const atualizada = buscarConvocacao(banco, eventoId, jogadorId);
  if (atualizada === null) {
    throw new Error("Falha ao ler a convocação atualizada.");
  }
  return atualizada;
}

// Presenca de uma pessoa, CALCULADA a partir dos registros (nada disso e gravado).
// Eventos cancelados nao contam.
export function resumirPresencaDaPessoa(
  banco: Database.Database,
  jogadorId: number,
): PresencaDaPessoa {
  const linhas = banco
    .prepare(
      `SELECT ev.id AS evento_id, ev.tipo, ev.titulo, ev.inicio, c.estado
       FROM eventos_participantes c
       JOIN eventos ev ON ev.id = c.evento_id
       WHERE c.jogador_id = ? AND ev.status <> 'cancelado'
       ORDER BY ev.inicio, ev.id`,
    )
    .all(jogadorId) as {
    evento_id: number;
    tipo: TipoEvento;
    titulo: string | null;
    inicio: string;
    estado: EstadoPresenca;
  }[];

  const registros: RegistroDaPessoa[] = linhas.map((linha) => ({
    eventoId: linha.evento_id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    inicio: linha.inicio,
    estado: linha.estado,
  }));

  const resumo = calcularPresenca(registros);
  return {
    resumo,
    tendencia: calcularTendencia(registros),
    alerta: avaliarFrequencia(resumo),
    registros,
  };
}

// ---------- conflito por pessoa (so avisa, nao bloqueia) ----------

// Quem seria convocado neste evento e ja esta convocado para outro no mesmo horario?
export function listarConflitosDePessoas(
  banco: Database.Database,
  pedido: PedidoConflitosPessoas,
): ConflitoDePessoa[] {
  if (
    !dataHoraValida(pedido.inicio) ||
    !Number.isInteger(pedido.duracaoMin) ||
    pedido.duracaoMin < 1 ||
    pedido.equipeIds.length === 0
  ) {
    return [];
  }

  const sugestao = sugerirConvocacao(
    pedido.tipo,
    pedido.equipeIds,
    participacoesAtivasDasEquipes(banco, pedido.equipeIds),
  );
  const apelidos = apelidosDe(
    banco,
    sugestao.convocados.map((c) => c.jogadorId),
  );

  const consulta = banco.prepare(
    `SELECT ev.id AS evento_id, ev.tipo, ev.titulo, ev.inicio, ev.duracao_min, ev.status
     FROM eventos_participantes c
     JOIN eventos ev ON ev.id = c.evento_id
     WHERE c.jogador_id = ? AND ev.status <> 'cancelado'`,
  );

  const conflitos: ConflitoDePessoa[] = [];
  for (const convocado of sugestao.convocados) {
    const outros = consulta.all(convocado.jogadorId) as {
      evento_id: number;
      tipo: TipoEvento;
      titulo: string | null;
      inicio: string;
      duracao_min: number;
      status: EventoDaPessoa["status"];
    }[];

    const ids = new Set(
      eventosEmConflitoDaPessoa(
        { inicio: pedido.inicio, duracaoMin: pedido.duracaoMin },
        outros.map((o) => ({
          eventoId: o.evento_id,
          inicio: o.inicio,
          duracaoMin: o.duracao_min,
          status: o.status,
        })),
        pedido.ignorarEventoId,
      ),
    );

    if (ids.size > 0) {
      conflitos.push({
        jogadorId: convocado.jogadorId,
        apelido: apelidos.get(convocado.jogadorId) ?? "?",
        eventos: outros
          .filter((o) => ids.has(o.evento_id))
          .map((o) => ({
            eventoId: o.evento_id,
            tipo: o.tipo,
            titulo: o.titulo,
            inicio: o.inicio,
          })),
      });
    }
  }
  return conflitos;
}