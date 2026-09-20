import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.js";

// Dung rieng cho `npm run electron:dev`: giu nguyen moi thu nhu
// vite.config.js, chi doi cong sang 3010 de khong dam vao cong 5173 cua
// `npm run dev` (chay web thuong, vd de demo tren trinh duyet) khi ca hai
// chay cung luc. electron/main.cjs da tro san toi localhost:3010.
export default mergeConfig(
  base,
  defineConfig({
    server: {
      port: 3010,
    },
  })
);
