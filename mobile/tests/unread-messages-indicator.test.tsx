import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../src/i18n';
import TabLayout from '../app/(tabs)/_layout';
import Matches from '../app/(tabs)/matches';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthProvider');
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Tabs: Object.assign(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
    {
      Screen: ({ options }: { options?: { tabBarIcon?: (props: { focused: boolean }) => React.ReactNode } }) => {
        return options?.tabBarIcon ? <>{options.tabBarIcon({ focused: false })}</> : null;
      },
    }
  ),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1234',
}));

describe('Unread Messages Red Indicator Badges', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockPush.mockClear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('TabLayout shows red unread badge on matches tab when there are unread messages', async () => {
    const mockRequest = jest.fn().mockImplementation(async (path: string) => {
      if (path.includes('/api/matches')) {
        return {
          items: [
            {
              id: 'match-1',
              displayName: 'Nino',
              age: 24,
              city: 'tbilisi',
              conversationId: 'conv-1',
              lastMessage: 'Gamarjoba!',
              unreadCount: 3,
              hasChatEntitlement: true,
              origin: 'Discovery',
            },
          ],
          nextCursor: null,
        };
      }
      return {};
    });

    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'user-123' } },
      api: { baseUrl: 'https://api.test', request: mockRequest },
      manager: {
        snapshot: () => ({ account: { id: 'user-123' } }),
        withAccess: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <QueryClientProvider client={queryClient}>
        <TabLayout />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-matches-unread-badge')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });
  });

  test('Matches screen displays red unread dot on კავშირები section tile and on match card', async () => {
    let currentUnread = 2;
    const mockRequest = jest.fn().mockImplementation(async (path: string) => {
      if (path.includes('/api/matches')) {
        return {
          items: [
            {
              id: 'match-unread',
              displayName: 'Salome',
              age: 25,
              city: 'batumi',
              conversationId: 'conv-unread-1',
              lastMessage: 'Rogor xar?',
              unreadCount: currentUnread,
              hasChatEntitlement: true,
              origin: 'Discovery',
            },
          ],
          nextCursor: null,
        };
      }
      if (path.includes('/api/requests')) return [];
      if (path.includes('/api/viewed-you')) return [];
      if (path.includes('/api/you-viewed')) return [];
      if (path.includes('/api/premium/status')) return { hasPremium: false };
      if (path.includes('/api/game/wallet')) return { balance: 100 };
      return {};
    });

    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'user-123' } },
      api: { baseUrl: 'https://api.test', request: mockRequest },
      manager: {
        snapshot: () => ({ account: { id: 'user-123' } }),
        withAccess: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <QueryClientProvider client={queryClient}>
        <Matches />
      </QueryClientProvider>
    );

    // Verify unread dot on "კავშირები" tile and match card
    await waitFor(() => {
      expect(screen.getByTestId('matches-section-unread-dot')).toBeTruthy();
      expect(screen.getAllByText('2')).toHaveLength(2);
    });

    // Verify unread badge and avatar red dot on the match item card
    expect(screen.getByTestId('unread-badge-match-unread')).toBeTruthy();
    expect(screen.getByTestId('avatar-unread-dot-match-unread')).toBeTruthy();

    // Opening chat marks conversation read
    currentUnread = 0;
    fireEvent.press(screen.getByTestId('open-chat-match-unread'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'conv-unread-1', name: 'Salome' },
    });

    // Verify red dot disappears optimistically
    await waitFor(() => {
      expect(screen.queryByTestId('matches-section-unread-dot')).toBeNull();
      expect(screen.queryByTestId('unread-badge-match-unread')).toBeNull();
      expect(screen.queryByTestId('avatar-unread-dot-match-unread')).toBeNull();
    });
  });
});
