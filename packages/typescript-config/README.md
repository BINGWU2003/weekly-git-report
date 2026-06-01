# @weekly-git-report/typescript-config

内部 TypeScript 和 tsup 配置包，为 monorepo 子包提供统一基础配置。

## 发布状态

不发布到 npm。只在当前 workspace 内使用。

## 导出

- `@weekly-git-report/typescript-config/base.json`：Node.js TypeScript 基础配置。
- `@weekly-git-report/typescript-config/nextjs.json`：保留的 Next.js 配置模板。
- `@weekly-git-report/typescript-config/react-library.json`：保留的 React library 配置模板。
- `@weekly-git-report/typescript-config/tsup`：共享 tsup 配置。

## 使用

子包 `tsconfig.json`：

```json
{
  "extends": "@weekly-git-report/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

子包 `tsup.config.ts`：

```ts
export { nodeLibraryConfig as default } from "@weekly-git-report/typescript-config/tsup";
```

bin 包使用：

```ts
export { nodeBundledBinConfig as default } from "@weekly-git-report/typescript-config/tsup";
```

## 配置说明

- library 包使用 `nodeLibraryConfig`，保留 workspace 依赖边界。
- bin 包使用 `nodeBundledBinConfig`，会把 `@weekly-git-report/*` 内部包打包进最终产物。
