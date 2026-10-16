import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from 'node:http';

function rootStaticFiles(): Plugin {
  return {
    name: "root-static-files",
    configureServer(server) {
      const root = path.resolve(__dirname, "..");
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/model/")) {
          const urlPath = req.url.split("?")[0];
          const filePath = path.join(root, urlPath);
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              _res.setHeader("Content-Type", "model/gltf-binary");
              _res.setHeader("Content-Length", stat.size);
              _res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
              fs.createReadStream(filePath).pipe(_res);
              return;
            }
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      const root = path.resolve(__dirname, '..');
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/model/')) return next();
        const base = path.join(root, 'model');
        const filename = path.resolve(root, '.' + req.url.split('?')[0]);
        if (!filename.startsWith(base + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.statusCode = 404; res.end(); return; }
        res.setHeader('Content-Type', 'model/gltf-binary');
        fs.createReadStream(filename).pipe(res);
      });
    },
  };
}

const gameHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

function gameAssetFiles(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith("/game-assets/")) return next();
    let pathname: string;
    try { pathname = decodeURIComponent(req.url.split("?")[0]); } catch { res.statusCode = 400; res.end(); return; }
    const base = path.resolve(__dirname, "public/game-assets");
    const filename = path.resolve(__dirname, "public", `.${pathname}`);
    if (!filename.startsWith(base + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.statusCode = 404; res.end("Game resource not found"); return;
    }
    next();
  };
  return {
    name: "game-assets-no-spa-fallback",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rootStaticFiles(), gameAssetFiles()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: gameHeaders,
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
    fs: {
      allow: [".."],
    },
  },
  preview: { headers: gameHeaders },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/three/") ||
            id.includes("\\three\\") ||
            id.includes("@react-three") ||
            id.includes("meshoptimizer")
          ) {
            return "vendor-three";
          }
          if (
            id.includes("/react/") ||
            id.includes("\\react\\") ||
            id.includes("/react-dom/") ||
            id.includes("\\react-dom\\") ||
            id.includes("react-router-dom") ||
            id.includes("zustand")
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
});
