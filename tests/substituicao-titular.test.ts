import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import { criarJogador } from "../src/database/jogadores-repositorio";
import {
  adicionarMembro,
  criarEquipe,
  listarMembros,
  substituirTitular,
} from "../src/database/equipes-repositorio";
import { ErroValidacao } from "../src/core/erros";

let banco: Database.Database;
let alpha: number;
let ana: number;
let bia: number;

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);

  alpha = criarEquipe(banco, { nome: "Alpha" }).id;
  ana = criarJogador(banco, { apelido: "Ana" }).id;
  bia = criarJogador(banco, { apelido: "Bia" }).id;

  // Ana e a titular Mid da Alpha
  adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
});

afterEach(() => {
  banco.close();
});

function resumo(): string[] {
  return listarMembros(banco, alpha).map((m) => `${m.apelido}:${m.funcao}`);
}

describe("substituirTitular", () => {
  it("a pessoa nova assume e o titular anterior vira reserva", () => {
    const novo = substituirTitular(
      banco,
      { equipeId: alpha, posicao: "Mid", novoJogadorId: bia, anteriorVaiParaReserva: true },
      { motivo: "Melhor desempenho" },
    );

    expect(novo).toMatchObject({ jogadorId: bia, funcao: "titular", posicao: "Mid" });
    expect(resumo()).toEqual(["Bia:titular", "Ana:reserva"]);
  });

  it("sem mover para reserva, o titular anterior apenas sai (com o motivo registrado)", () => {
    substituirTitular(
      banco,
      { equipeId: alpha, posicao: "Mid", novoJogadorId: bia, anteriorVaiParaReserva: false },
      { motivo: "Melhor desempenho" },
    );

    expect(resumo()).toEqual(["Bia:titular"]);
    const historico = listarMembros(banco, alpha, { incluirHistorico: true });
    const saidaDaAna = historico.find((m) => m.apelido === "Ana" && m.saiuEm !== null);
    expect(saidaDaAna?.motivoSaida).toBe("Melhor desempenho");
  });

  it("promove uma reserva da própria equipe, trocando a função dela", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: bia, funcao: "reserva" });

    substituirTitular(
      banco,
      { equipeId: alpha, posicao: "Mid", novoJogadorId: bia, anteriorVaiParaReserva: true },
      { motivo: "Troca tática" },
    );

    expect(resumo()).toEqual(["Bia:titular", "Ana:reserva"]);
    // Ana titular (encerrada) + Bia reserva (encerrada) + Bia titular + Ana reserva
    expect(listarMembros(banco, alpha, { incluirHistorico: true })).toHaveLength(4);
  });

  it("exige o motivo e não muda nada sem ele", () => {
    expect(() =>
      substituirTitular(banco, {
        equipeId: alpha,
        posicao: "Mid",
        novoJogadorId: bia,
        anteriorVaiParaReserva: true,
      }),
    ).toThrow(ErroValidacao);
    expect(resumo()).toEqual(["Ana:titular"]);
  });

  it("recusa substituir numa posição que não tem titular", () => {
    expect(() =>
      substituirTitular(
        banco,
        { equipeId: alpha, posicao: "Top", novoJogadorId: bia, anteriorVaiParaReserva: false },
        { motivo: "Teste" },
      ),
    ).toThrow(ErroValidacao);
  });

  it("recusa substituir a pessoa por ela mesma", () => {
    expect(() =>
      substituirTitular(
        banco,
        { equipeId: alpha, posicao: "Mid", novoJogadorId: ana, anteriorVaiParaReserva: false },
        { motivo: "Teste" },
      ),
    ).toThrow(ErroValidacao);
  });

  it("tudo ou nada: se a pessoa nova não puder entrar, o titular atual continua", () => {
    // Bia ja e titular em OUTRA equipe: a regra "titular em uma equipe so" a impede
    const bravo = criarEquipe(banco, { nome: "Bravo" }).id;
    adicionarMembro(banco, { equipeId: bravo, jogadorId: bia, funcao: "titular", posicao: "Top" });

    expect(() =>
      substituirTitular(
        banco,
        { equipeId: alpha, posicao: "Mid", novoJogadorId: bia, anteriorVaiParaReserva: true },
        { motivo: "Teste" },
      ),
    ).toThrow(ErroValidacao);

    expect(resumo()).toEqual(["Ana:titular"]);
  });
});