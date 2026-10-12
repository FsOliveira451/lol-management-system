import type Database from "better-sqlite3";
import { ErroValidacao } from "../core/erros";
import {
  POSICOES,
  type Elo,
  type Jogador,
  type Posicao,
  type StatusJogador,
} from "../core/jogadores/tipos";
import type {
  ContextoParticipacao,
  DadosEquipe,
  Equipe,
  FuncaoEquipe,
  Membro,
  NivelEquipe,
  NovaParticipacao,
  Participacao,
  ParticipacaoAtiva,
  StatusEquipe,
} from "../core/equipes/tipos";
import { validarDadosEquipe, validarNovaParticipacao } from "../core/equipes/validacao";
import { editarJogador } from "./jogadores-repositorio";

// ---------- formatos que chegam do banco ----------

interface LinhaEquipe {
  id: number;
  nome: string;
  tag: string | null;
  nivel: NivelEquipe;
  status: StatusEquipe;
  objetivo: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface LinhaParticipacao {
  id: number;
  equipe_id: number;
  jogador_id: number;
  funcao: FuncaoEquipe;
  posicao: Posicao | null;
  entrou_em: string;
  saiu_em: string | null;
  motivo_entrada: string | null;
  motivo_saida: string | null;
  responsavel: string | null;
}

interface LinhaMembro extends LinhaParticipacao {
  apelido: string;
  elo_atual: Elo;
}

export interface FiltrosEquipes {
  busca?: string;
  nivel?: NivelEquipe;
  incluirInativas?: boolean;
}

// Informacoes extras de uma alteracao: por que e quem fez
export interface OpcoesParticipacao {
  motivo?: string;
  responsavel?: string;
}

// ---------- ajudantes ----------

function linhaParaEquipe(linha: LinhaEquipe): Equipe {
  return {
    id: linha.id,
    nome: linha.nome,
    tag: linha.tag,
    nivel: linha.nivel,
    status: linha.status,
    objetivo: linha.objetivo,
    observacoes: linha.observacoes,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function linhaParaParticipacao(linha: LinhaParticipacao): Participacao {
  return {
    id: linha.id,
    equipeId: linha.equipe_id,
    jogadorId: linha.jogador_id,
    funcao: linha.funcao,
    posicao: linha.posicao,
    entrouEm: linha.entrou_em,
    saiuEm: linha.saiu_em,
    motivoEntrada: linha.motivo_entrada,
    motivoSaida: linha.motivo_saida,
    responsavel: linha.responsavel,
  };
}

// Texto vazio ou so espacos vira "nao informado" (null)
function textoOuNull(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function normalizarTag(valor: string | null | undefined): string | null {
  const limpo = textoOuNull(valor);
  return limpo === null ? null : limpo.toUpperCase();
}

// Limpa os dados recebidos (espacos, maiusculas, vazio = null)
function normalizarDadosEquipe(dados: DadosEquipe): DadosEquipe {
  const limpos: DadosEquipe = {};
  if (dados.nome !== undefined) limpos.nome = dados.nome.trim();
  if (dados.tag !== undefined) limpos.tag = normalizarTag(dados.tag);
  if (dados.nivel !== undefined) limpos.nivel = dados.nivel;
  if (dados.status !== undefined) limpos.status = dados.status;
  if (dados.objetivo !== undefined) limpos.objetivo = textoOuNull(dados.objetivo);
  if (dados.observacoes !== undefined) limpos.observacoes = textoOuNull(dados.observacoes);
  return limpos;
}

function nomeEmUso(banco: Database.Database, nome: string, ignorarId = 0): boolean {
  const linha = banco
    .prepare("SELECT id FROM equipes WHERE nome = ? COLLATE NOCASE AND id <> ?")
    .get(nome, ignorarId);
  return linha !== undefined;
}

function tagEmUso(banco: Database.Database, tag: string, ignorarId = 0): boolean {
  const linha = banco
    .prepare("SELECT id FROM equipes WHERE tag = ? COLLATE NOCASE AND id <> ?")
    .get(tag, ignorarId);
  return linha !== undefined;
}

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { code?: unknown }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

// ---------- equipes ----------

export function buscarEquipePorId(banco: Database.Database, id: number): Equipe | null {
  const linha = banco.prepare("SELECT * FROM equipes WHERE id = ?").get(id) as
    | LinhaEquipe
    | undefined;
  return linha ? linhaParaEquipe(linha) : null;
}

export function criarEquipe(banco: Database.Database, dados: DadosEquipe): Equipe {
  const erros = validarDadosEquipe(dados, "criar");
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  const limpos = normalizarDadosEquipe(dados);
  const nome = limpos.nome ?? "";
  const tag = limpos.tag ?? null;

  if (nomeEmUso(banco, nome)) {
    throw new ErroValidacao(["Já existe uma equipe com este nome."]);
  }
  if (tag !== null && tagEmUso(banco, tag)) {
    throw new ErroValidacao(["Já existe uma equipe com esta tag."]);
  }

  const resultado = banco
    .prepare(
      `INSERT INTO equipes (nome, tag, nivel, status, objetivo, observacoes)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      nome,
      tag,
      limpos.nivel ?? "principal",
      limpos.status ?? "em_formacao",
      limpos.objetivo ?? null,
      limpos.observacoes ?? null,
    );

  const criada = buscarEquipePorId(banco, Number(resultado.lastInsertRowid));
  if (criada === null) {
    throw new Error("Falha ao ler a equipe recém-criada.");
  }
  return criada;
}

export function listarEquipes(
  banco: Database.Database,
  filtros: FiltrosEquipes = {},
): Equipe[] {
  const condicoes: string[] = [];
  const valores: string[] = [];

  if (!filtros.incluirInativas) {
    condicoes.push("status <> 'inativa'");
  }
  if (filtros.nivel) {
    condicoes.push("nivel = ?");
    valores.push(filtros.nivel);
  }
  const busca = filtros.busca?.trim();
  if (busca) {
    condicoes.push("(nome LIKE ? OR tag LIKE ?)");
    valores.push(`%${busca}%`, `%${busca}%`);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  const linhas = banco
    .prepare(`SELECT * FROM equipes ${where} ORDER BY nome COLLATE NOCASE`)
    .all(...valores) as LinhaEquipe[];

  return linhas.map(linhaParaEquipe);
}

// Mapa: campo do sistema -> coluna do banco
const COLUNAS_EQUIPE: Record<keyof DadosEquipe, string> = {
  nome: "nome",
  tag: "tag",
  nivel: "nivel",
  status: "status",
  objetivo: "objetivo",
  observacoes: "observacoes",
};

export function editarEquipe(
  banco: Database.Database,
  id: number,
  dados: DadosEquipe,
): Equipe {
  const atual = buscarEquipePorId(banco, id);
  if (atual === null) {
    throw new ErroValidacao(["Equipe não encontrada."]);
  }

  const erros = validarDadosEquipe(dados, "editar");
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  const limpos = normalizarDadosEquipe(dados);

  if (limpos.nome !== undefined && nomeEmUso(banco, limpos.nome, id)) {
    throw new ErroValidacao(["Já existe uma equipe com este nome."]);
  }
  if (limpos.tag !== undefined && limpos.tag !== null && tagEmUso(banco, limpos.tag, id)) {
    throw new ErroValidacao(["Já existe uma equipe com esta tag."]);
  }

  // Equipe com membros ativos nao pode ser inativada "por fora":
  // o caminho certo e "Inativar equipe", que encerra as participacoes
  if (limpos.status === "inativa" && atual.status !== "inativa") {
    const total = contarParticipacoesAtivasDaEquipe(banco, id);
    if (total > 0) {
      throw new ErroValidacao([
        `Esta equipe tem ${total} participação(ões) ativa(s). Use "Inativar equipe" para encerrá-las, informando o motivo.`,
      ]);
    }
  }


  const alteracoes: string[] = [];
  const valores: (string | null)[] = [];

  for (const chave of Object.keys(COLUNAS_EQUIPE) as (keyof DadosEquipe)[]) {
    const valor = limpos[chave];
    if (valor === undefined) continue; // campo nao enviado
    if (valor === atual[chave]) continue; // nada mudou: nao grava

    alteracoes.push(`${COLUNAS_EQUIPE[chave]} = ?`);
    valores.push(valor);
  }

  if (alteracoes.length === 0) {
    return atual;
  }

  banco
    .prepare(
      `UPDATE equipes
       SET ${alteracoes.join(", ")}, atualizado_em = datetime('now')
       WHERE id = ?`,
    )
    .run(...valores, id);

  const editada = buscarEquipePorId(banco, id);
  if (editada === null) {
    throw new Error("Falha ao ler a equipe editada.");
  }
  return editada;
}

// ---------- participacoes (quem esta em qual equipe) ----------

export function buscarParticipacaoPorId(
  banco: Database.Database,
  id: number,
): Participacao | null {
  const linha = banco.prepare("SELECT * FROM participacoes_equipe WHERE id = ?").get(id) as
    | LinhaParticipacao
    | undefined;
  return linha ? linhaParaParticipacao(linha) : null;
}

// "coluna" so aceita estes dois textos fixos (nunca texto vindo do usuario),
// por isso e seguro colocar no SQL.
function participacoesAtivasPor(
  banco: Database.Database,
  coluna: "jogador_id" | "equipe_id",
  valor: number,
): ParticipacaoAtiva[] {
  const linhas = banco
    .prepare(
      `SELECT equipe_id, jogador_id, funcao, posicao
       FROM participacoes_equipe
       WHERE ${coluna} = ? AND saiu_em IS NULL`,
    )
    .all(valor) as {
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

// Reune tudo que as regras precisam saber (o "contexto")
function montarContexto(
  banco: Database.Database,
  nova: NovaParticipacao,
): ContextoParticipacao {
  const jogador = banco
    .prepare("SELECT status FROM jogadores WHERE id = ?")
    .get(nova.jogadorId) as { status: StatusJogador } | undefined;
  const equipe = banco
    .prepare("SELECT status FROM equipes WHERE id = ?")
    .get(nova.equipeId) as { status: StatusEquipe } | undefined;

  if (jogador === undefined) {
    throw new ErroValidacao(["Jogador não encontrado."]);
  }
  if (equipe === undefined) {
    throw new ErroValidacao(["Equipe não encontrada."]);
  }

  return {
    statusJogador: jogador.status,
    statusEquipe: equipe.status,
    ativasDoJogador: participacoesAtivasPor(banco, "jogador_id", nova.jogadorId),
    ativasDaEquipe: participacoesAtivasPor(banco, "equipe_id", nova.equipeId),
  };
}

export function adicionarMembro(
  banco: Database.Database,
  nova: NovaParticipacao,
  opcoes: OpcoesParticipacao = {},
): Participacao {
  // Transacao: conferir as regras e gravar acontecem juntos
  const gravar = banco.transaction((): Participacao => {
    const contexto = montarContexto(banco, nova);
    const erros = validarNovaParticipacao(nova, contexto);
    if (erros.length > 0) {
      throw new ErroValidacao(erros);
    }

    let resultado: Database.RunResult;
    try {
      resultado = banco
        .prepare(
          `INSERT INTO participacoes_equipe
             (equipe_id, jogador_id, funcao, posicao, motivo_entrada, responsavel)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          nova.equipeId,
          nova.jogadorId,
          nova.funcao,
          nova.posicao ?? null,
          textoOuNull(opcoes.motivo),
          opcoes.responsavel ?? null,
        );
    } catch (erro) {
      // O "cinto de seguranca" do banco disparou (as regras acima ja deveriam ter pego)
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ErroValidacao([
          "Esta participação conflita com outra já existente. Atualize a tela e tente de novo.",
        ]);
      }
      throw erro;
    }

    const criada = buscarParticipacaoPorId(banco, Number(resultado.lastInsertRowid));
    if (criada === null) {
      throw new Error("Falha ao ler a participação recém-criada.");
    }
    return criada;
  });

