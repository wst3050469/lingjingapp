// build-main.mjs - Build Electron main process with esbuild
// Compiles TypeScript ESM source to bundled CJS output
// ESM-only deps (like @codepilot/core) are bundled in
// Native/huge deps are kept external

import * as esbuild from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, realpathSync, readdirSync, lstatSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Phase 0: Sync @codepilot/core dist ───
// esbuild resolves modules from the nearest node_modules.
// If packages/electron/node_modules/@codepilot/core is stale,
// esbuild will bundle the OLD version without recent schema changes.
// This sync ensures the electron local copy is always up-to-date.
const CORE_SRC = resolve(root, '../../node_modules/@codepilot/core/dist');
const CORE_DST = resolve(root, 'node_modules/@codepilot/core/dist');
if (existsSync(CORE_SRC) && existsSync(CORE_DST)) {
  try {
    const isWin = process.platform === 'win32';
    // Check if src and dst resolve to the same physical file (pnpm symlinks)
    const srcReal = realpathSync(CORE_SRC);
    const dstReal = realpathSync(CORE_DST);
    if (srcReal === dstReal) {
      console.log('[build-main] �?@codepilot/core dist already accessible (pnpm symlink)');
    } else if (isWin) {
      execSync(`xcopy /E /Y /I /Q "${CORE_SRC}" "${CORE_DST}"`, { stdio: 'pipe', timeout: 10000 });
    } else {
      execSync(`cp -r "${CORE_SRC}/." "${CORE_DST}/"`, { stdio: 'pipe', timeout: 10000 });
    }
    // Also sync package.json to pick up new exports (checkpoint/intent/context/completion)
    const pkgSrc = resolve(root, '../../node_modules/@codepilot/core/package.json');
    const pkgDst = resolve(root, 'node_modules/@codepilot/core/package.json');
    if (existsSync(pkgSrc) && existsSync(pkgDst)) {
      copyFileSync(pkgSrc, pkgDst);
    }
    console.log('[build-main] �?Synced @codepilot/core dist + package.json to electron local node_modules');
  } catch (err) {
    console.warn('[build-main] ⚠️ Failed to sync @codepilot/core dist:', err.message);
  }
} else {
  console.warn('[build-main] ⚠️ @codepilot/core dist not found at one of:');
  console.warn(`  src: ${CORE_SRC} (exists: ${existsSync(CORE_SRC)})`);
  console.warn(`  dst: ${CORE_DST} (exists: ${existsSync(CORE_DST)})`);
}

/**
 * Plugin: fix import.meta.url for CJS builds.
 * esbuild replaces import.meta with {} in CJS format, making import.meta.url undefined.
 * This plugin replaces known patterns with __dirname (which IS available in CJS).
 */
