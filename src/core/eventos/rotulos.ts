// Textos legiveis para eventos. Logica pura.
import { fimDoEvento, interpretarDataHora } from "./tempo";
import type { SituacaoEvento } from "./tempo";
import { NOME_TIPO_EVENTO } from "./tipos";
import type { Evento, TipoEvento } from "./tipos";

export const ICONE_TIPO: Record<TipoEvento, string> = {
  treino: "🏋️",
  scrim: "⚔️",
  amistoso: "🤝",
  tryout: "🎯",
  vod: "🎬",
  reuniao: "💬",
  campeonato: "🏆",
};

export const ROTULO_SITUACAO: Record<SituacaoEvento, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  pendente_registro: "Pendente de registro",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

// O nome que aparece no calendario e nas listas
export function rotuloDoEvento(
  evento: Pick<Evento, "tipo" | "titulo" | "adversario" | "equipes">,
): string {
  const tipo = NOME_TIPO_EVENTO[evento.tipo];

  if (evento.titulo !== null && evento.titulo.trim() !== "") return evento.titulo.trim();
  if (evento.adversario !== null && evento.adversario.trim() !== "") {
    return `${tipo} vs ${evento.adversario.trim()}`;
  }
  if (evento.equipes.length === 2) {
    return `${tipo}: ${evento.equipes[0]!.nome} × ${evento.equipes[1]!.nome}`;
  }
  if (evento.equipes.length === 1) return `${tipo} · ${evento.equipes[0]!.nome}`;
  return `${tipo} (geral)`;
}

// "2026-10-20 19:00" -> "20/10/2026, 19:00"
export function formatarInicio(inicio: string): string {
  const partes = interpretarDataHora(inicio);
  if (partes === null) return inicio;
  return (
    `${doisDigitos(partes.dia)}/${doisDigitos(partes.mes)}/${partes.ano}, ` +
    `${doisDigitos(partes.hora)}:${doisDigitos(partes.minuto)}`
  );
}

// "20/10/2026, 19:00 às 21:00" (com "(dia seguinte)" se terminar depois da meia-noite)
export function descreverQuando(inicio: string, duracaoMin: number): string {
  if (interpretarDataHora(inicio) === null) return inicio;
  const fim = fimDoEvento(inicio, duracaoMin);
  const mesmoDia = fim.slice(0, 10) === inicio.slice(0, 10);
  return `${formatarInicio(inicio)} às ${fim.slice(11, 16)}${mesmoDia ? "" : " (dia seguinte)"}`;
}