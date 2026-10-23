import type { NivelAlerta } from "../equipes/alertas";
import type { SituacaoEvento } from "../eventos/tempo";
import { temAdversario, type TipoEvento } from "../eventos/tipos";

// Abaixo disto, o win rate nao e confiavel: mostramos "Dados insuficientes"
export const MINIMO_PARTIDAS = 5;
const TAMANHO_FORMA = 5;

export type ResultadoPartida = "V" | "D";

// Uma partida com o que e preciso saber do evento dela
export interface PartidaParaEstatistica {
  eventoId: number;
  tipo: TipoEvento;
  inicio: string;
  numero: number;
  equipeIds: number[]; // equipes da organizacao no evento
  vencedorEquipeId: number | null;
}

export interface Contagem {
  partidas: number;
  vitorias: number;
  derrotas: number;
  winRate: number | null; // null = "Dados insuficientes"
}

export interface EstatisticasDaEquipe {
  externo: Contagem; // contra adversarios de fora
  interno: Contagem; // confrontos entre equipes nossas (separado de proposito)
  porTipo: { scrim: Contagem; amistoso: Contagem; campeonato: Contagem }; // so externo
  forma: ResultadoPartida[]; // ultimos resultados externos, do mais antigo ao mais recente
}

// Resultado desta partida do ponto de vista da equipe.
// null = a equipe nao participou OU o dado e inconsistente (nao conta para nada).
export function resultadoParaEquipe(
  partida: PartidaParaEstatistica,
  equipeId: number,
): ResultadoPartida | null {
  if (!partida.equipeIds.includes(equipeId)) return null;

  if (partida.equipeIds.length === 2) {
    // confronto interno: o vencedor precisa ser uma das duas
    if (partida.vencedorEquipeId === null || !partida.equipeIds.includes(partida.vencedorEquipeId)) {
      return null;
    }
    return partida.vencedorEquipeId === equipeId ? "V" : "D";
  }

  if (partida.equipeIds.length === 1) {
    if (partida.vencedorEquipeId === equipeId) return "V";
    if (partida.vencedorEquipeId === null) return "D";
  }
  return null;
}

function contar(resultados: ResultadoPartida[], minimo: number): Contagem {
  const vitorias = resultados.filter((r) => r === "V").length;
  const derrotas = resultados.length - vitorias;
  const confiavel = resultados.length > 0 && resultados.length >= minimo;

  return {
    partidas: resultados.length,
    vitorias,
    derrotas,
    winRate: confiavel ? Math.round((vitorias / resultados.length) * 1000) / 10 : null,
  };
}

// Tudo CALCULADO a partir das partidas (nada disso e gravado).
// O repositorio deve passar so partidas de eventos NAO cancelados.
export function calcularEstatisticasDaEquipe(
  partidas: PartidaParaEstatistica[],
  equipeId: number,
  minimo: number = MINIMO_PARTIDAS,
): EstatisticasDaEquipe {
  const ordenadas = [...partidas].sort(
    (a, b) =>
      a.inicio.localeCompare(b.inicio) || a.eventoId - b.eventoId || a.numero - b.numero,
  );

  const externos: { tipo: TipoEvento; resultado: ResultadoPartida }[] = [];
  const internos: ResultadoPartida[] = [];

  for (const partida of ordenadas) {
    const resultado = resultadoParaEquipe(partida, equipeId);
    if (resultado === null) continue;

    if (partida.equipeIds.length === 2) {
      internos.push(resultado);
    } else {
      externos.push({ tipo: partida.tipo, resultado });
    }
  }

  const doTipo = (tipo: TipoEvento): Contagem =>
    contar(
      externos.filter((e) => e.tipo === tipo).map((e) => e.resultado),
      minimo,
    );

  return {
    externo: contar(
      externos.map((e) => e.resultado),
      minimo,
    ),
    interno: contar(internos, minimo),
    porTipo: {
      scrim: doTipo("scrim"),
      amistoso: doTipo("amistoso"),
      campeonato: doTipo("campeonato"),
    },
    forma: externos.slice(-TAMANHO_FORMA).map((e) => e.resultado),
  };
}

// ---------- pendencias de resultado ----------

export interface EventoParaPendencia {
  eventoId: number;
  tipo: TipoEvento;
  situacao: SituacaoEvento;
  partidasRegistradas: number;
}

export interface AlertaPartida {
  codigo: string;
  nivel: NivelAlerta;
  mensagem: string;
}

// Eventos que deveriam ter partidas e nao tem. Mais urgentes primeiro.
export function avaliarPendenciasDeResultado(eventos: EventoParaPendencia[]): AlertaPartida[] {
  const atencao: AlertaPartida[] = [];
  const observacao: AlertaPartida[] = [];

  for (const evento of eventos) {
    if (!temAdversario(evento.tipo) || evento.partidasRegistradas > 0) continue;

    if (evento.situacao === "pendente_registro") {
      atencao.push({
        codigo: `resultado_pendente:${evento.eventoId}`,
        nivel: "atencao",
        mensagem: "Evento terminou sem resultado registrado.",
      });
    } else if (evento.situacao === "realizado") {
      observacao.push({
        codigo: `sem_partidas:${evento.eventoId}`,
        nivel: "observacao",
        mensagem: "Evento realizado sem nenhuma partida registrada.",
      });
    }
  }

  return [...atencao, ...observacao];
}