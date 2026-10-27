import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DadosEvento } from "../src/core/eventos/tipos";
import type { FuncaoEquipe } from "../src/core/equipes/tipos";
import type { Posicao } from "../src/core/jogadores/tipos";
import {
  apagarDesempenho,
  corrigirDesempenho,
  estatisticasDaPessoa,
  listarHistoricoDeDesempenhos,
  obterDesempenhosDaPartida,
  registrarDesempenho,
} from "../src/database/desempenho-repositorio";
import { adicionarMembro, criarEquipe } from "../src/database/equipes-repositorio";
import { criarTabelas } from "../src/database/esquema";
import { criarJogador } from "../src/database/jogadores-repositorio";
import { apagarPartida, registrarPartida } from "../src/database/partidas-repositorio";
import {
  adicionarConvocado,
  criarEventoComConvocacao,
  definirEstado,
} from "../src/database/presenca-repositorio";

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

function equipe(nome: string): number {
  return criarEquipe(banco, { nome, status: "ativa" }).id;
}

function pessoa(apelido: string): number {
  return criarJogador(banco, { apelido }).id;
}

function titular(equipeId: number, jogadorId: number, posicao: Posicao): void {
  adicionarMembro(banco, { equipeId, jogadorId, funcao: "titular", posicao });
}

function papel(equipeId: number, jogadorId: number, funcao: FuncaoEquipe): void {
  adicionarMembro(banco, { equipeId, jogadorId, funcao });
}

// Scrim com adversario externo, as 19:00 do dia 20 (ja comecou em relacao a AGORA)
function scrim(dados: DadosEvento) {
  return criarEventoComConvocacao(banco, {
    tipo: "scrim",
    inicio: "2026-10-20 19:00",
    adversario: "Time X",
    ...dados,
  });
}

function presente(eventoId: number, jogadorId: number): void {
  definirEstado(banco, eventoId, jogadorId, "presente", AGORA);
}

// Equipe Alfa com a Ana (Top), um scrim externo, Ana presente e a partida 1 (vitoria) registrada
function cenarioExterno() {
  const a = equipe("Alfa");
  const ana = pessoa("Ana");
  titular(a, ana, "Top");
  const ev = scrim({ equipeIds: [a] });
  presente(ev.id, ana);
  const partida = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);
  return { a, ana, ev, partida };
}

const garen = (jogadorId: number) => ({
  jogadorId,
  posicao: "Top" as const,
  campeao: "Garen",
  abates: 5,
  mortes: 2,
  assistencias: 7,
});

