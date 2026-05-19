import { systemPreferences } from 'electron';
import { platform } from 'os';

export class AudioPermissionManager {
  async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'not-determined'> {
    const os = platform();
    if (os === 'darwin') {
      try {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        if (status === 'granted') return 'granted';
        if (status === 'denied') return 'denied';
        return 'not-determined';
      } catch {
        return 'not-determined';
      }
    }
    return 'granted';
  }

  async requestMicrophonePermission(): Promise<boolean> {
    const os = platform();
    if (os === 'darwin') {
      try {
        return await systemPreferences.askForMediaAccess('microphone');
      } catch {
        return false;
      }
    }
    return true;
  }

  async checkSpeakerAvailability(): Promise<boolean> {
    return true;
  }
}
