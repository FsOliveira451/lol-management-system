import { useEffect, useState, type FormEvent } from "react";
import type { Resultado } from "../compartilhado/api";
import { planejarAcao } from "../core/equipes/planejamento";
import {
  FUNCOES_EQUIPE,
  type Equipe,
  type FuncaoEquipe,
  type Membro,
  type Participacao,
  type ParticipacaoDaPessoa,
} from "../core/equipes/tipos";
import { POSICOES, type Jogador, type Posicao } from "../core/jogadores/tipos";
import { ROTULO_FUNCAO } from "./formatacao";

// Com o que a caixa ja abre preenchida (clicou numa vaga? em "Mudar funcao"?)
export interface PreenchimentoInicial {
  pessoaId?: number;
  funcao?: FuncaoEquipe;
  posicao?: Posicao | null;
}

interface Props {
  equipe: Equipe;
  membrosAtivos: Membro[];
  inicial: PreenchimentoInicial;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

export function AdicionarPessoa({ equipe, membrosAtivos, inicial, aoConcluir, aoCancelar }: Props) {
  const [pessoas, setPessoas] = useState<Jogador[]>([]);
  const [pessoaId, setPessoaId] = useState<number | null>(inicial.pessoaId ?? null);
  const [funcao, setFuncao] = useState<FuncaoEquipe>(inicial.funcao ?? "titular");
  const [posicao, setPosicao] = useState<Posicao | "">(inicial.posicao ?? "");
  // null = ainda carregando (ou nenhuma pessoa escolhida)
  const [participacoes, setParticipacoes] = useState<ParticipacaoDaPessoa[] | null>(null);
  const [opcoes, setOpcoes] = useState({
    anteriorVaiParaReserva: true,
    liberarEmOutraEquipe: true,
    outraEquipeVaiParaReserva: true,
  });
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Carrega as pessoas ativas (inativas nao entram em equipes)
  useEffect(() => {
    let cancelado = false;
    window.api.jogadores
      .listar({})
      .then((resultado) => {
        if (!cancelado && resultado.ok) setPessoas(resultado.dados);
      })
      .catch(() => {
        if (!cancelado) setErros(["Não foi possível carregar a lista de pessoas."]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Sempre que a pessoa muda, descobre onde ela esta hoje
  useEffect(() => {
    setParticipacoes(null);
    if (pessoaId === null) return;

    let cancelado = false;
    window.api.jogadores
      .participacoes(pessoaId)
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.ok) {
          setParticipacoes(resultado.dados);
        } else {
          setErros(resultado.erros);
        }
      })
      .catch(() => {
        if (!cancelado) setErros(["Falha na comunicação com o programa."]);
      });
    return () => {
      cancelado = true;
    };
  }, [pessoaId]);

  const pessoa = pessoas.find((p) => p.id === pessoaId);

  // O "cerebro": descreve o cenario e diz o que vai acontecer
  const plano =
    pessoa !== undefined && participacoes !== null
      ? planejarAcao({
          equipeId: equipe.id,
          pessoa: { id: pessoa.id, apelido: pessoa.apelido },
          funcao,
          posicao: posicao === "" ? null : posicao,
          membrosAtivos,
          participacoesDaPessoa: participacoes,
          opcoes,
        })
      : null;

  const pronto =
    plano !== null &&
    plano.acao !== null &&
    plano.bloqueio === null &&
    (!plano.precisaMotivo || motivo.trim() !== "");

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pessoa === undefined || plano === null || plano.acao === null || plano.bloqueio !== null) {
      return;
    }

    setSalvando(true);
    setErros([]);
    const motivoLimpo = motivo.trim();

    try {
      let resultado: Resultado<Participacao>;

      if (plano.acao === "escalar_titular") {
        resultado = await window.api.equipes.escalarTitular({
          equipeId: equipe.id,
          posicao: posicao as Posicao,
          jogadorId: pessoa.id,
          ...opcoes,
          motivo: motivoLimpo,
        });
      } else if (plano.acao === "trocar_funcao" && plano.jogoNaEquipe !== null) {
        resultado = await window.api.equipes.trocarFuncao({
          participacaoId: plano.jogoNaEquipe.id,
          funcao,
          posicao: null,
          motivo: motivoLimpo,
        });
      } else if (plano.acao === "designar_staff") {
        resultado = await window.api.equipes.designarStaff({
          equipeId: equipe.id,
          jogadorId: pessoa.id,
          funcao: funcao as "capitao" | "coach",
          motivo: motivoLimpo,
        });
      } else {
        resultado = await window.api.equipes.adicionarMembro({
          equipeId: equipe.id,
          jogadorId: pessoa.id,
          funcao,
          posicao: null,
          motivo: motivoLimpo,
        });
      }

      if (resultado.ok) {
        aoConcluir();
      } else {
        setErros(resultado.erros);
      }
    } catch {
      setErros(["Falha na comunicação com o programa."]);
    } finally {
      setSalvando(false);
    }
  }

  function marcar(campo: keyof typeof opcoes, valor: boolean) {
    setOpcoes((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const titularDe = (p: Posicao) =>
    membrosAtivos.find((m) => m.funcao === "titular" && m.posicao === p);

  return (
    <div className="fundo-modal">
      <form className="modal" onSubmit={enviar}>
        <h3>Escalar pessoa em {equipe.nome}</h3>

        <label className="campo">
          Pessoa *
          <select
            value={pessoaId ?? ""}
            onChange={(e) => setPessoaId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Escolha uma pessoa...</option>
            {pessoas.map((p) => {
              const nestaEquipe = membrosAtivos
                .filter((m) => m.jogadorId === p.id)
                .map((m) => ROTULO_FUNCAO[m.funcao])
                .join(", ");
              return (
                <option key={p.id} value={p.id}>
                  {p.apelido}
                  {nestaEquipe !== "" ? ` (nesta equipe: ${nestaEquipe})` : ""}
                </option>
              );
            })}
          </select>
        </label>

        <div className="grade-campos">
          <label className="campo">
            Função
            <select value={funcao} onChange={(e) => setFuncao(e.target.value as FuncaoEquipe)}>
              {FUNCOES_EQUIPE.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FUNCAO[f]}
                </option>
              ))}
            </select>
          </label>

          {funcao === "titular" && (
            <label className="campo">
              Posição
              <select value={posicao} onChange={(e) => setPosicao(e.target.value as Posicao | "")}>
                <option value="">Escolha...</option>
                {POSICOES.map((p) => (
                  <option key={p} value={p}>
                    {p} — {titularDe(p)?.apelido ?? "vaga livre"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {plano !== null && (
          <>
            {plano.ocupante !== null && plano.bloqueio === null && (
              <label className="campo-checkbox">
                <input
                  type="checkbox"
                  checked={opcoes.anteriorVaiParaReserva}
                  onChange={(e) => marcar("anteriorVaiParaReserva", e.target.checked)}
                />
                O titular atual ({plano.ocupante.apelido}) passa a reserva
              </label>
            )}

            {plano.titularEmOutraEquipe !== null && (
              <>
                <label className="campo-checkbox">
                  <input
                    type="checkbox"
                    checked={opcoes.liberarEmOutraEquipe}
                    onChange={(e) => marcar("liberarEmOutraEquipe", e.target.checked)}
                  />
                  Liberar a titularidade em {plano.titularEmOutraEquipe.equipeNome}
                </label>
                {opcoes.liberarEmOutraEquipe && (
                  <label className="campo-checkbox">
                    <input
                      type="checkbox"
                      checked={opcoes.outraEquipeVaiParaReserva}
                      onChange={(e) => marcar("outraEquipeVaiParaReserva", e.target.checked)}
                    />
                    Lá, ela passa a reserva
                  </label>
                )}
              </>
            )}

            <div className="plano">
              <strong>O que vai acontecer</strong>
              {plano.bloqueio !== null ? (
                <p className="plano-bloqueio">{plano.bloqueio}</p>
              ) : (
                <ul>
                  {plano.passos.map((passo) => (
                    <li key={passo}>{passo}</li>
                  ))}
                </ul>
              )}
            </div>

            {plano.precisaMotivo && plano.bloqueio === null && (
              <label className="campo">
                Motivo *
                <textarea
                  rows={2}
                  placeholder="Ex.: Melhor desempenho nos últimos treinos"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {erros.length > 0 && (
          <ul className="lista-erros">
            {erros.map((erro) => (
              <li key={erro}>{erro}</li>
            ))}
          </ul>
        )}

        <div className="acoes-modal">
          <button type="button" className="botao" onClick={aoCancelar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={salvando || !pronto}>
            {salvando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}