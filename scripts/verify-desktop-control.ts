/**
 * 灵境外设控制 — 构建时接口完整性验证脚本
 *
 * 用途：验证打包后的 main.js 中所有 IPC handler 已正确注册
 * 运行：cd packages/electron && npx tsx ../../scripts/verify-desktop-control.ts
 *
 * 验证范围：
 *   - 桌面控制 16 个 IPC handler (robotjs)
 *   - 权限管理 5 个 IPC handler
 *   - 摄像头权限 3 个 IPC handler
 *   - 麦克风权限 3 个 IPC handler
 *   - Preload API 暴露完整性
 *   - 安全模式 (延迟加载 / 错误包装 / 权限门禁)
 *   - 反幻觉 (确认不存在的 handler 确实不存在)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ═══════════════════════════════════════════════
// 接口定义 — 期望存在的所有 IPC channel
// ═══════════════════════════════════════════════

const DESKTOP_IPC = [
  'desktop-control:mouse-position',
  'desktop-control:mouse-move',
  'desktop-control:mouse-move-smooth',
  'desktop-control:mouse-click',
  'desktop-control:mouse-toggle',
  'desktop-control:mouse-drag',
  'desktop-control:mouse-scroll',
  'desktop-control:keyboard-type',
  'desktop-control:keyboard-type-delayed',
  'desktop-control:keyboard-tap',
  'desktop-control:keyboard-toggle',
  'desktop-control:screen-size',
  'desktop-control:screen-capture',
  'desktop-control:pixel-color',
  'desktop-control:set-mouse-delay',
  'desktop-control:set-keyboard-delay',
];

const PERM_IPC = [
  'desktop-control:has-password',
  'desktop-control:set-password',
  'desktop-control:verify-password',
  'desktop-control:is-enabled',
  'desktop-control:set-enabled',
];

const CAMERA_IPC = [
  'permission:camera:is-enabled',
  'permission:camera:set-enabled',
  'permission:camera:get-status',
];

const MIC_IPC = [
  'permission:microphone:is-enabled',
  'permission:microphone:set-enabled',
  'permission:microphone:get-status',
];

// ═══════════════════════════════════════════════
// 反幻觉 — 不应存在的 fake handler
// ═══════════════════════════════════════════════

const FAKE_HANDLERS = [
  'camera:capture-photo',
  'camera:start-stream',
  'camera:stop-stream',
  'camera:capture-frame',
];

// ═══════════════════════════════════════════════
// 安全模式检查
// ═══════════════════════════════════════════════

const SECURITY_PATTERNS = [
  { name: 'checkDesktopControlEnabled', pattern: 'desktopControlEnabled' },
  { name: 'PERMISSION_DENIED',          pattern: 'PERMISSION_DENIED' },
  { name: 'robotjs 延迟加载',           pattern: 'require("robotjs")' },
  { name: '参数校验 (坐标)',            pattern: String.raw`\u5750\u6807\u53C2\u6570\u65E0\u6548` },
  { name: '参数校验 (文本为空)',        pattern: String.raw`\u8F93\u5165\u6587\u672C\u4E0D\u80FD\u4E3A\u7A7A` },
  { name: '操控权限提示',               pattern: String.raw`\u64CD\u63A7\u6743\u9650` },
];

// ═══════════════════════════════════════════════
// Preload 检查
// ═══════════════════════════════════════════════

const PRELOAD_CHECKS = [
  { name: 'desktopControl.mouse', pattern: /desktop-control:mouse-/ },
  { name: 'desktopControl.keyboard', pattern: /desktop-control:keyboard-/ },
  { name: 'desktopControl.screen', pattern: /desktop-control:screen-/ },
  { name: 'permissions.camera', pattern: /permission:camera:/ },
  { name: 'permissions.microphone', pattern: /permission:microphone:/ },
];

// ═══════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════

interface Item {
  name: string;
  pass: boolean;
  detail?: string;
}

interface Section {
  title: string;
  items: Item[];
  passed: number;
  failed: number;
}

function checkStrings(code: string, names: string[]): Item[] {
  return names.map(n => ({
    name: n,
    pass: code.includes(n),
    detail: code.includes(n) ? undefined : `未找到 "${n}"`,
  }));
}

function checkNotExist(code: string, names: string[]): Item[] {
  return names.map(n => ({
    name: `不应存在: ${n}`,
    pass: !code.includes(n),
    detail: code.includes(n) ? `⚠️ 意外发现 "${n}"` : undefined,
  }));
}

function checkPatterns(code: string, patterns: { name: string; pattern: string | RegExp }[]): Item[] {
  return patterns.map(p => {
    const found = typeof p.pattern === 'string'
      ? code.includes(p.pattern)
      : p.pattern.test(code);
    return { name: p.name, pass: found, detail: found ? undefined : `未匹配到模式` };
  });
}

function printSection(s: Section): boolean {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${s.title}  (通过: ${s.passed}/${s.passed + s.failed})`);
  console.log(`${'─'.repeat(60)}`);
  for (const item of s.items) {
    const icon = item.pass ? '✅' : '❌';
    const detail = item.detail ? `  ← ${item.detail}` : '';
    console.log(`  ${icon} ${item.name}${detail}`);
  }
  return s.failed === 0;
}

function mkSection(title: string, items: Item[]): Section {
  return {
    title,
    items,
    passed: items.filter(i => i.pass).length,
    failed: items.filter(i => !i.pass).length,
  };
}

// ═══════════════════════════════════════════════
// 入口
// ═══════════════════════════════════════════════

async function main() {
  console.log('🔍 灵境外设控制 — 接口完整性验证');
  console.log('═'.repeat(60));

  const mainJs = join(ROOT, 'packages', 'electron', 'dist', 'main.js');
  const preloadJs = join(ROOT, 'packages', 'electron', 'dist', 'preload.js');

  console.log(`\n📁 main.js   = ${mainJs}  (${existsSync(mainJs) ? '存在' : '❌不存在'})`);
  console.log(`📁 preload.js = ${preloadJs}  (${existsSync(preloadJs) ? '存在' : '❌不存在'})`);

  if (!existsSync(mainJs) || !existsSync(preloadJs)) {
    console.log('\n❌ 构建产物不存在，请先构建 Electron:');
    console.log('   cd packages/electron && node scripts/build-main.mjs');
    process.exit(1);
  }

  const mainCode = readFileSync(mainJs, 'utf8');
  const preloadCode = readFileSync(preloadJs, 'utf8');

  console.log(`\n📊 main.js   大小: ${(mainCode.length / 1024).toFixed(0)} KB`);
  console.log(`📊 preload.js 大小: ${(preloadCode.length / 1024).toFixed(1)} KB`);

  const sections: Section[] = [
    mkSection('🐭 桌面控制 IPC (16个)', checkStrings(mainCode, DESKTOP_IPC)),
    mkSection('🔑 权限管理 IPC (5个)', checkStrings(mainCode, PERM_IPC)),
    mkSection('📷 摄像头权限 IPC (3个)', checkStrings(mainCode, CAMERA_IPC)),
    mkSection('🎤 麦克风权限 IPC (3个)', checkStrings(mainCode, MIC_IPC)),
    mkSection('📦 Preload API 暴露 (5个)', checkPatterns(preloadCode, PRELOAD_CHECKS)),
    mkSection('🛡️ 安全模式 (6项)', checkPatterns(mainCode, SECURITY_PATTERNS)),
    mkSection('🔍 反幻觉检查 (4项)', checkNotExist(mainCode, FAKE_HANDLERS)),
  ];

  let allPassed = true;
  for (const s of sections) {
    allPassed = printSection(s) && allPassed;
  }

  // ── 最终结果 ──
  const total = sections.reduce((a, s) => a + s.items.length, 0);
  const passed = sections.reduce((a, s) => a + s.passed, 0);
  const failed = sections.reduce((a, s) => a + s.failed, 0);

  console.log(`\n${'═'.repeat(60)}`);
  if (allPassed) {
    console.log(`✅ 全部 ${passed}/${total} 项通过 — 接口完整性正常`);
  } else {
    console.log(`❌ ${failed}/${total} 项失败 — 请检查以上输出`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  if (!allPassed) process.exit(1);

  // ── 打印接口全貌 ──
  console.log('📋 灵境 v1.73.162 外设控制接口全貌');
  console.log('─'.repeat(60));
  console.log(`\n桌面控制: ${DESKTOP_IPC.length} 个 handler ✅`);
  console.log(`权限管理: ${PERM_IPC.length} 个 handler ✅`);
  console.log(`摄像头:   ${CAMERA_IPC.length} 个 handler (仅权限) ⚠️`);
  console.log(`麦克风:   ${MIC_IPC.length} 个 handler (仅权限) ⚠️`);
  console.log('\n⚠️ 摄像头/麦克风无实际拍照/录音功能，仅权限开关。');
  console.log('   语音输入由浏览器 getUserMedia 实现，受 microphoneEnabled 保护。');
}

main().catch(err => {
  console.error('❌ 验证脚本异常:', err);
  process.exit(1);
});
