import { useState, type FormEvent } from "react";
import type { Membro } from "../core/equipes/tipos";
import { ROTULO_FUNCAO } from "./formatacao";

interface Props {
  membro: Membro;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

export function RetirarMembro({ membro, aoConcluir, aoCancelar }: Props) {
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErros([]);

    try {
      const resultado = await window.api.equipes.encerrarParticipacao({
        participacaoId: membro.id,
        motivo: motivo.trim(),
      });
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

  const detalhe = membro.posicao ? ` (${membro.posicao})` : "";

  return (
    <div className="fundo-modal">
      <form className="modal" onSubmit={enviar}>
        <h3>Retirar da equipe</h3>
        <p className="dica">
          {membro.apelido} deixa a função de {ROTULO_FUNCAO[membro.funcao]}
          {detalhe}. A participação fica registrada no histórico.
        </p>

        <label className="campo">
          Motivo *
          <textarea
            autoFocus
            rows={3}
            placeholder="Ex.: Saiu da equipe por motivos pessoais"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
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
          <button
            type="submit"
            className="botao botao-principal"
            disabled={salvando || motivo.trim() === ""}
          >
            {salvando ? "Salvando..." : "Confirmar saída"}
          </button>
        </div>
      </form>
    </div>
  );
}