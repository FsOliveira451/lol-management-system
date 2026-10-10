import { describe, it, expect } from "vitest";
import type { Equipe } from "../src/core/equipes/tipos";
import { validarDadosEquipe } from "../src/core/equipes/validacao";
import {
  FORMULARIO_EQUIPE_VAZIO,
  converterFormularioEquipe,
  valoresDaEquipe,
} from "../src/renderer/formulario-equipe";

const equipeBase: Equipe = {
  id: 1,
  nome: "Alpha",
  tag: null,
  nivel: "principal",
  status: "em_formacao",
  objetivo: null,
  observacoes: null,
  criadoEm: "2026-01-01 00:00:00",
  atualizadoEm: "2026-01-01 00:00:00",
};

describe("formulário de equipe", () => {
  it("transforma campos vazios em null (não informado)", () => {
    expect(converterFormularioEquipe(FORMULARIO_EQUIPE_VAZIO)).toEqual({
      nome: "",
      tag: null,
      nivel: "principal",
      status: "em_formacao",
      objetivo: null,
      observacoes: null,
    });
  });

  it("remove espaços sobrando", () => {
    const dados = converterFormularioEquipe({
      ...FORMULARIO_EQUIPE_VAZIO,
      nome: "  Alpha  ",
      tag: " alp ",
      objetivo: "  Subir  ",
    });
    expect(dados.nome).toBe("Alpha");
    expect(dados.tag).toBe("alp");
    expect(dados.objetivo).toBe("Subir");
  });

  it("transforma campos não informados da equipe em texto vazio", () => {
    expect(valoresDaEquipe(equipeBase)).toEqual({
      nome: "Alpha",
      tag: "",
      nivel: "principal",
      status: "em_formacao",
      objetivo: "",
      observacoes: "",
    });
  });

  it("ida e volta: equipe → formulário → dados devolve os mesmos valores", () => {
    const equipe: Equipe = { ...equipeBase, tag: "ALP", objetivo: "Subir de divisão" };
    expect(converterFormularioEquipe(valoresDaEquipe(equipe))).toMatchObject({
      nome: "Alpha",
      tag: "ALP",
      objetivo: "Subir de divisão",
      observacoes: null,
    });
  });

  it("o formulário vazio é recusado pelas regras do sistema", () => {
    const erros = validarDadosEquipe(
      converterFormularioEquipe(FORMULARIO_EQUIPE_VAZIO),
      "criar",
    );
    expect(erros).toContain("O nome da equipe é obrigatório.");
  });

  it("um formulário preenchido é aceito pelas regras do sistema", () => {
    const erros = validarDadosEquipe(
      converterFormularioEquipe({ ...FORMULARIO_EQUIPE_VAZIO, nome: "Alpha", tag: "ALP" }),
      "criar",
    );
    expect(erros).toEqual([]);
  });
});