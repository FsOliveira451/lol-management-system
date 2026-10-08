import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// O banco fica em: <pasta do projeto>\data\lol.db
const PASTA_DADOS = path.join(process.cwd(), "data");
const ARQUIVO_BANCO = path.join(PASTA_DADOS, "lol.db");

export function abrirBanco(): Database.Database {
  // Cria a pasta "data" se ela ainda nao existir
  fs.mkdirSync(PASTA_DADOS, { recursive: true });

  const banco = new Database(ARQUIVO_BANCO);

  // Liga a verificacao de relacionamentos entre tabelas (vamos usar depois)
  banco.pragma("foreign_keys = ON");

  return banco;
}