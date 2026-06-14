// Stub: context module
export class ContextManager {
  constructor(opts) { this.opts = opts || {}; }
  async autoCollect() { return { files: [], totalTokens: 0, maxTokens: this.opts.maxTokens || 8000 }; }
  async addFile() { return true; }
  async removeFile() { return true; }
  getUsage() { return { usedTokens: 0, maxTokens: this.opts.maxTokens || 8000, fileCount: 0 }; }
  async compact() { return { before: 0, after: 0, removedFiles: [] }; }
}
