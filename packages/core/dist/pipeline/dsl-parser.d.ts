import type { PipelineDefinition } from './types.js';
export declare class DslParser {
    parseDirectory(dir: string): Promise<PipelineDefinition[]>;
    parseYaml(content: string, yamlPath?: string): PipelineDefinition;
    toYaml(def: PipelineDefinition): string;
}
//# sourceMappingURL=dsl-parser.d.ts.map