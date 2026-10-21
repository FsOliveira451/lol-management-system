import { describe, expect, it } from "vitest";
import {
  descreverQuando,
  formatarInicio,
  rotuloDoEvento,
} from "../src/core/eventos/rotulos";
import type { Evento } from "../src/core/eventos/tipos";

type Base = Pick<Evento, "tipo" | "titulo" | "adversario" | "equipes">;

function base(extra: Partial<Base> = {}): Base {
  return { tipo: "scrim", titulo: null, adversario: null, equipes: [], ...extra };
}

const alfa = { id: 1, nome: "Alfa" };
const beta = { id: 2, nome: "Beta" };

describe("rotuloDoEvento", () => {
  it("usa o titulo quando existe", () => {
    expect(rotuloDoEvento(base({ titulo: "Treino de macro" }))).toBe("Treino de macro");
  });

  it("ignora titulo feito so de espacos", () => {
    expect(rotuloDoEvento(base({ titulo: "   ", equipes: [alfa] }))).toBe("Scrim · Alfa");
  });

  it("mostra 'Tipo vs Adversario' quando ha adversario externo", () => {
    expect(rotuloDoEvento(base({ adversario: "Time X", equipes: [alfa] }))).toBe("Scrim vs Time X");
  });

  it("mostra as duas equipes no confronto interno", () => {
    expect(rotuloDoEvento(base({ equipes: [alfa, beta] }))).toBe("Scrim: Alfa × Beta");
  });

  it("mostra 'Tipo · Equipe' com uma equipe so", () => {
    expect(rotuloDoEvento(base({ tipo: "treino", equipes: [alfa] }))).toBe("Treino · Alfa");
  });

  it("mostra '(geral)' quando nao ha equipe nem adversario", () => {
    expect(rotuloDoEvento(base({ tipo: "reuniao" }))).toBe("Reunião (geral)");
  });
});

describe("formatarInicio e descreverQuando", () => {
  it("formata dia/mes/ano e hora", () => {
    expect(formatarInicio("2026-10-20 19:00")).toBe("20/10/2026, 19:00");
  });

  it("descreve o intervalo no mesmo dia", () => {
    expect(descreverQuando("2026-10-20 19:00", 120)).toBe("20/10/2026, 19:00 às 21:00");
  });

  it("avisa quando termina no dia seguinte", () => {
    expect(descreverQuando("2026-10-20 23:00", 120)).toBe(
      "20/10/2026, 23:00 às 01:00 (dia seguinte)",
    );
  });
});