# Electron 模块边界安全 — ESM re-export 链导致的跨进程依赖泄露

> 创建日期: 2026-06-18 | 版本: v1.0 | 基于: v1.73.117 修复经验

---

## 1. 错误原因和表现

### 1.1 典型症状

主进程（Electron Main Process）加载 `@codepilot/core/fusion` 时报错：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'react'
    at ...
    at @codepilot/core/fusion/integration/patch-renderer.tsx
```

**关键特征**：
- 报错模块出现在**不应该被主进程加载的文件**中（如 `patch-renderer.tsx`）
- 缺失的依赖（`react`）在 Node.js 主进程中不存在，仅在 Chromium 渲染进程中可用
- 错误链追溯路径中出现了**与你实际调用毫不相关的模块**

### 1.2 标准触发模式

```
你调用:      require('@codepilot/core/fusion')
              ↓
fusion/index.ts:  export * as integration from './integration/index.js'
              ↓
integration/index.ts:  export { ... } from './patch-renderer.js'
              ↓  ← ESM 规范要求：即使只 re-export 部分符号，模块本身也必须被完整加载
patch-renderer.tsx:    import React from 'react';
              ↓
💥 ERR_MODULE_NOT_FOUND: react
```

### 1.3 根因

**ESM 的 re-export 语义是"全量加载，选择性导出"**。当 A 模块 re-export B 模块的任何符号时，B 模块及其**所有依赖（包括间接依赖）都会被递归加载和求值**。这与 `export *` 还是 `export { X }` 无关——只要涉及 re-export，目标模块就会被完整解析。

在 Electron 桌面应用中，`@codepilot/core` 是一个**跨进程共享包**——它同时被主进程（Node.js 运行时）和渲染进程（Chromium 运行时）加载。但**主进程中没有 `react` 包**（react 只安装在渲染进程的 node_modules 中）。

因此，任何**被主进程加载的模块图**中如果混入了导入 `react` 的文件，就会触发 `ERR_MODULE_NOT_FOUND`。

---

## 2. 正确做法和关键步骤

### 2.1 修复流程（三步法）

#### 步骤 1：追踪完整调用链

从报错栈出发，反向追踪 re-export 链，找到"肇事者"——即哪个 re-export 导致了不该被加载的模块进入模块图。

```bash
# 示例：从报错信息追踪
# ERR_MODULE_NOT_FOUND: react
#   at patch-renderer.tsx
#   → 被 integration/index.ts re-export
#   → 被 fusion/index.ts re-export (export * as integration)
#   → 被 electron/main.ts 加载
```

#### 步骤 2：切断 re-export 链

从**最靠近问题模块的 re-export 点**切断：

```typescript
// ❌ 修复前 — integration/index.ts
export { patchRendererUI } from './patch-renderer.js';   // 触发加载 react
export type { SidebarPanelDef } from './patch-renderer.js'; // 类型也触发加载!

// ✅ 修复后 — 完全移除 patch-renderer 的 re-export
// NOTE: patch-renderer.tsx is excluded — imports 'react' which crashes Electron main process
```

**重要**：`export type` 虽然编译后会被擦除，但 TypeScript 编译器仍会解析被引用的模块，在模块加载阶段同样会触发依赖解析。在 `tsc` 输出的 ESM 中，`export type { T }` 通常被省略，但某些构建配置下可能保留为运行时的 re-export。**安全做法：一律移除**。

#### 步骤 3：补偿下游引用

切断 re-export 后，下游可能有代码依赖被移除的导出符号。需要补偿：

```typescript
// ✅ fusion/index.ts — 补偿 getMigration003SQL/004SQL 的直接导出
// 原来通过 integration/index.ts → patch-database.ts 的 re-export 链
// 现在直接从这里导出，绕过 integration 的 re-export 风险
export {
  getMigration003SQL,
  getMigration004SQL,
} from './integration/patch-database.js';
```

### 2.2 验证方法

```bash
# 1. 确保 tsc 编译通过
tsc --project packages/core/tsconfig.json

# 2. 在编译产物中确认问题模块不在模块图中
grep -r "patch-renderer" packages/core/dist/fusion/
# 应该只在注释中出现，不能在任何 import/export 语句中出现

