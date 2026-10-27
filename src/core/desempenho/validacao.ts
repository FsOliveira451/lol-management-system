import { POSICOES, type Posicao } from "../jogadores/tipos";
import type { EstadoPresenca, PapelConvocado } from "../presenca/tipos";
import { chaveCampeao, resolverCampeao } from "./campeoes";
import { KDA_MAXIMO, MAXIMO_JOGADORES_POR_LADO, type DadosDesempenho } from "./tipos";

// O que a regra precisa saber da convocacao da pessoa neste evento
export interface ConvocacaoParaDesempenho {
  estado: EstadoPresenca;
  papel: PapelConvocado;
  equipeId: number | null; // null = convocacao avulsa
}

// Um jogador ja registrado na partida (o repositorio exclui o que esta sendo editado)
export interface RegistroDoLado {
  jogadorId: number;
  equipeId: number;
  posicao: Posicao;
  campeao: string;
}

export interface ContextoDesempenho {
  equipeIds: number[]; // equipes DA ORGANIZACAO no evento
  convocacao: ConvocacaoParaDesempenho | null;
  outrosRegistros: RegistroDoLado[];
}

const MSG_EQUIPE_ESTRANHA = "A equipe informada não participa deste evento.";

// Descobre por qual equipe (lado) a pessoa jogou
export function resolverLado(
  equipeIdInformado: number | null | undefined,
  equipeIds: number[],
  convocacao: ConvocacaoParaDesempenho | null,
): { equipeId: number | null; erro: string | null } {
  const informado = equipeIdInformado ?? null;

  if (equipeIds.length === 0) {
    return { equipeId: null, erro: "Este evento não tem equipe da organização." };
  }

  if (equipeIds.length === 1) {
    if (informado !== null && informado !== equipeIds[0]) {
      return { equipeId: null, erro: MSG_EQUIPE_ESTRANHA };
    }
    return { equipeId: equipeIds[0]!, erro: null };
  }

  if (equipeIds.length === 2) {
    const daConvocacao = convocacao?.equipeId ?? null;
    if (daConvocacao !== null) {
      if (informado !== null && informado !== daConvocacao) {
        return {
          equipeId: null,
          erro: "No confronto interno, esta pessoa só pode jogar pela equipe em que foi convocada.",
        };
      }
      return { equipeId: daConvocacao, erro: null };
    }
    // Convocacao avulsa: o lado precisa ser informado
    if (informado === null) {
      return { equipeId: null, erro: "Informe por qual equipe a pessoa jogou." };
    }
    if (!equipeIds.includes(informado)) {
      return { equipeId: null, erro: MSG_EQUIPE_ESTRANHA };
    }
    return { equipeId: informado, erro: null };
  }

  return { equipeId: null, erro: "Este evento tem equipes demais para registrar desempenho." };
}

// Pode registrar este desempenho? Devolve a lista de erros (vazia = pode).
// Recebe o CONJUNTO completo de dados (ao editar, o repositorio junta o gravado com o novo).
export function validarDesempenho(dados: DadosDesempenho, contexto: ContextoDesempenho): string[] {
  const erros: string[] = [];
  const conv = contexto.convocacao;

  if (typeof dados.jogadorId !== "number" || !Number.isInteger(dados.jogadorId)) {
    erros.push("Informe a pessoa.");
  }

  // Convocacao e presenca
  if (conv === null) {
    erros.push("Esta pessoa não está convocada para este evento.");
  } else if (conv.papel === "staff") {
    erros.push("Esta pessoa foi convocada como staff e não joga neste evento.");
  } else if (conv.estado !== "presente" && conv.estado !== "atrasou") {
    erros.push("Registre a presença da pessoa (presente ou atrasou) antes de lançar o desempenho.");
  }

  const lado = resolverLado(dados.equipeId, contexto.equipeIds, conv);
  if (lado.erro !== null) erros.push(lado.erro);

  // Posicao
  const posicaoValida =
    typeof dados.posicao === "string" && (POSICOES as readonly string[]).includes(dados.posicao);
  if (!posicaoValida) erros.push("Informe a posição (Top, Jungle, Mid, ADC ou Support).");

  // Campeao
  const campeao = typeof dados.campeao === "string" ? resolverCampeao(dados.campeao) : null;
  if (campeao === null) erros.push("Informe um campeão válido.");

  // KDA: os tres juntos ou nenhum
  const kda = [dados.abates, dados.mortes, dados.assistencias];
  const informados = kda.filter((valor) => valor !== null && valor !== undefined);
  if (informados.length > 0 && informados.length < 3) {
    erros.push("Informe abates, mortes e assistências juntos (ou deixe os três em branco).");
  } else if (informados.length === 3) {
    const invalido = informados.some(
      (valor) =>
        typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > KDA_MAXIMO,
    );
    if (invalido) erros.push(`Abates, mortes e assistências devem ser inteiros de 0 a ${KDA_MAXIMO}.`);
  }

  // Conflitos com quem ja foi registrado na partida
  if (contexto.outrosRegistros.some((outro) => outro.jogadorId === dados.jogadorId)) {
    erros.push("Esta pessoa já tem desempenho registrado nesta partida.");
  }

  if (lado.equipeId !== null) {
    const doLado = contexto.outrosRegistros.filter((outro) => outro.equipeId === lado.equipeId);

    if (doLado.length >= MAXIMO_JOGADORES_POR_LADO) {
      erros.push(`A equipe já tem ${MAXIMO_JOGADORES_POR_LADO} jogadores registrados nesta partida.`);
    }
    if (posicaoValida && doLado.some((outro) => outro.posicao === dados.posicao)) {
      erros.push(`Já existe um jogador de ${dados.posicao} registrado pela equipe nesta partida.`);
    }
    if (campeao !== null) {
      const chave = chaveCampeao(campeao.nome);
      if (doLado.some((outro) => chaveCampeao(outro.campeao) === chave)) {
        erros.push(`${campeao.nome} já foi registrado pela equipe nesta partida.`);
      }
    }
  }

  return erros;
}

// Avisos que NAO bloqueiam: a tela mostra, o usuario decide.
export function avisosDeDesempenho(
  registros: RegistroDoLado[],
  equipes: { id: number; nome: string }[],
): string[] {
  const avisos: string[] = [];

  for (const equipe of equipes) {
    const total = registros.filter((r) => r.equipeId === equipe.id).length;
    if (total > 0 && total < MAXIMO_JOGADORES_POR_LADO) {
      avisos.push(`${equipe.nome}: ${total} de ${MAXIMO_JOGADORES_POR_LADO} jogadores registrados.`);
    }
  }

  // Confronto interno: o mesmo campeao nos dois lados (permitido em partida personalizada)
  if (equipes.length === 2) {
    const ladoA = registros.filter((r) => r.equipeId === equipes[0]!.id);
    const ladoB = registros.filter((r) => r.equipeId === equipes[1]!.id);
    const chavesB = new Set(ladoB.map((r) => chaveCampeao(r.campeao)));
    const repetidos = new Set<string>();

    for (const registro of ladoA) {
      const chave = chaveCampeao(registro.campeao);
      if (chavesB.has(chave) && !repetidos.has(chave)) {
        repetidos.add(chave);
        const nome = resolverCampeao(registro.campeao)?.nome ?? registro.campeao;
        avisos.push(`${nome} aparece nos dois lados.`);
      }
    }
  }

  return avisos;
}