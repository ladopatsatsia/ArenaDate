import '../src/i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { Button, Text } from '../src/components/UI';
import { ProfileApi } from '../src/profile/api';
import ProfileScreen from '../src/profile/ProfileScreen';
import type { AuthApi } from '../src/auth/api';
import type { SessionManager } from '../src/auth/session';

const mockApi = {
  baseUrl: 'https://api.test',
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  request: jest.fn(),
};

jest.mock('../src/auth/api', () => ({
  ...jest.requireActual('../src/auth/api'),
  AuthApi: jest.fn(() => mockApi),
}));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
}));

jest.mock('expo-router', () => ({
  Link: require('react-native').Text,
  useFocusEffect: (cb: () => void) => cb(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const mockProfile = {
  id: userId,
  revision: 1,
  displayName: 'Alex',
  bio: 'A wonderful bio here.',
  gender: 'nonbinary',
  desiredGenders: ['woman', 'man'],
  city: 'Tbilisi',
  interests: ['music'],
  relationshipGoal: 'long_term',
  visible: true,
  age: 26,
  complete: true,
  photos: [],
};

const mockChoices = {
  genders: ['woman', 'man', 'nonbinary'],
  relationshipGoals: ['long_term', 'short_term', 'open_to_either', 'figuring_out'],
  interests: ['music', 'books', 'travel'],
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('ProfileApi correctly calls discoverability pause and account deletion endpoints', async () => {
  const fakeSession = {
    snapshot: () => ({ account: { id: userId }, status: 'signedIn' as const }),
    withAccess: async <T,>(fn: (token: string) => Promise<T>) => fn('valid-token'),
  };
  mockApi.request.mockResolvedValue(undefined);

  const api = new ProfileApi(mockApi as unknown as AuthApi, fakeSession as unknown as SessionManager);

  await api.pauseDiscoverability(true);
  expect(mockApi.request).toHaveBeenCalledWith('/api/account/discoverability-pause', { paused: true }, 'valid-token');

  await api.pauseDiscoverability(false);
  expect(mockApi.request).toHaveBeenCalledWith('/api/account/discoverability-pause', { paused: false }, 'valid-token');

  await api.deleteAccount('secretPassword');
  expect(mockApi.request).toHaveBeenCalledWith('/api/account/delete', { password: 'secretPassword' }, 'valid-token');
});

test('ProfileScreen renders account deletion flow, requires password, and clears session upon deletion', async () => {
  mockApi.login.mockResolvedValue({
    account: { id: userId },
    accessToken: 'access-' + userId,
    refreshToken: 'refresh-' + userId,
    accessExpiresAt: new Date(Date.now() + 300000).toISOString(),
    sessionExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  mockApi.request.mockImplementation(async (path: string) => {
    if (path === '/api/profile') return mockProfile;
    if (path === '/api/profile/choices') return mockChoices;
    if (path === '/api/account/delete') return undefined;
    return undefined;
  });

  function TestApp() {
    const { manager, state } = useAuth();
    return (
      <>
        {state.status === 'signedIn' ? (
          <ProfileScreen />
        ) : (
          <>
            <Text>{state.notice ?? state.status}</Text>
            <Button title="Sign in" onPress={() => void manager.signIn({ email: 'u@test.test', password: 'pw' })} />
          </>
        )}
      </>
    );
  }

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestApp />
      </AuthProvider>
    </QueryClientProvider>
  );

  // Wait for signedOut then simulate sign in
  await waitFor(() => expect(screen.getByText('signedOut')).toBeTruthy());

  // Sign in
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  // Verify profile loaded
  await waitFor(() => expect(screen.getByTestId('delete-account-button')).toBeTruthy());

  // Click delete account button to open confirmation dialog
  fireEvent.press(screen.getByTestId('delete-account-button'));

  // Confirmation dialog elements appear
  await waitFor(() => expect(screen.getByTestId('delete-account-password')).toBeTruthy());
  expect(screen.getByTestId('delete-account-confirm')).toBeTruthy();

  // Enter password and confirm deletion
  fireEvent.changeText(screen.getByTestId('delete-account-password'), 'SuperSecret123!');
  await act(async () => {
    fireEvent.press(screen.getByTestId('delete-account-confirm'));
  });

  // Verification: api.delete was called with the password
  expect(mockApi.request).toHaveBeenCalledWith(
    '/api/account/delete',
    { password: 'SuperSecret123!' },
    expect.any(String)
  );

  // Session state transitioned to signedOut with 'account_deleted' notice
  await waitFor(() => expect(screen.getByText('account_deleted')).toBeTruthy());

  view.unmount();
});

test('ProfileScreen allows Telegram users to delete account without password', async () => {
  const tgUserId = '22222222-2222-4222-8222-222222222222';
  const tgProfile = {
    ...mockProfile,
    id: tgUserId,
    requiresPassword: false,
  };

  mockApi.login.mockResolvedValue({
    account: { id: tgUserId },
    accessToken: 'access-' + tgUserId,
    refreshToken: 'refresh-' + tgUserId,
    accessExpiresAt: new Date(Date.now() + 300000).toISOString(),
    sessionExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  mockApi.request.mockImplementation(async (path: string) => {
    if (path === '/api/profile') return tgProfile;
    if (path === '/api/profile/choices') return mockChoices;
    if (path === '/api/account/delete') return undefined;
    return undefined;
  });

  function TestApp() {
    const { manager, state } = useAuth();
    return (
      <>
        {state.status === 'signedIn' ? (
          <ProfileScreen />
        ) : (
          <>
            <Text>{state.notice ?? state.status}</Text>
            <Button title="Sign in" onPress={() => void manager.signIn({ email: 'tg@test.test', password: 'pw' })} />
          </>
        )}
      </>
    );
  }

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestApp />
      </AuthProvider>
    </QueryClientProvider>
  );

  await waitFor(() => expect(screen.getByText('signedOut')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => expect(screen.getByTestId('delete-account-button')).toBeTruthy());
  fireEvent.press(screen.getByTestId('delete-account-button'));

  // Password input is omitted for Telegram user
  expect(screen.queryByTestId('delete-account-password')).toBeNull();

  // Confirm button is active immediately and deletion succeeds without password
  const confirmBtn = screen.getByTestId('delete-account-confirm');
  expect(confirmBtn).toBeTruthy();

  await act(async () => {
    fireEvent.press(confirmBtn);
  });

  expect(mockApi.request).toHaveBeenCalledWith(
    '/api/account/delete',
    {},
    expect.any(String)
  );

  await waitFor(() => expect(screen.getByText('account_deleted')).toBeTruthy());
  view.unmount();
});
