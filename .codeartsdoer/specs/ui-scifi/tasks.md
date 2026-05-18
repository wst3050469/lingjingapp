# SciFi UI 科技感美化 - 实施任务清单

> 修改范围仅限：`global.css`、`tailwind.config.js`、`themes.ts`、`ThemeContext.tsx`
> 不修改组件 TSX 逻辑，不包含打包部署任务

---

## 批次1：基础设施（P0）

### 1. T-UI01: CSS变量体系扩展

- [ ] 在 `global.css` 中新增 `[data-theme="scifi-dark"]` 作用域，定义全部 `--scifi-*` 变量
- [ ] 定义深空背景三级色阶：`--scifi-bg-base: #0a0e1a`、`--scifi-bg-surface: #0f1525`、`--scifi-bg-elevated: #1a1f2e`
- [ ] 定义双Accent色：`--scifi-accent-primary: #00d4ff`、`--scifi-accent-secondary: #a855f7`
- [ ] 定义RGB分量变量：`--scifi-accent-primary-rgb: 0, 212, 255`、`--scifi-accent-secondary-rgb: 168, 85, 247`（用于rgba计算）
- [ ] 定义霓虹语义色：`--scifi-neon-green: #22c55e`、`--scifi-neon-red: #ef4444`、`--scifi-neon-amber: #f59e0b`
- [ ] 定义发光色token（30%透明度）：`--scifi-glow-primary`、`--scifi-glow-secondary`、`--scifi-glow-error`、`--scifi-glow-success`
- [ ] 定义玻璃拟态token：`--scifi-glass-bg: rgba(10,14,26,0.75)`、`--scifi-glass-border: rgba(0,212,255,0.1)`、`--scifi-glass-blur: 16px`
- [ ] 定义发光阴影token：`--scifi-glow-sm/md/lg` 和 `--scifi-shadow-neon-blue-sm/md/lg`、`--scifi-shadow-neon-purple-sm/md`
- [ ] 定义背景渐变token：`--scifi-bg-gradient`、`--scifi-bg-start`、`--scifi-bg-end`
- [ ] 定义圆角与间距token：`--scifi-radius-sm/md/lg`、`--scifi-indicator-width: 3px`、`--scifi-tab-indicator-height: 2px`
- [ ] 在同一作用域内覆盖 `--cp-*` 变量（bg/sidebar/editor/panel/border/accent/text等），实现级联替换

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~80行 |
| 依赖任务 | 无 |

---

### 2. T-UI02: Tailwind配置扩展

- [ ] 在 `tailwind.config.js` 的 `theme.extend.colors` 中新增 `scifi-bg-base/surface/elevated` 颜色（引用CSS变量，带fallback）
- [ ] 新增 `scifi-accent-primary` 色阶（50-900，DEFAULT引用CSS变量）
- [ ] 新增 `scifi-accent-secondary` 色阶（50-900，DEFAULT引用CSS变量）
- [ ] 新增 `scifi-neon-green/red/amber`、`scifi-glass-bg/border` 颜色
- [ ] 在 `theme.extend.boxShadow` 中新增 `neon-sm/md/lg`（电光蓝发光）和 `neon-purple/neon-purple-sm`（量子紫发光），添加JSDoc注释
- [ ] 在 `theme.extend.animation` 中新增 `pulse-neon`（2s周期）、`glow-border`（3s周期）、`breathe`（2s周期）、`slide-up-fade`（200ms单次），添加JSDoc注释
- [ ] 在 `theme.extend.keyframes` 中新增 `pulseNeon`、`glowBorder`、`breathe`、`slideUpFade` 关键帧定义
- [ ] 在 `theme.extend.backdropFilter` 中新增 `glass: 'blur(16px)'`，添加JSDoc注释

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/tailwind.config.js` |
| 预估行数 | ~70行 |
| 依赖任务 | T-UI01 |

---

### 3. T-UI03: 主题定义扩展

- [ ] 在 `themes.ts` 中新增 `scifiDarkTheme` 对象，name为 `'scifi-dark'`，type为 `'dark'`
- [ ] 填充 colors 字段：background=#0a0e1a、backgroundSecondary=#0f1525、backgroundTertiary=#1a1f2e、surface=#0f1525、surfaceHover=#141b2d、surfaceActive=#1a2238
- [ ] 填充 border/borderFocus/text/textSecondary/textTertiary/textInverse/primary/primaryHover/primaryActive/success/error/warning/info
- [ ] 将 `scifiDarkTheme` 注册到 `themes` 对象：`'scifi-dark': scifiDarkTheme`
- [ ] 扩展 `ThemeName` 类型自动推导为 `'dark' \| 'light' \| 'scifi-dark'`
- [ ] 在 `index.ts` 中新增 `neonBlue`、`neonPurple`（50-900色阶常量）、`scifiBg`（base/surface/elevated）、`scifiSemantic`（green/red/amber）常量导出

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/src/design-tokens/themes.ts`、`packages/renderer/src/design-tokens/index.ts` |
| 预估行数 | ~60行 |
| 依赖任务 | T-UI01 |

