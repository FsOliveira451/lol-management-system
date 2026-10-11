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


// ---------- leitura segura de "pedidos" que chegam da tela ----------
// A tela pode mandar QUALQUER coisa. Estas funcoes leem cada campo com desconfianca.

// Garante que o pedido e um objeto comum (nao nulo, nao lista, nao texto)
export function lerObjeto(valor: unknown): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new ErroValidacao(["Pedido inválido."]);
  }
  return valor as Record<string, unknown>;
}

// So aceita texto; qualquer outra coisa vira "nao informado"
export function lerTexto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

// So o valor verdadeiro de verdade conta como "sim"
export function lerBooleano(valor: unknown): boolean {
  return valor === true;
}