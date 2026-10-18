import React from 'react';
import { AppState } from 'react-native';
import '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatScreen } from '../src/chat/ChatScreen';
import { useAuth } from '../src/auth/AuthProvider';
import type { Message } from '../src/chat/api';
import { formatReplyMessage, parseChatMessage } from '../src/chat/ChatMediaUtils';

jest.mock('../src/auth/AuthProvider');
jest.mock('expo-router', () => ({
  Link: require('react-native').Text,
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'reply-test-uuid' }));
jest.mock('../src/chat/storage', () => ({ pendingStore: () => ({ load: async () => null, save: async () => {} }) }));
jest.mock('../src/chat/live', () => ({ signalRConnection: () => ({}), LiveChat: class { start() {} async stop() {} } }));

describe('Chat Reply & Message Actions', () => {
  test('parseChatMessage and formatReplyMessage correctly serialize and deserialize quoted replies', () => {
    const serialized = formatReplyMessage('msg-123', 'მარიამი', 'გამარჯობა', 'როგორ ხარ?');
    expect(serialized).toBe('[reply:msg-123|მარიამი|გამარჯობა]\nროგორ ხარ?');

    const parsed = parseChatMessage(serialized, 'https://api.test');
    expect(parsed.reply).toBeDefined();
    expect(parsed.reply?.replyToId).toBe('msg-123');
    expect(parsed.reply?.sender).toBe('მარიამი');
    expect(parsed.reply?.snippet).toBe('გამარჯობა');
    expect(parsed.text).toBe('როგორ ხარ?');
  });

  test('tapping message three dots button opens message action modal with reply option and sets reply state', async () => {
    const peerMessage: Message = {
      id: 'msg-peer-1',
      conversationId: 'conv-1',
      senderId: 'peer-id',
      clientMessageId: 'client-peer-1',
      sequence: '1',
      text: 'რა გქვია?',
      sentAt: '2026-10-01T12:00:00Z',
    };

    let sentPayload: unknown = null;
    const request = jest.fn(async (path: string, body?: unknown) => {
      if (path.endsWith('/messages') && body) {
        sentPayload = body;
        return {
          ...peerMessage,
          id: 'own-reply-id',
          senderId: 'A',
          sequence: '2',
          text: (body as { text: string }).text,
        };
      }
      if (path.includes('/messages')) {
        return { items: [peerMessage], nextBefore: null, nextAfter: null, readSequence: '0', peerReadSequence: '0' };
      }
      return {};
    });

    const manager = {
      snapshot: () => ({ account: { id: 'A' } }),
      withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token'),
    };
    jest.mocked(useAuth).mockReturnValue({
      api: { baseUrl: 'https://api.test', request },
      manager,
      state: { status: 'signedIn', account: { id: 'A' } },
    } as unknown as ReturnType<typeof useAuth>);

    AppState.currentState = 'active';
    const cache = new QueryClient();
    const view = render(
      <QueryClientProvider client={cache}>
        <ChatScreen id="conv-1" account="A" peerName="მარიამი" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('რა გქვია?')).toBeTruthy());

    // Tap three dots button on the peer message
    const dotsBtn = screen.getByTestId('message-dots-msg-peer-1');
    expect(dotsBtn).toBeTruthy();
    fireEvent.press(dotsBtn);

    // Modal action "Reply" should now be visible
    const replyActionBtn = screen.getByTestId('action-reply-btn');
    expect(replyActionBtn).toBeTruthy();
    fireEvent.press(replyActionBtn);

    // Reply preview bar should now be displayed above composer
    await waitFor(() => expect(screen.getByTestId('reply-preview-bar')).toBeTruthy());
    expect(screen.getAllByText('მარიამი', { exact: false }).length).toBeGreaterThanOrEqual(2);

    // Type a reply text and submit
    fireEvent.changeText(screen.getByLabelText('Message'), 'გიორგი');
    fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sentPayload).toBeTruthy());
    expect((sentPayload as { text: string }).text).toContain('[reply:msg-peer-1|მარიამი|რა გქვია?]\nგიორგი');

    // Reply preview bar should be dismissed after sending
    expect(screen.queryByTestId('reply-preview-bar')).toBeNull();

    view.unmount();
    cache.clear();
  });
});
