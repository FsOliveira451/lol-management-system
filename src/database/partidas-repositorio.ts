import type Database from "better-sqlite3";
import { ErroValidacao } from "../core/erros";
import { situacaoDoEvento } from "../core/eventos/tempo";
import { temAdversario, type Evento, type TipoEvento } from "../core/eventos/tipos";
import {
  avaliarPendenciasDeResultado,
  calcularEstatisticasDaEquipe,
  type AlertaPartida,
  type EstatisticasDaEquipe,
  type PartidaParaEstatistica,
} from "../core/partidas/estatisticas";
import type { DadosPartida, OrigemPartida, Partida } from "../core/partidas/tipos";
import {
  avisosDePartidas,
  validarPartida,
  type ContextoPartida,
} from "../core/partidas/validacao";
import { buscarEquipePorId } from "./equipes-repositorio";
import { buscarEventoPorId, listarEventos, marcarComoRealizado } from "./eventos-repositorio";

// ---------- formatos ----------

interface LinhaPartida {
  id: number;
  evento_id: number;
  numero: number;
  vencedor_equipe_id: number | null;
  duracao_min: number | null;
  observacoes: string | null;
  origem: OrigemPartida;
  riot_match_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type CampoHistoricoPartida = "numero" | "vencedor" | "duracao_min" | "situacao";

export interface EntradaHistoricoPartida {
  id: number;
  eventoId: number;
  partidaId: number;
  campo: CampoHistoricoPartida;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registradoEm: string;
}

interface LinhaHistoricoPartida {
  id: number;
  evento_id: number;
  partida_id: number;
  campo: CampoHistoricoPartida;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registrado_em: string;
}

export interface OpcoesPartida {
  motivo?: string;
  responsavel?: string;
}

export interface PartidasDoEvento {
  partidas: Partida[]; // em ordem de numero
  partidasPrevistas: number | null;
  avisos: string[]; // nao bloqueiam: a tela mostra
}

export interface PendenciaDeResultado extends AlertaPartida {
  eventoId: number;
  tipo: TipoEvento;
  titulo: string | null;
  inicio: string;
  equipes: string[];
}

// ---------- ajudantes ----------

function textoOuNull(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function linhaParaPartida(linha: LinhaPartida): Partida {
  return {
    id: linha.id,
    eventoId: linha.evento_id,
    numero: linha.numero,
    vencedorEquipeId: linha.vencedor_equipe_id,
    duracaoMin: linha.duracao_min,
    observacoes: linha.observacoes,
    origem: linha.origem,
    riotMatchId: linha.riot_match_id,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
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

// Limpa os dados recebidos (espacos, vazio = null)
function normalizar(dados: DadosPartida): DadosPartida {
  const limpos: DadosPartida = { ...dados };
  if (dados.observacoes !== undefined) limpos.observacoes = textoOuNull(dados.observacoes);
  return limpos;
}

// Tira os campos "nao enviados" (undefined), para nao apagarem o que ja estava gravado.
// Repare: null e um valor valido (ex.: "o adversario venceu") e permanece.
function semUndefined(dados: DadosPartida): DadosPartida {
  return Object.fromEntries(
    Object.entries(dados).filter(([, valor]) => valor !== undefined),
  ) as DadosPartida;
}

function exigirEvento(banco: Database.Database, eventoId: number): Evento {
  const evento = buscarEventoPorId(banco, eventoId);
  if (evento === null) {
    throw new ErroValidacao(["Evento não encontrado."]);
  }
  return evento;
}

function numerosDoEvento(banco: Database.Database, eventoId: number): number[] {
  const linhas = banco
    .prepare("SELECT numero FROM partidas WHERE evento_id = ? ORDER BY numero")
    .all(eventoId) as { numero: number }[];
  return linhas.map((linha) => linha.numero);
}

function montarContexto(evento: Evento, numerosExistentes: number[]): ContextoPartida {
  return {
    tipo: evento.tipo,
    status: evento.status,
    inicio: evento.inicio,
    equipeIds: evento.equipes.map((equipe) => equipe.id),
    numerosExistentes,
  };
}

// Nome legivel do vencedor, para o historico
function nomeDoVencedor(evento: Evento, vencedorEquipeId: number | null): string {
  if (vencedorEquipeId === null) {
    return evento.adversario?.trim() || "Adversário";
  }
  return (
    evento.equipes.find((equipe) => equipe.id === vencedorEquipeId)?.nome ??
    `Equipe ${vencedorEquipeId}`
  );
}

function registrarHistorico(
  banco: Database.Database,
  eventoId: number,
  partidaId: number,
  campo: CampoHistoricoPartida,
  valorAnterior: string | null,
  valorNovo: string | null,
  opcoes: OpcoesPartida,
): void {
  banco
    .prepare(
      `INSERT INTO historico_partida
         (evento_id, partida_id, campo, valor_anterior, valor_novo, motivo, responsavel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      eventoId,
      partidaId,
      campo,
      valorAnterior,
      valorNovo,
      textoOuNull(opcoes.motivo),
      opcoes.responsavel ?? null,
    );
}

// ---------- consultar ----------

export function buscarPartidaPorId(banco: Database.Database, id: number): Partida | null {
  const linha = banco.prepare("SELECT * FROM partidas WHERE id = ?").get(id) as
    | LinhaPartida
    | undefined;
  return linha ? linhaParaPartida(linha) : null;
}

export function listarPartidas(banco: Database.Database, eventoId: number): Partida[] {
  const linhas = banco
    .prepare("SELECT * FROM partidas WHERE evento_id = ? ORDER BY numero")
    .all(eventoId) as LinhaPartida[];
  return linhas.map(linhaParaPartida);
}

// As partidas de um evento + avisos (mais que o previsto, lacunas na sequencia)
export function obterPartidasDoEvento(
  banco: Database.Database,
  eventoId: number,
): PartidasDoEvento {
  const evento = exigirEvento(banco, eventoId);
  const partidas = listarPartidas(banco, eventoId);
  return {
    partidas,
    partidasPrevistas: evento.partidasPrevistas,
    avisos: avisosDePartidas(
      evento.partidasPrevistas,
      partidas.map((partida) => partida.numero),
    ),
  };
}

// ---------- registrar ----------

// "agora" vem do programa, nunca da tela.
// Se o evento ainda esta "agendado", a 1a partida o marca como realizado (tudo ou nada).
export function registrarPartida(
  banco: Database.Database,
  eventoId: number,
  dados: DadosPartida,
  agora: string,
  opcoes: OpcoesPartida = {},
): Partida {
  const gravar = banco.transaction((): Partida => {
    const evento = exigirEvento(banco, eventoId);
    const limpos = normalizar(dados);

    const erros = validarPartida(
      limpos,
      montarContexto(evento, numerosDoEvento(banco, eventoId)),
      agora,
    );
    if (erros.length > 0) {
      throw new ErroValidacao(erros);
    }

    const numero = limpos.numero as number;
    const vencedor = limpos.vencedorEquipeId ?? null;

    let resultado: Database.RunResult;
    try {
      resultado = banco
        .prepare(
          `INSERT INTO partidas (evento_id, numero, vencedor_equipe_id, duracao_min, observacoes)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(eventoId, numero, vencedor, limpos.duracaoMin ?? null, limpos.observacoes ?? null);
    } catch (erro) {
      // O "cinto de seguranca" do banco disparou (a regra acima ja deveria ter pego)
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ErroValidacao([
          `Já existe a partida ${numero} neste evento. Atualize a tela e tente de novo.`,
        ]);
      }
      throw erro;
    }
    const partidaId = Number(resultado.lastInsertRowid);

    registrarHistorico(
      banco,
      eventoId,
      partidaId,
      "situacao",
      null,
      `Partida ${numero} registrada (vencedor: ${nomeDoVencedor(evento, vencedor)})`,
      opcoes,
    );

    // Registrar resultado significa que o evento aconteceu
    if (evento.status === "agendado") {
      marcarComoRealizado(banco, eventoId, agora, {
        motivo: "Primeira partida registrada",
        ...(opcoes.responsavel !== undefined ? { responsavel: opcoes.responsavel } : {}),
      });
    }

    const criada = buscarPartidaPorId(banco, partidaId);
    if (criada === null) {
      throw new Error("Falha ao ler a partida recém-registrada.");
    }
    return criada;
  });

  return gravar();
}

// ---------- corrigir ----------

export function corrigirPartida(
  banco: Database.Database,
  partidaId: number,
  dados: DadosPartida,
  agora: string,
  opcoes: OpcoesPartida = {},
): Partida {
  const gravar = banco.transaction((): Partida => {
    const atual = buscarPartidaPorId(banco, partidaId);
    if (atual === null) {
      throw new ErroValidacao(["Partida não encontrada."]);
    }
    const evento = exigirEvento(banco, atual.eventoId);

    // Valida o CONJUNTO: o que ja estava gravado + o que esta sendo alterado
    const combinado: DadosPartida = {
      numero: atual.numero,
      vencedorEquipeId: atual.vencedorEquipeId,
      duracaoMin: atual.duracaoMin,
      observacoes: atual.observacoes,
      ...semUndefined(normalizar(dados)),
    };
    const outros = numerosDoEvento(banco, atual.eventoId).filter((n) => n !== atual.numero);

    const erros = validarPartida(combinado, montarContexto(evento, outros), agora);
    if (erros.length > 0) {
      throw new ErroValidacao(erros);
    }

    const numero = combinado.numero as number;
    const vencedor = combinado.vencedorEquipeId ?? null;
    const duracao = combinado.duracaoMin ?? null;
    const observacoes = combinado.observacoes ?? null;

    const mudouNumero = numero !== atual.numero;
    const mudouVencedor = vencedor !== atual.vencedorEquipeId;
    const mudouDuracao = duracao !== atual.duracaoMin;
    const mudouObservacoes = observacoes !== atual.observacoes;

    if (!mudouNumero && !mudouVencedor && !mudouDuracao && !mudouObservacoes) {
      return atual; // nada mudou: nao grava nada
    }

    // Mudar o que importa para as estatisticas exige motivo (observacoes nao)
    if ((mudouNumero || mudouVencedor || mudouDuracao) && textoOuNull(opcoes.motivo) === null) {
      throw new ErroValidacao(["Informe o motivo da correção."]);
    }

    const alteracoes: string[] = [];
    const valores: (string | number | null)[] = [];
    if (mudouNumero) {
      alteracoes.push("numero = ?");
      valores.push(numero);
    }
    if (mudouVencedor) {
      alteracoes.push("vencedor_equipe_id = ?");
      valores.push(vencedor);
    }
    if (mudouDuracao) {
      alteracoes.push("duracao_min = ?");
      valores.push(duracao);
    }
    if (mudouObservacoes) {
      alteracoes.push("observacoes = ?");
      valores.push(observacoes);
    }

    banco
      .prepare(
        `UPDATE partidas SET ${alteracoes.join(", ")}, atualizado_em = datetime('now') WHERE id = ?`,
      )
      .run(...valores, partidaId);

    if (mudouNumero) {
      registrarHistorico(banco, atual.eventoId, partidaId, "numero", String(atual.numero), String(numero), opcoes);
    }
    if (mudouVencedor) {
      registrarHistorico(
        banco,
        atual.eventoId,
        partidaId,
        "vencedor",
        nomeDoVencedor(evento, atual.vencedorEquipeId),
        nomeDoVencedor(evento, vencedor),
        opcoes,
      );
    }
    if (mudouDuracao) {
      registrarHistorico(
        banco,
        atual.eventoId,
        partidaId,
        "duracao_min",
        atual.duracaoMin === null ? null : String(atual.duracaoMin),
        duracao === null ? null : String(duracao),
        opcoes,
      );
    }

    const corrigida = buscarPartidaPorId(banco, partidaId);
    if (corrigida === null) {
      throw new Error("Falha ao ler a partida corrigida.");
    }
    return corrigida;
  });

  return gravar();
}

// ---------- apagar ----------

export function apagarPartida(
  banco: Database.Database,
  partidaId: number,
  opcoes: OpcoesPartida = {},
): Partida {
  const gravar = banco.transaction((): Partida => {
    const atual = buscarPartidaPorId(banco, partidaId);
    if (atual === null) {
      throw new ErroValidacao(["Partida não encontrada."]);
    }
    if (textoOuNull(opcoes.motivo) === null) {
      throw new ErroValidacao(["Informe o motivo da exclusão da partida."]);
    }
    const evento = exigirEvento(banco, atual.eventoId);

    banco.prepare("DELETE FROM partidas WHERE id = ?").run(partidaId);
    registrarHistorico(
      banco,
      atual.eventoId,
      partidaId,
      "situacao",
      `Partida ${atual.numero} (vencedor: ${nomeDoVencedor(evento, atual.vencedorEquipeId)})`,
      "apagada",
      opcoes,
    );
    return atual;
  });

  return gravar();
}

// Do mais antigo para o mais recente. Sobrevive as partidas apagadas.
export function listarHistoricoDasPartidas(
  banco: Database.Database,
  eventoId: number,
): EntradaHistoricoPartida[] {
  const linhas = banco
    .prepare("SELECT * FROM historico_partida WHERE evento_id = ? ORDER BY id")
    .all(eventoId) as LinhaHistoricoPartida[];

  return linhas.map((linha) => ({
    id: linha.id,
    eventoId: linha.evento_id,
    partidaId: linha.partida_id,
    campo: linha.campo,
    valorAnterior: linha.valor_anterior,
    valorNovo: linha.valor_novo,
    motivo: linha.motivo,
    responsavel: linha.responsavel,
    registradoEm: linha.registrado_em,
  }));
}

// ---------- estatisticas (CALCULADAS, nunca gravadas) ----------

export function estatisticasDaEquipe(
  banco: Database.Database,
  equipeId: number,
): EstatisticasDaEquipe {
  if (buscarEquipePorId(banco, equipeId) === null) {
    throw new ErroValidacao(["Equipe não encontrada."]);
  }

  // Partidas dos eventos (nao cancelados) em que a equipe participa
  const linhas = banco
    .prepare(
      `SELECT p.evento_id, ev.tipo, ev.inicio, p.numero, p.vencedor_equipe_id
       FROM partidas p
       JOIN eventos ev ON ev.id = p.evento_id
       WHERE ev.status <> 'cancelado'
         AND p.evento_id IN (SELECT evento_id FROM eventos_equipes WHERE equipe_id = ?)`,
    )
    .all(equipeId) as {
    evento_id: number;
    tipo: TipoEvento;
    inicio: string;
    numero: number;
    vencedor_equipe_id: number | null;
  }[];

  // As equipes de cada um desses eventos (para separar interno de externo)
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

  const partidas: PartidaParaEstatistica[] = linhas.map((linha) => ({
    eventoId: linha.evento_id,
    tipo: linha.tipo,
    inicio: linha.inicio,
    numero: linha.numero,
    equipeIds: equipesPorEvento.get(linha.evento_id) ?? [],
    vencedorEquipeId: linha.vencedor_equipe_id,
  }));

  return calcularEstatisticasDaEquipe(partidas, equipeId);
}

// ---------- pendencias de resultado ----------

// "agora" vem do programa. Eventos cancelados nao entram.
export function listarPendenciasDeResultado(
  banco: Database.Database,
  agora: string,
): PendenciaDeResultado[] {
  const contagens = banco
    .prepare("SELECT evento_id, COUNT(*) AS total FROM partidas GROUP BY evento_id")
    .all() as { evento_id: number; total: number }[];
  const totalPorEvento = new Map(contagens.map((c) => [c.evento_id, c.total]));

  const pendencias: PendenciaDeResultado[] = [];
  for (const evento of listarEventos(banco)) {
    if (!temAdversario(evento.tipo)) continue;

    const alerta = avaliarPendenciasDeResultado([
      {
        eventoId: evento.id,
        tipo: evento.tipo,
        situacao: situacaoDoEvento(evento, agora),
        partidasRegistradas: totalPorEvento.get(evento.id) ?? 0,
      },
    ])[0];
    if (alerta === undefined) continue;

    pendencias.push({
      ...alerta,
      eventoId: evento.id,
      tipo: evento.tipo,
      titulo: evento.titulo,
      inicio: evento.inicio,
      equipes: evento.equipes.map((equipe) => equipe.nome),
    });
  }

  // Atencao antes de observacao; dentro de cada grupo, do mais antigo ao mais recente
  const peso = (alerta: PendenciaDeResultado) => (alerta.nivel === "atencao" ? 0 : 1);
  return pendencias.sort((a, b) => peso(a) - peso(b) || a.inicio.localeCompare(b.inicio));
}