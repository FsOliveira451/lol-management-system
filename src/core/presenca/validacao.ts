import { emMinutos } from "../eventos/tempo";
import type { StatusEvento } from "../eventos/tipos";
import { ESTADOS_PRESENCA, ehEstadoFinal, type EstadoPresenca } from "./tipos";

// Pode marcar este estado agora? Devolve a lista de erros (vazia = pode).
// "agora" vem do programa, nunca da tela.
export function validarEstadoPresenca(
  estado: EstadoPresenca,
  evento: { status: StatusEvento; inicio: string },
  agora: string,
): string[] {
  if (!(ESTADOS_PRESENCA as readonly string[]).includes(estado)) {
    return ["Estado de presença inválido."];
  }
  if (evento.status === "cancelado") {
    return ["Evento cancelado não tem controle de presença."];
  }
  if (ehEstadoFinal(estado) && emMinutos(agora) < emMinutos(evento.inicio)) {
    return ["Só é possível registrar presença, atraso ou falta depois que o evento começar."];
  }
  return [];
}