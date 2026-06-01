import { defineConfig } from "tsup";

const baseNodeConfig = {
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  splitting: false,
  target: "node18",
};

export const nodeLibraryConfig = defineConfig(baseNodeConfig);

export const nodeBundledBinConfig = defineConfig({
  ...baseNodeConfig,
  noExternal: [/^@weekly-git-report\//],
});