# 3. 在 Electron 主进程中测试加载
node -e "require('@codepilot/core/fusion')"
# 不应报 ERR_MODULE_NOT_FOUND
```

### 2.3 架构设计原则

**跨进程共享包的分层策略**：

| 层次 | 允许的依赖 | 主进程 | 渲染进程 |
|------|-----------|--------|---------|
| 纯数据/Types | TypeScript 类型定义 | ✅ | ✅ |
| 纯逻辑 | Node.js built-ins / 无第三方依赖 | ✅ | ✅ |
| 渲染专用 | React, DOM API, CSS | ❌ | ✅ |
| Electron 专用 | electron 模块 | ❌ (preload 外) | ❌ (preload 外) |

---

## 3. 明确禁止事项

### 🔴 禁止 1：在跨进程共享包中 re-export 含渲染进程依赖的文件

```typescript
// ❌ 禁止 — 任何形式
export * from './renderer-only-module.js';       // export * 
export { Foo } from './renderer-only-module.js';  // 命名 re-export
export type { Bar } from './renderer-only-module.js'; // 类型 re-export（构建后可能保留）

// ✅ 允许 — 仅当目标模块的依赖在主进程中也存在
export { pureLogic } from './pure-logic.js';  // pure-logic.js 的依赖主进程中有
```

### 🔴 禁止 2：在 re-export 链中引入渲染专用包

以下包**绝不能出现在主进程可加载的模块图中**：
- `react` / `react-dom` / `react-dom/client`
- 任何 `.tsx` 文件（JSX 语法暗示 React 依赖）
- CSS 模块 (`import './styles.css'`)
- DOM API 调用 (`document.*`, `window.*`)

### 🔴 禁止 3：使用 `export *` 从"聚合模块"整体重导出

```typescript
// ❌ 禁止 — 聚合出口会拉入所有子模块的依赖
export * as integration from './integration/index.js';

// ✅ 正确 — 显式列出每个需要导出的符号，源文件可控
export { safeFunctionA } from './safe-module-a.js';
export { safeFunctionB } from './safe-module-b.js';
```

### 🟡 注意事项

1. **`export type` 不一定安全**：虽然 TypeScript 编译后通常擦除 `export type`，但依赖于编译目标和模块格式。在 `tsconfig` 使用 `"module": "ESNext"` + `"isolatedModules": true` 时，`export type` 可能被保留为运行时 re-export。**原则：不确定时，宁可移除。**

2. **新增文件前的检查清单**：
   - [ ] 这个文件会被主进程加载吗？（检查 `fusion/index.ts` 的 re-export 链）
   - [ ] 这个文件的依赖在主进程中存在吗？（检查 `import` 语句的每个第三方包）
   - [ ] 如果依赖了渲染进程专属包，它是否在独立的入口文件中，不会被主进程间接触及？

3. **测试要点**：
   - 主进程启动不报 `ERR_MODULE_NOT_FOUND`
   - 渲染进程功能正常（被移除的 re-export 符号通过其他路径可用）
   - `tsc` 编译零新增错误

---

## 4. 快速诊断清单

当遇到 `ERR_MODULE_NOT_FOUND` 在主进程中报错时：

1. **确认模块归属**：报错的文件是否应该是渲染进程专属？
2. **追溯调用链**：谁 re-export 了它？哪个入口点触发了加载？
3. **切断链条**：在最近的 re-export 点移除引用
4. **补偿下游**：如果下游需要被移除的符号，通过安全的直接导出来提供
5. **验证**：tsc + 运行时加载测试 + grep 确认产物干净

---

## 相关修复记录

| 版本 | 问题 | 根因 | 修复方式 |
|------|------|------|---------|
| v1.73.117 | ERR_MODULE_NOT_FOUND(react) | `fusion/index.ts` → `integration/index.ts` → `patch-renderer.tsx` re-export 链 | 移除 patch-renderer re-export + 补偿直接导出 |
| v1.73.105 | @codepilot/core not loaded | dist/index.js re-export 了 15+ 个缺失文件 | dist 自包含化（零文件导入） |
