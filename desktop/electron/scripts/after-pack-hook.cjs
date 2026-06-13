// after-pack-hook.cjs — electron-builder afterPack hook
// Called AFTER ASAR is created but BEFORE NSIS/AppImage/portable installers.
// Injects @codepilot/core (pnpm workspace symlink) and fixes package.json.
//
// FIX v1.73.57: RESTORE "exports" field — v1.73.56 wrongly deleted it.
//   Root cause analysis: the \..\ path corruption in v1.73.54b was caused by
//   pnpm workspace SYMLINKS (node_modules/@codepilot/core → ../../core/) being
//   extracted to NSIS temp dir, NOT by the "exports" field itself.
//   Since we now use cpSync({dereference:true}), there are no symlinks — exports is safe.
//   Without exports, CJS require('@codepilot/core/mcp') fails because Node.js
//   can't resolve subpaths without the exports map (54 broken imports across mcp,
//   fusion, checkpoint, rules, utils, types, intent, context, completion, etc.).
//
// Strategy:
//   1. KEEP "exports" field — required for subpath resolution (mcp, fusion, etc.)
//   2. KEEP "type": "module" — so .js = ESM
//   3. KEEP "main": "./dist/index.js"
//   4. DELETE "private": true — pnpm workspace marker incompatible with ASAR
//   5. All files stay as .js (no .mjs rename)
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
    //   KEEP "exports" — ESSENTIAL for subpath resolution (mcp, fusion, etc.)
    //     The \..\ bug was from SYMLINKS, not exports. cpSync dereference = safe.
    //   DELETE "private" — pnpm marker incompatible with ASAR resolution
    //   KEEP "type": "module" — so .js files are ESM
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
        // CRITICAL v1.73.57: KEEP "exports" — required for CJS require() subpath resolution.
        // require('@codepilot/core/mcp') needs exports to map ./mcp -> ./dist/mcp/index.js
        // The \..\ path bug in v1.73.54b was caused by pnpm workspace SYMLINKS, NOT exports.
        // Since cpSync({dereference:true}) copies real files, exports is safe.
        if (pkg.exports) {
          console.log('[afterPack]   "exports" field preserved (required for subpath resolution)');
        } else {
          console.warn('[afterPack]   WARNING: "exports" MISSING — subpath imports will fail!');
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
        console.log('[afterPack]   ✅ package.json fixed (exports preserved, private removed, type=module)');
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
