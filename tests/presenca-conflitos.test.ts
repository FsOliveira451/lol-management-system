import { describe, expect, it } from "vitest";
import { eventosEmConflitoDaPessoa, type EventoDaPessoa } from "../src/core/presenca/conflitos-pessoa";

function evento(eventoId: number, inicio: string, duracaoMin: number, status: EventoDaPessoa["status"] = "agendado"): EventoDaPessoa {
  return { eventoId, inicio, duracaoMin, status };
}

const novo = { inicio: "2026-10-20 19:00", duracaoMin: 120 };

describe("eventosEmConflitoDaPessoa", () => {
  it("detecta sobreposicao parcial", () => {
    expect(eventosEmConflitoDaPessoa(novo, [evento(1, "2026-10-20 20:00", 60)])).toEqual([1]);
  });

  it("eventos que apenas encostam nao conflitam", () => {
    expect(eventosEmConflitoDaPessoa(novo, [evento(1, "2026-10-20 21:00", 60)])).toEqual([]);
    expect(eventosEmConflitoDaPessoa(novo, [evento(2, "2026-10-20 18:00", 60)])).toEqual([]);
  });

  it("eventos cancelados nao contam", () => {
    expect(eventosEmConflitoDaPessoa(novo, [evento(1, "2026-10-20 19:30", 60, "cancelado")])).toEqual([]);
  });

  it("pode ignorar o proprio evento (ao editar)", () => {
    expect(eventosEmConflitoDaPessoa(novo, [evento(1, "2026-10-20 19:30", 60)], 1)).toEqual([]);
  });

  it("outro dia nao conflita; varios conflitos voltam na ordem recebida", () => {
    const outros = [
      evento(1, "2026-10-21 19:00", 120),
      evento(2, "2026-10-20 18:00", 90),
      evento(3, "2026-10-20 20:30", 30),
    ];
    expect(eventosEmConflitoDaPessoa(novo, outros)).toEqual([2, 3]);
  });
});