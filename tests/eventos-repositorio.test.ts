import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { criarTabelas } from "../src/database/esquema";
import { criarEquipe, editarEquipe } from "../src/database/equipes-repositorio";
import {
  buscarEventoPorId,
  cancelarEvento,
  criarEvento,
  editarEvento,
  listarConflitos,
  listarEventos,
  listarHistoricoDoEvento,
  marcarComoRealizado,
} from "../src/database/eventos-repositorio";
import type { DadosEvento } from "../src/core/eventos/tipos";
import { ErroValidacao } from "../src/core/erros";

let banco: Database.Database;
let alpha: number;
let bravo: number;

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);
  alpha = criarEquipe(banco, { nome: "Alpha" }).id;
  bravo = criarEquipe(banco, { nome: "Bravo" }).id;
});

afterEach(() => {
  banco.close();
});

// Um treino valido da Alpha; cada teste muda so o que importa
function treino(extra: DadosEvento = {}): DadosEvento {
  return { tipo: "treino", inicio: "2026-10-20 19:00", equipeIds: [alpha], ...extra };
}

// Quantas linhas o banco ja alterou desde que foi aberto
function totalDeAlteracoes(): number {
  const linha = banco.prepare("SELECT total_changes() AS n").get() as { n: number };
  return linha.n;
}

describe("criarEvento", () => {
  it("cria com a duração padrão do tipo e guarda as equipes", () => {
    const evento = criarEvento(banco, treino());
    expect(evento).toMatchObject({ tipo: "treino", duracaoMin: 120, status: "agendado" });
    expect(evento.equipes).toEqual([{ id: alpha, nome: "Alpha" }]);
  });

  it("recusa dados inválidos e não grava nada", () => {
    expect(() => criarEvento(banco, treino({ tipo: undefined }))).toThrow(ErroValidacao);
    expect(listarEventos(banco, { incluirCancelados: true })).toHaveLength(0);
  });

  it("recusa equipe que não existe", () => {
    expect(() => criarEvento(banco, treino({ equipeIds: [999] }))).toThrow(ErroValidacao);
  });

  it("recusa equipe inativa", () => {
    editarEquipe(banco, bravo, { status: "inativa" });
    expect(() => criarEvento(banco, treino({ equipeIds: [bravo] }))).toThrow(/inativa/);
  });

  it("avisa o conflito de horário da mesma equipe, e aceita se for confirmado", () => {
    criarEvento(banco, treino());
    const sobreposto = treino({ inicio: "2026-10-20 20:00" });

    expect(() => criarEvento(banco, sobreposto)).toThrow(/Conflito de horário/);
    expect(() => criarEvento(banco, sobreposto, { ignorarConflitos: true })).not.toThrow();
  });

  it("equipes diferentes podem ter eventos no mesmo horário", () => {
    criarEvento(banco, treino());
    expect(() => criarEvento(banco, treino({ equipeIds: [bravo] }))).not.toThrow();
  });

  it("scrim contra adversário externo guarda os detalhes (com texto limpo)", () => {
    const evento = criarEvento(banco, {
      tipo: "scrim",
      inicio: "2026-10-20 19:00",
      equipeIds: [alpha],
      adversario: "  Time Rival  ",
      nivelAdversario: "superior",
      partidasPrevistas: 3,
    });
    expect(evento).toMatchObject({
      adversario: "Time Rival",
      nivelAdversario: "superior",
      partidasPrevistas: 3,
    });
  });

  it("confronto interno guarda as duas equipes", () => {
    const evento = criarEvento(banco, {
      tipo: "scrim",
      inicio: "2026-10-20 19:00",
      equipeIds: [alpha, bravo],
    });
    expect(evento.equipes.map((e) => e.nome)).toEqual(["Alpha", "Bravo"]);
  });
});

describe("buscar e listar", () => {
  it("devolve null para um evento que não existe", () => {
    expect(buscarEventoPorId(banco, 999)).toBeNull();
  });

  it("filtra por período e ordena pelo horário", () => {
    criarEvento(banco, treino({ inicio: "2026-10-19 19:00" }));
    criarEvento(banco, treino({ inicio: "2026-10-20 19:00" }));
    criarEvento(banco, treino({ inicio: "2026-10-20 10:00" }));
    criarEvento(banco, treino({ inicio: "2026-10-25 19:00" }));

    const lista = listarEventos(banco, { de: "2026-10-20", ate: "2026-10-24" });
    expect(lista.map((e) => e.inicio)).toEqual(["2026-10-20 10:00", "2026-10-20 19:00"]);
  });

  it("filtra por equipe e por tipo", () => {
    criarEvento(banco, treino());
    criarEvento(banco, { tipo: "vod", inicio: "2026-10-21 19:00", equipeIds: [bravo] });

    expect(listarEventos(banco, { equipeId: bravo }).map((e) => e.tipo)).toEqual(["vod"]);
    expect(listarEventos(banco, { tipo: "treino" })).toHaveLength(1);
  });

  it("esconde os cancelados, a menos que sejam pedidos", () => {
    const evento = criarEvento(banco, treino());
    cancelarEvento(banco, evento.id, { motivo: "Sem jogadores" });

    expect(listarEventos(banco)).toHaveLength(0);
    expect(listarEventos(banco, { incluirCancelados: true })).toHaveLength(1);
  });

  it("listarConflitos devolve lista vazia quando os dados estão incompletos", () => {
    expect(listarConflitos(banco, { inicio: "", duracaoMin: 0, equipeIds: [] })).toEqual([]);
  });
});

