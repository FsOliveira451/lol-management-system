import { useState } from "react";
import type { StatusJogador } from "../core/jogadores/tipos";
import { JOGADORES_EXEMPLO } from "./dados-exemplo";

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
  // Estado: a "memoria" da tela. Guarda o que foi digitado na busca.
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const jogadores = JOGADORES_EXEMPLO.filter((jogador) =>
    jogador.apelido.toLowerCase().includes(termo),
  );

  return (
    <section>
      <header className="cabecalho-pagina">
        <h2>Jogadores</h2>
        <span className="aviso">Dados de exemplo (ainda não ligados ao banco)</span>
      </header>

      <input
        className="campo-busca"
        type="search"
        placeholder="Buscar por apelido..."
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
      />

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
          {jogadores.length === 0 && (
            <tr>
              <td colSpan={4}>Nenhum jogador encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="rodape-tabela">{jogadores.length} jogador(es)</p>
    </section>
  );
}