describe("registrar desempenho", () => {
  it("registra, normaliza o campeao e grava a trilha no historico", () => {
    const { a, ana, ev, partida } = cenarioExterno();

    const registro = registrarDesempenho(banco, partida.id, {
      jogadorId: ana,
      posicao: "Top",
      campeao: "lee sin",
      abates: 5,
      mortes: 2,
      assistencias: 7,
    });

    expect(registro).toMatchObject({
      partidaId: partida.id,
      jogadorId: ana,
      equipeId: a,
      posicao: "Top",
      campeao: "Lee Sin",
      abates: 5,
      apelido: "Ana",
      equipeNome: "Alfa",
    });
    expect(listarHistoricoDeDesempenhos(banco, ev.id)[0]).toMatchObject({
      campo: "situacao",
      valorAnterior: null,
      valorNovo: "Registrado: Ana (Top, Lee Sin)",
      apelido: "Ana",
    });
  });

  it("recusa quem foi convocado mas ainda nao tem presenca registrada", () => {
    const a = equipe("Alfa");
    const ana = pessoa("Ana");
    titular(a, ana, "Top");
    const ev = scrim({ equipeIds: [a] });
    const partida = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() => registrarDesempenho(banco, partida.id, garen(ana))).toThrow(
      /Registre a presença/,
    );
  });

  it("recusa quem foi convocado so como staff", () => {
    const a = equipe("Alfa");
    const cris = pessoa("Cris");
    papel(a, cris, "coach");
    const ev = scrim({ equipeIds: [a] });
    presente(ev.id, cris);
    const partida = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    expect(() => registrarDesempenho(banco, partida.id, garen(cris))).toThrow(/staff/);
  });

  it("recusa quem nao esta convocado", () => {
    const { partida } = cenarioExterno();
    const visitante = pessoa("Visitante");

    expect(() => registrarDesempenho(banco, partida.id, garen(visitante))).toThrow(
      /não está convocada/,
    );
  });

  it("aceita convocacao avulsa: o lado e a equipe do evento", () => {
    const { a, ev, partida } = cenarioExterno();
    const visitante = pessoa("Visitante");
    adicionarConvocado(banco, ev.id, visitante);
    presente(ev.id, visitante);

    const registro = registrarDesempenho(banco, partida.id, {
      ...garen(visitante),
      posicao: "Mid",
      campeao: "Ahri",
    });
    expect(registro.equipeId).toBe(a);
  });

  it("recusa posicao repetida no mesmo lado", () => {
    const { a, ana, ev, partida } = cenarioExterno();
    const bia = pessoa("Bia");
    titular(a, bia, "Jungle");
    adicionarConvocado(banco, ev.id, bia);
    presente(ev.id, bia);

    registrarDesempenho(banco, partida.id, garen(ana));
    expect(() =>
      registrarDesempenho(banco, partida.id, { ...garen(bia), campeao: "Lee Sin" }),
    ).toThrow(/Já existe um jogador de Top/);
  });

  it("recusa campeao repetido no mesmo lado, mesmo com escrita diferente", () => {
    const { a, ana, ev, partida } = cenarioExterno();
    const bia = pessoa("Bia");
    titular(a, bia, "Jungle");
    adicionarConvocado(banco, ev.id, bia);
    presente(ev.id, bia);

    registrarDesempenho(banco, partida.id, garen(ana));
    expect(() =>
      registrarDesempenho(banco, partida.id, { ...garen(bia), posicao: "Jungle", campeao: "GAREN" }),
    ).toThrow(/Garen já foi registrado/);
  });

  it("recusa o sexto jogador do mesmo lado", () => {
    const a = equipe("Alfa");
    const posicoes: Posicao[] = ["Top", "Jungle", "Mid", "ADC", "Support"];
    const campeoes = ["Garen", "Lee Sin", "Ahri", "Jinx", "Thresh"];
    const titulares = posicoes.map((posicao, i) => {
      const id = pessoa(`Titular${i}`);
      titular(a, id, posicao);
      return id;
    });
    const reserva = pessoa("Reserva");
    papel(a, reserva, "reserva");

    const ev = scrim({ equipeIds: [a] });
    for (const id of [...titulares, reserva]) presente(ev.id, id);
    const partida = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);

    titulares.forEach((id, i) => {
      registrarDesempenho(banco, partida.id, {
        jogadorId: id,
        posicao: posicoes[i]!,
        campeao: campeoes[i]!,
      });
    });

    expect(() =>
      registrarDesempenho(banco, partida.id, {
        jogadorId: reserva,
        posicao: "Top",
        campeao: "Zed",
      }),
    ).toThrow(/já tem 5 jogadores/);
  });
});

describe("confronto interno", () => {
  function cenarioInterno() {
    const a = equipe("Alfa");
    const b = equipe("Beta");
    const ana = pessoa("Ana");
    const bia = pessoa("Bia");
    titular(a, ana, "Top");
    titular(b, bia, "Top");
    const ev = scrim({ equipeIds: [a, b], adversario: null });
    presente(ev.id, ana);
    presente(ev.id, bia);
    const partida = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);
    return { a, b, ana, bia, ev, partida };
  }

  it("o lado vem da convocacao, a mesma posicao nos dois lados vale, e o mesmo campeao so avisa", () => {
    const { a, b, ana, bia, partida } = cenarioInterno();

    registrarDesempenho(banco, partida.id, garen(ana));
    registrarDesempenho(banco, partida.id, garen(bia));

    const resultado = obterDesempenhosDaPartida(banco, partida.id);
    expect(resultado.registros.map((r) => [r.apelido, r.equipeId])).toEqual([
      ["Ana", a],
      ["Bia", b],
    ]);
    expect(resultado.avisos).toContain("Garen aparece nos dois lados.");
    expect(resultado.avisos).toContain("Alfa: 1 de 5 jogadores registrados.");
  });

  it("recusa informar um lado diferente do da convocacao", () => {
    const { a, b, bia, partida } = cenarioInterno();

    expect(() =>
      registrarDesempenho(banco, partida.id, { ...garen(bia), equipeId: a }),
    ).toThrow(/só pode jogar pela equipe em que foi convocada/);
    expect(b).not.toBe(a);
  });
});

