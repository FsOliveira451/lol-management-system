import { describe, it, expect } from "vitest";
import {
  FORMULARIO_VAZIO,
  converterFormulario,
} from "../src/renderer/formulario-jogador";
import { validarDadosJogador } from "../src/core/jogadores/validacao";

describe("converterFormulario", () => {
  it("transforma campos vazios em null (não informado)", () => {
    expect(converterFormulario(FORMULARIO_VAZIO)).toEqual({
      apelido: "",
      riotId: null,
      eloAtual: "Desconhecido",
      eloMaximo: null,
      posicaoPrincipal: null,
      posicaoSecundaria: null,
      experienciaCompetitiva: false,
      observacoes: null,
    });
  });

  it("remove espaços sobrando", () => {
    const dados = converterFormulario({
      ...FORMULARIO_VAZIO,
      apelido: "  Joao  ",
      riotId: "  Joao#BR1 ",
      observacoes: "  ok  ",
    });
    expect(dados.apelido).toBe("Joao");
    expect(dados.riotId).toBe("Joao#BR1");
    expect(dados.observacoes).toBe("ok");
  });

  it("mantém as escolhas feitas", () => {
    const dados = converterFormulario({
      ...FORMULARIO_VAZIO,
      apelido: "Joao",
      eloAtual: "Ouro",
      eloMaximo: "Platina",
      posicaoPrincipal: "Mid",
      posicaoSecundaria: "Top",
      experienciaCompetitiva: true,
    });
    expect(dados).toMatchObject({
      eloAtual: "Ouro",
      eloMaximo: "Platina",
      posicaoPrincipal: "Mid",
      posicaoSecundaria: "Top",
      experienciaCompetitiva: true,
    });
  });

  it("o formulário vazio é recusado pelas regras do sistema", () => {
    const erros = validarDadosJogador(converterFormulario(FORMULARIO_VAZIO), "criar");
    expect(erros).toContain("O apelido é obrigatório.");
  });

  it("um formulário preenchido é aceito pelas regras do sistema", () => {
    const erros = validarDadosJogador(
      converterFormulario({
        ...FORMULARIO_VAZIO,
        apelido: "Joao",
        riotId: "Joao#BR1",
        eloAtual: "Ouro",
      }),
      "criar",
    );
    expect(erros).toEqual([]);
  });
});