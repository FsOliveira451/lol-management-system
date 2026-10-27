import { useEffect, useState, type FormEvent } from "react";
import { CAMPEOES, chaveCampeao } from "../core/desempenho/campeoes";
import type { DadosDesempenho } from "../core/desempenho/tipos";
import type { Evento } from "../core/eventos/tipos";
import { POSICOES, type Posicao } from "../core/jogadores/tipos";
import type { Partida } from "../core/partidas/tipos";
import type { ConvocacaoEvento } from "../core/presenca/tipos";
import type {
  CampoHistoricoDesempenho,
  DesempenhoDetalhado,
  EntradaHistoricoDesempenho,
} from "../database/desempenho-repositorio";
import { ICONE_ALERTA, formatarDataHora } from "./formatacao";

interface Props {
  evento: Evento;
  partida: Partida;
  versao: number; // sobe quando algo muda: recarrega a lista
  aoMudou: () => void;
}

interface ValoresDesempenho {
  jogadorId: string;
  equipeId: string; // so usado em convocacao avulsa de confronto interno
  posicao: string;
  campeao: string;
  abates: string;
  mortes: string;
  assistencias: string;
}

const VAZIO: ValoresDesempenho = {
  jogadorId: "",
  equipeId: "",
  posicao: "",
  campeao: "",
  abates: "",
  mortes: "",
  assistencias: "",
};

const ROTULO_CAMPO: Record<CampoHistoricoDesempenho, string> = {
  posicao: "Posição",
  campeao: "Campeão",
  kda: "KDA",
  situacao: "Situação",
};

function numeroOuNulo(texto: string): number | null {
  return texto.trim() === "" ? null : Number(texto);
}

function textoKda(r: DesempenhoDetalhado): string {
  return r.abates === null || r.mortes === null || r.assistencias === null
    ? "N/D"
    : `${r.abates}/${r.mortes}/${r.assistencias}`;
}

