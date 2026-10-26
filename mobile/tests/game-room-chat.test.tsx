import React from 'react';
import i18n from '../src/i18n';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameTable } from '../src/game/GameTable';
import { GameApi } from '../src/game/GameApi';
import type { AuthApi } from '../src/auth/api';
import type { SessionManager } from '../src/auth/session';

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: { account: { id: 'user-me' } },
    api: {} as AuthApi,
    manager: {
      snapshot: () => ({ account: { id: 'user-me' } }),
      withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token'),
    } as unknown as SessionManager,
  }),
}));

describe('GameTable Room Chat', () => {
  beforeEach(() => {
    void i18n.changeLanguage('ka');
  });

  const roomId = '11111111-1111-1111-1111-111111111111';
  const currentUserId = 'user-me';

  const mockSnapshot = {
    roomId,
    title: 'Arena #1',
    state: 'Active',
    capacity: 6,
    memberCount: 2,
    members: [
      {
        userId: 'user-me',
        displayName: 'Dato',
        age: 25,
        gender: 'man',
        status: 'Active',
        isSelf: true,
        photo: null,
        joinedAtUtc: '2026-10-06T12:00:00Z',
      },
      {
        userId: 'user-other',
        displayName: 'Nino',
        age: 23,
        gender: 'woman',
        status: 'Active',
        isSelf: false,
        photo: null,
        joinedAtUtc: '2026-10-06T12:00:00Z',
      },
    ],
    stateVersion: 1,
    currentRoundNumber: 1,
    totalRounds: 18,
    deadlineType: 'TurnPending',
    currentTurnUserId: 'user-me',
    currentRound: null,
  };

  const mockMessages = [
    {
      id: 'msg-1',
      roomId,
      senderUserId: 'user-other',
      senderDisplayName: 'Nino',
      senderPhotoId: null,
      text: 'გამარჯობა ყველას! 👋',
      sentAtUtc: '2026-10-06T12:01:00Z',
    },
  ];

  function createMockGameApi(requestMock: jest.Mock): GameApi {
    const authApi = {
      baseUrl: 'https://api.test',
      request: requestMock,
    } as unknown as AuthApi;

    const session = {
      snapshot: () => ({ account: { id: currentUserId } }),
      withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token'),
    } as unknown as SessionManager;

    return new GameApi(authApi, session);
  }

  test('renders chat button, opens chat modal, displays messages and sends a quick message', async () => {
    const request = jest.fn().mockImplementation((path: string, body?: unknown) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return Promise.resolve(mockSnapshot);
      }
      if (path === '/api/game/wallet') {
        return Promise.resolve({ balance: 50, outstandingDebt: 0, recentTransactions: [] });
      }
      if (path === '/api/game/store/products') {
        return Promise.resolve([]);
      }
      if (path === '/api/game/ai-consent') {
        return Promise.resolve({ aiConsent: true });
      }
      if (path === `/api/game/rooms/${roomId}/messages`) {
        if (body) {
          return Promise.resolve({
            id: 'msg-2',
            roomId,
            senderUserId: currentUserId,
            senderDisplayName: 'Dato',
            senderPhotoId: null,
            text: (body as { text: string }).text,
            sentAtUtc: new Date().toISOString(),
          });
        }
        return Promise.resolve(mockMessages);
      }
      return Promise.resolve(null);
    });

    const gameApi = createMockGameApi(request);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GameTable
          roomId={roomId}
          gameApi={gameApi}
          currentUserId={currentUserId}
          onLeave={jest.fn()}
        />
      </QueryClientProvider>
    );

    // Verify chat badge is visible in header
    const chatBadge = await waitFor(() => screen.getByTestId('game-chat-badge'));
    expect(chatBadge).toBeTruthy();

    // Open chat modal
    fireEvent.press(chatBadge);

    // Verify modal elements
    await waitFor(() => {
      expect(screen.getByText('💬 საერთო ჩატი')).toBeTruthy();
      expect(screen.getByText('გამარჯობა ყველას! 👋')).toBeTruthy();
      expect(screen.getByTestId('chat-msg-msg-1')).toBeTruthy();
    });

    // Test sending quick reaction chip
    const quickChip = screen.getByTestId('quick-chip-🍾 დაატრიალე!');
    expect(quickChip).toBeTruthy();
    fireEvent.press(quickChip);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        `/api/game/rooms/${roomId}/messages`,
        { text: '🍾 დაატრიალე!' },
        'token'
      );
    });

    // Test sending custom message via input
    const input = screen.getByTestId('room-chat-input');
    fireEvent.changeText(input, 'წარმატებები თამაშში!');
    const sendBtn = screen.getByTestId('room-chat-send-btn');
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        `/api/game/rooms/${roomId}/messages`,
        { text: 'წარმატებები თამაშში!' },
        'token'
      );
    });

    // Close chat modal
    const closeBtn = screen.getByTestId('close-room-chat-btn');
    fireEvent.press(closeBtn);
  }, 15000);

  test('displays red unread badge and floating preview banner when another player sends a message while chat is closed', async () => {
    const initialMsgs = [
      {
        id: 'msg-1',
        roomId,
        senderUserId: 'user-other',
        senderDisplayName: 'Nino',
        senderPhotoId: null,
        text: 'გამარჯობა ყველას! 👋',
        sentAtUtc: '2026-10-06T12:01:00Z',
      },
    ];
    let serverMsgs = [...initialMsgs];

    const request = jest.fn().mockImplementation((path: string) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return Promise.resolve(mockSnapshot);
      }
      if (path === '/api/game/wallet') {
        return Promise.resolve({ balance: 50, outstandingDebt: 0, recentTransactions: [] });
      }
      if (path === '/api/game/store/products') {
        return Promise.resolve([]);
      }
      if (path === '/api/game/ai-consent') {
        return Promise.resolve({ aiConsent: true });
      }
      if (path === `/api/game/rooms/${roomId}/messages`) {
        return Promise.resolve([...serverMsgs]);
      }
      return Promise.resolve(null);
    });

    const gameApi = createMockGameApi(request);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GameTable
          roomId={roomId}
          gameApi={gameApi}
          currentUserId={currentUserId}
          onLeave={jest.fn()}
        />
      </QueryClientProvider>
    );

    // Initial render: wait until initial messages query resolves and populates cache
    await waitFor(() => screen.getByTestId('game-chat-badge'));
    await waitFor(() => {
      const data = queryClient.getQueryData<typeof initialMsgs>(['game-room-messages', roomId]);
      expect(data).toHaveLength(1);
    });
    expect(screen.queryByTestId('chat-unread-badge')).toBeNull();
    expect(screen.queryByTestId('floating-chat-banner')).toBeNull();

    // Ensure initial load effect has run and registered existing messages as seen
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Now another player sends a second message in the room
    const updatedMsgs = [
      ...initialMsgs,
      {
        id: 'msg-2',
        roomId,
        senderUserId: 'user-other',
        senderDisplayName: 'Nino',
        senderPhotoId: null,
        text: 'ბოთლი დაატრიალეთ! 🍾',
        sentAtUtc: '2026-10-06T12:02:00Z',
      },
    ];
    serverMsgs = [...updatedMsgs];

    // Trigger update in React Query cache
    await act(async () => {
      queryClient.setQueryData(['game-room-messages', roomId], updatedMsgs);
      await queryClient.refetchQueries({ queryKey: ['game-room-messages', roomId] });
    });

    // Verify red badge with count 1 appears
    const badge = await waitFor(() => screen.getByTestId('chat-unread-badge'));
    expect(badge).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    // Verify floating incoming chat banner appears
    const banner = await waitFor(() => screen.getByTestId('floating-chat-banner'));
    expect(banner).toBeTruthy();
    expect(screen.getByText('ბოთლი დაატრიალეთ! 🍾')).toBeTruthy();

    // Clicking the floating banner opens the chat modal and clears the unread badge
    fireEvent.press(banner);

    await waitFor(() => {
      expect(screen.getByText('💬 საერთო ჩატი')).toBeTruthy();
      expect(screen.queryByTestId('chat-unread-badge')).toBeNull();
      expect(screen.queryByTestId('floating-chat-banner')).toBeNull();
    });
  }, 15000);
});