---

### 4. T-UI04: ThemeContext集成

- [ ] 在 `ThemeContext.tsx` 的 `useEffect` 中增加 `themeName === 'scifi-dark'` 分支判断
- [ ] scifi-dark 分支：`root.classList.add('dark')`、`root.classList.remove('light')`、`root.setAttribute('data-theme', 'scifi-dark')`
- [ ] dark 分支补充：`root.removeAttribute('data-theme')`（确保切换回普通dark时清除scifi作用域）
- [ ] light 分支补充：`root.removeAttribute('data-theme')`
- [ ] 在 cpVars 计算逻辑中增加 `themeName === 'scifi-dark'` 分支，映射全部cp-*变量到SciFi色值
- [ ] 确保主题切换时 `data-theme` 属性正确设置/移除，scifi-dark→dark→light 切换无残留

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/src/contexts/ThemeContext.tsx` |
| 预估行数 | ~30行 |
| 依赖任务 | T-UI03 |

---

### 5. T-UI05: 全局动画关键帧

- [ ] 在 `global.css` 中新增 `@keyframes pulse-neon`：0%/100% box-shadow为8px rgba(0,212,255,0.3)，50%为16px rgba(0,212,255,0.6)
- [ ] 新增 `@keyframes glow-border`：0%/100% border-color rgba(0,212,255,0.3)，50% rgba(0,212,255,0.6)
- [ ] 新增 `@keyframes breathe`：0%/100% opacity 0.6，50% opacity 1
- [ ] 新增 `@keyframes slide-up-fade`：0% opacity 0 + translateY(8px)，100% opacity 1 + translateY(0)
- [ ] 新增 `@keyframes pulse-neon-once`（单次脉冲，200ms，forwards）：0% box-shadow 8px，50% 16px，100% 8px
- [ ] 新增 `@media (prefers-reduced-motion: reduce)` 规则，禁用所有scifi动画（animation: none），保留静态发光色

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~40行 |
| 依赖任务 | T-UI01 |

---

### 6. T-UI06: 玻璃拟态基础类

- [ ] 在 `global.css` 新增 `.glass-panel` 工具类：`background: rgba(10,14,26,0.75)`、`-webkit-backdrop-filter: blur(16px)`、`backdrop-filter: blur(16px)`、`border: 1px solid rgba(0,212,255,0.1)`、`box-shadow: 0 0 12px rgba(0,212,255,0.15)`
- [ ] 新增 `.glass-card` 工具类：`background: rgba(10,14,26,0.6)`、`-webkit-backdrop-filter: blur(12px)`、`backdrop-filter: blur(12px)`、`border: 1px solid rgba(0,212,255,0.08)`
- [ ] 新增 `.glass-input` 工具类：默认态 `border: 1px solid #1e293b; transition: all 150ms ease`，focus态 `border-color: #00d4ff; box-shadow: 0 0 8px rgba(0,212,255,0.3); outline: none`
- [ ] 所有玻璃拟态类需包裹在 `[data-theme="scifi-dark"]` 选择器内
- [ ] 为不支持 backdrop-filter 的浏览器提供 fallback：`@supports not (backdrop-filter: blur(1px))` 回退为纯半透明背景色

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~35行 |
| 依赖任务 | T-UI01, T-UI05 |

---

