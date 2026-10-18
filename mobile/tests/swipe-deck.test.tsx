import 'react-native-gesture-handler/jestSetup';
import i18n from '../src/i18n';
import { AppState } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SwipeDeck } from '../src/matching/SwipeDeck';
import { useAuth } from '../src/auth/AuthProvider';
import type { Card } from '../src/discovery/api';

const mockStore = new Map<string, string>();
jest.mock('../src/auth/AuthProvider');
jest.mock('../src/safety/SafetyActions', () => ({ SafetyActions: () => null }));
jest.mock('../src/profile/PrivatePhoto', () => ({ PrivatePhoto: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1, getItemAsync: async (k: string) => mockStore.get(k) ?? null, setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

test('ambiguous swipe blocks the opposite action and reconciles a persisted receipt without a second write', async () => {
  AppState.currentState = 'active';
  mockStore.clear();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const card: Card = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', displayName: 'Real candidate', age: 30, bio: 'A real profile', city: 'Tbilisi', gender: 'nonbinary', relationshipGoal: 'long_term', interests: ['music'], photos: [], distanceBucket: null };
  const request = jest.fn(async (path: string) => {
    if (path === '/api/swipes') throw new Error('lost HTTP response');
    if (path.startsWith('/api/swipes/')) return { requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', targetId: card.id, kind: 'like', matchId: null };
    if (path === '/api/game/wallet') return { balance: 100, freeSpinsRemaining: 3 };
    return [];
  });
  const manager = { snapshot: () => ({ account: { id: 'A' } }), withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token') };
  jest.mocked(useAuth).mockReturnValue({ api: { baseUrl: 'https://api.test', request }, manager, state: { account: { id: 'A' } } } as unknown as ReturnType<typeof useAuth>);
  const refresh = jest.fn(async () => {});
  const view = render(
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <SwipeDeck cards={[card]} refresh={refresh} />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Like' }).props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByRole('button', { name: 'Like' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pass' }).props.accessibilityState.disabled).toBe(true));
  fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('swipe_reconcile') }).props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByRole('button', { name: i18n.t('swipe_reconcile') }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(request.mock.calls.filter(([path]) => path === '/api/swipes')).toHaveLength(1);
  expect(request).toHaveBeenCalledWith('/api/swipes/cccccccc-cccc-4ccc-8ccc-cccccccccccc', undefined, 'token');
  expect(screen.queryByText('Real candidate, 30')).toBeNull();
  expect(JSON.parse(mockStore.get('dating.swipe.A')!).data.pending).toBeNull();
  view.unmount();
}, 15000);

test('renders correct female gender icon badge for woman and triggers super like modal', async () => {
  AppState.currentState = 'active';
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const womanCard: Card = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', displayName: 'ნინო', age: 24, bio: 'სალამი', city: 'Tbilisi', gender: 'woman', relationshipGoal: 'long_term', interests: ['art'], photos: [], distanceBucket: null };
  const request = jest.fn(async (path: string) => {
    if (path === '/api/game/wallet') return { balance: 50, freeSpinsRemaining: 1 };
    return [];
  });
  const manager = { snapshot: () => ({ account: { id: 'A' } }), withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token') };
  jest.mocked(useAuth).mockReturnValue({ api: { baseUrl: 'https://api.test', request }, manager, state: { account: { id: 'A' } } } as unknown as ReturnType<typeof useAuth>);
  const refresh = jest.fn(async () => {});
  const view = render(
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <SwipeDeck cards={[womanCard]} refresh={refresh} />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );

  // Female symbol ♀ must be rendered
  await waitFor(() => expect(screen.getByTestId('gender-badge-woman')).toBeTruthy());
  expect(screen.getByText('♀')).toBeTruthy();

  // Super Like button must exist
  const superLikeBtn = screen.getByTestId('swipe-superlike');
  expect(superLikeBtn).toBeTruthy();
  fireEvent.press(superLikeBtn);

  // Super Like modal must appear with target user name, balance, and message input
  await waitFor(() => expect(screen.getByTestId('superlike-note-input')).toBeTruthy());
  expect(screen.getAllByText('ნინო, 24').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText(/50 💎/)).toBeTruthy();

  view.unmount();
});

