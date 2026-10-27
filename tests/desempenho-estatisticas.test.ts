import { describe, expect, it } from "vitest";
import {
  calcularDesempenhoDaPessoa,
  type RegistroDesempenho,
} from "../src/core/desempenho/estatisticas";
import type { TipoEvento } from "../src/core/eventos/tipos";
import type { Posicao } from "../src/core/jogadores/tipos";

function r(
  eventoId: number,
  equipeIds: number[],
  vencedorEquipeId: number | null,
  equipeIdDoLado: number,
  posicao: Posicao,
  campeao: string,
  kda: [number, number, number] | null = null,
  tipo: TipoEvento = "scrim",
): RegistroDesempenho {
  return {
    eventoId,
    tipo,
    inicio: `2026-10-${String(eventoId).padStart(2, "0")} 19:00`,
    numero: 1,
    equipeIds,
    vencedorEquipeId,
    equipeIdDoLado,
    posicao,
    campeao,
    abates: kda?.[0] ?? null,
    mortes: kda?.[1] ?? null,
    assistencias: kda?.[2] ?? null,
  };
}

describe("calcularDesempenhoDaPessoa: vitorias e derrotas", () => {
  it("com 5 partidas externas calcula o win rate (3 vitorias, 2 derrotas = 60%)", () => {
    const registros = [1, 1, 1, null, null].map((vencedor, i) =>
      r(i + 1, [1], vencedor, 1, "Top", "Garen"),
    );
    expect(calcularDesempenhoDaPessoa(registros).externo).toEqual({
      partidas: 5,
      vitorias: 3,
      derrotas: 2,
      winRate: 60,
    });
  });

  it("com menos de 5 partidas o win rate e null, mas as contagens aparecem", () => {
    const registros = [r(1, [1], 1, 1, "Top", "Garen"), r(2, [1], null, 1, "Top", "Garen")];
    expect(calcularDesempenhoDaPessoa(registros).externo).toEqual({
      partidas: 2,
      vitorias: 1,
      derrotas: 1,
      winRate: null,
    });
  });

  it("confronto interno fica separado: cada lado tem o seu resultado", () => {
    const registros = [
      r(1, [1, 2], 1, 1, "Top", "Garen"), // jogou pelo lado vencedor
      r(2, [1, 2], 1, 2, "Top", "Ahri"), // jogou pelo lado perdedor
    ];
    const resultado = calcularDesempenhoDaPessoa(registros);
    expect(resultado.externo.partidas).toBe(0);
    expect(resultado.interno).toMatchObject({ partidas: 2, vitorias: 1, derrotas: 1 });
  });

  it("sem nenhum registro: tudo zerado e sem numeros inventados", () => {
    const resultado = calcularDesempenhoDaPessoa([]);
    expect(resultado.externo).toEqual({ partidas: 0, vitorias: 0, derrotas: 0, winRate: null });
    expect(resultado.kda.partidasComKda).toBe(0);
    expect(resultado.kda.razao).toBeNull();
    expect(resultado.campeoes).toEqual([]);
  });

  it("registros inconsistentes sao ignorados em tudo", () => {
    const registros = [
      r(1, [1], 7, 1, "Top", "Garen", [5, 2, 7]), // vencedor que nao e do evento
      r(2, [1], 1, 5, "Top", "Ahri", [5, 2, 7]), // lado que nao participa do evento
    ];
    const resultado = calcularDesempenhoDaPessoa(registros);
    expect(resultado.externo.partidas).toBe(0);
    expect(resultado.kda.partidasComKda).toBe(0);
    expect(resultado.campeoes).toEqual([]);
  });
});

