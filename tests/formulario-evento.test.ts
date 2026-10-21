import { describe, expect, it } from "vitest";
import {
  converterFormularioEvento,
  valoresDoEvento,
  valoresIniciais,
} from "../src/renderer/formulario-evento";
import type { ValoresFormularioEvento } from "../src/renderer/formulario-evento";
import type { Evento } from "../src/core/eventos/tipos";

function valores(extra: Partial<ValoresFormularioEvento> = {}): ValoresFormularioEvento {
  return { ...valoresIniciais("2026-10-20"), equipeIds: [1], ...extra };
}

describe("valoresIniciais", () => {
  it("comeca como treino as 19:00, ja com o dia escolhido", () => {
    const inicial = valoresIniciais("2026-10-20");
    expect(inicial.data).toBe("2026-10-20");
    expect(inicial.hora).toBe("19:00");
    expect(inicial.tipo).toBe("treino");
    expect(inicial.equipeIds).toEqual([]);
  });
});

describe("converterFormularioEvento", () => {
  it("junta data e hora no formato do sistema", () => {
    expect(converterFormularioEvento(valores()).inicio).toBe("2026-10-20 19:00");
  });

  it("duracao vazia usa a padrao do tipo", () => {
    expect(converterFormularioEvento(valores({ tipo: "campeonato" })).duracaoMin).toBe(180);
    expect(converterFormularioEvento(valores({ tipo: "vod" })).duracaoMin).toBe(60);
  });

  it("duracao informada vira numero", () => {
    expect(converterFormularioEvento(valores({ duracao: "90" })).duracaoMin).toBe(90);
  });

  it("limpa adversario, nivel e partidas em tipo sem adversario", () => {
    const dados = converterFormularioEvento(
      valores({ tipo: "treino", adversario: "Time X", nivelAdversario: "superior", partidas: "3" }),
    );
    expect(dados.adversario).toBeNull();
    expect(dados.nivelAdversario).toBeNull();
    expect(dados.partidasPrevistas).toBeNull();
  });

  it("limpa o adversario no confronto interno (2 equipes)", () => {
    const dados = converterFormularioEvento(
      valores({ tipo: "scrim", equipeIds: [1, 2], adversario: "Time X", partidas: "3" }),
    );
    expect(dados.adversario).toBeNull();
    expect(dados.partidasPrevistas).toBeNull();
  });

  it("mantem adversario, nivel e partidas em scrim com 1 equipe", () => {
    const dados = converterFormularioEvento(
      valores({ tipo: "scrim", adversario: " Time X ", nivelAdversario: "semelhante", partidas: "3" }),
    );
    expect(dados.adversario).toBe("Time X");
    expect(dados.nivelAdversario).toBe("semelhante");
    expect(dados.partidasPrevistas).toBe(3);
  });

  it("texto vazio vira null", () => {
    const dados = converterFormularioEvento(valores({ titulo: "  ", objetivo: "", local: " " }));
    expect(dados.titulo).toBeNull();
    expect(dados.objetivo).toBeNull();
    expect(dados.local).toBeNull();
  });
});

describe("valoresDoEvento", () => {
  it("ida e volta: evento -> formulario -> dados devolve o mesmo conteudo", () => {
    const evento: Evento = {
      id: 7,
      tipo: "scrim",
      titulo: "Scrim de sexta",
      inicio: "2026-10-23 20:30",
      duracaoMin: 150,
      status: "agendado",
      adversario: "Time X",
      nivelAdversario: "superior",
      partidasPrevistas: 3,
      objetivo: "Testar composição",
      local: "Discord",
      regras: null,
      observacoes: null,
      criadoEm: "2026-10-20 12:00:00",
      atualizadoEm: "2026-10-20 12:00:00",
      equipes: [{ id: 1, nome: "Alfa" }],
    };

    const formulario = valoresDoEvento(evento);
    expect(formulario.data).toBe("2026-10-23");
    expect(formulario.hora).toBe("20:30");
    expect(formulario.duracao).toBe("150");

    expect(converterFormularioEvento(formulario)).toEqual({
      tipo: "scrim",
      titulo: "Scrim de sexta",
      inicio: "2026-10-23 20:30",
      duracaoMin: 150,
      equipeIds: [1],
      adversario: "Time X",
      nivelAdversario: "superior",
      partidasPrevistas: 3,
      objetivo: "Testar composição",
      local: "Discord",
      regras: null,
      observacoes: null,
    });
  });
});