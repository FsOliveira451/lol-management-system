import { useEffect, useState, type FormEvent } from "react";
import type { Equipe } from "../core/equipes/tipos";
import { descreverQuando, rotuloDoEvento } from "../core/eventos/rotulos";
import {
  DURACAO_PADRAO,
  NIVEIS_ADVERSARIO,
  NOME_TIPO_EVENTO,
  TIPOS_EVENTO,
  temAdversario,
  type Evento,
  type NivelAdversario,
  type TipoEvento,
} from "../core/eventos/tipos";
import {
  converterFormularioEvento,
  valoresDoEvento,
  valoresIniciais,
  type ValoresFormularioEvento,
} from "./formulario-evento";

interface Props {
  evento: Evento | null; // null = criar um evento novo
  diaInicial: string; // "AAAA-MM-DD", usado so ao criar
  aoCancelar: () => void;
  aoSalvar: () => void;
}

const ROTULO_NIVEL_ADVERSARIO: Record<NivelAdversario, string> = {
  inferior: "Inferior",
  semelhante: "Semelhante",
  superior: "Superior",
  desconhecido: "Não sei",
};

// Quantas equipes nossas cada tipo aceita
const DICA_EQUIPES: Record<TipoEvento, string> = {
  treino: "Escolha 1 ou 2 equipes.",
  scrim: "Escolha 1 equipe (e informe o adversário) ou 2 equipes nossas (confronto interno).",
  amistoso: "Escolha 1 equipe (e informe o adversário) ou 2 equipes nossas (confronto interno).",
  campeonato: "Escolha 1 equipe (e informe o adversário) ou 2 equipes nossas (confronto interno).",
  tryout: "Escolha 0 ou 1 equipe.",
  vod: "Escolha exatamente 1 equipe.",
  reuniao: "Qualquer número de equipes. Nenhuma = reunião geral.",
};

