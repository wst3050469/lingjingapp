// Memory Reflector — periodic reflection and knowledge synthesis
//
// Layer 3 of the 3-layer memory evolution system.
// Periodically reads all memories, identifies patterns, extracts
// user preferences/project knowledge, and updates the Rules system.
//
// Inspired by Hermes Agent's Honcho dialectic user modeling.

import { logger } from '../utils/logger.js';

// Local LLMProvider type (src/llm/types.ts doesn't export it)
interface LLMProvider {
  chat: (opts: {
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    [key: string]: unknown;
  }) => AsyncIterable<{ type: string; text?: string; [key: string]: unknown }>;
}

const REFLECTION_PROMPT = `You are a memory synthesis engine. Given a list of memories from an AI coding assistant's persistent memory, synthesize a concise user profile and project context summary.

Analyze patterns across these memories and extract:

1. **User Profile** (3-5 bullet points):
   - Coding style & preferences
   - Technology stack favorites
   - Workflow patterns
   - Common issues they encounter

2. **Project Knowledge** (3-5 bullet points):
   - Active project types
   - Architecture decisions
   - Naming conventions
   - Key file paths

3. **Decision History** (important decisions made):
   - What was chosen and why

Output in markdown. Keep it actionable — this summary will be injected into future conversations as context.`;

export interface ReflectorConfig {
  /** How often to run reflection (ms). Default: 24 hours */
  intervalMs: number;
  enabled: boolean;
  /** LLM provider for synthesis */
  provider: LLMProvider;
}

export interface MemoryRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  scope: string;
  updated_at?: string;
}

export interface ReflectionResult {
  profile: string;
  projectKnowledge: string;
  decisions: string;
  fullMarkdown: string;
  sourceMemoryCount: number;
  reflectedAt: Date;
}

export class MemoryReflector {
  private config: ReflectorConfig;
  private lastReflection = 0;

  constructor(config: ReflectorConfig) {
    this.config = config;
  }

  /**
   * Check if it's time to run a reflection cycle.
   */
  shouldReflect(): boolean {
    if (!this.config.enabled) return false;
    return Date.now() - this.lastReflection >= this.config.intervalMs;
  }

  /**
   * Run a full reflection cycle: read memories → synthesize → return profile.
   * @param memories Recent memory records to reflect on
   */
  async reflect(memories: MemoryRecord[]): Promise<ReflectionResult | null> {
    if (memories.length === 0) return null;

    try {
      const memoryText = memories
        .map(m => `[${m.category}/${m.scope}] ${m.title}\n${m.content.slice(0, 500)}`)
        .join('\n\n---\n\n');

      let synthesis = '';
      const stream = this.config.provider.chat({
        messages: [{
          role: 'user',
          content: `Synthesize these ${memories.length} memories into a user profile:\n\n${memoryText}`,
        }],
        systemPrompt: REFLECTION_PROMPT,
        maxTokens: 1500,
        temperature: 0.4,
      });

      for await (const event of stream) {
        if (event.type === 'text_delta') {
          synthesis += event.text;
        }
      }

      if (!synthesis || synthesis.length < 50) return null;

      // Extract sections
      const profileMatch =
        synthesis.match(/## 1\.\s*User Profile\s*\n([\s\S]*?)(?=## 2\.|$)/i) ||
        synthesis.match(/User Profile[:\s]*\n([\s\S]*?)(?=Project|Decision|$)/i);
      const projectMatch =
        synthesis.match(/## 2\.\s*Project Knowledge\s*\n([\s\S]*?)(?=## 3\.|$)/i) ||
        synthesis.match(/Project Knowledge[:\s]*\n([\s\S]*?)(?=Decision|$)/i);
      const decisionsMatch =
        synthesis.match(/## 3\.\s*Decision History\s*\n([\s\S]*?)$/i) ||
        synthesis.match(/Decision History[:\s]*\n([\s\S]*?)$/i);

      const result: ReflectionResult = {
        profile: profileMatch?.[1]?.trim() || '',
        projectKnowledge: projectMatch?.[1]?.trim() || '',
        decisions: decisionsMatch?.[1]?.trim() || '',
        fullMarkdown: synthesis.trim(),
        sourceMemoryCount: memories.length,
        reflectedAt: new Date(),
      };

      this.lastReflection = Date.now();
      logger.info(`[MemoryReflector] Synthesized profile from ${memories.length} memories (${synthesis.length} chars)`);
      return result;
    } catch (err) {
      logger.warn(`[MemoryReflector] Reflection failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
