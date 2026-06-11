import type { TTSAdapter } from './tts/types.js';

interface BroadcastItem {
  id: string;
  text: string;
  priority: 'confirmation' | 'result' | 'info';
}

export class BroadcastQueue {
  private queue: BroadcastItem[] = [];
  private isPlaying = false;
  private currentHandle: { onDone: Promise<void>; cancel: () => void } | null = null;
  private tts: TTSAdapter | null = null;

  setTTSAdapter(tts: TTSAdapter): void { this.tts = tts; }

  enqueue(text: string, priority: BroadcastItem['priority'] = 'result'): void {
    const item: BroadcastItem = { id: `bc_${Date.now()}`, text, priority };
    this.queue.push(item);
    this.queue.sort((a, b) => {
      const priorityOrder = { confirmation: 0, result: 1, info: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    if (!this.isPlaying) this.playNext();
  }

  private async playNext(): Promise<void> {
    if (!this.tts || this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift()!;

    try {
      this.currentHandle = await this.tts.speak(item.text);
      await this.currentHandle.onDone;
    } catch {
    } finally {
      this.currentHandle = null;
      this.playNext();
    }
  }

  interrupt(): void {
    if (this.currentHandle) {
      this.currentHandle.cancel();
      this.currentHandle = null;
    }
    this.queue = [];
    this.isPlaying = false;
  }

  getQueueLength(): number { return this.queue.length; }
  getIsPlaying(): boolean { return this.isPlaying; }
}
