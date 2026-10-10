import { describe, it, expect } from "vitest";
import type { Posicao } from "../src/core/jogadores/tipos";
import type {
  ContextoParticipacao,
  FuncaoEquipe,
  NovaParticipacao,
  ParticipacaoAtiva,
} from "../src/core/equipes/tipos";
import {
  validarDadosEquipe,
  validarNovaParticipacao,
} from "../src/core/equipes/validacao";
import { equipeNoConfronto } from "../src/core/equipes/confronto";

// ---------- ajudantes dos testes ----------

function part(
  equipeId: number,
  jogadorId: number,
  funcao: FuncaoEquipe,
  posicao: Posicao | null = null,
): ParticipacaoAtiva {
  return { equipeId, jogadorId, funcao, posicao };
}

// Um contexto "normal" (pessoa ativa, equipe ativa, ninguem em lugar nenhum)
function ctx(sobrescrever: Partial<ContextoParticipacao> = {}): ContextoParticipacao {
  return {
    statusJogador: "ativo",
    statusEquipe: "ativa",
    ativasDoJogador: [],
    ativasDaEquipe: [],
    ...sobrescrever,
  };
}

// Pedido padrao: pessoa 10 vira titular Mid da equipe 1
const nova: NovaParticipacao = { equipeId: 1, jogadorId: 10, funcao: "titular", posicao: "Mid" };

function temErro(erros: string[], trecho: string): boolean {
  return erros.some((erro) => erro.includes(trecho));
}

// ---------- dados da equipe ----------

describe("validarDadosEquipe", () => {
  it("aceita uma equipe mínima (só o nome)", () => {
    expect(validarDadosEquipe({ nome: "Alpha" }, "criar")).toEqual([]);
  });

  it("exige o nome ao criar", () => {
    expect(validarDadosEquipe({}, "criar")).toContain("O nome da equipe é obrigatório.");
  });

  it("recusa nome curto demais ou longo demais", () => {
    expect(validarDadosEquipe({ nome: "A" }, "criar")).toHaveLength(1);
    expect(validarDadosEquipe({ nome: "x".repeat(41) }, "criar")).toHaveLength(1);
  });

  it("aceita tag válida, vazia ou nula", () => {
    expect(validarDadosEquipe({ nome: "Alpha", tag: "ALP" }, "criar")).toEqual([]);
    expect(validarDadosEquipe({ nome: "Alpha", tag: "" }, "criar")).toEqual([]);
    expect(validarDadosEquipe({ nome: "Alpha", tag: null }, "criar")).toEqual([]);
  });

  it.each(["A", "ABCDEF", "AB-1"])("recusa a tag %s", (tag) => {
    expect(validarDadosEquipe({ nome: "Alpha", tag }, "criar")).toContain(
      "A tag deve ter de 2 a 5 letras ou números.",
    );
  });

  it("recusa nível e status inexistentes", () => {
    const erros = validarDadosEquipe(
      { nome: "Alpha", nivel: "lendaria" as never, status: "pausada" as never },
      "criar",
    );
    expect(erros).toContain("Nível inválido.");
    expect(erros).toContain("Status da equipe inválido.");
  });

  it("não exige o nome ao editar outro campo", () => {
    expect(validarDadosEquipe({ objetivo: "Subir de divisão" }, "editar")).toEqual([]);
  });
});

// ---------- colocar uma pessoa numa equipe ----------

