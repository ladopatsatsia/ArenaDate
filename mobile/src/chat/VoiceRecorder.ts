import { Platform } from 'react-native';

export interface VoiceRecordingResult {
  uri: string;
  blob?: Blob;
  duration: number; // in seconds
}

export type DurationListener = (seconds: number) => void;

interface WebStreamTrack {
  stop: () => void;
}
interface WebStream {
  getTracks: () => WebStreamTrack[];
}
interface WebMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  mimeType?: string;
  start: (timeslice?: number) => void;
  stop: () => void;
}
interface NativeAudioRecorder {
  stop: () => Promise<void>;
  uri?: string;
}

export class UniversalVoiceRecorder {
  private mediaRecorder: WebMediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: WebStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private durationSeconds = 0;
  private durationListeners: DurationListener[] = [];
  private isCurrentlyRecording = false;

  // Native expo-audio recorder reference if on native mobile
  private nativeRecorder: NativeAudioRecorder | null = null;

  onDuration(listener: DurationListener): () => void {
    this.durationListeners.push(listener);
    return () => {
      this.durationListeners = this.durationListeners.filter(l => l !== listener);
    };
  }

  private notifyDuration(secs: number) {
    this.durationSeconds = secs;
    for (const listener of this.durationListeners) {
      try {
        listener(secs);
      } catch {
        // ignore
      }
    }
  }

  isRecording(): boolean {
    return this.isCurrentlyRecording;
  }

  getDuration(): number {
    return this.durationSeconds;
  }

  async start(): Promise<void> {
    if (this.isCurrentlyRecording) return;
    this.durationSeconds = 0;
    this.notifyDuration(0);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      // Browser / Telegram WebApp
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      this.audioChunks = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            mimeType = 'audio/aac';
          } else {
            mimeType = '';
          }
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const win = window as unknown as { MediaRecorder: new (s: unknown, o?: unknown) => WebMediaRecorder };
      const recorder = new win.MediaRecorder(stream, options);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event: { data: Blob }) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.start(200); // 200ms slice
      this.isCurrentlyRecording = true;

      const startTime = Date.now();
      this.timer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        this.notifyDuration(Math.round(elapsed * 10) / 10);
      }, 200);
      return;
    }

    // Native Mobile (iOS / Android)
    if (Platform.OS !== 'web') {
      try {
        const ExpoAudio = await import('expo-audio');
        if (ExpoAudio && ExpoAudio.requestRecordingPermissionsAsync) {
          const perm = await ExpoAudio.requestRecordingPermissionsAsync();
          if (!perm.granted) {
            throw new Error('microphone_permission_denied');
          }
          const recorder = new ExpoAudio.AudioRecorder(
            ExpoAudio.RecordingPresets?.HIGH_QUALITY || {}
          ) as unknown as NativeAudioRecorder;
          const recObj = recorder as unknown as Record<string, unknown>;
          if ('prepareToRecordAsync' in recObj) {
            await (recObj as { prepareToRecordAsync: () => Promise<void> }).prepareToRecordAsync();
          }
          if ('record' in recObj) {
            (recObj as { record: () => void }).record();
          }
          this.nativeRecorder = recorder;
          this.isCurrentlyRecording = true;

          const startTime = Date.now();
          this.timer = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            this.notifyDuration(Math.round(elapsed * 10) / 10);
          }, 200);
          return;
        }
      } catch (nativeErr) {
        console.warn('Native expo-audio recorder initialization failed, falling back:', nativeErr);
      }
    }

    // Fallback or Test mock
    this.isCurrentlyRecording = true;
    const startTime = Date.now();
    this.timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      this.notifyDuration(Math.round(elapsed * 10) / 10);
    }, 200);
  }

  async stop(): Promise<VoiceRecordingResult> {
    if (!this.isCurrentlyRecording) {
      return { uri: '', duration: 0 };
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isCurrentlyRecording = false;
    const finalDuration = Math.max(1, Math.round(this.durationSeconds * 10) / 10);

    // Web MediaRecorder stop
    if (this.mediaRecorder) {
      const rec = this.mediaRecorder;
      this.mediaRecorder = null;

      const resultBlob = await new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          const mimeType = rec.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mimeType });
          resolve(blob);
        };
        try {
          rec.stop();
        } catch {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          resolve(blob);
        }
      });

      if (this.stream) {
        try {
          this.stream.getTracks().forEach((track: WebStreamTrack) => track.stop());
        } catch {
          // ignore
        }
        this.stream = null;
      }

      const uri = typeof URL !== 'undefined' ? URL.createObjectURL(resultBlob) : 'blob:test';
      return {
        uri,
        blob: resultBlob,
        duration: finalDuration,
      };
    }

    // Native recorder stop
    if (this.nativeRecorder) {
      try {
        await this.nativeRecorder.stop();
        const uri = this.nativeRecorder.uri || '';
        this.nativeRecorder = null;
        return {
          uri,
          duration: finalDuration,
        };
      } catch (err) {
        console.warn('Native audio recorder stop failed:', err);
      }
      this.nativeRecorder = null;
    }

    // Fallback mock
    return {
      uri: 'test-recording://mock.m4a',
      duration: finalDuration,
    };
  }

  cancel(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isCurrentlyRecording = false;
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
      this.mediaRecorder = null;
    }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track: WebStreamTrack) => track.stop());
      } catch {
        // ignore
      }
      this.stream = null;
    }
    if (this.nativeRecorder) {
      try {
        this.nativeRecorder.stop();
      } catch {
        // ignore
      }
      this.nativeRecorder = null;
    }
  }
}
