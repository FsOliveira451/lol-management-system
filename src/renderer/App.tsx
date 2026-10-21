import { useState } from "react";
import { PaginaEquipes } from "./PaginaEquipes";
import { PaginaEventos } from "./PaginaEventos";
import { PaginaJogadores } from "./PaginaJogadores";

type Tela =
  | "dashboard"
  | "jogadores"
  | "equipes"
  | "eventos"
  | "estatisticas"
  | "configuracoes";

const MENU: { id: Tela; rotulo: string }[] = [
  { id: "dashboard", rotulo: "Dashboard" },
  { id: "jogadores", rotulo: "Pessoas" },
  { id: "equipes", rotulo: "Equipes" },
  { id: "eventos", rotulo: "Eventos" },
  { id: "estatisticas", rotulo: "Estatísticas" },
  { id: "configuracoes", rotulo: "Configurações" },
];

function TelaEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <section>
      <h2>{titulo}</h2>
      <p className="em-construcao">Esta tela será construída nas próximas etapas.</p>
    </section>
  );
}

// Escolhe qual tela mostrar
function Conteudo({ tela, titulo }: { tela: Tela; titulo: string }) {
  if (tela === "jogadores") return <PaginaJogadores />;
  if (tela === "equipes") return <PaginaEquipes />;
  if (tela === "eventos") return <PaginaEventos />;
  return <TelaEmConstrucao titulo={titulo} />;
}

export function App() {
  const [telaAtiva, setTelaAtiva] = useState<Tela>("jogadores");
  const itemAtivo = MENU.find((item) => item.id === telaAtiva);

  return (
    <div className="aplicacao">
      <aside className="menu-lateral">
        <h1 className="logo">LOL CMS</h1>
        <nav>
          {MENU.map((item) => (
            <button
              key={item.id}
              className={item.id === telaAtiva ? "item-menu ativo" : "item-menu"}
              onClick={() => setTelaAtiva(item.id)}
            >
              {item.rotulo}
            </button>
          ))}
        </nav>
      </aside>

      <main className="conteudo">
        <Conteudo tela={telaAtiva} titulo={itemAtivo?.rotulo ?? ""} />
      </main>
    </div>
  );
}