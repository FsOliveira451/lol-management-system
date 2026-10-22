import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FuncaoEquipe } from "../src/core/equipes/tipos";
import type { DadosEvento } from "../src/core/eventos/tipos";
import type { Posicao } from "../src/core/jogadores/tipos";
import { adicionarMembro, criarEquipe } from "../src/database/equipes-repositorio";
import { criarTabelas } from "../src/database/esquema";
import { cancelarEvento } from "../src/database/eventos-repositorio";
import { criarJogador } from "../src/database/jogadores-repositorio";
import {
  adicionarConvocado,
  convocarAutomaticamente,
  criarEventoComConvocacao,
  definirEstado,
  listarConflitosDePessoas,
  listarConvocados,
  removerConvocado,
  resumirPresencaDaPessoa,
} from "../src/database/presenca-repositorio";

let banco: Database.Database;

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);
});

afterEach(() => {
  banco.close();
});

function novaPessoa(apelido: string): number {
  return criarJogador(banco, { apelido }).id;
}

function novaEquipe(nome: string): number {
  return criarEquipe(banco, { nome, status: "ativa" }).id;
}

function titular(equipeId: number, jogadorId: number, posicao: Posicao): void {
  adicionarMembro(banco, { equipeId, jogadorId, funcao: "titular", posicao });
}

function papel(equipeId: number, jogadorId: number, funcao: FuncaoEquipe): void {
  adicionarMembro(banco, { equipeId, jogadorId, funcao });
}

function novoEvento(dados: DadosEvento) {
  return criarEventoComConvocacao(banco, { tipo: "treino", inicio: "2026-10-20 19:00", ...dados });
}

describe("convocacao automatica", () => {
  it("ao criar o evento, convoca titular, reserva e coach da equipe", () => {
    const a = novaEquipe("Alfa");
    titular(a, novaPessoa("Ana"), "Top");
    papel(a, novaPessoa("Bia"), "reserva");
    papel(a, novaPessoa("Caio"), "coach");

    const evento = novoEvento({ equipeIds: [a] });
    const convocados = listarConvocados(banco, evento.id);

    expect(convocados).toHaveLength(3);
    expect(convocados.every((c) => c.estado === "convocado")).toBe(true);
    expect(convocados.map((c) => c.funcao).sort()).toEqual(["coach", "reserva", "titular"]);
    expect(convocados.every((c) => c.equipeNome === "Alfa")).toBe(true);
  });

  it("reuniao geral (sem equipes) nao convoca ninguem", () => {
    novaPessoa("Ana");
    const evento = novoEvento({ tipo: "reuniao", equipeIds: [] });
    expect(listarConvocados(banco, evento.id)).toEqual([]);
  });

  it("confronto interno: reserva nas duas fica de fora, com nome e motivo", () => {
    const a = novaEquipe("Alfa");
    const b = novaEquipe("Beta");
    const dupla = novaPessoa("Reserva Dupla");
    papel(a, dupla, "reserva");
    papel(b, dupla, "reserva");
    titular(a, novaPessoa("Ana"), "Top");

    const evento = novoEvento({ tipo: "scrim", equipeIds: [a, b] });
    expect(listarConvocados(banco, evento.id).map((c) => c.apelido)).toEqual(["Ana"]);

    const resultado = convocarAutomaticamente(banco, evento.id);
    expect(resultado.adicionados).toBe(0);
    expect(resultado.excluidos).toHaveLength(1);
    expect(resultado.excluidos[0]!.apelido).toBe("Reserva Dupla");
    expect(resultado.excluidos[0]!.motivo).toContain("não é titular");
  });

  it("repetir a convocacao nao duplica ninguem", () => {
    const a = novaEquipe("Alfa");
    titular(a, novaPessoa("Ana"), "Top");
    const evento = novoEvento({ equipeIds: [a] });

    expect(convocarAutomaticamente(banco, evento.id).adicionados).toBe(0);
    expect(listarConvocados(banco, evento.id)).toHaveLength(1);
  });

  it("quem entra na equipe depois e adicionado ao convocar de novo", () => {
    const a = novaEquipe("Alfa");
    titular(a, novaPessoa("Ana"), "Top");
    const evento = novoEvento({ equipeIds: [a] });

    papel(a, novaPessoa("Bia"), "reserva");
    expect(convocarAutomaticamente(banco, evento.id).adicionados).toBe(1);
    expect(listarConvocados(banco, evento.id)).toHaveLength(2);
  });

  it("evento recusado (conflito de equipe) nao deixa convocacoes soltas", () => {
    const a = novaEquipe("Alfa");
    titular(a, novaPessoa("Ana"), "Top");
    novoEvento({ equipeIds: [a] });

    expect(() => novoEvento({ equipeIds: [a] })).toThrow(/Conflito de horário/);
    const total = banco.prepare("SELECT COUNT(*) AS n FROM eventos_participantes").get() as { n: number };
    expect(total.n).toBe(1);
  });
});

