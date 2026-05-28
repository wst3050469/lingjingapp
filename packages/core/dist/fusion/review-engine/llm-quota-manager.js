"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMQuotaManager = void 0;
class LLMQuotaManager {
    maxConcurrency;
    currentCount = 0;
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
    }
    acquire() {
        if (this.currentCount >= this.maxConcurrency) {
            return false;
        }
        this.currentCount++;
        return true;
    }
    release() {
        if (this.currentCount > 0) {
            this.currentCount--;
        }
    }
    get available() {
        return this.maxConcurrency - this.currentCount;
    }
    get used() {
        return this.currentCount;
    }
}
exports.LLMQuotaManager = LLMQuotaManager;
//# sourceMappingURL=llm-quota-manager.js.map