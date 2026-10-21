import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  deslocarMes,
  diasDoMes,
  intervaloDoMes,
  mesDaData,
  nomeDoMes,
  rotuloDoDia,
} from "../src/core/eventos/calendario";

describe("diasDoMes", () => {
  it("outubro de 2026 tem 5 semanas de 7 celulas", () => {
    const semanas = diasDoMes({ ano: 2026, mes: 10 });
    expect(semanas).toHaveLength(5);
    for (const semana of semanas) expect(semana).toHaveLength(7);
  });

  it("outubro de 2026 comeca numa quinta (3 celulas vazias antes do dia 1)", () => {
    const primeira = diasDoMes({ ano: 2026, mes: 10 })[0]!;
    expect(primeira.slice(0, 3)).toEqual([null, null, null]);
    expect(primeira[3]).toBe("2026-10-01");
  });

  it("fevereiro de 2027 comeca na segunda e tem exatamente 4 semanas, sem vazios", () => {
    const semanas = diasDoMes({ ano: 2027, mes: 2 });
    expect(semanas).toHaveLength(4);
    expect(semanas[0]![0]).toBe("2027-02-01");
    expect(semanas.flat().every((celula) => celula !== null)).toBe(true);
  });

  it("fevereiro de 2028 (bissexto) tem 29 dias", () => {
    const dias = diasDoMes({ ano: 2028, mes: 2 })
      .flat()
      .filter((celula) => celula !== null);
    expect(dias).toHaveLength(29);
    expect(dias[28]).toBe("2028-02-29");
  });

  it("a ultima semana de outubro de 2026 termina no sabado 31, com 1 vazio no fim", () => {
    const ultima = diasDoMes({ ano: 2026, mes: 10 }).at(-1)!;
    expect(ultima[5]).toBe("2026-10-31");
    expect(ultima[6]).toBeNull();
  });
});

describe("deslocarMes", () => {
  it("avanca virando o ano (dezembro de 2026 -> janeiro de 2027)", () => {
    expect(deslocarMes({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(deslocarMes({ ano: 2026, mes: 10 }, 13)).toEqual({ ano: 2027, mes: 11 });
  });

  it("volta virando o ano (janeiro de 2027 -> dezembro de 2026)", () => {
    expect(deslocarMes({ ano: 2027, mes: 1 }, -1)).toEqual({ ano: 2026, mes: 12 });
    expect(deslocarMes({ ano: 2026, mes: 3 }, -14)).toEqual({ ano: 2025, mes: 1 });
  });
});

describe("intervaloDoMes, nomeDoMes e mesDaData", () => {
  it("devolve primeiro e ultimo dia, inclusive em ano bissexto", () => {
    expect(intervaloDoMes({ ano: 2026, mes: 10 })).toEqual({
      primeiroDia: "2026-10-01",
      ultimoDia: "2026-10-31",
    });
    expect(intervaloDoMes({ ano: 2028, mes: 2 }).ultimoDia).toBe("2028-02-29");
  });

  it("escreve o nome do mes por extenso", () => {
    expect(nomeDoMes({ ano: 2026, mes: 10 })).toBe("Outubro de 2026");
    expect(nomeDoMes({ ano: 2027, mes: 3 })).toBe("Março de 2027");
  });

  it("descobre o mes de uma data ou de um horario", () => {
    expect(mesDaData("2026-10-20")).toEqual({ ano: 2026, mes: 10 });
    expect(mesDaData("2026-10-20 19:00")).toEqual({ ano: 2026, mes: 10 });
  });
});

describe("agruparPorDia e rotuloDoDia", () => {
  it("agrupa por dia e ordena por horario dentro do dia", () => {
    const grupos = agruparPorDia([
      { id: 1, inicio: "2026-10-20 21:00" },
      { id: 2, inicio: "2026-10-21 10:00" },
      { id: 3, inicio: "2026-10-20 09:00" },
    ]);
    expect(Object.keys(grupos).sort()).toEqual(["2026-10-20", "2026-10-21"]);
    expect(grupos["2026-10-20"]!.map((evento) => evento.id)).toEqual([3, 1]);
  });

  it("escreve o dia da semana e a data", () => {
    expect(rotuloDoDia("2026-10-20")).toBe("Terça-feira, 20/10");
    expect(rotuloDoDia("2026-10-25")).toBe("Domingo, 25/10");
    expect(rotuloDoDia("2026-10-01")).toBe("Quinta-feira, 01/10");
  });
});