describe("validarNovaParticipacao", () => {
  it("aceita um titular numa equipe vazia", () => {
    expect(validarNovaParticipacao(nova, ctx())).toEqual([]);
  });

  it("exige posição para o titular", () => {
    const erros = validarNovaParticipacao({ ...nova, posicao: null }, ctx());
    expect(erros).toContain("Todo titular precisa de uma posição.");
  });

  it("recusa pessoa inativa", () => {
    const erros = validarNovaParticipacao(nova, ctx({ statusJogador: "inativo" }));
    expect(temErro(erros, "pessoa inativa")).toBe(true);
  });

  it("recusa equipe inativa", () => {
    const erros = validarNovaParticipacao(nova, ctx({ statusEquipe: "inativa" }));
    expect(temErro(erros, "equipe inativa")).toBe(true);
  });

  it("recusa repetir a mesma função na mesma equipe", () => {
    const reserva: NovaParticipacao = { equipeId: 1, jogadorId: 10, funcao: "reserva" };
    const erros = validarNovaParticipacao(
      reserva,
      ctx({ ativasDoJogador: [part(1, 10, "reserva")] }),
    );
    expect(temErro(erros, "já tem esta função")).toBe(true);
  });

  it("recusa dois papéis de jogo na mesma equipe (reserva e titular)", () => {
    const erros = validarNovaParticipacao(
      nova,
      ctx({ ativasDoJogador: [part(1, 10, "reserva")] }),
    );
    expect(temErro(erros, "já joga nesta equipe como reserva")).toBe(true);
  });

  it("permite que o capitão também seja titular da mesma equipe", () => {
    const capitao: NovaParticipacao = { equipeId: 1, jogadorId: 10, funcao: "capitao" };
    const titular = part(1, 10, "titular", "Mid");
    const erros = validarNovaParticipacao(
      capitao,
      ctx({ ativasDoJogador: [titular], ativasDaEquipe: [titular] }),
    );
    expect(erros).toEqual([]);
  });

  it("permite ser titular numa equipe e reserva em outra", () => {
    const reservaNaB: NovaParticipacao = { equipeId: 2, jogadorId: 10, funcao: "reserva" };
    const erros = validarNovaParticipacao(
      reservaNaB,
      ctx({ ativasDoJogador: [part(1, 10, "titular", "Mid")] }),
    );
    expect(erros).toEqual([]);
  });

  it("recusa ser titular em duas equipes", () => {
    const titularNaB: NovaParticipacao = {
      equipeId: 2,
      jogadorId: 10,
      funcao: "titular",
      posicao: "Top",
    };
    const erros = validarNovaParticipacao(
      titularNaB,
      ctx({ ativasDoJogador: [part(1, 10, "titular", "Mid")] }),
    );
    expect(temErro(erros, "já é titular em outra equipe")).toBe(true);
  });

  it("recusa dois titulares na mesma posição", () => {
    const erros = validarNovaParticipacao(
      nova,
      ctx({ ativasDaEquipe: [part(1, 20, "titular", "Mid")] }),
    );
    expect(temErro(erros, "A posição Mid já tem titular")).toBe(true);
  });

  it("aceita titulares em posições diferentes", () => {
    const erros = validarNovaParticipacao(
      nova,
      ctx({ ativasDaEquipe: [part(1, 20, "titular", "Top")] }),
    );
    expect(erros).toEqual([]);
  });

  it("recusa um segundo capitão", () => {
    const capitao: NovaParticipacao = { equipeId: 1, jogadorId: 10, funcao: "capitao" };
    const erros = validarNovaParticipacao(
      capitao,
      ctx({ ativasDaEquipe: [part(1, 20, "capitao")] }),
    );
    expect(temErro(erros, "já tem capitão")).toBe(true);
  });

  it("recusa um segundo coach", () => {
    const coach: NovaParticipacao = { equipeId: 1, jogadorId: 10, funcao: "coach" };
    const erros = validarNovaParticipacao(
      coach,
      ctx({ ativasDaEquipe: [part(1, 20, "coach")] }),
    );
    expect(temErro(erros, "já tem coach")).toBe(true);
  });
});

// ---------- confronto entre duas equipes da organização ----------

describe("equipeNoConfronto", () => {
  it("quem joga só em uma das equipes joga por ela", () => {
    const resultado = equipeNoConfronto([part(1, 10, "reserva")], 1, 2);
    expect(resultado).toEqual({ equipePermitida: 1, motivo: null });
  });

  it("quem está nas duas joga pela equipe em que é titular (A)", () => {
    const resultado = equipeNoConfronto(
      [part(1, 10, "titular", "Mid"), part(2, 10, "reserva")],
      1,
      2,
    );
    expect(resultado.equipePermitida).toBe(1);
  });

  it("quem está nas duas joga pela equipe em que é titular (B)", () => {
    const resultado = equipeNoConfronto(
      [part(1, 10, "academia"), part(2, 10, "titular", "Top")],
      1,
      2,
    );
    expect(resultado.equipePermitida).toBe(2);
  });

  it("reserva nas duas equipes não pode disputar", () => {
    const resultado = equipeNoConfronto(
      [part(1, 10, "reserva"), part(2, 10, "academia")],
      1,
      2,
    );
    expect(resultado.equipePermitida).toBeNull();
    expect(resultado.motivo).toContain("não é titular em nenhuma");
  });

  it("quem não faz parte de nenhuma das duas não joga", () => {
    const resultado = equipeNoConfronto([part(3, 10, "titular", "Mid")], 1, 2);
    expect(resultado.equipePermitida).toBeNull();
  });

  it("staff sem função de jogo não joga", () => {
    const resultado = equipeNoConfronto([part(1, 10, "capitao")], 1, 2);
    expect(resultado.equipePermitida).toBeNull();
  });
});