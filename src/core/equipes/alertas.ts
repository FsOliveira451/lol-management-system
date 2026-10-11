import { POSICOES } from "../jogadores/tipos";
import type { ParticipacaoAtiva, StatusEquipe } from "./tipos";

export const NIVEIS_ALERTA = ["critico", "atencao", "observacao", "normal"] as const;
export type NivelAlerta = (typeof NIVEIS_ALERTA)[number];

export interface Alerta {
  nivel: NivelAlerta;
  codigo: string; // identificador estavel (ex.: "sem_titular:Mid")
  mensagem: string; // texto para o usuario
}

// Quanto menor o numero, mais urgente
const PRIORIDADE: Record<NivelAlerta, number> = {
  critico: 0,
  atencao: 1,
  observacao: 2,
  normal: 3,
};

// Avalia a escalacao de UMA equipe, a partir de quem esta nela AGORA.
// Cada alerta vem de uma regra simples e explicavel (nada de "palpite").
export function avaliarEquipe(
  statusEquipe: StatusEquipe,
  ativas: ParticipacaoAtiva[],
): Alerta[] {
  if (statusEquipe === "inativa") {
    return [];
  }

  const emFormacao = statusEquipe === "em_formacao";
  const alertas: Alerta[] = [];

  // 1) Posicoes sem titular
  const titulares = ativas.filter((p) => p.funcao === "titular");
  const posicoesSemTitular = POSICOES.filter(
    (posicao) => !titulares.some((t) => t.posicao === posicao),
  );
  for (const posicao of posicoesSemTitular) {
    alertas.push({
      nivel: emFormacao ? "observacao" : "critico",
      codigo: `sem_titular:${posicao}`,
      mensagem: emFormacao
        ? `Equipe em formação: ainda sem titular em ${posicao}.`
        : `Equipe sem titular em ${posicao}.`,
    });
  }

  // 2) Capitao e coach
  if (!ativas.some((p) => p.funcao === "capitao")) {
    alertas.push({
      nivel: emFormacao ? "observacao" : "atencao",
      codigo: "sem_capitao",
      mensagem: "Equipe sem capitão.",
    });
  }
  if (!ativas.some((p) => p.funcao === "coach")) {
    alertas.push({ nivel: "observacao", codigo: "sem_coach", mensagem: "Equipe sem coach." });
  }

  // 3) Escalacao completa, mas sem ninguem no banco (so para equipes ativas)
  if (
    !emFormacao &&
    posicoesSemTitular.length === 0 &&
    !ativas.some((p) => p.funcao === "reserva")
  ) {
    alertas.push({ nivel: "observacao", codigo: "sem_reserva", mensagem: "Equipe sem reserva." });
  }

  // 4) Nada a apontar
  if (alertas.length === 0) {
    alertas.push({
      nivel: "normal",
      codigo: "escalacao_completa",
      mensagem: "Escalação principal completa: 5 titulares, capitão e coach.",
    });
  }

  // Do mais urgente para o menos urgente
  return alertas.sort((a, b) => PRIORIDADE[a.nivel] - PRIORIDADE[b.nivel]);
}