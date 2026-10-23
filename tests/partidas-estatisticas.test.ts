import { describe, expect, it } from "vitest";
import {
  avaliarPendenciasDeResultado,
  calcularEstatisticasDaEquipe,
  type PartidaParaEstatistica,
} from "../src/core/partidas/estatisticas";
import type { TipoEvento } from "../src/core/eventos/tipos";

function p(
  eventoId: number,
  numero: number,
  equipeIds: number[],
  vencedorEquipeId: number | null,
  tipo: TipoEvento = "scrim",
  inicio = "2026-10-20 19:00",
): PartidaParaEstatistica {
  return { eventoId, tipo, inicio, numero, equipeIds, vencedorEquipeId };
}

describe("calcularEstatisticasDaEquipe", () => {
  it("com 5 partidas externas calcula o win rate (3 vitorias, 2 derrotas = 60%)", () => {
    const partidas = [
      p(1, 1, [1], 1),
      p(2, 1, [1], 1),
      p(3, 1, [1], 1),
      p(4, 1, [1], null),
      p(5, 1, [1], null),
    ];
    expect(calcularEstatisticasDaEquipe(partidas, 1).externo).toEqual({
      partidas: 5,
      vitorias: 3,
      derrotas: 2,
      winRate: 60,
    });
  });

  it("com menos de 5 partidas o win rate e null, mas as contagens aparecem", () => {
    const resultado = calcularEstatisticasDaEquipe([p(1, 1, [1], 1), p(2, 1, [1], null)], 1);
    expect(resultado.externo).toEqual({ partidas: 2, vitorias: 1, derrotas: 1, winRate: null });
  });

  it("sem nenhuma partida: tudo zerado e win rate null", () => {
    const resultado = calcularEstatisticasDaEquipe([], 1);
    expect(resultado.externo).toEqual({ partidas: 0, vitorias: 0, derrotas: 0, winRate: null });
    expect(resultado.interno.partidas).toBe(0);
    expect(resultado.forma).toEqual([]);
  });

  it("confronto interno fica separado e da lados opostos as duas equipes", () => {
    const partidas = [p(1, 1, [1, 2], 1), p(1, 2, [1, 2], 2), p(1, 3, [1, 2], 1)];

    const equipe1 = calcularEstatisticasDaEquipe(partidas, 1);
    expect(equipe1.interno).toMatchObject({ partidas: 3, vitorias: 2, derrotas: 1 });
    expect(equipe1.externo.partidas).toBe(0);

    const equipe2 = calcularEstatisticasDaEquipe(partidas, 2);
    expect(equipe2.interno).toMatchObject({ partidas: 3, vitorias: 1, derrotas: 2 });
  });

  it("ignora partidas de eventos em que a equipe nao esta", () => {
    const resultado = calcularEstatisticasDaEquipe([p(1, 1, [2], 2), p(2, 1, [2, 3], 3)], 1);
    expect(resultado.externo.partidas).toBe(0);
    expect(resultado.interno.partidas).toBe(0);
  });

  it("separa por tipo, so contra externos (minimo 1 para ver os percentuais)", () => {
    const partidas = [
      p(1, 1, [1], 1, "scrim"),
      p(2, 1, [1], 1, "scrim"),
      p(3, 1, [1], null, "amistoso"),
      p(4, 1, [1, 2], 1, "scrim"), // interno: nao entra em porTipo
    ];
    const { porTipo } = calcularEstatisticasDaEquipe(partidas, 1, 1);
    expect(porTipo.scrim).toEqual({ partidas: 2, vitorias: 2, derrotas: 0, winRate: 100 });
    expect(porTipo.amistoso).toEqual({ partidas: 1, vitorias: 0, derrotas: 1, winRate: 0 });
    expect(porTipo.campeonato.winRate).toBeNull();
  });

  it("forma: ultimos 5 resultados externos em ordem cronologica, mesmo com a entrada embaralhada", () => {
    // resultados por dia: V D V V D D V
    const vencedores = [1, null, 1, 1, null, null, 1];
    const partidas = vencedores.map((vencedor, i) =>
      p(i + 1, 1, [1], vencedor, "scrim", `2026-10-0${i + 1} 19:00`),
    );
    const embaralhadas = [...partidas].reverse();
    expect(calcularEstatisticasDaEquipe(embaralhadas, 1).forma).toEqual(["V", "V", "D", "D", "V"]);
  });

  it("dados inconsistentes sao ignorados, nunca contados", () => {
    const partidas = [
      p(1, 1, [1, 2], null), // interno sem vencedor valido
      p(2, 1, [1], 7), // externo com vencedor que nao e do evento
    ];
    const resultado = calcularEstatisticasDaEquipe(partidas, 1);
    expect(resultado.interno.partidas).toBe(0);
    expect(resultado.externo.partidas).toBe(0);
  });

  it("arredonda o win rate para uma casa decimal (1 de 3 = 33,3%)", () => {
    const partidas = [p(1, 1, [1], 1), p(2, 1, [1], null), p(3, 1, [1], null)];
    expect(calcularEstatisticasDaEquipe(partidas, 1, 1).externo.winRate).toBe(33.3);
  });
});

describe("avaliarPendenciasDeResultado", () => {
  it("evento que terminou sem resultado: atencao", () => {
    const alertas = avaliarPendenciasDeResultado([
      { eventoId: 7, tipo: "scrim", situacao: "pendente_registro", partidasRegistradas: 0 },
    ]);
    expect(alertas).toEqual([
      {
        codigo: "resultado_pendente:7",
        nivel: "atencao",
        mensagem: "Evento terminou sem resultado registrado.",
      },
    ]);
  });

  it("evento realizado sem partidas: observacao", () => {
    const alertas = avaliarPendenciasDeResultado([
      { eventoId: 8, tipo: "campeonato", situacao: "realizado", partidasRegistradas: 0 },
    ]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]!.nivel).toBe("observacao");
    expect(alertas[0]!.codigo).toBe("sem_partidas:8");
  });

  it("nao alerta com partidas registradas, em tipos sem partidas, ou em situacoes sem pendencia", () => {
    const alertas = avaliarPendenciasDeResultado([
      { eventoId: 1, tipo: "scrim", situacao: "realizado", partidasRegistradas: 2 },
      { eventoId: 2, tipo: "treino", situacao: "realizado", partidasRegistradas: 0 },
      { eventoId: 3, tipo: "scrim", situacao: "agendado", partidasRegistradas: 0 },
      { eventoId: 4, tipo: "scrim", situacao: "em_andamento", partidasRegistradas: 0 },
      { eventoId: 5, tipo: "scrim", situacao: "cancelado", partidasRegistradas: 0 },
    ]);
    expect(alertas).toEqual([]);
  });

  it("atencao vem antes de observacao", () => {
    const alertas = avaliarPendenciasDeResultado([
      { eventoId: 1, tipo: "scrim", situacao: "realizado", partidasRegistradas: 0 },
      { eventoId: 2, tipo: "amistoso", situacao: "pendente_registro", partidasRegistradas: 0 },
    ]);
    expect(alertas.map((a) => a.nivel)).toEqual(["atencao", "observacao"]);
  });
});