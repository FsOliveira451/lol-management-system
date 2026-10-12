import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import { criarJogador } from "../src/database/jogadores-repositorio";
import {
  adicionarMembro,
  criarEquipe,
  escalarTitular,
  listarMembros,
  type PedidoEscalacao,
} from "../src/database/equipes-repositorio";
import { ErroValidacao } from "../src/core/erros";

let banco: Database.Database;
let alpha: number;
let bravo: number;
let ana: number;
let bia: number;

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);

  alpha = criarEquipe(banco, { nome: "Alpha" }).id;
  bravo = criarEquipe(banco, { nome: "Bravo" }).id;
  ana = criarJogador(banco, { apelido: "Ana" }).id;
  bia = criarJogador(banco, { apelido: "Bia" }).id;

  // Ana e a titular Mid da Alpha
  adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
});

afterEach(() => {
  banco.close();
});

// Pedido padrao: Bia vira titular Mid da Alpha, sem nenhuma opcao extra
function pedido(extra: Partial<PedidoEscalacao> = {}): PedidoEscalacao {
  return {
    equipeId: alpha,
    posicao: "Mid",
    jogadorId: bia,
    anteriorVaiParaReserva: false,
    liberarEmOutraEquipe: false,
    outraEquipeVaiParaReserva: false,
    ...extra,
  };
}

function resumo(equipeId: number): string[] {
  return listarMembros(banco, equipeId).map((m) => `${m.apelido}:${m.funcao}`);
}

describe("escalarTitular", () => {
  it("a pessoa nova assume e o titular anterior vira reserva", () => {
    const nova = escalarTitular(banco, pedido({ anteriorVaiParaReserva: true }), {
      motivo: "Melhor desempenho",
    });

    expect(nova).toMatchObject({ jogadorId: bia, funcao: "titular", posicao: "Mid" });
    expect(resumo(alpha)).toEqual(["Bia:titular", "Ana:reserva"]);
  });

  it("sem mover para reserva, o titular anterior apenas sai (com o motivo registrado)", () => {
    escalarTitular(banco, pedido(), { motivo: "Melhor desempenho" });

    expect(resumo(alpha)).toEqual(["Bia:titular"]);
    const historico = listarMembros(banco, alpha, { incluirHistorico: true });
    const saidaDaAna = historico.find((m) => m.apelido === "Ana" && m.saiuEm !== null);
    expect(saidaDaAna?.motivoSaida).toBe("Melhor desempenho");
  });

  it("promove uma reserva da própria equipe, trocando a função dela", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: bia, funcao: "reserva" });

    escalarTitular(banco, pedido({ anteriorVaiParaReserva: true }), { motivo: "Troca tática" });

    expect(resumo(alpha)).toEqual(["Bia:titular", "Ana:reserva"]);
    // Ana titular (encerrada) + Bia reserva (encerrada) + Bia titular + Ana reserva
    expect(listarMembros(banco, alpha, { incluirHistorico: true })).toHaveLength(4);
  });

  it("posição vazia: escala direto, sem precisar de motivo", () => {
    escalarTitular(banco, pedido({ posicao: "Top" }));
    expect(resumo(alpha)).toEqual(["Bia:titular", "Ana:titular"]);
  });

  it("exige o motivo quando algo vai ser encerrado, e não muda nada sem ele", () => {
    expect(() => escalarTitular(banco, pedido())).toThrow(ErroValidacao);
    expect(resumo(alpha)).toEqual(["Ana:titular"]);
  });

  it("recusa escalar a mesma pessoa na mesma posição", () => {
    expect(() => escalarTitular(banco, pedido({ jogadorId: ana }), { motivo: "Teste" })).toThrow(
      ErroValidacao,
    );
  });

  it("recusa pessoa titular em outra equipe, citando a equipe, se não for liberada", () => {
    adicionarMembro(banco, { equipeId: bravo, jogadorId: bia, funcao: "titular", posicao: "Top" });

    expect(() => escalarTitular(banco, pedido(), { motivo: "Teste" })).toThrow(/Bravo/);
    expect(resumo(alpha)).toEqual(["Ana:titular"]);
    expect(resumo(bravo)).toEqual(["Bia:titular"]);
  });

  it("transfere a titularidade: libera na outra equipe, onde ela vira reserva", () => {
    adicionarMembro(banco, { equipeId: bravo, jogadorId: bia, funcao: "titular", posicao: "Top" });

    escalarTitular(
      banco,
      pedido({
        anteriorVaiParaReserva: true,
        liberarEmOutraEquipe: true,
        outraEquipeVaiParaReserva: true,
      }),
      { motivo: "Transferência" },
    );

    expect(resumo(alpha)).toEqual(["Bia:titular", "Ana:reserva"]);
    expect(resumo(bravo)).toEqual(["Bia:reserva"]);
  });

  it("transfere a titularidade sem deixar a pessoa como reserva na outra equipe", () => {
    adicionarMembro(banco, { equipeId: bravo, jogadorId: bia, funcao: "titular", posicao: "Top" });

    escalarTitular(banco, pedido({ liberarEmOutraEquipe: true }), { motivo: "Transferência" });

    expect(resumo(alpha)).toEqual(["Bia:titular"]);
    expect(resumo(bravo)).toEqual([]);
  });

  it("tudo ou nada: se um passo falhar no meio, nada muda", () => {
    adicionarMembro(banco, { equipeId: bravo, jogadorId: bia, funcao: "titular", posicao: "Top" });
    // Simula uma pessoa inativa "por fora", para o ultimo passo ser recusado
    banco.prepare("UPDATE jogadores SET status = 'inativo' WHERE id = ?").run(bia);

    expect(() =>
      escalarTitular(banco, pedido({ liberarEmOutraEquipe: true }), { motivo: "Teste" }),
    ).toThrow(ErroValidacao);

    expect(resumo(alpha)).toEqual(["Ana:titular"]);
    expect(resumo(bravo)).toEqual(["Bia:titular"]);
  });

  it("recusa posição inexistente", () => {
    expect(() => escalarTitular(banco, pedido({ posicao: "Banco" as never }))).toThrow(
      ErroValidacao,
    );
  });
});