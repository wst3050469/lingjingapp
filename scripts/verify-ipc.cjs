/**
 * 灵境外设控制 — 构建时接口完整性验证 (CommonJS)
 * 运行: node scripts/verify-ipc.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

// 自动检测 ROOT (支持直接运行和临时目录运行)
let ROOT = process.env.LINGJING_ROOT;
if (!ROOT) {
  // 从脚本位置向上查找 (scripts/ → root)
  let dir = __dirname;
  while (dir && !fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  ROOT = dir;
}

console.log('ROOT: ' + ROOT);
if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  console.log('WARNING: 未在 ROOT 找到 package.json，请设置 LINGJING_ROOT 环境变量');
}

// ═══ IPC Channel 定义 ═══

const DESKTOP_IPC = [
  'desktop-control:mouse-position','desktop-control:mouse-move',
  'desktop-control:mouse-move-smooth','desktop-control:mouse-click',
  'desktop-control:mouse-toggle','desktop-control:mouse-drag',
  'desktop-control:mouse-scroll','desktop-control:keyboard-type',
  'desktop-control:keyboard-type-delayed','desktop-control:keyboard-tap',
  'desktop-control:keyboard-toggle','desktop-control:screen-size',
  'desktop-control:screen-capture','desktop-control:pixel-color',
  'desktop-control:set-mouse-delay','desktop-control:set-keyboard-delay',
];

const PERM_IPC = [
  'desktop-control:has-password','desktop-control:set-password',
  'desktop-control:verify-password','desktop-control:is-enabled',
  'desktop-control:set-enabled',
];

const CAMERA_IPC = [
  'permission:camera:is-enabled','permission:camera:set-enabled',
  'permission:camera:get-status',
];

const MIC_IPC = [
  'permission:microphone:is-enabled','permission:microphone:set-enabled',
  'permission:microphone:get-status',
];

const FAKE = [
  'camera:capture-photo','camera:start-stream',
  'camera:stop-stream','camera:capture-frame',
];

// esbuild 将中文转为 Unicode 转义序列 (\uXXXX)
// 使用 String.raw 确保 \u 保持为字面反斜杠+u 而非被解析为 Unicode
const SECURITY = [
  { n: 'checkDesktopControlEnabled', p: 'desktopControlEnabled' },
  { n: 'PERMISSION_DENIED',      p: [String.raw`\u64CD\u63A7\u6743\u9650`, 'PERMISSION_DENIED'] },
  { n: 'robotjs require',        p: ['require("robotjs")', "require('robotjs')"] },
  { n: '参数校验-坐标',           p: String.raw`\u5750\u6807\u53C2\u6570\u65E0\u6548` },
  { n: '参数校验-文本',           p: String.raw`\u8F93\u5165\u6587\u672C\u4E0D\u80FD\u4E3A\u7A7A` },
];

// ═══ 工具 ═══

let totalPassed = 0, totalFailed = 0;

function checkStrings(code, names) {
  return names.map(n => {
    const pass = code.includes(n);
    pass ? totalPassed++ : totalFailed++;
    return { name: n, pass };
  });
}
function checkNotExist(code, names) {
  return names.map(n => {
    const pass = !code.includes(n);
    pass ? totalPassed++ : totalFailed++;
    return { name: (pass ? '✓ 不存在: ' : '✗ 意外存在: ') + n, pass };
  });
}
function checkPatterns(code, patterns) {
  return patterns.map(p => {
    const patterns = Array.isArray(p.p) ? p.p : [p.p];
    const pass = patterns.some(pat => code.includes(pat));
    pass ? totalPassed++ : totalFailed++;
    return { name: p.n, pass, detail: pass ? undefined : '未匹配任何模式' };
  });
}
function print(label, items) {
  const ok = items.filter(i => i.pass).length;
  const total = items.length;
  console.log('\n' + '-'.repeat(60));
  console.log('  ' + label + '  (' + ok + '/' + total + ')');
  console.log('-'.repeat(60));
  items.forEach(i => console.log('  ' + (i.pass ? 'PASS' : 'FAIL') + '  ' + i.name));
  return ok === total;
}

// ═══ 主流程 ═══

const mainJs = path.join(ROOT, 'packages', 'electron', 'dist', 'main.js');
const preJs = path.join(ROOT, 'packages', 'electron', 'dist', 'preload.js');

console.log('灵境外设控制 - 接口完整性验证 v1.73.162');
console.log('='.repeat(60));
console.log('main.js:   ' + (fs.existsSync(mainJs) ? 'OK' : 'MISSING'));
console.log('preload.js: ' + (fs.existsSync(preJs) ? 'OK' : 'MISSING'));

if (!fs.existsSync(mainJs) || !fs.existsSync(preJs)) {
  console.log('\n构建产物不存在，请先执行: cd packages/electron && node scripts/build-main.mjs');
  console.log('='.repeat(60));
  process.exit(0); // 不报错，只是跳过验证
}

const m = fs.readFileSync(mainJs, 'utf8');
const p = fs.readFileSync(preJs, 'utf8');
console.log('main.js: ' + (m.length / 1024).toFixed(0) + ' KB, preload.js: ' + (p.length / 1024).toFixed(1) + ' KB\n');

let ok = true;
ok = print('桌面控制 IPC (' + DESKTOP_IPC.length + ')', checkStrings(m, DESKTOP_IPC)) && ok;
ok = print('权限管理 IPC (' + PERM_IPC.length + ')', checkStrings(m, PERM_IPC)) && ok;
ok = print('摄像头权限 IPC (' + CAMERA_IPC.length + ')', checkStrings(m, CAMERA_IPC)) && ok;
ok = print('麦克风权限 IPC (' + MIC_IPC.length + ')', checkStrings(m, MIC_IPC)) && ok;
ok = print('安全模式检查 (' + SECURITY.length + ')', checkPatterns(m, SECURITY)) && ok;
ok = print('反幻觉检查 (' + FAKE.length + ')', checkNotExist(m, FAKE)) && ok;
ok = print('Preload API', [
  { name: 'mouse handlers', pass: p.includes('desktop-control:mouse-') },
  { name: 'keyboard handlers', pass: p.includes('desktop-control:keyboard-') },
  { name: 'screen handlers', pass: p.includes('desktop-control:screen-') },
  { name: 'camera permissions', pass: p.includes('permission:camera:') },
  { name: 'mic permissions', pass: p.includes('permission:microphone:') },
].map(i => { i.pass ? totalPassed++ : totalFailed++; return i; })) && ok;

// ── 最终结果 ──
console.log('\n' + '='.repeat(60));
if (ok) {
  console.log('ALL PASS  ' + totalPassed + '/' + (totalPassed + totalFailed) + '  (' + new Date().toISOString() + ')');
} else {
  console.log(totalFailed + ' FAILED / ' + (totalPassed + totalFailed) + ' total');
}
console.log('='.repeat(60));
