import { describe, it, expect } from "vitest";
import {
  agoraLocal,
  dataHoraValida,
  emMinutos,
  fimDoEvento,
  situacaoDoEvento,
} from "../src/core/eventos/tempo";
import { encontrarConflitos, type EventoParaConflito } from "../src/core/eventos/conflitos";
import type { StatusEvento } from "../src/core/eventos/tipos";

describe("dataHoraValida", () => {
  it("aceita uma data e um horário normais", () => {
    expect(dataHoraValida("2026-10-20 19:30")).toBe(true);
  });

  it.each([
    "2026-13-01 10:00", // mes 13
    "2026-02-30 10:00", // 30 de fevereiro
    "2026-10-20 25:00", // 25 horas
    "2026-10-20", // sem horario
    "20/10/2026 19:30", // outro formato
    "2026-10-20T19:30", // com "T"
  ])("recusa %s", (valor) => {
    expect(dataHoraValida(valor)).toBe(false);
  });
});

describe("cálculos de horário", () => {
  it("emMinutos: uma hora de diferença são 60 minutos", () => {
    expect(emMinutos("2026-10-20 20:30") - emMinutos("2026-10-20 19:30")).toBe(60);
  });

  it("fimDoEvento: passa da meia-noite para o dia seguinte", () => {
    expect(fimDoEvento("2026-10-20 23:30", 90)).toBe("2026-10-21 01:00");
  });

  it("agoraLocal: formata o relógio local", () => {
    expect(agoraLocal(new Date(2026, 9, 20, 7, 5))).toBe("2026-10-20 07:05");
  });
});

describe("situacaoDoEvento", () => {
  const agendado = { status: "agendado" as StatusEvento, inicio: "2026-10-20 19:00", duracaoMin: 120 };

  it("antes do início: agendado", () => {
    expect(situacaoDoEvento(agendado, "2026-10-20 18:59")).toBe("agendado");
  });

  it("durante: em andamento", () => {
    expect(situacaoDoEvento(agendado, "2026-10-20 20:00")).toBe("em_andamento");
  });

  it("depois do fim, sem registro: pendente de registro", () => {
    expect(situacaoDoEvento(agendado, "2026-10-20 21:00")).toBe("pendente_registro");
  });

  it("realizado e cancelado não dependem do relógio", () => {
    expect(situacaoDoEvento({ ...agendado, status: "realizado" }, "2026-10-20 18:00")).toBe(
      "realizado",
    );
    expect(situacaoDoEvento({ ...agendado, status: "cancelado" }, "2026-10-21 18:00")).toBe(
      "cancelado",
    );
  });
});

describe("encontrarConflitos", () => {
  function evento(
    id: number,
    inicio: string,
    duracaoMin: number,
    equipeIds: number[],
    status: StatusEvento = "agendado",
  ): EventoParaConflito {
    return { id, tipo: "treino", titulo: null, inicio, duracaoMin, status, equipeIds };
  }

  // O evento novo: 19:00 as 21:00, equipe 1
  const novo = { inicio: "2026-10-20 19:00", duracaoMin: 120, equipeIds: [1] };

  it("a mesma equipe com horários que se sobrepõem é um conflito", () => {
    const conflitos = encontrarConflitos(novo, [evento(5, "2026-10-20 18:00", 120, [1])]);
    expect(conflitos.map((e) => e.id)).toEqual([5]);
  });

  it("equipes diferentes não conflitam", () => {
    expect(encontrarConflitos(novo, [evento(5, "2026-10-20 19:30", 60, [2])])).toEqual([]);
  });

  it("eventos que apenas encostam não conflitam", () => {
    const antes = evento(5, "2026-10-20 17:00", 120, [1]); // termina as 19:00
    const depois = evento(6, "2026-10-20 21:00", 60, [1]); // comeca as 21:00
    expect(encontrarConflitos(novo, [antes, depois])).toEqual([]);
  });

  it("eventos cancelados não contam", () => {
    const cancelado = evento(5, "2026-10-20 19:00", 120, [1], "cancelado");
    expect(encontrarConflitos(novo, [cancelado])).toEqual([]);
  });

  it("ao editar, o próprio evento não conflita consigo mesmo", () => {
    const proprio = evento(5, "2026-10-20 19:00", 120, [1]);
    expect(encontrarConflitos(novo, [proprio], 5)).toEqual([]);
  });
});