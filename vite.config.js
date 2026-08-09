import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    port: 5173,
    // En desarrollo el frontend corre en 5173 y el API en 3000.
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } },
  },
});
