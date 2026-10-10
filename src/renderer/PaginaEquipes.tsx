import { useEffect, useState } from "react";
import type { Equipe } from "../core/equipes/tipos";
import { FormularioEquipe } from "./FormularioEquipe";
import { ROTULO_NIVEL, ROTULO_STATUS_EQUIPE } from "./formatacao";

export function PaginaEquipes() {
  const [busca, setBusca] = useState("");
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [versao, setVersao] = useState(0); // aumenta para recarregar a lista
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [equipeEmEdicao, setEquipeEmEdicao] = useState<Equipe | null>(null);

  useEffect(() => {
    if (window.api === undefined) {
      setErro(
        "Esta tela precisa ser aberta pela janela do programa (Electron), e não pelo navegador.",
      );
      setCarregando(false);
      return;
    }

    let cancelado = false;
    setCarregando(true);

    window.api.equipes
      .listar({ busca, incluirInativas: mostrarInativas })
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.ok) {
          setEquipes(resultado.dados);
          setErro(null);
        } else {
          setErro(resultado.erros.join(" "));
        }
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
  }, [busca, mostrarInativas, versao]);

  function fecharFormulario() {
    setFormularioAberto(false);
    setEquipeEmEdicao(null);
  }

  return (
    <section>
      <header className="cabecalho-pagina">
        <h2>Equipes</h2>
        <span className="aviso">
          {carregando ? "Carregando..." : "Dados do banco de dados"}
        </span>
      </header>

      <div className="barra-ferramentas">
        <input
          className="campo-busca"
          type="search"
          placeholder="Buscar por nome ou tag..."
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
        />
        <label className="campo-checkbox sem-margem">
          <input
            type="checkbox"
            checked={mostrarInativas}
            onChange={(evento) => setMostrarInativas(evento.target.checked)}
          />
          Mostrar inativas
        </label>
        <button className="botao" onClick={() => setVersao((v) => v + 1)}>
          Atualizar
        </button>
        <button className="botao botao-principal" onClick={() => setFormularioAberto(true)}>
          Nova equipe
        </button>
      </div>

      {erro !== null && <p className="mensagem-erro">{erro}</p>}

      <table className="tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tag</th>
            <th>Nível</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {equipes.map((equipe) => (
            <tr key={equipe.id}>
              <td>{equipe.nome}</td>
              <td className="tag-equipe">{equipe.tag ?? "N/D"}</td>
              <td>{ROTULO_NIVEL[equipe.nivel]}</td>
              <td>{ROTULO_STATUS_EQUIPE[equipe.status]}</td>
              <td className="celula-acoes">
                <button className="botao botao-pequeno" onClick={() => setEquipeEmEdicao(equipe)}>
                  Editar
                </button>
              </td>
            </tr>
          ))}
          {!carregando && equipes.length === 0 && (
            <tr>
              <td colSpan={5}>Nenhuma equipe encontrada.</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="rodape-tabela">{equipes.length} equipe(s)</p>

      {(formularioAberto || equipeEmEdicao !== null) && (
        <FormularioEquipe
          equipe={equipeEmEdicao ?? undefined}
          aoCancelar={fecharFormulario}
          aoSalvar={() => {
            fecharFormulario();
            setVersao((v) => v + 1); // recarrega a tabela
          }}
        />
      )}
    </section>
  );
}