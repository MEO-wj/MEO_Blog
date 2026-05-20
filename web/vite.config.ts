import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

function rootStaticFiles(): Plugin {
  return {
    name: "root-static-files",
    configureServer(server) {
      const root = path.resolve(__dirname, "..");
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/model/")) {
          const filePath = path.join(root, req.url);
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              _res.setHeader("Content-Length", stat.size);
              fs.createReadStream(filePath).pipe(_res);
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rootStaticFiles()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
    fs: {
      allow: [".."],
    },
  },
});
