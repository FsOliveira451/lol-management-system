// Erro para "o usuario informou algo que nao pode ser aceito".
// Carrega uma LISTA de mensagens, para a tela poder mostrar todas.
export class ErroValidacao extends Error {
  readonly erros: string[];

  constructor(erros: string[]) {
    super(erros.join(" "));
    this.name = "ErroValidacao";
    this.erros = erros;
  }
}