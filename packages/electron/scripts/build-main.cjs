// build-main.cjs - Build Electron main process with esbuild
// Compiles TypeScript ESM source -> bundled CJS via esbuild API
const { copyFileSync, cpSync, mkdirSync, existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');

// Find esbuild
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

// Native/binary/ESM-only modules that must stay external
const EXTERNAL = [
  'electron', 'sql.js', 'ssh2', 'cpu-features',
  'playwright', 'playwright-core', 'bcryptjs', 'node-pty',
  'fsevents', 'chokidar', 'express', 'ws',
  'electron-updater', 'fast-glob', 'adm-zip', 'pdf-parse',
  'mammoth', 'exceljs', 'uuid',
  'picocolors', 'zod', 'gpt-tokenizer',
  // @codepilot/core subpath exports (resolved at runtime via package.json exports map)
  '@codepilot/core/checkpoint',
  '@codepilot/core/rules',
  '@codepilot/core/utils',
];

// Plugin: replace ESM import.meta.url patterns with CJS equivalents
function importMetaPlugin() {
  return {
    name: 'import-meta-cjs',
    setup(build) {
      build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
        if (args.path.includes('node_modules') && !args.path.includes('@codepilot')) return null;
        let src = readFileSync(args.path, 'utf8');
        const isJs = args.path.endsWith('.js');
        let modified = false;

        // Remove fileURLToPath imports
        if (src.includes("import { fileURLToPath }")) {
          src = src.replace(/import \{ fileURLToPath \} from '(?:node:)?url';?[\r\n]+/g, '');
          modified = true;
        }
        // Remove __filename = fileURLToPath(import.meta.url)
        if (src.includes('fileURLToPath(import.meta.url)')) {
          src = src.replace(/const __filename = fileURLToPath\(import\.meta\.url\);?[\r\n]+/g, '');
          modified = true;
        }
        // Remove __dirname = dirname(__filename) 
        if (src.includes('= dirname(__filename)')) {
          src = src.replace(/const __dirname = dirname\(__filename\);?[\r\n]+/g, '');
          modified = true;
        }
        // Replace var = dirname(fileURLToPath(import.meta.url)) with var = __dirname
        if (src.includes('dirname(fileURLToPath(import.meta.url))')) {
          src = src.replace(/const (\w+) = dirname\(fileURLToPath\(import\.meta\.url\)\);?/g, 'const $1 = __dirname;');
          modified = true;
        }

        return { contents: src, loader: isJs ? 'js' : 'ts' };
      });
    },
  };
}

// Sync @codepilot/core dist from source to node_modules (prevents stale build)
const coreSrcDist = join(root, '..', 'core', 'dist');
const coreNmDist = join(root, 'node_modules', '@codepilot', 'core', 'dist');
if (existsSync(coreSrcDist)) {
  try {
    cpSync(coreSrcDist, coreNmDist, { recursive: true });
    console.log('[build-main] Synced @codepilot/core dist -> electron/node_modules');
  } catch (e) {
    console.warn('[build-main] Warning: could not sync core dist:', e.message);
  }
}

console.log('[build-main] Building...');

esbuild.build({
  entryPoints: [join(root, 'src', 'main.ts')],
  outfile: join(root, 'dist', 'main.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: EXTERNAL,
  plugins: [importMetaPlugin()],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  tsconfig: join(root, 'tsconfig.json'),
}).then(() => {
  console.log('[build-main] main.js built successfully');

  // Build preload.ts → dist/preload.js (CJS for Electron contextBridge)
  esbuild.build({
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
  }).then(() => {
    console.log('[build-main] preload.js built successfully');
  });

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
}).catch((err) => {
  console.error('[build-main] Build failed:', err);
  process.exit(1);
});
