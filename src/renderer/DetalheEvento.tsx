import { useEffect, useState } from "react";
import { descreverQuando, formatarInicio, ICONE_TIPO, ROTULO_SITUACAO, rotuloDoEvento } from "../core/eventos/rotulos";
import { agoraLocal, situacaoDoEvento } from "../core/eventos/tempo";
import {
  NOME_TIPO_EVENTO,
  type CampoHistoricoEvento,
  type EntradaHistoricoEvento,
  type Evento,
  type NivelAdversario,
  type StatusEvento,
} from "../core/eventos/tipos";
import { formatarDataHora } from "./formatacao";

interface Props {
  eventoId: number;
  versao: number; // sobe a cada gravacao: faz o detalhe ser buscado de novo
  aoFechar: () => void;
  aoEditar: (evento: Evento) => void;
  aoMudou: () => void; // avisa a pagina que o evento foi alterado
}

const ROTULO_CAMPO_HISTORICO: Record<CampoHistoricoEvento, string> = {
  inicio: "Horário de início",
  duracao_min: "Duração",
  status: "Situação",
  equipes: "Equipes",
};

const ROTULO_STATUS_EVENTO: Record<StatusEvento, string> = {
  agendado: "Agendado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

const ROTULO_NIVEL_ADVERSARIO: Record<NivelAdversario, string> = {
  inferior: "Inferior",
  semelhante: "Semelhante",
  superior: "Superior",
  desconhecido: "Não sei",
};

// Transforma um valor guardado no historico num texto para a tela
function rotuloDoValorHistorico(campo: CampoHistoricoEvento, valor: string | null): string {
  if (valor === null) return "N/D";
  if (campo === "inicio") return formatarInicio(valor);
  if (campo === "duracao_min") return `${valor} min`;
  if (campo === "status") return ROTULO_STATUS_EVENTO[valor as StatusEvento] ?? valor;
  return valor;
}

function textoOuND(valor: string | null): string {
  return valor === null || valor.trim() === "" ? "N/D" : valor;
}

export function DetalheEvento({ eventoId, versao, aoFechar, aoEditar, aoMudou }: Props) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [historico, setHistorico] = useState<EntradaHistoricoEvento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [confirmandoRealizado, setConfirmandoRealizado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errosAcao, setErrosAcao] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    Promise.all([window.api.eventos.buscar(eventoId), window.api.eventos.historico(eventoId)])
      .then(([resEvento, resHistorico]) => {
        if (cancelado) return;
        if (!resEvento.ok) {
          setErro(resEvento.erros.join(" "));
          return;
        }
        if (!resHistorico.ok) {
          setErro(resHistorico.erros.join(" "));
          return;
        }
        setEvento(resEvento.dados);
        setHistorico(resHistorico.dados);
        setErro(resEvento.dados === null ? "Evento não encontrado." : null);
      })
      .catch(() => {
        if (!cancelado) setErro("Falha na comunicação com o programa.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [eventoId, versao]);

  function marcarRealizado() {
    setErrosAcao([]);
    setProcessando(true);
    window.api.eventos
      .marcarRealizado(eventoId)
      .then((res) => {
        if (res.ok) {
          setConfirmandoRealizado(false);
          aoMudou();
        } else {
          setErrosAcao(res.erros);
        }
      })
      .catch(() => setErrosAcao(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  function cancelarEvento() {
    setErrosAcao([]);
    setProcessando(true);
    window.api.eventos
      .cancelar({ id: eventoId, motivo: motivo.trim() })
      .then((res) => {
        if (res.ok) {
          setCancelando(false);
          setMotivo("");
          aoMudou();
        } else {
          setErrosAcao(res.erros);
        }
      })
      .catch(() => setErrosAcao(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  if (evento === null) {
    return (
      <div className="fundo-modal">
        <div className="modal modal-larga">
          {carregando ? (
            <p className="em-construcao">Carregando...</p>
          ) : (
            <>
              {erro !== null && <p className="mensagem-erro">{erro}</p>}
              <div className="acoes-modal">
                <button className="botao" onClick={aoFechar}>
                  Fechar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const situacao = situacaoDoEvento(evento, agoraLocal());
  const cancelado = evento.status === "cancelado";
  const jaComecou = situacao === "em_andamento" || situacao === "pendente_registro";
  const podeRealizar = evento.status === "agendado" && jaComecou;
  const podeCancelar = evento.status === "agendado";

  return (
    <div className="fundo-modal">
      <div className="modal modal-larga">
        <div className="cabecalho-detalhe">
          <h3>
            {ICONE_TIPO[evento.tipo]} {rotuloDoEvento(evento)}
          </h3>
          <span className={`chip-evento chip-${situacao}`}>{ROTULO_SITUACAO[situacao]}</span>
        </div>

        {erro !== null && <p className="mensagem-erro">{erro}</p>}

        <dl className="grade-dados">
          <div>
            <dt>Tipo</dt>
            <dd>{NOME_TIPO_EVENTO[evento.tipo]}</dd>
          </div>
          <div>
            <dt>Quando</dt>
            <dd>{descreverQuando(evento.inicio, evento.duracaoMin)}</dd>
          </div>
          <div>
            <dt>Equipes</dt>
            <dd>
              {evento.equipes.length === 0
                ? "Geral (nenhuma equipe)"
                : evento.equipes.map((equipe) => equipe.nome).join(", ")}
            </dd>
          </div>
          {evento.adversario !== null && (
            <div>
              <dt>Adversário</dt>
              <dd>
                {evento.adversario}
                {evento.nivelAdversario !== null
                  ? ` (${ROTULO_NIVEL_ADVERSARIO[evento.nivelAdversario]})`
                  : ""}
              </dd>
            </div>
          )}
          {evento.partidasPrevistas !== null && (
            <div>
              <dt>Partidas previstas</dt>
              <dd>{evento.partidasPrevistas}</dd>
            </div>
          )}
          <div>
            <dt>Objetivo</dt>
            <dd>{textoOuND(evento.objetivo)}</dd>
          </div>
          <div>
            <dt>Local ou canal</dt>
            <dd>{textoOuND(evento.local)}</dd>
          </div>
          <div>
            <dt>Regras</dt>
            <dd>{textoOuND(evento.regras)}</dd>
          </div>
          <div>
            <dt>Observações</dt>
            <dd>{textoOuND(evento.observacoes)}</dd>
          </div>
        </dl>

        {errosAcao.length > 0 && (
          <ul className="lista-erros">
            {errosAcao.map((mensagem) => (
              <li key={mensagem}>{mensagem}</li>
            ))}
          </ul>
        )}

        {confirmandoRealizado && (
          <div className="plano">
            <strong>Confirmar que o evento foi realizado?</strong>
            <p className="dica sem-margem">
              Depois disso, tipo, data, duração, equipes e adversário ficam travados e o evento
              não pode mais ser cancelado.
            </p>
            <div className="acoes-modal">
              <button
                className="botao"
                disabled={processando}
                onClick={() => setConfirmandoRealizado(false)}
              >
                Voltar
              </button>
              <button
                className="botao botao-principal"
                disabled={processando}
                onClick={marcarRealizado}
              >
                {processando ? "Salvando..." : "Sim, foi realizado"}
              </button>
            </div>
          </div>
        )}

        {cancelando && (
          <div className="plano">
            <label className="campo">
              Motivo do cancelamento (obrigatório)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <div className="acoes-modal">
              <button
                className="botao"
                disabled={processando}
                onClick={() => {
                  setCancelando(false);
                  setMotivo("");
                  setErrosAcao([]);
                }}
              >
                Voltar
              </button>
              <button
                className="botao botao-principal"
                disabled={processando}
                onClick={cancelarEvento}
              >
                {processando ? "Salvando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        )}

        {!confirmandoRealizado && !cancelando && (
          <div className="acoes-detalhe">
            {!cancelado && (
              <button className="botao" onClick={() => aoEditar(evento)}>
                Editar
              </button>
            )}
            {podeRealizar && (
              <button
                className="botao"
                onClick={() => {
                  setErrosAcao([]);
                  setConfirmandoRealizado(true);
                }}
              >
                Marcar como realizado
              </button>
            )}
            {podeCancelar && (
              <button
                className="botao"
                onClick={() => {
                  setErrosAcao([]);
                  setCancelando(true);
                }}
              >
                Cancelar evento
              </button>
            )}
          </div>
        )}

        {evento.status === "agendado" && !jaComecou && (
          <p className="dica">Só é possível marcar como realizado depois que o evento começar.</p>
        )}

        <div className="cartao">
          <h3>Histórico</h3>
          {historico.length === 0 ? (
            <p className="em-construcao">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="linha-do-tempo">
              {[...historico].reverse().map((entrada) => (
                <li key={entrada.id} className="evento">
                  <div className="evento-topo">
                    <strong>{ROTULO_CAMPO_HISTORICO[entrada.campo]}</strong>
                    <span className="evento-data">{formatarDataHora(entrada.registradoEm)}</span>
                  </div>
                  <div>
                    {rotuloDoValorHistorico(entrada.campo, entrada.valorAnterior)} →{" "}
                    {rotuloDoValorHistorico(entrada.campo, entrada.valorNovo)}
                  </div>
                  {entrada.motivo !== null && (
                    <div className="evento-motivo">Motivo: {entrada.motivo}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="acoes-modal">
          <button className="botao" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}