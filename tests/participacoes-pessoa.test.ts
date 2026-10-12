import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import { criarJogador } from "../src/database/jogadores-repositorio";
import {
  adicionarMembro,
  criarEquipe,
  encerrarParticipacao,
  listarParticipacoesAtivasDaPessoa,
} from "../src/database/equipes-repositorio";

let banco: Database.Database;

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);
});

afterEach(() => {
  banco.close();
});

describe("listarParticipacoesAtivasDaPessoa", () => {
  it("lista só as participações ativas, com o nome da equipe", () => {
    const alpha = criarEquipe(banco, { nome: "Alpha" }).id;
    const bravo = criarEquipe(banco, { nome: "Bravo" }).id;
    const ana = criarJogador(banco, { apelido: "Ana" }).id;

    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
    const reserva = adicionarMembro(banco, { equipeId: bravo, jogadorId: ana, funcao: "reserva" });
    encerrarParticipacao(banco, reserva.id, { motivo: "Saiu" });

    const lista = listarParticipacoesAtivasDaPessoa(banco, ana);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ equipeNome: "Alpha", funcao: "titular", posicao: "Mid" });
  });

  it("devolve lista vazia para quem não está em nenhuma equipe", () => {
    const ana = criarJogador(banco, { apelido: "Ana" }).id;
    expect(listarParticipacoesAtivasDaPessoa(banco, ana)).toEqual([]);
  });
});