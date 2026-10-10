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

    CREATE TABLE IF NOT EXISTS equipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL COLLATE NOCASE UNIQUE,
      tag TEXT COLLATE NOCASE UNIQUE,
      nivel TEXT NOT NULL DEFAULT 'principal'
        CHECK (nivel IN ('principal','secundaria','academia')),
      status TEXT NOT NULL DEFAULT 'em_formacao'
        CHECK (status IN ('em_formacao','ativa','inativa')),
      objetivo TEXT,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS participacoes_equipe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipe_id INTEGER NOT NULL REFERENCES equipes(id),
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      funcao TEXT NOT NULL
        CHECK (funcao IN ('titular','reserva','academia','capitao','coach')),
      posicao TEXT
        CHECK (posicao IS NULL OR posicao IN ('Top','Jungle','Mid','ADC','Support')),
      entrou_em TEXT NOT NULL DEFAULT (datetime('now')),
      saiu_em TEXT,
      motivo_entrada TEXT,
      motivo_saida TEXT,
      responsavel TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_participacoes_equipe
      ON participacoes_equipe (equipe_id, saiu_em);
    CREATE INDEX IF NOT EXISTS idx_participacoes_jogador
      ON participacoes_equipe (jogador_id, saiu_em);

    -- "Cintos de seguranca": regras que o proprio banco garante, so para quem esta ATIVO
    CREATE UNIQUE INDEX IF NOT EXISTS ux_participacao_unica
      ON participacoes_equipe (equipe_id, jogador_id, funcao) WHERE saiu_em IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_titular_unico_por_pessoa
      ON participacoes_equipe (jogador_id) WHERE funcao = 'titular' AND saiu_em IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_titular_por_posicao
      ON participacoes_equipe (equipe_id, posicao) WHERE funcao = 'titular' AND saiu_em IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_capitao_unico
      ON participacoes_equipe (equipe_id) WHERE funcao = 'capitao' AND saiu_em IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_unico
      ON participacoes_equipe (equipe_id) WHERE funcao = 'coach' AND saiu_em IS NULL;
  `);
}