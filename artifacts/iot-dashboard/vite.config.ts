import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");

  const rawPort = env.WEB_PORT;

  if (!rawPort) {
    throw new Error(
      "WEB_PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid WEB_PORT value: "${rawPort}"`);
  }

  const basePath = env.BASE_PATH;

  if (!basePath) {
    throw new Error(
      "BASE_PATH environment variable is required but was not provided.",
    );
  }

  const apiPort = env.API_PORT ?? "8080";

  return {
    envDir: workspaceRoot,
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      proxy: {
        "/api": `http://localhost:${apiPort}`,
        "/socket.io": {
          target: `http://localhost:${apiPort}`,
          ws: true,
        },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
