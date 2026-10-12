import type { Posicao } from "../jogadores/tipos";
import { ehFuncaoDeJogo, type FuncaoEquipe, type ParticipacaoDaPessoa } from "./tipos";

// Nomes para usar dentro de frases
export const NOME_FUNCAO: Record<FuncaoEquipe, string> = {
  titular: "titular",
  reserva: "reserva",
  academia: "academia",
  capitao: "capitão",
  coach: "coach",
};

// O minimo que precisamos saber de cada membro atual da equipe
export interface MembroResumo {
  id: number; // id da participacao
  jogadorId: number;
  apelido: string;
  funcao: FuncaoEquipe;
  posicao: Posicao | null;
}

// As caixinhas que o administrador pode marcar
export interface OpcoesPlano {
  anteriorVaiParaReserva: boolean;
  liberarEmOutraEquipe: boolean;
  outraEquipeVaiParaReserva: boolean;
}

export type TipoAcao = "adicionar" | "trocar_funcao" | "escalar_titular" | "designar_staff";

export interface EntradaPlano {
  equipeId: number;
  pessoa: { id: number; apelido: string };
  funcao: FuncaoEquipe;
  posicao: Posicao | null;
  membrosAtivos: MembroResumo[]; // quem esta na equipe AGORA
  participacoesDaPessoa: ParticipacaoDaPessoa[]; // onde a pessoa esta AGORA (qualquer equipe)
  opcoes: OpcoesPlano;
}

export interface Plano {
  acao: TipoAcao | null; // null = nao ha o que fazer
  passos: string[]; // o que vai acontecer, em frases
  precisaMotivo: boolean;
  bloqueio: string | null; // por que nao da para confirmar (se for o caso)
  // O que a tela precisa para mostrar as caixinhas certas:
  ocupante: MembroResumo | null; // titular atual da posicao
  titularEmOutraEquipe: ParticipacaoDaPessoa | null;
  jogoNaEquipe: MembroResumo | null; // a pessoa ja joga nesta equipe
  detentor: MembroResumo | null; // capitao/coach atual
}

// Descobre em qual cenario estamos e descreve o que vai acontecer.
export function planejarAcao(entrada: EntradaPlano): Plano {
  const { equipeId, pessoa, funcao, posicao, membrosAtivos, participacoesDaPessoa, opcoes } =
    entrada;

  const jogoNaEquipe =
    membrosAtivos.find((m) => m.jogadorId === pessoa.id && ehFuncaoDeJogo(m.funcao)) ?? null;

  const ocupante =
    funcao === "titular" && posicao !== null
      ? (membrosAtivos.find((m) => m.funcao === "titular" && m.posicao === posicao) ?? null)
      : null;

  const titularEmOutraEquipe =
    funcao === "titular"
      ? (participacoesDaPessoa.find((p) => p.funcao === "titular" && p.equipeId !== equipeId) ??
        null)
      : null;

  const detentor =
    funcao === "capitao" || funcao === "coach"
      ? (membrosAtivos.find((m) => m.funcao === funcao) ?? null)
      : null;

  // Junta o "o que fazer" com as informacoes de contexto
  const plano = (
    parcial: Pick<Plano, "acao" | "passos" | "precisaMotivo" | "bloqueio">,
  ): Plano => ({ ...parcial, ocupante, titularEmOutraEquipe, jogoNaEquipe, detentor });

  const bloquear = (mensagem: string): Plano =>
    plano({ acao: null, passos: [], precisaMotivo: false, bloqueio: mensagem });

  // ---------- titular ----------
  if (funcao === "titular") {
    if (posicao === null) {
      return bloquear("Escolha a posição.");
    }
    if (ocupante !== null && ocupante.jogadorId === pessoa.id) {
      return bloquear(`${pessoa.apelido} já é o titular de ${posicao}.`);
    }
    if (titularEmOutraEquipe !== null && !opcoes.liberarEmOutraEquipe) {
      return bloquear(
        `${pessoa.apelido} já é titular em ${titularEmOutraEquipe.equipeNome}. Marque a opção para liberar a titularidade de lá.`,
      );
    }

    const passos: string[] = [];

    if (ocupante !== null) {
      passos.push(
        opcoes.anteriorVaiParaReserva
          ? `${ocupante.apelido} deixa a posição ${posicao} e passa a reserva.`
          : `${ocupante.apelido} deixa a posição ${posicao}.`,
      );
    }

    if (titularEmOutraEquipe !== null) {
      passos.push(
        opcoes.outraEquipeVaiParaReserva
          ? `${pessoa.apelido} deixa de ser titular em ${titularEmOutraEquipe.equipeNome} e passa a reserva lá.`
          : `${pessoa.apelido} deixa de ser titular em ${titularEmOutraEquipe.equipeNome}.`,
      );
    }

    if (jogoNaEquipe !== null) {
      const detalhe = jogoNaEquipe.posicao ? ` (${jogoNaEquipe.posicao})` : "";
      passos.push(
        `${pessoa.apelido} deixa de ser ${NOME_FUNCAO[jogoNaEquipe.funcao]}${detalhe} desta equipe e passa a titular de ${posicao}.`,
      );
    } else {
      passos.push(`${pessoa.apelido} entra como titular de ${posicao}.`);
    }

    return plano({
      acao: "escalar_titular",
      passos,
      precisaMotivo: ocupante !== null || titularEmOutraEquipe !== null || jogoNaEquipe !== null,
      bloqueio: null,
    });
  }

  // ---------- reserva ou academia ----------
  if (funcao === "reserva" || funcao === "academia") {
    if (jogoNaEquipe !== null) {
      if (jogoNaEquipe.funcao === funcao) {
        return bloquear(`${pessoa.apelido} já é ${NOME_FUNCAO[funcao]} desta equipe.`);
      }
      return plano({
        acao: "trocar_funcao",
        passos: [
          `${pessoa.apelido} passa de ${NOME_FUNCAO[jogoNaEquipe.funcao]} a ${NOME_FUNCAO[funcao]}.`,
        ],
        precisaMotivo: true,
        bloqueio: null,
      });
    }
    return plano({
      acao: "adicionar",
      passos: [`${pessoa.apelido} entra como ${NOME_FUNCAO[funcao]}.`],
      precisaMotivo: false,
      bloqueio: null,
    });
  }

  // ---------- capitao ou coach ----------
  if (detentor !== null && detentor.jogadorId === pessoa.id) {
    return bloquear(`${pessoa.apelido} já é ${NOME_FUNCAO[funcao]} desta equipe.`);
  }
  if (detentor !== null) {
    return plano({
      acao: "designar_staff",
      passos: [
        `${detentor.apelido} deixa de ser ${NOME_FUNCAO[funcao]}.`,
        `${pessoa.apelido} passa a ser ${NOME_FUNCAO[funcao]}.`,
      ],
      precisaMotivo: true,
      bloqueio: null,
    });
  }
  return plano({
    acao: "designar_staff",
    passos: [`${pessoa.apelido} passa a ser ${NOME_FUNCAO[funcao]}.`],
    precisaMotivo: false,
    bloqueio: null,
  });
}