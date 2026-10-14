import { emMinutos } from "./tempo";
import type { StatusEvento, TipoEvento } from "./tipos";

// O minimo que precisamos saber de um evento ja existente
export interface EventoParaConflito {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  inicio: string;
  duracaoMin: number;
  status: StatusEvento;
  equipeIds: number[];
}

// O evento que esta sendo criado ou editado
export interface NovoEvento {
  inicio: string;
  duracaoMin: number;
  equipeIds: number[];
}

// Quais eventos ja existentes colidem com o novo? Colidir = dividir ao menos uma
// equipe E se sobrepor no tempo. Eventos cancelados nao contam, e eventos que apenas
// "encostam" (um termina quando o outro comeca) tambem nao.
export function encontrarConflitos(
  novo: NovoEvento,
  existentes: EventoParaConflito[],
  ignorarId?: number,
): EventoParaConflito[] {
  const inicioNovo = emMinutos(novo.inicio);
  const fimNovo = inicioNovo + novo.duracaoMin;

  return existentes.filter((existente) => {
    if (existente.id === ignorarId) return false;
    if (existente.status === "cancelado") return false;

    const dividemEquipe = existente.equipeIds.some((id) => novo.equipeIds.includes(id));
    if (!dividemEquipe) return false;

    const inicioExistente = emMinutos(existente.inicio);
    const fimExistente = inicioExistente + existente.duracaoMin;

    // Dois intervalos se sobrepoem quando cada um comeca ANTES de o outro terminar
    return inicioNovo < fimExistente && inicioExistente < fimNovo;
  });
}