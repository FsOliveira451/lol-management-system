// Tipos: definem quais valores são permitidos
type Elo =
  | "Ferro"
  | "Bronze"
  | "Prata"
  | "Ouro"
  | "Platina"
  | "Esmeralda"
  | "Diamante"
  | "Mestre"
  | "Graomestre"
  | "Desafiante"
  | "Desconhecido";

type Posicao = "Top" | "Jungle" | "Mid" | "ADC" | "Support";

// Interface: o "molde" de um jogador
interface Jogador {
  apelido: string;
  elo: Elo;
  posicaoPrincipal: Posicao;
}

// Função: um bloco de código reutilizável que recebe dados e devolve um resultado
function descreverJogador(jogador: Jogador): string {
  return `${jogador.apelido} | ${jogador.elo} | ${jogador.posicaoPrincipal}`;
}

// Variável: uma "caixa" com nome que guarda um valor
const exemplo: Jogador = {
  apelido: "Exemplo1",
  elo: "Ouro",
  posicaoPrincipal: "Mid",
};

console.log("Sistema LOL iniciado.");
console.log(descreverJogador(exemplo));