import { describe, it, expect } from "vitest";
import { validarDadosJogador } from "../src/core/jogadores/validacao";

describe("validarDadosJogador", () => {
  it("aceita um jogador mínimo (só o apelido)", () => {
    expect(validarDadosJogador({ apelido: "Joao" }, "criar")).toEqual([]);
  });

  it("exige apelido ao criar", () => {
    const erros = validarDadosJogador({}, "criar");
    expect(erros).toContain("O apelido é obrigatório.");
  });

  it("recusa apelido só com espaços", () => {
    const erros = validarDadosJogador({ apelido: "   " }, "criar");
    expect(erros).toContain("O apelido é obrigatório.");
  });

  it("não exige apelido ao editar outro campo", () => {
    expect(validarDadosJogador({ eloAtual: "Prata" }, "editar")).toEqual([]);
  });

  it("aceita Riot ID no formato Nome#TAG", () => {
    expect(
      validarDadosJogador({ apelido: "Joao", riotId: "Exemplo1#BR1" }, "criar"),
    ).toEqual([]);
  });

  it("recusa Riot ID sem a tag", () => {
    const erros = validarDadosJogador({ apelido: "Joao", riotId: "Exemplo1" }, "criar");
    expect(erros).toHaveLength(1);
  });

  it("aceita Riot ID vazio", () => {
    expect(validarDadosJogador({ apelido: "Joao", riotId: "" }, "criar")).toEqual([]);
  });

  it("recusa elo inexistente", () => {
    const erros = validarDadosJogador(
      { apelido: "Joao", eloAtual: "Suporte" as never },
      "criar",
    );
    expect(erros).toContain("Elo atual inválido.");
  });

  it("recusa elo máximo menor que o atual", () => {
    const erros = validarDadosJogador(
      { apelido: "Joao", eloAtual: "Ouro", eloMaximo: "Prata" },
      "criar",
    );
    expect(erros).toContain("O elo máximo não pode ser menor que o elo atual.");
  });

  it("aceita elo máximo desconhecido", () => {
    const erros = validarDadosJogador(
      { apelido: "Joao", eloAtual: "Ouro", eloMaximo: "Desconhecido" },
      "criar",
    );
    expect(erros).toEqual([]);
  });

  it("recusa notas fora da faixa de 1 a 5", () => {
    const erros = validarDadosJogador(
      { apelido: "Joao", comunicacao: 0, lideranca: 6, comprometimento: 3.5 },
      "criar",
    );
    expect(erros).toHaveLength(3);
  });

  it("aceita nota vazia (jogador ainda não avaliado)", () => {
    const erros = validarDadosJogador({ apelido: "Joao", comunicacao: null }, "criar");
    expect(erros).toEqual([]);
  });

  it("recusa posição secundária igual à principal", () => {
    const erros = validarDadosJogador(
      { apelido: "Joao", posicaoPrincipal: "Mid", posicaoSecundaria: "Mid" },
      "criar",
    );
    expect(erros).toContain("A posição secundária deve ser diferente da principal.");
  });

  it("recusa status inexistente", () => {
    const erros = validarDadosJogador(
      { apelido: "Joao", status: "aposentado" as never },
      "criar",
    );
    expect(erros).toContain("Status inválido.");
  });
});