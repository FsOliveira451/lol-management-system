import { describe, expect, it } from "vitest";
import type { FuncaoEquipe, ParticipacaoAtiva } from "../src/core/equipes/tipos";
import { sugerirConvocacao } from "../src/core/presenca/convocacao";

function p(equipeId: number, jogadorId: number, funcao: FuncaoEquipe): ParticipacaoAtiva {
  return { equipeId, jogadorId, funcao, posicao: null };
}

describe("sugerirConvocacao: uma equipe", () => {
  it("convoca cada pessoa uma vez, com a funcao principal", () => {
    const { convocados } = sugerirConvocacao("treino", [1], [
      p(1, 10, "titular"),
      p(1, 11, "reserva"),
      p(1, 12, "capitao"),
      p(1, 12, "titular"),
    ]);
    expect(convocados.map((c) => [c.jogadorId, c.funcao, c.papel])).toEqual([
      [10, "titular", "jogador"],
      [12, "titular", "jogador"],
      [11, "reserva", "jogador"],
    ]);
  });

  it("quem so tem funcao de staff entra como staff", () => {
    const { convocados } = sugerirConvocacao("treino", [1], [p(1, 30, "coach")]);
    expect(convocados).toEqual([{ jogadorId: 30, equipeId: 1, funcao: "coach", papel: "staff" }]);
  });

  it("ignora participacoes de equipes que nao estao no evento", () => {
    const { convocados } = sugerirConvocacao("treino", [1], [p(1, 10, "titular"), p(2, 99, "titular")]);
    expect(convocados.map((c) => c.jogadorId)).toEqual([10]);
  });

  it("sem equipes (reuniao geral) ninguem e convocado automaticamente", () => {
    const resultado = sugerirConvocacao("reuniao", [], [p(1, 10, "titular")]);
    expect(resultado.convocados).toEqual([]);
    expect(resultado.excluidos).toEqual([]);
  });
});

describe("sugerirConvocacao: duas equipes", () => {
  it("confronto interno: quem e titular em A e reserva em B joga por A", () => {
    const { convocados } = sugerirConvocacao("scrim", [1, 2], [p(1, 20, "titular"), p(2, 20, "reserva")]);
    expect(convocados).toEqual([{ jogadorId: 20, equipeId: 1, funcao: "titular", papel: "jogador" }]);
  });

  it("confronto interno: reserva nas duas e sem staff fica de fora, com motivo", () => {
    const { convocados, excluidos } = sugerirConvocacao("scrim", [1, 2], [
      p(1, 20, "reserva"),
      p(2, 20, "reserva"),
    ]);
    expect(convocados).toEqual([]);
    expect(excluidos).toHaveLength(1);
    expect(excluidos[0]!.jogadorId).toBe(20);
    expect(excluidos[0]!.motivo).toContain("não é titular");
  });

  it("confronto interno: quem joga so na equipe B vai por B", () => {
    const { convocados } = sugerirConvocacao("amistoso", [1, 2], [p(2, 21, "reserva")]);
    expect(convocados).toEqual([{ jogadorId: 21, equipeId: 2, funcao: "reserva", papel: "jogador" }]);
  });

  it("confronto interno: coach sem funcao de jogo e convocado como staff", () => {
    const { convocados } = sugerirConvocacao("scrim", [1, 2], [p(1, 30, "coach")]);
    expect(convocados).toEqual([{ jogadorId: 30, equipeId: 1, funcao: "coach", papel: "staff" }]);
  });

  it("treino com 2 equipes nao aplica o confronto: a pessoa entra uma vez, pela funcao principal", () => {
    const { convocados, excluidos } = sugerirConvocacao("treino", [1, 2], [
      p(1, 20, "titular"),
      p(2, 20, "reserva"),
    ]);
    expect(excluidos).toEqual([]);
    expect(convocados).toEqual([{ jogadorId: 20, equipeId: 1, funcao: "titular", papel: "jogador" }]);
  });
});