export function PainelDesempenho({ evento, partida, versao, aoMudou }: Props) {
  const [registros, setRegistros] = useState<DesempenhoDetalhado[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [convocados, setConvocados] = useState<ConvocacaoEvento[]>([]);
  const [historico, setHistorico] = useState<EntradaHistoricoDesempenho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erros, setErros] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // Formulario: registro null = registrar um novo
  const [form, setForm] = useState<{ registro: DesempenhoDetalhado | null } | null>(null);
  const [valores, setValores] = useState<ValoresDesempenho>(VAZIO);
  const [motivo, setMotivo] = useState("");

  // Apagar
  const [apagando, setApagando] = useState<DesempenhoDetalhado | null>(null);
  const [motivoApagar, setMotivoApagar] = useState("");

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    Promise.all([
      window.api.desempenho.daPartida(partida.id),
      window.api.presenca.convocados(evento.id),
      window.api.desempenho.historico(evento.id),
    ])
      .then(([resDesempenho, resConvocados, resHistorico]) => {
        if (cancelado) return;
        if (!resDesempenho.ok) {
          setErros(resDesempenho.erros);
          return;
        }
        setRegistros(resDesempenho.dados.registros);
        setAvisos(resDesempenho.dados.avisos);
        if (resConvocados.ok) setConvocados(resConvocados.dados);
        if (resHistorico.ok) {
          setHistorico(resHistorico.dados.filter((h) => h.partidaId === partida.id));
        }
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
  }, [partida.id, evento.id, versao, recarga]);

  const interno = evento.equipes.length === 2;

  // Quem pode ser lancado: jogador convocado, com presenca "presente" ou "atrasou", ainda sem registro
  const elegiveis = convocados.filter(
    (c) =>
      c.papel === "jogador" &&
      (c.estado === "presente" || c.estado === "atrasou") &&
      !registros.some((r) => r.jogadorId === c.jogadorId),
  );

  const escolhida = convocados.find((c) => String(c.jogadorId) === valores.jogadorId);
  const precisaLado = interno && escolhida !== undefined && escolhida.equipeId === null;

  const editando = form?.registro ?? null;
  const mudouCritico =
    editando !== null &&
    (valores.posicao !== editando.posicao ||
      chaveCampeao(valores.campeao) !== chaveCampeao(editando.campeao) ||
      valores.abates.trim() !== String(editando.abates ?? "") ||
      valores.mortes.trim() !== String(editando.mortes ?? "") ||
      valores.assistencias.trim() !== String(editando.assistencias ?? ""));

  function abrirNovo() {
    setValores(VAZIO);
    setMotivo("");
    setApagando(null);
    setErros([]);
    setForm({ registro: null });
  }

  function abrirCorrecao(registro: DesempenhoDetalhado) {
    setValores({
      jogadorId: String(registro.jogadorId),
      equipeId: "",
      posicao: registro.posicao,
      campeao: registro.campeao,
      abates: registro.abates === null ? "" : String(registro.abates),
      mortes: registro.mortes === null ? "" : String(registro.mortes),
      assistencias: registro.assistencias === null ? "" : String(registro.assistencias),
    });
    setMotivo("");
    setApagando(null);
    setErros([]);
    setForm({ registro });
  }

  function fecharForm() {
    setForm(null);
    setErros([]);
  }

  function enviar(envio: FormEvent) {
    envio.preventDefault();
    if (form === null) return;
    setErros([]);
    setProcessando(true);

    const dados: DadosDesempenho = {
      abates: numeroOuNulo(valores.abates),
      mortes: numeroOuNulo(valores.mortes),
      assistencias: numeroOuNulo(valores.assistencias),
    };
    if (valores.posicao !== "") dados.posicao = valores.posicao as Posicao;
    if (valores.campeao.trim() !== "") dados.campeao = valores.campeao;

    if (form.registro === null) {
      if (valores.jogadorId !== "") dados.jogadorId = Number(valores.jogadorId);
      if (precisaLado && valores.equipeId !== "") dados.equipeId = Number(valores.equipeId);
    }

    const chamada =
      form.registro === null
        ? window.api.desempenho.registrar({ partidaId: partida.id, dados })
        : window.api.desempenho.corrigir({
            desempenhoId: form.registro.id,
            dados,
            motivo: motivo.trim(),
          });

    chamada
      .then((res) => {
        if (res.ok) {
          setForm(null);
          setRecarga((n) => n + 1);
          aoMudou();
        } else {
          setErros(res.erros);
        }
      })
      .catch(() => setErros(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  function confirmarApagar() {
    if (apagando === null) return;
    setErros([]);
    setProcessando(true);
    window.api.desempenho
      .apagar({ desempenhoId: apagando.id, motivo: motivoApagar.trim() })
      .then((res) => {
        if (res.ok) {
          setApagando(null);
          setMotivoApagar("");
          setRecarga((n) => n + 1);
          aoMudou();
        } else {
          setErros(res.erros);
        }
      })
      .catch(() => setErros(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  return (
    <div className="sub-painel">
      <div className="cabecalho-painel">
        <h4>Quem jogou na partida {partida.numero}</h4>
        <button
          className="botao botao-pequeno botao-principal"
          disabled={processando || form !== null || elegiveis.length === 0}
          onClick={abrirNovo}
        >
          Registrar jogador
        </button>
      </div>

      {!carregando && elegiveis.length === 0 && (
        <p className="dica">
          Só dá para lançar quem foi convocado como jogador e está com presença{" "}
          <strong>presente</strong> ou <strong>atrasou</strong>. Marque a presença em
          &quot;Convocados e presença&quot; e reabra esta lista.
        </p>
      )}

      {erros.length > 0 && (
        <ul className="lista-erros">
          {erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      )}

      {avisos.map((aviso) => (
        <div key={aviso} className="alerta-linha alerta-observacao">
          {ICONE_ALERTA.observacao} {aviso}
        </div>
      ))}

      {carregando && registros.length === 0 ? (
        <p className="em-construcao">Carregando...</p>
      ) : registros.length === 0 ? (
        <p className="em-construcao">Ninguém registrado nesta partida.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Equipe</th>
              <th>Pessoa</th>
              <th>Posição</th>
              <th>Campeão</th>
              <th>KDA</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id}>
                <td>{registro.equipeNome}</td>
                <td>
                  <strong>{registro.apelido}</strong>
                </td>
                <td>{registro.posicao}</td>
                <td>{registro.campeao}</td>
                <td>{textoKda(registro)}</td>
                <td className="celula-acoes">
                  <button
                    className="botao botao-pequeno"
                    disabled={processando || form !== null}
                    onClick={() => abrirCorrecao(registro)}
                  >
                    Corrigir
                  </button>{" "}
                  <button
                    className="botao botao-pequeno"
                    disabled={processando || form !== null}
                    onClick={() => {
                      setErros([]);
                      setMotivoApagar("");
                      setApagando(registro);
                    }}
                  >
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {apagando !== null && (
        <div className="plano">
          <strong>
            Apagar o registro de {apagando.apelido} ({apagando.posicao}, {apagando.campeao})?
          </strong>
          <label className="campo">
            Motivo (obrigatório)
            <input value={motivoApagar} onChange={(e) => setMotivoApagar(e.target.value)} />
          </label>
          <div className="acoes-modal">
            <button className="botao" disabled={processando} onClick={() => setApagando(null)}>
              Voltar
            </button>
            <button className="botao botao-principal" disabled={processando} onClick={confirmarApagar}>
              {processando ? "Apagando..." : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      )}

      {form !== null && (
        <form className="plano" onSubmit={enviar}>
          <strong>
            {editando === null ? "Registrar jogador" : `Corrigir ${editando.apelido}`}
          </strong>

          <div className="grade-campos">
            {editando === null ? (
              <label className="campo">
                Pessoa
                <select
                  value={valores.jogadorId}
                  onChange={(e) => setValores({ ...valores, jogadorId: e.target.value })}
                >
                  <option value="">Escolha...</option>
                  {elegiveis.map((c) => (
                    <option key={c.jogadorId} value={c.jogadorId}>
                      {c.apelido}
                      {c.equipeNome !== null ? ` (${c.equipeNome})` : " (avulso)"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="campo">
                Pessoa
                <span className="valor-fixo">
                  {editando.apelido} · {editando.equipeNome}
                </span>
              </div>
            )}

            {precisaLado && (
              <label className="campo">
                Jogou por qual equipe?
                <select
                  value={valores.equipeId}
                  onChange={(e) => setValores({ ...valores, equipeId: e.target.value })}
                >
                  <option value="">Escolha...</option>
                  {evento.equipes.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="campo">
              Posição
              <select
                value={valores.posicao}
                onChange={(e) => setValores({ ...valores, posicao: e.target.value })}
              >
                <option value="">Escolha...</option>
                {POSICOES.map((posicao) => (
                  <option key={posicao} value={posicao}>
                    {posicao}
                  </option>
                ))}
              </select>
            </label>

            <label className="campo">
              Campeão
              <input
                list="lista-campeoes"
                value={valores.campeao}
                onChange={(e) => setValores({ ...valores, campeao: e.target.value })}
              />
              <datalist id="lista-campeoes">
                {CAMPEOES.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grade-kda">
            <label className="campo">
              Abates
              <input
                type="number"
                min={0}
                max={99}
                value={valores.abates}
                onChange={(e) => setValores({ ...valores, abates: e.target.value })}
              />
            </label>
            <label className="campo">
              Mortes
              <input
                type="number"
                min={0}
                max={99}
                value={valores.mortes}
                onChange={(e) => setValores({ ...valores, mortes: e.target.value })}
              />
            </label>
            <label className="campo">
              Assistências
              <input
                type="number"
                min={0}
                max={99}
                value={valores.assistencias}
                onChange={(e) => setValores({ ...valores, assistencias: e.target.value })}
              />
            </label>
          </div>
          <p className="dica">KDA é opcional, mas os três valores vão juntos ou ficam todos em branco.</p>

          {mudouCritico && (
            <label className="campo">
              Motivo da correção (obrigatório)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
          )}

          <div className="acoes-modal">
            <button type="button" className="botao" disabled={processando} onClick={fecharForm}>
              Cancelar
            </button>
            <button type="submit" className="botao botao-principal" disabled={processando}>
              {processando ? "Salvando..." : editando === null ? "Registrar" : "Salvar correção"}
            </button>
          </div>
        </form>
      )}

      {historico.length > 0 && (
        <div className="bloco-historico">
          <button className="botao botao-pequeno" onClick={() => setMostrarHistorico((v) => !v)}>
            {mostrarHistorico ? "Esconder histórico" : `Histórico desta partida (${historico.length})`}
          </button>

          {mostrarHistorico && (
            <ol className="historico">
              {[...historico].reverse().map((entrada) => (
                <li key={entrada.id} className="historico-item">
                  <span className="historico-campo">
                    {entrada.apelido} · {ROTULO_CAMPO[entrada.campo]}
                  </span>
                  <div className="historico-corpo">
                    <div className="historico-mudanca">
                      {entrada.valorAnterior === null ? (
                        <span className="valor-novo">{entrada.valorNovo ?? "N/D"}</span>
                      ) : (
                        <>
                          <span className="valor-antigo">{entrada.valorAnterior}</span>
                          <span className="historico-seta">→</span>
                          <span className="valor-novo">{entrada.valorNovo ?? "N/D"}</span>
                        </>
                      )}
                    </div>
                    {entrada.motivo !== null && (
                      <div className="historico-meta">
                        <span>Motivo: {entrada.motivo}</span>
                      </div>
                    )}
                  </div>
                  <time className="historico-data">{formatarDataHora(entrada.registradoEm)}</time>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}