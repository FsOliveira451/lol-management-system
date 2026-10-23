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

    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL
        CHECK (tipo IN ('treino','scrim','amistoso','tryout','vod','reuniao','campeonato')),
      titulo TEXT,
      inicio TEXT NOT NULL,
      duracao_min INTEGER NOT NULL CHECK (duracao_min BETWEEN 15 AND 720),
      status TEXT NOT NULL DEFAULT 'agendado'
        CHECK (status IN ('agendado','realizado','cancelado')),
      adversario TEXT,
      nivel_adversario TEXT
        CHECK (nivel_adversario IS NULL
               OR nivel_adversario IN ('inferior','semelhante','superior','desconhecido')),
      partidas_previstas INTEGER
        CHECK (partidas_previstas IS NULL OR partidas_previstas BETWEEN 1 AND 9),
      objetivo TEXT,
      local TEXT,
      regras TEXT,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS eventos_equipes (
      evento_id INTEGER NOT NULL REFERENCES eventos(id),
      equipe_id INTEGER NOT NULL REFERENCES equipes(id),
      PRIMARY KEY (evento_id, equipe_id)
    );

    CREATE TABLE IF NOT EXISTS historico_evento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL REFERENCES eventos(id),
      campo TEXT NOT NULL CHECK (campo IN ('inicio','duracao_min','status','equipes')),
      valor_anterior TEXT,
      valor_novo TEXT,
      motivo TEXT,
      responsavel TEXT,
      registrado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_eventos_inicio ON eventos (inicio);
       CREATE INDEX IF NOT EXISTS idx_eventos_equipes_equipe ON eventos_equipes (equipe_id);

    -- Quem foi convocado para cada evento e em que estado de presenca esta.
    -- equipe_id e funcao guardam a "foto" do momento da convocacao (podem ser NULL: convocacao avulsa).
    CREATE TABLE IF NOT EXISTS eventos_participantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL REFERENCES eventos(id),
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      equipe_id INTEGER REFERENCES equipes(id),
      funcao TEXT
        CHECK (funcao IS NULL OR funcao IN ('titular','reserva','academia','capitao','coach')),
      papel TEXT NOT NULL CHECK (papel IN ('jogador','staff')),
      estado TEXT NOT NULL DEFAULT 'convocado'
        CHECK (estado IN ('convocado','confirmado','presente','atrasou','faltou','justificado')),
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cinto de seguranca: uma convocacao por pessoa por evento
    CREATE UNIQUE INDEX IF NOT EXISTS ux_convocacao_unica
      ON eventos_participantes (evento_id, jogador_id);
       CREATE INDEX IF NOT EXISTS idx_convocacoes_jogador
      ON eventos_participantes (jogador_id);

    -- Partidas de scrims, amistosos e campeonatos.
    -- vencedor_equipe_id: NULL = o adversario externo venceu.
    -- origem e riot_match_id ja existem para a futura integracao com a Riot.
    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL REFERENCES eventos(id),
      numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 9),
      vencedor_equipe_id INTEGER REFERENCES equipes(id),
      duracao_min INTEGER CHECK (duracao_min IS NULL OR duracao_min BETWEEN 5 AND 180),
      observacoes TEXT,
      origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','riot')),
      riot_match_id TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cintos de seguranca do banco
    CREATE UNIQUE INDEX IF NOT EXISTS ux_partida_numero
      ON partidas (evento_id, numero);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_partida_riot
      ON partidas (riot_match_id) WHERE riot_match_id IS NOT NULL;

    -- Historico: guarda partida_id SEM chave estrangeira de proposito,
    -- para a trilha sobreviver a uma partida apagada.
    CREATE TABLE IF NOT EXISTS historico_partida (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL REFERENCES eventos(id),
      partida_id INTEGER NOT NULL,
      campo TEXT NOT NULL CHECK (campo IN ('numero','vencedor','duracao_min','situacao')),
      valor_anterior TEXT,
      valor_novo TEXT,
      motivo TEXT,
      responsavel TEXT,
      registrado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_historico_partida_evento
      ON historico_partida (evento_id, id);
  `);
}