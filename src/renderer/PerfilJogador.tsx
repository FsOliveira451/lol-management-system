import { useEffect, useState } from "react";
import type { Jogador } from "../core/jogadores/tipos";
import type { EntradaHistorico } from "../database/historico-repositorio";
import { AlterarStatus } from "./AlterarStatus";
import { FormularioJogador } from "./FormularioJogador";
import {
  ROTULO_CAMPO,
  ROTULO_STATUS,
  formatarDataHora,
  rotuloDoValor,
} from "./formatacao";

interface Props {
  jogadorId: number;
  aoVoltar: () => void;
}

export function PerfilJogador({ jogadorId, aoVoltar }: Props) {
  const [jogador, setJogador] = useState<Jogador | null>(null);
  const [historico, setHistorico] = useState<EntradaHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
    const [editandoDados, setEditandoDados] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    // Duas consultas ao mesmo tempo: o perfil e o historico
    Promise.all([
      window.api.jogadores.buscar(jogadorId),
      window.api.jogadores.historico(jogadorId),
    ])
      .then(([resJogador, resHistorico]) => {
        if (cancelado) return;
        if (!resJogador.ok) {
          setErro(resJogador.erros.join(" "));
          return;
        }
        if (!resHistorico.ok) {
          setErro(resHistorico.erros.join(" "));
          return;
        }
        setJogador(resJogador.dados);
        setHistorico(resHistorico.dados);
        setErro(resJogador.dados === null ? "Jogador não encontrado." : null);
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
  }, [jogadorId, versao]);

  if (carregando && jogador === null) {
    return <p className="em-construcao">Carregando...</p>;
  }

  if (jogador === null) {
    return (
      <section>
        <button className="botao" onClick={aoVoltar}>
          ← Voltar à lista
        </button>
        {erro !== null && <p className="mensagem-erro">{erro}</p>}
      </section>
    );
  }

  const eloOuND = (elo: string | null) => (elo === null || elo === "Desconhecido" ? "N/D" : elo);

  const dados: [string, string][] = [
    ["ID interno", String(jogador.id)],
    ["Riot ID", jogador.riotId ?? "N/D"],
    ["Elo atual", eloOuND(jogador.eloAtual)],
    ["Elo máximo", eloOuND(jogador.eloMaximo)],
    ["Posição principal", jogador.posicaoPrincipal ?? "N/D"],
    ["Posição secundária", jogador.posicaoSecundaria ?? "N/D"],
    ["Experiência competitiva", jogador.experienciaCompetitiva ? "Sim" : "Não"],
    ["Cadastrado em", formatarDataHora(jogador.criadoEm)],
    ["Última atualização", formatarDataHora(jogador.atualizadoEm)],
  ];

  return (
    <section>
      <button className="botao" onClick={aoVoltar}>
        ← Voltar à lista
      </button>

      <header className="perfil-cabecalho">
        <h2>{jogador.apelido}</h2>
        <span className="selo-status">{ROTULO_STATUS[jogador.status]}</span>
               <div className="acoes-perfil">
          <button className="botao" onClick={() => setEditandoDados(true)}>
            Editar dados
          </button>
          <button className="botao botao-principal" onClick={() => setAlterandoStatus(true)}>
            Alterar status
          </button>
        </div>
      </header>

      {erro !== null && <p className="mensagem-erro">{erro}</p>}

      <div className="cartao">
        <h3>Dados</h3>
        <dl className="grade-dados">
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="dica">{jogador.observacoes ?? "Nenhuma observação."}</p>
      </div>

      <div className="cartao">
        <h3>Histórico de mudanças</h3>
        {historico.length === 0 ? (
          <p className="em-construcao">Nenhum registro.</p>
        ) : (
          <ol className="linha-do-tempo">
            {[...historico].reverse().map((evento) => (
              <li key={evento.id} className="evento">
                <div className="evento-topo">
                  <strong>{ROTULO_CAMPO[evento.campo]}</strong>
                  <span className="evento-data">{formatarDataHora(evento.registradoEm)}</span>
                </div>
                <div>
                  {evento.valorAnterior === null
                    ? `Definido como ${rotuloDoValor(evento.campo, evento.valorNovo)}`
                    : `${rotuloDoValor(evento.campo, evento.valorAnterior)} → ${rotuloDoValor(evento.campo, evento.valorNovo)}`}
                </div>
                {evento.motivo !== null && (
                  <div className="evento-motivo">Motivo: {evento.motivo}</div>
                )}
                {evento.responsavel !== null && (
                  <div className="evento-motivo">Por: {evento.responsavel}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {alterandoStatus && (
        <AlterarStatus
          jogador={jogador}
          aoCancelar={() => setAlterandoStatus(false)}
          aoConcluir={() => {
            setAlterandoStatus(false);
            setVersao((v) => v + 1); // recarrega perfil e historico
          }}
        />
      )}

            {editandoDados && (
        <FormularioJogador
          jogador={jogador}
          aoCancelar={() => setEditandoDados(false)}
          aoSalvar={() => {
            setEditandoDados(false);
            setVersao((v) => v + 1); // recarrega perfil e historico
          }}
        />
      )}
    </section>
  );
}