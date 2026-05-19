// Rename release files with timestamp to avoid confusion
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const releaseDir = path.join(__dirname, '..', 'release');

// Generate timestamp: YYYYMMDD-HHMMSS
const now = new Date();
const timestamp = now.toISOString()
  .replace(/[-:T]/g, '')
  .replace(/\.\d{3}Z/, '')
  .slice(0, 15); // e.g., 20260425-234124 -> 20260425234124

// Find all release files
const files = fs.readdirSync(releaseDir);
const renames = [];

for (const file of files) {
  // Match patterns like: 灵境-Setup-1.0.2-win-x64.exe
  // Also match: 灵境-Setup-1.0.2-win-x64.exe.blockmap, latest.yml
  const match = file.match(/^(灵境-Setup-.*|latest)\.(exe|exe\.blockmap|yml)$/);
  if (match) {
    const baseName = match[1];
    const ext = match[2];
    const newFileName = `${baseName}-${timestamp}.${ext}`;
    const oldPath = path.join(releaseDir, file);
    const newPath = path.join(releaseDir, newFileName);

    renames.push({ old: file, new: newFileName });
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed: ${file} -> ${newFileName}`);
  }
}

// Update latest.yml file references
const latestYml = renames.find(r => r.old === 'latest.yml' || r.old.startsWith('latest-'));
if (latestYml) {
  const latestPath = path.join(releaseDir, latestYml.new);
  let content = fs.readFileSync(latestPath, 'utf-8');

  // Update file references in latest.yml
  for (const rename of renames) {
    if (rename.old.endsWith('.exe') && !rename.old.endsWith('.blockmap')) {
      // Replace old filename with new filename
      content = content.replace(new RegExp(rename.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), rename.new);
    }
  }

  fs.writeFileSync(latestPath, content, 'utf-8');
  console.log('\nUpdated file references in latest.yml');
}

console.log('\nAll release files have been renamed with timestamp.');
