import { useState, type FormEvent } from "react";
import {
  ELOS,
  POSICOES,
  type Elo,
  type Jogador,
  type Posicao,
} from "../core/jogadores/tipos";
import {
  FORMULARIO_VAZIO,
  converterFormulario,
  valoresDoJogador,
  type ValoresFormulario,
} from "./formulario-jogador";

// Props: o que o "pai" entrega a este componente.
// Se vier um "jogador", o formulario funciona em modo EDICAO; senao, em modo CADASTRO.
interface Props {
  jogador?: Jogador;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

export function FormularioJogador({ jogador, aoSalvar, aoCancelar }: Props) {
  const editando = jogador !== undefined;

  const [valores, setValores] = useState<ValoresFormulario>(
    jogador !== undefined ? valoresDoJogador(jogador) : FORMULARIO_VAZIO,
  );
  const [motivo, setMotivo] = useState("");
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
      const dados = converterFormulario(valores);
      const resultado =
        jogador !== undefined
          ? await window.api.jogadores.editar(jogador.id, dados, { motivo })
          : await window.api.jogadores.criar(dados);

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
        <h3>{editando ? "Editar jogador" : "Novo jogador"}</h3>

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

        {editando && (
          <>
            <label className="campo">
              Motivo da alteração (opcional)
              <textarea
                rows={2}
                placeholder="Ex.: Subiu para Platina na ranqueada"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            <p className="dica">
              Mudanças de elo e de posição ficam registradas no histórico. O status é
              alterado pelo botão &quot;Alterar status&quot; do perfil.
            </p>
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
          <button type="submit" className="botao botao-principal" disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Salvar jogador"}
          </button>
        </div>
      </form>
    </div>
  );
}