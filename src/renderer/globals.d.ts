import type { ApiLol } from "../compartilhado/api";

// Diz ao TypeScript que a janela do navegador tem a propriedade "api"
declare global {
  interface Window {
    api: ApiLol;
  }
}