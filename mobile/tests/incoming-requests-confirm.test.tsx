import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../src/i18n';
import Matches from '../app/(tabs)/matches';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthProvider');
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-decide-1234',
}));

describe('Incoming Requests Acceptance & Matching Flow', () => {
  let queryClient: QueryClient;
  let mockRequest: jest.Mock;

  beforeEach(() => {
    mockPush.mockClear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockRequest = jest.fn().mockImplementation(async (path: string, body?: unknown) => {
      if (path === '/api/matches') {
        return { items: [] };
      }
      if (path === '/api/matches/requests') {
        return [
          {
            userId: 'user-suitor-1',
            displayName: 'ანა',
            age: 23,
            city: 'tbilisi',
            bio: 'გამარჯობა, მიყვარს მოგზაურობა',
            photo: { id: 'photo-1', state: 'pending', position: 0, width: 400, height: 400 },
            gender: 'woman',
            relationshipGoal: 'long_term',
            interests: ['hiking', 'cinema'],
            origin: 'Discovery',
            note: null,
            isBlurred: true,
          },
          {
            userId: 'user-suitor-2',
            displayName: 'გიორგი',
            age: 26,
            city: 'batumi',
            bio: 'Superlike sender',
            photo: { id: 'photo-2', state: 'approved', position: 0, width: 400, height: 400 },
            gender: 'man',
            relationshipGoal: 'casual',
            interests: ['music'],
            origin: 'SuperLike',
            note: 'ძალიან მომეწონე ⭐',
            isBlurred: false,
          },
        ];
      }
      if (path === '/api/premium/status') {
        return { hasPremium: false };
      }
      if (path === '/api/matches/views/viewed-you' || path === '/api/matches/views/you-viewed') {
        return [];
      }
      if (path === '/api/swipes') {
        return {
          requestId: 'mock-uuid-decide-1234',
          targetId: (body as { targetId: string })?.targetId,
          kind: (body as { kind: string })?.kind,
          matchId: 'new-match-5678',
        };
      }
      return {};
    });

    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'test-user-b', email: 'userb@dating.local' } },
      api: { request: mockRequest },
      manager: {
        snapshot: () => ({ account: { id: 'test-user-b' } }),
        withAccess: (fn: (t: string) => unknown) => fn('test-token'),
        clear: jest.fn(),
      },
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('free user without premium does not see confirm/decline buttons on locked request, sees unlock Arena Black button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Matches />
      </QueryClientProvider>
    );

    // Click on "💌 რექუესტები" tab
    await waitFor(() => {
      expect(screen.getByText(/💌.*\(2\)/)).toBeTruthy();
    });

    fireEvent.press(screen.getByText(/💌.*\(2\)/));

    // Confirm and decline buttons must NOT be visible on locked request for free user
    await waitFor(() => {
      expect(screen.queryByTestId('request-locked-confirm-user-suitor-1')).toBeNull();
      expect(screen.queryByTestId('request-locked-decline-user-suitor-1')).toBeNull();
      expect(screen.getByTestId('unlock-premium-btn-user-suitor-1')).toBeTruthy();
    });
  });

  test('SuperLike request is unblurred with clear profile and confirm/decline buttons', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Matches />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/💌.*\(2\)/)).toBeTruthy();
    });

    fireEvent.press(screen.getByText(/💌.*\(2\)/));

    // Suitor 2 has origin 'SuperLike' so it's not locked
    await waitFor(() => {
      expect(screen.getByText(/გიორგი/)).toBeTruthy();
      expect(screen.getByText(/Super Like|სუპერ ლაიქი/)).toBeTruthy();
      expect(screen.getByText(/ძალიან მომეწონე/)).toBeTruthy();
    });
  });
});