describe("corrigir desempenho", () => {
  it("exige motivo ao mudar o campeao e grava antes e depois", () => {
    const { ana, ev, partida } = cenarioExterno();
    const registro = registrarDesempenho(banco, partida.id, garen(ana));

    expect(() => corrigirDesempenho(banco, registro.id, { campeao: "Ahri" })).toThrow(
      /Informe o motivo/,
    );

    const corrigido = corrigirDesempenho(
      banco,
      registro.id,
      { campeao: "ahri" },
      { motivo: "Erro de digitação" },
    );
    expect(corrigido.campeao).toBe("Ahri");

    const mudanca = listarHistoricoDeDesempenhos(banco, ev.id).find((h) => h.campo === "campeao");
    expect(mudanca).toMatchObject({
      valorAnterior: "Garen",
      valorNovo: "Ahri",
      motivo: "Erro de digitação",
    });
  });

  it("mudar o KDA grava o historico no formato abates/mortes/assistencias", () => {
    const { ana, ev, partida } = cenarioExterno();
    const registro = registrarDesempenho(banco, partida.id, garen(ana));

    corrigirDesempenho(banco, registro.id, { abates: 6 }, { motivo: "Faltou um abate" });

    const mudanca = listarHistoricoDeDesempenhos(banco, ev.id).find((h) => h.campo === "kda");
    expect(mudanca).toMatchObject({ valorAnterior: "5/2/7", valorNovo: "6/2/7" });
  });

  it("corrigir sem mudar nada devolve o mesmo registro e nao grava historico", () => {
    const { ana, ev, partida } = cenarioExterno();
    const registro = registrarDesempenho(banco, partida.id, garen(ana));

    const igual = corrigirDesempenho(banco, registro.id, { campeao: "Garen" });
    expect(igual).toEqual(registro);
    expect(listarHistoricoDeDesempenhos(banco, ev.id)).toHaveLength(1); // so o registro
  });

  it("nao troca a pessoa: o caminho e apagar e registrar de novo", () => {
    const { ana, partida } = cenarioExterno();
    const outra = pessoa("Outra");
    const registro = registrarDesempenho(banco, partida.id, garen(ana));

    expect(() =>
      corrigirDesempenho(banco, registro.id, { jogadorId: outra }, { motivo: "Troca" }),
    ).toThrow(/apague o registro e registre de novo/);
  });
});

describe("apagar", () => {
  it("apagar um desempenho exige motivo, remove e a trilha sobrevive", () => {
    const { ana, ev, partida } = cenarioExterno();
    const registro = registrarDesempenho(banco, partida.id, garen(ana));

    expect(() => apagarDesempenho(banco, registro.id, {})).toThrow(/motivo/);
    expect(obterDesempenhosDaPartida(banco, partida.id).registros).toHaveLength(1);

    apagarDesempenho(banco, registro.id, { motivo: "Lançado na partida errada" });
    expect(obterDesempenhosDaPartida(banco, partida.id).registros).toEqual([]);

    expect(listarHistoricoDeDesempenhos(banco, ev.id).at(-1)).toMatchObject({
      campo: "situacao",
      valorAnterior: "Ana (Top, Garen)",
      valorNovo: "apagado",
      motivo: "Lançado na partida errada",
    });
  });

  it("apagar a partida leva os desempenhos junto, deixando a trilha", () => {
    const { ana, ev, partida } = cenarioExterno();
    registrarDesempenho(banco, partida.id, garen(ana));

    apagarPartida(banco, partida.id, { motivo: "Erro" });

    const total = banco.prepare("SELECT COUNT(*) AS n FROM desempenhos_partida").get() as {
      n: number;
    };
    expect(total.n).toBe(0);
    expect(listarHistoricoDeDesempenhos(banco, ev.id).at(-1)).toMatchObject({
      valorNovo: "apagado",
      motivo: "Partida 1 apagada: Erro",
    });
  });
});

