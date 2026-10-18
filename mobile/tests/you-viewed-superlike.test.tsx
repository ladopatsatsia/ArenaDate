import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../src/i18n';
import MatchesScreen from '../app/(tabs)/matches';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthProvider');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(() => {
      cb();
    }, [cb]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('MatchesScreen - You Viewed Super Like Only', () => {
  let queryClient: QueryClient;
  let mockRequest: jest.Mock;

  const mockViewedUsers = [
    {
      userId: 'user-cand-1',
      displayName: 'Natia',
      age: 23,
      city: 'tbilisi',
      bio: 'Loves art & music',
      gender: 'woman',
      relationshipGoal: 'dating',
      interests: ['art', 'music'],
      photo: null,
      photos: [],
      viewedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    void i18n.changeLanguage('ka');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockRequest = jest.fn();

    // Setup mock responses for MatchApi, PremiumApi, GameApi
    mockRequest.mockImplementation((path: string) => {
      if (path === '/api/premium/status') {
        return Promise.resolve({ hasPremium: true, activePackageId: 'gold' });
      }
      if (path === '/api/matches/views/viewed-you') {
        return Promise.resolve([]);
      }
      if (path === '/api/matches/views/you-viewed') {
        return Promise.resolve(mockViewedUsers);
      }
      if (path.startsWith('/api/matches/requests')) {
        return Promise.resolve([]);
      }
      if (path.startsWith('/api/matches')) {
        return Promise.resolve({ items: [], nextCursor: null });
      }
      if (path === '/api/game/wallet') {
        return Promise.resolve({ balance: 50, outstandingDebt: 0, recentTransactions: [] });
      }
      if (path === '/api/swipes/superlike') {
        return Promise.resolve({ success: true, matched: false });
      }
      return Promise.resolve({});
    });

    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'test-user', email: 'test@dating.local' } },
      api: { request: mockRequest },
      manager: {
        snapshot: () => ({ account: { id: 'test-user' } }),
        withAccess: (fn: (token: string) => unknown) => fn('test-token'),
        clear: jest.fn(),
      },
    } as unknown as ReturnType<typeof useAuth>);
  });

  test('You Viewed section shows Super Like button and NO Like or Pass buttons', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MatchesScreen />
      </QueryClientProvider>
    );

    // Switch to You Viewed ("შენ ნახე") tab
    const youViewedTab = await screen.findByTestId('tab-you-viewed');
    fireEvent.press(youViewedTab);

    // Candidate should be rendered
    await waitFor(() => {
      expect(screen.getByText('Natia, 23')).toBeTruthy();
    });

    // Verify "⭐ სუპერ ლაიქი (მესიჯით)" button exists
    const superLikeBtn = screen.getByTestId('card-superlike-user-cand-1');
    expect(superLikeBtn).toBeTruthy();

    // Verify NO Like, Pass, or text caption is on the card (icon only)
    expect(screen.queryByText(/მომწონს/i)).toBeNull();
    expect(screen.queryByText(/გამოტოვება/i)).toBeNull();
    expect(screen.queryByText(/სუპერ ლაიქი \(მესიჯით\)/i)).toBeNull();
  });

  test('Clicking Super Like opens SuperLikeModal and sends super like with message', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MatchesScreen />
      </QueryClientProvider>
    );

    // Switch to You Viewed tab
    const youViewedTab = await screen.findByTestId('tab-you-viewed');
    fireEvent.press(youViewedTab);

    // Wait for card to appear
    const superLikeBtn = await screen.findByTestId('card-superlike-user-cand-1');
    fireEvent.press(superLikeBtn);

    // SuperLikeModal should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('super-like-modal')).toBeTruthy();
    });

    // Enter personal message
    const noteInput = screen.getByTestId('superlike-note-input');
    fireEvent.changeText(noteInput, 'გამარჯობა, ძალიან მომეწონა შენი პროფილი!');

    // Press Send Super Like confirm button
    const confirmBtn = screen.getByTestId('confirm-superlike-btn');
    fireEvent.press(confirmBtn);

    // Verify API called with note
    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/swipes/superlike',
        expect.objectContaining({
          targetId: 'user-cand-1',
          note: 'გამარჯობა, ძალიან მომეწონა შენი პროფილი!',
        }),
        'test-token'
      );
    });
  });

  test('CandidateProfileModal in You Viewed mode shows ONLY Super Like action bar, no like or pass', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MatchesScreen />
      </QueryClientProvider>
    );

    // Switch to You Viewed tab
    const youViewedTab = await screen.findByTestId('tab-you-viewed');
    fireEvent.press(youViewedTab);

    // Click candidate profile to open CandidateProfileModal
    const candidateName = await screen.findByText('Natia, 23');
    fireEvent.press(candidateName);

    // Verify modal action bar has only Super Like button
    await waitFor(() => {
      expect(screen.getByTestId('you-viewed-modal-superlike-btn')).toBeTruthy();
    });

    // Ensure neither Like nor Pass exists in modal
    expect(screen.queryByText(/❤️ მომწონს/i)).toBeNull();
    expect(screen.queryByText(/✕ გამოტოვება/i)).toBeNull();
  });

  test('Viewed You (შენ გნახა) section shows icon-only Super Like and NO Like or Pass buttons', async () => {
    // Return candidates for viewed-you
    mockRequest.mockImplementation((path: string) => {
      if (path === '/api/premium/status') {
        return Promise.resolve({ hasPremium: true, activePackageId: 'gold' });
      }
      if (path === '/api/matches/views/viewed-you') {
        return Promise.resolve(mockViewedUsers);
      }
      if (path === '/api/matches/views/you-viewed') {
        return Promise.resolve([]);
      }
      if (path.startsWith('/api/matches/requests')) {
        return Promise.resolve([]);
      }
      if (path.startsWith('/api/matches')) {
        return Promise.resolve({ items: [], nextCursor: null });
      }
      if (path === '/api/game/wallet') {
        return Promise.resolve({ balance: 50, outstandingDebt: 0, recentTransactions: [] });
      }
      if (path === '/api/swipes/superlike') {
        return Promise.resolve({ success: true, matched: false });
      }
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MatchesScreen />
      </QueryClientProvider>
    );

    // Switch to Viewed You ("შენ გნახა") tab
    const viewedYouTab = await screen.findByTestId('tab-viewed-you');
    fireEvent.press(viewedYouTab);

    // Candidate should be rendered
    await waitFor(() => {
      expect(screen.getByText('Natia, 23')).toBeTruthy();
    });

    // Verify star super like button exists
    const superLikeBtn = screen.getByTestId('card-superlike-user-cand-1');
    expect(superLikeBtn).toBeTruthy();

    // Verify NO Like, Pass, or text caption is on the card
    expect(screen.queryByText(/მომწონს/i)).toBeNull();
    expect(screen.queryByText(/გამოტოვება/i)).toBeNull();
    expect(screen.queryByText(/სუპერ ლაიქი \(მესიჯით\)/i)).toBeNull();

    // Click candidate profile to open CandidateProfileModal
    const candidateName = screen.getByText('Natia, 23');
    fireEvent.press(candidateName);

    // Verify modal action bar has only Super Like button
    await waitFor(() => {
      expect(screen.getByTestId('viewed-you-modal-superlike-btn')).toBeTruthy();
    });

    // Ensure neither Like nor Pass exists in modal
    expect(screen.queryByText(/❤️ მომწონს/i)).toBeNull();
    expect(screen.queryByText(/✕ გამოტოვება/i)).toBeNull();
  });
});