function importMetaPlugin() {
  return {
    name: 'import-meta-cjs',
    setup(build) {
      build.onLoad({ filter: /\.ts$/ }, async (args) => {
        // Skip node_modules (except @codepilot)
        if (args.path.includes('node_modules') && !args.path.includes('@codepilot')) return null;
        let src = readFileSync(args.path, 'utf8');
        let modified = false;

        // Replace: const varName = dirname(fileURLToPath(import.meta.url));
        if (src.includes('dirname(fileURLToPath(import.meta.url))')) {
          src = src.replace(
            /const (\w+) = dirname\(fileURLToPath\(import\.meta\.url\)\);?/g,
            'const $1 = typeof __dirname !== "undefined" ? __dirname : process.cwd();'
          );
          modified = true;
        }
        // Replace: import { fileURLToPath } from 'node:url' (remove if no longer needed)
        // But only if we've already replaced the usage
        if (modified && src.includes("import { fileURLToPath }")) {
          src = src.replace(
            /import \{ fileURLToPath \} from ['"]node:url['"];?\s*/g,
            '// import { fileURLToPath } removed by importMetaPlugin\n'
          );
        }

        return modified ? { contents: src, loader: 'ts' } : null;
      });
    },
  };
}

// Native/binary modules that must stay external
// Native/binary modules that must stay external.
// @codepilot/core is ESM with exports field — must remain external because
// esbuild cannot bundle its missing dist stubs (22+ broken exports).
// The after-pack-hook.cjs handles the ASAR path-truncation fix.
const EXTERNAL=["electron","sql.js","ssh2","cpu-features","node-pty","fsevents","playwright","playwright-core","@codepilot/core","@codepilot/core/fusion","@codepilot/core/checkpoint","@codepilot/core/rules","@codepilot/core/utils","@codepilot/core/mcp","@codepilot/core/voice","@codepilot/core/context","@codepilot/core/intent","@codepilot/core/terminal-suggester","@codepilot/core/auto-fix","@codepilot/core/agent-mode","@codepilot/core/multi-file-edit","@codepilot/core/pipeline","@codepilot/core/security","@codepilot/core/pm","@codepilot/core/review","bcryptjs","chokidar","exceljs","express","ws","electron-updater","fast-glob","jose","uuid","zod","gpt-tokenizer","yaml","cron-parser","underscore","readable-stream"];



// ─── Phase 0.5: Sync renderer dist ───
// electron-builder packages files from desktop/electron/ using "files": ["renderer/**/*"].
// The Vite build output is at desktop/frontend/dist/, which needs to be copied
// to desktop/electron/renderer/ so electron-builder includes it in the ASAR.
// Without this step, only index.html is packaged (no assets/) �?blank page at runtime.
const RENDERER_SRC = resolve(root, '../frontend/dist');
const RENDERER_DST = resolve(root, 'renderer');
if (existsSync(RENDERER_SRC)) {
  if (existsSync(RENDERER_DST)) {
    rmSync(RENDERER_DST, { recursive: true, force: true });
  }
  mkdirSync(RENDERER_DST, { recursive: true });
  cpSync(RENDERER_SRC, RENDERER_DST, { recursive: true, force: true });
  const assetCount = existsSync(join(RENDERER_DST, 'assets'))
    ? readdirSync(join(RENDERER_DST, 'assets')).length
    : 0;
  console.log(`[build-main] �?Synced renderer dist (${assetCount} assets)`);
} else {
  console.warn('[build-main] ⚠️ Renderer dist not found at:', RENDERER_SRC);
  console.warn('[build-main]   Run: pnpm --filter @codepilot/renderer build first');
}

// ─── Phase 1: Resolve pnpm symlinks in node_modules ───
// pnpm uses symlinks in node_modules. Electron-builder copies the source node_modules
// to release/build/, but symlinks to the pnpm store are NOT properly resolved.
// This step copies ALL deps following symlinks, creating real file copies
// at release/build/node_modules/ for electron-builder to package into the ASAR.
//
// pnpm's strict layout: transitive deps of externalized packages are NOT in the
// direct node_modules/ but hoisted to ROOT/node_modules/.pnpm/node_modules/.
// We trace the recursive dependencies of each EXTERNAL package and copy only
// those needed, keeping the ASAR lean.
function resolveNodeModules() {
  const ROOT_NM = join(root, '..', '..', 'node_modules'); // root-level node_modules
  const PNPM_HOISTED = join(ROOT_NM, '.pnpm', 'node_modules');
  const SRC_NM = join(root, 'node_modules'); // electron-local node_modules
  const BUILD_APP = join(root, 'release', 'build');
  const DST_NM = join(BUILD_APP, 'node_modules');

  if (!existsSync(BUILD_APP)) {
    mkdirSync(BUILD_APP, { recursive: true });
  }
  mkdirSync(DST_NM, { recursive: true });

  // Dev/build-only packages to skip (not needed at runtime)
  const SKIP = new Set(['.pnpm', '.bin', 'esbuild', '@esbuild', 'electron', 'typescript']);

  // Packages that are already in a .pnpm scoped dir (skip copying them)
  const ALREADY_COPIED = new Set();

  function copyEntry(srcPath, dstPath, name) {
    if (existsSync(dstPath)) return 'already_exists';
    try {
      cpSync(srcPath, dstPath, { recursive: true, dereference: true, force: true });
      return 'copied';
    } catch (err) {
      console.warn(`[build-main] ⚠️ Skipping ${name} (broken symlink): ${err.message}`);
      return 'error';
    }
  }

  let copied = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Step A: Copy direct dependencies from packages/electron/node_modules/
    const entries = readdirSync(SRC_NM, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || SKIP.has(name)) { skipped++; continue; }
      const status = copyEntry(join(SRC_NM, name), join(DST_NM, name), name);
      if (status === 'copied') copied++;
      else if (status === 'error') errors++;
      else copied++; // already_exists counts as success
      ALREADY_COPIED.add(name);
    }

    // Step B: Copy transitive deps of externalized packages from pnpm hoisted store
    // We trace the dependency tree of each external package to find what's needed.
    function getDependencies(pkgDir) {
      const pkgJsonPath = join(pkgDir, 'package.json');
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        return pkg.dependencies ? Object.keys(pkg.dependencies) : [];
      } catch { return []; }
    }

    // Collect ALL transitive deps needed by externalized packages
    const neededDeps = new Set();
    const visitedPkgs = new Set();

    // Check multiple possible locations for a package
    function findPkgDir(pkgName) {
      // 1. Already copied to destination (Step A already ran)
      const candidates = [
        join(DST_NM, pkgName),                     // destination copy
        join(PNPM_HOISTED, pkgName),               // pnpm hoisted store
        join(PNPM_HOISTED, pkgName.split('/')[0]), // scoped package parent
      ];
      for (const dir of candidates) {
        const pkgJson = join(dir, 'package.json');
        if (existsSync(pkgJson)) return dir;
      }
      // 2. Search pnpm per-package store: node_modules/.pnpm/{name}@*/node_modules/{name}/
      try {
        const pnpmDir = join(ROOT_NM, '.pnpm');
        const entries = readdirSync(pnpmDir, { withFileTypes: true });
        const scopePrefix = pkgName.startsWith('@') ? pkgName.split('/')[0] + '+' : '';
        const simpleName = pkgName.startsWith('@') ? pkgName.split('/')[1] : pkgName;
        for (const entry of entries) {
          if (entry.isDirectory() && (entry.name.startsWith(simpleName + '@') || entry.name.startsWith(scopePrefix + simpleName + '@'))) {
            const pkgJsonPath = join(pnpmDir, entry.name, 'node_modules', pkgName, 'package.json');
            if (existsSync(pkgJsonPath)) return join(pnpmDir, entry.name, 'node_modules', pkgName);
          }
        }
      } catch {}
      return null;
    }

    function traceDeps(pkgName) {
      if (visitedPkgs.has(pkgName)) return;
      visitedPkgs.add(pkgName);

      const pkgDir = findPkgDir(pkgName);
      if (!pkgDir) {
        console.warn(`[build-main] ⚠️ Cannot trace deps of '${pkgName}' (not found in destination or hoisted store)`);
        return;
      }

      const deps = getDependencies(pkgDir);
      for (const dep of deps) {
        neededDeps.add(dep);
        traceDeps(dep);
      }
    }

    // Trace from packages that are external (not bundled) AND are actual direct deps
    for (const external of EXTERNAL) {
      // Skip native packages, electron, etc.
      if (['electron', 'playwright', 'playwright-core', 'fsevents', 'cpu-features',
           'sql.js', 'ssh2', 'node-pty'].includes(external)) continue;
      // Skip subpath entries (e.g., @codepilot/core/checkpoint) - they are not
      // separate npm packages but subpaths of an already-listed external package.
      if (external.startsWith('@') && external.split('/').length > 2) continue;
      if (!external.startsWith('@') && external.includes('/')) continue;
      // Skip packages that esbuild would bundle anyway
      neededDeps.add(external);
      traceDeps(external);
    }

    // Filter: only copy packages that are NOT already copied
    for (const depName of neededDeps) {
      if (depName.startsWith('.') || SKIP.has(depName)) { skipped++; continue; }

      // Handle scoped packages (@scope/name)
      const isScoped = depName.startsWith('@');
      const storeName = isScoped ? depName.split('/')[0] : depName;

      if (ALREADY_COPIED.has(storeName)) { copied++; continue; }

      // Use findPkgDir to locate the package source (hoisted store or pnpm per-package store)
      const pkgDir = findPkgDir(depName);
      if (!pkgDir) {
        skipped++;
        continue;
      }

      let dstPath = join(DST_NM, storeName);
      if (isScoped) {
        // For scoped packages, pkgDir is already the full path to the scoped package
        // e.g., .../node_modules/@nodelib/fs.stat
        const subPath = depName.split('/').slice(1).join('/');
        const subDstPath = join(dstPath, subPath);
        mkdirSync(dstPath, { recursive: true });
        const status = copyEntry(pkgDir, subDstPath, depName);
        ALREADY_COPIED.add(storeName);
        if (status === 'copied') copied++;
        else if (status === 'error') errors++;
        else copied++;
      } else {
        dstPath = join(DST_NM, depName);
        const status = copyEntry(pkgDir, dstPath, depName);
        ALREADY_COPIED.add(depName);
        if (status === 'copied') copied++;
        else if (status === 'error') errors++;
        else copied++;
      }
    }
  } catch (err) {
    console.error('[build-main] �?Failed to resolve node_modules:', err.message);
  }

  // ─── Phase 2.5: Handle workspace packages ───
  // pnpm workspace packages (e.g., @codepilot/core) are symlinks from
  // packages/electron/node_modules/@scoped/name �?../../core/
  // They are NOT in .pnpm store, so findPkgDir() misses them.
  // This step resolves symlinks and copies dist + package.json to BUILD_NM.
  for (const external of EXTERNAL) {
    // Only handle scoped workspace packages: @scope/name
    if (!external.startsWith('@')) continue;
    const parts = external.split('/');
    if (parts.length !== 2) continue;

    const symlinkPath = join(SRC_NM, parts[0], parts[1]);
    let realPath;
    try {
      realPath = realpathSync(symlinkPath);
    } catch {
      continue; // not a symlink or doesn't exist
    }

    // If realPath === symlinkPath, it's already a real directory (not a workspace symlink)
    if (realPath === symlinkPath) continue;

    // Verify it's a workspace package: has dist/index.js and package.json
    const realPkgJson = join(realPath, 'package.json');
    const realDistIndex = join(realPath, 'dist', 'index.js');
    if (!existsSync(realPkgJson) || !existsSync(realDistIndex)) continue;

    let pkg;
    try {
      pkg = JSON.parse(readFileSync(realPkgJson, 'utf8'));
    } catch { continue; }

    if (!pkg.private && !pkg.main) continue; // not a workspace lib

    // Copy to release/build/node_modules/ (inside resolveNodeModules, use DST_NM)
    const dstScope = join(DST_NM, parts[0]);
    const dstDir = join(dstScope, parts[1]);
    mkdirSync(dstScope, { recursive: true });

    try {
      // Remove existing symlink if any
      if (existsSync(dstDir)) {
        try { rmSync(dstDir, { recursive: true, force: true }); } catch {}
      }
      // Copy dist directory
      cpSync(join(realPath, 'dist'), join(dstDir, 'dist'), { recursive: true, dereference: true, force: true });
      // Copy package.json (essential for Node.js module resolution)
      copyFileSync(realPkgJson, join(dstDir, 'package.json'));
      copied++;
      console.log(`[build-main] 📦 Workspace package '${external}' resolved: ${realPath} �?release/build/node_modules/`);
    } catch (err) {
      console.warn(`[build-main] ⚠️ Failed to copy workspace package '${external}': ${err.message}`);
    }
  }
}

