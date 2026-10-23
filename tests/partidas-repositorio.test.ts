import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DadosEvento } from "../src/core/eventos/tipos";
import { criarEquipe } from "../src/database/equipes-repositorio";
import { criarTabelas } from "../src/database/esquema";
import {
  buscarEventoPorId,
  cancelarEvento,
  criarEvento,
  editarEvento,
  listarHistoricoDoEvento,
  marcarComoRealizado,
} from "../src/database/eventos-repositorio";
import {
  apagarPartida,
  corrigirPartida,
  estatisticasDaEquipe,
  listarHistoricoDasPartidas,
  listarPartidas,
  listarPendenciasDeResultado,
  obterPartidasDoEvento,
  registrarPartida,
} from "../src/database/partidas-repositorio";

let banco: Database.Database;

const AGORA = "2026-10-20 20:00";

beforeEach(() => {
  banco = new Database(":memory:");
  banco.pragma("foreign_keys = ON");
  criarTabelas(banco);
});

afterEach(() => {
  banco.close();
});

function novaEquipe(nome: string): number {
  return criarEquipe(banco, { nome, status: "ativa" }).id;
}

// Scrim com adversario externo, as 19:00 do dia 20 (ja comecou em relacao a AGORA)
function evento(dados: DadosEvento) {
  return criarEvento(banco, {
    tipo: "scrim",
    inicio: "2026-10-20 19:00",
    adversario: "Time X",
    ...dados,
  });
}

describe("registrar partida", () => {
  it("registra vitoria externa: grava os dados, origem manual e a trilha no historico", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });

    const p = registrarPartida(
      banco,
      ev.id,
      { numero: 1, vencedorEquipeId: a, duracaoMin: 32, observacoes: "  Boa  " },
      AGORA,
    );

    expect(p).toMatchObject({
      eventoId: ev.id,
      numero: 1,
      vencedorEquipeId: a,
      duracaoMin: 32,
      observacoes: "Boa",
      origem: "manual",
      riotMatchId: null,
    });
    expect(listarHistoricoDasPartidas(banco, ev.id)[0]).toMatchObject({
      campo: "situacao",
      valorAnterior: null,
      valorNovo: "Partida 1 registrada (vencedor: Alfa)",
    });
  });

  it("registra derrota (vencedor null = o adversario venceu)", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });

    const p = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: null }, AGORA);
    expect(p.vencedorEquipeId).toBeNull();
    expect(listarHistoricoDasPartidas(banco, ev.id)[0]!.valorNovo).toBe(
      "Partida 1 registrada (vencedor: Time X)",
    );
  });

  it("a 1a partida marca o evento como realizado, com historico e motivo", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    expect(ev.status).toBe("agendado");

    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(buscarEventoPorId(banco, ev.id)!.status).toBe("realizado");
    const mudancaDeStatus = listarHistoricoDoEvento(banco, ev.id).find((h) => h.campo === "status");
    expect(mudancaDeStatus).toMatchObject({
      valorAnterior: "agendado",
      valorNovo: "realizado",
      motivo: "Primeira partida registrada",
    });
  });

  it("a 2a partida nao repete a mudanca de status", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });

    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);
    registrarPartida(banco, ev.id, { numero: 2, vencedorEquipeId: null }, AGORA);

    const mudancas = listarHistoricoDoEvento(banco, ev.id).filter((h) => h.campo === "status");
    expect(mudancas).toHaveLength(1);
    expect(listarPartidas(banco, ev.id)).toHaveLength(2);
  });

  it("evento que ainda nao comecou: recusa e nao muda nada (tudo ou nada)", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a], inicio: "2026-10-25 19:00" });

    expect(() =>
      registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA),
    ).toThrow(/depois que o evento começar/);

    expect(listarPartidas(banco, ev.id)).toEqual([]);
    expect(buscarEventoPorId(banco, ev.id)!.status).toBe("agendado");
  });

  it("tipo sem partidas (treino) e recusado", () => {
    const a = novaEquipe("Alfa");
    const ev = criarEvento(banco, { tipo: "treino", inicio: "2026-10-20 19:00", equipeIds: [a] });

    expect(() =>
      registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA),
    ).toThrow(/não tem partidas/);
  });

  it("numero repetido no mesmo evento e recusado", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() =>
      registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: null }, AGORA),
    ).toThrow(/Já existe a partida 1/);
  });

  it("confronto interno: recusa vencedor null e aceita uma das duas equipes", () => {
    const a = novaEquipe("Alfa");
    const b = novaEquipe("Beta");
    const ev = evento({ equipeIds: [a, b], adversario: null });

    expect(() =>
      registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: null }, AGORA),
    ).toThrow(/confronto interno/);

    const p = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: b }, AGORA);
    expect(p.vencedorEquipeId).toBe(b);
  });

  it("evento cancelado nao recebe partidas", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    cancelarEvento(banco, ev.id, { motivo: "Chuva" });

    expect(() =>
      registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA),
    ).toThrow(/cancelado/);
  });
});

