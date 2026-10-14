import { dataHoraValida } from "./tempo";
import {
  NIVEIS_ADVERSARIO,
  TIPOS_EVENTO,
  temAdversario,
  type DadosEvento,
  type TipoEvento,
} from "./tipos";

function contem(lista: readonly string[], valor: unknown): boolean {
  return typeof valor === "string" && lista.includes(valor);
}

function textoOuNull(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

// Valida os dados COMPLETOS de um evento. Ao editar, o repositorio junta o que ja
// estava gravado com o que mudou e valida o conjunto (como fizemos com jogadores).
export function validarDadosEvento(dados: DadosEvento): string[] {
  const erros: string[] = [];

  const tipoValido = contem(TIPOS_EVENTO, dados.tipo);
  if (!tipoValido) {
    erros.push("Escolha o tipo do evento.");
  }

  if (dados.titulo !== undefined && dados.titulo !== null && dados.titulo.trim().length > 80) {
    erros.push("O título deve ter no máximo 80 caracteres.");
  }

  if (typeof dados.inicio !== "string" || !dataHoraValida(dados.inicio)) {
    erros.push("Informe uma data e um horário válidos.");
  }

  if (dados.duracaoMin !== undefined) {
    const duracao = dados.duracaoMin;
    if (!Number.isInteger(duracao) || duracao < 15 || duracao > 720) {
      erros.push("A duração deve ser um número inteiro de 15 a 720 minutos.");
    }
  }

  if (
    dados.nivelAdversario !== undefined &&
    dados.nivelAdversario !== null &&
    !contem(NIVEIS_ADVERSARIO, dados.nivelAdversario)
  ) {
    erros.push("Nível do adversário inválido.");
  }

  // Equipes: numeros inteiros positivos e sem repeticao
  const equipeIds = dados.equipeIds ?? [];
  const idsValidos = equipeIds.every((id) => Number.isInteger(id) && id > 0);
  if (!idsValidos || new Set(equipeIds).size !== equipeIds.length) {
    erros.push("As equipes escolhidas são inválidas ou estão repetidas.");
  }

  if (!tipoValido) {
    return erros; // sem o tipo, as demais regras nao fazem sentido
  }
  const tipo = dados.tipo as TipoEvento;
  const adversario = textoOuNull(dados.adversario);
  const total = equipeIds.length;

  // Quantidade de partidas so vale onde existe "o outro lado"
  if (dados.partidasPrevistas !== undefined && dados.partidasPrevistas !== null) {
    const partidas = dados.partidasPrevistas;
    if (!temAdversario(tipo)) {
      erros.push("A quantidade de partidas só vale para scrim, amistoso e campeonato.");
    } else if (!Number.isInteger(partidas) || partidas < 1 || partidas > 9) {
      erros.push("A quantidade de partidas deve ser um número inteiro de 1 a 9.");
    }
  }

  // Equipes e adversario, conforme o tipo
  switch (tipo) {
    case "treino":
      if (total < 1) erros.push("Escolha ao menos uma equipe para o treino.");
      if (total > 2) erros.push("Um treino reúne no máximo duas equipes.");
      if (adversario !== null) erros.push("Treino não tem adversário.");
      break;

    case "vod":
      if (total !== 1) erros.push("A análise de VOD é de exatamente uma equipe.");
      if (adversario !== null) erros.push("A análise de VOD não tem adversário.");
      break;

    case "tryout":
      if (total > 1) erros.push("Um tryout pertence a no máximo uma equipe.");
      if (adversario !== null) erros.push("Tryout não tem adversário.");
      break;

    case "reuniao":
      if (adversario !== null) erros.push("Reunião não tem adversário.");
      break;

    case "scrim":
    case "amistoso":
    case "campeonato":
      if (adversario !== null) {
        // Adversario externo: uma equipe nossa contra ele
        if (total !== 1) {
          erros.push("Com adversário externo, escolha exatamente uma equipe da organização.");
        }
      } else if (total !== 2) {
        // Sem adversario externo: so pode ser um confronto entre duas equipes nossas
        erros.push("Informe o adversário ou escolha as duas equipes da organização que se enfrentam.");
      }
      break;
  }

  return erros;
}