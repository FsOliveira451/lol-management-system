import { useEffect, useState } from "react";
import { avaliarEquipe } from "../core/equipes/alertas";
import type { Equipe, FuncaoEquipe, Membro } from "../core/equipes/tipos";
import { POSICOES, type Posicao } from "../core/jogadores/tipos";
import { AdicionarPessoa, type PreenchimentoInicial } from "./AdicionarPessoa";
import { CartaoEstatisticas } from "./CartaoEstatisticas";
import { FormularioEquipe } from "./FormularioEquipe";
import { InativarEquipe } from "./InativarEquipe";
import { RetirarMembro } from "./RetirarMembro";
import {
  ICONE_ALERTA,
  ROTULO_FUNCAO,
  ROTULO_NIVEL,
  ROTULO_STATUS_EQUIPE,
  formatarDataHora,
} from "./formatacao";

interface Props {
  equipeId: number;
  aoVoltar: () => void;
}

export function PaginaEquipe({ equipeId, aoVoltar }: Props) {
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  // Todos os registros da equipe: os ativos e os que ja sairam (historico)
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const [adicionando, setAdicionando] = useState<PreenchimentoInicial | null>(null);
  const [retirando, setRetirando] = useState<Membro | null>(null);
  const [editandoEquipe, setEditandoEquipe] = useState(false);
  const [inativando, setInativando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    Promise.all([
      window.api.equipes.buscar(equipeId),
      window.api.equipes.membros(equipeId, true),
    ])
      .then(([resEquipe, resMembros]) => {
        if (cancelado) return;
        if (!resEquipe.ok) {
          setErro(resEquipe.erros.join(" "));
          return;
        }
        if (!resMembros.ok) {
          setErro(resMembros.erros.join(" "));
          return;
        }
        setEquipe(resEquipe.dados);
        setMembros(resMembros.dados);
        setErro(resEquipe.dados === null ? "Equipe não encontrada." : null);
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
  }, [equipeId, versao]);

  function recarregar() {
    setVersao((v) => v + 1);
  }

  if (carregando && equipe === null) {
    return <p className="em-construcao">Carregando...</p>;
  }

  if (equipe === null) {
    return (
      <section>
        <button className="botao" onClick={aoVoltar}>
          ← Voltar às equipes
        </button>
        {erro !== null && <p className="mensagem-erro">{erro}</p>}
      </section>
    );
  }

  const inativa = equipe.status === "inativa";
  const ativos = membros.filter((m) => m.saiuEm === null);
  const alertas = avaliarEquipe(equipe.status, ativos);

  const titularDe = (posicao: Posicao) =>
    ativos.find((m) => m.funcao === "titular" && m.posicao === posicao);
  const staffDe = (funcao: FuncaoEquipe) => ativos.find((m) => m.funcao === funcao);
  const reservasEAcademia = ativos.filter((m) => m.funcao === "reserva" || m.funcao === "academia");
  const primeiraVaga = POSICOES.find((posicao) => titularDe(posicao) === undefined) ?? null;

  // Selos "Capitao" / "Coach" para quem tambem joga
  const selosDe = (jogadorId: number) =>
    ativos
      .filter((m) => m.jogadorId === jogadorId && (m.funcao === "capitao" || m.funcao === "coach"))
      .map((m) => (
        <span key={m.id} className="selo-papel">
          {ROTULO_FUNCAO[m.funcao]}
        </span>
      ));

  const nomeDoElo = (membro: Membro) => (membro.eloAtual === "Desconhecido" ? "N/D" : membro.eloAtual);

  return (
    <section>
      <button className="botao" onClick={aoVoltar}>
        ← Voltar às equipes
      </button>

      <header className="perfil-cabecalho">
        <h2>{equipe.nome}</h2>
        {equipe.tag !== null && <span className="tag-equipe">[{equipe.tag}]</span>}
        <span className="selo-status">{ROTULO_STATUS_EQUIPE[equipe.status]}</span>
        <div className="acoes-perfil">
          <button className="botao" onClick={() => setEditandoEquipe(true)}>
            Editar equipe
          </button>
          {!inativa && (
            <button className="botao" onClick={() => setInativando(true)}>
              Inativar equipe
            </button>
          )}
          <button
            className="botao botao-principal"
            disabled={inativa}
            onClick={() => setAdicionando({ funcao: "titular", posicao: primeiraVaga })}
          >
            Adicionar pessoa
          </button>
        </div>
      </header>

      <p className="dica">
        Nível: {ROTULO_NIVEL[equipe.nivel]}
        {equipe.objetivo !== null ? ` · Objetivo: ${equipe.objetivo}` : ""}
      </p>

      {erro !== null && <p className="mensagem-erro">{erro}</p>}

      {inativa && (
        <div className="aviso-equipe-inativa">
          Equipe inativa: não recebe novos membros. Para reativá-la, use &quot;Editar equipe&quot;.
        </div>
      )}

      {alertas.length > 0 && (
        <div className="cartao">
          <h3>Alertas</h3>
          {alertas.map((alerta) => (
            <div key={alerta.codigo} className={`alerta-linha alerta-${alerta.nivel}`}>
              {ICONE_ALERTA[alerta.nivel]} {alerta.mensagem}
            </div>
          ))}
        </div>
      )}

      <CartaoEstatisticas equipeId={equipe.id} />

      <div className="cartao">
        <h3>Escalação principal</h3>
        <div className="escalacao">
          {POSICOES.map((posicao) => {
            const titular = titularDe(posicao);

            if (titular === undefined) {
              return (
                <button
                  key={posicao}
                  className="cartao-vaga vazia"
                  disabled={inativa}
                  onClick={() => setAdicionando({ funcao: "titular", posicao })}
                >
                  <span className="vaga-posicao">{posicao}</span>
                  <span>Vaga livre</span>
                  <span className="vaga-detalhe">Clique para escalar</span>
                </button>
              );
            }

            return (
              <div key={posicao} className="cartao-vaga">
                <span className="vaga-posicao">{posicao}</span>
                <strong>{titular.apelido}</strong>
                <span className="vaga-detalhe">{nomeDoElo(titular)}</span>
                {selosDe(titular.jogadorId)}
                {!inativa && (
                  <div className="vaga-acoes">
                    <button
                      className="botao botao-pequeno"
                      onClick={() => setAdicionando({ funcao: "titular", posicao })}
                    >
                      Substituir
                    </button>
                    <button
                      className="botao botao-pequeno"
                      onClick={() =>
                        setAdicionando({ pessoaId: titular.jogadorId, funcao: "reserva" })
                      }
                    >
                      Mudar função
                    </button>
                    <button className="botao botao-pequeno" onClick={() => setRetirando(titular)}>
                      Retirar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cartao">
        <h3>Comissão técnica</h3>
        <div className="escalacao">
          {(["capitao", "coach"] as const).map((funcao) => {
            const responsavel = staffDe(funcao);

            if (responsavel === undefined) {
              return (
                <button
                  key={funcao}
                  className="cartao-vaga vazia"
                  disabled={inativa}
                  onClick={() => setAdicionando({ funcao })}
                >
                  <span className="vaga-posicao">{ROTULO_FUNCAO[funcao]}</span>
                  <span>Sem {ROTULO_FUNCAO[funcao].toLowerCase()}</span>
                  <span className="vaga-detalhe">Clique para designar</span>
                </button>
              );
            }

            return (
              <div key={funcao} className="cartao-vaga">
                <span className="vaga-posicao">{ROTULO_FUNCAO[funcao]}</span>
                <strong>{responsavel.apelido}</strong>
                {!inativa && (
                  <div className="vaga-acoes">
                    <button
                      className="botao botao-pequeno"
                      onClick={() => setAdicionando({ funcao })}
                    >
                      Substituir
                    </button>
                    <button
                      className="botao botao-pequeno"
                      onClick={() => setRetirando(responsavel)}
                    >
                      Retirar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cartao">
        <h3>Reservas e academia</h3>
        {reservasEAcademia.length === 0 ? (
          <p className="em-construcao">Ninguém por aqui ainda.</p>
        ) : (
          <div className="lista-membros">
            {reservasEAcademia.map((membro) => (
              <div key={membro.id} className="linha-membro">
                <span className="nome">
                  <strong>{membro.apelido}</strong> · {nomeDoElo(membro)}
                </span>
                <span className="selo-status">{ROTULO_FUNCAO[membro.funcao]}</span>
                {!inativa && (
                  <>
                    <button
                      className="botao botao-pequeno"
                      onClick={() =>
                        setAdicionando({
                          pessoaId: membro.jogadorId,
                          funcao: "titular",
                          posicao: primeiraVaga,
                        })
                      }
                    >
                      Mudar função
                    </button>
                    <button className="botao botao-pequeno" onClick={() => setRetirando(membro)}>
                      Retirar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cartao">
        <h3>Histórico de movimentações</h3>
        <button className="botao botao-pequeno" onClick={() => setMostrarHistorico((v) => !v)}>
          {mostrarHistorico ? "Esconder" : `Mostrar (${membros.length})`}
        </button>

        {mostrarHistorico &&
          [...membros]
            .sort((a, b) => b.id - a.id)
            .map((membro) => (
              <div key={membro.id} className="movimentacao">
                <div>
                  <strong>{membro.apelido}</strong> · {ROTULO_FUNCAO[membro.funcao]}
                  {membro.posicao ? ` (${membro.posicao})` : ""}
                </div>
                <div className="detalhe">
                  Entrou em {formatarDataHora(membro.entrouEm)}
                  {membro.motivoEntrada ? ` · ${membro.motivoEntrada}` : ""}
                </div>
                {membro.saiuEm !== null && (
                  <div className="detalhe">
                    Saiu em {formatarDataHora(membro.saiuEm)}
                    {membro.motivoSaida ? ` · ${membro.motivoSaida}` : ""}
                  </div>
                )}
              </div>
            ))}
      </div>

      {adicionando !== null && (
        <AdicionarPessoa
          equipe={equipe}
          membrosAtivos={ativos}
          inicial={adicionando}
          aoCancelar={() => setAdicionando(null)}
          aoConcluir={() => {
            setAdicionando(null);
            recarregar();
          }}
        />
      )}

      {retirando !== null && (
        <RetirarMembro
          membro={retirando}
          aoCancelar={() => setRetirando(null)}
          aoConcluir={() => {
            setRetirando(null);
            recarregar();
          }}
        />
      )}

      {inativando && (
        <InativarEquipe
          equipe={equipe}
          totalAtivos={ativos.length}
          aoCancelar={() => setInativando(false)}
          aoConcluir={() => {
            setInativando(false);
            recarregar();
          }}
        />
      )}

      {editandoEquipe && (
        <FormularioEquipe
          equipe={equipe}
          aoCancelar={() => setEditandoEquipe(false)}
          aoSalvar={() => {
            setEditandoEquipe(false);
            recarregar();
          }}
        />
      )}
    </section>
  );
}