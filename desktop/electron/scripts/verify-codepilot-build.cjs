/**
 * verify-codepilot-build.cjs — 自动化验证 @codepilot/core 构建产物完整性
 *
 * 检查项：
 *  1. electron-builder.json asarUnpack 是否包含 @codepilot
 *  2. after-pack-hook.cjs 是否包含有效的 ASAR 操作逻辑（非 no-op）
 *  3. build-main.mjs EXTERNAL 数组状态
 *  4. 如果 app.asar 已存在：检查内部是否不含 @codepilot/core
 *  5. 如果 app.asar.unpacked 存在：确认 @codepilot/core 作为真实文件存在
 *
 * 用法：
 *   node scripts/verify-codepilot-build.cjs                    # 仅检查配置
 *   node scripts/verify-codepilot-build.cjs --asar             # 同时检查 asar 内容
 *   node scripts/verify-codepilot-build.cjs --fix              # 自动修复配置
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ELECTRON_DIR = path.resolve(__dirname, '..');
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
const INFO = '\x1b[36m→\x1b[0m';

let errors = 0;
let warnings = 0;
let fixes = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ${PASS} ${message}`);
  } else {
    console.log(`  ${FAIL} ${message}`);
    errors++;
  }
}

function warn(condition, message) {
  if (!condition) {
    console.log(`  ${WARN} ${message}`);
    warnings++;
  }
}

// ─── Check 1: electron-builder.json asarUnpack ───
console.log('\n[1/5] 检查 electron-builder.json asarUnpack 配置...');
const builderJsonPath = path.join(ELECTRON_DIR, 'electron-builder.json');
let builderJson;
try {
  builderJson = JSON.parse(fs.readFileSync(builderJsonPath, 'utf8'));
} catch (e) {
  console.log(`  ${FAIL} 无法读取 electron-builder.json: ${e.message}`);
  process.exit(1);
}

const asarUnpack = builderJson.asarUnpack || [];
const hasCodepilotUnpack = asarUnpack.some(p => p.includes('@codepilot'));
check(hasCodepilotUnpack, 'asarUnpack 包含 @codepilot 配置');

if (!hasCodepilotUnpack) {
  const args = process.argv.slice(2);
  if (args.includes('--fix')) {
    builderJson.asarUnpack = asarUnpack;
    builderJson.asarUnpack.push('node_modules/@codepilot/**');
    fs.writeFileSync(builderJsonPath, JSON.stringify(builderJson, null, 2) + '\n', 'utf8');
    console.log(`  ${INFO} 已自动修复: 添加 "node_modules/@codepilot/**" 到 asarUnpack`);
    fixes++;
  } else {
    console.log(`  ${INFO} 建议执行: node scripts/verify-codepilot-build.cjs --fix`);
  }
}

// ─── Check 2: after-pack-hook.cjs 有效性 ───
console.log('\n[2/5] 检查 after-pack-hook.cjs 有效性...');
const hookPath = path.join(ELECTRON_DIR, 'scripts', 'after-pack-hook.cjs');
let hookContent;
try {
  hookContent = fs.readFileSync(hookPath, 'utf8');
} catch (e) {
  console.log(`  ${FAIL} 无法读取 after-pack-hook.cjs: ${e.message}`);
  process.exit(1);
}

const isNoop = hookContent.includes('The destructive ASAR repacking logic has been removed') ||
               (hookContent.match(/console\.log/g) || []).length <= 2;
check(!isNoop, 'after-pack-hook.cjs 包含有效的 ASAR 操作逻辑（非 no-op）');

// Check for key operations
const hasAsarExtract = hookContent.includes('asar extract') || hookContent.includes('asar e');
const hasDeleteCodepilot = hookContent.includes('@codepilot') && 
                           (hookContent.includes('rmSync') || hookContent.includes('rmdir') || hookContent.includes('rimraf'));
const hasAsarPack = hookContent.includes('asar pack') || hookContent.includes('asar p');
warn(hasAsarExtract, 'after-pack-hook 包含 asar extract 操作');
warn(hasDeleteCodepilot, 'after-pack-hook 包含删除 @codepilot 操作');
warn(hasAsarPack, 'after-pack-hook 包含 asar pack 操作');

// ─── Check 3: build-main.mjs EXTERNAL 数组 ───
console.log('\n[3/5] 检查 build-main.mjs EXTERNAL 配置...');
const buildMainPath = path.join(ELECTRON_DIR, 'scripts', 'build-main.mjs');
let buildContent;
try {
  buildContent = fs.readFileSync(buildMainPath, 'utf8');
} catch (e) {
  console.log(`  ${FAIL} 无法读取 build-main.mjs: ${e.message}`);
}

// Extract EXTERNAL array content
const externalMatch = buildContent.match(/const EXTERNAL\s*=\s*\[([\s\S]*?)\];/);
if (externalMatch) {
  const externalContent = externalMatch[1];
  const codepilotEntries = (externalContent.match(/@codepilot[^"'\s,]*/g) || []);
  console.log(`  ${INFO} EXTERNAL 中包含 ${codepilotEntries.length} 个 @codepilot 条目`);
  codepilotEntries.forEach(e => console.log(`    - ${e}`));

  // If @codepilot is external AND not in asarUnpack AND afterPack is noop → dangerous
  if (codepilotEntries.length > 0 && !hasCodepilotUnpack && isNoop) {
    console.log(`\n  ${FAIL} ⚡ 严重风险: @codepilot 在 EXTERNAL 中 → esbuild 不打包`);
    console.log(`  ${FAIL}            asarUnpack 未配置 → 进入 app.asar`);
    console.log(`  ${FAIL}            afterPack 是 no-op → 未从 ASAR 中删除`);
    console.log(`  ${FAIL}            结果: NSIS 安装后首次启动必然崩溃!`);
  }
} else {
  console.log(`  ${WARN} 无法解析 EXTERNAL 数组`);
}

