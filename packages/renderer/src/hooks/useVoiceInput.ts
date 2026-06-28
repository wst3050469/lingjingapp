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
  const [lastError, setLastError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsResolveRef = useRef<((text: string) => void) | null>(null);
  const baseTextRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    // 清除连接超时
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    // 安全关闭 WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send('__END__');
        }
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch {}
      wsRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    // 清理音频上下文
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    // 停止麦克风流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
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
    const doStart = async () => {
      setLastError(null);

      // 1. 获取麦克风流
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (err: any) {
        const msg = err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
          ? '麦克风权限被拒绝，请在系统设置中允许灵境访问麦克风'
          : '无法访问麦克风，请检查系统权限设置';
        setLastError(msg);
        alert(msg);
        setIsRecording(false);
        return;
      }

      // 2. 创建 AudioContext 处理音频
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
      } catch {
        setLastError('浏览器不支持音频处理');
        alert('浏览器不支持音频处理，请使用 Chrome 或 Edge');
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        return;
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      // 3. 连接 WebSocket（带超时）
      let ws: WebSocket;
      try {
        ws = new WebSocket(ASR_WS_URL);
      } catch {
        setLastError('无法连接语音识别服务器');
        alert('无法连接到语音识别服务器，请检查网络连接。\n\n语音识别需要 Whisper 服务运行在 8900 端口。');
        audioCtx.close();
        audioCtxRef.current = null;
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        return;
      }

      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      let connectionOpened = false;
      let cleaned = false;

      const cleanup = (reason: string) => {
        if (cleaned) return;
        cleaned = true;
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch {}
        wsRef.current = null;
        try { processor.disconnect(); } catch {}
        try { source.disconnect(); } catch {}
        try { audioCtx.close(); } catch {}
        audioCtxRef.current = null;
        stream?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        console.log('[VoiceInput] WebSocket ASR cleanup:', reason);
      };

      // 10 秒连接超时
      connectTimeoutRef.current = setTimeout(() => {
        if (!connectionOpened) {
          setLastError('语音识别服务器连接超时（10秒）');
          console.error('[VoiceInput] WebSocket 连接超时');
          cleanup('timeout');
        }
      }, 10000);

      ws.onopen = () => {
        connectionOpened = true;
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        console.log('[VoiceInput] WebSocket ASR 已连接');

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          try { ws.send(pcm.buffer); } catch {}
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
        setEngineType('websocket');
        setIsRecording(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'interim' && data.text) {
            onTranscriptRef.current((baseTextRef.current || '') + data.text);
            baseTextRef.current = (baseTextRef.current || '') + data.text;
          } else if (data.type === 'final' && data.text) {
            onTranscriptRef.current(data.text);
            baseTextRef.current = data.text;
          } else if (data.type === 'error') {
            console.error('[VoiceInput] ASR error:', data.message);
            setLastError(data.message || '语音识别出错');
          }
        } catch {}
      };

      ws.onerror = () => {
        console.error('[VoiceInput] WebSocket ASR 连接错误');
        setLastError('语音识别服务器连接失败，请确认 Whisper 服务已启动（端口 8900）');
        cleanup('error');
      };

      ws.onclose = () => {
        console.log('[VoiceInput] WebSocket ASR 已断开');
        cleanup('closed');
      };
    };

    doStart();
  }, []);

  // ── 切换录音 ──
  const toggleRecording = useCallback(async (currentText?: string) => {
    if (isRecordingRef.current) {
      stopAll();
      return;
    }

    // 检查麦克风权限是否已开启
    try {
      if (window.electronAPI?.permissions?.microphone?.isEnabled) {
        const micEnabled = await window.electronAPI.permissions.microphone.isEnabled();
        if (!micEnabled) {
          alert('麦克风权限未开启，请在 设置 → 高级 → 麦克风权限 中开启。');
          return;
        }
      }
    } catch {
      // 如果 permissions API 不可用（如非 Electron 环境），继续执行
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

  return { isRecording, toggleRecording, engineType, lastError, clearError: () => setLastError(null) };
}