console.log('[build-main] Building Electron main process with esbuild...');

try {
  await esbuild.build({
    entryPoints: [join(root, 'src', 'main.ts')],
    outfile: join(root, 'dist', 'main.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: EXTERNAL,
    plugins: [importMetaPlugin()],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
    tsconfig: join(root, 'tsconfig.json'),
  });

  console.log('[build-main] main.js built successfully');

  // Phase 0.6: Patch ALL @codepilot/core requires in CJS output (root + subpaths)
  // esbuild hoists ALL await import("@codepilot/core*") to top-level
  // require() calls in CJS format. These run BEFORE any try/catch at module load.
  // v1.73.70 only caught root; v1.73.71 extends to subpaths (mcp, rules, checkpoint, etc.)
  // Fix: Replace ALL top-level require("@codepilot/core/...") with generic safe wrapper.
  {
    const mainJsPath = join(root, 'dist', 'main.js');
    let content = readFileSync(mainJsPath, 'utf8');
    
    // Generic safe-require wrapper: accepts optional subpath parameter
    // v5: Fix — also attempt auto-repair on MODULE_NOT_FOUND (not just NEEDS_REPAIR)
    const SAFE_REQUIRE_PREAMBLE = [
      '// @codepilot/core safe-require wrapper (v8: readdir-based repair + package.json + readdirSync fallback)',
      'var __safeRequireCodepilot = (function(subpath) {',
      '  var modulePath = "@codepilot/core" + (subpath ? "/" + subpath : "");',
      '  var __repairCodepilot = function() {',
      '    console.log("[main] v8 repair: attempting @codepilot/core auto-recovery...");',
      '    try {',
      '      var _fs2 = require("fs");',
      '      var _path2 = require("path");',
      '      var _unpackedPath = _path2.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@codepilot", "core", "dist");',
      '      // v8: Enhanced recursive copy with readdirSync fallback for ASAR compatibility',
      '      var __copyRecursive = function(src, dst) {',
      '        if (!_fs2.existsSync(src)) return;',
      '        _fs2.mkdirSync(dst, { recursive: true });',
      '        var _entries;',
      '        try { _entries = _fs2.readdirSync(src, { withFileTypes: true }); } catch(e3) {',
      '          // readdirSync({withFileTypes}) may not be supported in all ASAR versions',
      '          _entries = _fs2.readdirSync(src);',
      '        for (var _i = 0; _i < _entries.length; _i++) {',
      '          var _e = _entries[_i];',
      '          var _isDir = typeof _e === "string" ? _fs2.statSync(_path2.join(src, _e)).isDirectory() : _e.isDirectory();',
      '          var _name = typeof _e === "string" ? _e : _e.name;',
      '          var _s = _path2.join(src, _name);',
      '          var _d = _path2.join(dst, _name);',
      '          if (_isDir) { __copyRecursive(_s, _d); }',
      '          else { _fs2.writeFileSync(_d, _fs2.readFileSync(_s)); }',
      '        }',
      '      };',
      '      // Strategy 1: Copy from asar-internal backup (survives auto-update)',
      '      var _asarBackup = _path2.join(__dirname, "__codepilot_dist__");',
      '      if (_fs2.existsSync(_asarBackup)) {',
      '        if (_fs2.existsSync(_unpackedPath)) _fs2.rmSync(_unpackedPath, { recursive: true, force: true });',
      '        __copyRecursive(_asarBackup, _unpackedPath);',
      '        // v8: Also copy package.json for Node.js module resolution',
      '        var _pkgSrc = _path2.join(_asarBackup, "package.json");',
      '        var _unpackedPkgDirS1 = _path2.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@codepilot", "core");',
      '        if (_fs2.existsSync(_pkgSrc)) { try { _fs2.mkdirSync(_unpackedPkgDirS1, { recursive: true }); _fs2.writeFileSync(_path2.join(_unpackedPkgDirS1, "package.json"), _fs2.readFileSync(_pkgSrc)); } catch(e3) {} }',
      '        console.log("[main] Strategy 1 (asar backup) repaired @codepilot/core");',
      '        try { delete require.cache[require.resolve("@codepilot/core")]; } catch {}',
      '        return true;',
      '      }',
      '      // Strategy 2: Copy from extraResources (bundled via electron-builder)',
      '      var _extraBackup = _path2.join(process.resourcesPath, "codepilot-core-dist");',
      '      if (_fs2.existsSync(_extraBackup)) {',
      '        if (_fs2.existsSync(_unpackedPath)) _fs2.rmSync(_unpackedPath, { recursive: true, force: true });',
      '        __copyRecursive(_extraBackup, _unpackedPath);',
      '        // v8: Also copy package.json for Node.js module resolution',
      '        var _pkgSrc2 = _path2.join(_extraBackup, "package.json");',
      '        var _unpackedPkgDirS2 = _path2.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@codepilot", "core");',
      '        if (_fs2.existsSync(_pkgSrc2)) { try { _fs2.mkdirSync(_unpackedPkgDirS2, { recursive: true }); _fs2.writeFileSync(_path2.join(_unpackedPkgDirS2, "package.json"), _fs2.readFileSync(_pkgSrc2)); } catch(e3) {} }',
      '        console.log("[main] Strategy 2 (extraResources) repaired @codepilot/core");',
      '        try { delete require.cache[require.resolve("@codepilot/core")]; } catch {}',
      '        return true;',
      '      }',
      '    } catch(e2) {',
      '      console.warn("[main] v8 repair failed:", e2.message);',
      '    }',
      '    return false;',
      '  };',
      '  // v8: Stub module with noop functions for graceful degradation.',
      '  // When @codepilot/core is unavailable, the app still starts but core features',
      '  // (Agent, Quest) will show user-friendly errors instead of crashing.',
      '  var __stub = function() {',
      '    console.warn("[main] @codepilot/core stub module — core features degraded");',
      '    return {',
      '      loadPrompts: function() { return Promise.resolve(); },',
      '      getPrompt: function() { return ""; },',
      '      MAIN_PROMPT: "",',
      '      clearPromptCache: function() {},',
      '      Agent: function() { throw new Error("Agent unavailable — @codepilot/core not loaded"); },',
      '      Conversation: function() { throw new Error("Conversation unavailable"); },',
      '      loadConfig: function() { return Promise.resolve({}); },',
      '      createProvider: function() { throw new Error("Provider unavailable — @codepilot/core not loaded"); },',
      '      createDefaultRegistry: function() { return { tools: new Map(), register: function(){} }; },',
      '      estimateTokens: function() { return 0; },',
      '      estimateMessageTokens: function() { return 0; },',
      '    };',
      '  };',
      '  try {',
      '    var mod = require(modulePath);',
      '    if (!subpath && mod && typeof mod.loadPrompts !== "function") {',
      '      console.warn("[main] @codepilot/core outdated (loadPrompts missing), attempting auto-repair...");',
      '      if (__repairCodepilot()) {',
      '        var _repaired = require(modulePath);',
      '        if (_repaired && typeof _repaired.loadPrompts === "function") {',
      '          return _repaired;',
      '        }',
      '      }',
      '      console.warn("[main] @codepilot/core repair failed — merging stubs for graceful degradation");',
      '      var _st = __stub();',
      '      for (var _k in _st) { if (!(_k in mod) || typeof mod[_k] !== "function") { mod[_k] = _st[_k]; } }',
      '    }',
      '    return mod;',
      '  } catch(e) {',
      '    if (e && (e.code === "MODULE_NOT_FOUND" || e.code === "ERR_MODULE_NOT_FOUND" ||',
      '        (e.message && e.message.indexOf("codepilot") !== -1))) {',
      '      console.warn("[main] " + modulePath + " unavailable, attempting auto-repair...");',
      '      if (__repairCodepilot()) {',
      '        try { return require(modulePath); } catch(e3) {}',
      '      }',
      '      console.warn("[main] " + modulePath + " unavailable at startup, returning stub module");',
      '      return __stub();',
      '    }',
      '    throw e;',
      '  }',
      '})',
      '',
    ].join('\n');
    
    const strictIdx = content.indexOf('"use strict"');
    const insertIdx = strictIdx >= 0 ? content.indexOf('\n', strictIdx) + 1 : 0;
    content = content.slice(0, insertIdx) + SAFE_REQUIRE_PREAMBLE + content.slice(insertIdx);
    
    // Match ALL @codepilot/core require() patterns:
    //   var import_core = require("@codepilot/core");                  (root)
    //   var import_mcp = require("@codepilot/core/mcp");               (subpath)
    //   var import_logger = require("@codepilot/core/utils/logger");    (deep)
    //   import_utils27 = require("@codepilot/core/utils");             (no var)
    const codepilotRequireRe = /^(\s*(?:var\s+)?\w+\s*=\s*)require\("@codepilot\/core(\/[^"]*)?"\);/gm;
    // Also match await import("@codepilot/core") patterns (esbuild may keep them as-is)
    const codepilotImportDestrRe = /^(\s*(?:const|var|let)\s+\{[^}]+\}\s*=\s*)await\s+import\("@codepilot\/core(\/[^"]*)?"\);/gm;
    const codepilotImportSimpleRe = /^(\s*(?:const|var|let)\s+\w+\s*=\s*)await\s+import\("@codepilot\/core(\/[^"]*)?"\);/gm;
    let patchedCount = 0;
    content = content.replace(codepilotRequireRe, (match, prefix, subpath) => {
      patchedCount++;
      const arg = subpath ? '"' + subpath.slice(1) + '"' : '';
      return prefix + '__safeRequireCodepilot(' + arg + ');';
    });
    content = content.replace(codepilotImportDestrRe, (match, prefix, subpath) => {
      patchedCount++;
      const arg = subpath ? '"' + subpath.slice(1) + '"' : '';
      return prefix + '__safeRequireCodepilot(' + arg + ');';
    });
    content = content.replace(codepilotImportSimpleRe, (match, prefix, subpath) => {
      patchedCount++;
      const arg = subpath ? '"' + subpath.slice(1) + '"' : '';
      return prefix + '__safeRequireCodepilot(' + arg + ');';
    });
    
    if (patchedCount > 0) {
      writeFileSync(mainJsPath, content, 'utf8');
      console.log('[build-main] Patched ' + patchedCount + ' top-level @codepilot/core/* require/import -> safe wrapper');
    } else {
      console.log('[build-main] No top-level @codepilot/core/* require/import found');
    }
  }

  // Build preload.ts �?dist/preload.js (CJS for Electron contextBridge)
  await esbuild.build({
    entryPoints: [join(root, 'src', 'preload.ts')],
    outfile: join(root, 'dist', 'preload.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    plugins: [importMetaPlugin()],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
    tsconfig: join(root, 'tsconfig.preload.json'),
  });
  console.log('[build-main] preload.js built successfully');

  // Copy preload.js to preload.cjs for Electron CJS compatibility
  // Electron's process context bridge expects .cjs extension in some configurations
  const preloadJsPath = join(root, 'dist', 'preload.js');
  const preloadCjsPath = join(root, 'dist', 'preload.cjs');
  try {
    copyFileSync(preloadJsPath, preloadCjsPath);
    console.log('[build-main] �?preload.cjs created (copy of preload.js)');
  } catch (err) {
    console.warn('[build-main] ⚠️ Failed to create preload.cjs:', err.message);
  }

  // Copy sql-wasm.wasm to dist (needed by sql.js at runtime)
  // Try multiple source locations: project root, node_modules (pnpm store), dist from previous builds
  const WASM_CANDIDATES = [
    join(root, 'sql-wasm.wasm'),
    join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    join(root, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    join(root, 'dist', 'sql-wasm.wasm'),
  ];
  let wasmSrc = null;
  for (const candidate of WASM_CANDIDATES) {
    if (existsSync(candidate)) { wasmSrc = candidate; break; }
  }
  if (wasmSrc) {
    try {
      const wasmDst1 = join(root, 'dist', 'sql-wasm.wasm');
      const wasmDstDir = join(root, 'dist', 'node_modules', 'sql.js', 'dist');
      mkdirSync(wasmDstDir, { recursive: true });
      copyFileSync(wasmSrc, wasmDst1);
      copyFileSync(wasmSrc, join(wasmDstDir, 'sql-wasm.wasm'));
      console.log('[build-main] �?sql-wasm.wasm copied from', wasmSrc);
    } catch (err) {
      console.warn('[build-main] ⚠️ Failed to copy sql-wasm.wasm (non-fatal):', err.message);
    }
  } else {
    console.warn('[build-main] ⚠️ sql-wasm.wasm not found in any candidate path (non-fatal)');
  }

  // Phase 1: Resolve pnpm symlinks so release/build/node_modules/ has real files
  resolveNodeModules();

  // Phase 1.5: Sync external deps to packages/electron/node_modules/
  // electron-builder packages app.asar from packages/electron/node_modules/ (via "files": ["node_modules/**/*"]).
  // pnpm may have hoisted some deps (like yaml) to the root store, making them invisible to the ASAR.
  // This step copies any packages present in release/build/node_modules/ that are MISSING from
  // packages/electron/node_modules/ into the latter, ensuring the ASAR is complete.
  function syncExternalNodeModules() {
    const BUILD_NM = join(root, 'release', 'build', 'node_modules');
    const SRC_NM = join(root, 'node_modules');
    if (!existsSync(BUILD_NM)) return;

    let synced = 0;
    const copyToSrc = (srcPath, dstPath, name) => {
      if (existsSync(dstPath)) return; // already exists, skip
      try {
        cpSync(srcPath, dstPath, { recursive: true, dereference: true, force: true });
        synced++;
        console.log(`[build-main] 📦 Synced external dep '${name}' to packages/electron/node_modules/`);
      } catch (err) {
        console.warn(`[build-main] ⚠️ Failed to sync '${name}': ${err.message}`);
      }
    };

    const entries = readdirSync(BUILD_NM, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.')) continue;
      if (name.startsWith('@')) {
        // Scoped packages: sync individual sub-packages
        if (!existsSync(join(SRC_NM, name))) mkdirSync(join(SRC_NM, name), { recursive: true });
        try {
          const scopedEntries = readdirSync(join(BUILD_NM, name), { withFileTypes: true });
          for (const scoped of scopedEntries) {
            const subName = scoped.name;
            copyToSrc(
              join(BUILD_NM, name, subName),
              join(SRC_NM, name, subName),
              `${name}/${subName}`
            );
          }
        } catch {}
      } else {
        copyToSrc(join(BUILD_NM, name), join(SRC_NM, name), name);
      }
    }
    if (synced > 0) {
      console.log(`[build-main] �?Synced ${synced} missing external dep(s) to packages/electron/node_modules/`);
    } else {
      console.log('[build-main] �?All external deps already present in packages/electron/node_modules/');
    }

    // ── Workspace package special handling ──
    // @codepilot/core is a pnpm workspace symlink. The loop above skips it
    // ("already exists"). We must forcibly replace the symlink with real files
    // so electron-builder includes them in the ASAR.
    if (existsSync(join(SRC_NM, '@codepilot', 'core'))) {
      try {
        const srcCore = join(BUILD_NM, '@codepilot', 'core');
        const dstCore = join(SRC_NM, '@codepilot', 'core');
        const dstReal = realpathSync(dstCore);
        if (dstReal !== resolve(srcCore) && existsSync(srcCore)) {
          rmSync(dstCore, { recursive: true, force: true });
          cpSync(srcCore, dstCore, { recursive: true, dereference: true, force: true });
          console.log('[build-main] 📦 Replaced @codepilot/core symlink with real files');
          // v1.73.58: Fix package.json for asarUnpack — remove pnpm workspace marker
          // 'private: true' is incompatible with Node.js module resolution in ASAR
          try {
            const corePkgPath = join(dstCore, 'package.json');
            const corePkg = JSON.parse(readFileSync(corePkgPath, 'utf8'));
            if (corePkg.private) {
              delete corePkg.private;
              writeFileSync(corePkgPath, JSON.stringify(corePkg, null, 2), 'utf8');
              console.log('[build-main]   Removed "private": true from @codepilot/core/package.json');
            }
          } catch (err) {
            console.warn('[build-main] ⚠️ Failed to fix @codepilot/core package.json:', err.message);
          }
        }
      } catch (err) {
        console.warn('[build-main] ⚠️ Failed to replace @codepilot/core symlink:', err.message);
      }
    }
  }
  syncExternalNodeModules();

  // Final sync: ensure electron node_modules has latest core dist
  {
    const coreDistSrc = resolve(root, '..', 'core', 'dist');
    const coreDistDst = join(root, 'node_modules', '@codepilot', 'core', 'dist');
    if (existsSync(coreDistSrc) && existsSync(coreDistDst)) {
      try {
        cpSync(coreDistSrc, coreDistDst, { recursive: true, force: true, dereference: true });
        console.log('[build-main] Final sync: @codepilot/core dist refreshed from desktop/core/dist');
      } catch (err) {
        console.warn('[build-main] Final sync failed:', err.message);
      }
    }
  }

  // Phase 3: Copy core dist + package.json to dist/__codepilot_dist__/ for asar-internal auto-recovery
  // This dir goes INSIDE app.asar (survives auto-update).
  // v1.73.85: Also copy package.json — needed for Node.js module resolution when
  // the unpacked directory is empty/corrupted (e.g. after asarUnpack failure).
  {
    const coreDistSrc = resolve(root, '..', 'core', 'dist');
    const corePkgSrc = resolve(root, '..', 'core', 'package.json');
    const asarBackupDst = join(root, 'dist', '__codepilot_dist__');
    if (existsSync(coreDistSrc)) {
      try {
        if (existsSync(asarBackupDst)) rmSync(asarBackupDst, { recursive: true, force: true });
        cpSync(coreDistSrc, asarBackupDst, { recursive: true, force: true, dereference: true });
        // Copy package.json alongside dist/ so Node.js can resolve the module
        if (existsSync(corePkgSrc)) {
          const pkg = JSON.parse(readFileSync(corePkgSrc, 'utf8'));
          if (pkg.private) delete pkg.private; // CJS resolution incompatible
          writeFileSync(join(asarBackupDst, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
          console.log('[build-main]   package.json included (private stripped)');
        }
        console.log('[build-main] Asar-internal backup: dist/__codepilot_dist__/');
      } catch (err) {
        console.warn('[build-main] Asar-internal backup failed:', err.message);
      }
    }
  }
} catch (err) {
  console.error('[build-main] Build failed:', err);
  process.exit(1);
}
