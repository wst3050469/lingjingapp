// after-pack-hook.cjs — electron-builder afterPack hook
// Called AFTER ASAR is created but BEFORE NSIS/AppImage/portable installers.
//
// v1.73.59: asarUnpack fails to exclude @codepilot/core from ASAR (still present
//   in both app.asar and app.asar.unpacked). Node.js resolves from ASAR first →
//   resolveExports() path corruption in NSIS temp dir → Uncaught Exception.
//
//   FIX: Physically remove node_modules/@codepilot/ from app.asar.
//   @codepilot/core remains available in app.asar.unpacked/ (real filesystem,
//   resolveExports works correctly there).
//
//   Speed: on WSL2/Win, give generous timeout for cross-fs operations.

const { execSync } = require('node:child_process');
const { existsSync, rmSync, renameSync } = require('node:fs');
const { join } = require('node:path');

const ASAR_TIMEOUT = 300_000; // 5 min for WSL2 cross-fs slowness

exports.default = async function afterPack(context) {
  const { appOutDir } = context;
  const asarPath = join(appOutDir, 'resources', 'app.asar');
  const unpackedCoreDir = join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@codepilot', 'core');

  console.log('[afterPack] v1.73.59: Removing @codepilot/core from ASAR (keep in unpacked)');

  if (!existsSync(asarPath)) {
    console.log('[afterPack] ⚠️ app.asar not found at', asarPath, '— skipping');
    return;
  }

  // Verify unpacked copy exists (safety check)
  if (!existsSync(join(unpackedCoreDir, 'dist', 'index.js'))) {
    console.error('[afterPack] ❌ @codepilot/core NOT found in unpacked dir! Aborting ASAR modification.');
    console.error('[afterPack]   Expected:', unpackedCoreDir);
    return;
  }
  console.log('[afterPack] ✅ Unpacked @codepilot/core verified:', unpackedCoreDir);

  const tmpDir = join(appOutDir, 'resources', '.asar-tmp-extract');

  try {
    // Step 1: Extract ASAR
    console.log('[afterPack] Extracting app.asar...');
    rmSync(tmpDir, { recursive: true, force: true });
    execSync(`npx asar extract "${asarPath}" "${tmpDir}"`, {
      stdio: 'pipe',
      timeout: ASAR_TIMEOUT,
    });
    console.log('[afterPack] ✅ ASAR extracted to', tmpDir);

    // Step 2: Delete @codepilot from extracted content
    const coreInAsar = join(tmpDir, 'node_modules', '@codepilot');
    if (existsSync(coreInAsar)) {
      rmSync(coreInAsar, { recursive: true, force: true });
      console.log('[afterPack] ✅ Removed node_modules/@codepilot/ from ASAR');
    } else {
      console.log('[afterPack] ⚠️ @codepilot not in ASAR (already clean)');
    }

    // Step 3: Repack ASAR
    const tmpAsar = asarPath + '.new';
    console.log('[afterPack] Repacking app.asar...');
    execSync(`npx asar pack "${tmpDir}" "${tmpAsar}"`, {
      stdio: 'pipe',
      timeout: ASAR_TIMEOUT,
    });
    console.log('[afterPack] ✅ ASAR repacked:', tmpAsar);

    // Step 4: Replace original
    rmSync(asarPath, { force: true });
    renameSync(tmpAsar, asarPath);
    console.log('[afterPack] ✅ Original app.asar replaced (without @codepilot)');

  } catch (err) {
    console.error('[afterPack] ❌ Failed to strip @codepilot from ASAR:', err.message);
    // Non-fatal: the unpacked copy is still available, but the bug may persist
    // if Node.js resolves from inside ASAR first.
  } finally {
    // Cleanup
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { rmSync(asarPath + '.new', { force: true }); } catch {}
  }

  console.log('[afterPack] ✅ @codepilot/core: ASAR stripped, unpacked copy ready');
};
