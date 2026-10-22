import type { FuncaoEquipe } from "../equipes/tipos";

// Listas oficiais (a "fonte da verdade") e os tipos derivados delas
export const ESTADOS_PRESENCA = [
  "convocado",
  "confirmado",
  "presente",
  "atrasou",
  "faltou",
  "justificado",
] as const;

export type EstadoPresenca = (typeof ESTADOS_PRESENCA)[number];

// Estados que registram o que ACONTECEU (os outros dois sao "antes do evento")
export const ESTADOS_FINAIS = ["presente", "atrasou", "faltou", "justificado"] as const;

export function ehEstadoFinal(estado: EstadoPresenca): boolean {
  return (ESTADOS_FINAIS as readonly string[]).includes(estado);
}

export const ROTULO_PRESENCA: Record<EstadoPresenca, string> = {
  convocado: "Convocado",
  confirmado: "Confirmado",
  presente: "Presente",
  atrasou: "Atrasou",
  faltou: "Faltou",
  justificado: "Falta justificada",
};

export const ICONE_PRESENCA: Record<EstadoPresenca, string> = {
  convocado: "📨",
  confirmado: "👍",
  presente: "✅",
  atrasou: "⏰",
  faltou: "❌",
  justificado: "📝",
};

export type PapelConvocado = "jogador" | "staff";

// Uma pessoa convocada para um evento, pela equipe indicada
export interface Convocado {
  jogadorId: number;
  equipeId: number;
  funcao: FuncaoEquipe;
  papel: PapelConvocado;
}


// Uma convocacao como ela existe no sistema (com os nomes, para mostrar na tela)
export interface ConvocacaoEvento {
  id: number;
  eventoId: number;
  jogadorId: number;
  apelido: string;
  equipeId: number | null; // null = convocacao avulsa
  equipeNome: string | null;
  funcao: FuncaoEquipe | null;
  papel: PapelConvocado;
  estado: EstadoPresenca;
  atualizadoEm: string;
}