describe("consistencia com a presenca", () => {
  it("quem tem desempenho nao pode virar faltou, mas pode virar atrasou; apagado o registro, volta a ser livre", () => {
    const { ana, ev, partida } = cenarioExterno();
    const registro = registrarDesempenho(banco, partida.id, garen(ana));

    expect(() => definirEstado(banco, ev.id, ana, "faltou", AGORA)).toThrow(
      /desempenho registrado/,
    );
    expect(() => definirEstado(banco, ev.id, ana, "confirmado", AGORA)).toThrow(
      /desempenho registrado/,
    );
    expect(definirEstado(banco, ev.id, ana, "atrasou", AGORA).estado).toBe("atrasou");

    apagarDesempenho(banco, registro.id, { motivo: "Não jogou" });
    expect(definirEstado(banco, ev.id, ana, "faltou", AGORA).estado).toBe("faltou");
  });
});

describe("estatisticas da pessoa", () => {
  it("externo: conta partida e vitoria, soma o KDA e lista campeao e posicao", () => {
    const { ana, partida } = cenarioExterno();
    registrarDesempenho(banco, partida.id, { ...garen(ana), campeao: "lee sin" });

    const resultado = estatisticasDaPessoa(banco, ana);
    expect(resultado.externo).toEqual({ partidas: 1, vitorias: 1, derrotas: 0, winRate: null });
    expect(resultado.kda).toMatchObject({ partidasComKda: 1, abates: 5, mortes: 2, assistencias: 7 });
    expect(resultado.kda.razao).toBeNull(); // menos de 5 partidas com KDA
    expect(resultado.campeoes[0]).toMatchObject({ campeao: "Lee Sin", partidas: 1 });
    expect(resultado.posicoes.Top).toBe(1);
  });

  it("confronto interno fica separado, cada pessoa com o resultado do seu lado", () => {
    const a = equipe("Alfa");
    const b = equipe("Beta");
    const ana = pessoa("Ana");
    const bia = pessoa("Bia");
    titular(a, ana, "Top");
    titular(b, bia, "Top");
    const ev = scrim({ equipeIds: [a, b], adversario: null });
    presente(ev.id, ana);
    presente(ev.id, bia);
    const partida = registrarPartida(banco, ev.id, { numero: 1, vencedorEquipeId: a }, AGORA);
    registrarDesempenho(banco, partida.id, garen(ana));
    registrarDesempenho(banco, partida.id, { ...garen(bia), campeao: "Darius" });

    const daAna = estatisticasDaPessoa(banco, ana);
    expect(daAna.externo.partidas).toBe(0);
    expect(daAna.interno).toMatchObject({ partidas: 1, vitorias: 1, derrotas: 0 });
    expect(estatisticasDaPessoa(banco, bia).interno).toMatchObject({ vitorias: 0, derrotas: 1 });
  });

  it("pessoa inexistente e recusada", () => {
    expect(() => estatisticasDaPessoa(banco, 999)).toThrow(/Pessoa não encontrada/);
  });
});

describe("cintos de seguranca do banco", () => {
  it("o CHECK impede KDA parcial", () => {
    const { a, ana, partida } = cenarioExterno();

    expect(() =>
      banco
        .prepare(
          `INSERT INTO desempenhos_partida (partida_id, jogador_id, equipe_id, posicao, campeao, abates)
           VALUES (?, ?, ?, 'Top', 'Garen', 5)`,
        )
        .run(partida.id, ana, a),
    ).toThrow(/CHECK/);
  });

  it("o indice impede duas pessoas na mesma posicao do mesmo lado", () => {
    const { a, ana, partida } = cenarioExterno();
    const bia = pessoa("Bia");
    const inserir = banco.prepare(
      `INSERT INTO desempenhos_partida (partida_id, jogador_id, equipe_id, posicao, campeao)
       VALUES (?, ?, ?, 'Top', ?)`,
    );

    inserir.run(partida.id, ana, a, "Garen");
    expect(() => inserir.run(partida.id, bia, a, "Darius")).toThrow(/UNIQUE/);
  });
});