describe("convocacao manual", () => {
  it("pessoa fora das equipes do evento entra como convocacao avulsa", () => {
    const a = novaEquipe("Alfa");
    const evento = novoEvento({ equipeIds: [a] });
    const visitante = novaPessoa("Visitante");

    const convocacao = adicionarConvocado(banco, evento.id, visitante);
    expect(convocacao.equipeId).toBeNull();
    expect(convocacao.funcao).toBeNull();
    expect(convocacao.papel).toBe("jogador");
  });

  it("nao convoca a mesma pessoa duas vezes", () => {
    const evento = novoEvento({ equipeIds: [novaEquipe("Alfa")] });
    const pessoa = novaPessoa("Visitante");
    adicionarConvocado(banco, evento.id, pessoa);
    expect(() => adicionarConvocado(banco, evento.id, pessoa)).toThrow(/já está convocada/);
  });

  it("pessoa inativa nao pode ser convocada", () => {
    const evento = novoEvento({ equipeIds: [novaEquipe("Alfa")] });
    const pessoa = novaPessoa("Fantasma");
    banco.prepare("UPDATE jogadores SET status = 'inativo' WHERE id = ?").run(pessoa);
    expect(() => adicionarConvocado(banco, evento.id, pessoa)).toThrow(/inativa/);
  });

  it("confronto interno: quem a regra exclui nao pode ser adicionado a mao", () => {
    const a = novaEquipe("Alfa");
    const b = novaEquipe("Beta");
    const dupla = novaPessoa("Reserva Dupla");
    papel(a, dupla, "reserva");
    papel(b, dupla, "reserva");
    const evento = novoEvento({ tipo: "scrim", equipeIds: [a, b] });

    expect(() => adicionarConvocado(banco, evento.id, dupla)).toThrow(/não é titular/);
  });

  it("remove quem ainda nao tem presenca registrada, mas nao quem ja tem", () => {
    const a = novaEquipe("Alfa");
    const ana = novaPessoa("Ana");
    const bia = novaPessoa("Bia");
    titular(a, ana, "Top");
    papel(a, bia, "reserva");
    const evento = novoEvento({ equipeIds: [a] });

    expect(removerConvocado(banco, evento.id, bia).apelido).toBe("Bia");
    expect(listarConvocados(banco, evento.id)).toHaveLength(1);

    definirEstado(banco, evento.id, ana, "presente", "2026-10-20 20:00");
    expect(() => removerConvocado(banco, evento.id, ana)).toThrow(/presença registrada/);
  });
});

describe("estados de presenca", () => {
  function cenario() {
    const a = novaEquipe("Alfa");
    const ana = novaPessoa("Ana");
    titular(a, ana, "Top");
    return { ana, evento: novoEvento({ equipeIds: [a] }) };
  }

  it("antes do inicio aceita confirmado", () => {
    const { ana, evento } = cenario();
    const resultado = definirEstado(banco, evento.id, ana, "confirmado", "2026-10-20 10:00");
    expect(resultado.estado).toBe("confirmado");
  });

  it("antes do inicio recusa presente", () => {
    const { ana, evento } = cenario();
    expect(() => definirEstado(banco, evento.id, ana, "presente", "2026-10-20 10:00")).toThrow(
      /depois que o evento começar/,
    );
    expect(listarConvocados(banco, evento.id)[0]!.estado).toBe("convocado");
  });

  it("depois do inicio aceita presente", () => {
    const { ana, evento } = cenario();
    const resultado = definirEstado(banco, evento.id, ana, "presente", "2026-10-20 20:00");
    expect(resultado.estado).toBe("presente");
  });

  it("recusa quem nao esta convocado", () => {
    const { evento } = cenario();
    const outra = novaPessoa("Outra");
    expect(() => definirEstado(banco, evento.id, outra, "confirmado", "2026-10-20 10:00")).toThrow(
      /não está convocada/,
    );
  });

  it("evento cancelado nao aceita presenca nem novas convocacoes", () => {
    const { ana, evento } = cenario();
    cancelarEvento(banco, evento.id, { motivo: "Chuva" });

    expect(() => definirEstado(banco, evento.id, ana, "confirmado", "2026-10-20 10:00")).toThrow(
      /cancelado/,
    );
    expect(() => adicionarConvocado(banco, evento.id, novaPessoa("Nova"))).toThrow(/cancelado/);
  });
});

