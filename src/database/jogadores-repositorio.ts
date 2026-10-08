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
): Jogador {
  const erros = validarDadosJogador(dados, "criar");
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }

  const riotId = normalizarRiotId(dados.riotId);
  if (riotId !== null && riotIdEmUso(banco, riotId)) {
    throw new ErroValidacao(["Já existe um jogador com este Riot ID."]);
  }

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
  return criado;
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

  const alteracoes: string[] = [];
  const valores: (string | number | null)[] = [];

  for (const chave of Object.keys(COLUNAS) as (keyof DadosJogador)[]) {
    const valor = dados[chave];
    if (valor === undefined) continue; // campo nao enviado: nao mexe

    let valorBanco: string | number | null;
    if (typeof valor === "boolean") {
      valorBanco = valor ? 1 : 0;
    } else if (typeof valor === "string") {
      valorBanco = chave === "riotId" ? normalizarRiotId(valor) : valor.trim();
    } else {
      valorBanco = valor;
    }

    if (typeof valorBanco === "string" && chave === "riotId") {
      if (riotIdEmUso(banco, valorBanco, id)) {
        throw new ErroValidacao(["Já existe um jogador com este Riot ID."]);
      }
    }

    alteracoes.push(`${COLUNAS[chave]} = ?`);
    valores.push(valorBanco);
  }

  if (alteracoes.length === 0) {
    return atual; // nada a alterar
  }

  banco
    .prepare(
      `UPDATE jogadores
       SET ${alteracoes.join(", ")}, atualizado_em = datetime('now')
       WHERE id = ?`,
    )
    .run(...valores, id);

  const editado = buscarJogadorPorId(banco, id);
  if (editado === null) {
    throw new Error("Falha ao ler o jogador editado.");
  }
  return editado;
}

// "Remover" = marcar como inativo. O registro e o historico continuam existindo.
export function inativarJogador(banco: Database.Database, id: number): Jogador {
  return editarJogador(banco, id, { status: "inativo" });
}