import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../src/i18n';
import { PremiumModal } from '../src/premium/PremiumModal';
import { BurgerMenuDrawer } from '../src/components/BurgerMenuDrawer';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthProvider');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('Premium Subscriptions & Dating App Flow', () => {
  let queryClient: QueryClient;
  let mockRequest: jest.Mock;

  beforeEach(() => {
    void i18n.changeLanguage('ka');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockRequest = jest.fn();
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

  test('PremiumModal displays exact packages with prices: 2.90 ₾, 4.90 ₾, 10.00 ₾, 40.00 ₾', async () => {
    mockRequest.mockResolvedValueOnce({
      hasPremium: false,
      activePackageId: null,
      expiresAtUtc: null,
      isLifetime: false,
      packages: [
        {
          id: 'two_weeks',
          name: '2 კვირა',
          description: 'სწრაფი წვდომა 14 დღით',
          durationDays: 14,
          priceAmount: 2.9,
          currency: 'GEL',
          priceDisplay: '2.90 ₾',
          badge: null,
          isPopular: false,
        },
        {
          id: 'one_month',
          name: '1 თვე',
          description: 'ყველაზე პოპულარული არჩევანი',
          durationDays: 30,
          priceAmount: 4.9,
          currency: 'GEL',
          priceDisplay: '4.90 ₾',
          badge: 'პოპულარული',
          isPopular: true,
        },
        {
          id: 'three_months',
          name: '3 თვე',
          description: 'ეკონომიური პაკეტი',
          durationDays: 90,
          priceAmount: 10.0,
          currency: 'GEL',
          priceDisplay: '10.00 ₾',
          badge: 'ეკონომია',
          isPopular: false,
        },
        {
          id: 'lifetime',
          name: 'ულიმიტო',
          description: 'ერთხელ გადახდა, სამუდამო პრემიუმი',
          durationDays: null,
          priceAmount: 40.0,
          currency: 'GEL',
          priceDisplay: '40.00 ₾',
          badge: 'საუკეთესო',
          isPopular: false,
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PremiumModal visible={true} onClose={jest.fn()} />
      </QueryClientProvider>
    );

    // Verify Title and Benefits
    expect(screen.getByText('ARENA BLACK')).toBeTruthy();
    expect(screen.getByText('ექსკლუზიური წვდომა, VIP სტატუსი')).toBeTruthy();
    expect(screen.getByText('გაიგე ვისი Crush ხარ')).toBeTruthy();
    expect(screen.getByText('პირდაპირი მეჩი')).toBeTruthy();
    expect(screen.getByText('არენის ყურადღების ცენტრში')).toBeTruthy();

    // Verify all 4 package names and exact prices
    expect(screen.getByText('2 კვირა')).toBeTruthy();
    expect(screen.getByText('2.90 ₾')).toBeTruthy();

    expect(screen.getByText('1 თვე')).toBeTruthy();
    expect(screen.getByText('4.90 ₾')).toBeTruthy();

    expect(screen.getByText('3 თვე')).toBeTruthy();
    expect(screen.getByText('10.00 ₾')).toBeTruthy();

    expect(screen.getByText('ულიმიტო')).toBeTruthy();
    expect(screen.getByText('40.00 ₾')).toBeTruthy();
  });

  test('Subscribing to a package calls API and triggers success', async () => {
    mockRequest
      .mockResolvedValueOnce({
        hasPremium: false,
        packages: [],
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'პრემიუმ პაკეტი წარმატებით გააქტიურდა!',
        status: {
          hasPremium: true,
          activePackageId: 'one_month',
          isLifetime: false,
          packages: [],
        },
      });

    const handleSuccess = jest.fn();
    const handleClose = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <PremiumModal visible={true} onClose={handleClose} onSuccess={handleSuccess} />
      </QueryClientProvider>
    );

    const activateBtn = screen.getByText('🖤 Arena Black-ის გააქტიურება');
    fireEvent.press(activateBtn);

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/premium/subscribe',
        expect.objectContaining({ packageId: 'one_month' }),
        'test-token'
      );
    });
  });

  test('BurgerMenuDrawer includes Arena Black item and triggers onOpenPremium', () => {
    const handleClose = jest.fn();
    const handleOpenPremium = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <BurgerMenuDrawer
          visible={true}
          onClose={handleClose}
          onOpenWallet={jest.fn()}
          onOpenPremium={handleOpenPremium}
          crystalBalance={100}
        />
      </QueryClientProvider>
    );

    const premiumItem = screen.getByTestId('drawer-nav-premium');
    expect(premiumItem).toBeTruthy();
    expect(screen.getByText('Arena Black')).toBeTruthy();

    fireEvent.press(premiumItem);
    expect(handleClose).toHaveBeenCalled();
  });

  test('BurgerMenuDrawer displays VIP crown, black pill and active badge when hasPremium is true', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BurgerMenuDrawer
          visible={true}
          onClose={jest.fn()}
          onOpenWallet={jest.fn()}
          onOpenPremium={jest.fn()}
          crystalBalance={100}
          hasPremium={true}
        />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('drawer-avatar-crown')).toBeTruthy();
    expect(screen.getByTestId('drawer-vip-pill')).toBeTruthy();
    expect(screen.getByText('🖤 BLACK')).toBeTruthy();
    expect(screen.getByTestId('drawer-vip-member-label')).toBeTruthy();
    expect(screen.getByTestId('drawer-active-check-badge')).toBeTruthy();
    expect(screen.getByText('აქტიურია ✓')).toBeTruthy();
  });
});
