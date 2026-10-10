// Prepara o better-sqlite3 para o motor certo: "node" (testes) ou "electron" (programa).
// Uso: node scripts/trocar-motor.mjs node
//      node scripts/trocar-motor.mjs electron
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const alvo = process.argv[2];
if (alvo !== "node" && alvo !== "electron") {
  console.error("Uso: node scripts/trocar-motor.mjs node|electron");
  process.exit(1);
}

const pastaModulo = path.join("node_modules", "better-sqlite3");
const pastaBuild = path.join(pastaModulo, "build");
const marcador = path.join(pastaModulo, ".motor-atual");

// Se ja esta preparado para este motor, nao faz nada
const atual = fs.existsSync(marcador) ? fs.readFileSync(marcador, "utf8").trim() : "";
if (atual === alvo && fs.existsSync(pastaBuild)) {
  console.log(`[motor] better-sqlite3 já está preparado para: ${alvo}`);
  process.exit(0);
}

console.log(`[motor] Preparando better-sqlite3 para: ${alvo} ...`);

try {
  // Apaga a versao antiga (se o programa estiver aberto, o Windows recusa aqui)
  fs.rmSync(pastaBuild, { recursive: true, force: true });
  fs.rmSync(marcador, { force: true });

  if (alvo === "node") {
    execSync("npm rebuild better-sqlite3", { stdio: "inherit" });
  } else {
    execSync("npx electron-rebuild -f -w better-sqlite3", { stdio: "inherit" });
  }

  fs.writeFileSync(marcador, alvo);
  console.log(`[motor] Pronto: better-sqlite3 preparado para ${alvo}.`);
} catch (erro) {
  console.error("[motor] FALHOU. Feche o programa Electron (se estiver aberto) e tente de novo.");
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
}