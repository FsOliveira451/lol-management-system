import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import {
  criarJogador,
  buscarJogadorPorId,
  listarJogadores,
  editarJogador,
  inativarJogador,
} from "../src/database/jogadores-repositorio";
import { ErroValidacao } from "../src/core/erros";

let banco: Database.Database;

// Antes de CADA teste: cria um banco novo e vazio, so na memoria
beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);
});

// Depois de CADA teste: fecha e descarta esse banco
afterEach(() => {
  banco.close();
});

describe("criarJogador", () => {
  it("cria um jogador com valores padrão", () => {
    const jogador = criarJogador(banco, { apelido: "Joao" });
    expect(jogador.id).toBe(1);
    expect(jogador.status).toBe("em_avaliacao");
    expect(jogador.eloAtual).toBe("Desconhecido");
    expect(jogador.comunicacao).toBeNull();
  });

  it("remove espaços sobrando do apelido", () => {
    const jogador = criarJogador(banco, { apelido: "  Joao  " });
    expect(jogador.apelido).toBe("Joao");
  });

  it("recusa dados inválidos e não grava nada", () => {
    expect(() => criarJogador(banco, { apelido: "" })).toThrow(ErroValidacao);
    expect(listarJogadores(banco, { incluirInativos: true })).toHaveLength(0);
  });

  it("recusa Riot ID repetido", () => {
    criarJogador(banco, { apelido: "A", riotId: "Exemplo1#BR1" });
    expect(() =>
      criarJogador(banco, { apelido: "B", riotId: "Exemplo1#BR1" }),
    ).toThrow(ErroValidacao);
  });

  it("recusa Riot ID repetido mesmo com maiúsculas diferentes", () => {
    criarJogador(banco, { apelido: "A", riotId: "Exemplo1#BR1" });
    expect(() =>
      criarJogador(banco, { apelido: "B", riotId: "exemplo1#br1" }),
    ).toThrow(ErroValidacao);
  });

  it("aceita vários jogadores sem Riot ID", () => {
    criarJogador(banco, { apelido: "A", riotId: "" });
    criarJogador(banco, { apelido: "B" });
    expect(listarJogadores(banco)).toHaveLength(2);
  });
});

describe("buscarJogadorPorId", () => {
  it("encontra um jogador existente", () => {
    const criado = criarJogador(banco, { apelido: "Joao" });
    expect(buscarJogadorPorId(banco, criado.id)?.apelido).toBe("Joao");
  });

  it("devolve null quando não existe", () => {
    expect(buscarJogadorPorId(banco, 999)).toBeNull();
  });
});

describe("editarJogador", () => {
  it("altera só o campo enviado e preserva os outros", () => {
    const criado = criarJogador(banco, {
      apelido: "Joao",
      eloAtual: "Ouro",
      posicaoPrincipal: "Mid",
    });
    const editado = editarJogador(banco, criado.id, { eloAtual: "Platina" });
    expect(editado.eloAtual).toBe("Platina");
    expect(editado.posicaoPrincipal).toBe("Mid");
    expect(editado.apelido).toBe("Joao");
  });

  it("recusa alteração incoerente com o dado já gravado", () => {
    const criado = criarJogador(banco, {
      apelido: "Joao",
      eloAtual: "Ouro",
      eloMaximo: "Ouro",
    });
    expect(() => editarJogador(banco, criado.id, { eloAtual: "Diamante" })).toThrow(
      ErroValidacao,
    );
  });

  it("recusa editar jogador que não existe", () => {
    expect(() => editarJogador(banco, 999, { apelido: "X" })).toThrow(ErroValidacao);
  });

  it("permite manter o próprio Riot ID", () => {
    const criado = criarJogador(banco, { apelido: "Joao", riotId: "Exemplo1#BR1" });
    expect(() =>
      editarJogador(banco, criado.id, { riotId: "Exemplo1#BR1" }),
    ).not.toThrow();
  });
});

describe("inativarJogador", () => {
  it("mantém o registro com status inativo", () => {
    const criado = criarJogador(banco, { apelido: "Joao" });
        inativarJogador(banco, criado.id, "Saiu do projeto");
    expect(buscarJogadorPorId(banco, criado.id)?.status).toBe("inativo");
  });

  it("some da listagem padrão e aparece com incluirInativos", () => {
    const criado = criarJogador(banco, { apelido: "Joao" });
        inativarJogador(banco, criado.id, "Saiu do projeto");
    expect(listarJogadores(banco)).toHaveLength(0);
    expect(listarJogadores(banco, { incluirInativos: true })).toHaveLength(1);
  });
});

describe("listarJogadores", () => {
  it("filtra por posição principal", () => {
    criarJogador(banco, { apelido: "Carla", posicaoPrincipal: "Support" });
    criarJogador(banco, { apelido: "Bruno", posicaoPrincipal: "Mid" });
    const resultado = listarJogadores(banco, { posicao: "Mid" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.apelido).toBe("Bruno");
  });

  it("busca por trecho do apelido", () => {
    criarJogador(banco, { apelido: "Carla" });
    criarJogador(banco, { apelido: "Bruno" });
    const resultado = listarJogadores(banco, { busca: "ru" });
    expect(resultado.map((j) => j.apelido)).toEqual(["Bruno"]);
  });

  it("ordena por apelido sem diferenciar maiúsculas", () => {
    criarJogador(banco, { apelido: "Carla" });
    criarJogador(banco, { apelido: "ana" });
    criarJogador(banco, { apelido: "Bruno" });
    const nomes = listarJogadores(banco).map((j) => j.apelido);
    expect(nomes).toEqual(["ana", "Bruno", "Carla"]);
  });
});