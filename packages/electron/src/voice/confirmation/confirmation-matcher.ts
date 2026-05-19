import type { ConfirmationResult } from '@codepilot/core/voice';

export class ConfirmationMatcher {
  constructor(
    private confirmWords: string[] = ['确认', '是的', '对的', '好的', 'confirm', 'yes', 'ok'],
    private cancelWords: string[] = ['取消', '不要', '不对', 'cancel', 'no', 'abort'],
    private lcsThreshold: number = 0.8
  ) {}

  match(input: string): ConfirmationResult {
    const normalized = input.trim().toLowerCase();

    for (const word of this.confirmWords) {
      if (normalized === word.toLowerCase()) {
        return { result: 'confirmed', matchedWord: word, confidence: 1.0 };
      }
    }

    for (const word of this.cancelWords) {
      if (normalized === word.toLowerCase()) {
        return { result: 'cancelled', matchedWord: word, confidence: 1.0 };
      }
    }

    for (const word of this.confirmWords) {
      if (normalized.includes(word.toLowerCase())) {
        return { result: 'confirmed', matchedWord: word, confidence: 0.9 };
      }
    }

    for (const word of this.cancelWords) {
      if (normalized.includes(word.toLowerCase())) {
        return { result: 'cancelled', matchedWord: word, confidence: 0.9 };
      }
    }

    let bestSimilarity = 0;
    let bestWord = '';
    let isConfirm = false;

    for (const word of this.confirmWords) {
      const sim = this.lcsSimilarity(normalized, word.toLowerCase());
      if (sim > bestSimilarity) { bestSimilarity = sim; bestWord = word; isConfirm = true; }
    }

    for (const word of this.cancelWords) {
      const sim = this.lcsSimilarity(normalized, word.toLowerCase());
      if (sim > bestSimilarity) { bestSimilarity = sim; bestWord = word; isConfirm = false; }
    }

    if (bestSimilarity >= this.lcsThreshold) {
      return { result: isConfirm ? 'confirmed' : 'cancelled', matchedWord: bestWord, confidence: bestSimilarity };
    }

    return { result: 'unrecognized', confidence: bestSimilarity };
  }

  private lcsSimilarity(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    return dp[m][n] / Math.max(m, n);
  }
}