  return gravar();
}

// "Sair" da equipe: a linha NAO e apagada, ganha uma data de saida e um motivo
export function encerrarParticipacao(
  banco: Database.Database,
  participacaoId: number,
  opcoes: OpcoesParticipacao = {},
): Participacao {
  const atual = buscarParticipacaoPorId(banco, participacaoId);
  if (atual === null) {
    throw new ErroValidacao(["Participação não encontrada."]);
  }
  if (atual.saiuEm !== null) {
    throw new ErroValidacao(["Esta participação já foi encerrada."]);
  }

  const motivo = textoOuNull(opcoes.motivo);
  if (motivo === null) {
    throw new ErroValidacao(["Informe o motivo da saída."]);
  }

  banco
    .prepare(
      `UPDATE participacoes_equipe
       SET saiu_em = datetime('now'), motivo_saida = ?
       WHERE id = ?`,
    )
    .run(motivo, participacaoId);

  const encerrada = buscarParticipacaoPorId(banco, participacaoId);
  if (encerrada === null) {
    throw new Error("Falha ao ler a participação encerrada.");
  }
  return encerrada;
}

// Trocar a funcao = encerrar a participacao antiga + abrir uma nova.
// Tudo ou nada: se a nova for recusada, a antiga continua valendo.
export function trocarFuncao(
  banco: Database.Database,
  participacaoId: number,
  funcao: FuncaoEquipe,
  posicao: Posicao | null,
  opcoes: OpcoesParticipacao = {},
): Participacao {
  const atual = buscarParticipacaoPorId(banco, participacaoId);
  if (atual === null) {
    throw new ErroValidacao(["Participação não encontrada."]);
  }
  if (atual.saiuEm !== null) {
    throw new ErroValidacao(["Esta participação já foi encerrada."]);
  }
  if (textoOuNull(opcoes.motivo) === null) {
    throw new ErroValidacao(["Informe o motivo da mudança de função."]);
  }

  const trocar = banco.transaction((): Participacao => {
    encerrarParticipacao(banco, participacaoId, opcoes);
    return adicionarMembro(
      banco,
      { equipeId: atual.equipeId, jogadorId: atual.jogadorId, funcao, posicao },
      opcoes,
    );
  });

  return trocar();
}

