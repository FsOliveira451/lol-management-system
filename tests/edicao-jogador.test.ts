import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Jogador } from "../src/core/jogadores/tipos";
import { criarTabelas } from "../src/database/esquema";
import { criarJogador, editarJogador } from "../src/database/jogadores-repositorio";
import { listarHistoricoDoJogador } from "../src/database/historico-repositorio";
import { converterFormulario, valoresDoJogador } from "../src/renderer/formulario-jogador";

// Um jogador "em branco" para testar a conversao, sem precisar do banco
const jogadorBase: Jogador = {
  id: 1,
  apelido: "Ana",
  riotId: null,
  eloAtual: "Desconhecido",
  eloMaximo: null,
  posicaoPrincipal: null,
  posicaoSecundaria: null,
  experienciaCompetitiva: false,
  comunicacao: null,
  lideranca: null,
  comprometimento: null,
  status: "em_avaliacao",
  observacoes: null,
  criadoEm: "2026-01-01 00:00:00",
  atualizadoEm: "2026-01-01 00:00:00",
};

describe("valoresDoJogador", () => {
  it("transforma campos não informados em texto vazio", () => {
    expect(valoresDoJogador(jogadorBase)).toEqual({
      apelido: "Ana",
      riotId: "",
      eloAtual: "Desconhecido",
      eloMaximo: "",
      posicaoPrincipal: "",
      posicaoSecundaria: "",
      experienciaCompetitiva: false,
      observacoes: "",
    });
  });

  it("mantém os valores preenchidos", () => {
    const jogador: Jogador = {
      ...jogadorBase,
      riotId: "Ana#BR1",
      eloAtual: "Ouro",
      eloMaximo: "Platina",
      posicaoPrincipal: "Mid",
      experienciaCompetitiva: true,
      observacoes: "ok",
    };
    expect(valoresDoJogador(jogador)).toMatchObject({
      riotId: "Ana#BR1",
      eloAtual: "Ouro",
      eloMaximo: "Platina",
      posicaoPrincipal: "Mid",
      experienciaCompetitiva: true,
      observacoes: "ok",
    });
  });

  it("ida e volta: formulário → dados devolve os mesmos valores", () => {
    const jogador: Jogador = { ...jogadorBase, riotId: "Ana#BR1", eloMaximo: "Platina" };
    expect(converterFormulario(valoresDoJogador(jogador))).toMatchObject({
      apelido: "Ana",
      riotId: "Ana#BR1",
      eloMaximo: "Platina",
      posicaoPrincipal: null,
    });
  });
});

describe("edição com os campos do formulário", () => {
  let banco: Database.Database;

  beforeEach(() => {
    banco = new Database(":memory:");
    banco.pragma("foreign_keys = ON");
    criarTabelas(banco);
  });

  afterEach(() => {
    banco.close();
  });

  // Quantas linhas o banco ja alterou desde que foi aberto
  function totalDeAlteracoes(): number {
    const linha = banco.prepare("SELECT total_changes() AS n").get() as { n: number };
    return linha.n;
  }

  it("limpar o Riot ID (null) grava como não informado", () => {
    const criado = criarJogador(banco, { apelido: "Joao", riotId: "Joao#BR1" });
    const editado = editarJogador(banco, criado.id, { riotId: null });
    expect(editado.riotId).toBeNull();
  });

  it("limpar o elo máximo aparece no histórico como 'Platina → vazio'", () => {
    const criado = criarJogador(banco, {
      apelido: "Joao",
      eloAtual: "Ouro",
      eloMaximo: "Platina",
    });
    editarJogador(banco, criado.id, { eloMaximo: null }, { motivo: "Corrigido" });

    const historico = listarHistoricoDoJogador(banco, criado.id, "elo_maximo");
    expect(historico.at(-1)).toMatchObject({
      valorAnterior: "Platina",
      valorNovo: null,
      motivo: "Corrigido",
    });
  });

  it("enviar todos os campos registra só o que realmente mudou", () => {
    const criado = criarJogador(banco, {
      apelido: "Joao",
      eloAtual: "Ouro",
      posicaoPrincipal: "Mid",
    });
    const antes = listarHistoricoDoJogador(banco, criado.id).length;

    const dados = converterFormulario({ ...valoresDoJogador(criado), eloAtual: "Platina" });
    editarJogador(banco, criado.id, dados, { motivo: "Subiu de elo" });

    const historico = listarHistoricoDoJogador(banco, criado.id);
    expect(historico).toHaveLength(antes + 1);
    expect(historico.at(-1)).toMatchObject({
      campo: "elo_atual",
      valorAnterior: "Ouro",
      valorNovo: "Platina",
      motivo: "Subiu de elo",
    });
  });

  it("mudar o elo não exige motivo", () => {
    const criado = criarJogador(banco, { apelido: "Joao", eloAtual: "Ouro" });
    editarJogador(banco, criado.id, { eloAtual: "Prata" });

    const historico = listarHistoricoDoJogador(banco, criado.id, "elo_atual");
    expect(historico.at(-1)?.motivo).toBeNull();
  });

  it("salvar sem mudar nada não grava nada no banco", () => {
    const criado = criarJogador(banco, {
      apelido: "Joao",
      riotId: "Joao#BR1",
      eloAtual: "Ouro",
      posicaoPrincipal: "Mid",
    });

    const antes = totalDeAlteracoes();
    editarJogador(banco, criado.id, converterFormulario(valoresDoJogador(criado)));
    expect(totalDeAlteracoes()).toBe(antes);
  });
});