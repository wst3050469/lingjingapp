// Context service - shared context building logic used by both quest-ipc and agent-ipc

import { readFile as readFileFS } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface ContextItem {
  type: string;
  label: string;
  path: string;
  content?: string;
}

/**
 * Build a context section string from user-provided context items.
 * Reads file/folder/rule content from disk and formats for injection into prompts.
 */
export async function buildContextSection(contexts: ContextItem[]): Promise<string> {
  if (!contexts || contexts.length === 0) return '';

  let contextSection = '\n\n## User-Provided Context\n\n';

  for (const ctx of contexts) {
    try {
      switch (ctx.type) {
        case 'file': {
          const fileContent = await readFileFS(ctx.path, 'utf-8');
          contextSection += `### File: ${ctx.label}\nPath: ${ctx.path}\n\`\`\`\n${fileContent.slice(0, 5000)}\n\`\`\`\n\n`;
          break;
        }
        case 'folder': {
          const entries = await readdir(ctx.path, { withFileTypes: true });
          let folderContent = `Folder: ${ctx.label}\nPath: ${ctx.path}\n\nContents:\n`;

          for (const entry of entries.slice(0, 50)) {
            const entryPath = resolve(ctx.path, entry.name);
            const entryStat = await stat(entryPath);
            const size = entryStat.size;
            const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)}MB` :
                           size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
            folderContent += `${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${entry.name} (${sizeStr})\n`;
          }

          if (entries.length > 50) {
            folderContent += `\n... and ${entries.length - 50} more items\n`;
          }

          contextSection += `### Folder: ${ctx.label}\n${folderContent}\n\n`;
          break;
        }
        case 'attachments': {
          // If content was pre-parsed by the frontend, use it directly
          if (ctx.content) {
            contextSection += `### Attachment: ${ctx.label}\nPath: ${ctx.path}\n\`\`\`\n${ctx.content.slice(0, 10000)}\n\`\`\`\n\n`;
          } else {
            const ext = ctx.label.split('.').pop()?.toLowerCase() || '';
            contextSection += `### Attachment: ${ctx.label}\nType: ${ext}\nPath: ${ctx.path}\n\n`;
          }
          break;
        }
        case 'rule': {
          try {
            const ruleContent = await readFileFS(ctx.path, 'utf-8');
            contextSection += `### Rule: ${ctx.label}\nPath: ${ctx.path}\n\`\`\`\n${ruleContent}\n\`\`\`\n\n`;
          } catch {
            // Skip if can't read
          }
          break;
        }
      }
    } catch (err) {
      console.error(`Failed to load context ${ctx.type}: ${ctx.path}`, err);
    }
  }

  return contextSection;
}
