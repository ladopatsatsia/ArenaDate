import React from 'react';
import '../src/i18n';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  parseChatMessage,
  formatPhotoMessage,
  formatVoiceMessage,
  formatMessageSnippet,
} from '../src/chat/ChatMediaUtils';
import { VoiceMessagePlayer } from '../src/chat/VoiceMessagePlayer';
import { ChatEmojiPicker } from '../src/chat/ChatEmojiPicker';
import { ChatMediaViewerModal } from '../src/chat/ChatMediaViewerModal';

describe('Chat Media & Emojis Suite', () => {
  const apiUrl = 'https://api.dating.test';
  const token = 'test-token-xyz';

  test('parseChatMessage correctly parses photo, voice, emoji-only and regular text', () => {
    // 1. Photo with caption
    const photoWithCap = parseChatMessage('[photo:1111-2222|Beautiful sunset!]', apiUrl, token);
    expect(photoWithCap.type).toBe('photo');
    expect(photoWithCap.mediaId).toBe('1111-2222');
    expect(photoWithCap.mediaUrl).toBe('https://api.dating.test/api/chat/media/1111-2222?token=test-token-xyz');
    expect(photoWithCap.caption).toBe('Beautiful sunset!');

    // 2. Photo without caption
    const photoNoCap = parseChatMessage('[photo:3333-4444]', apiUrl);
    expect(photoNoCap.type).toBe('photo');
    expect(photoNoCap.mediaId).toBe('3333-4444');
    expect(photoNoCap.mediaUrl).toBe('https://api.dating.test/api/chat/media/3333-4444');
    expect(photoNoCap.caption).toBeUndefined();

    // 3. Voice note with duration
    const voiceMsg = parseChatMessage('[voice:5555-6666|4.5]', apiUrl, token);
    expect(voiceMsg.type).toBe('voice');
    expect(voiceMsg.mediaId).toBe('5555-6666');
    expect(voiceMsg.duration).toBe(4.5);
    expect(voiceMsg.mediaUrl).toBe('https://api.dating.test/api/chat/media/5555-6666?token=test-token-xyz');

    // 4. Emoji only
    const emojiOnly = parseChatMessage('❤️🔥🥂', apiUrl);
    expect(emojiOnly.type).toBe('emoji_only');
    expect(emojiOnly.text).toBe('❤️🔥🥂');

    // 5. Regular text
    const textMsg = parseChatMessage('Hello there! How are you doing?', apiUrl);
    expect(textMsg.type).toBe('text');
    expect(textMsg.text).toBe('Hello there! How are you doing?');
  });

  test('formatting helpers formatPhotoMessage and formatVoiceMessage produce clean tags', () => {
    expect(formatPhotoMessage('photo-id-123')).toBe('[photo:photo-id-123]');
    expect(formatPhotoMessage('photo-id-123', 'My photo')).toBe('[photo:photo-id-123|My photo]');
    expect(formatVoiceMessage('voice-id-456', 3.42)).toBe('[voice:voice-id-456|3.4]');
  });

  test('formatMessageSnippet transforms tags to human-friendly previews', () => {
    const mockT = (key: string, def?: string) => def || key;
    expect(formatMessageSnippet('[photo:1111|Nice view]', mockT)).toBe('📷 Nice view');
    expect(formatMessageSnippet('[photo:1111]', mockT)).toBe('📷 ფოტო');
    expect(formatMessageSnippet('[voice:2222|5]', mockT)).toBe('🎤 ხმოვანი შეტყობინება');
    expect(formatMessageSnippet('Plain message', mockT)).toBe('Plain message');
    expect(formatMessageSnippet(null, mockT)).toBe('');
  });

  test('VoiceMessagePlayer renders play button and triggers playback', () => {
    render(
      <VoiceMessagePlayer
        mediaUrl="https://api.dating.test/api/chat/media/mock-audio.webm"
        durationSeconds={12}
        isOwn={true}
      />
    );

    expect(screen.getByTestId('voice-play-toggle')).toBeTruthy();
    expect(screen.getByText('0:12')).toBeTruthy();
    expect(screen.getByText('🎤 Voice')).toBeTruthy();

    fireEvent.press(screen.getByTestId('voice-play-toggle'));
  });

  test('ChatEmojiPicker displays categorized emojis and fires selection callback', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(<ChatEmojiPicker onSelectEmoji={onSelect} onClose={onClose} />);

    expect(screen.getByTestId('chat-emoji-picker')).toBeTruthy();
    expect(screen.getByTestId('emoji-❤️')).toBeTruthy();

    fireEvent.press(screen.getByTestId('emoji-❤️'));
    expect(onSelect).toHaveBeenCalledWith('❤️');

    fireEvent.press(screen.getByTestId('close-emoji-picker'));
    expect(onClose).toHaveBeenCalled();
  });

  test('ChatMediaViewerModal renders full image and responds to close button', () => {
    const onClose = jest.fn();
    render(
      <ChatMediaViewerModal
        visible={true}
        imageUrl="https://api.dating.test/api/chat/media/photo.jpg"
        caption="A beautiful evening"
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('media-viewer-image')).toBeTruthy();
    expect(screen.getByText('A beautiful evening')).toBeTruthy();

    fireEvent.press(screen.getByTestId('close-media-viewer'));
    expect(onClose).toHaveBeenCalled();
  });
});
