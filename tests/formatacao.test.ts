import { describe, it, expect } from "vitest";
import { formatarDataHora, rotuloDoValor } from "../src/renderer/formatacao";

describe("formatarDataHora", () => {
  it("converte a data UTC do banco (mostrando em UTC)", () => {
    const texto = formatarDataHora("2026-01-05 14:30:00", "UTC");
    expect(texto).toContain("05/01/2026");
    expect(texto).toContain("14:30");
  });

  it("converte para o horário de Brasília (3 horas a menos)", () => {
    expect(formatarDataHora("2026-01-05 14:30:00", "America/Sao_Paulo")).toContain("11:30");
  });

  it("devolve o texto original se a data for inválida", () => {
    expect(formatarDataHora("não é data")).toBe("não é data");
  });
});

describe("rotuloDoValor", () => {
  it("mostra N/D quando não há valor", () => {
    expect(rotuloDoValor("elo_atual", null)).toBe("N/D");
  });

  it("traduz o status para o rótulo da tela", () => {
    expect(rotuloDoValor("status", "em_avaliacao")).toBe("🟡 Em avaliação");
  });

  it("mostra N/D para elo desconhecido e mantém os outros valores", () => {
    expect(rotuloDoValor("elo_atual", "Desconhecido")).toBe("N/D");
    expect(rotuloDoValor("posicao_principal", "Mid")).toBe("Mid");
  });
});