// O "time de hoje": quem esta na equipe agora (ou todo o historico, se pedido)
export function listarMembros(
  banco: Database.Database,
  equipeId: number,
  opcoes: { incluirHistorico?: boolean } = {},
): Membro[] {
  const filtro = opcoes.incluirHistorico ? "" : "AND p.saiu_em IS NULL";

  const linhas = banco
    .prepare(
      `SELECT p.*, j.apelido AS apelido, j.elo_atual AS elo_atual
       FROM participacoes_equipe p
       JOIN jogadores j ON j.id = p.jogador_id
       WHERE p.equipe_id = ? ${filtro}
       ORDER BY
         (p.saiu_em IS NOT NULL),
         CASE p.funcao WHEN 'capitao' THEN 1 WHEN 'coach' THEN 2
                       WHEN 'titular' THEN 3 WHEN 'reserva' THEN 4 ELSE 5 END,
         CASE p.posicao WHEN 'Top' THEN 1 WHEN 'Jungle' THEN 2 WHEN 'Mid' THEN 3
                        WHEN 'ADC' THEN 4 WHEN 'Support' THEN 5 ELSE 6 END,
         j.apelido COLLATE NOCASE`,
    )
    .all(equipeId) as LinhaMembro[];

  return linhas.map((linha) => ({
    ...linhaParaParticipacao(linha),
    apelido: linha.apelido,
    eloAtual: linha.elo_atual,
  }));
}