describe("corrigir partida", () => {
  it("mudar o vencedor exige motivo e grava o historico com os nomes", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    const p = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() => corrigirPartida(banco, p.id, { vencedorEquipeId: null }, AGORA)).toThrow(
      /Informe o motivo/,
    );

    const corrigida = corrigirPartida(banco, p.id, { vencedorEquipeId: null }, AGORA, {
      motivo: "Erro de digitação",
    });
    expect(corrigida.vencedorEquipeId).toBeNull();

    const mudanca = listarHistoricoDasPartidas(banco, ev.id).find((h) => h.campo === "vencedor");
    expect(mudanca).toMatchObject({
      partidaId: p.id,
      valorAnterior: "Alfa",
      valorNovo: "Time X",
      motivo: "Erro de digitação",
    });
  });

  it("corrigir sem mudar nada devolve a mesma partida e nao grava historico", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    const p = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    const igual = corrigirPartida(banco, p.id, { vencedorEquipeId: a }, AGORA);
    expect(igual).toEqual(p);
    expect(listarHistoricoDasPartidas(banco, ev.id)).toHaveLength(1); // so o registro
  });

  it("mudar so as observacoes nao exige motivo e nao gera historico", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    const p = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    const corrigida = corrigirPartida(banco, p.id, { observacoes: "BO3 apertado" }, AGORA);
    expect(corrigida.observacoes).toBe("BO3 apertado");
    expect(listarHistoricoDasPartidas(banco, ev.id)).toHaveLength(1);
  });

  it("recusa mudar o numero para um que ja existe", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);
    const segunda = registrarPartida(banco, ev.id, { numero: 2, vencedorEquipeId: a }, AGORA);

    expect(() =>
      corrigirPartida(banco, segunda.id, { numero: 1 }, AGORA, { motivo: "Troca" }),
    ).toThrow(/Já existe a partida 1/);
  });
});

describe("apagar partida", () => {
  it("exige motivo, apaga, e a trilha sobrevive; o evento continua realizado", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    const p = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() => apagarPartida(banco, p.id, {})).toThrow(/motivo/);
    expect(listarPartidas(banco, ev.id)).toHaveLength(1);

    apagarPartida(banco, p.id, { motivo: "Lançada no evento errado" });
    expect(listarPartidas(banco, ev.id)).toEqual([]);

    const ultima = listarHistoricoDasPartidas(banco, ev.id).at(-1)!;
    expect(ultima).toMatchObject({
      campo: "situacao",
      valorAnterior: "Partida 1 (vencedor: Alfa)",
      valorNovo: "apagada",
      motivo: "Lançada no evento errado",
    });
    expect(buscarEventoPorId(banco, ev.id)!.status).toBe("realizado");
  });

  it("partida inexistente e recusada", () => {
    expect(() => apagarPartida(banco, 999, { motivo: "x" })).toThrow(/não encontrada/);
  });
});

describe("consultar partidas do evento", () => {
  it("devolve em ordem de numero, com avisos de lacuna", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a], partidasPrevistas: 3 });
    registrarPartida(banco, ev.id, { numero: 3, vencedorEquipeId: a }, AGORA);
    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: null }, AGORA);

    const resultado = obterPartidasDoEvento(banco, ev.id);
    expect(resultado.partidas.map((p) => p.numero)).toEqual([1, 3]);
    expect(resultado.partidasPrevistas).toBe(3);
    expect(resultado.avisos).toEqual(["Faltam partidas na sequência: 2."]);
  });

  it("evento inexistente e recusado", () => {
    expect(() => obterPartidasDoEvento(banco, 999)).toThrow(/Evento não encontrado/);
  });
});

