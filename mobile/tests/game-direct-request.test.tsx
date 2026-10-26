import React from 'react';
import i18n from '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

describe('GameTable Direct Match Request & AI button removal', () => {
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
    pendingDirectRequests: [],
    sentDirectRequestUserIds: [],
  };

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

  test('does not render AI commentator button on the game table', async () => {
    const requestMock = jest.fn(async (path: string) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return mockSnapshot;
      }
      if (path === '/api/game/wallet') {
        return { balance: 200, outstandingDebt: 0, transactions: [] };
      }
      if (path === '/api/game/store/products') {
        return [];
      }
      if (path === `/api/game/rooms/${roomId}/messages`) {
        return [];
      }
      return null;
    });

    const gameApi = createMockGameApi(requestMock);
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

    await waitFor(() => {
      expect(screen.getByText('Arena #1')).toBeTruthy();
    });

    // AI button must NOT exist
    expect(screen.queryByTestId('ai-consent-badge')).toBeNull();
    expect(screen.queryByText(/🤖 AI/)).toBeNull();
  });

  test('allows tapping player seat and sending direct match request with 1 message for 125 crystals', async () => {
    let sentRequestData: unknown = null;

    const requestMock = jest.fn(async (path: string, body?: unknown) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return mockSnapshot;
      }
      if (path === '/api/game/wallet') {
        return { balance: 250, outstandingDebt: 0, transactions: [] };
      }
      if (path === '/api/game/store/products') {
        return [];
      }
      if (path === `/api/game/rooms/${roomId}/messages`) {
        return [];
      }
      if (path === '/api/game/profiles/user-other') {
        return {
          userId: 'user-other',
          displayName: 'Nino',
          age: 23,
          city: 'თბილისი',
          bio: 'მოგესალმებით!',
          isFullAccess: false,
          photos: [],
          interests: [],
        };
      }
      if (path === '/api/game/direct-request') {
        sentRequestData = body;
        return {
          requestId: 'req-123',
          targetUserId: 'user-other',
          status: 'Pending',
          crystalsPaid: 125,
          balanceAfter: 125,
          createdAtUtc: new Date().toISOString(),
        };
      }
      return null;
    });

    const gameApi = createMockGameApi(requestMock);
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

    await waitFor(() => {
      expect(screen.getByTestId('seat-user-other')).toBeTruthy();
    });

    // Tap other player seat
    fireEvent.press(screen.getByTestId('seat-user-other'));

    // Check that direct request section and input are rendered
    await waitFor(() => {
      expect(screen.getByTestId('direct-request-message-input')).toBeTruthy();
    });

    // Type a single message
    fireEvent.changeText(screen.getByTestId('direct-request-message-input'), 'გამარჯობა, ძალიან მომეწონე!');

    // Press send direct match request button
    const sendButton = screen.getByTestId('send-direct-request-button');
    expect(sendButton).toBeTruthy();
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(sentRequestData).toEqual(
        expect.objectContaining({
          targetUserId: 'user-other',
          message: 'გამარჯობა, ძალიან მომეწონე!',
          roomId,
        })
      );
    });
  });

  test('displays incoming direct match request to recipient with accept and decline options', async () => {
    let respondedAction: unknown = null;

    const recipientSnapshot = {
      ...mockSnapshot,
      pendingDirectRequests: [
        {
          requestId: 'req-incoming-999',
          senderUserId: 'user-other',
          senderDisplayName: 'Nino',
          senderAge: 23,
          senderPhoto: null,
          message: 'მოგესალმებით, გავიცნოთ ერთმანეთი? ✨',
          createdAtUtc: new Date().toISOString(),
        },
      ],
    };

    const requestMock = jest.fn(async (path: string, body?: unknown) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return recipientSnapshot;
      }
      if (path === '/api/game/wallet') {
        return { balance: 100, outstandingDebt: 0, transactions: [] };
      }
      if (path === '/api/game/store/products') {
        return [];
      }
      if (path === `/api/game/rooms/${roomId}/messages`) {
        return [];
      }
      if (path === '/api/game/direct-request/req-incoming-999/respond') {
        respondedAction = body;
        return {
          requestId: 'req-incoming-999',
          status: 'Accepted',
          matchId: 'match-111',
          conversationId: 'conv-222',
        };
      }
      return null;
    });

    const gameApi = createMockGameApi(requestMock);
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

    // Verify incoming match request modal content
    await waitFor(() => {
      expect(screen.getByText('ახალი მეჩის რექუესტი!')).toBeTruthy();
      expect(screen.getByText(/"მოგესალმებით, გავიცნოთ ერთმანეთი\? ✨"/)).toBeTruthy();
      expect(screen.getByTestId('accept-direct-request-button')).toBeTruthy();
      expect(screen.getByTestId('decline-direct-request-button')).toBeTruthy();
    });

    // Tap Accept
    fireEvent.press(screen.getByTestId('accept-direct-request-button'));

    await waitFor(() => {
      expect(respondedAction).toEqual({ action: 'Accept' });
    });
  });
});
