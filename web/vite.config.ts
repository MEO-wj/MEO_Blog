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
