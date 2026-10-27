import { describe, expect, it } from "vitest";
import type { DadosDesempenho } from "../src/core/desempenho/tipos";
import {
  avisosDeDesempenho,
  resolverLado,
  validarDesempenho,
  type ContextoDesempenho,
  type ConvocacaoParaDesempenho,
  type RegistroDoLado,
} from "../src/core/desempenho/validacao";
import type { Posicao } from "../src/core/jogadores/tipos";

function reg(jogadorId: number, equipeId: number, posicao: Posicao, campeao: string): RegistroDoLado {
  return { jogadorId, equipeId, posicao, campeao };
}

function contexto(extra: Partial<ContextoDesempenho> = {}): ContextoDesempenho {
  return {
    equipeIds: [10],
    convocacao: { estado: "presente", papel: "jogador", equipeId: 10 },
    outrosRegistros: [],
    ...extra,
  };
}

const dados: DadosDesempenho = {
  jogadorId: 1,
  posicao: "Top",
  campeao: "Garen",
  abates: 5,
  mortes: 2,
  assistencias: 7,
};

describe("validarDesempenho: quem pode ser registrado", () => {
  it("aceita um registro completo de quem esta presente", () => {
    expect(validarDesempenho(dados, contexto())).toEqual([]);
  });

  it("aceita quem atrasou", () => {
    const conv: ConvocacaoParaDesempenho = { estado: "atrasou", papel: "jogador", equipeId: 10 };
    expect(validarDesempenho(dados, contexto({ convocacao: conv }))).toEqual([]);
  });

  it("aceita registro sem KDA (os tres em branco)", () => {
    const semKda = { ...dados, abates: null, mortes: null, assistencias: null };
    expect(validarDesempenho(semKda, contexto())).toEqual([]);
  });

  it("recusa quem nao esta convocado", () => {
    expect(validarDesempenho(dados, contexto({ convocacao: null }))).toEqual([
      "Esta pessoa não está convocada para este evento.",
    ]);
  });

  it("recusa quem foi convocado so como staff", () => {
    const conv: ConvocacaoParaDesempenho = { estado: "presente", papel: "staff", equipeId: 10 };
    expect(validarDesempenho(dados, contexto({ convocacao: conv }))).toEqual([
      "Esta pessoa foi convocada como staff e não joga neste evento.",
    ]);
  });

  it("recusa quem nao tem presenca registrada como presente ou atrasou", () => {
    for (const estado of ["convocado", "confirmado", "faltou", "justificado"] as const) {
      const conv: ConvocacaoParaDesempenho = { estado, papel: "jogador", equipeId: 10 };
      expect(validarDesempenho(dados, contexto({ convocacao: conv }))).toEqual([
        "Registre a presença da pessoa (presente ou atrasou) antes de lançar o desempenho.",
      ]);
    }
  });
});

describe("validarDesempenho: posicao, campeao e KDA", () => {
  it("recusa posicao invalida", () => {
    expect(validarDesempenho({ ...dados, posicao: "Baron" as never }, contexto())).toHaveLength(1);
  });

  it("aceita campeao novo (fora da lista) e recusa texto estranho", () => {
    expect(validarDesempenho({ ...dados, campeao: "Zzyzx" }, contexto())).toEqual([]);
    expect(validarDesempenho({ ...dados, campeao: "<b>" }, contexto())).toEqual([
      "Informe um campeão válido.",
    ]);
  });

  it("recusa KDA parcial", () => {
    expect(validarDesempenho({ ...dados, mortes: null }, contexto())).toEqual([
      "Informe abates, mortes e assistências juntos (ou deixe os três em branco).",
    ]);
  });

  it("recusa KDA fora de 0 a 99 ou nao inteiro", () => {
    for (const valor of [-1, 100, 1.5]) {
      expect(validarDesempenho({ ...dados, abates: valor }, contexto())).toHaveLength(1);
    }
  });
});