describe("consistencia com eventos", () => {
  it("evento com partidas nao aceita trocar as equipes", () => {
    const a = novaEquipe("Alfa");
    const b = novaEquipe("Beta");
    const ev = evento({ equipeIds: [a] });
    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() =>
      editarEvento(banco, ev.id, { equipeIds: [a, b], adversario: null }, { ignorarConflitos: true }),
    ).toThrow(/Evento realizado não pode/);
  });

  it("evento com partidas nao pode ser cancelado", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() => cancelarEvento(banco, ev.id, { motivo: "Desistência" })).toThrow(
      /realizado não pode ser cancelado/,
    );
  });
});

describe("estatisticas da equipe", () => {
  it("calcula o externo e mantem o confronto interno separado", () => {
    const a = novaEquipe("Alfa");
    const b = novaEquipe("Beta");

    const externo = evento({ equipeIds: [a], partidasPrevistas: 5 });
    [a, a, a, null, null].forEach((vencedor, i) => {
      registrarPartida(banco, externo.id, { numero: i + 1, vencedorEquipeId: vencedor }, AGORA);
    });

    const interno = evento({ equipeIds: [a, b], adversario: null, inicio: "2026-10-18 19:00" });
    registrarPartida(banco, interno.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    const estatisticas = estatisticasDaEquipe(banco, a);
    expect(estatisticas.externo).toEqual({ partidas: 5, vitorias: 3, derrotas: 2, winRate: 60 });
    expect(estatisticas.interno).toMatchObject({ partidas: 1, vitorias: 1, derrotas: 0 });
    expect(estatisticas.interno.winRate).toBeNull();
    expect(estatisticas.forma).toEqual(["V", "V", "V", "D", "D"]);

    expect(estatisticasDaEquipe(banco, b).interno).toMatchObject({ vitorias: 0, derrotas: 1 });
  });

  it("equipe inexistente e recusada", () => {
    expect(() => estatisticasDaEquipe(banco, 999)).toThrow(/Equipe não encontrada/);
  });
});

describe("pendencias de resultado", () => {
  it("atencao para evento terminado sem resultado, observacao para realizado sem partidas", () => {
    const a = novaEquipe("Alfa");

    const semResultado = evento({ equipeIds: [a], inicio: "2026-10-01 19:00" });
    const realizadoVazio = evento({ equipeIds: [a], inicio: "2026-10-02 19:00" });
    marcarComoRealizado(banco, realizadoVazio.id, AGORA);
    evento({ equipeIds: [a], inicio: "2026-10-25 19:00" }); // futuro: sem pendencia
    criarEvento(banco, { tipo: "treino", inicio: "2026-10-03 19:00", equipeIds: [a] }); // treino: sem pendencia
    const comResultado = evento({ equipeIds: [a], inicio: "2026-10-04 19:00" });
    registrarPartida(banco, comResultado.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    const pendencias = listarPendenciasDeResultado(banco, AGORA);
    expect(pendencias.map((p) => [p.eventoId, p.nivel])).toEqual([
      [semResultado.id, "atencao"],
      [realizadoVazio.id, "observacao"],
    ]);
    expect(pendencias[0]!.equipes).toEqual(["Alfa"]);
  });
});

describe("cintos de seguranca do banco", () => {
  it("o indice impede duas partidas com o mesmo numero no evento", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    const inserir = banco.prepare("INSERT INTO partidas (evento_id, numero) VALUES (?, ?)");

    inserir.run(ev.id, 1);
    expect(() => inserir.run(ev.id, 1)).toThrow(/UNIQUE/);
  });

  it("o id da Riot e unico quando preenchido, e varias partidas manuais (sem id) convivem", () => {
    const a = novaEquipe("Alfa");
    const ev = evento({ equipeIds: [a] });
    const inserirManual = banco.prepare("INSERT INTO partidas (evento_id, numero) VALUES (?, ?)");
    const inserirRiot = banco.prepare(
      "INSERT INTO partidas (evento_id, numero, origem, riot_match_id) VALUES (?, ?, 'riot', ?)",
    );

    inserirManual.run(ev.id, 1);
    inserirManual.run(ev.id, 2); // dois NULL no id da Riot: permitido
    inserirRiot.run(ev.id, 3, "BR1_100");
    expect(() => inserirRiot.run(ev.id, 4, "BR1_100")).toThrow(/UNIQUE/);
  });
});