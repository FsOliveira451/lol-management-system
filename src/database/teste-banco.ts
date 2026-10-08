import { abrirBanco } from "./conexao";
import { criarTabelas } from "./esquema";

const banco = abrirBanco();
criarTabelas(banco);

// 1) Inserir um jogador (INSERT OR IGNORE: se o Riot ID ja existir, nao duplica)
const inserir = banco.prepare(
  `INSERT OR IGNORE INTO jogadores (apelido, riot_id, elo_atual, posicao_principal)
   VALUES (?, ?, ?, ?)`
);
inserir.run("Exemplo1", "Exemplo1#BR1", "Ouro", "Mid");

// 2) Ler todos os jogadores
const lista = banco
  .prepare(
    "SELECT id, apelido, riot_id, elo_atual, posicao_principal, status FROM jogadores"
  )
  .all();
console.table(lista);

// 3) Teste de erro proposital: o banco deve RECUSAR este elo
try {
  banco
    .prepare("INSERT INTO jogadores (apelido, elo_atual) VALUES (?, ?)")
    .run("Invalido", "Suporte");
} catch (erro) {
  console.log("Banco recusou (esperado):", (erro as Error).message);
}

banco.close();