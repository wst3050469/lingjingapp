// afterPack hook for v1.73.60 - strips @codepilot from ASAR
const { execSync } = require('node:child_process');
const { existsSync, rmSync, renameSync } = require('node:fs');
const { join } = require('node:path');

module.exports = async function(context) {
  const { appOutDir } = context;
  const asarPath = join(appOutDir, 'resources', 'app.asar');
  const unpackedCoreDir = join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@codepilot', 'core');

  console.log('[afterPack] v1.73.60: Stripping @codepilot/core from ASAR');

  if (!existsSync(asarPath)) {
    console.log('[afterPack] WARNING app.asar not found - skipping');
    return;
  }

  if (!existsSync(join(unpackedCoreDir, 'dist', 'index.js'))) {
    console.error('[afterPack] ERROR @codepilot/core NOT in unpacked dir!');
    return;
  }
  console.log('[afterPack] Unpacked @codepilot/core verified');

  const tmpDir = join(appOutDir, 'resources', '.asar-tmp-extract');
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    execSync('npx asar extract "' + asarPath + '" "' + tmpDir + '"', { stdio: 'pipe', timeout: 300000 });
    console.log('[afterPack] ASAR extracted');

    const coreInAsar = join(tmpDir, 'node_modules', '@codepilot');
    if (existsSync(coreInAsar)) {
      rmSync(coreInAsar, { recursive: true, force: true });
      console.log('[afterPack] Removed @codepilot from ASAR');
    } else {
      console.log('[afterPack] @codepilot not in ASAR (already clean)');
    }

    const tmpAsar = asarPath + '.new';
    execSync('npx asar pack "' + tmpDir + '" "' + tmpAsar + '"', { stdio: 'pipe', timeout: 300000 });
    rmSync(asarPath, { force: true });
    renameSync(tmpAsar, asarPath);
    console.log('[afterPack] ASAR replaced (without @codepilot)');
  } catch (err) {
    console.error('[afterPack] Failed:', err.message);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { rmSync(asarPath + '.new', { force: true }); } catch {}
  }

  console.log('[afterPack] @codepilot/core: ASAR stripped, unpacked copy ready');
};
