// Logica pura do calendario: sem banco e sem tela.
// Um "dia" aqui e sempre um texto "AAAA-MM-DD". O mes e um par { ano, mes } com mes de 1 a 12.

export interface MesCalendario {
  ano: number;
  mes: number; // 1 a 12
}

const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const NOMES_DIAS_DA_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

function textoDoDia(ano: number, mes: number, dia: number): string {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

// Quantos dias o mes tem. O "dia 0" do mes seguinte e o ultimo dia deste mes.
function diasNoMes(mes: MesCalendario): number {
  return new Date(Date.UTC(mes.ano, mes.mes, 0)).getUTCDate();
}

// A grade do mes: uma lista de semanas, cada semana com 7 celulas.
// A semana comeca na SEGUNDA. Celula vazia (preenchimento) = null.
export function diasDoMes(mes: MesCalendario): Array<Array<string | null>> {
  // getUTCDay(): 0 = domingo ... 6 = sabado. Convertemos para 0 = segunda ... 6 = domingo.
  const diaDaSemanaDoDia1 = new Date(Date.UTC(mes.ano, mes.mes - 1, 1)).getUTCDay();
  const vazios = (diaDaSemanaDoDia1 + 6) % 7;

  const celulas: Array<string | null> = Array.from({ length: vazios }, () => null);
  for (let dia = 1; dia <= diasNoMes(mes); dia++) {
    celulas.push(textoDoDia(mes.ano, mes.mes, dia));
  }
  while (celulas.length % 7 !== 0) {
    celulas.push(null);
  }

  const semanas: Array<Array<string | null>> = [];
  for (let inicio = 0; inicio < celulas.length; inicio += 7) {
    semanas.push(celulas.slice(inicio, inicio + 7));
  }
  return semanas;
}

// Primeiro e ultimo dia do mes, como "AAAA-MM-DD"
export function intervaloDoMes(mes: MesCalendario): { primeiroDia: string; ultimoDia: string } {
  return {
    primeiroDia: textoDoDia(mes.ano, mes.mes, 1),
    ultimoDia: textoDoDia(mes.ano, mes.mes, diasNoMes(mes)),
  };
}

// Anda para frente (delta positivo) ou para tras (negativo), virando o ano quando precisa
export function deslocarMes(mes: MesCalendario, delta: number): MesCalendario {
  const total = mes.ano * 12 + (mes.mes - 1) + delta;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function nomeDoMes(mes: MesCalendario): string {
  return `${NOMES_MESES[mes.mes - 1]} de ${mes.ano}`;
}

// Descobre o mes de um texto que comece com "AAAA-MM" (serve para "AAAA-MM-DD" e "AAAA-MM-DD HH:MM")
export function mesDaData(texto: string): MesCalendario {
  const encontrado = /^(\d{4})-(\d{2})/.exec(texto);
  if (encontrado === null) {
    throw new Error(`Data inválida: ${texto}`);
  }
  return { ano: Number(encontrado[1]), mes: Number(encontrado[2]) };
}

// Separa os eventos por dia (chave "AAAA-MM-DD"), em ordem de horario dentro de cada dia.
// Evento que vira a meia-noite aparece so no dia em que comeca.
export function agruparPorDia<T extends { inicio: string }>(eventos: T[]): Record<string, T[]> {
  const ordenados = [...eventos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const grupos: Record<string, T[]> = {};
  for (const evento of ordenados) {
    const dia = evento.inicio.slice(0, 10);
    (grupos[dia] ??= []).push(evento);
  }
  return grupos;
}

// "2026-10-20" -> "Terça-feira, 20/10"
export function rotuloDoDia(dia: string): string {
  const encontrado = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  if (encontrado === null) return dia;
  const [ano, mes, numero] = [Number(encontrado[1]), Number(encontrado[2]), Number(encontrado[3])];
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, numero)).getUTCDay();
  return `${NOMES_DIAS_DA_SEMANA[diaDaSemana]}, ${doisDigitos(numero)}/${doisDigitos(mes)}`;
}