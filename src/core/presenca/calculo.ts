import type { NivelAlerta } from "../equipes/alertas";
import { ehEstadoFinal, type EstadoPresenca } from "./tipos";

// Abaixo disto, a porcentagem nao e confiavel: mostramos "Dados insuficientes"
export const MINIMO_REGISTROS = 5;

export const LIMITES_FREQUENCIA_PADRAO = { atencao: 70, observacao: 85 };

export interface RegistroPresenca {
  estado: EstadoPresenca;
}

export interface ResumoPresenca {
  registrados: number; // eventos com resultado (presente, atrasou, faltou, justificado)
  presentes: number;
  atrasos: number;
  faltas: number;
  justificadas: number;
  pendentes: number; // convocado/confirmado: ainda nao aconteceu
  percentual: number | null; // null = "Dados insuficientes"
}

function contar(registros: RegistroPresenca[], estado: EstadoPresenca): number {
  return registros.filter((r) => r.estado === estado).length;
}

// Porcentagem de comparecimento (presente + atrasou) sobre (comparecimentos + faltas).
// Falta justificada fica FORA da conta. Devolve null se nao houver base.
function percentualDe(registros: RegistroPresenca[]): number | null {
  const compareceu = contar(registros, "presente") + contar(registros, "atrasou");
  const base = compareceu + contar(registros, "faltou");
  return base === 0 ? null : (compareceu / base) * 100;
}

export function calcularPresenca(
  registros: RegistroPresenca[],
  minimo: number = MINIMO_REGISTROS,
): ResumoPresenca {
  const finais = registros.filter((r) => ehEstadoFinal(r.estado));
  const percentual = finais.length >= minimo ? percentualDe(finais) : null;

  return {
    registrados: finais.length,
    presentes: contar(registros, "presente"),
    atrasos: contar(registros, "atrasou"),
    faltas: contar(registros, "faltou"),
    justificadas: contar(registros, "justificado"),
    pendentes: contar(registros, "convocado") + contar(registros, "confirmado"),
    percentual: percentual === null ? null : Math.round(percentual * 10) / 10,
  };
}

export type Tendencia = "subindo" | "estavel" | "caindo";

// Compara os ultimos "janela" eventos com todos os anteriores.
// "registros" deve estar em ordem cronologica (do mais antigo ao mais recente).
// Precisa de pelo menos 2 x janela eventos com resultado; senao devolve null.
export function calcularTendencia(
  registros: RegistroPresenca[],
  janela: number = 5,
): Tendencia | null {
  const finais = registros.filter((r) => ehEstadoFinal(r.estado));
  if (finais.length < janela * 2) return null;

  const recentes = percentualDe(finais.slice(-janela));
  const anteriores = percentualDe(finais.slice(0, -janela));
  if (recentes === null || anteriores === null) return null;

  const diferenca = recentes - anteriores;
  if (diferenca >= 10) return "subindo";
  if (diferenca <= -10) return "caindo";
  return "estavel";
}

export interface AlertaPresenca {
  codigo: string;
  nivel: NivelAlerta;
  mensagem: string;
}

function textoPercentual(valor: number): string {
  return `${String(valor).replace(".", ",")}%`;
}

// Alerta de frequencia. Sem dados suficientes: null (a tela mostra "N/D").
export function avaliarFrequencia(
  resumo: ResumoPresenca,
  limites: { atencao: number; observacao: number } = LIMITES_FREQUENCIA_PADRAO,
): AlertaPresenca | null {
  if (resumo.percentual === null) return null;
  const p = resumo.percentual;

  if (p < limites.atencao) {
    return {
      codigo: "frequencia_baixa",
      nivel: "atencao",
      mensagem: `Presença de ${textoPercentual(p)}, abaixo de ${limites.atencao}%.`,
    };
  }
  if (p < limites.observacao) {
    return {
      codigo: "frequencia_regular",
      nivel: "observacao",
      mensagem: `Presença de ${textoPercentual(p)}, abaixo de ${limites.observacao}%.`,
    };
  }
  return {
    codigo: "frequencia_boa",
    nivel: "normal",
    mensagem: `Presença de ${textoPercentual(p)}.`,
  };
}