import { POSICOES, type Posicao } from "../jogadores/tipos";
import {
  MINIMO_PARTIDAS,
  resultadoParaEquipe,
  type Contagem,
  type PartidaParaEstatistica,
  type ResultadoPartida,
} from "../partidas/estatisticas";
import { chaveCampeao } from "./campeoes";

// Um desempenho com o que e preciso saber da partida e do evento dela
export interface RegistroDesempenho extends PartidaParaEstatistica {
  equipeIdDoLado: number;
  posicao: Posicao;
  campeao: string;
  abates: number | null;
  mortes: number | null;
  assistencias: number | null;
}

export interface ResumoKda {
  partidasComKda: number;
  abates: number; // somas: sempre aparecem
  mortes: number;
  assistencias: number;
  mediaAbates: number | null; // null = "Dados insuficientes"
  mediaMortes: number | null;
  mediaAssistencias: number | null;
  razao: number | null; // (abates + assistencias) / max(mortes, 1)
}

export interface CampeaoUsado {
  campeao: string;
  partidas: number; // todas (externas e internas)
  partidasExternas: number; // base de vitorias e derrotas
  vitorias: number;
  derrotas: number;
  winRate: number | null;
}

export interface DesempenhoDaPessoa {
  externo: Contagem; // contra adversarios de fora
  interno: Contagem; // confrontos entre equipes nossas (separado de proposito)
  kda: ResumoKda;
  campeoes: CampeaoUsado[]; // do mais usado para o menos usado
  posicoes: Record<Posicao, number>;
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function contar(resultados: ResultadoPartida[], minimo: number): Contagem {
  const vitorias = resultados.filter((r) => r === "V").length;
  const derrotas = resultados.length - vitorias;
  const confiavel = resultados.length > 0 && resultados.length >= minimo;

  return {
    partidas: resultados.length,
    vitorias,
    derrotas,
    winRate: confiavel ? arredondar((vitorias / resultados.length) * 100, 1) : null,
  };
}

// Tudo CALCULADO a partir dos registros (nada disso e gravado).
// Registros inconsistentes (lado que nao participa do evento, vencedor invalido) sao ignorados.
export function calcularDesempenhoDaPessoa(
  registros: RegistroDesempenho[],
  minimo: number = MINIMO_PARTIDAS,
): DesempenhoDaPessoa {
  const ordenados = [...registros].sort(
    (a, b) =>
      a.inicio.localeCompare(b.inicio) || a.eventoId - b.eventoId || a.numero - b.numero,
  );

  const validos: { registro: RegistroDesempenho; resultado: ResultadoPartida }[] = [];
  for (const registro of ordenados) {
    const resultado = resultadoParaEquipe(registro, registro.equipeIdDoLado);
    if (resultado !== null) validos.push({ registro, resultado });
  }

  const ehInterno = (r: RegistroDesempenho) => r.equipeIds.length === 2;

  // ----- KDA (todos os registros validos que tem os tres valores) -----
  const comKda = validos.filter(
    ({ registro }) =>
      registro.abates !== null && registro.mortes !== null && registro.assistencias !== null,
  );
  const somaAbates = comKda.reduce((total, { registro }) => total + (registro.abates ?? 0), 0);
  const somaMortes = comKda.reduce((total, { registro }) => total + (registro.mortes ?? 0), 0);
  const somaAssist = comKda.reduce((total, { registro }) => total + (registro.assistencias ?? 0), 0);
  const kdaConfiavel = comKda.length > 0 && comKda.length >= minimo;

  const kda: ResumoKda = {
    partidasComKda: comKda.length,
    abates: somaAbates,
    mortes: somaMortes,
    assistencias: somaAssist,
    mediaAbates: kdaConfiavel ? arredondar(somaAbates / comKda.length, 1) : null,
    mediaMortes: kdaConfiavel ? arredondar(somaMortes / comKda.length, 1) : null,
    mediaAssistencias: kdaConfiavel ? arredondar(somaAssist / comKda.length, 1) : null,
    razao: kdaConfiavel ? arredondar((somaAbates + somaAssist) / Math.max(somaMortes, 1), 2) : null,
  };

  // ----- campeoes -----
  const porCampeao = new Map<
    string,
    { campeao: string; partidas: number; externas: number; vitorias: number; derrotas: number }
  >();
  for (const { registro, resultado } of validos) {
    const chave = chaveCampeao(registro.campeao);
    const item = porCampeao.get(chave) ?? {
      campeao: registro.campeao,
      partidas: 0,
      externas: 0,
      vitorias: 0,
      derrotas: 0,
    };
    item.partidas += 1;
    if (!ehInterno(registro)) {
      item.externas += 1;
      if (resultado === "V") item.vitorias += 1;
      else item.derrotas += 1;
    }
    porCampeao.set(chave, item);
  }

  const campeoes: CampeaoUsado[] = [...porCampeao.values()]
    .map((item) => ({
      campeao: item.campeao,
      partidas: item.partidas,
      partidasExternas: item.externas,
      vitorias: item.vitorias,
      derrotas: item.derrotas,
      winRate:
        item.externas > 0 && item.externas >= minimo
          ? arredondar((item.vitorias / item.externas) * 100, 1)
          : null,
    }))
    .sort((a, b) => b.partidas - a.partidas || a.campeao.localeCompare(b.campeao));

  // ----- posicoes -----
  const posicoes = Object.fromEntries(POSICOES.map((posicao) => [posicao, 0])) as Record<
    Posicao,
    number
  >;
  for (const { registro } of validos) posicoes[registro.posicao] += 1;

  return {
    externo: contar(
      validos.filter(({ registro }) => !ehInterno(registro)).map(({ resultado }) => resultado),
      minimo,
    ),
    interno: contar(
      validos.filter(({ registro }) => ehInterno(registro)).map(({ resultado }) => resultado),
      minimo,
    ),
    kda,
    campeoes,
    posicoes,
  };
}