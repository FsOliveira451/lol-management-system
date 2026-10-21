import { DURACAO_PADRAO, temAdversario } from "../core/eventos/tipos";
import type { DadosEvento, Evento, NivelAdversario, TipoEvento } from "../core/eventos/tipos";

// O que o formulario guarda: quase tudo como texto (vazio = "")
export interface ValoresFormularioEvento {
  tipo: TipoEvento;
  titulo: string;
  data: string; // "AAAA-MM-DD" (input type="date")
  hora: string; // "HH:MM" (input type="time")
  duracao: string; // vazio = usar a duracao padrao do tipo
  equipeIds: number[];
  adversario: string;
  nivelAdversario: NivelAdversario | "";
  partidas: string;
  objetivo: string;
  local: string;
  regras: string;
  observacoes: string;
}

// Formulario novo, opcionalmente ja com o dia escolhido (clique no calendario)
export function valoresIniciais(data: string = ""): ValoresFormularioEvento {
  return {
    tipo: "treino",
    titulo: "",
    data,
    hora: "19:00",
    duracao: "",
    equipeIds: [],
    adversario: "",
    nivelAdversario: "",
    partidas: "",
    objetivo: "",
    local: "",
    regras: "",
    observacoes: "",
  };
}

// Texto vazio (ou so espacos) vira null = "nao informado"
function textoOuNull(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

// Do formulario para o formato que o sistema entende
export function converterFormularioEvento(valores: ValoresFormularioEvento): DadosEvento {
  // Sem "outro lado" externo: tipo sem adversario, ou confronto interno (2 equipes nossas)
  const semAdversario = !temAdversario(valores.tipo) || valores.equipeIds.length === 2;
  const duracaoTexto = valores.duracao.trim();
  const partidasTexto = valores.partidas.trim();

  return {
    tipo: valores.tipo,
    titulo: textoOuNull(valores.titulo),
    inicio: `${valores.data.trim()} ${valores.hora.trim()}`,
    duracaoMin: duracaoTexto === "" ? DURACAO_PADRAO[valores.tipo] : Number(duracaoTexto),
    equipeIds: [...valores.equipeIds],
    adversario: semAdversario ? null : textoOuNull(valores.adversario),
    nivelAdversario:
      semAdversario || valores.nivelAdversario === "" ? null : valores.nivelAdversario,
    partidasPrevistas: semAdversario || partidasTexto === "" ? null : Number(partidasTexto),
    objetivo: textoOuNull(valores.objetivo),
    local: textoOuNull(valores.local),
    regras: textoOuNull(valores.regras),
    observacoes: textoOuNull(valores.observacoes),
  };
}

// O caminho inverso: de um evento ja cadastrado para os campos do formulario
export function valoresDoEvento(evento: Evento): ValoresFormularioEvento {
  return {
    tipo: evento.tipo,
    titulo: evento.titulo ?? "",
    data: evento.inicio.slice(0, 10),
    hora: evento.inicio.slice(11, 16),
    duracao: String(evento.duracaoMin),
    equipeIds: evento.equipes.map((equipe) => equipe.id),
    adversario: evento.adversario ?? "",
    nivelAdversario: evento.nivelAdversario ?? "",
    partidas: evento.partidasPrevistas === null ? "" : String(evento.partidasPrevistas),
    objetivo: evento.objetivo ?? "",
    local: evento.local ?? "",
    regras: evento.regras ?? "",
    observacoes: evento.observacoes ?? "",
  };
}