// 语音录制 Hook - 用于工作区语音输入
import { useState, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';

interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  uri: string | null;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    durationMs: 0,
    uri: null,
  });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限不足', '需要麦克风权限才能使用语音输入');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    const permitted = await requestPermission();
    if (!permitted) return;

    try {
      // 配置录音
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Platform.OS === 'ios'
          ? Audio.RecordingOptionsPresets.HIGH_QUALITY
          : {
              ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
              android: {
                extension: '.m4a',
                outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                audioEncoder: Audio.AndroidAudioEncoder.AAC,
                sampleRate: 44100,
                numberOfChannels: 1,
                bitRate: 128000,
              },
            }
      );
      await recording.startAsync();
      recordingRef.current = recording;

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, durationMs: Date.now() - startTime }));
      }, 100);

      setState(prev => ({ ...prev, isRecording: true, isPaused: false, durationMs: 0, uri: null }));
    } catch (err) {
      console.error('[Voice] 启动录音失败:', err);
      Alert.alert('录音失败', '无法启动录音，请重试');
    }
  }, [requestPermission]);

  const pauseRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.pauseAsync();
      setState(prev => ({ ...prev, isPaused: true }));
    } catch {}
  }, []);

  const resumeRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.startAsync();
      setState(prev => ({ ...prev, isPaused: false }));
    } catch {}
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // 恢复音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setState({ isRecording: false, isPaused: false, durationMs: 0, uri });
      return uri;
    } catch (err) {
      console.error('[Voice] 停止录音失败:', err);
      recordingRef.current = null;
      setState({ isRecording: false, isPaused: false, durationMs: 0, uri: null });
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
    } catch {}
    recordingRef.current = null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    setState({ isRecording: false, isPaused: false, durationMs: 0, uri: null });
  }, []);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}
