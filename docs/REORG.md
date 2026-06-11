# 目录重组说明

记录本次目录结构整理的映射关系与处理方式,便于回溯。

## 一、移动映射

| 原位置 | 新位置 | 说明 |
|--------|--------|------|
| `packages/electron` | `desktop/electron` | 主进程 |
| `packages/renderer` | `desktop/frontend` | 渲染层(改名) |
| `packages/core` | `desktop/core` | 核心包 |
| `packages/release` | `desktop/release` | 产物目录 |
| `pnpm-workspace.yaml`、`pnpm-lock.yaml`、`tsconfig.base.json` | `desktop/` | 工作区根下移到 desktop |
| `App.tsx`、`src/`、`assets/`、`android/`、`app.json`、`babel.config.js`、`react-native.config.js`、`eas.json`、`dist/` | `mobile/` | Expo 应用 |
| 根 `package.json`、`package-lock.json`、`tsconfig.json` | `mobile/` | 这是移动端清单(非工作区根) |
| `cloud-server` | `services/backend` | 主云服务(先 `services/cloud-server` 后按要求改名为 backend) |
| `cloud-admin` | `services/admin` | 部署产物 |
| `cloud-landing` | `services/landing` | 部署产物 |
| `update-server` | `services/update` | 更新服务 |
| `server/`(Python) | 已删除占位副本 | 当时仅 `.pyc` 缓存;真实 FastAPI 源码后由 iCloud 恢复为 `services/python`(见第六节) |
| `skills/` | `desktop/electron/skills` | iCloud 恢复后归入 electron(extraResources) |
| 根 `scripts/` + 散落根脚本 | `infra/scripts/` | 合并 |
| `downloads/`、`downloads.js`、`robots.txt` | `services/landing/public/` | 下载中心静态资源 |
| `日志.md` | `docs/DEVLOG.md` | 开发日志 |
| `ACTIVE_TASK.md` | `docs/ACTIVE_TASK.md` | 当前任务 |

## 二、配置改动

- `desktop/pnpm-workspace.yaml`:`packages/*` → 显式列出 `electron`、`frontend`、`core`(`release` 无 package.json,不纳入)。
- `desktop/electron/scripts/build-main.mjs`:`RENDERER_SRC` 由 `../renderer/dist` 改为 `../frontend/dist`(对应 renderer→frontend 改名)。
- `infra/scripts/bump.py`:改为相对仓库根的可移植路径,目标文件更新为新布局(`mobile/*`、`desktop/*`)并支持命令行传版本号。

## 三、删除项

- **垃圾文件**:3 个语法错误产生的空文件(`{`、`k.includes('gradle')`、`{if(k.includes('cli'))console.log(k`)。
- **临时脚本**:36 个 `_` 前缀的临时脚本/日志;6 月 7 日 nginx/下载调试会话的一次性脚本(`diag*`、`dbg-*`、`fix-*`、`test-*`、`verify-*`、`final-*`、`check-*` 等);含硬编码机器路径的一次性脚本(`ba2.sh`、`fix_and_build.sh`)。
- **冗余配置**:根 `electron-builder.json`(过期副本,`desktop/electron` 内有更新更完整的版本)。
- **Python 占位**:`server/`(仅 `.pyc` 缓存)。
- **`.DS_Store`**:全项目清理(node_modules 除外)。
- **`lingjing-mobile`**:失效的 gitlink 软链文件。

## 四、保留项(未动)

- `desktop/release/win-unpacked`、各服务 `dist/` 与 `node_modules`:构建/部署产物,按要求保留。
- 大二进制(电脑端 zip、APK 等)按用户选择**保留**。
- `infra/scripts` 中面向生产/构建服务器的部署脚本:路径指向远端固定布局,保持原样。

## 五、风险提示

项目位于 iCloud 同步目录(`~/Documents`)。重组期间 iCloud 删除过一次 `git init` 创建的 `.git`,因此改用 iCloud 之外的 tarball 备份(`~/lingjing-reorg-backup-*.tar.gz`)作为安全网。后续如需版本控制,建议先把项目迁出 iCloud 路径。

## 六、iCloud 重新填充导致的二次调整

重组进行中,iCloud 把此前已驱逐(dataless 占位)的文件**异步重新下载**到了原始路径,部分内容是初次盘点时根本看不到的真实源码。已据此修正:

- **`services/python`(FastAPI 后端,~95 文件)**:初次盘点时该服务被驱逐、仅见 `.pyc` 缓存,误判为空壳。实为完整的 FastAPI 企业后端(routers/services/ai/tests)。已保留为 `services/python`(`services/backend` 已按要求给 Node 云服务)。
- **`desktop/electron/skills`**:iCloud 恢复出 `skills/`(kicad/openscad/wokwi),被 electron-builder 以 extraResources(`from: "skills"`)打包,故移入 `desktop/electron/skills`。
- **`infra/deploy`**:恢复出蓝绿/金丝雀部署编排脚本,归入 infra。
- **根 `src/` 重复**:iCloud 把旧版 `src/`(6/8 前)重新填充到根。经时间戳比对,`mobile/src`(6/11)才是最新版,根 `src/` 为陈旧副本,已删除;其中独有的 `UpdateChecker.tsx`(新版已弃用,但 dist 旧构建仍引用)已保留进 `mobile/src/components/`。

> 教训:在 iCloud 同步目录里做大规模目录操作,文件可能在操作期间凭空消失或重新出现。务必先把项目整体迁出 iCloud,再做重组与版本控制。