describe("calcularDesempenhoDaPessoa: KDA", () => {
  const cinco = [
    [5, 2, 7],
    [3, 0, 10],
    [10, 4, 2],
    [0, 5, 1],
    [2, 3, 8],
  ] as [number, number, number][];

  it("com 5 partidas com KDA calcula somas, medias e razao", () => {
    const registros = cinco.map((kda, i) => r(i + 1, [1], 1, 1, "Top", "Garen", kda));
    expect(calcularDesempenhoDaPessoa(registros).kda).toEqual({
      partidasComKda: 5,
      abates: 20,
      mortes: 14,
      assistencias: 28,
      mediaAbates: 4,
      mediaMortes: 2.8,
      mediaAssistencias: 5.6,
      razao: 3.43,
    });
  });

  it("com menos de 5 partidas com KDA mostra as somas, mas nao as medias", () => {
    const registros = [
      r(1, [1], 1, 1, "Top", "Garen", [5, 2, 7]),
      r(2, [1], 1, 1, "Top", "Garen", [3, 0, 10]),
    ];
    expect(calcularDesempenhoDaPessoa(registros).kda).toEqual({
      partidasComKda: 2,
      abates: 8,
      mortes: 2,
      assistencias: 17,
      mediaAbates: null,
      mediaMortes: null,
      mediaAssistencias: null,
      razao: null,
    });
  });

  it("zero mortes nao divide por zero (mortes minimas de 1 na razao)", () => {
    const registros = [1, 2, 3, 4, 5].map((id) => r(id, [1], 1, 1, "Top", "Garen", [5, 0, 5]));
    expect(calcularDesempenhoDaPessoa(registros).kda.razao).toBe(50);
  });

  it("registros sem KDA contam como partida, mas ficam fora do KDA", () => {
    const registros = [
      r(1, [1], 1, 1, "Top", "Garen", [5, 2, 7]),
      r(2, [1], 1, 1, "Top", "Garen", [5, 2, 7]),
      r(3, [1], 1, 1, "Top", "Garen", [5, 2, 7]),
      r(4, [1], 1, 1, "Top", "Garen"),
      r(5, [1], 1, 1, "Top", "Garen"),
      r(6, [1], 1, 1, "Top", "Garen"),
    ];
    const resultado = calcularDesempenhoDaPessoa(registros);
    expect(resultado.externo.partidas).toBe(6);
    expect(resultado.kda.partidasComKda).toBe(3);
  });
});

describe("calcularDesempenhoDaPessoa: campeoes e posicoes", () => {
  it("agrupa campeoes ignorando maiusculas e ordena do mais usado ao menos usado", () => {
    const registros = [
      r(1, [1], 1, 1, "Top", "Garen"),
      r(2, [1], 1, 1, "Top", "Garen"),
      r(3, [1], null, 1, "Mid", "Ahri"),
      r(4, [1], 1, 1, "Top", "Zzyzx"),
      r(5, [1], null, 1, "Top", "zzyzx"),
    ];
    expect(calcularDesempenhoDaPessoa(registros, 1).campeoes).toEqual([
      { campeao: "Garen", partidas: 2, partidasExternas: 2, vitorias: 2, derrotas: 0, winRate: 100 },
      { campeao: "Zzyzx", partidas: 2, partidasExternas: 2, vitorias: 1, derrotas: 1, winRate: 50 },
      { campeao: "Ahri", partidas: 1, partidasExternas: 1, vitorias: 0, derrotas: 1, winRate: 0 },
    ]);
  });

  it("vitorias e derrotas por campeao so contam partidas externas", () => {
    const registros = [
      r(1, [1], 1, 1, "Top", "Garen"), // externa, vitoria
      r(2, [1, 2], 1, 1, "Top", "Garen"), // interna: conta uso, nao conta resultado
    ];
    const [garen] = calcularDesempenhoDaPessoa(registros, 1).campeoes;
    expect(garen).toMatchObject({ partidas: 2, partidasExternas: 1, vitorias: 1, derrotas: 0 });
  });

  it("conta quantas vezes jogou em cada posicao", () => {
    const registros = [
      r(1, [1], 1, 1, "Top", "Garen"),
      r(2, [1], 1, 1, "Top", "Garen"),
      r(3, [1], 1, 1, "Mid", "Ahri"),
    ];
    expect(calcularDesempenhoDaPessoa(registros).posicoes).toEqual({
      Top: 2,
      Jungle: 0,
      Mid: 1,
      ADC: 0,
      Support: 0,
    });
  });
});