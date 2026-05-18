import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const isRecordingRef = useRef(false);

  // Keep refs in sync with latest values to avoid stale closures
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const toggleRecording = useCallback((currentText?: string) => {
    if (isRecordingRef.current) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[VoiceInput] Web Speech API not available in this browser/Electron');
      alert('语音输入不可用：当前浏览器/Electron环境不支持Web Speech API。\n\n请确认：\n1. 您使用的是最新版灵境客户端\n2. 系统麦克风权限已开启\n3. 如问题持续，请尝试重启应用');
      return;
    }

    baseTextRef.current = currentText || '';

    let recognition: any;
    try {
      recognition = new SpeechRecognition();
    } catch (err) {
      console.error('[VoiceInput] Failed to create SpeechRecognition instance:', err);
      return;
    }

    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = baseTextRef.current;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // Use ref to get the latest onTranscript callback
      onTranscriptRef.current(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      const errCode = event?.error || 'unknown';
      console.error('[VoiceInput] Speech recognition error:', errCode, event?.message || '');
      // Provide user-friendly error guidance
      if (errCode === 'not-allowed') {
        alert('语音输入被拒绝：请确保已授予灵境应用麦克风权限。\n\nWindows: 设置 > 隐私和安全性 > 麦克风 > 允许应用访问\nmacOS: 系统偏好设置 > 安全性与隐私 > 麦克风');
      } else if (errCode === 'no-speech') {
        // Silent: no speech detected, user can try again
        console.log('[VoiceInput] No speech detected, user can try again');
      } else if (errCode === 'aborted') {
        console.log('[VoiceInput] Speech recognition was aborted');
      } else {
        console.warn('[VoiceInput] Unhandled speech recognition error:', errCode);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log('[VoiceInput] Speech recognition ended');
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      console.log('[VoiceInput] Speech recognition started');
      setIsRecording(true);
    } catch (err) {
      console.error('[VoiceInput] Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  }, []); // Empty deps — all values via refs, no stale closures

  return { isRecording, toggleRecording };
}
