import { readFileSync, writeFileSync } from 'fs';
const path = 'D:/lingjing-ide/desktop/electron/scripts/build-main.mjs';
const c = readFileSync(path, 'utf8');
const lines = c.split('\n');

// Find line: '          _entries = _fs2.readdirSync(src);',
// and the next line: '        for (var _i = 0;...'
// Insert a '        }' between them

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("_entries = _fs2.readdirSync(src);") &&
      lines[i+1] && lines[i+1].includes("for (var _i = 0; _i < _entries.length; _i++)")) {
    // Extract indentation from the for line
    const indent = lines[i+1].match(/^(\s*)'/)?.[1] || '';
    const newLine = indent + "'        }',";
    console.log('Inserting at line', i+1, ':', newLine);
    lines.splice(i + 1, 0, newLine);
    writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed!');
    process.exit(0);
  }
}
console.log('Pattern not found');
process.exit(1);
