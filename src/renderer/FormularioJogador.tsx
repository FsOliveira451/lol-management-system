import { useState, type FormEvent } from "react";
import { ELOS, POSICOES, type Elo, type Posicao } from "../core/jogadores/tipos";
import {
  FORMULARIO_VAZIO,
  converterFormulario,
  type ValoresFormulario,
} from "./formulario-jogador";

// Props: o que o "pai" entrega a este componente.
// Sao FUNCOES: o formulario avisa o pai quando salvou ou foi cancelado.
interface Props {
  aoSalvar: () => void;
  aoCancelar: () => void;
}

export function FormularioJogador({ aoSalvar, aoCancelar }: Props) {
  const [valores, setValores] = useState<ValoresFormulario>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Atualiza UM campo, mantendo os outros como estao
  function atualizar<K extends keyof ValoresFormulario>(
    campo: K,
    valor: ValoresFormulario[K],
  ) {
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); // impede a pagina de recarregar ao enviar
    setSalvando(true);
    setErros([]);

    try {
      const resultado = await window.api.jogadores.criar(converterFormulario(valores));
      if (resultado.ok) {
        aoSalvar();
      } else {
        setErros(resultado.erros);
      }
    } catch {
      setErros(["Falha na comunicação com o programa."]);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fundo-modal">
      <form className="modal" onSubmit={enviar}>
        <h3>Novo jogador</h3>

        <label className="campo">
          Apelido *
          <input
            autoFocus
            value={valores.apelido}
            onChange={(e) => atualizar("apelido", e.target.value)}
          />
        </label>

        <label className="campo">
          Riot ID (Nome#TAG)
          <input
            placeholder="Exemplo1#BR1"
            value={valores.riotId}
            onChange={(e) => atualizar("riotId", e.target.value)}
          />
        </label>

        <div className="grade-campos">
          <label className="campo">
            Elo atual
            <select
              value={valores.eloAtual}
              onChange={(e) => atualizar("eloAtual", e.target.value as Elo)}
            >
              {ELOS.map((elo) => (
                <option key={elo} value={elo}>
                  {elo === "Desconhecido" ? "Não informado" : elo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Elo máximo
            <select
              value={valores.eloMaximo}
              onChange={(e) => atualizar("eloMaximo", e.target.value as Elo | "")}
            >
              <option value="">Não informado</option>
              {ELOS.filter((elo) => elo !== "Desconhecido").map((elo) => (
                <option key={elo} value={elo}>
                  {elo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Posição principal
            <select
              value={valores.posicaoPrincipal}
              onChange={(e) => atualizar("posicaoPrincipal", e.target.value as Posicao | "")}
            >
              <option value="">Não informada</option>
              {POSICOES.map((posicao) => (
                <option key={posicao} value={posicao}>
                  {posicao}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Posição secundária
            <select
              value={valores.posicaoSecundaria}
              onChange={(e) => atualizar("posicaoSecundaria", e.target.value as Posicao | "")}
            >
              <option value="">Não informada</option>
              {POSICOES.map((posicao) => (
                <option key={posicao} value={posicao}>
                  {posicao}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="campo-checkbox">
          <input
            type="checkbox"
            checked={valores.experienciaCompetitiva}
            onChange={(e) => atualizar("experienciaCompetitiva", e.target.checked)}
          />
          Tem experiência competitiva
        </label>

        <label className="campo">
          Observações
          <textarea
            rows={3}
            value={valores.observacoes}
            onChange={(e) => atualizar("observacoes", e.target.value)}
          />
        </label>

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
          <button type="submit" className="botao botao-principal" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar jogador"}
          </button>
        </div>
      </form>
    </div>
  );
}