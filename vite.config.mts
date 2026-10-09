import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // A interface vive em src/renderer
  root: "src/renderer",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});