import { useEffect, useState, type FormEvent } from "react";
import { agoraLocal, emMinutos, situacaoDoEvento } from "../core/eventos/tempo";
import type { Evento } from "../core/eventos/tipos";
import {
  DURACAO_PARTIDA_MAX,
  DURACAO_PARTIDA_MIN,
  MAXIMO_PARTIDAS,
  type DadosPartida,
  type Partida,
} from "../core/partidas/tipos";
import type {
  CampoHistoricoPartida,
  EntradaHistoricoPartida,
} from "../database/partidas-repositorio";
import { ICONE_ALERTA, formatarDataHora } from "./formatacao";

interface Props {
  evento: Evento;
  versao: number; // sobe quando algo muda: recarrega a lista
  aoMudou: () => void; // avisa a pagina (o evento pode ter virado "realizado")
}

interface ValoresPartida {
  numero: string;
  vencedor: string; // "" = nao escolhido | "adv" = o adversario venceu | id da equipe
  duracao: string;
  observacoes: string;
}

const ROTULO_CAMPO_PARTIDA: Record<CampoHistoricoPartida, string> = {
  numero: "Número",
  vencedor: "Vencedor",
  duracao_min: "Duração",
  situacao: "Situação",
};

export function PainelPartidas({ evento, versao, aoMudou }: Props) {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [previstas, setPrevistas] = useState<number | null>(null);
  const [historico, setHistorico] = useState<EntradaHistoricoPartida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erros, setErros] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  // Formulario de registrar/corrigir: partida null = registrar uma nova
  const [formAberto, setFormAberto] = useState<{ partida: Partida | null } | null>(null);
  const [valores, setValores] = useState<ValoresPartida>({
    numero: "",
    vencedor: "",
    duracao: "",
    observacoes: "",
  });
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // Apagar
  const [apagando, setApagando] = useState<Partida | null>(null);
  const [motivoApagar, setMotivoApagar] = useState("");

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    Promise.all([window.api.partidas.doEvento(evento.id), window.api.partidas.historico(evento.id)])
      .then(([resPartidas, resHistorico]) => {
        if (cancelado) return;
        if (!resPartidas.ok) {
          setErros(resPartidas.erros);
          return;
        }
        setPartidas(resPartidas.dados.partidas);
        setAvisos(resPartidas.dados.avisos);
        setPrevistas(resPartidas.dados.partidasPrevistas);
        if (resHistorico.ok) setHistorico(resHistorico.dados);
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
  }, [evento.id, versao]);

  const interno = evento.equipes.length === 2;
  const nomeAdversario = evento.adversario?.trim() || "Adversário";
  const jaComecou = emMinutos(agoraLocal()) >= emMinutos(evento.inicio);
  const situacao = situacaoDoEvento(evento, agoraLocal());

  // Opcoes de "quem venceu": no confronto interno, as duas equipes; senao, vitoria ou derrota
  const opcoesVencedor: { valor: string; rotulo: string }[] = interno
    ? evento.equipes.map((equipe) => ({ valor: String(equipe.id), rotulo: `Vitória: ${equipe.nome}` }))
    : evento.equipes.length === 1
      ? [
          { valor: String(evento.equipes[0]!.id), rotulo: `Vitória: ${evento.equipes[0]!.nome}` },
          { valor: "adv", rotulo: `Derrota: venceu ${nomeAdversario}` },
        ]
      : [];

  function resultadoTexto(partida: Partida): string {
    if (interno) {
      const nome = evento.equipes.find((e) => e.id === partida.vencedorEquipeId)?.nome;
      return `🏆 ${nome ?? "?"}`;
    }
    return partida.vencedorEquipeId === null ? `❌ Derrota (${nomeAdversario})` : "✅ Vitória";
  }

  const usados = partidas.map((p) => p.numero);
  let proximoNumero = "";
  for (let n = 1; n <= MAXIMO_PARTIDAS; n++) {
    if (!usados.includes(n)) {
      proximoNumero = String(n);
      break;
    }
  }

  function abrirNova() {
    setValores({ numero: proximoNumero, vencedor: "", duracao: "", observacoes: "" });
    setMotivo("");
    setConfirmando(false);
    setApagando(null);
    setErros([]);
    setFormAberto({ partida: null });
  }

  function abrirCorrecao(partida: Partida) {
    setValores({
      numero: String(partida.numero),
      vencedor: partida.vencedorEquipeId === null ? "adv" : String(partida.vencedorEquipeId),
      duracao: partida.duracaoMin === null ? "" : String(partida.duracaoMin),
      observacoes: partida.observacoes ?? "",
    });
    setMotivo("");
    setConfirmando(false);
    setApagando(null);
    setErros([]);
    setFormAberto({ partida });
  }

  function fecharForm() {
    setFormAberto(null);
    setConfirmando(false);
    setErros([]);
  }

  const editando = formAberto?.partida ?? null;
  const mudouCritico =
    editando !== null &&
    (Number(valores.numero) !== editando.numero ||
      valores.vencedor !== (editando.vencedorEquipeId === null ? "adv" : String(editando.vencedorEquipeId)) ||
      valores.duracao !== (editando.duracaoMin === null ? "" : String(editando.duracaoMin)));

  function enviar() {
    if (formAberto === null) return;
    setErros([]);
    setProcessando(true);

    const dados: DadosPartida = {
      numero: Number(valores.numero),
      duracaoMin: valores.duracao.trim() === "" ? null : Number(valores.duracao),
      observacoes: valores.observacoes.trim() === "" ? null : valores.observacoes,
    };
    if (valores.vencedor !== "") {
      dados.vencedorEquipeId = valores.vencedor === "adv" ? null : Number(valores.vencedor);
    }

    const chamada =
      formAberto.partida === null
        ? window.api.partidas.registrar({ eventoId: evento.id, dados })
        : window.api.partidas.corrigir({
            partidaId: formAberto.partida.id,
            dados,
            motivo: motivo.trim(),
          });

    chamada
      .then((res) => {
        if (res.ok) {
          fecharForm();
          aoMudou();
        } else {
          setConfirmando(false);
          setErros(res.erros);
        }
      })
      .catch(() => setErros(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  function aoEnviarForm(envio: FormEvent) {
    envio.preventDefault();
    // A 1a partida de um evento ainda "agendado" o marca como realizado: pede confirmacao
    if (editando === null && evento.status === "agendado" && !confirmando) {
      setConfirmando(true);
      return;
    }
    enviar();
  }

  function confirmarApagar() {
    if (apagando === null) return;
    setErros([]);
    setProcessando(true);
    window.api.partidas
      .apagar({ partidaId: apagando.id, motivo: motivoApagar.trim() })
      .then((res) => {
        if (res.ok) {
          setApagando(null);
          setMotivoApagar("");
          aoMudou();
        } else {
          setErros(res.erros);
        }
      })
      .catch(() => setErros(["Falha na comunicação com o programa."]))
      .finally(() => setProcessando(false));
  }

  const semResultado = partidas.length === 0;

  return (
    <div className="cartao">
      <div className="cabecalho-painel">
        <h3>Partidas e resultado</h3>
        <button
          className="botao botao-pequeno botao-principal"
          disabled={
            processando || !jaComecou || evento.equipes.length === 0 || proximoNumero === "" || formAberto !== null
          }
          onClick={abrirNova}
        >
          Registrar partida
        </button>
      </div>

      {!jaComecou && (
        <p className="dica">Só é possível registrar partidas depois que o evento começar.</p>
      )}

      {evento.equipes.length === 0 && (
        <p className="dica">Este evento não tem equipe da organização: não há para quem registrar o resultado.</p>
      )}

      {!carregando && semResultado && situacao === "pendente_registro" && (
        <div className="alerta-linha alerta-atencao">
          {ICONE_ALERTA.atencao} Evento terminou sem resultado registrado. Registre o resultado das partidas.
        </div>
      )}
      {!carregando && semResultado && situacao === "realizado" && (
        <div className="alerta-linha alerta-observacao">
          {ICONE_ALERTA.observacao} Evento realizado sem nenhuma partida registrada.
        </div>
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

      {carregando && partidas.length === 0 ? (
        <p className="em-construcao">Carregando...</p>
      ) : partidas.length === 0 ? (
        <p className="em-construcao">Nenhuma partida registrada.</p>
      ) : (
        <>
          <p className="dica">
            {partidas.length} partida(s) registrada(s)
            {previstas !== null ? ` · ${previstas} prevista(s)` : ""}
          </p>
          <table className="tabela">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Resultado</th>
                <th>Duração</th>
                <th>Observações</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {partidas.map((partida) => (
                <tr key={partida.id}>
                  <td>{partida.numero}</td>
                  <td>{resultadoTexto(partida)}</td>
                  <td>{partida.duracaoMin === null ? "N/D" : `${partida.duracaoMin} min`}</td>
                  <td>{partida.observacoes ?? "—"}</td>
                  <td className="celula-acoes">
                    <button
                      className="botao botao-pequeno"
                      disabled={processando || formAberto !== null}
                      onClick={() => abrirCorrecao(partida)}
                    >
                      Corrigir
                    </button>{" "}
                    <button
                      className="botao botao-pequeno"
                      disabled={processando || formAberto !== null}
                      onClick={() => {
                        setErros([]);
                        setMotivoApagar("");
                        setApagando(partida);
                      }}
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {apagando !== null && (
        <div className="plano">
          <strong>Apagar a partida {apagando.numero}?</strong>
          <p className="dica sem-margem">
            A partida some das estatísticas, mas a exclusão fica registrada no histórico.
          </p>
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

      {formAberto !== null && (
        <form className="plano" onSubmit={aoEnviarForm}>
          <strong>{editando === null ? "Registrar partida" : `Corrigir a partida ${editando.numero}`}</strong>

          <div className="grade-campos">
            <label className="campo">
              Número da partida (1 a {MAXIMO_PARTIDAS})
              <input
                type="number"
                min={1}
                max={MAXIMO_PARTIDAS}
                value={valores.numero}
                onChange={(e) => setValores({ ...valores, numero: e.target.value })}
              />
            </label>

            <label className="campo">
              Quem venceu
              <select
                value={valores.vencedor}
                onChange={(e) => setValores({ ...valores, vencedor: e.target.value })}
              >
                <option value="">Escolha...</option>
                {opcoesVencedor.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </label>

            <label className="campo">
              Duração em minutos (opcional)
              <input
                type="number"
                min={DURACAO_PARTIDA_MIN}
                max={DURACAO_PARTIDA_MAX}
                value={valores.duracao}
                onChange={(e) => setValores({ ...valores, duracao: e.target.value })}
              />
            </label>
          </div>

          <label className="campo">
            Observações (opcional)
            <textarea
              rows={2}
              maxLength={500}
              value={valores.observacoes}
              onChange={(e) => setValores({ ...valores, observacoes: e.target.value })}
            />
          </label>

          {mudouCritico && (
            <label className="campo">
              Motivo da correção (obrigatório)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
          )}

          {confirmando ? (
            <div className="aviso-conflito">
              <strong>Confirmar?</strong>
              <p className="dica sem-margem">
                Este evento ainda está como agendado. Ao registrar a primeira partida, ele será marcado
                como realizado: tipo, data, duração, equipes e adversário ficam travados e o evento não
                poderá mais ser cancelado.
              </p>
              <div className="acoes-modal">
                <button
                  type="button"
                  className="botao"
                  disabled={processando}
                  onClick={() => setConfirmando(false)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="botao botao-principal"
                  disabled={processando}
                  onClick={enviar}
                >
                  {processando ? "Salvando..." : "Confirmar e registrar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="acoes-modal">
              <button type="button" className="botao" disabled={processando} onClick={fecharForm}>
                Cancelar
              </button>
              <button type="submit" className="botao botao-principal" disabled={processando}>
                {editando === null ? "Registrar" : "Salvar correção"}
              </button>
            </div>
          )}
        </form>
      )}

      {historico.length > 0 && (
        <div className="bloco-historico">
          <button className="botao botao-pequeno" onClick={() => setMostrarHistorico((v) => !v)}>
            {mostrarHistorico ? "Esconder histórico" : `Histórico das partidas (${historico.length})`}
          </button>

          {mostrarHistorico && (
            <ol className="historico">
              {[...historico].reverse().map((entrada) => (
                <li key={entrada.id} className="historico-item">
                  <span className="historico-campo">{ROTULO_CAMPO_PARTIDA[entrada.campo]}</span>
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