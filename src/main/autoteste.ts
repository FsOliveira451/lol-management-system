import Database from "better-sqlite3";
import { criarTabelas } from "../database/esquema";
import { criarJogador, listarJogadores } from "../database/jogadores-repositorio";

// Prova que o banco funciona DENTRO do Electron, usando um banco temporario
// na memoria (nao toca nos dados reais).
export function executarAutoteste(): boolean {
  const banco = new Database(":memory:");
  try {
    criarTabelas(banco);
    criarJogador(banco, { apelido: "Autoteste", eloAtual: "Ouro" });

    const lista = listarJogadores(banco, { incluirInativos: true });
    const ok = lista.length === 1 && lista[0]?.apelido === "Autoteste";

    console.log(ok ? "AUTOTESTE: OK" : "AUTOTESTE: FALHOU");
    return ok;
  } finally {
    // "finally" roda SEMPRE, com erro ou sem erro: garante que o banco fecha
    banco.close();
  }
}