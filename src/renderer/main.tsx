import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const elementoRaiz = document.getElementById("raiz");
if (elementoRaiz === null) {
  throw new Error("Elemento #raiz não encontrado no index.html.");
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);