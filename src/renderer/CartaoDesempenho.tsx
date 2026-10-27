import { useEffect, useState } from "react";
import type { DesempenhoDaPessoa } from "../core/desempenho/estatisticas";
import { POSICOES } from "../core/jogadores/tipos";
import { MINIMO_PARTIDAS, type Contagem } from "../core/partidas/estatisticas";

const MAXIMO_CAMPEOES = 5;

function numero(valor: number | null): string {
  return valor === null ? "N/D" : String(valor).replace(".", ",");
}

function winRate(contagem: { winRate: number | null }): string {
  return contagem.winRate === null ? "N/D" : `${numero(contagem.winRate)}%`;
}

export function CartaoDesempenho({ jogadorId }: { jogadorId: number }) {
  const [dados, setDados] = useState<DesempenhoDaPessoa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    window.api.desempenho
      .daPessoa(jogadorId)
      .then((res) => {
        if (cancelado) return;
        if (res.ok) {
          setDados(res.dados);
          setErro(null);
        } else {
          setErro(res.erros.join(" "));
        }
      })
      .catch(() => {
        if (!cancelado) setErro("Falha na comunicação com o programa.");
      });

    return () => {
      cancelado = true;
    };
  }, [jogadorId]);

  if (erro !== null) {
    return (
      <div className="cartao">
        <h3>Desempenho</h3>
        <p className="mensagem-erro">{erro}</p>
      </div>
    );
  }
  if (dados === null) {
    return (
      <div className="cartao">
        <h3>Desempenho</h3>
        <p className="em-construcao">Carregando...</p>
      </div>
    );
  }

  const { externo, interno, kda, campeoes, posicoes } = dados;
  const semNada = externo.partidas === 0 && interno.partidas === 0;
  const naoPassou = (contagem: Contagem) => contagem.partidas > 0 && contagem.winRate === null;

  return (
    <div className="cartao">
      <h3>Desempenho</h3>

      {semNada ? (
        <p className="em-construcao">
          Nenhuma partida registrada para esta pessoa. O desempenho aparece depois que alguém lança
          quem jogou em uma partida.
        </p>
      ) : (
        <>
          <div className="indicadores">
            <div className="indicador">
              <span className="indicador-valor">{winRate(externo)}</span>
              <span className="indicador-rotulo">Win rate</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{externo.vitorias}</span>
              <span className="indicador-rotulo">Vitórias</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{externo.derrotas}</span>
              <span className="indicador-rotulo">Derrotas</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{externo.partidas}</span>
              <span className="indicador-rotulo">Partidas</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{numero(kda.razao)}</span>
              <span className="indicador-rotulo">Razão KDA</span>
            </div>
          </div>

          {naoPassou(externo) && (
            <p className="dica">
              Dados insuficientes: o win rate só aparece com pelo menos {MINIMO_PARTIDAS} partidas
              contra adversários externos (hoje: {externo.partidas}).
            </p>
          )}

          <p className="dica">
            KDA em {kda.partidasComKda} partida(s): {kda.abates} abates, {kda.mortes} mortes,{" "}
            {kda.assistencias} assistências
            {kda.mediaAbates !== null
              ? ` · média ${numero(kda.mediaAbates)}/${numero(kda.mediaMortes)}/${numero(kda.mediaAssistencias)}`
              : ` · médias e razão só com ${MINIMO_PARTIDAS} partidas com KDA`}
            .
          </p>

          {campeoes.length > 0 && (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Campeão</th>
                  <th>Partidas</th>
                  <th>Vitórias</th>
                  <th>Derrotas</th>
                  <th>Win rate</th>
                </tr>
              </thead>
              <tbody>
                {campeoes.slice(0, MAXIMO_CAMPEOES).map((campeao) => (
                  <tr key={campeao.campeao}>
                    <td>{campeao.campeao}</td>
                    <td>{campeao.partidas}</td>
                    <td>{campeao.vitorias}</td>
                    <td>{campeao.derrotas}</td>
                    <td>{winRate(campeao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {campeoes.length > MAXIMO_CAMPEOES && (
            <p className="dica">+ {campeoes.length - MAXIMO_CAMPEOES} campeão(ões) menos usado(s).</p>
          )}

          <p className="dica">
            Posições:{" "}
            {POSICOES.filter((posicao) => posicoes[posicao] > 0)
              .map((posicao) => `${posicao} (${posicoes[posicao]})`)
              .join(" · ") || "N/D"}
          </p>

          {interno.partidas > 0 && (
            <p className="dica interno-nota">
              Confrontos internos (não entram no win rate): {interno.partidas} partida(s),{" "}
              {interno.vitorias} vitória(s) e {interno.derrotas} derrota(s).
            </p>
          )}
        </>
      )}
    </div>
  );
}