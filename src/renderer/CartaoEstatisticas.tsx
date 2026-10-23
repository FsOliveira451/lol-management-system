import { useEffect, useState } from "react";
import {
  MINIMO_PARTIDAS,
  type Contagem,
  type EstatisticasDaEquipe,
} from "../core/partidas/estatisticas";

function textoWinRate(contagem: Contagem): string {
  return contagem.winRate === null ? "N/D" : `${String(contagem.winRate).replace(".", ",")}%`;
}

export function CartaoEstatisticas({ equipeId }: { equipeId: number }) {
  const [estatisticas, setEstatisticas] = useState<EstatisticasDaEquipe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    window.api.partidas
      .estatisticasDaEquipe(equipeId)
      .then((res) => {
        if (cancelado) return;
        if (res.ok) {
          setEstatisticas(res.dados);
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
  }, [equipeId]);

  if (erro !== null) {
    return (
      <div className="cartao">
        <h3>Resultados</h3>
        <p className="mensagem-erro">{erro}</p>
      </div>
    );
  }
  if (estatisticas === null) {
    return (
      <div className="cartao">
        <h3>Resultados</h3>
        <p className="em-construcao">Carregando...</p>
      </div>
    );
  }

  const { externo, interno, porTipo, forma } = estatisticas;
  const tipos: [string, Contagem][] = [
    ["Scrims", porTipo.scrim],
    ["Amistosos", porTipo.amistoso],
    ["Campeonatos", porTipo.campeonato],
  ];

  return (
    <div className="cartao">
      <h3>Resultados contra adversários externos</h3>

      <div className="indicadores">
        <div className="indicador">
          <span className="indicador-valor">{textoWinRate(externo)}</span>
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
      </div>

      {externo.partidas === 0 ? (
        <p className="dica">Nenhuma partida registrada contra adversários externos.</p>
      ) : (
        externo.winRate === null && (
          <p className="dica">
            Dados insuficientes: o win rate só aparece com pelo menos {MINIMO_PARTIDAS} partidas
            (hoje: {externo.partidas}).
          </p>
        )
      )}

      {forma.length > 0 && (
        <div className="forma-linha">
          <span className="dica sem-margem">Forma recente:</span>
          <div className="forma">
            {forma.map((resultado, i) => (
              <span key={i} className={resultado === "V" ? "forma-item forma-v" : "forma-item forma-d"}>
                {resultado}
              </span>
            ))}
          </div>
        </div>
      )}

      {externo.partidas > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Partidas</th>
              <th>Vitórias</th>
              <th>Derrotas</th>
              <th>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map(([rotulo, contagem]) => (
              <tr key={rotulo}>
                <td>{rotulo}</td>
                <td>{contagem.partidas}</td>
                <td>{contagem.vitorias}</td>
                <td>{contagem.derrotas}</td>
                <td>{textoWinRate(contagem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {interno.partidas > 0 && (
        <p className="dica interno-nota">
          Confrontos internos (não entram no win rate): {interno.partidas} partida(s), {interno.vitorias}{" "}
          vitória(s) e {interno.derrotas} derrota(s).
        </p>
      )}
    </div>
  );
}