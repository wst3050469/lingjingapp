// Skill Harvester — automatically creates skills from conversation experience
//
// After a significant conversation, the harvester analyzes the chat history,
// extracts reusable workflows, and generates SKILL.md files for future reuse.
// Inspired by Hermes Agent's automated skill creation loop.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../utils/logger.js';
const AUTO_SKILLS_DIR = join(homedir(), '.lingjing', 'skills', 'auto-generated');
const DEFAULT_CONFIG = {
    minToolCalls: 3,
    minTurns: 3,
    minDurationMs: 60_000,
};
// ── Harvest prompt ──
const HARVEST_PROMPT = `You are a skill extraction engine. Given the conversation transcript below, identify any reusable workflows or problem-solving patterns that would be worth preserving as a reusable skill.

Output ONLY valid YAML frontmatter + markdown in a SKILL.md format:

---
name: {kebab-case-name}
description: {1-2 sentences — when to use and what it does. Be slightly pushy about triggering.}
triggers:
  - {中文触发词1}
  - {中文触发词2}
  - {English trigger}
tools:
  - {tool1}
  - {tool2}
---

# {Title}

## When to Use
- When the user...

## Steps
1. ...
2. ...

## Output Format
...

## Notes
...

RULES:
- Only create a skill if the conversation reveals a genuinely reusable pattern
- If no clear reusable pattern, respond with "SKIP: <reason>"
- Name MUST be kebab-case ASCII
- Keep instructions concise (< 200 lines)
- Include tool names from: file_read, file_write, file_edit, bash, glob, grep, ask_user, todo, web_search, web_fetch, codebase_search, get_problems, code_review
- Prefer Chinese description field since user is Chinese-speaking`;
// ── Harvester ──
export class SkillHarvester {
    config;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Decide whether a conversation is worth harvesting — i.e., did the user
     * and agent accomplish something non-trivial that might be reusable?
     */
    isSignificant(conversation, durationMs) {
        const msgs = conversation.messages;
        if (msgs.length < this.config.minTurns * 2)
            return false;
        if (durationMs < this.config.minDurationMs)
            return false;
        // Count tool calls across all assistant messages
        let toolCallCount = 0;
        for (const msg of msgs) {
            if (msg.role === 'assistant' && 'toolCalls' in msg && Array.isArray(msg.toolCalls)) {
                toolCallCount += msg.toolCalls.length;
            }
        }
        if (toolCallCount < this.config.minToolCalls)
            return false;
        return true;
    }
    /**
     * Attempt to harvest a skill from a conversation.
     * Returns the skill name if created, or null if skipped.
     */
    async harvest(conversation, durationMs) {
        if (!this.isSignificant(conversation, durationMs))
            return null;
        try {
            const transcript = this.buildTranscript(conversation);
            const skillMd = await this.generateSkillMd(transcript);
            if (!skillMd || skillMd.startsWith('SKIP:')) {
                logger.info(`[Harvester] Skipped: ${skillMd || 'empty response'}`);
                return null;
            }
            // Extract skill name from frontmatter
            const nameMatch = skillMd.match(/^name:\s*(\S+)/m);
            if (!nameMatch) {
                logger.warn('[Harvester] Could not extract skill name from generated output');
                return null;
            }
            const skillName = nameMatch[1].trim();
            const skillDir = join(AUTO_SKILLS_DIR, skillName);
            // Create directory and write SKILL.md
            mkdirSync(skillDir, { recursive: true });
            writeFileSync(join(skillDir, 'SKILL.md'), skillMd, 'utf8');
            logger.info(`[Harvester] Created skill: ${skillName} at ${skillDir}`);
            return skillName;
        }
        catch (err) {
            logger.warn(`[Harvester] Failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    }
    /**
     * Build a compressed conversation transcript for the harvest LLM.
     */
    buildTranscript(conversation) {
        const lines = [];
        const msgs = conversation.messages;
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool';
            if (msg.role === 'user') {
                let content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                if (content.length > 500)
                    content = content.slice(0, 500) + '...';
                lines.push(`## User`);
                lines.push(content);
                lines.push('');
            }
            else if (msg.role === 'assistant') {
                let content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                if (content.length > 300)
                    content = content.slice(0, 300) + '...';
                const tc = msg.toolCalls;
                if (tc && tc.length > 0) {
                    lines.push(`## Assistant (called tools: ${tc.map((t) => t.name).join(', ')})`);
                    if (content)
                        lines.push(content);
                }
                else if (content) {
                    lines.push(`## Assistant`);
                    lines.push(content);
                }
                lines.push('');
            }
            else if (msg.role === 'tool') {
                let tc = msg.content || '';
                if (tc.length > 200)
                    tc = tc.slice(0, 200) + '...';
                lines.push(`[Tool result]: ${tc}`);
                lines.push('');
            }
        }
        return lines.join('\n');
    }
    /**
     * Call a lightweight LLM to generate the SKILL.md.
     */
    async generateSkillMd(transcript) {
        let result = '';
        const stream = this.config.provider.chat({
            messages: [{
                    role: 'user',
                    content: `Extract a reusable skill from this conversation transcript:\n\n${transcript}`,
                }],
            systemPrompt: HARVEST_PROMPT,
            maxTokens: 2048,
            temperature: 0.3,
        });
        for await (const event of stream) {
            if (event.type === 'text_delta') {
                result += event.text;
            }
        }
        return result.trim();
    }
}
//# sourceMappingURL=harvester.js.map