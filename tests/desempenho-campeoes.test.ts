import { describe, expect, it } from "vitest";
import { CAMPEOES, chaveCampeao, resolverCampeao } from "../src/core/desempenho/campeoes";

describe("lista de campeoes", () => {
  it("nao tem campeoes repetidos (nem com escrita diferente)", () => {
    const chaves = CAMPEOES.map(chaveCampeao);
    expect(new Set(chaves).size).toBe(CAMPEOES.length);
  });
});

describe("chaveCampeao", () => {
  it("ignora maiusculas, acentos, espacos e pontuacao", () => {
    expect(chaveCampeao("Nunu & Willump")).toBe("nunuwillump");
    expect(chaveCampeao("Kai'Sa")).toBe("kaisa");
    expect(chaveCampeao("Ção")).toBe("cao");
  });
});

describe("resolverCampeao", () => {
  it("reconhece o nome oficial independente de maiusculas e espacos", () => {
    for (const texto of ["lee sin", "LeeSin", "  LEE   SIN "]) {
      expect(resolverCampeao(texto)).toEqual({ nome: "Lee Sin", conhecido: true });
    }
  });

  it("reconhece nomes com apostrofo, com ou sem ele", () => {
    expect(resolverCampeao("kaisa")?.nome).toBe("Kai'Sa");
    expect(resolverCampeao("KAI'SA")?.nome).toBe("Kai'Sa");
    expect(resolverCampeao("Kai\u2019Sa")?.nome).toBe("Kai'Sa");
    expect(resolverCampeao("chogath")?.nome).toBe("Cho'Gath");
    expect(resolverCampeao("belveth")?.nome).toBe("Bel'Veth");
    expect(resolverCampeao("ksante")?.nome).toBe("K'Sante");
  });

  it("reconhece apelidos comuns", () => {
    expect(resolverCampeao("nunu")?.nome).toBe("Nunu & Willump");
    expect(resolverCampeao("mundo")?.nome).toBe("Dr. Mundo");
    expect(resolverCampeao("renata")?.nome).toBe("Renata Glasc");
  });

  it("aceita nome fora da lista (campeao novo) marcando como desconhecido", () => {
    expect(resolverCampeao("Zzyzx")).toEqual({ nome: "Zzyzx", conhecido: false });
  });

  it("recusa texto que nao parece nome de campeao", () => {
    for (const texto of ["", "   ", "a", "<script>", "12", "x".repeat(31)]) {
      expect(resolverCampeao(texto)).toBeNull();
    }
  });
});