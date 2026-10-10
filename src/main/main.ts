import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import type Database from "better-sqlite3";
import { abrirBanco } from "../database/conexao";
import { criarTabelas } from "../database/esquema";
import { listarJogadores } from "../database/jogadores-repositorio";
import { executarAutoteste } from "./autoteste";
import { registrarIpc } from "./ipc";

// Em desenvolvimento, a tela vem do servidor do Vite
const URL_DESENVOLVIMENTO = "http://127.0.0.1:5173";
const MODO_AUTOTESTE = process.argv.includes("--autoteste");

// O banco aberto do programa
let banco: Database.Database | null = null;

function iniciarBanco(): Database.Database {
  const pasta = app.getPath("userData");
  const aberto = abrirBanco(pasta);
  criarTabelas(aberto);

  const total = listarJogadores(aberto, { incluirInativos: true }).length;
  console.log(`Banco aberto em: ${path.join(pasta, "lol.db")}`);
  console.log(`Jogadores cadastrados: ${total}`);
  return aberto;
}

// Fecha o banco com seguranca e encerra o programa
function encerrar(codigo: number): void {
  banco?.close();
  banco = null;
  app.exit(codigo);
}

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0f1419",
    title: "LOL Competitive Management System",
    webPreferences: {
      // O "guichê" que a tela enxerga como window.api
      preload: path.join(__dirname, "preload.cjs"),
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

app.whenReady().then(() => {
  try {
    const aberto = iniciarBanco();
    banco = aberto;

    if (MODO_AUTOTESTE) {
      encerrar(executarAutoteste() ? 0 : 1);
      return;
    }

    registrarIpc(aberto);
  } catch (erro) {
    console.error("ERRO ao iniciar o banco de dados:", erro);
    if (!MODO_AUTOTESTE) {
      dialog.showErrorBox("Erro ao abrir o banco de dados", String(erro));
    }
    encerrar(1);
    return;
  }

  criarJanela();

  // No macOS, clicar no icone sem janelas abertas recria a janela
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      criarJanela();
    }
  });
});

// Garante que o banco fecha quando o programa e encerrado normalmente
app.on("before-quit", () => {
  banco?.close();
  banco = null;
});

// Fechar a ultima janela encerra o programa (exceto no macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});