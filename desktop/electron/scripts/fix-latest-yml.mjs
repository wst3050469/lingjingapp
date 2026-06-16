/**
 * fix-latest-yml.mjs
 * Post-build script to fix electron-builder latest.yml paths.
 *
 * Problem: electron-builder generates latest.yml with bare filenames
 * (e.g. "path: 灵境 Setup 1.73.88.exe") but we deploy files in version
 * subdirectories (/downloads/1.73.88/).
 *
 * This script adds the version prefix and aligns files[0] with path/sha512.
 *
 * Run after electron-builder in the build pipeline.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const version = pkg.version;

// electron-builder output directory from electron-builder.json
const builderConfig = JSON.parse(readFileSync(join(root, 'electron-builder.json'), 'utf-8'));
// Parse output dir — e.g. "release-v17388"
const outputDirRaw = builderConfig.directories?.output || 'release';
const releaseDir = join(root, outputDirRaw);

console.log(`[fix-latest-yml] version=${version}, releaseDir=${releaseDir}`);

function fixYml(filePath, versionPrefix) {
  if (!existsSync(filePath)) {
    console.log(`[fix-latest-yml] ${filePath} not found, skipping`);
    return;
  }

  let content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  // Extract current path
  let currentPath = '';
  const pathLineIdx = lines.findIndex(l => l.startsWith('path:'));
  if (pathLineIdx >= 0) {
    currentPath = lines[pathLineIdx].replace(/^path:\s*/, '');
  }

  console.log(`[fix-latest-yml] ${filePath}: current path = "${currentPath}"`);

  // Check if path already has version prefix
  if (currentPath.startsWith(versionPrefix + '/')) {
    console.log(`[fix-latest-yml]   Path already has version prefix — OK`);
    return;
  }

  // Fix path line
  const newPath = `${versionPrefix}/${currentPath}`;
  lines[pathLineIdx] = `path: ${newPath}`;
  console.log(`[fix-latest-yml]   path: "${currentPath}" → "${newPath}"`);
  modified = true;

  // Fix files[0].url line
  const urlLineIdx = lines.findIndex(l => l.trimStart().startsWith('- url:'));
  if (urlLineIdx >= 0) {
    const oldUrl = lines[urlLineIdx].replace(/^\s*- url:\s*/, '');
    if (!oldUrl.startsWith(versionPrefix + '/')) {
      const newUrl = `${versionPrefix}/${oldUrl}`;
      lines[urlLineIdx] = lines[urlLineIdx].replace(oldUrl, newUrl);
      console.log(`[fix-latest-yml]   files[0].url: "${oldUrl}" → "${newUrl}"`);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(filePath, lines.join('\n'));
    console.log(`[fix-latest-yml]   ✅ Fixed`);
  }
}

fixYml(join(releaseDir, 'latest.yml'), version);
fixYml(join(releaseDir, 'latest-linux.yml'), version);

console.log('[fix-latest-yml] Done');
