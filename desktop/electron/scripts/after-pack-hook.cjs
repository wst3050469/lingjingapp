module.exports = async function(ctx) {
  const { join } = require('path');
  const { existsSync, rmSync, renameSync } = require('fs');
  const { execSync } = require('child_process');
  const asarPath = join(ctx.appOutDir, 'resources', 'app.asar');
  const unpackedDir = join(ctx.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@codepilot', 'core');
  console.log('[afterPack] Stripping @codepilot/core from ASAR');
  if (!existsSync(asarPath)) { console.log('[afterPack] ASAR not found'); return; }
  if (!existsSync(join(unpackedDir, 'dist', 'index.js'))) {
    console.error('[afterPack] CRITICAL: @codepilot NOT in unpacked'); return;
  }
  console.log('[afterPack] Unpacked @codepilot verified');
  const tmpDir = join(ctx.appOutDir, 'resources', '.asar-tmp');
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    execSync('npx asar extract "' + asarPath + '" "' + tmpDir + '"', { stdio: 'pipe', timeout: 300000 });
    const cpDir = join(tmpDir, 'node_modules', '@codepilot');
    if (existsSync(cpDir)) rmSync(cpDir, { recursive: true, force: true });
    const newAsar = asarPath + '.new';
    execSync('npx asar pack "' + tmpDir + '" "' + newAsar + '"', { stdio: 'pipe', timeout: 300000 });
    rmSync(asarPath); renameSync(newAsar, asarPath);
    console.log('[afterPack] Success: @codepilot removed from ASAR');
  } catch(e) {
    console.error('[afterPack] Failed:', e.message);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { rmSync(asarPath + '.new'); } catch {}
  }
};

