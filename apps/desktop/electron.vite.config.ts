import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { defineConfig } from "electron-vite";
import path from "node:path";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: [
          "@weekly-git-report/core",
          "@weekly-git-report/shared",
        ],
      },
      rollupOptions: {
        input: path.resolve(__dirname, "electron/main/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: path.resolve(__dirname, "electron/preload/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
    },
  },
  renderer: {
    root: ".",
    base: "./",
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    plugins: [
      {
        name: "code-inspector-dev-csp",
        apply: "serve",
        transformIndexHtml(html) {
          return html
            .replace(
              "img-src 'self' data:;",
              "img-src 'self' data: http://127.0.0.1:*;",
            )
            .replace(
              "connect-src 'self' ws://127.0.0.1:*;",
              "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*;",
            );
        },
      },
      codeInspectorPlugin({
        bundler: "vite",
        ip: "127.0.0.1",
        lang: "zh",
        showSwitch: true,
      }),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
