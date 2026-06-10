export class LLMQuotaManager {
  private maxConcurrency: number;
  private currentCount = 0;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  acquire(): boolean {
    if (this.currentCount >= this.maxConcurrency) {
      return false;
    }
    this.currentCount++;
    return true;
  }

  release(): void {
    if (this.currentCount > 0) {
      this.currentCount--;
    }
  }

  get available(): number {
    return this.maxConcurrency - this.currentCount;
  }

  get used(): number {
    return this.currentCount;
  }
}
