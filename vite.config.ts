import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      "/iembot-json": {
        target: "https://weather.im",
        changeOrigin: true,
        secure: true,
      },
      "/telegram-api": {
        target: "http://localhost:5010",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/telegram-api/, ""),
      },
    },
  },
});
