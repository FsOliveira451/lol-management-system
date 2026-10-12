import type Database from "better-sqlite3";
import { ErroValidacao } from "../core/erros";
import { validarDadosJogador } from "../core/jogadores/validacao";
import type {
  DadosJogador,
  Elo,
  Jogador,
  Posicao,
  StatusJogador,
} from "../core/jogadores/tipos";
import { registrarHistorico, type CampoHistorico } from "./historico-repositorio";

// Como a linha do banco chega (nomes com underline, 0/1 no lugar de true/false)
interface LinhaJogador {
  id: number;
  apelido: string;
  riot_id: string | null;
  elo_atual: Elo;
  elo_maximo: Elo | null;
  posicao_principal: Posicao | null;
  posicao_secundaria: Posicao | null;
  experiencia_competitiva: number;
  comunicacao: number | null;
  lideranca: number | null;
  comprometimento: number | null;
  status: StatusJogador;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface FiltrosJogadores {
  status?: StatusJogador;
  posicao?: Posicao;
  elo?: Elo;
  busca?: string;
  incluirInativos?: boolean;
}

// Informacoes extras de uma alteracao: por que e quem fez
export interface OpcoesAlteracao {
  motivo?: string;
  responsavel?: string;
}

// Campos cujas mudancas ficam registradas no historico
const CAMPOS_RASTREADOS = [
  { chave: "eloAtual", coluna: "elo_atual" },
  { chave: "eloMaximo", coluna: "elo_maximo" },
  { chave: "posicaoPrincipal", coluna: "posicao_principal" },
  { chave: "posicaoSecundaria", coluna: "posicao_secundaria" },
  { chave: "status", coluna: "status" },
] as const;

interface MudancaRastreada {
  campo: CampoHistorico;
  valorAnterior: string | null;
  valorNovo: string | null;
}

// Compara o jogador atual com os dados enviados e lista o que REALMENTE mudou
function detectarMudancas(
  atual: Jogador,
  dados: DadosJogador,
): MudancaRastreada[] {
  const mudancas: MudancaRastreada[] = [];

  for (const { chave, coluna } of CAMPOS_RASTREADOS) {
    const novo = dados[chave];
    if (novo === undefined) continue; // campo nao enviado
    const anterior = atual[chave];
    if (novo !== anterior) {
      mudancas.push({ campo: coluna, valorAnterior: anterior, valorNovo: novo });
    }
  }

  return mudancas;
}

// Traduz o formato do banco para o formato do sistema
function linhaParaJogador(linha: LinhaJogador): Jogador {
  return {
    id: linha.id,
    apelido: linha.apelido,
    riotId: linha.riot_id,
    eloAtual: linha.elo_atual,
    eloMaximo: linha.elo_maximo,
    posicaoPrincipal: linha.posicao_principal,
    posicaoSecundaria: linha.posicao_secundaria,
    experienciaCompetitiva: linha.experiencia_competitiva === 1,
    comunicacao: linha.comunicacao,
    lideranca: linha.lideranca,
    comprometimento: linha.comprometimento,
    status: linha.status,
    observacoes: linha.observacoes,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

// Texto vazio ou so espacos vira "nao informado" (null)
function normalizarRiotId(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

// Ja existe outro jogador com este Riot ID? (ignora maiusculas/minusculas)
function riotIdEmUso(
  banco: Database.Database,
  riotId: string,
  ignorarId = 0,
): boolean {
  const linha = banco
    .prepare("SELECT id FROM jogadores WHERE riot_id = ? COLLATE NOCASE AND id <> ?")
    .get(riotId, ignorarId);
  return linha !== undefined;
}

// Quantas participacoes ativas (em equipes) esta pessoa tem
function contarParticipacoesAtivas(banco: Database.Database, jogadorId: number): number {
  const linha = banco
    .prepare(
      "SELECT COUNT(*) AS total FROM participacoes_equipe WHERE jogador_id = ? AND saiu_em IS NULL",
    )
    .get(jogadorId) as { total: number };
  return linha.total;
}

export function buscarJogadorPorId(
  banco: Database.Database,
  id: number,
): Jogador | null {
  const linha = banco
    .prepare("SELECT * FROM jogadores WHERE id = ?")
    .get(id) as LinhaJogador | undefined;
  return linha ? linhaParaJogador(linha) : null;
}

export function criarJogador(
  banco: Database.Database,
  dados: DadosJogador,
  opcoes: OpcoesAlteracao = {},
): Jogador {
  const erros = validarDadosJogador(dados, "criar");
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  const riotId = normalizarRiotId(dados.riotId);
  if (riotId !== null && riotIdEmUso(banco, riotId)) {
    throw new ErroValidacao(["Já existe um jogador com este Riot ID."]);
  }

  // TRANSACAO: o jogador e o seu historico inicial sao gravados juntos.
  // Se qualquer passo falhar, nada fica gravado pela metade.
  const gravar = banco.transaction((): Jogador => {
    const resultado = banco
      .prepare(
        `INSERT INTO jogadores (
           apelido, riot_id, elo_atual, elo_maximo,
           posicao_principal, posicao_secundaria, experiencia_competitiva,
           comunicacao, lideranca, comprometimento, status, observacoes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        (dados.apelido ?? "").trim(),
        riotId,
        dados.eloAtual ?? "Desconhecido",
        dados.eloMaximo ?? null,
        dados.posicaoPrincipal ?? null,
        dados.posicaoSecundaria ?? null,
        dados.experienciaCompetitiva ? 1 : 0,
        dados.comunicacao ?? null,
        dados.lideranca ?? null,
        dados.comprometimento ?? null,
        dados.status ?? "em_avaliacao",
        dados.observacoes ?? null,
      );

    const criado = buscarJogadorPorId(banco, Number(resultado.lastInsertRowid));
    if (criado === null) {
      throw new Error("Falha ao ler o jogador recém-criado.");
    }

    for (const { chave, coluna } of CAMPOS_RASTREADOS) {
      const valor = criado[chave];
      if (valor !== null) {
        registrarHistorico(banco, {
          jogadorId: criado.id,
          campo: coluna,
          valorAnterior: null,
          valorNovo: valor,
          motivo: "Cadastro inicial",
          responsavel: opcoes.responsavel,
        });
      }
    }

    return criado;
  });

  return gravar();
}

export function listarJogadores(
  banco: Database.Database,
  filtros: FiltrosJogadores = {},
): Jogador[] {
  const condicoes: string[] = [];
  const valores: string[] = [];

  if (filtros.status) {
    condicoes.push("status = ?");
    valores.push(filtros.status);
  } else if (!filtros.incluirInativos) {
    condicoes.push("status NOT IN ('inativo', 'fora_do_projeto')");
  }

  if (filtros.posicao) {
    condicoes.push("posicao_principal = ?");
    valores.push(filtros.posicao);
  }

  if (filtros.elo) {
    condicoes.push("elo_atual = ?");
    valores.push(filtros.elo);
  }

  const busca = filtros.busca?.trim();
  if (busca) {
    condicoes.push("(apelido LIKE ? OR riot_id LIKE ?)");
    valores.push(`%${busca}%`, `%${busca}%`);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";

  const linhas = banco
    .prepare(`SELECT * FROM jogadores ${where} ORDER BY apelido COLLATE NOCASE`)
    .all(...valores) as LinhaJogador[];

  return linhas.map(linhaParaJogador);
}

// Mapa: campo do sistema -> coluna do banco.
// "Record<keyof DadosJogador, string>" obriga a listar TODOS os campos:
// se adicionarmos um campo novo e esquecermos aqui, o TypeScript avisa.
const COLUNAS: Record<keyof DadosJogador, string> = {
  apelido: "apelido",
  riotId: "riot_id",
  eloAtual: "elo_atual",
  eloMaximo: "elo_maximo",
  posicaoPrincipal: "posicao_principal",
  posicaoSecundaria: "posicao_secundaria",
  experienciaCompetitiva: "experiencia_competitiva",
  comunicacao: "comunicacao",
  lideranca: "lideranca",
  comprometimento: "comprometimento",
  status: "status",
  observacoes: "observacoes",
};

export function editarJogador(
  banco: Database.Database,
  id: number,
  dados: DadosJogador,
  opcoes: OpcoesAlteracao = {},
): Jogador {
  const atual = buscarJogadorPorId(banco, id);
  if (atual === null) {
    throw new ErroValidacao(["Jogador não encontrado."]);
  }

  // Valida o CONJUNTO: dados ja gravados + o que esta sendo alterado
  const combinado: DadosJogador = {
    eloAtual: atual.eloAtual,
    eloMaximo: atual.eloMaximo,
    posicaoPrincipal: atual.posicaoPrincipal,
    posicaoSecundaria: atual.posicaoSecundaria,
    ...dados,
  };
  const erros = validarDadosJogador(combinado, "editar");
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  // Quem esta em alguma equipe nao pode ficar inativo sem antes sair
  // (evita elenco com gente inativa)
  const vaiSair = dados.status === "inativo" || dados.status === "fora_do_projeto";
  if (vaiSair) {
    const total = contarParticipacoesAtivas(banco, id);
    if (total > 0) {
      throw new ErroValidacao([
        `Esta pessoa tem ${total} participação(ões) ativa(s) em equipes. Retire-a das equipes ou use "Inativar e retirar das equipes".`,
      ]);
    }
  }

  // Regra do projeto: nao alterar o status sem motivo
  const mudancas = detectarMudancas(atual, dados);
  const mudouStatus = mudancas.some((m) => m.campo === "status");
  if (mudouStatus && !opcoes.motivo?.trim()) {
    throw new ErroValidacao(["Informe o motivo da mudança de status."]);
  }

  const alteracoes: string[] = [];
  const valores: (string | number | null)[] = [];

    for (const chave of Object.keys(COLUNAS) as (keyof DadosJogador)[]) {
    const valor = dados[chave];
    if (valor === undefined) continue; // campo nao enviado: nao mexe

    // Valor "limpo", no formato do sistema (para comparar com o que ja esta gravado)
    let novo: string | number | boolean | null;
    if (typeof valor === "string") {
      novo = chave === "riotId" ? normalizarRiotId(valor) : valor.trim();
    } else {
      novo = valor;
    }

    // Nada mudou neste campo: nao precisa gravar
    if (novo === atual[chave]) continue;

    if (typeof novo === "string" && chave === "riotId") {
      if (riotIdEmUso(banco, novo, id)) {
        throw new ErroValidacao(["Já existe um jogador com este Riot ID."]);
      }
    }

    alteracoes.push(`${COLUNAS[chave]} = ?`);
    valores.push(typeof novo === "boolean" ? (novo ? 1 : 0) : novo);
  }

  if (alteracoes.length === 0) {
    return atual; // nada a alterar
  }

  // TRANSACAO: a alteracao e o seu registro no historico andam juntos
  const gravar = banco.transaction(() => {
    banco
      .prepare(
        `UPDATE jogadores
         SET ${alteracoes.join(", ")}, atualizado_em = datetime('now')
         WHERE id = ?`,
      )
      .run(...valores, id);

    for (const mudanca of mudancas) {
      registrarHistorico(banco, {
        jogadorId: id,
        campo: mudanca.campo,
        valorAnterior: mudanca.valorAnterior,
        valorNovo: mudanca.valorNovo,
        motivo: opcoes.motivo?.trim() || null,
        responsavel: opcoes.responsavel,
      });
    }
  });
  gravar();

  const editado = buscarJogadorPorId(banco, id);
  if (editado === null) {
    throw new Error("Falha ao ler o jogador editado.");
  }
  return editado;
}

// "Remover" = marcar como inativo. O registro e o historico continuam existindo.
// Agora o motivo e OBRIGATORIO (e uma mudanca de status).
export function inativarJogador(
  banco: Database.Database,
  id: number,
  motivo: string,
  responsavel?: string,
): Jogador {
  return editarJogador(banco, id, { status: "inativo" }, { motivo, responsavel });
}