### 7. T-UI-SCROLLBAR: SciFi滚动条样式

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] ::-webkit-scrollbar-track`：`background: rgba(10,14,26,0.5)`
- [ ] 新增 `[data-theme="scifi-dark"] ::-webkit-scrollbar-thumb`：`background: rgba(0,212,255,0.15); border-radius: 4px`
- [ ] 新增 `[data-theme="scifi-dark"] ::-webkit-scrollbar-thumb:hover`：`background: rgba(0,212,255,0.3)`

| 属性 | 值 |
|------|-----|
| 优先级 | P0 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~10行 |
| 依赖任务 | T-UI01 |

---

## 批次2：组件美化（P1）

### 8. T-UI07: ChatModeSelector美化

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] .scifi-chat-mode-selector` 容器样式：微蓝背景 rgba(0,212,255,0.03) + 微蓝边框 rgba(0,212,255,0.08) + border-radius: 8px
- [ ] 新增 `.scifi-chat-mode-item--active` 选中态：背景 rgba(0,212,255,0.2) + 边框 rgba(0,212,255,0.6) + box-shadow 0 0 8px rgba(0,212,255,0.4) + 文字 #00d4ff + border-radius: 6px + transition 150ms
- [ ] 新增 `.scifi-chat-mode-item` 未选中态：边框 #1e293b + border-radius: 6px + transition 150ms
- [ ] 新增 `.scifi-chat-mode-item:hover` hover态：边框渐变 rgba(0,212,255,0.3) + 微发光 box-shadow 0 0 4px rgba(0,212,255,0.2)
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~25行 |
| 依赖任务 | T-UI01, T-UI02 |

---

### 9. T-UI08: ModelSelector美化

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] .scifi-model-dropdown` 玻璃拟态面板：rgba(10,14,26,0.75) + backdrop-filter: blur(16px) + -webkit-前缀 + 边框 rgba(0,212,255,0.1) + box-shadow 0 0 12px rgba(0,212,255,0.15)
- [ ] 新增 `.scifi-model-item--active` 选中模型项：左侧 3px #00d4ff 竖条 + 文字 #00d4ff + 背景 rgba(0,212,255,0.05)
- [ ] 新增 `.scifi-model-item:hover` hover模型项：左侧 3px #a855f7 竖条 + 背景 rgba(168,85,247,0.05)
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~20行 |
| 依赖任务 | T-UI01, T-UI06 |

---

### 10. T-UI09: ContextSelector美化

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] .scifi-context-panel` 弹出面板玻璃拟态：rgba(10,14,26,0.8) + backdrop-filter: blur(16px) + -webkit-前缀 + 边框 rgba(0,212,255,0.1) + box-shadow 0 0 12px rgba(0,212,255,0.15) + animation: slideUpFade 200ms
- [ ] 新增 `.scifi-context-tab--active` 选中Tab：文字 #00d4ff + 底部 2px #00d4ff 指示器 + box-shadow 0 2px 8px rgba(0,212,255,0.3) 发光
- [ ] 新增 `.scifi-context-search` 搜索框默认态：border 1px solid #1e293b + transition 150ms
- [ ] 新增 `.scifi-context-search:focus` 搜索框焦点态：border-color #00d4ff + box-shadow 0 0 8px rgba(0,212,255,0.3)
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~25行 |
| 依赖任务 | T-UI01, T-UI05, T-UI06 |

---

