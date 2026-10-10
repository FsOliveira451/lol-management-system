import type { DadosJogador, Elo, Jogador, Posicao } from "../core/jogadores/tipos";

// O que o formulario guarda: tudo como texto (vazio = "")
export interface ValoresFormulario {
  apelido: string;
  riotId: string;
  eloAtual: Elo;
  eloMaximo: Elo | "";
  posicaoPrincipal: Posicao | "";
  posicaoSecundaria: Posicao | "";
  experienciaCompetitiva: boolean;
  observacoes: string;
}

export const FORMULARIO_VAZIO: ValoresFormulario = {
  apelido: "",
  riotId: "",
  eloAtual: "Desconhecido",
  eloMaximo: "",
  posicaoPrincipal: "",
  posicaoSecundaria: "",
  experienciaCompetitiva: false,
  observacoes: "",
};

// Texto vazio (ou so espacos) vira null = "nao informado"
function textoOuNull(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

// Traduz o formulario para o formato que o sistema entende
export function converterFormulario(valores: ValoresFormulario): DadosJogador {
  return {
    apelido: valores.apelido.trim(),
    riotId: textoOuNull(valores.riotId),
    eloAtual: valores.eloAtual,
    eloMaximo: valores.eloMaximo === "" ? null : valores.eloMaximo,
    posicaoPrincipal: valores.posicaoPrincipal === "" ? null : valores.posicaoPrincipal,
    posicaoSecundaria: valores.posicaoSecundaria === "" ? null : valores.posicaoSecundaria,
    experienciaCompetitiva: valores.experienciaCompetitiva,
    observacoes: textoOuNull(valores.observacoes),
  };
}


// O caminho inverso: de um jogador ja cadastrado para os campos do formulario
export function valoresDoJogador(jogador: Jogador): ValoresFormulario {
  return {
    apelido: jogador.apelido,
    riotId: jogador.riotId ?? "",
    eloAtual: jogador.eloAtual,
    eloMaximo: jogador.eloMaximo ?? "",
    posicaoPrincipal: jogador.posicaoPrincipal ?? "",
    posicaoSecundaria: jogador.posicaoSecundaria ?? "",
    experienciaCompetitiva: jogador.experienciaCompetitiva,
    observacoes: jogador.observacoes ?? "",
  };
}