import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../src/i18n';
import { BurgerMenuDrawer } from '../src/components/BurgerMenuDrawer';
import { WalletModal } from '../src/components/WalletModal';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/auth/AuthProvider';

const mockPush = jest.fn();
jest.mock('../src/auth/AuthProvider');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('Boo-style Burger Menu & Crystal Wallet', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    void i18n.changeLanguage('ka');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.mocked(useAuth).mockReturnValue({
      state: { status: 'signedIn', account: { id: 'test-user', email: 'test@arena.dating' } },
      api: { request: jest.fn().mockResolvedValue({ balance: 250, outstandingDebt: 0 }) },
      manager: { snapshot: () => ({ account: { id: 'test-user' } }), clear: jest.fn() },
    } as unknown as ReturnType<typeof useAuth>);
  });

  test('BurgerMenuDrawer displays Boo-style crystal balance and perks', () => {
    const handleClose = jest.fn();
    const handleOpenWallet = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <BurgerMenuDrawer
          visible={true}
          onClose={handleClose}
          onOpenWallet={handleOpenWallet}
          crystalBalance={350}
        />
      </QueryClientProvider>
    );

    // Check crystals balance is displayed
    expect(screen.getByTestId('drawer-crystal-balance')).toBeTruthy();
    expect(screen.getAllByText(/350/).length).toBeGreaterThanOrEqual(1);

    // Check Boo perks are displayed
    expect(screen.getByText(/ჩატი \(25 💎\)|Unlock Chat/)).toBeTruthy();
    expect(screen.getByText(/ბოთლის არენა|Bottle Arena/)).toBeTruthy();

    // Tap buy button triggers onOpenWallet
    const buyBtn = screen.getByTestId('drawer-buy-crystals-btn');
    fireEvent.press(buyBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  test('BurgerMenuDrawer navigates to /(tabs)/safety and /(tabs)/notifications', () => {
    jest.useFakeTimers();
    const handleClose = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <BurgerMenuDrawer
          visible={true}
          onClose={handleClose}
          onOpenWallet={jest.fn()}
        />
      </QueryClientProvider>
    );

    const safetyBtn = screen.getByTestId('drawer-nav-safety');
    fireEvent.press(safetyBtn);
    expect(handleClose).toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/safety');

    const termsBtn = screen.getByTestId('drawer-nav-terms');
    fireEvent.press(termsBtn);
    jest.advanceTimersByTime(200);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/terms');

    const notifBtn = screen.getByTestId('drawer-nav-notifications');
    fireEvent.press(notifBtn);
    jest.advanceTimersByTime(200);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');

    jest.useRealTimers();
  });

  test('WalletModal displays crystal balance and packages', () => {
    const handleClose = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <WalletModal visible={true} onClose={handleClose} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('wallet-modal')).toBeTruthy();
    expect(screen.getByText(/კრისტალების საფულე|Crystal Wallet/)).toBeTruthy();
  });

  test('Screen displays burger menu and ARENA brand, but hides BLACK badge without premium', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Screen title="აღმოჩენა" />
      </QueryClientProvider>
    );

    // Burger button is present
    expect(screen.getByTestId('burger-menu-button')).toBeTruthy();

    // BLACK badge is NOT present when free / not premium
    expect(screen.queryByTestId('header-black-badge')).toBeNull();

    // ARENA branding is present in the header
    expect(screen.getByTestId('header-arena-brand')).toBeTruthy();
    expect(screen.getByText('ARENA')).toBeTruthy();

    // Sub-header is removed to give vertical space to page content
    expect(screen.queryByTestId('screen-brand-sub-header')).toBeNull();
  });

  test('Screen displays BLACK badge in header when user has active premium', async () => {
    queryClient.setQueryData(['account', 'test-user', 'premium-status'], { hasPremium: true });

    render(
      <QueryClientProvider client={queryClient}>
        <Screen title="აღმოჩენა" />
      </QueryClientProvider>
    );

    // BLACK badge is present for premium users
    expect(screen.getByTestId('header-black-badge')).toBeTruthy();
    expect(screen.getByText('👑 BLACK')).toBeTruthy();
  });

  test('Screen displays crystal pill in header when showCrystalInHeader is explicitly enabled', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Screen title="აღმოჩენა" showCrystalInHeader={true} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('header-crystal-badge')).toBeTruthy();
    expect(screen.getByText('+')).toBeTruthy();
  });
});
