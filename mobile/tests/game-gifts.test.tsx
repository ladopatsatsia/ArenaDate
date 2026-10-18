import React from 'react';
import i18n from '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameTable } from '../src/game/GameTable';
import { GameApi } from '../src/game/GameApi';
import { GiftsModal } from '../src/components/GiftsModal';
import type { AuthApi } from '../src/auth/api';
import type { SessionManager } from '../src/auth/session';

// Mock AuthProvider for GiftsModal
const mockGetUserGifts = jest.fn();
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

describe('Arena Gifts and Statistics', () => {
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
        userId: 'user-target',
        displayName: 'Mariam',
        age: 24,
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
  };

  const mockCatalog = [
    { id: 'rose', name: 'ვარდი', icon: '🌹', price: 1 },
    { id: 'cocktail', name: 'კოქტეილი', icon: '🍹', price: 30 },
    { id: 'crown', name: 'სამეფო გვირგვინი', icon: '👑', price: 500 },
  ];

  const mockMemberProfileUnlocked = {
    userId: 'user-target',
    displayName: 'Mariam',
    age: 24,
    city: 'Tbilisi',
    bio: 'Loves music and traveling',
    gender: 'woman',
    relationshipGoal: 'long_term',
    interests: ['music', 'travel'],
    photos: [],
    isFullAccess: true,
    unlockPrice: 25,
    kissesReceivedCount: 7,
    giftsReceivedCount: 4,
  };

  let mockGameApi: Partial<GameApi>;

  beforeEach(() => {
    mockGameApi = {
      getBaseUrl: jest.fn().mockReturnValue('https://api.test'),
      getToken: jest.fn().mockResolvedValue('token'),
      getSnapshot: jest.fn().mockResolvedValue(mockSnapshot),
      getWallet: jest.fn().mockResolvedValue({
        balance: 100,
        outstandingDebt: 0,
        recentTransactions: [],
      }),
      getRoomMessages: jest.fn().mockResolvedValue([]),
      getGiftCatalog: jest.fn().mockResolvedValue(mockCatalog),
      sendGift: jest.fn().mockResolvedValue({
        success: true,
        giftRecordId: 'gift-rec-1',
        giftId: 'rose',
        giftName: 'ვარდი',
        giftIcon: '🌹',
        crystalCost: 1,
        balance: 99,
        recipientDisplayName: 'Mariam',
        message: 'Gift sent successfully',
      }),
      getGameProfile: jest.fn().mockResolvedValue(mockMemberProfileUnlocked),
      getUserGifts: mockGetUserGifts.mockResolvedValue({
        receivedGifts: [
          {
            id: 'g-1',
            otherUserId: 'user-other',
            otherDisplayName: 'Giorgi',
            otherPhoto: null,
            giftId: 'rose',
            giftName: 'ვარდი',
            giftIcon: '🌹',
            crystalCost: 1,
            createdAtUtc: '2026-10-07T12:00:00Z',
          },
        ],
        sentGifts: [
          {
            id: 'g-2',
            otherUserId: 'user-target',
            otherDisplayName: 'Mariam',
            otherPhoto: null,
            giftId: 'cocktail',
            giftName: 'კოქტეილი',
            giftIcon: '🍹',
            crystalCost: 30,
            createdAtUtc: '2026-10-07T13:00:00Z',
          },
        ],
        totalReceivedCount: 1,
        totalSentCount: 1,
        totalReceivedCrystalsValue: 1,
      }),
    };
  });

  it('renders GiftsModal with received and sent gifts', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={qc}>
        <GiftsModal visible={true} onClose={jest.fn()} gameApi={mockGameApi as GameApi} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Giorgi')).toBeTruthy();
      expect(screen.getByText('🌹')).toBeTruthy();
    });

    // Switch to sent tab
    fireEvent.press(screen.getByTestId('gifts-tab-sent'));

    await waitFor(() => {
      expect(screen.getByText('Mariam')).toBeTruthy();
      expect(screen.getByText('🍹')).toBeTruthy();
    });
  });

  it('displays Arena stats report and gift sending on GameTable member profile', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={qc}>
        <GameTable
          roomId={roomId}
          gameApi={mockGameApi as GameApi}
          currentUserId={currentUserId}
          onLeave={jest.fn()}
        />
      </QueryClientProvider>
    );

    // Click on target member seat
    const seat = await screen.findByTestId('seat-user-target');
    fireEvent.press(seat);

    // Profile modal opens, verify Arena stats report
    await waitFor(() => {
      expect(screen.getByTestId('arena-unlocked-stats')).toBeTruthy();
      expect(screen.getByText('მიღებული კოცნა')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
      expect(screen.getByText('მიღებული საჩუქარი')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
    });

    // Verify gift sending section is displayed with catalog items
    expect(screen.getByTestId('member-gift-section')).toBeTruthy();
    expect(screen.getByTestId('send-gift-rose')).toBeTruthy();
    expect(screen.getByTestId('send-gift-cocktail')).toBeTruthy();

    // Send Rose gift
    fireEvent.press(screen.getByTestId('send-gift-rose'));

    await waitFor(() => {
      expect(mockGameApi.sendGift).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'user-target',
          giftId: 'rose',
          roomId,
        })
      );
    });
  });

  it('triggers flying gift animation and table announcement when gift is sent', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={qc}>
        <GameTable
          roomId={roomId}
          gameApi={mockGameApi as GameApi}
          currentUserId={currentUserId}
          onLeave={jest.fn()}
        />
      </QueryClientProvider>
    );

    const seat = await screen.findByTestId('seat-user-target');
    fireEvent.press(seat);

    await waitFor(() => {
      expect(screen.getByTestId('send-gift-rose')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('send-gift-rose'));

    await waitFor(() => {
      expect(mockGameApi.sendGift).toHaveBeenCalled();
    });

    // Verify flying gift or table banner / celebration badge appears
    await waitFor(() => {
      const banner = screen.queryByTestId('table-gift-banner');
      const flyingGift = screen.queryByTestId('flying-gift-gift-rec-1');
      const celebration = screen.queryByTestId('seat-celebration-user-target');
      expect(banner || flyingGift || celebration).toBeTruthy();
    });
  });
});
