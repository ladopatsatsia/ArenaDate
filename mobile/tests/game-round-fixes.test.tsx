import React from 'react';
import i18n from '../src/i18n';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameTable } from '../src/game/GameTable';
import { GameApi } from '../src/game/GameApi';
import type { AuthApi } from '../src/auth/api';
import type { SessionManager } from '../src/auth/session';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

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

describe('GameTable Round & Kiss Fixes', () => {
  beforeEach(() => {
    void i18n.changeLanguage('ka');
  });

  const roomId = '22222222-2222-2222-2222-222222222222';
  const currentUserId = 'user-me';
  const partnerUserId = 'user-partner';

  function createMockGameApi(requestMock: jest.Mock): GameApi {
    const authApi = {
      request: requestMock,
    } as unknown as AuthApi;
    const session = {
      snapshot: () => ({
        token: 'test-token',
        account: { id: currentUserId, email: 'user@test.com' },
      }),
      withAccess: async (action: (token: string) => Promise<unknown>) => action('test-token'),
    } as unknown as SessionManager;
    return new GameApi(authApi, session);
  }

  test('answer mutation includes currentUserId in idempotencyKey and sends to backend', async () => {
    const roundId = 'round-111';
    const request = jest.fn(async (path: string, body?: any) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return {
          roomId,
          title: 'Arena #1',
          state: 'Playing',
          capacity: 6,
          memberCount: 2,
          currentTurnUserId: currentUserId,
          currentRoundId: roundId,
          stateVersion: 5,
          remainingDeadlineMs: 25000,
          deadlineUtc: new Date(Date.now() + 25000).toISOString(),
          deadlineType: 'QuestionAnswering',
          members: [
            { userId: currentUserId, displayName: 'Dato', age: 25, gender: 'man', status: 'Active', isSelf: true },
            { userId: partnerUserId, displayName: 'Nino', age: 23, gender: 'woman', status: 'Active', isSelf: false },
          ],
          currentRound: {
            roundId,
            roundNumber: 1,
            spinnerUserId: currentUserId,
            targetUserId: partnerUserId,
            angleDegrees: 180,
            state: 'QuestionAnswering',
            currentQuestionIndex: 0,
            currentQuestion: {
              id: 'q-101',
              questionText: 'სად გაატარებდი იდეალურ პირველ პაემანს?',
              options: ['მყუდრო კაფეში', 'სასეირნოდ პარკში'],
              category: 'lifestyle',
            },
            callerPendingAnswer: null,
            revealedSelections: [],
            deadlineUtc: new Date(Date.now() + 25000).toISOString(),
            deadlineType: 'QuestionAnswering',
            kissRecipientUserId: null,
            kissSkipped: false,
            hasPendingKissFromPartner: false,
            summaryCommentary: null,
          },
          recentKisses: [],
          recentGifts: [],
        };
      }
      if (path === '/api/game/wallet') {
        return { balance: 100 };
      }
      if (path === '/api/game/store/products') {
        return [];
      }
      if (path === '/api/game/ai-consent') {
        return { aiConsent: true };
      }
      if (path.includes('/messages')) {
        return [];
      }
      if (path.includes('/answer')) {
        return {
          roundId,
          questionIndex: 0,
          submitted: true,
          waitingForPartner: true,
          revealed: false,
          revealedSelection: null,
        };
      }
      return {};
    });

    const gameApi = createMockGameApi(request);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GameTable
          roomId={roomId}
          currentUserId={currentUserId}
          gameApi={gameApi}
          onLeave={jest.fn()}
        />
      </QueryClientProvider>
    );

    const optionBtn = await waitFor(() => screen.getByTestId('question-option-0'));
    fireEvent.press(optionBtn);

    await waitFor(() => {
      const answerCall = request.mock.calls.find(call => call[0].includes('/answer'));
      expect(answerCall).toBeDefined();
      const body = answerCall![1];
      expect(body.selectedOption).toBe(0);
      // User-scoped idempotency key containing currentUserId and timestamp
      expect(body.idempotencyKey).toContain(currentUserId);
      expect(body.idempotencyKey).toContain('ans_');
    });
  });

  test('sending kiss sends user-scoped idempotencyKey and invalidates matches cache', async () => {
    const roundId = 'round-222';
    const request = jest.fn(async (path: string, body?: any) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return {
          roomId,
          title: 'Arena #1',
          state: 'Playing',
          capacity: 6,
          memberCount: 2,
          currentTurnUserId: currentUserId,
          currentRoundId: roundId,
          stateVersion: 8,
          remainingDeadlineMs: 15000,
          deadlineUtc: new Date(Date.now() + 15000).toISOString(),
          deadlineType: 'KissChoice',
          members: [
            { userId: currentUserId, displayName: 'Dato', age: 25, gender: 'man', status: 'Active', isSelf: true },
            { userId: partnerUserId, displayName: 'Nino', age: 23, gender: 'woman', status: 'Active', isSelf: false },
          ],
          currentRound: {
            roundId,
            roundNumber: 2,
            spinnerUserId: currentUserId,
            targetUserId: partnerUserId,
            angleDegrees: 180,
            state: 'KissChoice',
            currentQuestionIndex: 0,
            currentQuestion: {
              id: 'q-101',
              questionText: 'სად გაატარებდი იდეალურ პირველ პაემანს?',
              options: ['მყუდრო კაფეში', 'სასეირნოდ პარკში'],
              category: 'lifestyle',
            },
            callerPendingAnswer: 0,
            revealedSelections: [
              { questionIndex: 0, spinnerOption: 0, targetOption: 0, isSuppressed: false, isMatch: true, fallbackCommentary: 'თანხვედრა!' },
            ],
            deadlineUtc: new Date(Date.now() + 15000).toISOString(),
            deadlineType: 'KissChoice',
            kissRecipientUserId: null,
            kissSkipped: false,
            hasPendingKissFromPartner: false,
            summaryCommentary: 'შესანიშნავი წყვილი ხართ!',
          },
          recentKisses: [],
          recentGifts: [],
        };
      }
      if (path === '/api/game/wallet') {
        return { balance: 100 };
      }
      if (path === '/api/game/store/products') {
        return [];
      }
      if (path === '/api/game/ai-consent') {
        return { aiConsent: true };
      }
      if (path.includes('/messages')) {
        return [];
      }
      if (path.includes('/kiss')) {
        return {
          kissId: 'kiss-999',
          senderUserId: currentUserId,
          recipientUserId: partnerUserId,
          status: 'Matched',
          matchId: 'match-333',
          conversationId: 'conv-444',
        };
      }
      return {};
    });

    const gameApi = createMockGameApi(request);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <GameTable
          roomId={roomId}
          currentUserId={currentUserId}
          gameApi={gameApi}
          onLeave={jest.fn()}
        />
      </QueryClientProvider>
    );

    const sendKissBtn = await waitFor(() => screen.getByTestId('send-kiss-partner-button'));
    fireEvent.press(sendKissBtn);

    await waitFor(() => {
      const kissCall = request.mock.calls.find(call => call[0].includes('/kiss'));
      expect(kissCall).toBeDefined();
      const body = kissCall![1];
      expect(body.recipientUserId).toBe(partnerUserId);
      expect(body.idempotencyKey).toContain(currentUserId);
      expect(body.idempotencyKey).toContain('kiss_');

      // Cache invalidation for matches
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['account', currentUserId, 'matches'] })
      );
    });
  });
  test('navigates to matches when pressing go-to-matches button in celebration modal', async () => {
    const roundId = 'round-333';
    const onLeave = jest.fn();
    const request = jest.fn(async (path: string) => {
      if (path === `/api/game/rooms/${roomId}/snapshot`) {
        return {
          roomId,
          title: 'Arena #1',
          state: 'Playing',
          capacity: 6,
          memberCount: 2,
          currentTurnUserId: currentUserId,
          currentRoundId: roundId,
          stateVersion: 9,
          remainingDeadlineMs: 15000,
          deadlineUtc: new Date(Date.now() + 15000).toISOString(),
          deadlineType: 'KissChoice',
          members: [
            { userId: currentUserId, displayName: 'Dato', age: 25, gender: 'man', status: 'Active', isSelf: true },
            { userId: partnerUserId, displayName: 'Nino', age: 23, gender: 'woman', status: 'Active', isSelf: false },
          ],
          currentRound: {
            roundId,
            roundNumber: 2,
            spinnerUserId: currentUserId,
            targetUserId: partnerUserId,
            angleDegrees: 180,
            state: 'KissChoice',
            currentQuestionIndex: 0,
            currentQuestion: {
              id: 'q-101',
              questionText: 'სად?',
              options: ['A', 'B'],
              category: 'lifestyle',
            },
            callerPendingAnswer: 0,
            revealedSelections: [],
            deadlineUtc: new Date(Date.now() + 15000).toISOString(),
            deadlineType: 'KissChoice',
            kissRecipientUserId: null,
            kissSkipped: false,
            hasPendingKissFromPartner: false,
            summaryCommentary: null,
          },
          recentKisses: [],
          recentGifts: [],
        };
      }
      if (path === '/api/game/wallet') return { balance: 100 };
      if (path === '/api/game/store/products') return [];
      if (path === '/api/game/ai-consent') return { aiConsent: true };
      if (path.includes('/messages')) return [];
      if (path.includes('/kiss')) {
        return {
          kissId: 'kiss-999',
          senderUserId: currentUserId,
          recipientUserId: partnerUserId,
          status: 'Matched',
          matchId: 'match-333',
          conversationId: 'conv-444',
        };
      }
      return {};
    });

    const gameApi = createMockGameApi(request);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GameTable
          roomId={roomId}
          currentUserId={currentUserId}
          gameApi={gameApi}
          onLeave={onLeave}
        />
      </QueryClientProvider>
    );

    const sendKissBtn = await waitFor(() => screen.getByTestId('send-kiss-partner-button'));
    fireEvent.press(sendKissBtn);

    const goToMatchesBtn = await waitFor(() => screen.getByTestId('go-to-matches-button'));
    expect(goToMatchesBtn).toBeTruthy();

    fireEvent.press(goToMatchesBtn);
    expect(onLeave).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches');
  });
});