// ─── Check 4: app.asar 内容检查（如果存在）───
const args = process.argv.slice(2);
if (args.includes('--asar')) {
  console.log('\n[4/5] 检查 app.asar 内容...');
  const unpackedDir = path.join(ELECTRON_DIR, 'release', 'win-unpacked');
  const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
  
  if (fs.existsSync(asarPath)) {
    try {
      const result = execSync(`npx @electron/asar list "${asarPath}"`, {
        cwd: ELECTRON_DIR,
        stdio: 'pipe',
        timeout: 30000,
        encoding: 'utf8',
      });
      
      const hasCodepilotInAsar = result.includes('node_modules/@codepilot');
      check(!hasCodepilotInAsar, 'app.asar 内不含 @codepilot/core（安全）');
      
      if (hasCodepilotInAsar) {
        console.log(`  ${INFO} @codepilot/core 仍在 app.asar 内 → NSIS 安装有崩溃风险`);
        // Count occurrences
        const lines = result.split('\n').filter(l => l.includes('@codepilot'));
        console.log(`  ${INFO} 发现 ${lines.length} 个 @codepilot 相关文件在 ASAR 内`);
      }
    } catch (e) {
      console.log(`  ${WARN} 无法列出 app.asar 内容: ${e.message}`);
    }
  } else {
    console.log(`  ${INFO} app.asar 不存在（跳过硬打包检查）`);
    console.log(`    路径: ${asarPath}`);
  }

  // ─── Check 5: app.asar.unpacked 检查 ───
  console.log('\n[5/5] 检查 app.asar.unpacked...');
  const unpackedAsar = asarPath + '.unpacked';
  if (fs.existsSync(unpackedAsar)) {
    const codepilotUnpacked = path.join(unpackedAsar, 'node_modules', '@codepilot', 'core');
    const hasUnpackedCodepilot = fs.existsSync(codepilotUnpacked);
    check(hasUnpackedCodepilot, 'app.asar.unpacked 中包含 @codepilot/core 真实文件');
    
    if (hasUnpackedCodepilot) {
      const distExists = fs.existsSync(path.join(codepilotUnpacked, 'dist'));
      const pkgExists = fs.existsSync(path.join(codepilotUnpacked, 'package.json'));
      check(distExists, '  @codepilot/core/dist/ 存在');
      check(pkgExists, '  @codepilot/core/package.json 存在');
    }
  } else {
    console.log(`  ${INFO} app.asar.unpacked 不存在（仅在 electron-builder 打包后生成）`);
  }
} else {
  console.log('\n[4/5] 跳过硬打包检查（使用 --asar 参数启用）');
  console.log('[5/5] 同上');
}

// ─── Summary ───
console.log('\n' + '='.repeat(60));
console.log('验证总结');
console.log('='.repeat(60));
console.log(`  错误: ${errors}  警告: ${warnings}  自动修复: ${fixes}`);

if (errors === 0) {
  console.log(`\n  ${PASS} 构建配置安全 — @codepilot/core 不会导致 NSIS 崩溃\n`);
  process.exit(0);
} else {
  console.log(`\n  ${FAIL} 发现 ${errors} 个问题 — NSIS 安装后有崩溃风险`);
  console.log(`  ${INFO} 修复方法:`);
  console.log(`      node scripts/verify-codepilot-build.cjs --fix    # 自动修复配置`);
  console.log(`      node scripts/verify-codepilot-build.cjs --asar   # 完整检查（含 asar）\n`);
  process.exit(1);
}
