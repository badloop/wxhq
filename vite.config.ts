import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const CONFIG_FILE = path.resolve(__dirname, "wxhq-config.json");

/** Vite plugin: serve /api/config as read/write JSON file */
function configFilePlugin(): Plugin {
  return {
    name: "config-file",
    configureServer(server) {
      server.middlewares.use("/api/config", (req, res) => {
        if (req.method === "GET") {
          if (fs.existsSync(CONFIG_FILE)) {
            res.setHeader("Content-Type", "application/json");
            res.end(fs.readFileSync(CONFIG_FILE, "utf-8"));
          } else {
            res.setHeader("Content-Type", "application/json");
            res.end("null");
          }
        } else if (req.method === "PUT") {
          let body = "";
          req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
          req.on("end", () => {
            fs.writeFileSync(CONFIG_FILE, body, "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.end('{"ok":true}');
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), configFilePlugin()],
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
