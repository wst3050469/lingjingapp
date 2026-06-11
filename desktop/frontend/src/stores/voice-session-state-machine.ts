import type { VoiceSessionState, VoiceSessionEvent } from '@codepilot/core/voice';

const VALID_TRANSITIONS: Record<VoiceSessionState, VoiceSessionEvent[]> = {
  idle: ['start_recording', 'error'],
  recording: ['vad_speech_end', 'interrupt', 'error'],
  recognizing: ['asr_finalized', 'interrupt', 'error'],
  processing: ['agent_done', 'interrupt', 'error'],
  broadcasting: ['tts_done', 'interrupt', 'error'],
  confirming: ['confirmation_done', 'interrupt', 'error'],
};

const NEXT_STATE: Record<VoiceSessionState, Record<string, VoiceSessionState>> = {
  idle: { start_recording: 'recording', error: 'idle' },
  recording: { vad_speech_end: 'recognizing', interrupt: 'idle', error: 'idle' },
  recognizing: { asr_finalized: 'processing', interrupt: 'idle', error: 'idle' },
  processing: { agent_done: 'broadcasting', interrupt: 'idle', error: 'idle' },
  broadcasting: { tts_done: 'confirming', interrupt: 'idle', error: 'idle' },
  confirming: { confirmation_done: 'idle', interrupt: 'idle', error: 'idle' },
};

type TransitionListener = (from: VoiceSessionState, to: VoiceSessionState, event: VoiceSessionEvent) => void;

export class VoiceSessionStateMachine {
  private _state: VoiceSessionState = 'idle';
  private listeners: TransitionListener[] = [];

  get state(): VoiceSessionState {
    return this._state;
  }

  transition(event: VoiceSessionEvent): VoiceSessionState {
    const allowedEvents = VALID_TRANSITIONS[this._state];
    if (!allowedEvents.includes(event)) {
      throw new Error(`Invalid transition: ${this._state} + ${event}`);
    }

    const nextState = NEXT_STATE[this._state][event];
    if (!nextState) {
      throw new Error(`No next state defined for: ${this._state} + ${event}`);
    }

    const from = this._state;
    this._state = nextState;
    this.listeners.forEach(l => l(from, nextState, event));
    return nextState;
  }

  onTransition(listener: TransitionListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  reset(): void {
    this._state = 'idle';
  }

  canTransition(event: VoiceSessionEvent): boolean {
    return VALID_TRANSITIONS[this._state].includes(event);
  }
}
