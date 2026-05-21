// Skills Loader - Scan and parse SKILL.md files from filesystem
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const USER_SKILLS_DIR = join(homedir(), '.lingjing', 'skills');
const AUTO_GENERATED_SKILLS_DIR = join(homedir(), '.lingjing', 'skills', 'auto-generated');
const PROJECT_SKILLS_DIR_NAME = '.lingjing';
// Resolve loader directory in both ESM and CJS environments
// In Electron bundled CJS, import.meta.url is undefined, so we need a safe fallback
function getLoaderDir() {
    try {
        // ESM: import.meta.url is available
        return dirname(fileURLToPath(import.meta.url));
    }
    catch {
        // CJS fallback: __dirname is injected by Node's CJS module wrapper
        if (typeof __dirname !== 'undefined' && __dirname) {
            return __dirname;
        }
        // Absolute last resort: relative from cwd
        return join(process.cwd(), 'packages', 'core', 'dist', 'skills');
    }
}
/**
 * Resolve built-in skills directory by probing multiple well-known paths.
 * Handles both core-package CJS/ESM and Electron-bundled scenarios.
 *
 * Path strategies (in priority order):
 *   1. Resolve from getLoaderDir() — works for core-package builds
 *   2. Electron bundle fallback: __dirname/../skills → packages/electron/skills/
 *   3. Electron bundle fallback: __dirname/../../../core/skills → packages/core/skills/
 *   4. Development fallback: process.cwd()/packages/core/skills
 */
function resolveBuiltinSkillsDir() {
    const loaderDir = getLoaderDir();
    // Strategy 1: Standard path from loader directory
    //   Core CJS:   __dirname          = core/dist/skills/ → ../../skills = core/skills ✓
    //   Core ESM:   import.meta.url    = core/dist/skills/ → ../../skills = core/skills ✓
    //   Electron:   __dirname          = electron/dist/    → ../../skills = packages/skills ✗
    const primary = join(loaderDir, '..', '..', 'skills');
    if (existsSync(primary))
        return primary;
    // Strategy 2: Electron bundle — __dirname = packages/electron/dist/
    //             → join(__dirname, '..', 'skills') = packages/electron/skills/
    if (typeof __dirname !== 'undefined' && __dirname) {
        const electronSkills = join(__dirname, '..', 'skills');
        if (existsSync(electronSkills)) {
            console.info(`[Skills] Using Electron copy: ${electronSkills}`);
            return electronSkills;
        }
        // Strategy 3: Electron bundle → core/skills via absolute traversal
        const coreSkills = join(__dirname, '..', '..', '..', 'core', 'skills');
        if (existsSync(coreSkills)) {
            console.info(`[Skills] Using core copy: ${coreSkills}`);
            return coreSkills;
        }
    }
    // Strategy 4: Development fallback relative to process.cwd()
    try {
        const cwdSkills = join(process.cwd(), 'packages', 'core', 'skills');
        if (existsSync(cwdSkills)) {
            console.info(`[Skills] Using cwd fallback: ${cwdSkills}`);
            return cwdSkills;
        }
    }
    catch {
        // process.cwd() might throw in restricted environments
    }
    console.warn(`[Skills] No built-in skills found, primary path: ${primary}`);
    return primary;
}
const BUILTIN_SKILLS_DIR = resolveBuiltinSkillsDir();
/**
 * Parse SKILL.md content to extract frontmatter and instructions.
 */