// ---------- escalar um titular (cobre todos os cenarios) ----------

export interface PedidoEscalacao {
  equipeId: number;
  posicao: Posicao;
  jogadorId: number;
  anteriorVaiParaReserva: boolean; // posicao ocupada: o titular atual vira reserva?
  liberarEmOutraEquipe: boolean; // pessoa titular em outra equipe: liberar la?
  outraEquipeVaiParaReserva: boolean; // ...e la ela passa a reserva (senao, apenas sai)?
}

// Coloca uma pessoa como titular de uma posicao, resolvendo os conflitos que o
// administrador autorizar. TUDO OU NADA: se qualquer passo for recusado, nada muda.
export function escalarTitular(
  banco: Database.Database,
  pedido: PedidoEscalacao,
  opcoes: OpcoesParticipacao = {},
): Participacao {
  if (!(POSICOES as readonly string[]).includes(pedido.posicao)) {
    throw new ErroValidacao(["Posição inválida."]);
  }

  const executarEscalacao = banco.transaction((): Participacao => {
    // Quem e o titular atual desta posicao (se houver)?
    const ocupante = banco
      .prepare(
        `SELECT * FROM participacoes_equipe
         WHERE equipe_id = ? AND funcao = 'titular' AND posicao = ? AND saiu_em IS NULL`,
      )
      .get(pedido.equipeId, pedido.posicao) as LinhaParticipacao | undefined;

    if (ocupante !== undefined && ocupante.jogador_id === pedido.jogadorId) {
      throw new ErroValidacao(["Esta pessoa já é a titular desta posição."]);
    }

    // A pessoa ja e titular em OUTRA equipe?
    const emOutraEquipe = banco
      .prepare(
        `SELECT p.*, e.nome AS equipe_nome
         FROM participacoes_equipe p
         JOIN equipes e ON e.id = p.equipe_id
         WHERE p.jogador_id = ? AND p.funcao = 'titular' AND p.saiu_em IS NULL
           AND p.equipe_id <> ?`,
      )
      .get(pedido.jogadorId, pedido.equipeId) as
      | (LinhaParticipacao & { equipe_nome: string })
      | undefined;

    if (emOutraEquipe !== undefined && !pedido.liberarEmOutraEquipe) {
      throw new ErroValidacao([
        `Esta pessoa já é titular em ${emOutraEquipe.equipe_nome}. Para escalá-la aqui, libere a titularidade de lá.`,
      ]);
    }

    // A pessoa ja joga nesta equipe (reserva, academia ou outra posicao)?
    const existente = banco
      .prepare(
        `SELECT * FROM participacoes_equipe
         WHERE equipe_id = ? AND jogador_id = ? AND saiu_em IS NULL
           AND funcao IN ('titular', 'reserva', 'academia')`,
      )
      .get(pedido.equipeId, pedido.jogadorId) as LinhaParticipacao | undefined;

    // Se alguma participacao vai ser encerrada, o motivo e obrigatorio
    const algoSeraEncerrado =
      ocupante !== undefined || emOutraEquipe !== undefined || existente !== undefined;
    if (algoSeraEncerrado && textoOuNull(opcoes.motivo) === null) {
      throw new ErroValidacao(["Informe o motivo da mudança de escalação."]);
    }

    // 1) o titular atual da posicao sai
    if (ocupante !== undefined) {
      encerrarParticipacao(banco, ocupante.id, opcoes);
    }

    // 2) a pessoa e liberada da outra equipe (e, se pedido, vira reserva la)
    if (emOutraEquipe !== undefined) {
      encerrarParticipacao(banco, emOutraEquipe.id, opcoes);
      if (pedido.outraEquipeVaiParaReserva) {
        adicionarMembro(
          banco,
          { equipeId: emOutraEquipe.equipe_id, jogadorId: pedido.jogadorId, funcao: "reserva" },
          {
            motivo: "Titularidade passou para outra equipe",
            responsavel: opcoes.responsavel,
          },
        );
      }
    }

    // 3) a pessoa assume a posicao (troca de funcao, se ja jogava na equipe)
    const nova =
      existente !== undefined
        ? trocarFuncao(banco, existente.id, "titular", pedido.posicao, opcoes)
        : adicionarMembro(
            banco,
            {
              equipeId: pedido.equipeId,
              jogadorId: pedido.jogadorId,
              funcao: "titular",
              posicao: pedido.posicao,
            },
            opcoes,
          );

    // 4) o titular anterior vira reserva (opcional)
    if (ocupante !== undefined && pedido.anteriorVaiParaReserva) {
      adicionarMembro(
        banco,
        { equipeId: pedido.equipeId, jogadorId: ocupante.jogador_id, funcao: "reserva" },
        { motivo: `Substituído na posição ${pedido.posicao}`, responsavel: opcoes.responsavel },
      );
    }

    return nova;
  });

  return executarEscalacao();
}

