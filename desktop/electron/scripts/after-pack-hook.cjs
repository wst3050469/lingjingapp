// after-pack-hook.cjs — electron-builder afterPack hook
// Called AFTER ASAR is created but BEFORE NSIS/AppImage/portable installers.
// Injects @codepilot/core (pnpm workspace symlink) and fixes package.json.
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
    execSync(`npx asar extract "${asarFile}" "${tmpDir}"`, { stdio: 'pipe', timeout: 60000 });

    // Inject @codepilot/core
    const dstCore = join(tmpDir, 'node_modules', '@codepilot', 'core');
    mkdirSync(join(tmpDir, 'node_modules', '@codepilot'), { recursive: true });
    if (existsSync(dstCore)) rmSync(dstCore, { recursive: true, force: true });
    cpSync(srcCore, dstCore, { recursive: true, dereference: true, force: true });

    // Clean dev deps
    const coreNm = join(dstCore, 'node_modules');
    if (existsSync(coreNm)) rmSync(coreNm, { recursive: true, force: true });

    // Fix package.json:
    // - Remove "private": true (causes ESM path resolution issues in pnpm → ASAR)
    // - Remove "type": "module" → rename .js to .mjs so ESM works without type declaration
    //   (Node.js treats .mjs as ESM regardless of "type" field)
    const pkgPath = join(dstCore, 'package.json');
    if (existsSync(pkgPath)) {
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      } catch (e) {
        console.warn('[afterPack] ⚠️ Could not parse package.json:', e.message);
      }
      if (pkg) {
        // Strategy: rename .js→.mjs + update package.json references
        // This avoids the "type":"module" field entirely
        if (pkg.type === 'module') {
          delete pkg.type;
        }
        if (pkg.private) {
          delete pkg.private;
        }
        
        // Rename all dist/**/*.js → dist/**/*.mjs
        const { renameSync: ren, readdirSync: rd, lstatSync: ls } = require('node:fs');
        const { join: j, extname: ext } = require('node:path');
        function renameDir(dir) {
          try {
            for (const e of rd(dir, { withFileTypes: true })) {
              const fp = j(dir, e.name);
              if (e.isDirectory()) { renameDir(fp); }
              else if (e.isFile() && e.name.endsWith('.js')) {
                ren(fp, fp.slice(0, -3) + '.mjs');
              }
            }
          } catch {}
        }
        const distDir = join(dstCore, 'dist');
        renameDir(distDir);

        // Fix package.json paths
        const fixPath = (s) => typeof s === 'string' ? s.replace(/(dist\/[^"']+)\.js/g, '$1.mjs') : s;
        if (pkg.main) pkg.main = fixPath(pkg.main);
        if (pkg.exports) {
          for (const [k, v] of Object.entries(pkg.exports)) {
            if (typeof v === 'string') pkg.exports[k] = fixPath(v);
            else if (Array.isArray(v)) pkg.exports[k] = v.map(fixPath);
          }
        }

        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        console.log('[afterPack]   Fixed package.json: .js→.mjs, removed type/private');
      }
    }

    // NOW fix internal import references in the .mjs files
    // ESM imports like 'from "./foo/bar.js"' need to become 'from "./foo/bar.mjs"'
    function fixImportRefs(dir) {
      try {
        for (const e of require('node:fs').readdirSync(dir, { withFileTypes: true })) {
          const fp = join(dir, e.name);
          if (e.isDirectory()) { fixImportRefs(fp); }
          else if (e.isFile() && (e.name.endsWith('.mjs') || e.name.endsWith('.js'))) {
            let content = readFileSync(fp, 'utf8');
            // Replace .js → .mjs in import/export paths (only local relative paths, not npm packages)
            const updated = content.replace(
              /(from\s+['"])(\.\/[^'"]+)(\.js)(['"])/g,
              '$1$2.mjs$4'
            ).replace(
              /(import\s+['"])(\.\/[^'"]+)(\.js)(['"])/g,
              '$1$2.mjs$4'
            );
            if (updated !== content) {
              writeFileSync(fp, updated, 'utf8');
            }
          }
        }
      } catch {}
    }
    fixImportRefs(join(dstCore, 'dist'));
    console.log('[afterPack]   Fixed internal import references .js→.mjs');

    // Repack
    execSync(`npx asar pack "${tmpDir}" "${asarFile}"`, { stdio: 'pipe', timeout: 60000 });

    console.log('[afterPack] ✅ @codepilot/core injected + ESM fix applied');
  } catch (err) {
    console.error('[afterPack] ❌ Failed:', err.message);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
};
