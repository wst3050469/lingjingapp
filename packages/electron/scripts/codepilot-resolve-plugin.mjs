// codepilot-resolve-plugin.mjs — esbuild plugin to resolve @codepilot/core subpath imports
// Fixes: Node.js exports array fallback not supported by esbuild for deep subpaths like
//   @codepilot/core/sync/token-manager → dist/sync/token-manager.js (not dir index.js)
//   @codepilot/core/rules/rule-merger   → dist/rules/rule-merger.js

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Resolve from workspace packages/core/dist/ (always has complete build output)
function findCoreDist() {
  // Try workspace core first
  const candidates = [
    // In CI/build context: packages/electron/scripts/ → root
    resolve(__dirname, '..', '..', '..', 'packages', 'core', 'dist'),
    // Direct workspace
    resolve(__dirname, '..', '..', '..', '..', 'packages', 'core', 'dist'),
    // node_modules fallback
    resolve(__dirname, '..', 'node_modules', '@codepilot', 'core', 'dist'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'index.js'))) return c;
  }
  return null;
}

export function codepilotResolvePlugin() {
  const coreDist = findCoreDist();
  if (!coreDist) {
    console.warn('[codepilot-plugin] ⚠️ @codepilot/core dist not found, plugin disabled');
  }

  return {
    name: 'codepilot-resolve',
    setup(build) {
      if (!coreDist) return;

      // Intercept all @codepilot/core imports (main + subpaths)
      build.onResolve(
        { filter: /^@codepilot\/core(\/.*)?$/ },
        async (args) => {
          // Main entry: @codepilot/core → dist/index.js
          if (args.path === '@codepilot/core' || args.path === '@codepilot/core/') {
            return { path: join(coreDist, 'index.js') };
          }

          // Subpath: @codepilot/core/<subpath>
          const subpath = args.path.slice('@codepilot/core/'.length);
          
          // Try: dist/<subpath>/index.js (directory with barrel export)
          const dirIndex = join(coreDist, subpath, 'index.js');
          if (existsSync(dirIndex)) {
            return { path: dirIndex };
          }

          // Try: dist/<subpath>.js (single file export)
          const singleFile = join(coreDist, subpath + '.js');
          if (existsSync(singleFile)) {
            return { path: singleFile };
          }

          // Not found — let esbuild report the error naturally
          return null;
        }
      );
    },
  };
}
