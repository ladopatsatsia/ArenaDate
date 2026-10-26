import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../src/i18n';
import SafetyRoute from '../app/safety';
import NotificationsRoute from '../app/notifications';
import TermsRoute from '../app/terms';
import SafetyTabRoute from '../app/(tabs)/safety';
import NotificationsTabRoute from '../app/(tabs)/notifications';
import TermsTabRoute from '../app/(tabs)/terms';
import { useAuth } from '../src/auth/AuthProvider';
import { usePush } from '../src/notifications/PushProvider';

jest.mock('../src/auth/AuthProvider');
jest.mock('../src/notifications/PushProvider');
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="redirect-element">{href}</Text>;
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('Blocked Accounts, Notifications, and Terms Tab Routes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    void i18n.changeLanguage('ka');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'test-user', email: 'test@arena.dating' } },
      api: { request: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) },
      manager: { snapshot: () => ({ account: { id: 'test-user' } }), clear: jest.fn() },
    } as unknown as ReturnType<typeof useAuth>);

    jest.mocked(usePush).mockReturnValue({
      preferences: { matches: true, messages: true },
      busy: false,
      notice: '',
      save: jest.fn(),
      reload: jest.fn(),
      configuration: null,
    });
  });

  test('Root /safety redirects to /(tabs)/safety', () => {
    render(<SafetyRoute />);
    const redirect = screen.getByTestId('redirect-element');
    expect(redirect.props.children).toBe('/(tabs)/safety');
  });

  test('Root /notifications redirects to /(tabs)/notifications', () => {
    render(<NotificationsRoute />);
    const redirect = screen.getByTestId('redirect-element');
    expect(redirect.props.children).toBe('/(tabs)/notifications');
  });

  test('Root /terms redirects to /(tabs)/terms', () => {
    render(<TermsRoute />);
    const redirect = screen.getByTestId('redirect-element');
    expect(redirect.props.children).toBe('/(tabs)/terms');
  });

  test('(tabs)/safety renders Blocked Accounts screen with Blocked and Conversations tabs, without Terms tab', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SafetyTabRoute />
      </QueryClientProvider>
    );

    // Header says Blocked Accounts
    expect(screen.getByText('დაბლოკილი ანგარიშები')).toBeTruthy();
    expect(screen.getByTestId('safety-tab-blocks')).toBeTruthy();
    expect(screen.getByTestId('safety-tab-prior-conversations')).toBeTruthy();
    // Terms button was removed from safety screen
    expect(screen.queryByText(/წესები & პირობები/)).toBeNull();

    // Switch between the two tabs
    fireEvent.press(screen.getByTestId('safety-tab-prior-conversations'));
    expect(screen.getByTestId('safety-tab-prior-conversations')).toBeTruthy();
  });

  test('(tabs)/notifications renders NotificationSettingsScreen with switches and Telegram card', async () => {
    const apiRequest = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/notifications/telegram') {
        return Promise.resolve({
          isLinked: true,
          isActive: true,
          username: 'arenadater',
          firstName: 'Arena',
          telegramUserId: 12345678,
          botUsername: 'ARENA_ge_bot',
        });
      }
      if (path === '/api/notifications/telegram/test') {
        return Promise.resolve({ success: true, message: 'test_sent' });
      }
      return Promise.resolve({ items: [], nextCursor: null });
    });

    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'test-user', email: 'test@arena.dating' } },
      api: { request: apiRequest },
      manager: { snapshot: () => ({ account: { id: 'test-user' } }), withAccess: (fn: (token: string) => unknown) => fn('test-token'), clear: jest.fn() },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsTabRoute />
      </QueryClientProvider>
    );

    expect(screen.getAllByText(/შეტყობინებები/).length).toBeGreaterThanOrEqual(1);

    // Telegram section appears
    expect(await screen.findByText('Telegram-ის შეტყობინებები')).toBeTruthy();
    expect(await screen.findByText(/🟢 აქტიურია/)).toBeTruthy();
    expect(await screen.findByText('@arenadater')).toBeTruthy();

    // Test button is present and clickable
    const testBtn = screen.getByText('🔔 ტესტ-შეტყობინების გაგზავნა');
    expect(testBtn).toBeTruthy();
    fireEvent.press(testBtn);

    expect(await screen.findByText(/✓ ტესტ-შეტყობინება წარმატებით გაიგზავნა/)).toBeTruthy();
  });

  test('(tabs)/terms renders dedicated TermsScreen with guidelines', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TermsTabRoute />
      </QueryClientProvider>
    );

    expect(screen.getByText('წესები და პირობები')).toBeTruthy();
    expect(screen.getByText(/ასაკობრივი შეზღუდვა \(18\+\)/)).toBeTruthy();
    expect(screen.getByText(/თაღლითობა და ფინანსური უსაფრთხოება/)).toBeTruthy();
  });
});
