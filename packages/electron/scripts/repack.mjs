// Quick repack: extract asar, replace dist/renderer, repack, build installer
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const electronDir = join(__dirname, '..');
const unpackedDir = join(electronDir, 'release', 'win-unpacked');
const asarPath = join(unpackedDir, 'resources', 'app.asar');
const extractDir = join(electronDir, 'release', '_asar_extract');

// Step 1: Extract asar
console.log('[1/6] Extracting app.asar...');
if (!existsSync(asarPath)) {
  console.error('✗ app.asar not found at:', asarPath);
  process.exit(1);
}
if (existsSync(extractDir)) rmSync(extractDir, { recursive: true });
execSync(`npx @electron/asar extract "${asarPath}" "${extractDir}"`, { cwd: electronDir, stdio: 'pipe' });
console.log('  ✅ Extracted');

// Step 2: Replace dist files (main.js, preload.js)
console.log('[2/6] Replacing main process dist files...');
cpSync(join(electronDir, 'dist', 'main.js'), join(extractDir, 'dist', 'main.js'), { force: true });
cpSync(join(electronDir, 'dist', 'main.js.map'), join(extractDir, 'dist', 'main.js.map'), { force: true });
cpSync(join(electronDir, 'dist', 'preload.js'), join(extractDir, 'dist', 'preload.js'), { force: true });
cpSync(join(electronDir, 'dist', 'preload.js.map'), join(extractDir, 'dist', 'preload.js.map'), { force: true });
console.log('  ✅ dist updated');

// Step 3: Replace renderer files
console.log('[3/6] Replacing renderer files...');
const extractRenderer = join(extractDir, 'renderer');
const sourceRenderer = join(electronDir, 'renderer');
if (existsSync(extractRenderer)) rmSync(extractRenderer, { recursive: true });
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else cpSync(s, d);
  }
}
copyDir(sourceRenderer, extractRenderer);
console.log('  ✅ renderer updated');

// Step 4: Repack asar
console.log('[4/6] Repacking app.asar...');
const tmpAsar = join(electronDir, 'release', 'app.asar');
if (existsSync(tmpAsar)) rmSync(tmpAsar);
execSync(`npx @electron/asar pack "${extractDir}" "${tmpAsar}"`, { cwd: electronDir, stdio: 'pipe' });
cpSync(tmpAsar, asarPath, { force: true });
rmSync(tmpAsar);
rmSync(extractDir, { recursive: true });
console.log('  ✅ Repacked');

// Step 5: Build portable installer using prepackaged
console.log('[5/6] Building portable installer...');
try {
  execSync(`npx electron-builder --win portable --prepackaged "${unpackedDir}" --ia32 false`, {
    cwd: electronDir,
    stdio: 'inherit',
    timeout: 300000,
  });
} catch (e) {
  console.log('  ⚠️ electron-builder portable failed, trying without --ia32...');
  try {
    execSync(`npx electron-builder --win portable --prepackaged "${unpackedDir}"`, {
      cwd: electronDir,
      stdio: 'inherit',
      timeout: 300000,
    });
  } catch (e2) {
    console.log('  ⚠️ electron-builder also failed');
  }
}

// Step 6: Copy to root release/dist
console.log('[6/6] Copying to root release/dist...');
const rootDist = join(electronDir, '..', '..', 'release', 'dist');
const pkgDir = join(electronDir, 'release');
for (const file of readdirSync(pkgDir)) {
  if (file.endsWith('.exe') || file === 'latest.yml') {
    cpSync(join(pkgDir, file), join(rootDist, file), { force: true });
    console.log(`  ✅ ${file}`);
  }
}

console.log('\n=== ✅ REPACK COMPLETE ===');
