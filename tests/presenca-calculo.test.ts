import { describe, expect, it } from "vitest";
import {
  avaliarFrequencia,
  calcularPresenca,
  calcularTendencia,
  type ResumoPresenca,
} from "../src/core/presenca/calculo";
import type { EstadoPresenca } from "../src/core/presenca/tipos";

function regs(...estados: EstadoPresenca[]) {
  return estados.map((estado) => ({ estado }));
}

function repetir(estado: EstadoPresenca, vezes: number): EstadoPresenca[] {
  return Array.from({ length: vezes }, () => estado);
}

function resumoCom(percentual: number | null): ResumoPresenca {
  return { registrados: 10, presentes: 0, atrasos: 0, faltas: 0, justificadas: 0, pendentes: 0, percentual };
}

describe("calcularPresenca", () => {
  it("conta cada estado e calcula o percentual (atraso conta como comparecimento)", () => {
    const resumo = calcularPresenca(
      regs(...repetir("presente", 4), "atrasou", "faltou", "justificado", "confirmado", "convocado"),
    );
    expect(resumo).toEqual({
      registrados: 7,
      presentes: 4,
      atrasos: 1,
      faltas: 1,
      justificadas: 1,
      pendentes: 2,
      percentual: 83.3,
    });
  });

  it("com menos de 5 registrados o percentual e null (dados insuficientes)", () => {
    expect(calcularPresenca(regs(...repetir("presente", 4))).percentual).toBeNull();
  });

  it("com exatamente 5 registrados ja calcula", () => {
    expect(calcularPresenca(regs(...repetir("presente", 5))).percentual).toBe(100);
  });

  it("falta justificada nao pesa no percentual, mas conta para o minimo", () => {
    const resumo = calcularPresenca(regs(...repetir("presente", 3), "justificado", "justificado"));
    expect(resumo.registrados).toBe(5);
    expect(resumo.percentual).toBe(100);
  });

  it("so justificadas: sem base de calculo, percentual null", () => {
    expect(calcularPresenca(regs(...repetir("justificado", 5))).percentual).toBeNull();
  });

  it("convocado e confirmado nao entram no calculo", () => {
    const resumo = calcularPresenca(regs(...repetir("convocado", 10)));
    expect(resumo.registrados).toBe(0);
    expect(resumo.pendentes).toBe(10);
    expect(resumo.percentual).toBeNull();
  });

  it("arredonda para uma casa decimal", () => {
    expect(calcularPresenca(regs(...repetir("presente", 4), "faltou", "faltou")).percentual).toBe(66.7);
  });
});

describe("calcularTendencia", () => {
  it("subindo: comeca faltando e termina presente", () => {
    const registros = regs(...repetir("faltou", 5), ...repetir("presente", 5));
    expect(calcularTendencia(registros)).toBe("subindo");
  });

  it("caindo: comeca presente e termina faltando", () => {
    const registros = regs(...repetir("presente", 5), ...repetir("faltou", 5));
    expect(calcularTendencia(registros)).toBe("caindo");
  });

  it("estavel: mesmo comportamento nos dois periodos", () => {
    expect(calcularTendencia(regs(...repetir("presente", 10)))).toBe("estavel");
  });

  it("com menos de 10 eventos com resultado devolve null", () => {
    expect(calcularTendencia(regs(...repetir("presente", 9)))).toBeNull();
  });
});

describe("avaliarFrequencia", () => {
  it("abaixo de 70% e atencao", () => {
    const alerta = avaliarFrequencia(resumoCom(60));
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.codigo).toBe("frequencia_baixa");
  });

  it("exatamente 70% ja e observacao", () => {
    expect(avaliarFrequencia(resumoCom(70))?.nivel).toBe("observacao");
  });

  it("84,9% e observacao e 85% e normal", () => {
    expect(avaliarFrequencia(resumoCom(84.9))?.nivel).toBe("observacao");
    expect(avaliarFrequencia(resumoCom(85))?.nivel).toBe("normal");
  });

  it("sem dados suficientes nao gera alerta", () => {
    expect(avaliarFrequencia(resumoCom(null))).toBeNull();
  });

  it("a mensagem usa virgula decimal", () => {
    expect(avaliarFrequencia(resumoCom(66.7))?.mensagem).toBe("Presença de 66,7%, abaixo de 70%.");
  });

  it("aceita limites personalizados", () => {
    expect(avaliarFrequencia(resumoCom(80), { atencao: 90, observacao: 95 })?.nivel).toBe("atencao");
  });
});