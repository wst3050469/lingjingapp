import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 语音输入 Hook — 多引擎降级链
 *
 * 降级策略:
 *   1. Web Speech API (最快, Chrome/Edge/Electron)
 *   2. WebSocket ASR (服务器 Whisper, 所有平台含APK)
 *   3. 降级失败时显示错误提示
 */

// 服务器 ASR WebSocket 端点
const ASR_WS_URL = (() => {
  const host = (typeof window !== 'undefined' && window.location?.hostname) || '127.0.0.1';
  return `ws://${host}:8900/api/v1/asr/stream`;
})();

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [engineType, setEngineType] = useState<'webspeech' | 'websocket' | 'none'>('none');

  const recognitionRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsResolveRef = useRef<((text: string) => void) | null>(null);
  const baseTextRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ── 引擎检测 ──
  const detectEngine = useCallback((): 'webspeech' | 'websocket' => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      return 'webspeech';
    }
    // WebSocket ASR 是全平台可用的（服务器 Whisper）
    return 'websocket';
  }, []);

  // ── 停止录音 ──
  const stopAll = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send('__END__');
        }
      } catch {}
      // 不立即关闭，等 final 结果
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    setIsRecording(false);
  }, []);

  // ── Web Speech API 引擎 ──
  const startWebSpeech = useCallback((currentText?: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    let recognition: any;
    try {
      recognition = new SpeechRecognition();
    } catch {
      return false;
    }

    baseTextRef.current = currentText || '';
    let finalTranscript = baseTextRef.current;

    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      onTranscriptRef.current(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      const errCode = event?.error || 'unknown';
      if (errCode === 'not-allowed') {
        alert('语音输入被拒绝：请确保已授予灵境应用麦克风权限。');
      } else if (errCode === 'no-speech') {
        console.log('[VoiceInput] No speech detected');
      } else if (errCode !== 'aborted') {
        console.warn('[VoiceInput] Speech recognition error:', errCode);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  // ── WebSocket ASR 引擎（服务器 Whisper 降级） ──
  const startWebSocketASR = useCallback((_currentText?: string) => {
    // 1. 先获取麦克风流
    let stream: MediaStream | null = null;

    const doStart = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        alert('无法访问麦克风，请检查系统权限设置。');
        setIsRecording(false);
        return;
      }

      // 2. 用 MediaRecorder 录制 PCM
      // 浏览器不支持直接输出 PCM，用 AudioContext 重采样到 16kHz
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      let ws: WebSocket | null = null;

      try {
        ws = new WebSocket(ASR_WS_URL);
      } catch {
        alert('无法连接到语音识别服务器，请检查网络连接。');
        setIsRecording(false);
        audioCtx.close();
        return;
      }

      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // WebSocket 连接后开始处理音频
      ws.onopen = () => {
        console.log('[VoiceInput] WebSocket ASR 已连接');

        processor.onaudioprocess = (e) => {
          if (ws?.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          // Float32 → PCM16
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          ws.send(pcm.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
        setIsRecording(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'interim' && data.text) {
            // 增量文本，追加到已有文本后
            onTranscriptRef.current((baseTextRef.current || '') + data.text);
            baseTextRef.current = (baseTextRef.current || '') + data.text;
          } else if (data.type === 'final' && data.text) {
            onTranscriptRef.current(data.text);
            baseTextRef.current = data.text;
          } else if (data.type === 'error') {
            console.error('[VoiceInput] ASR error:', data.message);
          }
        } catch {}
      };

      ws.onerror = () => {
        console.error('[VoiceInput] WebSocket ASR 连接错误');
        setIsRecording(false);
        audioCtx.close();
      };

      ws.onclose = () => {
        console.log('[VoiceInput] WebSocket ASR 已断开');
        setIsRecording(false);
        audioCtx.close();
        stream?.getTracks().forEach(t => t.stop());
      };
    };

    doStart();
  }, []);

  // ── 切换录音 ──
  const toggleRecording = useCallback((currentText?: string) => {
    if (isRecordingRef.current) {
      stopAll();
      return;
    }

    baseTextRef.current = currentText || '';
    const engine = detectEngine();
    setEngineType(engine);

    // 引擎降级链
    if (engine === 'webspeech') {
      const ok = startWebSpeech(currentText);
      if (ok) {
        console.log('[VoiceInput] 使用 Web Speech API');
        setIsRecording(true);
        return;
      }
      // WebSpeech 失败，降级到 WebSocket
      console.log('[VoiceInput] WebSpeech 不可用，降级到 WebSocket ASR');
    }

    startWebSocketASR(currentText);
  }, [detectEngine, startWebSpeech, startWebSocketASR, stopAll]);

  // ── 清理 ──
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return { isRecording, toggleRecording, engineType };
}
