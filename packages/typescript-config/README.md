# @weekly-git-report/typescript-config

Monorepo 内部共享的 TypeScript 与 tsup 配置包，不发布到 npm。

## 导出

- `@weekly-git-report/typescript-config/base.json`：Node.js TypeScript 基础配置。
- `@weekly-git-report/typescript-config/tsup`：共享 tsup 构建配置。

## TypeScript

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

## tsup

内部库包保留 workspace 依赖边界：

```ts
export { nodeLibraryConfig as default } from "@weekly-git-report/typescript-config/tsup";
```

CLI 和 MCP 等可执行发布包使用 bundled bin 配置，把内部 `@weekly-git-report/*` 依赖打入最终产物：

```ts
export { nodeBundledBinConfig as default } from "@weekly-git-report/typescript-config/tsup";
```

配置实现与公开导出以 `tsup.config.js` 和 `package.json` 为准。全仓构建方式见[开发指南](../../docs/development.md)。
