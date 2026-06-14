// Stub: pipeline module
export class PipelineEngine {
  async run() { return { status: 'not_implemented', logs: [] }; }
}
export class DslParser {
  parse() { return { name: 'stub', steps: [] }; }
}
export class TriggerManager {
  async register() { return true; }
  async list() { return []; }
  async remove() { return true; }
}
export var PipelineDefinition = {};
export var PipelineRun = {};
export var PipelineLogEvent = {};
