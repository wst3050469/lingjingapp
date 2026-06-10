import type { VADConfig } from './vad-config.js';
import { DEFAULT_VAD_CONFIG } from './vad-config.js';

type VADEvent = 'speech_start' | 'speech_end';
type VADListener = (event: VADEvent) => void;

export class VADDetector {
  private config: VADConfig;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private speechFrameCount = 0;
  private silenceFrameCount = 0;
  private isSpeaking = false;
  private listeners: VADListener[] = [];
  private stream: MediaStream | null = null;

  constructor(config?: Partial<VADConfig>) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
  }

  start(): void {
    if (!this.analyser) throw new Error('Not initialized');
    this.speechFrameCount = 0;
    this.silenceFrameCount = 0;
    this.isSpeaking = false;
    this.detectLoop();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
  }

  onEvent(listener: VADListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private detectLoop(): void {
    if (!this.analyser) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    const rms = this.computeRMS(buffer);

    if (rms > this.config.energyThreshold) {
      this.speechFrameCount++;
      this.silenceFrameCount = 0;
      if (!this.isSpeaking && this.speechFrameCount >= this.config.speechOnFrames) {
        this.isSpeaking = true;
        this.emit('speech_start');
      }
    } else {
      this.silenceFrameCount++;
      this.speechFrameCount = 0;
      if (this.isSpeaking && this.silenceFrameCount >= this.config.speechOffFrames) {
        this.isSpeaking = false;
        this.emit('speech_end');
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.detectLoop());
  }

  private computeRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private emit(event: VADEvent): void {
    this.listeners.forEach(l => l(event));
  }
}
