import { useState, type FormEvent } from "react";
import type { Equipe } from "../core/equipes/tipos";

interface Props {
  equipe: Equipe;
  totalAtivos: number;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

export function InativarEquipe({ equipe, totalAtivos, aoConcluir, aoCancelar }: Props) {
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErros([]);

    try {
      const resultado = await window.api.equipes.inativar({
        equipeId: equipe.id,
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

  return (
    <div className="fundo-modal">
      <form className="modal" onSubmit={enviar}>
        <h3>Inativar {equipe.nome}</h3>

        <div className="plano">
          <strong>O que vai acontecer</strong>
          <ul>
            <li>
              {totalAtivos === 0
                ? "A equipe não tem ninguém no momento."
                : `As ${totalAtivos} participações ativas serão encerradas (ficam no histórico).`}
            </li>
            <li>Quem era titular fica livre para ser titular em outra equipe.</li>
            <li>Reativar a equipe depois não recoloca ninguém automaticamente.</li>
          </ul>
        </div>

        <label className="campo">
          Motivo *
          <textarea
            autoFocus
            rows={3}
            placeholder="Ex.: Fim da temporada"
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
            {salvando ? "Salvando..." : "Inativar equipe"}
          </button>
        </div>
      </form>
    </div>
  );
}