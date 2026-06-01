# @weekly-git-report/eslint-config

工作区 Node.js TypeScript 包使用的共享 ESLint flat config。

## 用途

这个包只服务当前 monorepo，不发布到 npm。所有 TypeScript 包通过它共享 lint 规则，避免每个包重复配置。

## 使用

在子包的 `eslint.config.js` 中引用：

```js
import { config } from "@weekly-git-report/eslint-config/base";

export default config;
```

## 导出

- `@weekly-git-report/eslint-config/base`：Node.js + TypeScript flat config。

## 依赖关系

该包依赖 ESLint、typescript-eslint、eslint-config-prettier、eslint-plugin-turbo 和 eslint-plugin-only-warn。
