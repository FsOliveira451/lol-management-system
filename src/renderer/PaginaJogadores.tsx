import { useEffect, useState } from "react";
import type { Jogador, StatusJogador } from "../core/jogadores/tipos";
import { FormularioJogador } from "./FormularioJogador";

// "Record<StatusJogador, string>" obriga a ter um texto para CADA status
const ROTULO_STATUS: Record<StatusJogador, string> = {
  ativo: "🟢 Ativo",
  em_avaliacao: "🟡 Em avaliação",
  titular: "🔵 Titular",
  reserva: "🟣 Reserva",
  academia: "🟠 Academia",
  casual: "⚪ Casual",
  inativo: "🔴 Inativo",
  fora_do_projeto: "⚫ Fora do projeto",
};

export function PaginaJogadores() {
  // Estado: a "memoria" da tela
  const [busca, setBusca] = useState("");
  const [versao, setVersao] = useState(0); // aumenta a cada clique em "Atualizar"
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
    const [formularioAberto, setFormularioAberto] = useState(false);

  // Efeito: busca os dados no banco quando a tela aparece
  // e SEMPRE que "busca" ou "versao" mudarem
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

    window.api.jogadores
      .listar({ busca })
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.ok) {
          setJogadores(resultado.dados);
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

    // Limpeza: se a busca mudar antes da resposta chegar, ignora a resposta antiga
    return () => {
      cancelado = true;
    };
  }, [busca, versao]);

  return (
    <section>
      <header className="cabecalho-pagina">
        <h2>Jogadores</h2>
        <span className="aviso">
          {carregando ? "Carregando..." : "Dados do banco de dados"}
        </span>
      </header>

      <div className="barra-ferramentas">
        <input
          className="campo-busca"
          type="search"
          placeholder="Buscar por apelido ou Riot ID..."
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
        />
                <button className="botao" onClick={() => setVersao((v) => v + 1)}>
          Atualizar
        </button>
        <button
          className="botao botao-principal"
          onClick={() => setFormularioAberto(true)}
        >
          Novo jogador
        </button>
      </div>

      {erro !== null && <p className="mensagem-erro">{erro}</p>}

      <table className="tabela">
        <thead>
          <tr>
            <th>Apelido</th>
            <th>Elo</th>
            <th>Posição</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jogadores.map((jogador) => (
            <tr key={jogador.id}>
              <td>{jogador.apelido}</td>
              <td>{jogador.eloAtual === "Desconhecido" ? "N/D" : jogador.eloAtual}</td>
              <td>{jogador.posicaoPrincipal ?? "N/D"}</td>
              <td>{ROTULO_STATUS[jogador.status]}</td>
            </tr>
          ))}
          {!carregando && jogadores.length === 0 && (
            <tr>
              <td colSpan={4}>Nenhum jogador encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>

            <p className="rodape-tabela">{jogadores.length} jogador(es)</p>

      {formularioAberto && (
        <FormularioJogador
          aoCancelar={() => setFormularioAberto(false)}
          aoSalvar={() => {
            setFormularioAberto(false);
            setVersao((v) => v + 1); // recarrega a tabela
          }}
        />
      )}
    </section>
  );
}