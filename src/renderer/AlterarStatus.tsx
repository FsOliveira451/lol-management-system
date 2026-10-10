import { useState, type FormEvent } from "react";
import { STATUS_JOGADOR, type Jogador, type StatusJogador } from "../core/jogadores/tipos";
import { ROTULO_STATUS } from "./formatacao";

interface Props {
  jogador: Jogador;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

export function AlterarStatus({ jogador, aoConcluir, aoCancelar }: Props) {
  const [novoStatus, setNovoStatus] = useState<StatusJogador>(jogador.status);
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const semMudanca = novoStatus === jogador.status;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErros([]);

    try {
      const resultado = await window.api.jogadores.editar(
        jogador.id,
        { status: novoStatus },
        { motivo },
      );
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

  return (
    <div className="fundo-modal">
      <form className="modal" onSubmit={enviar}>
        <h3>Alterar status de {jogador.apelido}</h3>
        <p className="dica">Status atual: {ROTULO_STATUS[jogador.status]}</p>

        <label className="campo">
          Novo status
          <select
            value={novoStatus}
            onChange={(e) => setNovoStatus(e.target.value as StatusJogador)}
          >
            {STATUS_JOGADOR.map((status) => (
              <option key={status} value={status}>
                {ROTULO_STATUS[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Motivo *
          <textarea
            rows={3}
            placeholder="Ex.: Aprovado no tryout de sábado"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <p className="dica">O motivo é obrigatório e fica registrado no histórico.</p>

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
          <button
            type="submit"
            className="botao botao-principal"
            disabled={salvando || semMudanca}
          >
            {salvando ? "Salvando..." : "Confirmar mudança"}
          </button>
        </div>
      </form>
    </div>
  );
}