import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import { buscarJogadorPorId, criarJogador, editarJogador } from "../src/database/jogadores-repositorio";
import { listarHistoricoDoJogador } from "../src/database/historico-repositorio";
import {
  adicionarMembro,
  criarEquipe,
  designarStaff,
  editarEquipe,
  inativarEquipe,
  inativarPessoa,
  listarMembros,
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
});

afterEach(() => {
  banco.close();
});

function resumo(equipeId: number): string[] {
  return listarMembros(banco, equipeId).map((m) => `${m.apelido}:${m.funcao}`);
}

describe("designarStaff", () => {
  it("designa o primeiro capitão sem precisar de motivo", () => {
    const capitao = designarStaff(banco, { equipeId: alpha, jogadorId: ana, funcao: "capitao" });
    expect(capitao).toMatchObject({ funcao: "capitao", saiuEm: null });
  });

  it("substitui o capitão atual, que sai com o motivo registrado", () => {
    designarStaff(banco, { equipeId: alpha, jogadorId: ana, funcao: "capitao" });
    designarStaff(
      banco,
      { equipeId: alpha, jogadorId: bia, funcao: "capitao" },
      { motivo: "Nova liderança" },
    );

    expect(resumo(alpha)).toEqual(["Bia:capitao"]);
    const historico = listarMembros(banco, alpha, { incluirHistorico: true });
    const saidaDaAna = historico.find((m) => m.apelido === "Ana" && m.saiuEm !== null);
    expect(saidaDaAna?.motivoSaida).toBe("Nova liderança");
  });

  it("exige o motivo para substituir e não muda nada sem ele", () => {
    designarStaff(banco, { equipeId: alpha, jogadorId: ana, funcao: "capitao" });
    expect(() =>
      designarStaff(banco, { equipeId: alpha, jogadorId: bia, funcao: "capitao" }),
    ).toThrow(ErroValidacao);
    expect(resumo(alpha)).toEqual(["Ana:capitao"]);
  });

  it("recusa quem já tem a função", () => {
    designarStaff(banco, { equipeId: alpha, jogadorId: ana, funcao: "coach" });
    expect(() =>
      designarStaff(banco, { equipeId: alpha, jogadorId: ana, funcao: "coach" }, { motivo: "x" }),
    ).toThrow(ErroValidacao);
  });

  it("recusa função que não seja capitão ou coach", () => {
    expect(() =>
      designarStaff(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular" as never }),
    ).toThrow(ErroValidacao);
  });
});

describe("inativarEquipe", () => {
  it("exige o motivo", () => {
    expect(() => inativarEquipe(banco, alpha, {})).toThrow(ErroValidacao);
  });

  it("encerra todas as participações e marca a equipe como inativa", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
    adicionarMembro(banco, { equipeId: alpha, jogadorId: bia, funcao: "reserva" });

    const equipe = inativarEquipe(banco, alpha, { motivo: "Fim da temporada" });

    expect(equipe.status).toBe("inativa");
    expect(resumo(alpha)).toEqual([]);
    const historico = listarMembros(banco, alpha, { incluirHistorico: true });
    expect(historico).toHaveLength(2);
    expect(historico[0]?.motivoSaida).toBe("Equipe inativada: Fim da temporada");
  });

  it("libera a titularidade: quem era titular da equipe inativada pode ser titular em outra", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
    inativarEquipe(banco, alpha, { motivo: "Fim da temporada" });

    expect(() =>
      adicionarMembro(banco, { equipeId: bravo, jogadorId: ana, funcao: "titular", posicao: "Top" }),
    ).not.toThrow();
  });

  it("a edição comum recusa inativar equipe com membros, mas aceita equipe vazia", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "reserva" });

    expect(() => editarEquipe(banco, alpha, { status: "inativa" })).toThrow(ErroValidacao);
    expect(editarEquipe(banco, bravo, { status: "inativa" }).status).toBe("inativa");
  });
});

describe("inativarPessoa", () => {
  it("exige o motivo", () => {
    expect(() => inativarPessoa(banco, ana, "inativo", {})).toThrow(ErroValidacao);
  });

  it("recusa status que não seja inativo ou fora do projeto", () => {
    expect(() => inativarPessoa(banco, ana, "ativo" as never, { motivo: "x" })).toThrow(
      ErroValidacao,
    );
  });

  it("retira a pessoa de todas as equipes e a inativa, registrando no histórico", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
    adicionarMembro(banco, { equipeId: bravo, jogadorId: ana, funcao: "reserva" });

    const pessoa = inativarPessoa(banco, ana, "inativo", { motivo: "Saiu do projeto" });

    expect(pessoa.status).toBe("inativo");
    expect(resumo(alpha)).toEqual([]);
    expect(resumo(bravo)).toEqual([]);
    const historico = listarHistoricoDoJogador(banco, ana, "status");
    expect(historico.at(-1)).toMatchObject({ valorNovo: "inativo", motivo: "Saiu do projeto" });
  });

  it("a edição comum recusa inativar pessoa que ainda está em equipe", () => {
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "reserva" });

    expect(() => editarJogador(banco, ana, { status: "inativo" }, { motivo: "x" })).toThrow(
      ErroValidacao,
    );
    expect(buscarJogadorPorId(banco, ana)?.status).toBe("em_avaliacao");
  });
});