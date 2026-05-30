const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'packages/core/dist/fusion/integration/index.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('File length:', content.length);
console.log('Contains CRLF:', content.indexOf('\r\n') >= 0);
console.log('Contains LF only:', content.indexOf('\n') >= 0 && content.indexOf('\r\n') < 0);

// Use actual newline from the file
const nl = content.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
console.log('Newline type:', nl === '\r\n' ? 'CRLF' : 'LF');

// Split and filter out the patch-renderer export line
const lines = content.split(nl);
let found = false;
const newLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("from './patch-renderer.js'")) {
    console.log('Found patch-renderer export at line', i + 1);
    found = true;
    continue; // skip this line
  }
  newLines.push(line);
}

if (!found) {
  console.log('patch-renderer export not found!');
  process.exit(1);
}

// Update the comment block
const newContent = newLines.join(nl)
  .replace(
    'Batch C (P1 Renderer UI路由注册 + scifi-dark主题切换 + OpenSpace集成完善)',
    'Batch C (P1 Renderer UI)'
  )
  .replace(
    '- patch-renderer.tsx     → Fusion/OpenSpace 侧栏面板注册 + 懒加载组件映射' + nl,
    ''
  )
  .replace(
    nl + nl + nl,
    nl + nl
  )
  // Add NOTE about exclusion
  .replace(
    'NOTE: patch-renderer excluded',
    'NOTE: patch-renderer excluded (imports react, crashes Electron main process)'
  );

// Check if we need to add the NOTE
if (!newContent.includes('NOTE: patch-renderer excluded')) {
  // Add note after the comment about openspace
  const noteLine = ' * NOTE: patch-renderer excluded (imports react, crashes Electron main process)';
  const withNote = newContent.replace(
    ' * - patch-openspace.ts     → OpenSpace 路径检测 + WebSocket/窗口嵌入说明 + Lua脚本',
    ' * - patch-openspace.ts     → OpenSpace 路径检测 + WebSocket/窗口嵌入说明 + Lua脚本' + nl + noteLine
  );
  
  fs.writeFileSync(filePath, withNote, 'utf8');
  console.log('Written with NOTE');
} else {
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Written without NOTE replacement needed');
}

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('patch-renderer in file:', verify.includes('patch-renderer.js'));
console.log('react import in file:', verify.includes("'react'"));
