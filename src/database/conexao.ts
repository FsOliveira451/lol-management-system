import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Pasta padrao (usada pelos scripts de desenvolvimento): <projeto>\data
const PASTA_PADRAO = path.join(process.cwd(), "data");

// O programa (Electron) informa a SUA pasta; os scripts usam a padrao.
export function abrirBanco(pastaDados: string = PASTA_PADRAO): Database.Database {
  // Cria a pasta se ela ainda nao existir
  fs.mkdirSync(pastaDados, { recursive: true });

  const banco = new Database(path.join(pastaDados, "lol.db"));

  // Liga a verificacao de relacionamentos entre tabelas
  banco.pragma("foreign_keys = ON");

  return banco;
}