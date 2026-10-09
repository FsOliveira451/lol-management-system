import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Procure testes apenas na pasta tests/
    include: ["tests/**/*.test.ts"],
  },
});