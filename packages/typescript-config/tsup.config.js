import { defineConfig } from "tsup";

const baseNodeConfig = {
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  removeNodeProtocol: false,
  sourcemap: true,
  splitting: false,
  target: "node22",
};

export const nodeLibraryConfig = defineConfig(baseNodeConfig);

export const nodeBundledBinConfig = defineConfig({
  ...baseNodeConfig,
  banner: {
    js: 'import { createRequire as __weeklyCreateRequire } from "node:module"; const require = __weeklyCreateRequire(import.meta.url);',
  },
  noExternal: [/^@weekly-git-report\//],
});
