import { useState, type FormEvent } from "react";
import {
  NIVEIS_EQUIPE,
  STATUS_EQUIPE,
  type Equipe,
  type NivelEquipe,
  type StatusEquipe,
} from "../core/equipes/tipos";
import {
  FORMULARIO_EQUIPE_VAZIO,
  converterFormularioEquipe,
  valoresDaEquipe,
  type ValoresFormularioEquipe,
} from "./formulario-equipe";
import { ROTULO_NIVEL, ROTULO_STATUS_EQUIPE } from "./formatacao";

// Se vier uma "equipe", o formulario funciona em modo EDICAO; senao, em modo CADASTRO.
interface Props {
  equipe?: Equipe;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

export function FormularioEquipe({ equipe, aoSalvar, aoCancelar }: Props) {
  const editando = equipe !== undefined;

  const [valores, setValores] = useState<ValoresFormularioEquipe>(
    equipe !== undefined ? valoresDaEquipe(equipe) : FORMULARIO_EQUIPE_VAZIO,
  );
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  function atualizar<K extends keyof ValoresFormularioEquipe>(
    campo: K,
    valor: ValoresFormularioEquipe[K],
  ) {
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErros([]);

    try {
      const dados = converterFormularioEquipe(valores);
      const resultado =
        equipe !== undefined
          ? await window.api.equipes.editar(equipe.id, dados)
          : await window.api.equipes.criar(dados);

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
        <h3>{editando ? "Editar equipe" : "Nova equipe"}</h3>

        <label className="campo">
          Nome *
          <input
            autoFocus
            value={valores.nome}
            onChange={(e) => atualizar("nome", e.target.value)}
          />
        </label>

        <div className="grade-campos">
          <label className="campo">
            Tag (2 a 5 letras ou números)
            <input
              placeholder="ALP"
              value={valores.tag}
              onChange={(e) => atualizar("tag", e.target.value)}
            />
          </label>

          <label className="campo">
            Nível
            <select
              value={valores.nivel}
              onChange={(e) => atualizar("nivel", e.target.value as NivelEquipe)}
            >
              {NIVEIS_EQUIPE.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {ROTULO_NIVEL[nivel]}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Status
            <select
              value={valores.status}
              onChange={(e) => atualizar("status", e.target.value as StatusEquipe)}
            >
                          {STATUS_EQUIPE.filter(
                (status) => status !== "inativa" || equipe?.status === "inativa",
              ).map((status) => (
                <option key={status} value={status}>
                  {ROTULO_STATUS_EQUIPE[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="campo">
          Objetivo
          <textarea
            rows={2}
            placeholder="Ex.: Chegar às semifinais do próximo campeonato"
            value={valores.objetivo}
            onChange={(e) => atualizar("objetivo", e.target.value)}
          />
        </label>

        <label className="campo">
          Observações
          <textarea
            rows={2}
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
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar equipe"}
          </button>
        </div>
      </form>
    </div>
  );
}