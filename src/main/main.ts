import { app, BrowserWindow } from "electron";

// Em desenvolvimento, a tela vem do servidor do Vite
const URL_DESENVOLVIMENTO = "http://127.0.0.1:5173";

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0f1419",
    title: "LOL Competitive Management System",
    webPreferences: {
      // Seguranca: a tela NAO recebe poderes do Node
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // A tela nao pode abrir janelas novas sozinha
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  janela.loadURL(URL_DESENVOLVIMENTO).catch((erro: unknown) => {
    console.error("Não foi possível carregar a interface. O servidor do Vite está rodando?", erro);
  });
}

// "whenReady": espera o Electron terminar de iniciar para criar a janela
app.whenReady().then(() => {
  criarJanela();

  // No macOS, clicar no icone sem janelas abertas recria a janela
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      criarJanela();
    }
  });
});

// Fechar a ultima janela encerra o programa (exceto no macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});