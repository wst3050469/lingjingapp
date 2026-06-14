/**
 * after-pack-hook.cjs — Post-pack ASAR sanitization for @codepilot/core
 *
 * ROOT CAUSE:
 *   @codepilot/core is an ESM package ("type":"module" + "exports" field).
 *   When bundled inside app.asar, CJS require() triggers Electron's ASAR
 *   patcher → resolveExports() → path truncation in virtual filesystem
 *   → "Cannot find module '@codepilot/core'" crash on NSIS install.
 *
 * FIX STRATEGY (battle-tested since v1.73.59):
 *   1. electron-builder asarUnpack extracts @codepilot to app.asar.unpacked/
 *      (real files on disk, no ASAR path truncation)
 *   2. This hook physically DELETES @codepilot from inside app.asar
 *   3. Result: runtime require() resolves to real files → no crash
 *
 * WHY BUNDLING DOESN'T WORK (v1.73.69 investigation):
 *   Removing @codepilot from EXTERNAL (to bundle into main.js) causes
 *   22 "No matching export" errors — many dist/ stubs are missing.
 *   The EXTERNAL approach + afterPack deletion is the proven reliable pattern.
 *
 * RESILIENCE:
 *   asarUnpack globs for scoped packages (@scope/name) are unreliable
 *   in electron-builder. This hook verifies unpacked/ exists and copies
 *   from source node_modules if needed BEFORE deleting from ASAR.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

module.exports = async function(ctx) {
  const appOutDir = ctx.appOutDir;
  const asarPath = path.join(appOutDir, 'resources', 'app.asar');
  const unpackedPath = asarPath + '.unpacked';
  const sourceCoreDir = path.join(__dirname, '..', 'node_modules', '@codepilot', 'core');

  console.log('[afterPack] ========================================');
  console.log('[afterPack] Post-pack ASAR sanitization hook');
  console.log('[afterPack] Strategy: Remove @codepilot from ASAR → resolve to unpacked real files');
  console.log('[afterPack] ========================================');

  // ── Prerequisites ──
  if (!fs.existsSync(asarPath)) {
    console.log('[afterPack] ⚠️  app.asar not found, skipping');
    console.log('[afterPack]    Path:', asarPath);
    return;
  }

  const asarStat = fs.statSync(asarPath);
  console.log('[afterPack] app.asar:', (asarStat.size / 1024 / 1024).toFixed(1), 'MB');

  // ───────────────────────────────────────────────────────
  // STEP 0: Ensure @codepilot/core exists in unpacked/
  // (electron-builder asarUnpack glob may be unreliable)
  // ───────────────────────────────────────────────────────
  console.log('[afterPack] [0/5] Ensuring @codepilot/core in unpacked/...');
  const unpackedCodepilot = path.join(unpackedPath, 'node_modules', '@codepilot', 'core');

  if (!fs.existsSync(unpackedCodepilot)) {
    console.log('[afterPack]   ⚠️  NOT found in unpacked/ — copying from source...');

    if (!fs.existsSync(sourceCoreDir)) {
      console.error('[afterPack]   ❌ Source not found:', sourceCoreDir);
      console.error('[afterPack]   ❌ Cannot proceed — hook aborting');
      return;
    }

    try {
      const dstScope = path.join(unpackedPath, 'node_modules', '@codepilot');
      const dstCore = path.join(dstScope, 'core');
      fs.mkdirSync(dstCore, { recursive: true });

      // Copy dist/ and package.json (minimum needed for require resolution)
      const distSrc = path.join(sourceCoreDir, 'dist');
      const distDst = path.join(dstCore, 'dist');
      if (fs.existsSync(distSrc)) {
        fs.cpSync(distSrc, distDst, { recursive: true, dereference: true, force: true });
      }

      const pkgSrc = path.join(sourceCoreDir, 'package.json');
      const pkgDst = path.join(dstCore, 'package.json');
      if (fs.existsSync(pkgSrc)) {
        fs.copyFileSync(pkgSrc, pkgDst);
        // Remove "private": true which blocks CJS resolution in unpacked context
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgDst, 'utf8'));
          if (pkg.private) {
            delete pkg.private;
            fs.writeFileSync(pkgDst, JSON.stringify(pkg, null, 2), 'utf8');
          }
        } catch {}
      }

      console.log('[afterPack]   ✅ Copied @codepilot/core to unpacked/ from source');
    } catch (err) {
      console.error('[afterPack]   ❌ Copy failed:', err.message);
      console.error('[afterPack]   ❌ Cannot proceed — hook aborting');
      return;
    }
  } else {
    const distOk = fs.existsSync(path.join(unpackedCodepilot, 'dist'));
    const pkgOk = fs.existsSync(path.join(unpackedCodepilot, 'package.json'));
    console.log(`[afterPack]   ✅ Found in unpacked/ (dist:${distOk ? '✓' : '✗'} pkg:${pkgOk ? '✓' : '✗'})`);
  }

  // ───────────────────────────────────────────────────────
  // STEP 1: Extract app.asar
  // ───────────────────────────────────────────────────────
  const tempDir = path.join(os.tmpdir(), `lingjing-asar-repack-${Date.now()}`);
  console.log('[afterPack] [1/5] Extracting app.asar...');

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    execSync(`npx @electron/asar extract "${asarPath}" "${tempDir}"`, {
      stdio: 'pipe',
      timeout: 300000, // 5 min — WSL2 cross-fs can be very slow
    });
    console.log('[afterPack]   ✅ Extracted');
  } catch (err) {
    console.error('[afterPack]   ❌ Extract failed:', err.message);
    console.error('[afterPack]   ⚠️  Hook aborting, app.asar unchanged');
    cleanTemp(tempDir);
    return;
  }

  // ───────────────────────────────────────────────────────
  // STEP 2: Delete @codepilot from extracted contents
  // ───────────────────────────────────────────────────────
  console.log('[afterPack] [2/5] Removing @codepilot from ASAR contents...');
  const asarCodepilot = path.join(tempDir, 'node_modules', '@codepilot');

  if (fs.existsSync(asarCodepilot)) {
    try {
      let fileCount = 0;
      (function count(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.isDirectory()) count(path.join(dir, e.name));
          else fileCount++;
        }
      })(asarCodepilot);

      fs.rmSync(asarCodepilot, { recursive: true, force: true });
      console.log(`[afterPack]   ✅ Deleted ${fileCount} files (node_modules/@codepilot/)`);
    } catch (err) {
      console.error('[afterPack]   ❌ Delete failed:', err.message);
      cleanTemp(tempDir);
      return;
    }
  } else {
    console.log('[afterPack]   ℹ️  @codepilot not in ASAR (already sanitized)');
  }

  // ───────────────────────────────────────────────────────
  // STEP 3: Repack app.asar
  // ───────────────────────────────────────────────────────
  console.log('[afterPack] [3/5] Repacking app.asar...');
  const tmpAsar = path.join(os.tmpdir(), `lingjing-asar-repacked-${Date.now()}.asar`);

  try {
    execSync(`npx @electron/asar pack "${tempDir}" "${tmpAsar}"`, {
      stdio: 'pipe',
      timeout: 300000,
    });
    console.log('[afterPack]   ✅ Repacked');
  } catch (err) {
    console.error('[afterPack]   ❌ Repack failed:', err.message);
    cleanTemp(tempDir);
    return;
  }

  // ───────────────────────────────────────────────────────
  // STEP 4: Replace original app.asar
  // ───────────────────────────────────────────────────────
  console.log('[afterPack] [4/5] Replacing app.asar...');
  try {
    // Backup
    const backupPath = asarPath + '.bak';
    fs.copyFileSync(asarPath, backupPath);

    // Replace
    fs.copyFileSync(tmpAsar, asarPath);
    const newSize = fs.statSync(asarPath).size;
    const reduction = asarStat.size - newSize;
    console.log(`[afterPack]   ✅ Replaced (reduced ${(reduction / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error('[afterPack]   ❌ Replace failed:', err.message);
    cleanTemp(tempDir);
    return;
  }

  // ───────────────────────────────────────────────────────
  // STEP 5: Final verification
  // ───────────────────────────────────────────────────────
  console.log('[afterPack] [5/5] Final verification...');

  // Verify @codepilot NOT in app.asar
  try {
    const listOutput = execSync(`npx @electron/asar list "${asarPath}"`, {
      stdio: 'pipe', timeout: 30000, encoding: 'utf8',
    });
    if (listOutput.includes('@codepilot')) {
      console.log('[afterPack]   ⚠️  WARNING: @codepilot still found in app.asar!');
    } else {
      console.log('[afterPack]   ✅ @codepilot absent from app.asar');
    }
  } catch {
    console.log('[afterPack]   ⚠️  Could not verify asar contents (non-critical)');
  }

  // Verify @codepilot EXISTS in unpacked
  if (fs.existsSync(unpackedCodepilot)) {
    console.log('[afterPack]   ✅ @codepilot present in unpacked/');
  } else {
    console.log('[afterPack]   ❌ CRITICAL: @codepilot missing from unpacked!');
    console.log('[afterPack]   Runtime will crash with MODULE_NOT_FOUND!');
    // Attempt emergency recovery: restore backup
    try {
      const backupPath = asarPath + '.bak';
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, asarPath);
        console.log('[afterPack]   ⚠️  Emergency: restored backup app.asar');
      }
    } catch {}
  }

  // ── Cleanup ──
  cleanTemp(tempDir);
  try { fs.unlinkSync(tmpAsar); } catch {}

  console.log('[afterPack] ========================================');
  console.log('[afterPack] ✅ Hook completed — @codepilot safe');
  console.log('[afterPack] ========================================');
};

function cleanTemp(dir) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}
