import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxy: goi /api/* tu frontend se duoc chuyen sang backend Spring Boot,
// tranh van de CORS khi phat trien. Doi VITE_API_TARGET neu backend o may khac.
export default defineConfig({
  // Electron nap index.html bang file:// -> phai dung duong dan tuong doi
  // (./assets/...), neu de mac dinh "/assets/..." se tro ve goc o dia va
  // bao ERR_FILE_NOT_FOUND (trang trang). Dev server (http) khong bi anh huong.
  base: "./",
  plugins: [react()],
  // sockjs-client (dung boi lib/ws.js de ket noi WebSocket toi backend) dung
  // bien global cua Node.js, khong ton tai san trong trinh duyet -> map sang
  // globalThis de tranh loi "Uncaught ReferenceError: global is not defined".
  define: {
    global: "globalThis",
  },
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