### 11. T-UI10: ActivityBar美化

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] .scifi-activity-bar` 容器：背景渐变 linear-gradient(180deg, #0a0e1a, #0f1320) + 右边框 rgba(0,212,255,0.08)
- [ ] 新增 `.scifi-activity-item--active` 选中图标：颜色 #00d4ff + animation: pulseNeon 2s ease-in-out infinite
- [ ] 新增 `.scifi-activity-indicator` 选中指示器：背景 #00d4ff + box-shadow 0 0 8px rgba(0,212,255,0.4)
- [ ] 新增 `.scifi-activity-item:hover` hover态：颜色 #a855f7 + filter: drop-shadow(0 0 4px rgba(168,85,247,0.3))
- [ ] 新增 `@media (prefers-reduced-motion: reduce)` 下的 `.scifi-activity-item--active`：animation: none + 静态 box-shadow
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~25行 |
| 依赖任务 | T-UI01, T-UI05 |

---

### 12. T-UI11: SettingsPanel美化

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] .scifi-settings-nav` 导航区：背景渐变 linear-gradient(180deg, #0a0e1a, #0f1320) + 右边框 rgba(0,212,255,0.08)
- [ ] 新增 `.scifi-settings-nav-item--active` 选中导航项：左侧 3px #00d4ff 竖条 + 背景 rgba(0,212,255,0.05) + 文字 #00d4ff + inset发光 box-shadow
- [ ] 新增 `.scifi-settings-nav-item:hover` hover导航项：背景 rgba(0,212,255,0.05) + 左侧微紫竖条 rgba(168,85,247,0.3)
- [ ] 新增 `.scifi-settings-card` 内容区玻璃卡片：rgba(10,14,26,0.6) + backdrop-filter: blur(12px) + -webkit-前缀 + 边框 rgba(0,212,255,0.08)
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~25行 |
| 依赖任务 | T-UI01, T-UI06 |

---

### 13. T-UI12: 通用交互增强

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"]` 下通用 hover 霓虹光效：可选项 hover 时背景 rgba(0,212,255,0.06) + 边框色向accent渐变 + transition 150ms
- [ ] 新增选中脉冲：选中项首次触发 `pulse-neon-once` 动画（scale 1→1.02→1，200ms，forwards）
- [ ] 新增焦点发光环：键盘焦点时 outline 2px solid #00d4ff + box-shadow 发光
- [ ] 统一过渡规则：所有交互状态变化 transition: background-color, border-color, box-shadow, transform 150ms ease
- [ ] 禁止在 transition 中使用引起 reflow 的属性（width/height/padding）
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~25行 |
| 依赖任务 | T-UI01, T-UI05 |

---

### 14. T-UI13: 基础UI组件升级

- [ ] 在 `global.css` 新增 Button scifi-neon variant 样式覆盖：默认态 border #00d4ff + text #00d4ff + bg rgba(0,212,255,0.1) + shadow neon-sm + radius 6px；hover态 shadow neon-md + bg rgba(0,212,255,0.2)；transition 150ms
- [ ] 新增 Card 玻璃拟态样式覆盖：bg rgba(10,14,26,0.6) + backdrop-filter blur(12px) + -webkit-前缀 + border rgba(0,212,255,0.08) + radius 12px
- [ ] 新增 Input 发光边框样式覆盖：默认态 border #1e293b + bg transparent + transition 150ms；focus态 border #00d4ff + shadow neon-sm + outline none
- [ ] 新增 Modal 玻璃拟态样式覆盖：遮罩 bg rgba(0,0,0,0.6)；内容面板 bg rgba(10,14,26,0.85) + backdrop-filter blur(20px) + border rgba(0,212,255,0.1) + shadow neon-lg
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~35行 |
| 依赖任务 | T-UI01, T-UI06 |

---

### 15. T-UI14: 视觉元素丰富化

- [ ] 在 `global.css` 新增 `[data-theme="scifi-dark"] .scifi-bg-grid` 背景网格线：background-image 双向 linear-gradient rgba(0,212,255,0.03) 1px + background-size 40px 40px，z-index低于内容层
- [ ] 新增 `.scifi-glow-divider` 渐变发光分割线：height 1px + background linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)
- [ ] 新增 `.scifi-status-light` 状态指示灯呼吸动画：animation breathe 2s ease-in-out infinite
- [ ] 新增 `.scifi-icon-glow:hover` 图标hover发光：filter drop-shadow(0 0 4px rgba(0,212,255,0.5))
- [ ] 新增 `@media (prefers-reduced-motion: reduce)` 下 `.scifi-status-light`：animation: none + 静态 opacity
- [ ] 所有规则包裹在 `[data-theme="scifi-dark"]` 选择器内

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | `packages/renderer/src/styles/global.css` |
| 预估行数 | ~25行 |
| 依赖任务 | T-UI01, T-UI05 |

---

### 16. T-UI-VALIDATE: 验证与回归测试

- [ ] 验证切换到 scifi-dark 主题后，深空渐变背景、霓虹accent色、玻璃拟态效果正常呈现
- [ ] 验证切换回 dark/light 主题后，所有 scifi-* 样式完全消失，界面恢复原样
- [ ] 验证 `prefers-reduced-motion: reduce` 下脉冲和呼吸动画被禁用，保留静态发光色
- [ ] 验证不支持 backdrop-filter 的浏览器环境下，玻璃拟态回退为半透明纯色背景
- [ ] 验证所有新增CSS类均以 `scifi-` 前缀命名，CSS变量均以 `--scifi-` 前缀命名
- [ ] 验证无 `!important` 滥用（除必要的主题覆盖场景）
- [ ] 验证组件TSX文件无逻辑变更（git diff 无 .tsx 文件变更，除 ThemeContext.tsx 主题名扩展）
- [ ] 验证霓虹发光动画帧率不低于30fps（Chrome DevTools Performance面板）
- [ ] 验证首屏渲染时间增加不超过50ms

| 属性 | 值 |
|------|-----|
| 优先级 | P1 |
| 涉及文件 | 全部涉及文件 |
| 预估行数 | 0（验证任务） |
| 依赖任务 | T-UI01 ~ T-UI14 |
