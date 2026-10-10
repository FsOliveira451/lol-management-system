import { POSICOES } from "../jogadores/tipos";
import type { ModoValidacao } from "../jogadores/validacao";
import {
  FUNCOES_EQUIPE,
  NIVEIS_EQUIPE,
  STATUS_EQUIPE,
  ehFuncaoDeJogo,
  type ContextoParticipacao,
  type DadosEquipe,
  type NovaParticipacao,
} from "./tipos";

// Tag com 2 a 5 letras ou numeros
const FORMATO_TAG = /^[A-Za-z0-9]{2,5}$/;

function contem(lista: readonly string[], valor: unknown): boolean {
  return typeof valor === "string" && lista.includes(valor);
}

// ---------- Dados da equipe ----------

export function validarDadosEquipe(dados: DadosEquipe, modo: ModoValidacao): string[] {
  const erros: string[] = [];

  if (modo === "criar" || dados.nome !== undefined) {
    const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
    if (nome === "") {
      erros.push("O nome da equipe é obrigatório.");
    } else if (nome.length < 2 || nome.length > 40) {
      erros.push("O nome da equipe deve ter de 2 a 40 caracteres.");
    }
  }

  if (dados.tag !== undefined && dados.tag !== null && dados.tag.trim() !== "") {
    if (!FORMATO_TAG.test(dados.tag.trim())) {
      erros.push("A tag deve ter de 2 a 5 letras ou números.");
    }
  }

  if (dados.nivel !== undefined && !contem(NIVEIS_EQUIPE, dados.nivel)) {
    erros.push("Nível inválido.");
  }

  if (dados.status !== undefined && !contem(STATUS_EQUIPE, dados.status)) {
    erros.push("Status da equipe inválido.");
  }

  return erros;
}

// ---------- Colocar uma pessoa numa equipe ----------

export function validarNovaParticipacao(
  nova: NovaParticipacao,
  contexto: ContextoParticipacao,
): string[] {
  if (!contem(FUNCOES_EQUIPE, nova.funcao)) {
    return ["Função inválida."];
  }

  const erros: string[] = [];

  if (nova.posicao !== undefined && nova.posicao !== null && !contem(POSICOES, nova.posicao)) {
    erros.push("Posição inválida.");
  }

  if (nova.funcao === "titular" && !nova.posicao) {
    erros.push("Todo titular precisa de uma posição.");
  }

  if (contexto.statusJogador === "inativo" || contexto.statusJogador === "fora_do_projeto") {
    erros.push("Uma pessoa inativa ou fora do projeto não pode entrar em uma equipe.");
  }

  if (contexto.statusEquipe === "inativa") {
    erros.push("Uma equipe inativa não pode receber novos membros.");
  }

  // O que esta pessoa ja faz NESTA equipe
  const naEquipe = contexto.ativasDoJogador.filter((p) => p.equipeId === nova.equipeId);

  if (naEquipe.some((p) => p.funcao === nova.funcao)) {
    erros.push("Esta pessoa já tem esta função nesta equipe.");
  } else if (ehFuncaoDeJogo(nova.funcao)) {
    // Uma pessoa nao pode ser, ao mesmo tempo, titular E reserva da mesma equipe
    const outra = naEquipe.find((p) => ehFuncaoDeJogo(p.funcao));
    if (outra) {
      erros.push(
        `Esta pessoa já joga nesta equipe como ${outra.funcao}. Encerre a participação atual antes de mudar a função.`,
      );
    }
  }

  if (nova.funcao === "titular") {
    // Titular em UMA equipe so (em outras pode ser reserva, academia, capitao ou coach)
    const titularEmOutra = contexto.ativasDoJogador.some(
      (p) => p.funcao === "titular" && p.equipeId !== nova.equipeId,
    );
    if (titularEmOutra) {
      erros.push("Esta pessoa já é titular em outra equipe. Uma pessoa só pode ser titular de uma equipe.");
    }

    // Um titular por posicao
    const posicaoOcupada = contexto.ativasDaEquipe.some(
      (p) =>
        p.funcao === "titular" && p.posicao === nova.posicao && p.jogadorId !== nova.jogadorId,
    );
    if (nova.posicao && posicaoOcupada) {
      erros.push(`A posição ${nova.posicao} já tem titular nesta equipe.`);
    }
  }

  // Um capitao e um coach por equipe
  const outroCom = (funcao: "capitao" | "coach") =>
    contexto.ativasDaEquipe.some((p) => p.funcao === funcao && p.jogadorId !== nova.jogadorId);

  if (nova.funcao === "capitao" && outroCom("capitao")) {
    erros.push("Esta equipe já tem capitão.");
  }
  if (nova.funcao === "coach" && outroCom("coach")) {
    erros.push("Esta equipe já tem coach.");
  }

  return erros;
}