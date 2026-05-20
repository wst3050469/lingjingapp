// Skills, Agents & Commands IPC - file-system based skill discovery

import { ipcMain } from 'electron';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { scanAllSkills, getSkill, type SkillConfig } from '@codepilot/core';

export interface SkillInfo {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  level: 'user' | 'project';
  path: string;
  hasSkillMd: boolean;
}

export interface AgentInfo {
  name: string;
  description: string;
  level: 'user' | 'project';
  path: string;
  tools?: string[];
  skills?: string[];
  mcpServers?: string[];
  maxTurns?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Parse AGENT.md frontmatter to extract full configuration.
 */
function parseAgentFrontmatter(content: string): {
  name: string;
  description: string;
  tools: string[];
  skills: string[];
  mcpServers: string[];
  maxTurns: number;
  temperature: number;
  systemPrompt: string;
} {
  let frontmatterStr = '';
  let systemPrompt = content;

  if (content.startsWith('---\n')) {
    const endDelimiterIndex = content.indexOf('\n---\n', 4);
    if (endDelimiterIndex !== -1) {
      frontmatterStr = content.slice(4, endDelimiterIndex);
      systemPrompt = content.slice(endDelimiterIndex + 5).trim();
    }
  }

  const parsed: Record<string, any> = {};
  if (frontmatterStr) {
    const lines = frontmatterStr.split('\n');
    let currentKey = '';
    let currentArray: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
      if (match) {
        if (currentKey && currentArray.length > 0) {
          parsed[currentKey] = currentArray;
          currentArray = [];
        }

        currentKey = match[1];
        const value = match[2].trim();

        if (value) {
          if (value.startsWith('[') && value.endsWith(']')) {
            parsed[currentKey] = value
              .slice(1, -1)
              .split(',')
              .map(item => item.trim().replace(/^["']|["']$/g, ''));
            currentKey = '';
          } else if (/^\d+$/.test(value)) {
            parsed[currentKey] = parseInt(value, 10);
          } else if (/^\d+\.\d+$/.test(value)) {
            parsed[currentKey] = parseFloat(value);
          } else if (value === 'true') {
            parsed[currentKey] = true;
          } else if (value === 'false') {
            parsed[currentKey] = false;
          } else {
            parsed[currentKey] = value.replace(/^["']|["']$/g, '');
          }
          currentKey = '';
        } else {
          currentArray = [];
        }
      } else if (currentKey && trimmed.startsWith('- ')) {
        currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      }
    }

    if (currentKey && currentArray.length > 0) {
      parsed[currentKey] = currentArray;
    }
  }

  return {
    name: (parsed.name as string) || 'unknown',
    description: (parsed.description as string) || '',
    tools: (parsed.tools as string[]) || [],
    skills: (parsed.skills as string[]) || [],
    mcpServers: (parsed.mcpServers as string[]) || [],
    maxTurns: (parsed.maxTurns as number) || 30,
    temperature: (parsed.temperature as number) || 0.3,
    systemPrompt,
  };
}

/**
 * Parse a SKILL.md file to extract name and description.
 * Looks for the first H1 heading as name and subsequent text as description.
 */
function parseSkillMd(content: string): { name: string; description: string } {
  const lines = content.split('\n');
  let name = '';
  let description = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!name && trimmed.startsWith('# ')) {
      name = trimmed.slice(2).trim();
      continue;
    }
    // Get first non-empty paragraph after the heading as description
    if (name && !description && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```') && !trimmed.startsWith('---')) {
      description = trimmed;
      break;
    }
  }

  return { name, description };
}

function getUserSkillsDir(): string {
  return join(homedir(), '.lingjing', 'skills');
}

function getUserAgentsDir(): string {
  return join(homedir(), '.lingjing', 'agents');
}

async function scanSkillsDir(dir: string, level: 'user' | 'project'): Promise<SkillInfo[]> {
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = join(dir, entry.name);
    const skillMdPath = join(skillDir, 'SKILL.md');
    const hasSkillMd = existsSync(skillMdPath);

    let name = entry.name;
    let description = '';

    if (hasSkillMd) {
      try {
        const content = await readFile(skillMdPath, 'utf8');
        const parsed = parseSkillMd(content);
        if (parsed.name) name = parsed.name;
        description = parsed.description;
      } catch {
        // ignore parse errors
      }
    }

    skills.push({ name, description, triggers: [], tools: [], level, path: skillDir, hasSkillMd });
  }

  return skills;
}

async function scanAgentsDir(dir: string, level: 'user' | 'project'): Promise<AgentInfo[]> {
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const agents: AgentInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const agentDir = join(dir, entry.name);
    let name = entry.name;
    let description = '';

    // Try to read agent config or README
    const readmePath = join(agentDir, 'README.md');
    const agentMdPath = join(agentDir, 'AGENT.md');
    const mdPath = existsSync(agentMdPath) ? agentMdPath : existsSync(readmePath) ? readmePath : null;

    if (mdPath) {
      try {
        const content = await readFile(mdPath, 'utf8');
        const parsed = parseSkillMd(content);
        if (parsed.name) name = parsed.name;
        description = parsed.description;
      } catch {
        // ignore
      }
    }

    agents.push({ name, description, level, path: agentDir });
  }

  return agents;
}

export function registerSkillsIpc(getWorkspace: () => string): void {
  // List all skills (user + project)
  ipcMain.handle('skills:list', async () => {
    try {
      const workspace = getWorkspace();
      const skillsMap = await scanAllSkills(workspace);
      return Array.from(skillsMap.values()).map(skill => ({
        name: skill.name,
        description: skill.description,
        triggers: skill.triggers,
        tools: skill.tools,
        level: skill.level,
        path: skill.path,
        hasSkillMd: true,
      }));
    } catch (err) {
      console.error('skills:list error:', err);
      return [];
    }
  });

  // List all skills with full content (for injection into system prompt)
  ipcMain.handle('skills:list-full', async () => {
    try {
      const workspace = getWorkspace();
      const skillsMap = await scanAllSkills(workspace);
      return Array.from(skillsMap.values());
    } catch (err) {
      console.error('skills:list-full error:', err);
      return [];
    }
  });

  // Get skill catalog (lightweight, name + description only)
  ipcMain.handle('skills:catalog', async () => {
    try {
      const workspace = getWorkspace();
      const { getSkillCatalog } = await import('@codepilot/core');
      return await getSkillCatalog(workspace);
    } catch (err) {
      console.error('skills:catalog error:', err);
      return [];
    }
  });

  // List all custom agents (user + project)
  ipcMain.handle('skills:list-agents', async () => {
    try {
      const userAgents = await scanAgentsDir(getUserAgentsDir(), 'user');
      const workspace = getWorkspace();
      const projectAgentsDir = workspace ? join(workspace, '.lingjing', 'agents') : '';
      const projectAgents = projectAgentsDir ? await scanAgentsDir(projectAgentsDir, 'project') : [];
      return [...projectAgents, ...userAgents];
    } catch (err) {
      console.error('skills:list-agents error:', err);
      return [];
    }
  });

  // Create a new skill with SKILL.md
  ipcMain.handle('skills:create', async (_event, { name, description, level, content }: {
    name: string;
    description: string;
    level: 'user' | 'project';
    content?: string;
  }) => {
    try {
      const workspace = getWorkspace();
      const baseDir = level === 'user'
        ? getUserSkillsDir()
        : join(workspace, '.lingjing', 'skills');

      const dirName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      const skillDir = join(baseDir, dirName);

      await mkdir(skillDir, { recursive: true });

      const skillMd = content || `# ${name}\n\n${description}\n\n## Instructions\n\n<!-- 在此编写技能指令 -->\n`;
      await writeFile(join(skillDir, 'SKILL.md'), skillMd, 'utf8');

      return { success: true, path: skillDir };
    } catch (err) {
      console.error('skills:create error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Create a new custom agent
  ipcMain.handle('skills:create-agent', async (_event, { name, description, level, systemPrompt }: {
    name: string;
    description: string;
    level: 'user' | 'project';
    systemPrompt?: string;
  }) => {
    try {
      const workspace = getWorkspace();
      const baseDir = level === 'user'
        ? getUserAgentsDir()
        : join(workspace, '.lingjing', 'agents');

      const dirName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      const agentDir = join(baseDir, dirName);

      await mkdir(agentDir, { recursive: true });

      const agentMd = `# ${name}\n\n${description}\n\n## System Prompt\n\n${systemPrompt || '<!-- 在此编写系统提示词 -->'}\n`;
      await writeFile(join(agentDir, 'AGENT.md'), agentMd, 'utf8');

      return { success: true, path: agentDir };
    } catch (err) {
      console.error('skills:create-agent error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Delete a skill or agent directory
  ipcMain.handle('skills:delete', async (_event, { path }: { path: string }) => {
    try {
      if (!existsSync(path)) return { success: false, error: 'Path not found' };
      await rm(path, { recursive: true, force: true });
      return { success: true };
    } catch (err) {
      console.error('skills:delete error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Read SKILL.md content
  ipcMain.handle('skills:read', async (_event, { path }: { path: string }) => {
    try {
      const skillMdPath = join(path, 'SKILL.md');
      if (!existsSync(skillMdPath)) return { success: false, error: 'SKILL.md not found' };
      const content = await readFile(skillMdPath, 'utf8');
      return { success: true, content };
    } catch (err) {
      console.error('skills:read error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Read AGENT.md content
  ipcMain.handle('skills:read-agent', async (_event, { path }: { path: string }) => {
    try {
      const agentMdPath = join(path, 'AGENT.md');
      if (!existsSync(agentMdPath)) return { success: false, error: 'AGENT.md not found' };
      const content = await readFile(agentMdPath, 'utf8');
      return { success: true, content };
    } catch (err) {
      console.error('skills:read-agent error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // List all custom agents with full configuration (frontmatter parsed)
  ipcMain.handle('skills:list-agents-full', async () => {
    try {
      const agents: AgentInfo[] = [];

      // Scan both user and project directories
      const dirs: Array<{ dir: string; level: 'user' | 'project' }> = [
        { dir: getUserAgentsDir(), level: 'user' },
      ];

      const workspace = getWorkspace();
      if (workspace) {
        dirs.push({ dir: join(workspace, '.lingjing', 'agents'), level: 'project' });
      }

      for (const { dir, level } of dirs) {
        if (!existsSync(dir)) continue;

        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const agentDir = join(dir, entry.name);
          const agentMdPath = join(agentDir, 'AGENT.md');

          if (!existsSync(agentMdPath)) continue;

          try {
            const content = await readFile(agentMdPath, 'utf8');
            const parsed = parseAgentFrontmatter(content);

            agents.push({
              name: parsed.name || entry.name,
              description: parsed.description,
              level,
              path: agentDir,
              tools: parsed.tools,
              skills: parsed.skills,
              mcpServers: parsed.mcpServers,
              maxTurns: parsed.maxTurns,
              temperature: parsed.temperature,
              systemPrompt: parsed.systemPrompt,
            });
          } catch {
            // ignore parse errors
          }
        }
      }

      return agents;
    } catch (err) {
      console.error('skills:list-agents-full error:', err);
      return [];
    }
  });

  // Save/update a custom agent with full frontmatter
  ipcMain.handle('skills:save-agent', async (_event, {
    path, name, description, tools, skills, mcpServers, maxTurns, temperature, systemPrompt
  }: {
    path: string;
    name: string;
    description: string;
    tools: string[];
    skills: string[];
    mcpServers: string[];
    maxTurns: number;
    temperature: number;
    systemPrompt: string;
  }) => {
    try {
      const agentMdPath = join(path, 'AGENT.md');

      // Build frontmatter
      const frontmatter = [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        `tools:`,
        ...tools.map(t => `  - ${t}`),
        `skills:`,
        ...skills.map(s => `  - ${s}`),
        `mcpServers:`,
        ...mcpServers.map(m => `  - ${m}`),
        `maxTurns: ${maxTurns}`,
        `temperature: ${temperature}`,
        '---',
        '',
      ].join('\n');

      // Write AGENT.md
      const content = `${frontmatter}${systemPrompt}\n`;
      await writeFile(agentMdPath, content, 'utf8');

      return { success: true };
    } catch (err) {
      console.error('skills:save-agent error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });
}