export function FormularioEvento({ evento, diaInicial, aoCancelar, aoSalvar }: Props) {
  const [valores, setValores] = useState<ValoresFormularioEvento>(() =>
    evento === null ? valoresIniciais(diaInicial) : valoresDoEvento(evento),
  );
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [conflitos, setConflitos] = useState<Evento[]>([]);
  const [ignorarConflitos, setIgnorarConflitos] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const editando = evento !== null;
  // Evento realizado: o que importa para resultados e presenca fica travado
  const travado = evento?.status === "realizado";
  const idsOriginais = evento?.equipes.map((equipe) => equipe.id) ?? [];

  function mudar<K extends keyof ValoresFormularioEvento>(
    campo: K,
    valor: ValoresFormularioEvento[K],
  ) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  function alternarEquipe(equipeId: number, marcada: boolean) {
    setValores((atual) => ({
      ...atual,
      equipeIds: marcada
        ? [...atual.equipeIds, equipeId]
        : atual.equipeIds.filter((id) => id !== equipeId),
    }));
  }

  // Busca as equipes uma unica vez
  useEffect(() => {
    let cancelado = false;
    window.api.equipes
      .listar({ incluirInativas: true })
      .then((res) => {
        if (!cancelado && res.ok) setEquipes(res.dados);
      })
      .catch(() => {
        // sem a lista, as caixinhas ficam vazias; o erro aparece ao salvar
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // AVISO DE CONFLITO AO VIVO: toda vez que dia, hora, duracao, tipo ou equipes mudam,
  // pergunta ao programa se esse horario bate com outro evento das mesmas equipes
  useEffect(() => {
    let cancelado = false;

    if (valores.data === "" || valores.hora === "" || valores.equipeIds.length === 0) {
      setConflitos([]);
      return;
    }

    const dados = converterFormularioEvento(valores);
    const pedido = {
      dados: {
        inicio: dados.inicio ?? "",
        duracaoMin: dados.duracaoMin ?? 0,
        equipeIds: dados.equipeIds ?? [],
      },
      ...(evento !== null ? { ignorarId: evento.id } : {}),
    };

    window.api.eventos
      .conflitos(pedido)
      .then((res) => {
        if (!cancelado) setConflitos(res.ok ? res.dados : []);
      })
      .catch(() => {
        if (!cancelado) setConflitos([]);
      });

    return () => {
      cancelado = true;
    };
  }, [valores.data, valores.hora, valores.duracao, valores.tipo, valores.equipeIds, evento]);

  // Equipes inativas so aparecem se ja estavam neste evento
  const equipesVisiveis = equipes.filter(
    (equipe) => equipe.status !== "inativa" || idsOriginais.includes(equipe.id),
  );

  const mostrarAdversario = temAdversario(valores.tipo) && valores.equipeIds.length !== 2;

  // Remarcar = mudar dia ou hora. Pede motivo (obrigatorio).
  const mudouInicio =
    evento !== null && `${valores.data} ${valores.hora}` !== evento.inicio;
  const mudouDuracaoOuEquipes =
    evento !== null &&
    (valores.duracao !== String(evento.duracaoMin) ||
      [...valores.equipeIds].sort().join(",") !== [...idsOriginais].sort().join(","));
  const pedirMotivo = !travado && (mudouInicio || mudouDuracaoOuEquipes);

  function salvar(envio: FormEvent) {
    envio.preventDefault();
    setErros([]);
    setSalvando(true);

    const dados = converterFormularioEvento(valores);
    const chamada =
      evento === null
        ? window.api.eventos.criar({ dados, ignorarConflitos })
        : window.api.eventos.editar({
            id: evento.id,
            dados,
            motivo: motivo.trim(),
            ignorarConflitos,
          });

    chamada
      .then((res) => {
        if (res.ok) {
          aoSalvar();
        } else {
          setErros(res.erros);
        }
      })
      .catch(() => setErros(["Falha na comunicação com o programa."]))
      .finally(() => setSalvando(false));
  }

  return (
    <div className="fundo-modal">
      <form className="modal modal-larga" onSubmit={salvar}>
        <h3>{editando ? "Editar evento" : "Novo evento"}</h3>

        {travado && (
          <p className="dica">
            Evento já realizado: tipo, data, duração, equipes e adversário não podem mais ser
            alterados. Os demais campos continuam editáveis.
          </p>
        )}

        {erros.length > 0 && (
          <ul className="lista-erros">
            {erros.map((erro) => (
              <li key={erro}>{erro}</li>
            ))}
          </ul>
        )}

        <div className="grade-campos">
          <label className="campo">
            Tipo
            <select
              value={valores.tipo}
              disabled={travado}
              onChange={(e) => mudar("tipo", e.target.value as TipoEvento)}
            >
              {TIPOS_EVENTO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {NOME_TIPO_EVENTO[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Título (opcional)
            <input
              value={valores.titulo}
              maxLength={80}
              onChange={(e) => mudar("titulo", e.target.value)}
            />
          </label>

          <label className="campo">
            Dia
            <input
              type="date"
              value={valores.data}
              disabled={travado}
              onChange={(e) => mudar("data", e.target.value)}
            />
          </label>

          <label className="campo">
            Horário de início
            <input
              type="time"
              value={valores.hora}
              disabled={travado}
              onChange={(e) => mudar("hora", e.target.value)}
            />
          </label>

          <label className="campo">
            Duração em minutos
            <input
              type="number"
              min={15}
              max={720}
              value={valores.duracao}
              disabled={travado}
              placeholder={`Padrão: ${DURACAO_PADRAO[valores.tipo]}`}
              onChange={(e) => mudar("duracao", e.target.value)}
            />
          </label>
        </div>

        <div className="campo">
          Equipes da organização
          <div className="grade-equipes">
            {equipesVisiveis.length === 0 && (
              <span className="dica sem-margem">Nenhuma equipe cadastrada ainda.</span>
            )}
            {equipesVisiveis.map((equipe) => (
              <label key={equipe.id} className="campo-checkbox sem-margem">
                <input
                  type="checkbox"
                  checked={valores.equipeIds.includes(equipe.id)}
                  disabled={travado}
                  onChange={(e) => alternarEquipe(equipe.id, e.target.checked)}
                />
                {equipe.nome}
                {equipe.tag !== null ? ` [${equipe.tag}]` : ""}
              </label>
            ))}
          </div>
          <span className="dica sem-margem">{DICA_EQUIPES[valores.tipo]}</span>
        </div>

        {conflitos.length > 0 && (
          <div className="aviso-conflito">
            <strong>⚠️ Conflito de horário</strong>
            <ul>
              {conflitos.map((conflito) => (
                <li key={conflito.id}>
                  {rotuloDoEvento(conflito)} · {descreverQuando(conflito.inicio, conflito.duracaoMin)}{" "}
                  ({conflito.equipes.map((equipe) => equipe.nome).join(", ")})
                </li>
              ))}
            </ul>
            <label className="campo-checkbox sem-margem">
              <input
                type="checkbox"
                checked={ignorarConflitos}
                onChange={(e) => setIgnorarConflitos(e.target.checked)}
              />
              Agendar mesmo assim
            </label>
          </div>
        )}

        {mostrarAdversario && (
          <div className="grade-campos">
            <label className="campo">
              Adversário
              <input
                value={valores.adversario}
                disabled={travado}
                onChange={(e) => mudar("adversario", e.target.value)}
              />
            </label>

            <label className="campo">
              Nível do adversário
              <select
                value={valores.nivelAdversario}
                disabled={travado}
                onChange={(e) => mudar("nivelAdversario", e.target.value as NivelAdversario | "")}
              >
                <option value="">Não informado</option>
                {NIVEIS_ADVERSARIO.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {ROTULO_NIVEL_ADVERSARIO[nivel]}
                  </option>
                ))}
              </select>
            </label>

            <label className="campo">
              Partidas previstas (1 a 9)
              <input
                type="number"
                min={1}
                max={9}
                value={valores.partidas}
                onChange={(e) => mudar("partidas", e.target.value)}
              />
            </label>
          </div>
        )}

        <label className="campo">
          Objetivo
          <input value={valores.objetivo} onChange={(e) => mudar("objetivo", e.target.value)} />
        </label>

        <label className="campo">
          Local ou canal (Discord, lobby, link...)
          <input value={valores.local} onChange={(e) => mudar("local", e.target.value)} />
        </label>

        <label className="campo">
          Regras (restrição de campeões, observador, transmissão...)
          <textarea
            rows={2}
            value={valores.regras}
            onChange={(e) => mudar("regras", e.target.value)}
          />
        </label>

        <label className="campo">
          Observações
          <textarea
            rows={2}
            value={valores.observacoes}
            onChange={(e) => mudar("observacoes", e.target.value)}
          />
        </label>

        {pedirMotivo && (
          <label className="campo">
            {mudouInicio ? "Motivo da remarcação (obrigatório)" : "Motivo da alteração (opcional)"}
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
        )}

        <div className="acoes-modal">
          <button type="button" className="botao" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-principal" disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar evento"}
          </button>
        </div>
      </form>
    </div>
  );
}