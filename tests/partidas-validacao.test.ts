import { describe, expect, it } from "vitest";
import { avisosDePartidas, validarPartida, type ContextoPartida } from "../src/core/partidas/validacao";

function contexto(extra: Partial<ContextoPartida> = {}): ContextoPartida {
  return {
    tipo: "scrim",
    status: "agendado",
    inicio: "2026-10-20 19:00",
    equipeIds: [1],
    numerosExistentes: [],
    ...extra,
  };
}

const AGORA = "2026-10-20 20:00";

describe("validarPartida: registro valido", () => {
  it("aceita vitoria contra adversario externo", () => {
    expect(validarPartida({ numero: 1, vencedorEquipeId: 1 }, contexto(), AGORA)).toEqual([]);
  });

  it("aceita derrota (vencedor null = o adversario venceu)", () => {
    expect(validarPartida({ numero: 1, vencedorEquipeId: null }, contexto(), AGORA)).toEqual([]);
  });

  it("aceita evento ja marcado como realizado", () => {
    expect(
      validarPartida({ numero: 2, vencedorEquipeId: 1 }, contexto({ status: "realizado" }), AGORA),
    ).toEqual([]);
  });

  it("aceita a partir do exato horario de inicio", () => {
    expect(
      validarPartida({ numero: 1, vencedorEquipeId: 1 }, contexto(), "2026-10-20 19:00"),
    ).toEqual([]);
  });
});

describe("validarPartida: o evento", () => {
  it("recusa tipos sem partidas", () => {
    for (const tipo of ["treino", "tryout", "vod", "reuniao"] as const) {
      expect(validarPartida({ numero: 1, vencedorEquipeId: 1 }, contexto({ tipo }), AGORA)).toEqual([
        "Este tipo de evento não tem partidas.",
      ]);
    }
  });

  it("recusa evento cancelado", () => {
    expect(
      validarPartida({ numero: 1, vencedorEquipeId: 1 }, contexto({ status: "cancelado" }), AGORA),
    ).toEqual(["Evento cancelado não tem partidas."]);
  });

  it("recusa antes do inicio do evento", () => {
    expect(
      validarPartida({ numero: 1, vencedorEquipeId: 1 }, contexto(), "2026-10-20 18:59"),
    ).toEqual(["Só é possível registrar partidas depois que o evento começar."]);
  });

  it("recusa evento sem equipe da organizacao", () => {
    const erros = validarPartida({ numero: 1, vencedorEquipeId: null }, contexto({ equipeIds: [] }), AGORA);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("não tem equipe");
  });

  it("recusa horario atual invalido", () => {
    expect(validarPartida({ numero: 1, vencedorEquipeId: 1 }, contexto(), "ontem")).toEqual([
      "Horário inválido.",
    ]);
  });
});

describe("validarPartida: numero e vencedor", () => {
  it("recusa numero fora de 1 a 9 ou nao inteiro", () => {
    for (const numero of [0, 10, 1.5, -1]) {
      expect(validarPartida({ numero, vencedorEquipeId: 1 }, contexto(), AGORA)).toHaveLength(1);
    }
    expect(validarPartida({ vencedorEquipeId: 1 }, contexto(), AGORA)).toHaveLength(1);
  });

  it("recusa numero repetido no mesmo evento", () => {
    expect(
      validarPartida({ numero: 2, vencedorEquipeId: 1 }, contexto({ numerosExistentes: [1, 2] }), AGORA),
    ).toEqual(["Já existe a partida 2 neste evento."]);
  });

  it("exige informar o vencedor", () => {
    expect(validarPartida({ numero: 1 }, contexto(), AGORA)).toEqual([
      "Informe quem venceu a partida.",
    ]);
  });

  it("externo: recusa vencedor que e outra equipe", () => {
    expect(validarPartida({ numero: 1, vencedorEquipeId: 9 }, contexto(), AGORA)).toEqual([
      "O vencedor deve ser a equipe do evento ou o adversário.",
    ]);
  });

  it("confronto interno: aceita qualquer uma das duas equipes", () => {
    const interno = contexto({ equipeIds: [1, 2] });
    expect(validarPartida({ numero: 1, vencedorEquipeId: 1 }, interno, AGORA)).toEqual([]);
    expect(validarPartida({ numero: 2, vencedorEquipeId: 2 }, interno, AGORA)).toEqual([]);
  });

  it("confronto interno: recusa null e equipe estranha", () => {
    const interno = contexto({ equipeIds: [1, 2] });
    expect(validarPartida({ numero: 1, vencedorEquipeId: null }, interno, AGORA)).toHaveLength(1);
    expect(validarPartida({ numero: 1, vencedorEquipeId: 3 }, interno, AGORA)).toHaveLength(1);
  });
});

describe("validarPartida: duracao e observacoes", () => {
  it("duracao e opcional e vai de 5 a 180 minutos inteiros", () => {
    const base = { numero: 1, vencedorEquipeId: 1 };
    expect(validarPartida({ ...base, duracaoMin: null }, contexto(), AGORA)).toEqual([]);
    expect(validarPartida({ ...base, duracaoMin: 45 }, contexto(), AGORA)).toEqual([]);
    for (const duracaoMin of [4, 181, 30.5]) {
      expect(validarPartida({ ...base, duracaoMin }, contexto(), AGORA)).toHaveLength(1);
    }
  });

  it("observacoes aceitam ate 500 caracteres", () => {
    const base = { numero: 1, vencedorEquipeId: 1 };
    expect(validarPartida({ ...base, observacoes: "a".repeat(500) }, contexto(), AGORA)).toEqual([]);
    expect(validarPartida({ ...base, observacoes: "a".repeat(501) }, contexto(), AGORA)).toHaveLength(1);
  });
});

describe("avisosDePartidas", () => {
  it("avisa quando ha mais partidas do que previstas", () => {
    expect(avisosDePartidas(3, [1, 2, 3, 4])).toEqual([
      "Há mais partidas registradas (4) do que previstas (3).",
    ]);
  });

  it("avisa quais numeros faltam na sequencia", () => {
    expect(avisosDePartidas(null, [1, 4])).toEqual(["Faltam partidas na sequência: 2, 3."]);
  });

  it("menos partidas que as previstas e normal (2 a 0 num BO3): sem aviso", () => {
    expect(avisosDePartidas(3, [1, 2])).toEqual([]);
  });

  it("sem previstas e sem partidas: sem aviso", () => {
    expect(avisosDePartidas(null, [])).toEqual([]);
  });
});