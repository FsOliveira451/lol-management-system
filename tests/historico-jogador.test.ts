import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import {
  criarJogador,
  editarJogador,
  inativarJogador,
} from "../src/database/jogadores-repositorio";
import {
  listarHistoricoDoJogador,
  registrarHistorico,
} from "../src/database/historico-repositorio";
import { ErroValidacao } from "../src/core/erros";

let banco: Database.Database;

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);
});

afterEach(() => {
  banco.close();
});

describe("historico no cadastro", () => {
  it("registra o elo inicial como 'Cadastro inicial'", () => {
    const jogador = criarJogador(banco, { apelido: "Joao", eloAtual: "Ouro" });
    const historico = listarHistoricoDoJogador(banco, jogador.id, "elo_atual");

    expect(historico).toHaveLength(1);
    expect(historico[0]?.valorAnterior).toBeNull();
    expect(historico[0]?.valorNovo).toBe("Ouro");
    expect(historico[0]?.motivo).toBe("Cadastro inicial");
  });
});

describe("historico na edicao", () => {
  it("registra valor anterior, valor novo e motivo ao mudar o elo", () => {
    const jogador = criarJogador(banco, { apelido: "Joao", eloAtual: "Ouro" });
    editarJogador(
      banco,
      jogador.id,
      { eloAtual: "Platina" },
      { motivo: "Subiu na ranqueada" },
    );

    const historico = listarHistoricoDoJogador(banco, jogador.id, "elo_atual");
    expect(historico).toHaveLength(2);
    expect(historico[1]?.valorAnterior).toBe("Ouro");
    expect(historico[1]?.valorNovo).toBe("Platina");
    expect(historico[1]?.motivo).toBe("Subiu na ranqueada");
  });

  it("não registra nada quando o valor enviado é igual ao atual", () => {
    const jogador = criarJogador(banco, { apelido: "Joao", eloAtual: "Ouro" });
    editarJogador(banco, jogador.id, { eloAtual: "Ouro" });

    expect(listarHistoricoDoJogador(banco, jogador.id, "elo_atual")).toHaveLength(1);
  });

  it("não registra mudança de campos que não são rastreados", () => {
    const jogador = criarJogador(banco, { apelido: "Joao" });
    const antes = listarHistoricoDoJogador(banco, jogador.id).length;

    editarJogador(banco, jogador.id, { apelido: "Joao Silva" });

    expect(listarHistoricoDoJogador(banco, jogador.id)).toHaveLength(antes);
  });
});

describe("regra: status exige motivo", () => {
  it("recusa mudar o status sem motivo e mantém o status antigo", () => {
    const jogador = criarJogador(banco, { apelido: "Joao" });

    expect(() => editarJogador(banco, jogador.id, { status: "titular" })).toThrow(
      ErroValidacao,
    );
    expect(listarHistoricoDoJogador(banco, jogador.id, "status")).toHaveLength(1);
  });

  it("aceita com motivo e guarda o responsável", () => {
    const jogador = criarJogador(banco, { apelido: "Joao" });
    editarJogador(
      banco,
      jogador.id,
      { status: "titular" },
      { motivo: "Aprovado no tryout", responsavel: "Admin1" },
    );

    const historico = listarHistoricoDoJogador(banco, jogador.id, "status");
    expect(historico).toHaveLength(2);
    expect(historico[1]?.valorAnterior).toBe("em_avaliacao");
    expect(historico[1]?.valorNovo).toBe("titular");
    expect(historico[1]?.responsavel).toBe("Admin1");
  });

  it("recusa inativar sem motivo", () => {
    const jogador = criarJogador(banco, { apelido: "Joao" });
    expect(() => inativarJogador(banco, jogador.id, "")).toThrow(ErroValidacao);
  });
});

describe("relacionamento entre tabelas", () => {
  it("o banco recusa histórico de um jogador que não existe", () => {
    expect(() =>
      registrarHistorico(banco, {
        jogadorId: 999,
        campo: "status",
        valorAnterior: null,
        valorNovo: "ativo",
      }),
    ).toThrow();
  });
});