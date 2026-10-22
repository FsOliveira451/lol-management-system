import { useEffect, useState } from "react";
import type { Resultado } from "../compartilhado/api";
import { agoraLocal, emMinutos } from "../core/eventos/tempo";
import type { Evento } from "../core/eventos/tipos";
import {
  ESTADOS_PRESENCA,
  ehEstadoFinal,
  ICONE_PRESENCA,
  ROTULO_PRESENCA,
  type ConvocacaoEvento,
  type EstadoPresenca,
} from "../core/presenca/tipos";
import type { Jogador } from "../core/jogadores/tipos";
import type { PessoaExcluidaNomeada } from "../database/presenca-repositorio";
import { ROTULO_FUNCAO } from "./formatacao";

interface Props {
  evento: Evento;
  versao: number; // sobe quando o evento e alterado: recarrega a lista
}

export function PainelPresenca({ evento, versao }: Props) {
  const [convocados, setConvocados] = useState<ConvocacaoEvento[]>([]);
  const [pessoas, setPessoas] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erros, setErros] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [excluidos, setExcluidos] = useState<PessoaExcluidaNomeada[]>([]);
  const [escolhida, setEscolhida] = useState<number | "">("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    Promise.all([window.api.presenca.convocados(evento.id), window.api.jogadores.listar({})])
      .then(([resConvocados, resPessoas]) => {
        if (cancelado) return;
        if (!resConvocados.ok) {
          setErros(resConvocados.erros);
          return;
        }
        setConvocados(resConvocados.dados);
        if (resPessoas.ok) setPessoas(resPessoas.dados);
      })
      .catch(() => {
        if (!cancelado) setErros(["Falha na comunicação com o programa."]);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [evento.id, versao, recarga]);

  // Executa uma acao, mostra os erros (se houver) e recarrega a lista
  function aplicar<T>(chamada: Promise<Resultado<T>>, aoDarCerto?: (dados: T) => void) {
    setErros([]);
    setProcessando(true);
    chamada
      .then((res) => {
        if (res.ok) {
          aoDarCerto?.(res.dados);
          setRecarga((n) => n + 1);
        } else {
          setErros(res.erros);
        }
      })
      .catch(() => setErros(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  const jaComecou = emMinutos(agoraLocal()) >= emMinutos(evento.inicio);
  const idsConvocados = new Set(convocados.map((c) => c.jogadorId));
  const disponiveis = pessoas.filter((pessoa) => !idsConvocados.has(pessoa.id));
  const presentes = convocados.filter((c) => c.estado === "presente" || c.estado === "atrasou").length;

  return (
    <div className="cartao">
      <h3>Convocados e presença</h3>

      {carregando && convocados.length === 0 ? (
        <p className="em-construcao">Carregando...</p>
      ) : (
        <>
          <p className="dica">
            {convocados.length} convocado(s) · {presentes} compareceu(ram)
            {!jaComecou &&
              " · Presente, atrasou, faltou e falta justificada só ficam disponíveis depois do início do evento."}
          </p>

          {erros.length > 0 && (
            <ul className="lista-erros">
              {erros.map((erro) => (
                <li key={erro}>{erro}</li>
              ))}
            </ul>
          )}

          {convocados.length === 0 ? (
            <p className="em-construcao">Ninguém convocado ainda.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Equipe</th>
                  <th>Função</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {convocados.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.apelido}</strong>
                    </td>
                    <td>{c.equipeNome ?? "Avulso"}</td>
                    <td>{c.funcao === null ? "—" : ROTULO_FUNCAO[c.funcao]}</td>
                    <td>
                      <select
                        className="seletor seletor-pequeno"
                        value={c.estado}
                        disabled={processando}
                        onChange={(e) =>
                          aplicar(
                            window.api.presenca.definirEstado({
                              eventoId: evento.id,
                              jogadorId: c.jogadorId,
                              estado: e.target.value as EstadoPresenca,
                            }),
                          )
                        }
                      >
                        {ESTADOS_PRESENCA.map((estado) => (
                          <option
                            key={estado}
                            value={estado}
                            disabled={ehEstadoFinal(estado) && !jaComecou}
                          >
                            {ICONE_PRESENCA[estado]} {ROTULO_PRESENCA[estado]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="celula-acoes">
                      <button
                        className="botao botao-pequeno"
                        disabled={processando || ehEstadoFinal(c.estado)}
                        title={
                          ehEstadoFinal(c.estado)
                            ? "Já tem presença registrada: altere o estado em vez de remover"
                            : "Remover da convocação"
                        }
                        onClick={() =>
                          aplicar(
                            window.api.presenca.remover({
                              eventoId: evento.id,
                              jogadorId: c.jogadorId,
                            }),
                          )
                        }
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="linha-adicionar">
            <select
              className="seletor"
              value={escolhida}
              onChange={(e) => setEscolhida(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Convocar mais uma pessoa...</option>
              {disponiveis.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.apelido}
                </option>
              ))}
            </select>
            <button
              className="botao"
              disabled={processando || escolhida === ""}
              onClick={() => {
                if (escolhida === "") return;
                aplicar(
                  window.api.presenca.adicionar({ eventoId: evento.id, jogadorId: escolhida }),
                  () => setEscolhida(""),
                );
              }}
            >
              Adicionar
            </button>
            <button
              className="botao"
              disabled={processando || evento.equipes.length === 0}
              title="Convoca quem entrou nas equipes depois. Nunca remove ninguém."
              onClick={() =>
                aplicar(window.api.presenca.convocarEquipes(evento.id), (resultado) =>
                  setExcluidos(resultado.excluidos),
                )
              }
            >
              Convocar equipes novamente
            </button>
          </div>

          {excluidos.length > 0 && (
            <div className="aviso-conflito">
              <strong>Ficaram de fora da convocação automática</strong>
              <ul>
                {excluidos.map((pessoa) => (
                  <li key={pessoa.jogadorId}>
                    {pessoa.apelido}: {pessoa.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}