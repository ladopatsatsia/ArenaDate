let createAudioPlayerFn: ((source: unknown) => { play?: () => void; pause?: () => void; seekTo?: (seconds: number) => void; release?: () => void }) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const expoAudio = require('expo-audio');
  createAudioPlayerFn = expoAudio.createAudioPlayer;
} catch {
  // Safe fallback for environments where expo-audio native module is unlinked (e.g. Jest / Node)
}

// Sound assets
// eslint-disable-next-line @typescript-eslint/no-require-imports
const spinSoundAsset = require('../../assets/sounds/spin.wav');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const turnSelectedSoundAsset = require('../../assets/sounds/turn_selected.wav');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const kissSentSoundAsset = require('../../assets/sounds/kiss_sent.wav');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const kissReceivedSoundAsset = require('../../assets/sounds/kiss_received.wav');

interface SoundPlayerInstance {
  play?: () => void;
  pause?: () => void;
  seekTo?: (seconds: number) => void;
  release?: () => void;
}

export class GameSoundManager {
  private enabled: boolean = true;
  private spinPlayer: SoundPlayerInstance | null = null;
  private turnPlayer: SoundPlayerInstance | null = null;
  private kissSentPlayer: SoundPlayerInstance | null = null;
  private kissReceivedPlayer: SoundPlayerInstance | null = null;

  private getPlayer(type: 'spin' | 'turn' | 'kissSent' | 'kissReceived'): SoundPlayerInstance | null {
    if (!createAudioPlayerFn) return null;
    try {
      if (type === 'spin') {
        if (!this.spinPlayer) this.spinPlayer = createAudioPlayerFn(spinSoundAsset);
        return this.spinPlayer;
      }
      if (type === 'turn') {
        if (!this.turnPlayer) this.turnPlayer = createAudioPlayerFn(turnSelectedSoundAsset);
        return this.turnPlayer;
      }
      if (type === 'kissSent') {
        if (!this.kissSentPlayer) this.kissSentPlayer = createAudioPlayerFn(kissSentSoundAsset);
        return this.kissSentPlayer;
      }
      if (type === 'kissReceived') {
        if (!this.kissReceivedPlayer) this.kissReceivedPlayer = createAudioPlayerFn(kissReceivedSoundAsset);
        return this.kissReceivedPlayer;
      }
    } catch {
      return null;
    }
    return null;
  }

  playSpin(): void {
    if (!this.enabled) return;
    try {
      const p = this.getPlayer('spin');
      if (p) {
        p.seekTo?.(0);
        p.play?.();
      }
    } catch {
      // Ignored
    }
  }

  stopSpin(): void {
    try {
      this.spinPlayer?.pause?.();
    } catch {
      // Ignored
    }
  }

  playTurnSelected(): void {
    if (!this.enabled) return;
    try {
      const p = this.getPlayer('turn');
      if (p) {
        p.seekTo?.(0);
        p.play?.();
      }
    } catch {
      // Ignored
    }
  }

  playKissSent(): void {
    if (!this.enabled) return;
    try {
      const p = this.getPlayer('kissSent');
      if (p) {
        p.seekTo?.(0);
        p.play?.();
      }
    } catch {
      // Ignored
    }
  }

  playKissReceived(): void {
    if (!this.enabled) return;
    try {
      const p = this.getPlayer('kissReceived');
      if (p) {
        p.seekTo?.(0);
        p.play?.();
      }
    } catch {
      // Ignored
    }
  }

  setSoundEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) {
      this.stopSpin();
    }
  }

  isSoundEnabled(): boolean {
    return this.enabled;
  }
}

export const gameSound = new GameSoundManager();