describe("validarDesempenho: escalacao da partida", () => {
  it("recusa a mesma pessoa duas vezes na partida", () => {
    const outros = [reg(1, 10, "Mid", "Ahri")];
    expect(validarDesempenho(dados, contexto({ outrosRegistros: outros }))).toContain(
      "Esta pessoa já tem desempenho registrado nesta partida.",
    );
  });

  it("recusa posicao repetida no mesmo lado", () => {
    const outros = [reg(2, 10, "Top", "Ahri")];
    expect(validarDesempenho(dados, contexto({ outrosRegistros: outros }))).toContain(
      "Já existe um jogador de Top registrado pela equipe nesta partida.",
    );
  });

  it("aceita a mesma posicao no outro lado (confronto interno)", () => {
    const interno = contexto({
      equipeIds: [10, 20],
      convocacao: { estado: "presente", papel: "jogador", equipeId: 10 },
      outrosRegistros: [reg(2, 20, "Top", "Ahri")],
    });
    expect(validarDesempenho(dados, interno)).toEqual([]);
  });

  it("recusa campeao repetido no mesmo lado, mesmo com escrita diferente", () => {
    const outros = [reg(2, 10, "Mid", "garen")];
    expect(validarDesempenho(dados, contexto({ outrosRegistros: outros }))).toContain(
      "Garen já foi registrado pela equipe nesta partida.",
    );
  });

  it("recusa o sexto jogador do mesmo lado", () => {
    const outros = [
      reg(2, 10, "Top", "Ahri"),
      reg(3, 10, "Jungle", "Lee Sin"),
      reg(4, 10, "Mid", "Zed"),
      reg(5, 10, "ADC", "Jinx"),
      reg(6, 10, "Support", "Thresh"),
    ];
    expect(validarDesempenho(dados, contexto({ outrosRegistros: outros }))).toContain(
      "A equipe já tem 5 jogadores registrados nesta partida.",
    );
  });

  it("recusa evento sem equipe da organizacao", () => {
    expect(validarDesempenho(dados, contexto({ equipeIds: [] }))).toContain(
      "Este evento não tem equipe da organização.",
    );
  });
});

describe("resolverLado", () => {
  const conv20: ConvocacaoParaDesempenho = { estado: "presente", papel: "jogador", equipeId: 20 };
  const avulso: ConvocacaoParaDesempenho = { estado: "presente", papel: "jogador", equipeId: null };

  it("externo: o lado e a unica equipe do evento", () => {
    expect(resolverLado(undefined, [10], null)).toEqual({ equipeId: 10, erro: null });
  });

  it("externo: recusa equipe que nao e a do evento", () => {
    expect(resolverLado(99, [10], null).erro).toBe("A equipe informada não participa deste evento.");
  });

  it("interno: usa a equipe da convocacao", () => {
    expect(resolverLado(undefined, [10, 20], conv20)).toEqual({ equipeId: 20, erro: null });
  });

  it("interno: recusa lado diferente do da convocacao", () => {
    expect(resolverLado(10, [10, 20], conv20).erro).toBe(
      "No confronto interno, esta pessoa só pode jogar pela equipe em que foi convocada.",
    );
  });

  it("interno com convocacao avulsa: exige informar o lado", () => {
    expect(resolverLado(undefined, [10, 20], avulso).erro).toBe(
      "Informe por qual equipe a pessoa jogou.",
    );
  });

  it("interno com convocacao avulsa: aceita um dos dois lados", () => {
    expect(resolverLado(20, [10, 20], avulso)).toEqual({ equipeId: 20, erro: null });
  });

  it("interno com convocacao avulsa: recusa equipe estranha", () => {
    expect(resolverLado(99, [10, 20], avulso).erro).toBe(
      "A equipe informada não participa deste evento.",
    );
  });
});

describe("avisosDeDesempenho", () => {
  const alfa = { id: 10, nome: "Alfa" };
  const beta = { id: 20, nome: "Beta" };

  it("avisa quando ha menos de 5 jogadores registrados no lado", () => {
    const registros = [reg(1, 10, "Top", "Garen"), reg(2, 10, "Mid", "Ahri")];
    expect(avisosDeDesempenho(registros, [alfa])).toEqual(["Alfa: 2 de 5 jogadores registrados."]);
  });

  it("nao avisa com 5 registrados nem com nenhum", () => {
    const cinco = [
      reg(1, 10, "Top", "Garen"),
      reg(2, 10, "Jungle", "Lee Sin"),
      reg(3, 10, "Mid", "Ahri"),
      reg(4, 10, "ADC", "Jinx"),
      reg(5, 10, "Support", "Thresh"),
    ];
    expect(avisosDeDesempenho(cinco, [alfa])).toEqual([]);
    expect(avisosDeDesempenho([], [alfa])).toEqual([]);
  });

  it("confronto interno: avisa o mesmo campeao nos dois lados", () => {
    const registros = [reg(1, 10, "Top", "Garen"), reg(2, 20, "Top", "garen")];
    expect(avisosDeDesempenho(registros, [alfa, beta])).toContain("Garen aparece nos dois lados.");
  });
});