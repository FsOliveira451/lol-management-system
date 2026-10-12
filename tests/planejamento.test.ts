import { describe, it, expect } from "vitest";
import type { Posicao } from "../src/core/jogadores/tipos";
import type { FuncaoEquipe, ParticipacaoDaPessoa } from "../src/core/equipes/tipos";
import {
  planejarAcao,
  type EntradaPlano,
  type MembroResumo,
} from "../src/core/equipes/planejamento";

function membro(
  id: number,
  jogadorId: number,
  apelido: string,
  funcao: FuncaoEquipe,
  posicao: Posicao | null = null,
): MembroResumo {
  return { id, jogadorId, apelido, funcao, posicao };
}

// Padrao: Bia (id 10) vai ser titular Mid da equipe 1, que esta vazia
function entrada(extra: Partial<EntradaPlano> = {}): EntradaPlano {
  return {
    equipeId: 1,
    pessoa: { id: 10, apelido: "Bia" },
    funcao: "titular",
    posicao: "Mid",
    membrosAtivos: [],
    participacoesDaPessoa: [],
    opcoes: {
      anteriorVaiParaReserva: true,
      liberarEmOutraEquipe: true,
      outraEquipeVaiParaReserva: true,
    },
    ...extra,
  };
}

const anaTitularMid = membro(1, 20, "Ana", "titular", "Mid");

const biaTitularEmBravo: ParticipacaoDaPessoa = {
  participacaoId: 99,
  equipeId: 2,
  equipeNome: "Bravo",
  funcao: "titular",
  posicao: "Top",
};

describe("planejarAcao: titular", () => {
  it("vaga livre: escala direto, sem motivo", () => {
    const plano = planejarAcao(entrada());
    expect(plano).toMatchObject({ acao: "escalar_titular", precisaMotivo: false, bloqueio: null });
    expect(plano.passos).toEqual(["Bia entra como titular de Mid."]);
  });

  it("posição ocupada: oferece trocar, e o titular atual pode virar reserva", () => {
    const plano = planejarAcao(entrada({ membrosAtivos: [anaTitularMid] }));
    expect(plano.ocupante?.apelido).toBe("Ana");
    expect(plano.precisaMotivo).toBe(true);
    expect(plano.passos[0]).toContain("passa a reserva");
  });

  it("posição ocupada, sem mover para reserva: o titular atual apenas sai", () => {
    const plano = planejarAcao(
      entrada({
        membrosAtivos: [anaTitularMid],
        opcoes: {
          anteriorVaiParaReserva: false,
          liberarEmOutraEquipe: true,
          outraEquipeVaiParaReserva: true,
        },
      }),
    );
    expect(plano.passos[0]).toBe("Ana deixa a posição Mid.");
  });

  it("bloqueia escalar a mesma pessoa que já é a titular da posição", () => {
    const plano = planejarAcao(entrada({ membrosAtivos: [membro(1, 10, "Bia", "titular", "Mid")] }));
    expect(plano.bloqueio).toContain("já é o titular");
  });

  it("titular em outra equipe, sem liberar: bloqueia e cita a equipe", () => {
    const plano = planejarAcao(
      entrada({
        participacoesDaPessoa: [biaTitularEmBravo],
        opcoes: {
          anteriorVaiParaReserva: true,
          liberarEmOutraEquipe: false,
          outraEquipeVaiParaReserva: true,
        },
      }),
    );
    expect(plano.bloqueio).toContain("Bravo");
    expect(plano.titularEmOutraEquipe?.equipeNome).toBe("Bravo");
  });

  it("titular em outra equipe, liberando: transfere (vira reserva lá)", () => {
    const plano = planejarAcao(entrada({ participacoesDaPessoa: [biaTitularEmBravo] }));
    expect(plano.bloqueio).toBeNull();
    expect(plano.precisaMotivo).toBe(true);
    expect(plano.passos.some((passo) => passo.includes("passa a reserva lá"))).toBe(true);
  });

  it("quem já é reserva da equipe é promovida a titular", () => {
    const plano = planejarAcao(entrada({ membrosAtivos: [membro(5, 10, "Bia", "reserva")] }));
    expect(plano.acao).toBe("escalar_titular");
    expect(plano.jogoNaEquipe?.id).toBe(5);
    expect(plano.passos[plano.passos.length - 1]).toContain("deixa de ser reserva");
  });

  it("titular sem posição escolhida: bloqueia", () => {
    const plano = planejarAcao(entrada({ posicao: null }));
    expect(plano.bloqueio).toBe("Escolha a posição.");
  });
});

describe("planejarAcao: reserva, academia, capitão e coach", () => {
  it("nova reserva: apenas adiciona, sem motivo", () => {
    const plano = planejarAcao(entrada({ funcao: "reserva", posicao: null }));
    expect(plano).toMatchObject({ acao: "adicionar", precisaMotivo: false });
  });

  it("quem já é reserva e escolhe reserva de novo: bloqueia", () => {
    const plano = planejarAcao(
      entrada({ funcao: "reserva", posicao: null, membrosAtivos: [membro(5, 10, "Bia", "reserva")] }),
    );
    expect(plano.bloqueio).toContain("já é reserva");
  });

  it("quem já é reserva e escolhe academia: troca de função, com motivo", () => {
    const plano = planejarAcao(
      entrada({ funcao: "academia", posicao: null, membrosAtivos: [membro(5, 10, "Bia", "reserva")] }),
    );
    expect(plano).toMatchObject({ acao: "trocar_funcao", precisaMotivo: true });
  });

  it("primeiro capitão: designa sem motivo", () => {
    const plano = planejarAcao(entrada({ funcao: "capitao", posicao: null }));
    expect(plano).toMatchObject({ acao: "designar_staff", precisaMotivo: false });
  });

  it("capitão já existe (outra pessoa): substitui, com motivo", () => {
    const plano = planejarAcao(
      entrada({ funcao: "capitao", posicao: null, membrosAtivos: [membro(7, 20, "Ana", "capitao")] }),
    );
    expect(plano.precisaMotivo).toBe(true);
    expect(plano.passos).toHaveLength(2);
  });

  it("a própria pessoa já é o capitão: bloqueia", () => {
    const plano = planejarAcao(
      entrada({ funcao: "capitao", posicao: null, membrosAtivos: [membro(7, 10, "Bia", "capitao")] }),
    );
    expect(plano.bloqueio).toContain("já é capitão");
  });
});