import { describe, it, expect } from "vitest";
import { lerBooleano, lerObjeto, lerTexto } from "../src/compartilhado/entrada";
import { ErroValidacao } from "../src/core/erros";

describe("lerObjeto", () => {
  it("aceita um objeto comum", () => {
    expect(lerObjeto({ a: 1 })).toEqual({ a: 1 });
  });

  it.each([null, [], "texto"])("recusa %s", (valor) => {
    expect(() => lerObjeto(valor)).toThrow(ErroValidacao);
  });
});

describe("lerTexto", () => {
  it("devolve o texto, e undefined para qualquer outra coisa", () => {
    expect(lerTexto("oi")).toBe("oi");
    expect(lerTexto(42)).toBeUndefined();
    expect(lerTexto(null)).toBeUndefined();
  });
});

describe("lerBooleano", () => {
  it("só o valor true conta como verdadeiro", () => {
    expect(lerBooleano(true)).toBe(true);
    expect(lerBooleano("true")).toBe(false);
    expect(lerBooleano(1)).toBe(false);
    expect(lerBooleano(undefined)).toBe(false);
  });
});