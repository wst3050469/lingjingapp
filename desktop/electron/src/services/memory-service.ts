// Shared memory service layer
// Provides keyword extraction, memory search, dedup save, and LLM-based conversation summarization.
// Used by both agent-ipc.ts and quest-ipc.ts.

import type { LLMProvider, Message } from '@codepilot/core';

// --- Stopwords ---

const STOP_WORDS_ZH = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '吗', '把', '这个', '那个', '它', '被', '从', '但',
  '可以', '什么', '这样', '没', '如果', '现在', '让', '那', '还', '用', '所以',
  '已经', '为', '做', '对', '能', '而', '并', '下', '来', '与', '等', '给',
  '将', '又', '其', '可', '以', '之', '中', '些', '之后', '么', '请', '帮',
  '需要', '想', '怎么', '我们', '你们', '他们',
]);

const STOP_WORDS_EN = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'about', 'like', 'through', 'after', 'over', 'between',
  'out', 'against', 'during', 'without', 'before', 'under', 'around',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'here', 'there',
  'up', 'then', 'also', 'please', 'help', 'want', 'use', 'using',
]);

// --- 1. Keyword Extraction ---

// Technical keywords that should never be treated as stopwords
const TECHNICAL_KEYWORDS = new Set([
  'api', 'url', 'db', 'sql', 'css', 'html', 'js', 'ts', 'ui', 'ux',
  'app', 'dev', 'ops', 'cli', 'ci', 'cd', 'git', 'http', 'tcp', 'ip',
  'bug', 'fix', 'test', 'code', 'data', 'file', 'func', 'class', 'obj',
]);

/**
 * Extract meaningful keywords from a message for memory search.
 * Handles both Chinese and English text.
 * Returns space-separated keywords (max 8).
 */
export function extractKeywords(message: string): string {
  const freq = new Map<string, number>();

  // Split message into segments by punctuation / newlines
  const segments = message.split(/[，。！？；：、\n\r,.!?;:\-\s]+/).filter(Boolean);

  for (const seg of segments) {
    // Extract English words
    const enWords = seg.match(/[a-zA-Z_][a-zA-Z0-9_]{2,}/g);
    if (enWords) {
      for (const w of enWords) {
        const lower = w.toLowerCase();
        // Skip stopwords unless it's a technical keyword
        if ((!STOP_WORDS_EN.has(lower) || TECHNICAL_KEYWORDS.has(lower)) && lower.length > 2) {
          freq.set(lower, (freq.get(lower) || 0) + 1);
        }
      }
    }

    // Extract Chinese word groups (2-4 chars)
    const zhChars = seg.replace(/[a-zA-Z0-9_\s]+/g, '');
    if (zhChars.length >= 2) {
      // Bigrams and trigrams
      for (let len = 2; len <= Math.min(4, zhChars.length); len++) {
        for (let i = 0; i <= zhChars.length - len; i++) {
          const gram = zhChars.slice(i, i + len);
          // Skip if any char is a stopword
          let hasStop = false;
          for (const ch of gram) {
            if (STOP_WORDS_ZH.has(ch)) { hasStop = true; break; }
          }
          if (!hasStop) {
            freq.set(gram, (freq.get(gram) || 0) + 1);
          }
        }
      }
    }
  }

  // Also match full Chinese words directly from known patterns (2-6 chars between stops)
  const zhWordMatches = message.match(/[\u4e00-\u9fff]{2,6}/g);
  if (zhWordMatches) {
    for (const w of zhWordMatches) {
      if (!STOP_WORDS_ZH.has(w) && w.length >= 2) {
        freq.set(w, (freq.get(w) || 0) + 1);
      }
    }
  }

  // Sort by frequency desc, then by length desc (prefer longer = more specific)
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

  // Deduplicate: if a shorter keyword is a substring of an already-selected longer one, skip it
  const selected: string[] = [];
  for (const [word] of sorted) {
    if (selected.length >= 8) break;
    const isSubstring = selected.some(
      (s) => s.includes(word) || word.includes(s)
    );
    if (!isSubstring) {
      selected.push(word);
    }
  }

  return selected.join(' ');
}

// --- 2. Memory Search ---

/**
 * Search memories across ALL categories (not just expert-learning).
 * Uses extracted keywords for LIKE matching.
 * Returns formatted string of matching memories, or empty string.
 */