describe("editarEvento", () => {
  it("altera só o campo enviado e preserva os outros", () => {
    const evento = criarEvento(banco, treino({ objetivo: "Macro" }));
    const editado = editarEvento(banco, evento.id, { local: "Discord" });

    expect(editado.local).toBe("Discord");
    expect(editado.objetivo).toBe("Macro");
    expect(editado.inicio).toBe("2026-10-20 19:00");
  });

  it("salvar sem mudar nada não grava nada no banco", () => {
    const evento = criarEvento(banco, treino());
    const antes = totalDeAlteracoes();

    editarEvento(banco, evento.id, { tipo: evento.tipo, inicio: evento.inicio });

    expect(totalDeAlteracoes()).toBe(antes);
  });

  it("remarcar exige o motivo e registra no histórico", () => {
    const evento = criarEvento(banco, treino());
    const novoHorario = { inicio: "2026-10-21 19:00" };

    expect(() => editarEvento(banco, evento.id, novoHorario)).toThrow(ErroValidacao);

    editarEvento(banco, evento.id, novoHorario, { motivo: "Adversário pediu adiamento" });
    const registro = listarHistoricoDoEvento(banco, evento.id).find((h) => h.campo === "inicio");
    expect(registro).toMatchObject({
      valorAnterior: "2026-10-20 19:00",
      valorNovo: "2026-10-21 19:00",
      motivo: "Adversário pediu adiamento",
    });
  });

  it("remarcar para um horário em conflito é recusado, a menos que seja confirmado", () => {
    criarEvento(banco, treino({ inicio: "2026-10-20 19:00" }));
    const outro = criarEvento(banco, treino({ inicio: "2026-10-21 19:00" }));
    const remarcar = { inicio: "2026-10-20 20:00" };

    expect(() => editarEvento(banco, outro.id, remarcar, { motivo: "Ajuste" })).toThrow(
      /Conflito de horário/,
    );
    expect(() =>
      editarEvento(banco, outro.id, remarcar, { motivo: "Ajuste", ignorarConflitos: true }),
    ).not.toThrow();
  });

  it("aumentar a duração não gera conflito do evento consigo mesmo", () => {
    const evento = criarEvento(banco, treino());
    const editado = editarEvento(banco, evento.id, { duracaoMin: 150 });
    expect(editado.duracaoMin).toBe(150);
  });

  it("trocar as equipes fica registrado no histórico", () => {
    const evento = criarEvento(banco, treino());
    const editado = editarEvento(banco, evento.id, { equipeIds: [alpha, bravo] });

    expect(editado.equipes).toHaveLength(2);
    const registro = listarHistoricoDoEvento(banco, evento.id).find((h) => h.campo === "equipes");
    expect(registro).toMatchObject({ valorAnterior: "Alpha", valorNovo: "Alpha, Bravo" });
  });

  it("recusa uma mudança de tipo incompatível com as equipes", () => {
    const evento = criarEvento(banco, treino({ equipeIds: [alpha, bravo] }));
    expect(() => editarEvento(banco, evento.id, { tipo: "vod" })).toThrow(ErroValidacao);
  });

  it("evento realizado trava a data, mas aceita editar observações", () => {
    const evento = criarEvento(banco, treino({ inicio: "2026-10-01 19:00" }));
    marcarComoRealizado(banco, evento.id, "2026-10-02 10:00");

    expect(() =>
      editarEvento(banco, evento.id, { inicio: "2026-10-05 19:00" }, { motivo: "x" }),
    ).toThrow(ErroValidacao);
    expect(editarEvento(banco, evento.id, { observacoes: "Boa sessão" }).observacoes).toBe(
      "Boa sessão",
    );
  });

  it("evento cancelado não pode ser editado", () => {
    const evento = criarEvento(banco, treino());
    cancelarEvento(banco, evento.id, { motivo: "Sem jogadores" });
    expect(() => editarEvento(banco, evento.id, { objetivo: "x" })).toThrow(ErroValidacao);
  });
});

describe("cancelar e marcar como realizado", () => {
  it("cancelar exige o motivo e libera o horário", () => {
    const evento = criarEvento(banco, treino());
    expect(() => cancelarEvento(banco, evento.id, {})).toThrow(ErroValidacao);

    cancelarEvento(banco, evento.id, { motivo: "Sem jogadores" });
    expect(() => criarEvento(banco, treino())).not.toThrow();
  });

  it("não cancela evento realizado, nem cancela duas vezes", () => {
    const realizado = criarEvento(banco, treino({ inicio: "2026-10-01 19:00" }));
    marcarComoRealizado(banco, realizado.id, "2026-10-02 10:00");
    expect(() => cancelarEvento(banco, realizado.id, { motivo: "x" })).toThrow(ErroValidacao);

    const outro = criarEvento(banco, treino({ inicio: "2026-10-22 19:00" }));
    cancelarEvento(banco, outro.id, { motivo: "x" });
    expect(() => cancelarEvento(banco, outro.id, { motivo: "x" })).toThrow(ErroValidacao);
  });

  it("só marca como realizado depois do início, e só uma vez", () => {
    const evento = criarEvento(banco, treino());

    expect(() => marcarComoRealizado(banco, evento.id, "2026-10-20 18:59")).toThrow(
      /ainda não começou/,
    );

    const realizado = marcarComoRealizado(banco, evento.id, "2026-10-20 19:00");
    expect(realizado.status).toBe("realizado");
    expect(() => marcarComoRealizado(banco, evento.id, "2026-10-20 20:00")).toThrow(
      ErroValidacao,
    );
  });
});