// ---------- capitao e coach ----------

export interface PedidoStaff {
  equipeId: number;
  jogadorId: number;
  funcao: "capitao" | "coach";
}

// Designa o capitao ou o coach. Se ja existir um, ele sai (com motivo obrigatorio)
export function designarStaff(
  banco: Database.Database,
  pedido: PedidoStaff,
  opcoes: OpcoesParticipacao = {},
): Participacao {
  if (pedido.funcao !== "capitao" && pedido.funcao !== "coach") {
    throw new ErroValidacao(["A função deve ser capitão ou coach."]);
  }

  const designar = banco.transaction((): Participacao => {
    const atual = banco
      .prepare(
        `SELECT * FROM participacoes_equipe
         WHERE equipe_id = ? AND funcao = ? AND saiu_em IS NULL`,
      )
      .get(pedido.equipeId, pedido.funcao) as LinhaParticipacao | undefined;

    if (atual !== undefined) {
      if (atual.jogador_id === pedido.jogadorId) {
        throw new ErroValidacao(["Esta pessoa já tem esta função nesta equipe."]);
      }
      if (textoOuNull(opcoes.motivo) === null) {
        throw new ErroValidacao(["Informe o motivo da substituição."]);
      }
      encerrarParticipacao(banco, atual.id, opcoes);
    }

    return adicionarMembro(
      banco,
      { equipeId: pedido.equipeId, jogadorId: pedido.jogadorId, funcao: pedido.funcao },
      opcoes,
    );
  });

  return designar();
}

