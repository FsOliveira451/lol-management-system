import { describe, it, expect } from "vitest";
import type { DadosEvento } from "../src/core/eventos/tipos";
import { validarDadosEvento } from "../src/core/eventos/validacao";

// Um treino valido; cada teste muda so o que importa
function treino(extra: DadosEvento = {}): DadosEvento {
  return { tipo: "treino", inicio: "2026-10-20 19:30", equipeIds: [1], ...extra };
}

describe("validarDadosEvento", () => {
  it("aceita um treino mínimo", () => {
    expect(validarDadosEvento(treino())).toEqual([]);
  });

  it("exige o tipo", () => {
    expect(validarDadosEvento(treino({ tipo: undefined }))).toContain("Escolha o tipo do evento.");
  });

  it("recusa data e horário impossíveis", () => {
    const erros = validarDadosEvento(treino({ inicio: "2026-02-30 19:30" }));
    expect(erros).toContain("Informe uma data e um horário válidos.");
  });

  it.each([14, 721, 90.5])("recusa a duração %s", (duracaoMin) => {
    const erros = validarDadosEvento(treino({ duracaoMin }));
    expect(erros).toContain("A duração deve ser um número inteiro de 15 a 720 minutos.");
  });

  it("recusa título com mais de 80 caracteres", () => {
    expect(validarDadosEvento(treino({ titulo: "x".repeat(81) }))).toHaveLength(1);
  });

  it("treino: exige ao menos uma equipe", () => {
    expect(validarDadosEvento(treino({ equipeIds: [] }))).toContain(
      "Escolha ao menos uma equipe para o treino.",
    );
  });

  it("treino: aceita até duas equipes e recusa três", () => {
    expect(validarDadosEvento(treino({ equipeIds: [1, 2] }))).toEqual([]);
    expect(validarDadosEvento(treino({ equipeIds: [1, 2, 3] }))).toContain(
      "Um treino reúne no máximo duas equipes.",
    );
  });

  it("treino: não tem adversário", () => {
    expect(validarDadosEvento(treino({ adversario: "Time Rival" }))).toContain(
      "Treino não tem adversário.",
    );
  });

  it("VOD: exige exatamente uma equipe", () => {
    expect(validarDadosEvento(treino({ tipo: "vod" }))).toEqual([]);
    expect(validarDadosEvento(treino({ tipo: "vod", equipeIds: [1, 2] }))).toHaveLength(1);
    expect(validarDadosEvento(treino({ tipo: "vod", equipeIds: [] }))).toHaveLength(1);
  });

  it("tryout: aceita sem equipe e recusa duas", () => {
    expect(validarDadosEvento(treino({ tipo: "tryout", equipeIds: [] }))).toEqual([]);
    expect(validarDadosEvento(treino({ tipo: "tryout", equipeIds: [1, 2] }))).toHaveLength(1);
  });

  it("reunião: aceita sem equipes (geral) e recusa adversário", () => {
    expect(validarDadosEvento(treino({ tipo: "reuniao", equipeIds: [] }))).toEqual([]);
    expect(validarDadosEvento(treino({ tipo: "reuniao", adversario: "Rival" }))).toHaveLength(1);
  });

  it("scrim com adversário externo e uma equipe nossa é válido", () => {
    const erros = validarDadosEvento(treino({ tipo: "scrim", adversario: "Time Rival" }));
    expect(erros).toEqual([]);
  });

  it("scrim com adversário externo exige exatamente uma equipe", () => {
    const erros = validarDadosEvento(
      treino({ tipo: "scrim", adversario: "Time Rival", equipeIds: [1, 2] }),
    );
    expect(erros).toContain("Com adversário externo, escolha exatamente uma equipe da organização.");
  });

  it("scrim sem adversário e com duas equipes é um confronto interno válido", () => {
    expect(validarDadosEvento(treino({ tipo: "scrim", equipeIds: [1, 2] }))).toEqual([]);
  });

  it("scrim sem adversário e com uma equipe é recusado", () => {
    expect(validarDadosEvento(treino({ tipo: "scrim", equipeIds: [1] }))).toHaveLength(1);
  });

  it("amistoso: aceita de 1 a 9 partidas e recusa fora disso", () => {
    const base = { tipo: "amistoso", adversario: "Time Rival" } as const;
    expect(validarDadosEvento(treino({ ...base, partidasPrevistas: 3 }))).toEqual([]);
    expect(validarDadosEvento(treino({ ...base, partidasPrevistas: 9 }))).toEqual([]);
    expect(validarDadosEvento(treino({ ...base, partidasPrevistas: 0 }))).toHaveLength(1);
    expect(validarDadosEvento(treino({ ...base, partidasPrevistas: 10 }))).toHaveLength(1);
  });

  it("treino não aceita quantidade de partidas", () => {
    expect(validarDadosEvento(treino({ partidasPrevistas: 3 }))).toContain(
      "A quantidade de partidas só vale para scrim, amistoso e campeonato.",
    );
  });

  it("recusa equipes repetidas", () => {
    expect(validarDadosEvento(treino({ equipeIds: [1, 1] }))).toContain(
      "As equipes escolhidas são inválidas ou estão repetidas.",
    );
  });

  it("recusa nível de adversário inexistente", () => {
    const erros = validarDadosEvento(
      treino({ tipo: "scrim", adversario: "Rival", nivelAdversario: "lendario" as never }),
    );
    expect(erros).toContain("Nível do adversário inválido.");
  });
});