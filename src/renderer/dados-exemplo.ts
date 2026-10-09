import type { Jogador } from "../core/jogadores/tipos";

// ATENCAO: dados FICTICIOS, so para desenhar a tela.
// Na Etapa 12 serao substituidos pelos jogadores reais do banco.
function exemplo(
  id: number,
  apelido: string,
  eloAtual: Jogador["eloAtual"],
  posicaoPrincipal: Jogador["posicaoPrincipal"],
  status: Jogador["status"],
): Jogador {
  return {
    id,
    apelido,
    riotId: null,
    eloAtual,
    eloMaximo: null,
    posicaoPrincipal,
    posicaoSecundaria: null,
    experienciaCompetitiva: false,
    comunicacao: null,
    lideranca: null,
    comprometimento: null,
    status,
    observacoes: null,
    criadoEm: "2026-01-01 00:00:00",
    atualizadoEm: "2026-01-01 00:00:00",
  };
}

export const JOGADORES_EXEMPLO: Jogador[] = [
  exemplo(1, "Exemplo Alfa", "Ouro", "Top", "titular"),
  exemplo(2, "Exemplo Bravo", "Platina", "Jungle", "titular"),
  exemplo(3, "Exemplo Charlie", "Prata", "Mid", "reserva"),
  exemplo(4, "Exemplo Delta", "Desconhecido", null, "em_avaliacao"),
  exemplo(5, "Exemplo Eco", "Bronze", "Support", "casual"),
];