function parseSkillMd(content, filePath, level) {
    let frontmatterStr = '';
    let instructions = content;
    // Check for YAML frontmatter (--- delimiter)
    if (content.startsWith('---\n')) {
        const endDelimiterIndex = content.indexOf('\n---\n', 4);
        if (endDelimiterIndex !== -1) {
            frontmatterStr = content.slice(4, endDelimiterIndex);
            instructions = content.slice(endDelimiterIndex + 5).trim();
        }
    }
    // Parse frontmatter using simple key-value parsing
    const parsedFrontmatter = {};
    if (frontmatterStr) {
        const lines = frontmatterStr.split('\n');
        let currentKey = '';
        let currentArray = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            // Check for key: value pattern
            const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
            if (match) {
                // Save previous array if exists
                if (currentKey && currentArray.length > 0) {
                    parsedFrontmatter[currentKey] = currentArray;
                    currentArray = [];
                }
                currentKey = match[1];
                let value = match[2].trim();
                // Remove surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                if (value === '') {
                    // Start of an array
                    currentArray = [];
                }
                else if (value === 'true') {
                    parsedFrontmatter[currentKey] = true;
                    currentKey = '';
                }
                else if (value === 'false') {
                    parsedFrontmatter[currentKey] = false;
                    currentKey = '';
                }
                else if (!isNaN(Number(value))) {
                    parsedFrontmatter[currentKey] = Number(value);
                    currentKey = '';
                }
                else {
                    parsedFrontmatter[currentKey] = value;
                    currentKey = '';
                }
            }
            else if (trimmed.startsWith('- ') && currentKey) {
                // Array item
                let item = trimmed.slice(2).trim();
                // Remove quotes from array items
                if ((item.startsWith('"') && item.endsWith('"')) ||
                    (item.startsWith("'") && item.endsWith("'"))) {
                    item = item.slice(1, -1);
                }
                currentArray.push(item);
            }
        }
        // Save last array
        if (currentKey && currentArray.length > 0) {
            parsedFrontmatter[currentKey] = currentArray;
        }
    }
    // Extract name and description from frontmatter or markdown
    let name = parsedFrontmatter.name || '';
    let description = parsedFrontmatter.description || '';
    const triggers = Array.isArray(parsedFrontmatter.triggers) ? parsedFrontmatter.triggers : [];
    const tools = Array.isArray(parsedFrontmatter.tools) ? parsedFrontmatter.tools : [];
    // Fallback: extract from markdown if frontmatter doesn't have name/description
    if (!name || !description) {
        const lines = instructions.split('\n');
        let inCodeBlock = false;
        let foundHeading = false;
        let foundDescription = false;
        for (const line of lines) {
            // Track code blocks
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock)
                continue;
            // First H1 heading as name
            if (!foundHeading && line.startsWith('# ')) {
                if (!name) {
                    name = line.slice(2).trim();
                }
                foundHeading = true;
                continue;
            }
            // First non-empty line after heading as description
            if (foundHeading && !foundDescription && line.trim()) {
                if (!description) {
                    description = line.trim();
                }
                foundDescription = true;
                break;
            }
        }
    }
    return {
        name: name || 'unnamed-skill',
        description,
        triggers,
        tools,
        instructions,
        level,
        path: filePath,
    };
}
/**
 * Scan a skills directory and return parsed skill configs.
 */
async function scanSkillsDir(dir, level) {
    if (!existsSync(dir)) {
        return [];
    }
    const skills = [];
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const skillDir = join(dir, entry.name);
        const skillMdPath = join(skillDir, 'SKILL.md');
        if (!existsSync(skillMdPath))
            continue;
        try {
            const content = await readFile(skillMdPath, 'utf8');
            const config = parseSkillMd(content, skillMdPath, level);
            skills.push(config);
        }
        catch (err) {
            console.error(`[Skills] Failed to parse ${skillMdPath}:`, err);
        }
    }
    return skills;
}
/**
 * Scan all skills directories (builtin + user + project) and return merged configs.
 * Project-level skills override user-level skills, which override built-in skills.
 */
export async function scanAllSkills(workspace) {
    const skillsMap = new Map();
    // Layer 1: Built-in skills (lowest priority)
    const builtinSkills = await scanSkillsDir(BUILTIN_SKILLS_DIR, 'user');
    for (const skill of builtinSkills) {
        skillsMap.set(skill.name, skill);
    }
    // Layer 2: Auto-generated skills (from SkillHarvester — override builtin)
    const autoSkills = await scanSkillsDir(AUTO_GENERATED_SKILLS_DIR, 'auto-generated');
    for (const skill of autoSkills) {
        skillsMap.set(skill.name, skill);
    }
    // Layer 3: User-created skills (override auto-generated)
    const userSkills = await scanSkillsDir(USER_SKILLS_DIR, 'user');
    for (const skill of userSkills) {
        skillsMap.set(skill.name, skill);
    }
    // Layer 4: Project-level skills (highest priority)
    if (workspace) {
        const projectSkillsDir = join(workspace, PROJECT_SKILLS_DIR_NAME, 'skills');
        const projectSkills = await scanSkillsDir(projectSkillsDir, 'project');
        for (const skill of projectSkills) {
            skillsMap.set(skill.name, skill);
        }
    }
    if (skillsMap.size === 0) {
        console.warn('[Skills] scanAllSkills returned 0 skills — possible path resolution issue');
    }
    else {
        console.info(`[Skills] scanAllSkills loaded ${skillsMap.size} skills`);
    }
    return skillsMap;
}
/**
 * Get a single skill by name.
 */
export async function getSkill(workspace, name) {
    const allSkills = await scanAllSkills(workspace);
    return allSkills.get(name);
}
/**
 * Get skill catalog entries (name + description only, lightweight).
 */
export async function getSkillCatalog(workspace) {
    const allSkills = await scanAllSkills(workspace);
    return Array.from(allSkills.values()).map(skill => ({
        name: skill.name,
        description: skill.description,
        triggers: skill.triggers,
        level: skill.level,
        path: skill.path,
    }));
}
//# sourceMappingURL=loader.js.map