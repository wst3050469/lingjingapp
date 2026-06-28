#!/usr/bin/env node
/**
 * 灵境移动端 — App.tsx 防回归检查
 * 
 * 检查项:
 * 1. DefaultTheme/DarkTheme 是否从 @react-navigation/native 导入
 * 2. NavigationContainer theme 是否基于标准主题展开 (非手动构造)
 * 
 * 退出码: 0=通过, 1=不通过
 * 
 * 用法: node scripts/validate-app-theme.js
 */

const fs = require('fs');
const path = require('path');

const APP_TSX = path.join(__dirname, '..', 'App.tsx');

let errors = 0;
let warnings = 0;

console.log('🔍 灵境移动端 App.tsx 防回归检查');
console.log(`  文件: ${APP_TSX}\n`);

if (!fs.existsSync(APP_TSX)) {
    console.error('❌ App.tsx 不存在!');
    process.exit(1);
}

const content = fs.readFileSync(APP_TSX, 'utf-8');
const lines = content.split('\n');

// ── 检查 1: DefaultTheme/DarkTheme 导入 ──
const importLine = lines.find(l => l.includes('@react-navigation/native'));
if (!importLine || !importLine.includes('NavigationContainer')) {
    console.error('❌ 未找到 NavigationContainer 导入');
    errors++;
} else {
    const hasDefaultTheme = importLine.includes('DefaultTheme');
    const hasDarkTheme = importLine.includes('DarkTheme');
    
    if (!hasDefaultTheme || !hasDarkTheme) {
        console.error(`❌ DefaultTheme/DarkTheme 未导入!`);
        console.error(`   当前: ${importLine.trim()}`);
        console.error(`   期望: import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';`);
        errors++;
    } else {
        console.log('✅ DefaultTheme/DarkTheme 已正确导入');
    }
}

// ── 检查 2: theme 手动构造模式 ──
// 危险模式: <NavigationContainer theme={{ dark: ... }}
const manualThemePattern = /<NavigationContainer\s+theme=\{\{/;
if (manualThemePattern.test(content)) {
    console.error('❌ 检测到手动构造 theme! (theme={{...}})');
    console.error('   这是导致 APP 崩溃的根因，必须使用 ...DarkTheme / ...DefaultTheme 展开');
    errors++;
} else {
    console.log('✅ 未检测到手动构造 theme');
}

// ── 检查 3: theme 展开模式 ──
const spreadDarkPattern = /\.\.\.DarkTheme/;
const spreadDefaultPattern = /\.\.\.DefaultTheme/;
if (!spreadDarkPattern.test(content) || !spreadDefaultPattern.test(content)) {
    console.error('❌ 未检测到 ...DarkTheme / ...DefaultTheme 展开模式!');
    console.error('   theme 必须基于标准主题展开: { ...DarkTheme, colors: {...} }');
    errors++;
} else {
    console.log('✅ theme 使用标准主题展开模式');
}

// ── 检查 4: fonts 字段 ──
// 在 NavigationContainer 后到 </NavigationContainer> 之间不应该有手动的 fonts
const navStartIdx = lines.findIndex(l => l.includes('<NavigationContainer'));
if (navStartIdx >= 0) {
    let inNav = false;
    for (let i = navStartIdx; i < Math.min(lines.length, navStartIdx + 30); i++) {
        if (lines[i].includes('<NavigationContainer')) inNav = true;
        if (lines[i].includes('fonts:') && !lines[i].includes('...DarkTheme') && !lines[i].includes('...DefaultTheme')) {
            console.warn('⚠️  检测到手动 fonts 字段定义（可能不必要）');
            warnings++;
        }
        if (lines[i].includes('>') && inNav && lines[i].trim() === '>') break;
    }
}

// ── 结果 ──
console.log(`\n${'═'.repeat(50)}`);
if (errors === 0) {
    console.log('✅ 所有检查通过! App.tsx theme 配置安全');
    process.exit(0);
} else {
    console.error(`❌ ${errors} 个错误, ${warnings} 个警告`);
    console.error('\n💡 修复方法:');
    console.error('  1. 导入 DefaultTheme, DarkTheme:');
    console.error('     import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";');
    console.error('  2. 使用标准主题展开:');
    console.error('     <NavigationContainer theme={isDarkMode');
    console.error('       ? { ...DarkTheme, colors: { ...DarkTheme.colors, ...customDark } }');
    console.error('       : { ...DefaultTheme, colors: { ...DefaultTheme.colors, ...customLight } }');
    console.error('     }>');
    process.exit(1);
}
