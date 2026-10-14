import type { StatusEvento } from "./tipos";

interface PartesDataHora {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

// "AAAA-MM-DD HH:MM" -> partes. Devolve null se o texto estiver fora do formato
// OU for impossivel (como 30 de fevereiro ou 25h).
export function interpretarDataHora(valor: string): PartesDataHora | null {
  const encontrado = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(valor);
  if (encontrado === null) return null;

  const [ano, mes, dia, hora, minuto] = encontrado.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];

  // O truque: pedimos ao JavaScript para montar a data. Se ela "corrigir" algum
  // valor (30/02 vira 02/03), os numeros nao batem mais e sabemos que era invalida.
  const data = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
  const confere =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia &&
    data.getUTCHours() === hora &&
    data.getUTCMinutes() === minuto;

  return confere ? { ano, mes, dia, hora, minuto } : null;
}

export function dataHoraValida(valor: string): boolean {
  return interpretarDataHora(valor) !== null;
}

// Converte para "minutos desde uma data de referencia". So serve para COMPARAR e SOMAR.
export function emMinutos(valor: string): number {
  const partes = interpretarDataHora(valor);
  if (partes === null) {
    throw new Error(`Data e horário inválidos: ${valor}`);
  }
  return Date.UTC(partes.ano, partes.mes - 1, partes.dia, partes.hora, partes.minuto) / 60000;
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

// Quando o evento termina, no mesmo formato "AAAA-MM-DD HH:MM"
export function fimDoEvento(inicio: string, duracaoMin: number): string {
  const data = new Date((emMinutos(inicio) + duracaoMin) * 60000);
  return (
    `${data.getUTCFullYear()}-${doisDigitos(data.getUTCMonth() + 1)}-${doisDigitos(data.getUTCDate())} ` +
    `${doisDigitos(data.getUTCHours())}:${doisDigitos(data.getUTCMinutes())}`
  );
}

// "Agora" no relogio local do computador, no mesmo formato
export function agoraLocal(data: Date = new Date()): string {
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())} ` +
    `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  );
}

export type SituacaoEvento =
  | "agendado"
  | "em_andamento"
  | "pendente_registro"
  | "realizado"
  | "cancelado";

// O estado "de verdade" do evento: junta o que foi gravado com a hora de agora
export function situacaoDoEvento(
  evento: { status: StatusEvento; inicio: string; duracaoMin: number },
  agora: string,
): SituacaoEvento {
  if (evento.status === "cancelado") return "cancelado";
  if (evento.status === "realizado") return "realizado";

  const agoraMin = emMinutos(agora);
  const inicioMin = emMinutos(evento.inicio);

  if (agoraMin < inicioMin) return "agendado";
  if (agoraMin < inicioMin + evento.duracaoMin) return "em_andamento";
  return "pendente_registro"; // o horario passou e ninguem registrou o que aconteceu
}