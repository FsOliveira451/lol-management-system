import { ELOS, POSICOES, STATUS_JOGADOR, type DadosJogador } from "./tipos";

export type ModoValidacao = "criar" | "editar";

// Nome com 3 a 16 caracteres, "#" e uma tag de 3 a 5 letras/numeros
const FORMATO_RIOT_ID = /^.{3,16}#[A-Za-z0-9]{3,5}$/;

function contem(lista: readonly string[], valor: unknown): boolean {
  return typeof valor === "string" && lista.includes(valor);
}

function notaValida(valor: unknown): boolean {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= 1 &&
    valor <= 5
  );
}

// Devolve uma lista de mensagens de erro. Lista vazia = dados validos.
export function validarDadosJogador(
  dados: DadosJogador,
  modo: ModoValidacao,
): string[] {
  const erros: string[] = [];

  // Apelido: obrigatorio ao criar; ao editar so e conferido se foi enviado
  if (modo === "criar" || dados.apelido !== undefined) {
    if (typeof dados.apelido !== "string" || dados.apelido.trim() === "") {
      erros.push("O apelido é obrigatório.");
    }
  }

  // Riot ID: opcional, mas se vier preenchido precisa ter o formato Nome#TAG
  if (
    dados.riotId !== undefined &&
    dados.riotId !== null &&
    dados.riotId.trim() !== ""
  ) {
    if (!FORMATO_RIOT_ID.test(dados.riotId.trim())) {
      erros.push("O Riot ID deve ter o formato Nome#TAG (ex.: Exemplo1#BR1).");
    }
  }

  // Elos
  if (dados.eloAtual !== undefined && !contem(ELOS, dados.eloAtual)) {
    erros.push("Elo atual inválido.");
  }
  if (
    dados.eloMaximo !== undefined &&
    dados.eloMaximo !== null &&
    !contem(ELOS, dados.eloMaximo)
  ) {
    erros.push("Elo máximo inválido.");
  }

  // Regra de negocio: o elo maximo nao pode ser menor que o atual
  const { eloAtual, eloMaximo } = dados;
  if (
    eloAtual &&
    eloMaximo &&
    contem(ELOS, eloAtual) &&
    contem(ELOS, eloMaximo) &&
    eloAtual !== "Desconhecido" &&
    eloMaximo !== "Desconhecido"
  ) {
    if (ELOS.indexOf(eloMaximo) < ELOS.indexOf(eloAtual)) {
      erros.push("O elo máximo não pode ser menor que o elo atual.");
    }
  }

  // Posicoes
  const { posicaoPrincipal, posicaoSecundaria } = dados;
  if (
    posicaoPrincipal !== undefined &&
    posicaoPrincipal !== null &&
    !contem(POSICOES, posicaoPrincipal)
  ) {
    erros.push("Posição principal inválida.");
  }
  if (
    posicaoSecundaria !== undefined &&
    posicaoSecundaria !== null &&
    !contem(POSICOES, posicaoSecundaria)
  ) {
    erros.push("Posição secundária inválida.");
  }
  if (posicaoPrincipal && posicaoSecundaria && posicaoPrincipal === posicaoSecundaria) {
    erros.push("A posição secundária deve ser diferente da principal.");
  }

  // Status
  if (dados.status !== undefined && !contem(STATUS_JOGADOR, dados.status)) {
    erros.push("Status inválido.");
  }

  // Notas de 1 a 5 (vazio = ainda nao avaliado, e isso e permitido)
  const camposDeNota = [
    ["comunicacao", "Comunicação"],
    ["lideranca", "Liderança"],
    ["comprometimento", "Comprometimento"],
  ] as const;

  for (const [campo, nome] of camposDeNota) {
    const valor = dados[campo];
    if (valor !== undefined && valor !== null && !notaValida(valor)) {
      erros.push(`${nome} deve ser um número inteiro de 1 a 5.`);
    }
  }

  return erros;
}