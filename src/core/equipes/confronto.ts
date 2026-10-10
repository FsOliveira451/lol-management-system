import { ehFuncaoDeJogo, type ParticipacaoAtiva } from "./tipos";

export interface ResultadoConfronto {
  equipePermitida: number | null; // em qual equipe a pessoa pode jogar (null = em nenhuma)
  motivo: string | null; // explicacao quando nao pode jogar
}

// Quando duas equipes da PROPRIA organizacao se enfrentam, uma pessoa que esta
// nas duas so pode jogar pela equipe em que e titular.
export function equipeNoConfronto(
  ativasDaPessoa: ParticipacaoAtiva[],
  equipeA: number,
  equipeB: number,
): ResultadoConfronto {
  const jogoEm = (equipeId: number) =>
    ativasDaPessoa.filter((p) => p.equipeId === equipeId && ehFuncaoDeJogo(p.funcao));

  const emA = jogoEm(equipeA);
  const emB = jogoEm(equipeB);

  if (emA.length === 0 && emB.length === 0) {
    return { equipePermitida: null, motivo: "Esta pessoa não joga em nenhuma das duas equipes." };
  }
  if (emB.length === 0) return { equipePermitida: equipeA, motivo: null };
  if (emA.length === 0) return { equipePermitida: equipeB, motivo: null };

  // Esta nas duas: so pode jogar pela equipe em que e titular
  if (emA.some((p) => p.funcao === "titular")) return { equipePermitida: equipeA, motivo: null };
  if (emB.some((p) => p.funcao === "titular")) return { equipePermitida: equipeB, motivo: null };

  return {
    equipePermitida: null,
    motivo:
      "Esta pessoa está nas duas equipes e não é titular em nenhuma: não pode disputar este confronto.",
  };
}