// ---------- inativar mantendo tudo consistente ----------

function contarParticipacoesAtivasDaEquipe(
  banco: Database.Database,
  equipeId: number,
): number {
  const linha = banco
    .prepare(
      "SELECT COUNT(*) AS total FROM participacoes_equipe WHERE equipe_id = ? AND saiu_em IS NULL",
    )
    .get(equipeId) as { total: number };
  return linha.total;
}

// Inativa a equipe E encerra todas as participacoes dela (tudo ou nada)
export function inativarEquipe(
  banco: Database.Database,
  equipeId: number,
  opcoes: OpcoesParticipacao = {},
): Equipe {
  const equipe = buscarEquipePorId(banco, equipeId);
  if (equipe === null) {
    throw new ErroValidacao(["Equipe não encontrada."]);
  }
  if (equipe.status === "inativa") {
    throw new ErroValidacao(["Esta equipe já está inativa."]);
  }
  const motivo = textoOuNull(opcoes.motivo);
  if (motivo === null) {
    throw new ErroValidacao(["Informe o motivo da inativação."]);
  }

  const inativar = banco.transaction((): Equipe => {
    const ativas = banco
      .prepare("SELECT id FROM participacoes_equipe WHERE equipe_id = ? AND saiu_em IS NULL")
      .all(equipeId) as { id: number }[];

    for (const { id } of ativas) {
      encerrarParticipacao(banco, id, { motivo: `Equipe inativada: ${motivo}` });
    }

    banco
      .prepare("UPDATE equipes SET status = 'inativa', atualizado_em = datetime('now') WHERE id = ?")
      .run(equipeId);

    const atualizada = buscarEquipePorId(banco, equipeId);
    if (atualizada === null) {
      throw new Error("Falha ao ler a equipe inativada.");
    }
    return atualizada;
  });

  return inativar();
}

// Inativa a PESSOA E a retira de todas as equipes (tudo ou nada)
export function inativarPessoa(
  banco: Database.Database,
  jogadorId: number,
  status: "inativo" | "fora_do_projeto",
  opcoes: OpcoesParticipacao = {},
): Jogador {
  if (status !== "inativo" && status !== "fora_do_projeto") {
    throw new ErroValidacao(["O status deve ser inativo ou fora do projeto."]);
  }
  const motivo = textoOuNull(opcoes.motivo);
  if (motivo === null) {
    throw new ErroValidacao(["Informe o motivo da mudança de status."]);
  }

  const inativar = banco.transaction((): Jogador => {
    const ativas = banco
      .prepare("SELECT id FROM participacoes_equipe WHERE jogador_id = ? AND saiu_em IS NULL")
      .all(jogadorId) as { id: number }[];

    for (const { id } of ativas) {
      encerrarParticipacao(banco, id, { motivo: `Pessoa inativada: ${motivo}` });
    }

    return editarJogador(banco, jogadorId, { status }, { motivo, responsavel: opcoes.responsavel });
  });

  return inativar();
}