// after-pack-hook.cjs — electron-builder afterPack hook
// Called AFTER ASAR is created but BEFORE NSIS/AppImage/portable installers are built.
// Inject @codepilot/core (pnpm workspace symlink) into app.asar so it's
// available at runtime for all distribution formats.
const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { execSync } = require('node:child_process');

/**
 * electron-builder afterPack hook
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const asarFile = join(appOutDir, 'resources', 'app.asar');

  if (!existsSync(asarFile)) {
    console.log('[afterPack] No app.asar found at', asarFile, '- skipping injection');
    return;
  }

  // Find @codepilot/core in release/build/node_modules (placed by build-main.mjs)
  const electronRoot = join(__dirname, '..');
  const srcCore = join(electronRoot, 'release', 'build', 'node_modules', '@codepilot', 'core');

  if (!existsSync(join(srcCore, 'dist', 'index.js'))) {
    console.error('[afterPack] ⚠️ @codepilot/core not found at', srcCore);
    return;
  }

  const tmpDir = join(appOutDir, '.asar-tmp-inject');

  console.log('[afterPack] Injecting @codepilot/core into ASAR (before installer build)...');

  try {
    // Extract
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    execSync(`npx asar extract "${asarFile}" "${tmpDir}"`, { stdio: 'pipe', timeout: 60000 });

    // Inject
    const dstCore = join(tmpDir, 'node_modules', '@codepilot', 'core');
    mkdirSync(join(tmpDir, 'node_modules', '@codepilot'), { recursive: true });
    if (existsSync(dstCore)) rmSync(dstCore, { recursive: true, force: true });
    cpSync(srcCore, dstCore, { recursive: true, dereference: true, force: true });

    // Clean dev deps
    const coreNm = join(dstCore, 'node_modules');
    if (existsSync(coreNm)) rmSync(coreNm, { recursive: true, force: true });

    // Repack
    execSync(`npx asar pack "${tmpDir}" "${asarFile}"`, { stdio: 'pipe', timeout: 60000 });

    console.log('[afterPack] ✅ @codepilot/core injected into app.asar');
  } catch (err) {
    console.error('[afterPack] ❌ Injection failed:', err.message);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
};
