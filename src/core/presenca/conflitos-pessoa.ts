import { emMinutos } from "../eventos/tempo";
import type { StatusEvento } from "../eventos/tipos";

export interface EventoDaPessoa {
  eventoId: number;
  inicio: string; // "AAAA-MM-DD HH:MM"
  duracaoMin: number;
  status: StatusEvento;
}

// Quais eventos JA CONVOCADOS da pessoa se chocam com este horario?
// Eventos que apenas encostam (um termina quando o outro comeca) nao conflitam.
// Cancelados nao contam.
export function eventosEmConflitoDaPessoa(
  novo: { inicio: string; duracaoMin: number },
  outros: EventoDaPessoa[],
  ignorarEventoId?: number,
): number[] {
  const inicioNovo = emMinutos(novo.inicio);
  const fimNovo = inicioNovo + novo.duracaoMin;

  return outros
    .filter((outro) => {
      if (outro.status === "cancelado") return false;
      if (outro.eventoId === ignorarEventoId) return false;
      const inicioOutro = emMinutos(outro.inicio);
      const fimOutro = inicioOutro + outro.duracaoMin;
      return inicioNovo < fimOutro && inicioOutro < fimNovo;
    })
    .map((outro) => outro.eventoId);
}