import type Database from "better-sqlite3";

export function criarTabelas(banco: Database.Database): void {
  banco.exec(`
    CREATE TABLE IF NOT EXISTS jogadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apelido TEXT NOT NULL,
      riot_id TEXT UNIQUE,

      elo_atual TEXT NOT NULL DEFAULT 'Desconhecido'
        CHECK (elo_atual IN ('Ferro','Bronze','Prata','Ouro','Platina','Esmeralda',
                             'Diamante','Mestre','Graomestre','Desafiante','Desconhecido')),
      elo_maximo TEXT
        CHECK (elo_maximo IS NULL OR elo_maximo IN ('Ferro','Bronze','Prata','Ouro','Platina','Esmeralda',
                             'Diamante','Mestre','Graomestre','Desafiante','Desconhecido')),

      posicao_principal TEXT
        CHECK (posicao_principal IS NULL OR posicao_principal IN ('Top','Jungle','Mid','ADC','Support')),
      posicao_secundaria TEXT
        CHECK (posicao_secundaria IS NULL OR posicao_secundaria IN ('Top','Jungle','Mid','ADC','Support')),

      experiencia_competitiva INTEGER NOT NULL DEFAULT 0
        CHECK (experiencia_competitiva IN (0, 1)),

      comunicacao INTEGER CHECK (comunicacao IS NULL OR comunicacao BETWEEN 1 AND 5),
      lideranca INTEGER CHECK (lideranca IS NULL OR lideranca BETWEEN 1 AND 5),
      comprometimento INTEGER CHECK (comprometimento IS NULL OR comprometimento BETWEEN 1 AND 5),

      status TEXT NOT NULL DEFAULT 'em_avaliacao'
        CHECK (status IN ('ativo','em_avaliacao','titular','reserva',
                          'academia','casual','inativo','fora_do_projeto')),

      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historico_jogador (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      campo TEXT NOT NULL
        CHECK (campo IN ('elo_atual','elo_maximo','posicao_principal',
                         'posicao_secundaria','status')),
      valor_anterior TEXT,
      valor_novo TEXT,
      motivo TEXT,
      responsavel TEXT,
      registrado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_historico_jogador
      ON historico_jogador (jogador_id, campo);
  `);
}