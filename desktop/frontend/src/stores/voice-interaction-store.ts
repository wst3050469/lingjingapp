import { create } from 'zustand';
import type { InteractionMode, VoiceSessionState, VoiceEngineConfig, ASRResult } from '@codepilot/core/voice';
import { VoiceSessionStateMachine } from './voice-session-state-machine.js';

interface VoiceInteractionState {
  currentMode: InteractionMode;
  voiceStatus: VoiceSessionState;
  isMicAvailable: boolean;
  isSpeakerAvailable: boolean;
  interimTranscript: string;
  finalTranscript: string;
  asrConfidence: number;
  isBroadcasting: boolean;
  autoBroadcast: boolean;
  activeSessionId: string | null;

  toggleMode: () => void;
  switchToVoice: () => void;
  switchToText: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  interruptSession: () => void;
  setInterimTranscript: (text: string) => void;
  setFinalTranscript: (text: string) => void;
  handleASRResult: (result: ASRResult) => void;
  setAutoBroadcast: (enabled: boolean) => void;
}

const stateMachine = new VoiceSessionStateMachine();

export const useVoiceInteractionStore = create<VoiceInteractionState>((set, get) => ({
  currentMode: 'text',
  voiceStatus: 'idle',
  isMicAvailable: false,
  isSpeakerAvailable: false,
  interimTranscript: '',
  finalTranscript: '',
  asrConfidence: 0,
  isBroadcasting: false,
  autoBroadcast: true,
  activeSessionId: null,

  toggleMode: () => {
    const { currentMode, switchToVoice, switchToText } = get();
    currentMode === 'text' ? switchToVoice() : switchToText();
  },

  switchToVoice: async () => {
    const micCheck = await window.electronAPI?.voice?.['permission:checkMicrophone']?.();
    if (micCheck?.granted) {
      set({ currentMode: 'voice', isMicAvailable: true });
    } else {
      const requested = await window.electronAPI?.voice?.['permission:requestMicrophone']?.();
      set({ currentMode: requested?.granted ? 'voice' : 'text', isMicAvailable: requested?.granted ?? false });
    }
  },

  switchToText: () => {
    const { voiceStatus } = get();
    if (voiceStatus !== 'idle') {
      stateMachine.transition('interrupt');
    }
    set({ currentMode: 'text', voiceStatus: 'idle', interimTranscript: '', finalTranscript: '' });
  },

  startRecording: async () => {
    try {
      stateMachine.transition('start_recording');
      set({ voiceStatus: 'recording', interimTranscript: '', finalTranscript: '', activeSessionId: `voice_${Date.now()}` });
      await window.electronAPI?.voice?.['asr:start']?.();
    } catch {
      set({ voiceStatus: 'idle' });
    }
  },

  stopRecording: async () => {
    await window.electronAPI?.voice?.['asr:stop']?.();
  },

  interruptSession: async () => {
    stateMachine.transition('interrupt');
    await window.electronAPI?.voice?.['asr:abort']?.();
    await window.electronAPI?.voice?.['tts:stop']?.();
    set({ voiceStatus: 'idle', interimTranscript: '', finalTranscript: '', isBroadcasting: false });
  },

  setInterimTranscript: (text) => set({ interimTranscript: text }),
  setFinalTranscript: (text) => set({ finalTranscript: text }),

  handleASRResult: (result: ASRResult) => {
    if (result.isFinal) {
      set({ finalTranscript: result.transcript, asrConfidence: result.confidence });
      if (stateMachine.canTransition('asr_finalized')) {
        stateMachine.transition('asr_finalized');
        set({ voiceStatus: 'processing' });
      }
    } else {
      set({ interimTranscript: result.transcript });
    }
  },

  setAutoBroadcast: (enabled) => set({ autoBroadcast: enabled }),
}));

stateMachine.onTransition((_from, to) => {
  useVoiceInteractionStore.setState({ voiceStatus: to });
});
