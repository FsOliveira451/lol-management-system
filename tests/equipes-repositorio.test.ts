import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import { criarJogador, editarJogador } from "../src/database/jogadores-repositorio";
import {
  adicionarMembro,
  criarEquipe,
  editarEquipe,
  encerrarParticipacao,
  listarEquipes,
  listarMembros,
  trocarFuncao,
} from "../src/database/equipes-repositorio";
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

// Ajudantes: devolvem so o id
function pessoa(apelido: string): number {
  return criarJogador(banco, { apelido }).id;
}
function equipe(nome: string): number {
  return criarEquipe(banco, { nome }).id;
}

describe("criarEquipe", () => {
  it("cria com valores padrão", () => {
    const criada = criarEquipe(banco, { nome: "Alpha" });
    expect(criada).toMatchObject({
      nome: "Alpha",
      tag: null,
      nivel: "principal",
      status: "em_formacao",
      objetivo: null,
    });
  });

  it("limpa espaços do nome e coloca a tag em maiúsculas", () => {
    const criada = criarEquipe(banco, { nome: "  Alpha  ", tag: "alp" });
    expect(criada.nome).toBe("Alpha");
    expect(criada.tag).toBe("ALP");
  });

  it("recusa dados inválidos e não grava nada", () => {
    expect(() => criarEquipe(banco, { nome: "" })).toThrow(ErroValidacao);
    expect(listarEquipes(banco, { incluirInativas: true })).toHaveLength(0);
  });

  it("recusa nome repetido, mesmo com maiúsculas diferentes", () => {
    criarEquipe(banco, { nome: "Alpha" });
    expect(() => criarEquipe(banco, { nome: "alpha" })).toThrow(ErroValidacao);
  });

  it("recusa tag repetida e aceita várias equipes sem tag", () => {
    criarEquipe(banco, { nome: "A1", tag: "ALP" });
    expect(() => criarEquipe(banco, { nome: "A2", tag: "alp" })).toThrow(ErroValidacao);
    criarEquipe(banco, { nome: "B1" });
    criarEquipe(banco, { nome: "B2" });
    expect(listarEquipes(banco)).toHaveLength(3);
  });
});

describe("editarEquipe", () => {
  it("altera só os campos enviados", () => {
    const criada = criarEquipe(banco, { nome: "Alpha", objetivo: "Subir de divisão" });
    const editada = editarEquipe(banco, criada.id, { nivel: "academia" });
    expect(editada.nivel).toBe("academia");
    expect(editada.nome).toBe("Alpha");
    expect(editada.objetivo).toBe("Subir de divisão");
  });

  it("permite manter o próprio nome", () => {
    const criada = criarEquipe(banco, { nome: "Alpha" });
    expect(() => editarEquipe(banco, criada.id, { nome: "Alpha" })).not.toThrow();
  });

  it("recusa renomear para o nome de outra equipe", () => {
    criarEquipe(banco, { nome: "Alpha" });
    const bravo = criarEquipe(banco, { nome: "Bravo" });
    expect(() => editarEquipe(banco, bravo.id, { nome: "alpha" })).toThrow(ErroValidacao);
  });

  it("recusa editar equipe que não existe", () => {
    expect(() => editarEquipe(banco, 999, { nome: "X" })).toThrow(ErroValidacao);
  });
});

describe("listarEquipes", () => {
  it("esconde as inativas, a menos que sejam pedidas", () => {
    const criada = criarEquipe(banco, { nome: "Alpha" });
    editarEquipe(banco, criada.id, { status: "inativa" });
    expect(listarEquipes(banco)).toHaveLength(0);
    expect(listarEquipes(banco, { incluirInativas: true })).toHaveLength(1);
  });

  it("busca por parte do nome ou da tag", () => {
    criarEquipe(banco, { nome: "Alpha", tag: "ALP" });
    criarEquipe(banco, { nome: "Bravo", tag: "BRV" });
    expect(listarEquipes(banco, { busca: "brv" }).map((e) => e.nome)).toEqual(["Bravo"]);
    expect(listarEquipes(banco, { busca: "alph" }).map((e) => e.nome)).toEqual(["Alpha"]);
  });
});

