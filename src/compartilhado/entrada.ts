import { ErroValidacao } from "../core/erros";

// Tudo que chega da tela e NAO CONFIAVEL. Estas funcoes "limpam" a entrada.

// Garante que o valor e um identificador valido (inteiro positivo)
export function exigirId(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor <= 0) {
       throw new ErroValidacao(["Identificador inválido."]);
  }
  return valor;
}

// Da opcoes enviadas pela tela, aproveita SOMENTE o motivo (texto).
// Qualquer outro campo, como "responsavel", e descartado.
export function extrairMotivo(opcoes: unknown): string | undefined {
  if (typeof opcoes !== "object" || opcoes === null) {
    return undefined;
  }
  const motivo = (opcoes as { motivo?: unknown }).motivo;
  return typeof motivo === "string" ? motivo : undefined;
}