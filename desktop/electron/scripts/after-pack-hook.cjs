// after-pack-hook.cjs — electron-builder afterPack hook
// Called AFTER ASAR is created but BEFORE NSIS/AppImage/portable installers.
// Injects @codepilot/core (pnpm workspace symlink) and fixes package.json.
//
// FIX v1.73.56: Strategy changed from .mjs rename back to:
//   1. Keep "type": "module" (so .js = ESM)
//   2. Keep all files as .js (no rename needed)
//   3. DELETE "exports" field (root cause of NSIS temp \..\ path corruption via resolveExports)
//   4. Delete "private": true (pnpm workspace marker incompatible with ASAR)
//   5. Keep "main": "./dist/index.js" as-is
//
// Why this works:
//   - CJS require() + "type":"module" → Node.js ESM interop → uses "main" field (simple resolution)
//   - Without "exports", resolveExports is skipped → no \..\ path corruption in NSIS temp
//   - ESM imports between .js files work because "type":"module" is set
const { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { execSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const asarFile = join(appOutDir, 'resources', 'app.asar');

  if (!existsSync(asarFile)) {
    console.log('[afterPack] No app.asar found - skipping');
    return;
  }

  const electronRoot = join(__dirname, '..');
  const srcCore = join(electronRoot, 'release', 'build', 'node_modules', '@codepilot', 'core');

  if (!existsSync(join(srcCore, 'dist', 'index.js'))) {
    console.error('[afterPack] ⚠️ @codepilot/core not found at', srcCore);
    return;
  }

  const tmpDir = join(appOutDir, '.asar-tmp-inject');

  console.log('[afterPack] Injecting @codepilot/core + fixing package.json...');

  try {
    // Extract
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    execSync(`npx asar extract "${asarFile}" "${tmpDir}"`, { stdio: 'pipe', timeout: 300000 });

    // Inject @codepilot/core
    const dstCore = join(tmpDir, 'node_modules', '@codepilot', 'core');
    mkdirSync(join(tmpDir, 'node_modules', '@codepilot'), { recursive: true });
    if (existsSync(dstCore)) rmSync(dstCore, { recursive: true, force: true });
    cpSync(srcCore, dstCore, { recursive: true, dereference: true, force: true });

    // Clean dev deps
    const coreNm = join(dstCore, 'node_modules');
    if (existsSync(coreNm)) rmSync(coreNm, { recursive: true, force: true });

    // Fix package.json:
    //   DELETE "exports" — prevents resolveExports which causes NSIS temp \..\ path bug
    //   DELETE "private" — pnpm marker incompatible with ASAR resolution
    //   KEEP "type": "module" — so .js files are ESM (CJS require works via Node.js interop)
    //   KEEP "main": "./dist/index.js"
    const pkgPath = join(dstCore, 'package.json');
    if (existsSync(pkgPath)) {
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      } catch (e) {
        console.warn('[afterPack] ⚠️ Could not parse package.json:', e.message);
      }
      if (pkg) {
        // CRITICAL: Delete "exports" — this is the root cause of NSIS temp \..\ path corruption
        // When CJS require() loads an ESM package, resolveExports() follows the exports map
        // and generates corrupt paths in NSIS temp directories. Without exports, Node.js
        // uses the simpler "main" field resolution which avoids the bug.
        if (pkg.exports) {
          delete pkg.exports;
          console.log('[afterPack]   Deleted "exports" field (avoids resolveExports path corruption)');
        }

        // Remove pnpm workspace marker (incompatible with ASAR)
        if (pkg.private) {
          delete pkg.private;
          console.log('[afterPack]   Removed "private": true');
        }

        // Ensure "type": "module" is preserved — required for .js = ESM
        if (pkg.type !== 'module') {
          pkg.type = 'module';
          console.log('[afterPack]   Restored "type": "module"');
        }

        // Ensure "main" points to index.js (no .mjs rename)
        if (!pkg.main || pkg.main.includes('.mjs')) {
          pkg.main = './dist/index.js';
          console.log('[afterPack]   Fixed "main" to ./dist/index.js');
        }

        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        console.log('[afterPack]   ✅ package.json fixed (exports deleted, type=module, .js preserved)');
      }
    }

    // Verify key files exist
    const indexJs = join(dstCore, 'dist', 'index.js');
    const agentJs = join(dstCore, 'dist', 'agent', 'agent.js');
    if (existsSync(indexJs)) {
      console.log('[afterPack]   ✅ dist/index.js exists');
    } else {
      console.error('[afterPack]   ❌ dist/index.js MISSING');
    }
    if (existsSync(agentJs)) {
      console.log('[afterPack]   ✅ dist/agent/agent.js exists');
    } else {
      console.error('[afterPack]   ❌ dist/agent/agent.js MISSING');
    }

    // Repack
    execSync(`npx asar pack "${tmpDir}" "${asarFile}"`, { stdio: 'pipe', timeout: 300000 });

    console.log('[afterPack] ✅ @codepilot/core injected + package.json fixed');
  } catch (err) {
    console.error('[afterPack] ❌ Failed:', err.message);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
};