describe("presenca calculada de uma pessoa", () => {
  function cincoEventos(equipeId: number): number[] {
    return [1, 2, 3, 4, 5].map(
      (dia) => novoEvento({ equipeIds: [equipeId], inicio: `2026-10-0${dia} 19:00` }).id,
    );
  }

  it("com menos de 5 registros: dados insuficientes (percentual null)", () => {
    const a = novaEquipe("Alfa");
    const ana = novaPessoa("Ana");
    titular(a, ana, "Top");
    for (const id of cincoEventos(a).slice(0, 4)) {
      definirEstado(banco, id, ana, "presente", "2026-10-20 12:00");
    }

    const resultado = resumirPresencaDaPessoa(banco, ana);
    expect(resultado.resumo.registrados).toBe(4);
    expect(resultado.resumo.percentual).toBeNull();
    expect(resultado.alerta).toBeNull();
  });

  it("com 5 presencas: 100% e alerta normal", () => {
    const a = novaEquipe("Alfa");
    const ana = novaPessoa("Ana");
    titular(a, ana, "Top");
    for (const id of cincoEventos(a)) {
      definirEstado(banco, id, ana, "presente", "2026-10-20 12:00");
    }

    const resultado = resumirPresencaDaPessoa(banco, ana);
    expect(resultado.resumo.percentual).toBe(100);
    expect(resultado.alerta?.nivel).toBe("normal");
    expect(resultado.tendencia).toBeNull();
    expect(resultado.registros).toHaveLength(5);
  });

  it("eventos cancelados nao entram na conta", () => {
    const a = novaEquipe("Alfa");
    const ana = novaPessoa("Ana");
    titular(a, ana, "Top");
    const ids = cincoEventos(a);
    for (const id of ids) {
      definirEstado(banco, id, ana, "presente", "2026-10-20 12:00");
    }
    cancelarEvento(banco, ids[4]!, { motivo: "Cancelado" });

    const resultado = resumirPresencaDaPessoa(banco, ana);
    expect(resultado.resumo.registrados).toBe(4);
    expect(resultado.resumo.percentual).toBeNull();
    expect(resultado.registros).toHaveLength(4);
  });
});

describe("conflito por pessoa", () => {
  function cenario() {
    const a = novaEquipe("Alfa");
    const b = novaEquipe("Beta");
    const ana = novaPessoa("Ana");
    titular(a, ana, "Top");
    papel(b, ana, "reserva");
    const evento = novoEvento({ equipeIds: [a], inicio: "2026-10-20 19:00" });
    return { b, ana, evento };
  }

  it("avisa quando a mesma pessoa, em outra equipe, cai no mesmo horario", () => {
    const { b, ana, evento } = cenario();
    const conflitos = listarConflitosDePessoas(banco, {
      tipo: "treino",
      inicio: "2026-10-20 19:30",
      duracaoMin: 60,
      equipeIds: [b],
    });

    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]!.jogadorId).toBe(ana);
    expect(conflitos[0]!.apelido).toBe("Ana");
    expect(conflitos[0]!.eventos[0]!.eventoId).toBe(evento.id);
  });

  it("nao avisa se o outro evento e o proprio (ignorado) ou se nao ha sobreposicao", () => {
    const { b, evento } = cenario();

    expect(
      listarConflitosDePessoas(banco, {
        tipo: "treino",
        inicio: "2026-10-20 19:30",
        duracaoMin: 60,
        equipeIds: [b],
        ignorarEventoId: evento.id,
      }),
    ).toEqual([]);

    expect(
      listarConflitosDePessoas(banco, {
        tipo: "treino",
        inicio: "2026-10-20 21:00",
        duracaoMin: 60,
        equipeIds: [b],
      }),
    ).toEqual([]);
  });
});