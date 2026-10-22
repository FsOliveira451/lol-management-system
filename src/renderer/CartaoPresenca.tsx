import { useEffect, useState } from "react";
import { NOME_TIPO_EVENTO } from "../core/eventos/tipos";
import { formatarInicio } from "../core/eventos/rotulos";
import type { Tendencia } from "../core/presenca/calculo";
import { ICONE_PRESENCA, ROTULO_PRESENCA } from "../core/presenca/tipos";
import type { PresencaDaPessoa } from "../database/presenca-repositorio";
import { ICONE_ALERTA } from "./formatacao";

const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  subindo: "📈 Subindo",
  estavel: "➖ Estável",
  caindo: "📉 Caindo",
};

export function CartaoPresenca({ jogadorId }: { jogadorId: number }) {
  const [presenca, setPresenca] = useState<PresencaDaPessoa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    window.api.presenca
      .daPessoa(jogadorId)
      .then((res) => {
        if (cancelado) return;
        if (res.ok) {
          setPresenca(res.dados);
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
        <h3>Presença</h3>
        <p className="mensagem-erro">{erro}</p>
      </div>
    );
  }
  if (presenca === null) {
    return (
      <div className="cartao">
        <h3>Presença</h3>
        <p className="em-construcao">Carregando...</p>
      </div>
    );
  }

  const { resumo, tendencia, alerta, registros } = presenca;
  const ultimos = [...registros].reverse().slice(0, 5);

  return (
    <div className="cartao">
      <h3>Presença</h3>

      <div className="indicadores">
        <div className="indicador">
          <span className="indicador-valor">
            {resumo.percentual === null ? "N/D" : `${String(resumo.percentual).replace(".", ",")}%`}
          </span>
          <span className="indicador-rotulo">Presença</span>
        </div>
        <div className="indicador">
          <span className="indicador-valor">{resumo.presentes}</span>
          <span className="indicador-rotulo">Presentes</span>
        </div>
        <div className="indicador">
          <span className="indicador-valor">{resumo.atrasos}</span>
          <span className="indicador-rotulo">Atrasos</span>
        </div>
        <div className="indicador">
          <span className="indicador-valor">{resumo.faltas}</span>
          <span className="indicador-rotulo">Faltas</span>
        </div>
        <div className="indicador">
          <span className="indicador-valor">{resumo.justificadas}</span>
          <span className="indicador-rotulo">Justificadas</span>
        </div>
        <div className="indicador">
          <span className="indicador-valor">{resumo.pendentes}</span>
          <span className="indicador-rotulo">Pendentes</span>
        </div>
      </div>

      {resumo.percentual === null && (
        <p className="dica">
          Dados insuficientes: o percentual só aparece com pelo menos 5 eventos registrados
          (hoje: {resumo.registrados}).
        </p>
      )}

      {alerta !== null && (
        <div className={`alerta-linha alerta-${alerta.nivel}`}>
          {ICONE_ALERTA[alerta.nivel]} {alerta.mensagem}
        </div>
      )}

      <p className="dica">
        Tendência:{" "}
        {tendencia === null
          ? "N/D (precisa de 10 eventos com resultado)"
          : ROTULO_TENDENCIA[tendencia]}
      </p>

      {ultimos.length > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Evento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ultimos.map((registro) => (
              <tr key={registro.eventoId}>
                <td>{formatarInicio(registro.inicio)}</td>
                <td>{registro.titulo ?? NOME_TIPO_EVENTO[registro.tipo]}</td>
                <td>
                  {ICONE_PRESENCA[registro.estado]} {ROTULO_PRESENCA[registro.estado]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}