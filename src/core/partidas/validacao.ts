import { dataHoraValida, emMinutos } from "../eventos/tempo";
import { temAdversario, type StatusEvento, type TipoEvento } from "../eventos/tipos";
import {
  DURACAO_PARTIDA_MAX,
  DURACAO_PARTIDA_MIN,
  MAXIMO_OBSERVACOES,
  MAXIMO_PARTIDAS,
  type DadosPartida,
} from "./tipos";

// Tudo que a regra precisa saber do evento (o repositorio monta isto)
export interface ContextoPartida {
  tipo: TipoEvento;
  status: StatusEvento;
  inicio: string; // "AAAA-MM-DD HH:MM"
  equipeIds: number[]; // equipes DA ORGANIZACAO no evento
  numerosExistentes: number[]; // numeros das OUTRAS partidas do evento (sem a que esta sendo editada)
}

export function ehConfrontoInterno(equipeIds: number[]): boolean {
  return equipeIds.length === 2;
}

// Pode registrar esta partida? Devolve a lista de erros (vazia = pode).
// Recebe o CONJUNTO completo de dados (ao editar, o repositorio junta o gravado com o novo).
// "agora" vem do programa, nunca da tela.
export function validarPartida(
  dados: DadosPartida,
  contexto: ContextoPartida,
  agora: string,
): string[] {
  if (!temAdversario(contexto.tipo)) {
    return ["Este tipo de evento não tem partidas."];
  }
  if (contexto.status === "cancelado") {
    return ["Evento cancelado não tem partidas."];
  }
  if (!dataHoraValida(agora) || !dataHoraValida(contexto.inicio)) {
    return ["Horário inválido."];
  }
  if (emMinutos(agora) < emMinutos(contexto.inicio)) {
    return ["Só é possível registrar partidas depois que o evento começar."];
  }
  if (contexto.equipeIds.length === 0) {
    return ["Este evento não tem equipe da organização: não há para quem registrar o resultado."];
  }

  const erros: string[] = [];

  // Numero da partida
  const numero = dados.numero;
  if (
    typeof numero !== "number" ||
    !Number.isInteger(numero) ||
    numero < 1 ||
    numero > MAXIMO_PARTIDAS
  ) {
    erros.push(`O número da partida deve ser um inteiro de 1 a ${MAXIMO_PARTIDAS}.`);
  } else if (contexto.numerosExistentes.includes(numero)) {
    erros.push(`Já existe a partida ${numero} neste evento.`);
  }

  // Quem venceu
  const vencedor = dados.vencedorEquipeId;
  if (vencedor === undefined) {
    erros.push("Informe quem venceu a partida.");
  } else if (ehConfrontoInterno(contexto.equipeIds)) {
    if (vencedor === null || !contexto.equipeIds.includes(vencedor)) {
      erros.push("No confronto interno, o vencedor deve ser uma das duas equipes.");
    }
  } else if (vencedor !== null && vencedor !== contexto.equipeIds[0]) {
    erros.push("O vencedor deve ser a equipe do evento ou o adversário.");
  }

  // Duracao (opcional)
  const duracao = dados.duracaoMin;
  if (duracao !== undefined && duracao !== null) {
    if (
      !Number.isInteger(duracao) ||
      duracao < DURACAO_PARTIDA_MIN ||
      duracao > DURACAO_PARTIDA_MAX
    ) {
      erros.push(
        `A duração deve ser um inteiro de ${DURACAO_PARTIDA_MIN} a ${DURACAO_PARTIDA_MAX} minutos.`,
      );
    }
  }

  // Observacoes (opcionais)
  if (dados.observacoes != null && dados.observacoes.length > MAXIMO_OBSERVACOES) {
    erros.push(`As observações devem ter no máximo ${MAXIMO_OBSERVACOES} caracteres.`);
  }

  return erros;
}

// Avisos que NAO bloqueiam: a tela mostra, o usuario decide.
export function avisosDePartidas(
  partidasPrevistas: number | null,
  numerosRegistrados: number[],
): string[] {
  const avisos: string[] = [];

  if (partidasPrevistas !== null && numerosRegistrados.length > partidasPrevistas) {
    avisos.push(
      `Há mais partidas registradas (${numerosRegistrados.length}) do que previstas (${partidasPrevistas}).`,
    );
  }

  if (numerosRegistrados.length > 0) {
    const maior = Math.max(...numerosRegistrados);
    const faltando: number[] = [];
    for (let n = 1; n < maior; n++) {
      if (!numerosRegistrados.includes(n)) faltando.push(n);
    }
    if (faltando.length > 0) {
      avisos.push(`Faltam partidas na sequência: ${faltando.join(", ")}.`);
    }
  }

  return avisos;
}