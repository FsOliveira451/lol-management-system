import { equipeNoConfronto } from "../equipes/confronto";
import { ehFuncaoDeJogo, type FuncaoEquipe, type ParticipacaoAtiva } from "../equipes/tipos";
import { temAdversario, type TipoEvento } from "../eventos/tipos";
import type { Convocado } from "./tipos";

export interface PessoaExcluida {
  jogadorId: number;
  motivo: string;
}

export interface SugestaoConvocacao {
  convocados: Convocado[];
  excluidos: PessoaExcluida[]; // quem ficou de fora e POR QUE (nada de caixa preta)
}

// Menor numero = funcao principal
const PRIORIDADE: Record<FuncaoEquipe, number> = {
  titular: 0,
  reserva: 1,
  academia: 2,
  capitao: 3,
  coach: 4,
};

function melhor(lista: ParticipacaoAtiva[], equipeIds: number[]): ParticipacaoAtiva | undefined {
  return [...lista].sort(
    (a, b) =>
      PRIORIDADE[a.funcao] - PRIORIDADE[b.funcao] ||
      equipeIds.indexOf(a.equipeId) - equipeIds.indexOf(b.equipeId),
  )[0];
}

// Quem convocar para um evento. "ativas" sao as participacoes ativas das equipes do evento
// (participacoes de outras equipes sao ignoradas).
export function sugerirConvocacao(
  tipo: TipoEvento,
  equipeIds: number[],
  ativas: ParticipacaoAtiva[],
): SugestaoConvocacao {
  const relevantes = ativas.filter((p) => equipeIds.includes(p.equipeId));

  // Agrupa por pessoa: cada pessoa e convocada UMA vez
  const porPessoa = new Map<number, ParticipacaoAtiva[]>();
  for (const participacao of relevantes) {
    const lista = porPessoa.get(participacao.jogadorId) ?? [];
    lista.push(participacao);
    porPessoa.set(participacao.jogadorId, lista);
  }

  const confrontoInterno = temAdversario(tipo) && equipeIds.length === 2;
  const convocados: Convocado[] = [];
  const excluidos: PessoaExcluida[] = [];

  for (const [jogadorId, minhas] of porPessoa) {
    let candidatas = minhas;
    let motivoSeVazio = "Sem participação válida neste evento.";

    if (confrontoInterno) {
      const resultado = equipeNoConfronto(minhas, equipeIds[0]!, equipeIds[1]!);
      if (resultado.equipePermitida !== null) {
        candidatas = minhas.filter(
          (p) => p.equipeId === resultado.equipePermitida && ehFuncaoDeJogo(p.funcao),
        );
      } else {
        // Nao pode jogar: sobra apenas a funcao de staff, se houver
        candidatas = minhas.filter((p) => !ehFuncaoDeJogo(p.funcao));
        motivoSeVazio = resultado.motivo ?? motivoSeVazio;
      }
    }

    const escolhida = melhor(candidatas, equipeIds);
    if (escolhida === undefined) {
      excluidos.push({ jogadorId, motivo: motivoSeVazio });
      continue;
    }

    convocados.push({
      jogadorId,
      equipeId: escolhida.equipeId,
      funcao: escolhida.funcao,
      papel: ehFuncaoDeJogo(escolhida.funcao) ? "jogador" : "staff",
    });
  }

  convocados.sort(
    (a, b) =>
      equipeIds.indexOf(a.equipeId) - equipeIds.indexOf(b.equipeId) ||
      PRIORIDADE[a.funcao] - PRIORIDADE[b.funcao] ||
      a.jogadorId - b.jogadorId,
  );

  return { convocados, excluidos };
}