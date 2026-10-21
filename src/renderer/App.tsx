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

const MENU: { id: Tela; rotulo: string; icone: string }[] = [
  { id: "dashboard", rotulo: "Dashboard", icone: "📊" },
  { id: "jogadores", rotulo: "Pessoas", icone: "👥" },
  { id: "equipes", rotulo: "Equipes", icone: "🛡️" },
  { id: "eventos", rotulo: "Eventos", icone: "📅" },
  { id: "estatisticas", rotulo: "Estatísticas", icone: "📈" },
  { id: "configuracoes", rotulo: "Configurações", icone: "⚙️" },
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
      {/* O "espaco" reserva a faixa fina; o menu em si abre por cima do conteudo */}
      <div className="menu-espaco">
        <aside className="menu-lateral">
          <h1 className="logo">
            <span className="logo-marca">L</span>
            <span className="logo-texto">
              LOL CMS
              <span className="logo-sub">Competitive Manager</span>
            </span>
          </h1>

          <nav>
            {MENU.map((item) => (
              <button
                key={item.id}
                className={item.id === telaAtiva ? "item-menu ativo" : "item-menu"}
                onClick={() => setTelaAtiva(item.id)}
                title={item.rotulo}
              >
                <span className="menu-icone">{item.icone}</span>
                <span className="menu-rotulo">{item.rotulo}</span>
              </button>
            ))}
          </nav>

          <div className="menu-rodape">
            <span className="menu-rodape-ponto" />
            <span className="menu-rodape-texto">v0.1.0</span>
          </div>
        </aside>
      </div>

      <main className="conteudo">
        <Conteudo tela={telaAtiva} titulo={itemAtivo?.rotulo ?? ""} />
      </main>
    </div>
  );
}