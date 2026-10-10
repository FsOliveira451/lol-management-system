import { describe, it, expect, vi } from "vitest";
import { executar } from "../src/compartilhado/executar";
import { ErroValidacao } from "../src/core/erros";

describe("executar", () => {
  it("devolve ok com os dados quando tudo funciona", () => {
    expect(executar(() => 42)).toEqual({ ok: true, dados: 42 });
  });

  it("converte ErroValidacao em lista de mensagens", () => {
    const resultado = executar(() => {
      throw new ErroValidacao(["Campo X inválido."]);
    });
    expect(resultado).toEqual({ ok: false, erros: ["Campo X inválido."] });
  });

  it("esconde os detalhes de erros inesperados", () => {
    // Silencia o console.error so durante este teste
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = executar(() => {
      throw new Error("segredo interno do banco");
    });

    expect(resultado.ok).toBe(false);
    expect(JSON.stringify(resultado)).not.toContain("segredo interno");

    espiao.mockRestore();
  });
});