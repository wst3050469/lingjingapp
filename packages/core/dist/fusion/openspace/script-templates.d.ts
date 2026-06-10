import type { ScriptTemplate } from './types.js';
export declare const BUILTIN_TEMPLATES: ScriptTemplate[];
export declare function matchTemplate(input: string): ScriptTemplate | null;
export declare function fillTemplate(template: ScriptTemplate, params: Record<string, string | number>): string;
//# sourceMappingURL=script-templates.d.ts.map