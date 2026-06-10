// build-main.cjs - Build Electron main process with esbuild
// Compiles TypeScript ESM source -> bundled CJS via esbuild API
const { copyFileSync, mkdirSync, existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');

// ── Find esbuild ──
let esbuild = null;
const searchPaths = [
  () => require('esbuild'),
  () => require(join(root, 'node_modules', 'esbuild')),
  () => require(join(root, '..', '..', 'node_modules', 'esbuild')),
  () => require(join(process.env.USERPROFILE || '', 'node_modules', 'esbuild')),
];
for (const fn of searchPaths) {
  try { esbuild = fn(); if (esbuild) break; } catch {}
}
if (!esbuild) {
  console.error('[build-main] esbuild not found. Please install: npm install esbuild');
  process.exit(1);
}
console.log('[build-main] esbuild version:', esbuild.version || 'unknown');

// ═══════════════════════════════════════════════════════════════
//  @codepilot/core 构建策略
// ═══════════════════════════════════════════════════════════════
// 核心问题：
//   electron/node_modules/@codepilot/core 是 pnpm symlink → ../../core
//   Windows 上 esbuild 无法正确解析 symlink 的 exports map
//   → 报错 "module './dist/index.js' was not found"
//
// 解决方案：使用 esbuild onResolve plugin 将 @codepilot/core 及其子路径
// 直接映射到 packages/core/dist/ 中的真实文件路径。
// 这样 esbuild 可以正确 bundle 这些 ESM 文件并转换为 CJS。
//
// 关于运行时：
//   @codepilot/core 的 ESM 源码被 esbuild bundle 进 main.js 并转为 CJS
//   → 运行时不再有 require(ESM) 问题
//   所有子路径（checkpoint/rules/utils 等）都通过 resolveCorePlugin
//   映射到 dist 文件后 bundle 进 main.js，无任何外部 require

const coreDist = join(root, '..', 'core', 'dist');
const EXTERNAL = [
  'electron', 'sql.js', 'ssh2', 'cpu-features',
  'playwright', 'playwright-core', 'bcryptjs', 'node-pty',
  'fsevents', 'chokidar', 'express', 'ws',
  'electron-updater', 'fast-glob', 'adm-zip', 'pdf-parse',
  'mammoth', 'exceljs', 'uuid',
  'picocolors', 'zod', 'gpt-tokenizer',
];

// ── Plugin: 解析 @codepilot/core 到真实文件路径 ──
function resolveCorePlugin() {
  return {
    name: 'resolve-codepilot-core',
    setup(build) {
      build.onResolve({ filter: /^@codepilot\/core(?:\/|$)/ }, (args) => {
        const after = args.path.slice('@codepilot/core'.length); // '' | '/mcp'
        if (!after) return { path: join(coreDist, 'index.js') };
        const sub = after.slice(1);
        const dir = join(coreDist, sub, 'index.js');
        if (existsSync(dir)) return { path: dir };
        const file = join(coreDist, sub + '.js');
        if (existsSync(file)) return { path: file };
        return { external: true }; // fallback
      });
    },
  };
}

// ── Plugin: ESM import.meta.url → CJS ──
function importMetaPlugin() {
  return {
    name: 'import-meta-cjs',
    setup(build) {
      build.onLoad({ filter: /\.(ts|js)$/ }, (args) => {
        if (args.path.includes('node_modules') && !args.path.includes('@codepilot')) return null;
        let src = readFileSync(args.path, 'utf8');
        const isJs = args.path.endsWith('.js');
        src = src
          .replace(/import \{ fileURLToPath \} from '(?:node:)?url';?[\r\n]+/g, '')
          .replace(/const __filename = fileURLToPath\(import\.meta\.url\);?[\r\n]+/g, '')
          .replace(/const __dirname = dirname\(__filename\);?[\r\n]+/g, '')
          .replace(/const (\w+) = dirname\(fileURLToPath\(import\.meta\.url\)\);?/g, 'const $1 = __dirname;');
        return { contents: src, loader: isJs ? 'js' : 'ts' };
      });
    },
  };
}

// ── 主流程 ──
async function main() {
  // 检查 core dist
  if (!existsSync(coreDist)) {
    console.error('[build-main] ERROR: @codepilot/core/dist not found at', coreDist);
    console.error('[build-main] Run "cd packages/core && npm run build" first');
    process.exit(1);
  }
  console.log('[build-main] @codepilot/core/dist:', coreDist);

  // 构建 main.js
  console.log('[build-main] Building main.js...');
  await esbuild.build({
    entryPoints: [join(root, 'src', 'main.ts')],
    outfile: join(root, 'dist', 'main.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: EXTERNAL,
    plugins: [resolveCorePlugin(), importMetaPlugin()],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
    tsconfig: join(root, 'tsconfig.json'),
  });
  console.log('[build-main] main.js built successfully');

  // 构建 preload.js
  console.log('[build-main] Building preload.js...');
  await esbuild.build({
    entryPoints: [join(root, 'src', 'preload.ts')],
    outfile: join(root, 'dist', 'preload.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
    tsconfig: join(root, 'tsconfig.preload.json'),
  });
  console.log('[build-main] preload.js built successfully');

  // Copy sql-wasm.wasm
  const wasmSrc = join(root, 'sql-wasm.wasm');
  if (existsSync(wasmSrc)) {
    const distWasm = join(root, 'dist', 'sql-wasm.wasm');
    const nestedDir = join(root, 'dist', 'node_modules', 'sql.js', 'dist');
    mkdirSync(nestedDir, { recursive: true });
    copyFileSync(wasmSrc, distWasm);
    copyFileSync(wasmSrc, join(nestedDir, 'sql-wasm.wasm'));
    console.log('[build-main] sql-wasm.wasm copied');
  }

  console.log('[build-main] All builds complete');
}

main().catch((err) => {
  console.error('[build-main] Build failed:', err);
  process.exit(1);
});
