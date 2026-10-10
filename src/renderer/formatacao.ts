import type { StatusJogador } from "../core/jogadores/tipos";
import type { CampoHistorico } from "../database/historico-repositorio";

// "Record<StatusJogador, string>" obriga a ter um texto para CADA status
export const ROTULO_STATUS: Record<StatusJogador, string> = {
  ativo: "🟢 Ativo",
  em_avaliacao: "🟡 Em avaliação",
  titular: "🔵 Titular",
  reserva: "🟣 Reserva",
  academia: "🟠 Academia",
  casual: "⚪ Casual",
  inativo: "🔴 Inativo",
  fora_do_projeto: "⚫ Fora do projeto",
};

export const ROTULO_CAMPO: Record<CampoHistorico, string> = {
  elo_atual: "Elo atual",
  elo_maximo: "Elo máximo",
  posicao_principal: "Posição principal",
  posicao_secundaria: "Posição secundária",
  status: "Status",
};

// O SQLite guarda a data em UTC, como "2026-10-10 03:04:05" (sem fuso).
// Aqui convertemos para o horario local de quem esta olhando.
export function formatarDataHora(valorSqlite: string, fusoHorario?: string): string {
  const data = new Date(valorSqlite.replace(" ", "T") + "Z");
  if (Number.isNaN(data.getTime())) {
    return valorSqlite; // nao conseguiu entender: mostra como veio
  }
  return data.toLocaleString("pt-BR", fusoHorario ? { timeZone: fusoHorario } : undefined);
}

// Transforma um valor guardado no historico num texto para a tela
export function rotuloDoValor(campo: CampoHistorico, valor: string | null): string {
  if (valor === null || valor === "Desconhecido") return "N/D";
  if (campo === "status") return ROTULO_STATUS[valor as StatusJogador] ?? valor;
  return valor;
}