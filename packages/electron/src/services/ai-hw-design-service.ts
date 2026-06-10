import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { getDatabase, saveDatabase } from '../db/database.js';
import type { AiDesignResult, AiDesignType, ConfidenceLabel, AiHwDesignPromptConfig } from '@codepilot/core/hw-skill/types';

const logger = createLogger('ai-hw-design-service');

const DEFAULT_PROMPTS: AiHwDesignPromptConfig = {
  schematicGenerate: `You are a hardware design expert. Based on the user's description, generate a KiCad schematic in S-expression format. Include component references, values, and connections. Output valid .kicad_sch content.`,
  pcbLayoutSuggest: `You are a PCB layout expert. Analyze the schematic and suggest optimal component placement and routing strategy. Consider signal integrity, power distribution, and manufacturing constraints.`,
  drcFixSuggest: `You are a DRC expert. Analyze the following DRC violations and suggest fixes. For each violation, provide the specific action to resolve it. Output as a JSON array of {violation_id, action, description}.`,
  componentSelect: `You are a component selection expert. Based on the requirements, recommend suitable components with alternatives. Include part number, manufacturer, key specs, price estimate, and availability.`,
  language: 'zh',
};

export class AiHwDesignService extends EventEmitter {
  private promptConfig: AiHwDesignPromptConfig = DEFAULT_PROMPTS;

  async generateSchematic(description: string, sessionId: string): Promise<AiDesignResult> {
    return this.executeAiDesign('schematic_generate', description, sessionId);
  }

  async suggestPcbLayout(schematicContent: string, sessionId: string): Promise<AiDesignResult> {
    return this.executeAiDesign('pcb_layout_suggest', schematicContent, sessionId);
  }

  async suggestDrcFix(violations: string, sessionId: string): Promise<AiDesignResult> {
    return this.executeAiDesign('drc_fix_suggest', violations, sessionId);
  }

  async selectComponent(requirements: string, sessionId: string): Promise<AiDesignResult> {
    return this.executeAiDesign('component_select', requirements, sessionId);
  }

  private async executeAiDesign(type: AiDesignType, input: string, sessionId: string): Promise<AiDesignResult> {
    const id = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const confidence = 0.7;
    const confidenceLabel: ConfidenceLabel = confidence >= 0.8 ? 'HIGH' : confidence >= 0.5 ? 'MEDIUM' : 'LOW';

    const result: AiDesignResult = {
      id,
      type,
      content: `[AI ${type} result for: ${input.slice(0, 100)}]`,
      confidence,
      confidenceLabel,
      applied: false,
      drcValidated: null,
      timestamp: Date.now(),
    };

    try {
      const db = getDatabase();
      db.run(
        `INSERT INTO ai_design_results (id, type, content, confidence, confidence_label, applied, session_id, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))`,
        [result.id, result.type, result.content, result.confidence, result.confidenceLabel, sessionId],
      );
      await saveDatabase();
    } catch (err) {
      logger.error('Failed to save AI design result', err as Error);
    }

    this.emit('ai-design-result', result);
    return result;
  }

  async applyResult(resultId: string): Promise<boolean> {
    try {
      const db = getDatabase();
      db.run('UPDATE ai_design_results SET applied = 1 WHERE id = ?', [resultId]);
      await saveDatabase();
      logger.info('AI design result applied', { resultId });
      return true;
    } catch {
      return false;
    }
  }

  async rollbackResult(resultId: string): Promise<boolean> {
    try {
      const db = getDatabase();
      db.run('UPDATE ai_design_results SET applied = 0 WHERE id = ?', [resultId]);
      await saveDatabase();
      logger.info('AI design result rolled back', { resultId });
      return true;
    } catch {
      return false;
    }
  }

  setPromptConfig(config: Partial<AiHwDesignPromptConfig>): void {
    this.promptConfig = { ...this.promptConfig, ...config };
  }
}

export const aiHwDesignService = new AiHwDesignService();