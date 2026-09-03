import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxy: goi /api/* tu frontend se duoc chuyen sang backend Spring Boot,
// tranh van de CORS khi phat trien. Doi VITE_API_TARGET neu backend o may khac.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