describe("adicionarMembro", () => {
  it("adiciona um titular e ele aparece no time de hoje", () => {
    const alpha = equipe("Alpha");
    const ana = pessoa("Ana");
    const participacao = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: ana,
      funcao: "titular",
      posicao: "Mid",
    });

    expect(participacao).toMatchObject({ funcao: "titular", posicao: "Mid", saiuEm: null });
    const membros = listarMembros(banco, alpha);
    expect(membros).toHaveLength(1);
    expect(membros[0]?.apelido).toBe("Ana");
  });

  it("aplica as regras: recusa dois titulares na mesma posição e não grava", () => {
    const alpha = equipe("Alpha");
    adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "titular",
      posicao: "Mid",
    });

    expect(() =>
      adicionarMembro(banco, {
        equipeId: alpha,
        jogadorId: pessoa("Bia"),
        funcao: "titular",
        posicao: "Mid",
      }),
    ).toThrow(ErroValidacao);
    expect(listarMembros(banco, alpha)).toHaveLength(1);
  });

  it("recusa jogador ou equipe que não existem", () => {
    const alpha = equipe("Alpha");
    expect(() =>
      adicionarMembro(banco, { equipeId: alpha, jogadorId: 999, funcao: "reserva" }),
    ).toThrow(ErroValidacao);
    expect(() =>
      adicionarMembro(banco, { equipeId: 999, jogadorId: pessoa("Ana"), funcao: "reserva" }),
    ).toThrow(ErroValidacao);
  });

  it("recusa pessoa inativa", () => {
    const alpha = equipe("Alpha");
    const ana = pessoa("Ana");
    editarJogador(banco, ana, { status: "inativo" }, { motivo: "Saiu do projeto" });
    expect(() =>
      adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "reserva" }),
    ).toThrow(ErroValidacao);
  });

  it("permite capitão que também joga, e lista o capitão primeiro", () => {
    const alpha = equipe("Alpha");
    const ana = pessoa("Ana");
    const bia = pessoa("Bia");
    adicionarMembro(banco, { equipeId: alpha, jogadorId: bia, funcao: "titular", posicao: "Top" });
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "capitao" });

    const resumo = listarMembros(banco, alpha).map((m) => `${m.apelido}:${m.funcao}`);
    expect(resumo).toEqual(["Ana:capitao", "Bia:titular", "Ana:titular"]);
  });

  it("o próprio banco barra o que as regras proíbem (cinto de segurança)", () => {
    const alpha = equipe("Alpha");
    const bravo = equipe("Bravo");
    const ana = pessoa("Ana");
    adicionarMembro(banco, { equipeId: alpha, jogadorId: ana, funcao: "titular", posicao: "Mid" });

    // Contorna o codigo e tenta gravar direto: segundo titular da mesma pessoa
    expect(() =>
      banco
        .prepare(
          "INSERT INTO participacoes_equipe (equipe_id, jogador_id, funcao, posicao) VALUES (?, ?, 'titular', 'Top')",
        )
        .run(bravo, ana),
    ).toThrow();
  });
});

describe("encerrarParticipacao", () => {
  it("exige o motivo da saída", () => {
    const alpha = equipe("Alpha");
    const participacao = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "reserva",
    });
    expect(() => encerrarParticipacao(banco, participacao.id, {})).toThrow(ErroValidacao);
    expect(() => encerrarParticipacao(banco, participacao.id, { motivo: "   " })).toThrow(
      ErroValidacao,
    );
  });

  it("tira a pessoa do time de hoje, mas mantém no histórico", () => {
    const alpha = equipe("Alpha");
    const participacao = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "reserva",
    });
    encerrarParticipacao(banco, participacao.id, { motivo: "Saiu do time" });

    expect(listarMembros(banco, alpha)).toHaveLength(0);
    const historico = listarMembros(banco, alpha, { incluirHistorico: true });
    expect(historico).toHaveLength(1);
    expect(historico[0]?.saiuEm).not.toBeNull();
    expect(historico[0]?.motivoSaida).toBe("Saiu do time");
  });

  it("não encerra duas vezes", () => {
    const alpha = equipe("Alpha");
    const participacao = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "reserva",
    });
    encerrarParticipacao(banco, participacao.id, { motivo: "Saiu" });
    expect(() => encerrarParticipacao(banco, participacao.id, { motivo: "De novo" })).toThrow(
      ErroValidacao,
    );
  });

  it("libera a posição para outro titular", () => {
    const alpha = equipe("Alpha");
    const ana = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "titular",
      posicao: "Mid",
    });
    encerrarParticipacao(banco, ana.id, { motivo: "Saiu" });

    expect(() =>
      adicionarMembro(banco, {
        equipeId: alpha,
        jogadorId: pessoa("Bia"),
        funcao: "titular",
        posicao: "Mid",
      }),
    ).not.toThrow();
  });
});

describe("trocarFuncao", () => {
  it("encerra a função antiga e abre a nova", () => {
    const alpha = equipe("Alpha");
    const reserva = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "reserva",
    });

    const nova = trocarFuncao(banco, reserva.id, "titular", "Mid", { motivo: "Promovida" });

    expect(nova).toMatchObject({ funcao: "titular", posicao: "Mid", saiuEm: null });
    const ativos = listarMembros(banco, alpha);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]?.funcao).toBe("titular");
    expect(listarMembros(banco, alpha, { incluirHistorico: true })).toHaveLength(2);
  });

  it("se a nova função for recusada, a antiga continua valendo (tudo ou nada)", () => {
    const alpha = equipe("Alpha");
    adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Bia"),
      funcao: "titular",
      posicao: "Mid",
    });
    const reservaAna = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "reserva",
    });

    // Mid ja tem titular: a troca deve falhar
    expect(() =>
      trocarFuncao(banco, reservaAna.id, "titular", "Mid", { motivo: "Tentativa" }),
    ).toThrow(ErroValidacao);

    const ana = listarMembros(banco, alpha).find((m) => m.apelido === "Ana");
    expect(ana?.funcao).toBe("reserva");
    expect(listarMembros(banco, alpha, { incluirHistorico: true })).toHaveLength(2);
  });

  it("exige o motivo da mudança", () => {
    const alpha = equipe("Alpha");
    const reserva = adicionarMembro(banco, {
      equipeId: alpha,
      jogadorId: pessoa("Ana"),
      funcao: "reserva",
    });
    expect(() => trocarFuncao(banco, reserva.id, "academia", null)).toThrow(ErroValidacao);
  });
});