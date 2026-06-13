// inject-core-to-asar.mjs — Post electron-builder step
// electron-builder with pnpm detection fails to include @codepilot/core
// (workspace symlink). This script extracts the built ASAR, injects
// @codepilot/core from release/build/node_modules/, and repacks.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Read output dir from electron-builder.json
const config = JSON.parse(readFileSync(join(root, 'electron-builder.json'), 'utf8'));
const outputDir = config.directories?.output || 'release';

// Detect platform-specific unpacked dir (win/linux/mac)
const unpackedDirs = ['win-unpacked', 'linux-unpacked', 'mac-unpacked'];
let asarFile = null;
for (const dir of unpackedDirs) {
  const candidate = join(root, outputDir, dir, 'resources', 'app.asar');
  if (existsSync(candidate)) {
    asarFile = candidate;
    break;
  }
}
if (!asarFile) {
  console.error(`[inject-core] ASAR not found in ${outputDir}/*-unpacked/resources/app.asar`);
  process.exit(1);
}
const srcCore = join(root, 'release', 'build', 'node_modules', '@codepilot', 'core');
const tmpDir = join(root, outputDir, '.asar-tmp');

if (!existsSync(asarFile)) {
  console.error(`[inject-core] ASAR not found: ${asarFile}`);
  process.exit(1);
}
if (!existsSync(srcCore)) {
  console.error(`[inject-core] @codepilot/core not found at: ${srcCore}`);
  process.exit(1);
}

console.log('[inject-core] Extracting ASAR...');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
execSync(`npx asar extract "${asarFile}" "${tmpDir}"`, { stdio: 'pipe', timeout: 60000 });

const dstCore = join(tmpDir, 'node_modules', '@codepilot', 'core');
console.log(`[inject-core] Injecting @codepilot/core → ${dstCore}`);
mkdirSync(join(tmpDir, 'node_modules', '@codepilot'), { recursive: true });
if (existsSync(dstCore)) {
  rmSync(dstCore, { recursive: true, force: true });
}
cpSync(srcCore, dstCore, { recursive: true, dereference: true, force: true });

// Remove node_modules inside @codepilot/core (symlinks to pnpm store break asar pack)
const coreNm = join(dstCore, 'node_modules');
if (existsSync(coreNm)) {
  rmSync(coreNm, { recursive: true, force: true });
  console.log('[inject-core] Removed @codepilot/core/node_modules (dev deps, not needed)');
}

// Verify injection
const dstIndex = join(dstCore, 'dist', 'index.js');
if (!existsSync(dstIndex)) {
  console.error('[inject-core] ❌ Injection failed: dist/index.js not found');
  process.exit(1);
}

console.log('[inject-core] Repacking ASAR...');
execSync(`npx asar pack "${tmpDir}" "${asarFile}"`, { stdio: 'pipe', timeout: 60000 });

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });

console.log('[inject-core] ✅ @codepilot/core injected into app.asar');
