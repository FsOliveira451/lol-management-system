import { describe, it, expect } from "vitest";
import type { Posicao } from "../src/core/jogadores/tipos";
import type { FuncaoEquipe, ParticipacaoAtiva } from "../src/core/equipes/tipos";
import { avaliarEquipe } from "../src/core/equipes/alertas";

// ---------- ajudantes ----------

function titular(jogadorId: number, posicao: Posicao): ParticipacaoAtiva {
  return { equipeId: 1, jogadorId, funcao: "titular", posicao };
}

function outro(jogadorId: number, funcao: FuncaoEquipe): ParticipacaoAtiva {
  return { equipeId: 1, jogadorId, funcao, posicao: null };
}

const CINCO_TITULARES = [
  titular(1, "Top"),
  titular(2, "Jungle"),
  titular(3, "Mid"),
  titular(4, "ADC"),
  titular(5, "Support"),
];

describe("avaliarEquipe", () => {
  it("equipe inativa não gera alertas", () => {
    expect(avaliarEquipe("inativa", [])).toEqual([]);
  });

  it("equipe ativa vazia tem um alerta crítico por posição, e eles vêm primeiro", () => {
    const alertas = avaliarEquipe("ativa", []);
    expect(alertas.filter((a) => a.nivel === "critico")).toHaveLength(5);
    expect(alertas.map((a) => a.codigo)).toContain("sem_titular:Support");
    expect(alertas[0]?.nivel).toBe("critico");
  });

  it("equipe em formação vazia não tem alerta crítico", () => {
    const alertas = avaliarEquipe("em_formacao", []);
    expect(alertas.some((a) => a.nivel === "critico")).toBe(false);
    expect(alertas.filter((a) => a.codigo.startsWith("sem_titular"))).toHaveLength(5);
  });

  it("falta só o Support: um único alerta crítico, citando a posição", () => {
    const alertas = avaliarEquipe("ativa", [
      ...CINCO_TITULARES.slice(0, 4),
      outro(6, "capitao"),
      outro(7, "coach"),
      outro(8, "reserva"),
    ]);
    const criticos = alertas.filter((a) => a.nivel === "critico");
    expect(criticos).toHaveLength(1);
    expect(criticos[0]?.mensagem).toContain("Support");
  });

  it("equipe ativa completa sem capitão: atenção, e nenhum crítico", () => {
    const alertas = avaliarEquipe("ativa", [
      ...CINCO_TITULARES,
      outro(7, "coach"),
      outro(8, "reserva"),
    ]);
    expect(alertas.some((a) => a.nivel === "critico")).toBe(false);
    expect(alertas.find((a) => a.codigo === "sem_capitao")?.nivel).toBe("atencao");
  });

  it("escalação completa, com capitão e coach, mas sem reserva: só a observação", () => {
    const alertas = avaliarEquipe("ativa", [
      ...CINCO_TITULARES,
      outro(6, "capitao"),
      outro(7, "coach"),
    ]);
    expect(alertas.map((a) => a.codigo)).toEqual(["sem_reserva"]);
  });

  it("tudo em ordem gera um único alerta normal", () => {
    const alertas = avaliarEquipe("ativa", [
      ...CINCO_TITULARES,
      outro(6, "capitao"),
      outro(7, "coach"),
      outro(8, "reserva"),
    ]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.nivel).toBe("normal");
  });
});