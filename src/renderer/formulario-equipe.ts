import type {
  DadosEquipe,
  Equipe,
  NivelEquipe,
  StatusEquipe,
} from "../core/equipes/tipos";

// O que o formulario guarda: tudo como texto (vazio = "")
export interface ValoresFormularioEquipe {
  nome: string;
  tag: string;
  nivel: NivelEquipe;
  status: StatusEquipe;
  objetivo: string;
  observacoes: string;
}

export const FORMULARIO_EQUIPE_VAZIO: ValoresFormularioEquipe = {
  nome: "",
  tag: "",
  nivel: "principal",
  status: "em_formacao",
  objetivo: "",
  observacoes: "",
};

// Texto vazio (ou so espacos) vira null = "nao informado"
function textoOuNull(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

// Do formulario para o formato que o sistema entende
export function converterFormularioEquipe(valores: ValoresFormularioEquipe): DadosEquipe {
  return {
    nome: valores.nome.trim(),
    tag: textoOuNull(valores.tag),
    nivel: valores.nivel,
    status: valores.status,
    objetivo: textoOuNull(valores.objetivo),
    observacoes: textoOuNull(valores.observacoes),
  };
}

// O caminho inverso: de uma equipe ja cadastrada para os campos do formulario
export function valoresDaEquipe(equipe: Equipe): ValoresFormularioEquipe {
  return {
    nome: equipe.nome,
    tag: equipe.tag ?? "",
    nivel: equipe.nivel,
    status: equipe.status,
    objetivo: equipe.objetivo ?? "",
    observacoes: equipe.observacoes ?? "",
  };
}