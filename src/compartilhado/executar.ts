import { ErroValidacao } from "../core/erros";
import type { Resultado } from "./api";

// Executa uma acao e converte o desfecho num Resultado:
// - deu certo            -> { ok: true, dados }
// - erro de validacao    -> { ok: false, erros } (mensagens amigaveis)
// - qualquer outro erro  -> mensagem generica (detalhes ficam so no log)
export function executar<T>(acao: () => T): Resultado<T> {
  try {
    return { ok: true, dados: acao() };
  } catch (erro) {
    if (erro instanceof ErroValidacao) {
      return { ok: false, erros: erro.erros };
    }
    console.error("Erro inesperado:", erro);
    return { ok: false, erros: ["Ocorreu um erro inesperado. Tente novamente."] };
  }
}