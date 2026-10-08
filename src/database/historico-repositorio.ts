import type Database from "better-sqlite3";

export type CampoHistorico =
  | "elo_atual"
  | "elo_maximo"
  | "posicao_principal"
  | "posicao_secundaria"
  | "status";

export interface NovaEntradaHistorico {
  jogadorId: number;
  campo: CampoHistorico;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo?: string | null;
  responsavel?: string | null;
}

export interface EntradaHistorico {
  id: number;
  jogadorId: number;
  campo: CampoHistorico;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registradoEm: string;
}

interface LinhaHistorico {
  id: number;
  jogador_id: number;
  campo: CampoHistorico;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  responsavel: string | null;
  registrado_em: string;
}

export function registrarHistorico(
  banco: Database.Database,
  entrada: NovaEntradaHistorico,
): void {
  banco
    .prepare(
      `INSERT INTO historico_jogador
         (jogador_id, campo, valor_anterior, valor_novo, motivo, responsavel)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entrada.jogadorId,
      entrada.campo,
      entrada.valorAnterior,
      entrada.valorNovo,
      entrada.motivo ?? null,
      entrada.responsavel ?? null,
    );
}

// Devolve o historico do mais antigo para o mais recente
export function listarHistoricoDoJogador(
  banco: Database.Database,
  jogadorId: number,
  campo?: CampoHistorico,
): EntradaHistorico[] {
  const parametros: (number | string)[] = [jogadorId];
  let filtro = "";
  if (campo) {
    filtro = "AND campo = ?";
    parametros.push(campo);
  }

  const linhas = banco
    .prepare(
      `SELECT * FROM historico_jogador
       WHERE jogador_id = ? ${filtro}
       ORDER BY id`,
    )
    .all(...parametros) as LinhaHistorico[];

  return linhas.map((linha) => ({
    id: linha.id,
    jogadorId: linha.jogador_id,
    campo: linha.campo,
    valorAnterior: linha.valor_anterior,
    valorNovo: linha.valor_novo,
    motivo: linha.motivo,
    responsavel: linha.responsavel,
    registradoEm: linha.registrado_em,
  }));
}