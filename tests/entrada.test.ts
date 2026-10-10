import { describe, it, expect } from "vitest";
import { exigirId, extrairMotivo } from "../src/compartilhado/entrada";
import { ErroValidacao } from "../src/core/erros";

describe("exigirId", () => {
  it("aceita um inteiro positivo", () => {
    expect(exigirId(7)).toBe(7);
  });

  // it.each roda o MESMO teste para cada valor da lista
  it.each([0, -1, 1.5, "1", null, undefined])("recusa %s", (valor) => {
    expect(() => exigirId(valor)).toThrow(ErroValidacao);
  });
});

describe("extrairMotivo", () => {
  it("devolve o motivo quando é um texto", () => {
    expect(extrairMotivo({ motivo: "Aprovado no tryout" })).toBe("Aprovado no tryout");
  });

  it("devolve undefined quando as opções não são um objeto", () => {
    expect(extrairMotivo("texto")).toBeUndefined();
    expect(extrairMotivo(null)).toBeUndefined();
  });

  it("ignora motivo que não é texto e qualquer outro campo, como 'responsavel'", () => {
    expect(extrairMotivo({ motivo: 42, responsavel: "Intruso" })).toBeUndefined();
    expect(extrairMotivo({ responsavel: "Intruso" })).toBeUndefined();
  });
});