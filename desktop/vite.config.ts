import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(here, "..") },
  },
  css: {
    postcss: { plugins: [tailwindcss()] },
  },
  build: {
    outDir: path.join(here, "dist"),
    emptyOutDir: true,
    target: "chrome130",
    // 桌面端从本机磁盘加载，单个脚本包不分片；体积提示阈值相应放宽
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: "127.0.0.1",
    port: 7799,
    strictPort: true,
  },
});
