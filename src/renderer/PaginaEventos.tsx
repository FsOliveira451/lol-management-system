import { useEffect, useState } from "react";
import type { Equipe } from "../core/equipes/tipos";
import {
  agruparPorDia,
  deslocarMes,
  diasDoMes,
  intervaloDoMes,
  mesDaData,
  nomeDoMes,
  rotuloDoDia,
  type MesCalendario,
} from "../core/eventos/calendario";
import {
  ICONE_TIPO,
  ROTULO_SITUACAO,
  rotuloDoEvento,
} from "../core/eventos/rotulos";
import { agoraLocal, situacaoDoEvento } from "../core/eventos/tempo";
import {
  NOME_TIPO_EVENTO,
  TIPOS_EVENTO,
  type Evento,
  type TipoEvento,
} from "../core/eventos/tipos";
import type { FiltrosEventos } from "../database/eventos-repositorio";
import { DetalheEvento } from "./DetalheEvento";
import { FormularioEvento } from "./FormularioEvento";

const DIAS_DA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAXIMO_CHIPS_POR_DIA = 3;

type Modo = "calendario" | "lista";

// Qual formulario esta aberto: evento null = criar (no dia indicado)
interface FormularioAberto {
  evento: Evento | null;
  dia: string;
}

export function PaginaEventos() {
  const [mes, setMes] = useState<MesCalendario>(() => mesDaData(agoraLocal()));
  const [modo, setModo] = useState<Modo>("calendario");
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | "">("");
  const [filtroEquipe, setFiltroEquipe] = useState<number | "">("");
  const [mostrarCancelados, setMostrarCancelados] = useState(false);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioAberto | null>(null);
  // Id do evento cujo detalhe esta aberto (null = nenhum)
  const [detalheId, setDetalheId] = useState<number | null>(null);
  // Sobe 1 a cada gravacao, para a lista e o detalhe serem buscados de novo
  const [versao, setVersao] = useState(0);

  // Carrega a lista de equipes uma unica vez (para o filtro)
  useEffect(() => {
    let cancelado = false;
    window.api.equipes
      .listar({ incluirInativas: true })
      .then((res) => {
        if (!cancelado && res.ok) setEquipes(res.dados);
      })
      .catch(() => {
        // O filtro de equipes simplesmente fica vazio; o erro principal aparece na outra carga
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Carrega os eventos do mes sempre que o mes, um filtro ou a versao mudar
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    const { primeiroDia, ultimoDia } = intervaloDoMes(mes);
    const filtros: FiltrosEventos = {
      de: primeiroDia,
      ate: ultimoDia,
      incluirCancelados: mostrarCancelados,
    };
    if (filtroTipo !== "") filtros.tipo = filtroTipo;
    if (filtroEquipe !== "") filtros.equipeId = filtroEquipe;

    window.api.eventos
      .listar(filtros)
      .then((res) => {
        if (cancelado) return;
        if (res.ok) {
          setEventos(res.dados);
          setErro(null);
        } else {
          setErro(res.erros.join(" "));
        }
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
  }, [mes, filtroTipo, filtroEquipe, mostrarCancelados, versao]);

  const agora = agoraLocal();
  const hoje = agora.slice(0, 10);
  const porDia = agruparPorDia(eventos);

  function novoEvento(dia: string) {
    setFormulario({ evento: null, dia });
  }

  function clicarNoEvento(evento: Evento) {
    setDetalheId(evento.id);
  }

  function chipDoEvento(evento: Evento) {
    const situacao = situacaoDoEvento(evento, agora);
    return (
      <button
        key={evento.id}
        className={`chip-evento chip-${situacao}`}
        title={`${rotuloDoEvento(evento)} · ${ROTULO_SITUACAO[situacao]}`}
        onClick={(clique) => {
          clique.stopPropagation(); // nao deixa o clique "vazar" para o dia
          clicarNoEvento(evento);
        }}
      >
        {evento.inicio.slice(11, 16)} {ICONE_TIPO[evento.tipo]} {rotuloDoEvento(evento)}
      </button>
    );
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <h2>Eventos</h2>
        {carregando && <span className="aviso">Carregando...</span>}
      </div>

      <div className="barra-ferramentas">
        <div className="navegacao-mes">
          <button className="botao botao-pequeno" onClick={() => setMes(deslocarMes(mes, -1))}>
            ◀
          </button>
          <strong className="titulo-mes">{nomeDoMes(mes)}</strong>
          <button className="botao botao-pequeno" onClick={() => setMes(deslocarMes(mes, 1))}>
            ▶
          </button>
          <button
            className="botao botao-pequeno"
            onClick={() => setMes(mesDaData(agoraLocal()))}
          >
            Hoje
          </button>
        </div>

        <button
          className={modo === "calendario" ? "botao botao-pequeno botao-ativo" : "botao botao-pequeno"}
          onClick={() => setModo("calendario")}
        >
          Calendário
        </button>
        <button
          className={modo === "lista" ? "botao botao-pequeno botao-ativo" : "botao botao-pequeno"}
          onClick={() => setModo("lista")}
        >
          Lista
        </button>

        <button className="botao botao-principal" onClick={() => novoEvento(hoje)}>
          Novo evento
        </button>
      </div>

      <div className="barra-ferramentas">
        <select
          className="seletor"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoEvento | "")}
        >
          <option value="">Todos os tipos</option>
          {TIPOS_EVENTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {NOME_TIPO_EVENTO[tipo]}
            </option>
          ))}
        </select>

        <select
          className="seletor"
          value={filtroEquipe}
          onChange={(e) => setFiltroEquipe(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todas as equipes</option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </select>

        <label className="campo-checkbox sem-margem">
          <input
            type="checkbox"
            checked={mostrarCancelados}
            onChange={(e) => setMostrarCancelados(e.target.checked)}
          />
          Mostrar cancelados
        </label>
      </div>

      {erro !== null && <p className="mensagem-erro">{erro}</p>}

      {modo === "calendario" ? (
        <div className="calendario">
          {DIAS_DA_SEMANA.map((nome) => (
            <div key={nome} className="cabecalho-dia">
              {nome}
            </div>
          ))}

          {diasDoMes(mes).map((semana, linha) =>
            semana.map((dia, coluna) => {
              if (dia === null) {
                return <div key={`${linha}-${coluna}`} className="dia-calendario vazio" />;
              }

              const doDia = porDia[dia] ?? [];
              const visiveis = doDia.slice(0, MAXIMO_CHIPS_POR_DIA);
              const escondidos = doDia.length - visiveis.length;

              return (
                <div
                  key={dia}
                  className={dia === hoje ? "dia-calendario hoje" : "dia-calendario"}
                  onClick={() => novoEvento(dia)}
                >
                  <span className="numero-dia">{Number(dia.slice(8, 10))}</span>
                  {visiveis.map(chipDoEvento)}
                  {escondidos > 0 && (
                    <span className="mais-eventos">+{escondidos} evento(s)</span>
                  )}
                </div>
              );
            }),
          )}
        </div>
      ) : (
        <div>
          {eventos.length === 0 ? (
            <p className="em-construcao">Nenhum evento neste mês.</p>
          ) : (
            Object.keys(porDia)
              .sort()
              .map((dia) => (
                <div key={dia} className="cartao">
                  <h3>{rotuloDoDia(dia)}</h3>
                  <table className="tabela">
                    <tbody>
                      {(porDia[dia] ?? []).map((evento) => {
                        const situacao = situacaoDoEvento(evento, agora);
                        return (
                          <tr
                            key={evento.id}
                            className="linha-clicavel"
                            onClick={() => clicarNoEvento(evento)}
                          >
                            <td>{evento.inicio.slice(11, 16)}</td>
                            <td>
                              {ICONE_TIPO[evento.tipo]} {NOME_TIPO_EVENTO[evento.tipo]}
                            </td>
                            <td className={situacao === "cancelado" ? "texto-riscado" : ""}>
                              {rotuloDoEvento(evento)}
                            </td>
                            <td>
                              {evento.equipes.length === 0
                                ? "—"
                                : evento.equipes.map((equipe) => equipe.nome).join(", ")}
                            </td>
                            <td>
                              <span className={`chip-evento chip-${situacao}`}>
                                {ROTULO_SITUACAO[situacao]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
          )}
        </div>
      )}

      {detalheId !== null && (
        <DetalheEvento
          eventoId={detalheId}
          versao={versao}
          aoFechar={() => setDetalheId(null)}
          aoEditar={(evento) => setFormulario({ evento, dia: evento.inicio.slice(0, 10) })}
          aoMudou={() => setVersao((v) => v + 1)}
        />
      )}

      {formulario !== null && (
        <FormularioEvento
          evento={formulario.evento}
          diaInicial={formulario.dia}
          aoCancelar={() => setFormulario(null)}
          aoSalvar={() => {
            setFormulario(null);
            setVersao((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}