export async function searchMemories(
  keywords: string,
  projectPath: string,
  getDb: () => any,
): Promise<string> {
  try {
    const db = getDb();
    const words = keywords.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';

    // Build OR conditions for each keyword
    const conditions: string[] = [];
    const params: string[] = [];
    for (const w of words) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${w}%`, `%${w}%`);
    }

    const sql = `SELECT title, content, category, scope FROM memories
      WHERE (${conditions.join(' OR ')})
      AND (scope = 'global' OR project_path = ?)
      ORDER BY updated_at DESC LIMIT 10`;
    params.push(projectPath);

    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const scopeTag = row.scope === 'global' ? '[Global]' : '[Project]';
      results.push(`${scopeTag} [${row.category}] ${row.title}: ${row.content}`);
    }
    stmt.free();
    
    if (results.length > 0) {
      // Add priority note
      results.unshift('> **Note**: When Rules and Memories conflict, Rules take precedence.');
    }
    
    return results.join('\n');
  } catch {
    return '';
  }
}

// --- 3. Prompt Builder ---

/**
 * Format memories into a system prompt section.
 */
export function buildMemoryPromptSection(memories: string): string {
  return `## Past Experience & Context
以下是你从过去会话中记住的信息，请利用它们提供更好的、更个性化的帮助：
${memories}`;
}

/**
 * Auto Memory instruction block to inject into system prompt.
 */
export const AUTO_MEMORY_INSTRUCTION = `\n\n## Auto Memory
You have access to the \`update_memory\` tool. During this conversation, proactively use it to save important information you learn about the user, including:
- User preferences (coding style, language, framework choices, etc.)
- Project details (architecture, tech stack, naming conventions, etc.)
- Workflow patterns (testing approaches, deployment processes, etc.)
- Common issues and solutions encountered
Save each memory with an appropriate category ("preference", "project", "workflow", "issue", "knowledge") and scope ("global" for cross-project, "project" for this project only).
Only save genuinely useful, non-trivial information. Do NOT save obvious or temporary details.`;

// --- 4. Dedup Save ---

interface MemoryInput {
  scope: 'global' | 'project';
  projectPath: string | null;
  category: string;
  title: string;
  content: string;
  source: 'active' | 'automatic';
}

/**
 * Save a memory with deduplication.
 * If a memory with the same title exists in the same scope, update it instead of inserting.
 */
export async function saveMemoryWithDedup(
  db: any,
  saveFn: () => Promise<void>,
  memory: MemoryInput,
): Promise<{ action: 'inserted' | 'updated' }> {
  // Check for exact title match in same scope
  const checkSql = memory.scope === 'global'
    ? `SELECT id FROM memories WHERE title = ? AND scope = 'global' LIMIT 1`
    : `SELECT id FROM memories WHERE title = ? AND project_path = ? LIMIT 1`;

  const checkParams = memory.scope === 'global'
    ? [memory.title]
    : [memory.title, memory.projectPath];

  const stmt = db.prepare(checkSql);
  stmt.bind(checkParams);

  if (stmt.step()) {
    // Existing memory found - update
    const row = stmt.getAsObject() as Record<string, unknown>;
    const existingId = row.id as string;
    stmt.free();

    db.run(
      `UPDATE memories SET content = ?, category = ?, updated_at = datetime('now') WHERE id = ?`,
      [memory.content, memory.category, existingId],
    );
    await saveFn();
    return { action: 'updated' };
  }

  stmt.free();

  // No match - insert new
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  db.run(
    `INSERT INTO memories (id, scope, project_path, category, title, content, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, memory.scope, memory.projectPath, memory.category, memory.title, memory.content, memory.source],
  );
  await saveFn();
  return { action: 'inserted' };
}

// --- 5. Conversation Summarization ---

const SUMMARIZE_SYSTEM_PROMPT = `你是一个记忆提取助手。分析以下对话内容，提取出值得长期记住的信息。

规则：
1. 只提取真正有长期价值的信息（如技术栈偏好、架构决策、命名约定、常见问题的解决方案、用户习惯等）
2. 不要提取临时性、显而易见或无价值的内容
3. 每条记忆的 title 应简短（10字以内），content 应精炼（50字以内）
4. category 只能是以下之一：preference, project, workflow, issue, knowledge
5. scope 为 "global"（跨项目通用）或 "project"（仅限当前项目）
6. 如果没有值得记住的信息，返回空数组 []

只返回 JSON 数组，不要包含其他文本：
[{"title": "...", "content": "...", "category": "...", "scope": "..."}]`;

/**
 * Summarize a conversation using LLM and save extracted memories.
 * Runs asynchronously, failures are silently ignored.
 */
export async function summarizeConversation(
  provider: LLMProvider,
  messages: readonly Message[],
  projectPath: string,
  getDb: () => any,
  saveFn: () => Promise<void>,
): Promise<void> {
  // Filter to user/assistant messages only
  const relevant = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  // Skip if too few messages
  if (relevant.length < 4) return;

  // Take last 20 messages and build summary text
  const recent = relevant.slice(-20);
  let summaryText = '';
  for (const msg of recent) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = (msg as any).content || '';
    // Truncate very long messages
    const truncated = content.length > 500 ? content.slice(0, 500) + '...' : content;
    summaryText += `${role}: ${truncated}\n\n`;
    if (summaryText.length > 4000) break;
  }

  // Skip if content is too short to be meaningful
  if (summaryText.length < 200) return;

  // Call LLM for summarization
  const chatMessages: Message[] = [
    { role: 'user', content: `以下是对话内容：\n\n${summaryText}` },
  ];

  let responseText = '';
  for await (const event of provider.chat({
    messages: chatMessages,
    systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
    maxTokens: 1024,
    temperature: 0.1,
  })) {
    if (event.type === 'text_delta') {
      responseText += event.text;
    }
  }

  // Parse JSON response
  // LLM might wrap in markdown code block, try to extract
  let jsonStr = responseText.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let items: Array<{ title: string; content: string; category: string; scope: string }>;
  try {
    items = JSON.parse(jsonStr);
  } catch {
    return; // Invalid JSON - silently ignore
  }

  if (!Array.isArray(items) || items.length === 0) return;

  const validCategories = new Set(['preference', 'project', 'workflow', 'issue', 'knowledge']);
  const db = getDb();

  for (const item of items) {
    if (!item.title || !item.content) continue;
    const category = validCategories.has(item.category) ? item.category : 'knowledge';
    const scope = item.scope === 'global' ? 'global' : 'project';

    await saveMemoryWithDedup(db, saveFn, {
      scope: scope as 'global' | 'project',
      projectPath: scope === 'project' ? projectPath : null,
      category,
      title: item.title,
      content: item.content,
      source: 'automatic',
    });
  }
}
