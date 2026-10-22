import { describe, expect, it } from "vitest";
import { validarEstadoPresenca } from "../src/core/presenca/validacao";

const evento = { status: "agendado" as const, inicio: "2026-10-20 19:00" };

describe("validarEstadoPresenca", () => {
  it("antes do inicio so aceita convocado e confirmado", () => {
    expect(validarEstadoPresenca("confirmado", evento, "2026-10-20 10:00")).toEqual([]);
    expect(validarEstadoPresenca("convocado", evento, "2026-10-20 10:00")).toEqual([]);
  });

  it("antes do inicio recusa presente, atrasou, faltou e justificado", () => {
    for (const estado of ["presente", "atrasou", "faltou", "justificado"] as const) {
      expect(validarEstadoPresenca(estado, evento, "2026-10-20 10:00")).toHaveLength(1);
    }
  });

  it("a partir do inicio aceita os estados finais", () => {
    expect(validarEstadoPresenca("presente", evento, "2026-10-20 19:00")).toEqual([]);
    expect(validarEstadoPresenca("faltou", evento, "2026-10-21 08:00")).toEqual([]);
  });

  it("evento cancelado nao tem controle de presenca", () => {
    const cancelado = { status: "cancelado" as const, inicio: "2026-10-20 19:00" };
    expect(validarEstadoPresenca("presente", cancelado, "2026-10-21 08:00")).toHaveLength(1);
  });

  it("estado desconhecido e recusado", () => {
    expect(validarEstadoPresenca("xyz" as never, evento, "2026-10-21 08:00")).toEqual([
      "Estado de presença inválido.",
    ]);
  });
});