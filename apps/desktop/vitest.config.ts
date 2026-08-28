import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
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
  optimizeDeps: {
    include: [
      "@hookform/resolvers/zod",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
      "@tanstack/react-query",
      "sonner",
      "zod",
    ],
  },
  test: {
    browser: {
      api: {
        host: "127.0.0.1",
      },
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
    silent: "passed-only",
    unstubEnvs: true,
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        "src/components/ui/**",
        "src/assets/**",
        "src/tanstack-table.d.ts",
        "src/routeTree.gen.ts",
        "src/test-utils/**",
        "src/routes/**",
      ],
    },
  },
});
