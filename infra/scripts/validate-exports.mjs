/**
 * Export Validation Script
 * 
 * Validates that all named re-exports in packages/core/dist/index.js
 * actually exist in their target modules.
 * 
 * Usage: node scripts/validate-exports.mjs
 * 
 * This prevents runtime errors like:
 *   "does not provide an export named 'X'"
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CORE_DIST = resolve(PROJECT_ROOT, 'packages/core/dist');
const INDEX_FILE = resolve(CORE_DIST, 'index.js');

// Patterns for matching export statements
const NAMED_REEXPORT_RE = /export\s*\{\s*([^}]+)\s*\}\s*from\s+['"]([^'"]+)['"]\s*;?/g;
const STAR_REEXPORT_RE = /export\s*\*\s*from\s+['"]([^'"]+)['"]\s*;?/g;
const NAMESPACE_REEXPORT_RE = /export\s*\*\s*as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?/g;

/**
 * Parse all named exports from a JS module file.
 * Returns a Set of export names.
 */
function parseExports(filePath) {
    if (!existsSync(filePath)) {
        return new Set();
    }
    
    const content = readFileSync(filePath, 'utf-8');
    const exports = new Set();
    
    // Named exports: export { a, b, c }
    const namedExportRe = /export\s*\{([^}]+)\}/g;
    let match;
    while ((match = namedExportRe.exec(content)) !== null) {
        const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop());
        names.forEach(n => {
            if (n && !n.startsWith('/')) exports.add(n);
        });
    }
    
    // Named function exports: export function xxx
    const funcExportRe = /export\s+(?:async\s+)?function\s+(\w+)/g;
    while ((match = funcExportRe.exec(content)) !== null) {
        exports.add(match[1]);
    }
    
    // Named class exports: export class xxx
    const classExportRe = /export\s+(?:default\s+)?class\s+(\w+)/g;
    while ((match = classExportRe.exec(content)) !== null) {
        exports.add(match[1]);
    }
    
    // Named const exports: export const xxx
    const constExportRe = /export\s+(?:const|let|var)\s+(\w+)/g;
    while ((match = constExportRe.exec(content)) !== null) {
        exports.add(match[1]);
    }
    
    // Declaration exports: export interface xxx, export type xxx (for .d.ts)
    const declExportRe = /export\s+(?:interface|type|declare)\s+(\w+)/g;
    while ((match = declExportRe.exec(content)) !== null) {
        exports.add(match[1]);
    }
    
    return exports;
}

function parseNamePairs(namesStr) {
    return namesStr.split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/);
        if (parts.length === 1) {
            const name = parts[0].trim();
            return { alias: name, source: name };
        }
        return { alias: parts[1].trim(), source: parts[0].trim() };
    });
}

let allGood = true;
const errors = [];

// Read index.js
const indexContent = readFileSync(INDEX_FILE, 'utf-8');
console.log(`\n📋 Checking: ${INDEX_FILE}\n`);

// Check each named re-export
let match;
while ((match = NAMED_REEXPORT_RE.exec(indexContent)) !== null) {
    const namesStr = match[1];
    const target = match[2];
    const namePairs = parseNamePairs(namesStr);
    
    // Resolve target path
    const targetPath = resolve(CORE_DIST, target);
    if (!existsSync(targetPath)) {
        console.log(`  ⚠️  Target file not found: ${target}`);
        errors.push(`File not found: ${target}`);
        allGood = false;
        continue;
    }
    
    const targetExports = parseExports(targetPath);
    
    for (const { alias, source } of namePairs) {
        if (!targetExports.has(source)) {
            console.log(`  ❌ ${alias} → ${target} (source '${source}' NOT FOUND!)`);
            console.log(`     Available exports from ${target}:`);
            const avail = [...targetExports].join(', ');
            console.log(`     ${avail || '(none)'}`);
            errors.push(`Export '${source}' (as '${alias}') not found in '${target}'`);
            allGood = false;
        } else {
            console.log(`  ✅ ${alias} → ${target}`);
        }
    }
}

// Check star re-exports (just note them)
while ((match = STAR_REEXPORT_RE.exec(indexContent)) !== null) {
    const target = match[1];
    const targetPath = resolve(CORE_DIST, target);
    const exists = existsSync(targetPath);
    console.log(`  📦 * → ${target} ${exists ? '✅' : '❌ (NOT FOUND!)'}`);
    if (!exists) {
        errors.push(`Star-export target not found: ${target}`);
        allGood = false;
    }
}

// Check namespace re-exports
while ((match = NAMESPACE_REEXPORT_RE.exec(indexContent)) !== null) {
    const ns = match[1];
    const target = match[2];
    const targetPath = resolve(CORE_DIST, target);
    const exists = existsSync(targetPath);
    console.log(`  📦 * as ${ns} → ${target} ${exists ? '✅' : '❌ (NOT FOUND!)'}`);
    if (!exists) {
        errors.push(`Namespace-export target not found: ${target}`);
        allGood = false;
    }
}

console.log(`\n${'='.repeat(50)}`);
if (allGood) {
    console.log('✅ ALL EXPORTS VALID - no issues found!\n');
    process.exit(0);
} else {
    console.log(`❌ ${errors.length} issue(s) found:\n`);
    errors.forEach(e => console.log(`  - ${e}`));
    console.log();
    process.exit(1);
}
