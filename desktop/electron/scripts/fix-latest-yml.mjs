/**
 * fix-latest-yml.mjs
 * Post-build script to fix electron-builder latest.yml / latest-linux.yml.
 *
 * Problems electron-builder has:
 * 1. Bare filenames without version subdirectory prefix
 *    → we add the version prefix (e.g. "1.73.88/")
 *
 * 2. Dual-target builds (nsis+portable / AppImage+deb) produce mismatched yml:
 *    files[0] = portable/2nd target info, path = nsis/1st target info
 *    → electron-updater sha512 verification fails because downloaded file
 *      (from path) doesn't match files[0].sha512
 *    → we ALIGN files[0] to match path
 *
 * Run after electron-builder in the build pipeline:
 *   "dist": "... && npx electron-builder build --win --x64 && node scripts/fix-latest-yml.mjs"
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const version = pkg.version;

const builderConfig = JSON.parse(readFileSync(join(root, 'electron-builder.json'), 'utf-8'));
const outputDirRaw = builderConfig.directories?.output || 'release';
const releaseDir = join(root, outputDirRaw);

console.log(`[fix-latest-yml] version=${version}, releaseDir=${releaseDir}`);

/**
 * Parse a YAML-like latest.yml into structured data.
 * Handles simple key: value lines and files array items with indented properties.
 */
function parseLatestYml(content) {
  const lines = content.split('\n');
  const result = { files: [] };
  let currentFile = null;

  for (const line of lines) {
    if (line.startsWith('  - url:') || line.startsWith('    - url:')) {
      if (currentFile) result.files.push(currentFile);
      currentFile = { url: line.replace(/^\s*- url:\s*/, '') };
    } else if (currentFile && line.match(/^\s{4}(sha512|size):/)) {
      const m = line.match(/^\s{4}(\w+):\s*(.+)/);
      if (m) currentFile[m[1]] = m[2];
    } else if (line.startsWith('version:')) {
      result.version = line.replace(/^version:\s*/, '');
    } else if (line.startsWith('path:')) {
      result.path = line.replace(/^path:\s*/, '');
    } else if (line.startsWith('sha512:')) {
      result.sha512 = line.replace(/^sha512:\s*/, '');
    } else if (line.startsWith('releaseDate:')) {
      result.releaseDate = line.replace(/^releaseDate:\s*/, '');
    } else if (line.startsWith('files:')) {
      // skip header
    }
  }
  if (currentFile) result.files.push(currentFile);
  return result;
}

/**
 * Serialize structured data back to YAML-like format.
 */
function formatYml(data) {
  const lines = [];
  if (data.version) lines.push(`version: ${data.version}`);
  lines.push('files:');
  for (const f of data.files) {
    lines.push(`  - url: ${f.url}`);
    if (f.sha512) lines.push(`    sha512: ${f.sha512}`);
    if (f.size) lines.push(`    size: ${f.size}`);
  }
  if (data.path) lines.push(`path: ${data.path}`);
  if (data.sha512) lines.push(`sha512: ${data.sha512}`);
  if (data.releaseDate) lines.push(`releaseDate: ${data.releaseDate}`);
  return lines.join('\n') + '\n';
}

function fixYml(filePath, versionPrefix) {
  if (!existsSync(filePath)) {
    console.log(`[fix-latest-yml] ${filePath} not found, skipping`);
    return;
  }

  const content = readFileSync(filePath, 'utf-8');
  const data = parseLatestYml(content);
  let modified = false;

  console.log(`[fix-latest-yml] ${filePath}:`);
  console.log(`  path: "${data.path}"`);
  console.log(`  files[0].url: "${data.files[0]?.url || '(none)'}"`);

  // ── Fix 1: Add version prefix to path ──
  if (data.path && !data.path.startsWith(versionPrefix + '/')) {
    data.path = `${versionPrefix}/${data.path}`;
    console.log(`  → path: "${data.path}" (added prefix)`);
    modified = true;
  }

  // ── Fix 2: Align files[0] with path ──
  // electron-builder with dual targets puts the 2nd target in files[0]
  // and 1st target in path. This causes sha512 mismatch.
  if (data.files.length > 0 && data.path) {
    const pathBasename = data.path.split('/').pop();
    const file0Url = data.files[0].url;
    const file0Basename = file0Url.split('/').pop();

    if (pathBasename !== file0Basename) {
      console.log(`  ⚠ Mismatch: files[0].url basename="${file0Basename}" ≠ path basename="${pathBasename}"`);

      // Look for an existing files entry that matches path
      const matchingFile = data.files.find(f => {
        const fb = f.url.split('/').pop();
        return fb === pathBasename;
      });

      if (matchingFile) {
        // Move matching file to position 0
        data.files = data.files.filter(f => f !== matchingFile);
        data.files.unshift(matchingFile);
        console.log(`  → files[0] now matches path (reordered)`);
      } else {
        // Create new files[0] from path + top-level sha512 + file size from disk
        const sha512 = data.sha512 || 'TBD';
        let size = 0;
        try {
          // Try to read actual file size from release directory
          const fullPath = join(releaseDir, pathBasename);
          if (existsSync(fullPath)) {
            size = statSync(fullPath).size;
          }
        } catch {}
        data.files.unshift({ url: data.path, sha512, size: String(size) });
        console.log(`  → Created new files[0] from path (sha512=${sha512.slice(0,16)}..., size=${size})`);
      }
      modified = true;
    }

    // Also add version prefix to files[0].url if needed
    if (data.files[0] && !data.files[0].url.startsWith(versionPrefix + '/')) {
      data.files[0].url = `${versionPrefix}/${data.files[0].url}`;
      console.log(`  → files[0].url prefixed`);
      modified = true;
    }
  }

  // ── Fix 3: Add version prefix to additional files entries ──
  for (let i = 1; i < data.files.length; i++) {
    if (!data.files[i].url.startsWith(versionPrefix + '/')) {
      data.files[i].url = `${versionPrefix}/${data.files[i].url}`;
      console.log(`  → files[${i}].url prefixed`);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(filePath, formatYml(data));
    console.log(`  ✅ Fixed and saved`);
  } else {
    console.log(`  OK — no changes needed`);
  }
}

fixYml(join(releaseDir, 'latest.yml'), version);
fixYml(join(releaseDir, 'latest-linux.yml'), version);

console.log('[fix-latest-yml] Done');
