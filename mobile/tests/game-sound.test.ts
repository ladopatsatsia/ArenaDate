import { gameSound, GameSoundManager } from '../src/game/GameSound';

describe('GameSoundManager', () => {
  beforeEach(() => {
    gameSound.setSoundEnabled(true);
  });

  test('sound triggers execute safely in test environment without throwing', () => {
    expect(() => {
      gameSound.playSpin();
      gameSound.stopSpin();
      gameSound.playTurnSelected();
      gameSound.playKissSent();
      gameSound.playKissReceived();
    }).not.toThrow();
  });

  test('supports muting and unmuting sounds', () => {
    expect(gameSound.isSoundEnabled()).toBe(true);

    gameSound.setSoundEnabled(false);
    expect(gameSound.isSoundEnabled()).toBe(false);

    // Should no-op safely when muted
    expect(() => {
      gameSound.playSpin();
      gameSound.playTurnSelected();
      gameSound.playKissSent();
      gameSound.playKissReceived();
    }).not.toThrow();

    gameSound.setSoundEnabled(true);
    expect(gameSound.isSoundEnabled()).toBe(true);
  });

  test('can instantiate standalone GameSoundManager instance', () => {
    const manager = new GameSoundManager();
    expect(manager.isSoundEnabled()).toBe(true);
    manager.setSoundEnabled(false);
    expect(manager.isSoundEnabled()).toBe(false);
  });
});
