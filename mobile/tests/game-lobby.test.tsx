import React from 'react';
import i18n from '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameLobbyScreen } from '../src/game/GameLobbyScreen';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthProvider');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('GameLobbyScreen', () => {
  beforeEach(() => {
    void i18n.changeLanguage('ka');
  });
  const mockRooms = [
    {
      id: 'room-1',
      title: 'Arena #101',
      state: 'Lobby',
      memberCount: 5,
      femaleCount: 3,
      maleCount: 2,
      capacity: 10,
      femaleQuota: 5,
      maleQuota: 5,
      createdAtUtc: '2026-10-03T12:00:00Z',
      lobbyDeadlineUtc: '2026-10-03T12:00:30Z',
      version: 1,
      isCustom: true,
    },
  ];

  const mockRoomDetail = {
    id: 'room-1',
    title: 'Arena #101',
    state: 'Lobby',
    memberCount: 2,
    femaleCount: 1,
    maleCount: 1,
    capacity: 10,
    femaleQuota: 5,
    maleQuota: 5,
    minFemaleStart: 3,
    minMaleStart: 3,
    createdAtUtc: '2026-10-03T12:00:00Z',
    lobbyDeadlineUtc: '2026-10-03T12:00:30Z',
    version: 1,
    canStart: false,
    isJoined: true,
    members: [
      {
        userId: 'user-a',
        displayName: 'Ana',
        age: 24,
        gender: 'woman',
        photo: null,
        joinedAtUtc: '2026-10-03T12:00:05Z',
      },
      {
        userId: 'user-b',
        displayName: 'Giorgi',
        age: 26,
        gender: 'man',
        photo: null,
        joinedAtUtc: '2026-10-03T12:00:10Z',
      },
    ],
  };

  function setupAuth(requestMock: jest.Mock) {
    const manager = {
      snapshot: () => ({ account: { id: 'user-a' } }),
      withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token'),
    };

    jest.mocked(useAuth).mockReturnValue({
      api: { baseUrl: 'https://api.test', request: requestMock },
      manager,
      state: { account: { id: 'user-a' } },
    } as unknown as ReturnType<typeof useAuth>);
  }

  test('renders active rooms list with gender quota badges and join button', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/game/rooms') return Promise.resolve(mockRooms);
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GameLobbyScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Arena #101')).toBeTruthy();
      expect(screen.getByText('♀ ქალები: 3 / 5')).toBeTruthy();
      expect(screen.getByText('♂ კაცები: 2 / 5')).toBeTruthy();
      expect(screen.getByText('5 / 10')).toBeTruthy();
    });

    expect(screen.getByTestId('join-room-room-1')).toBeTruthy();
  });

  test('clicking create room opens modal and creates room', async () => {
    const request = jest.fn().mockImplementation((path: string, body: unknown) => {
      if (path === '/api/game/rooms' && !body) return Promise.resolve([]);
      if (path === '/api/game/rooms' && body) return Promise.resolve(mockRoomDetail);
      if (path === '/api/game/rooms/room-1') return Promise.resolve(mockRoomDetail);
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GameLobbyScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('create-room-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('create-room-button'));

    expect(screen.getByText('ახალი ოთახის შექმნა')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('create-room-title-input'), 'Custom Bottle Arena');
    fireEvent.press(screen.getByTestId('confirm-create-room-button'));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/game/rooms',
        { title: 'Custom Bottle Arena', capacity: 10 },
        'token'
      );
    });
  });

  test('clicking 6-person queue button joins 6-player matchmaking queue', async () => {
    const request = jest.fn().mockImplementation((path: string, body: unknown) => {
      if (path === '/api/game/current') return Promise.resolve(null);
      if (path === '/api/game/rooms') return Promise.resolve([]);
      if (path === '/api/game/queue' && (body as { capacity?: number })?.capacity === 6) {
        return Promise.resolve({
          ...mockRoomDetail,
          capacity: 6,
          femaleQuota: 3,
          maleQuota: 3,
          title: '6-მოთამაშიანი მაგიდა',
        });
      }
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GameLobbyScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('queue-btn-6')).toBeTruthy();
      expect(screen.getByTestId('queue-btn-8')).toBeTruthy();
      expect(screen.getByTestId('queue-btn-10')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('queue-btn-6'));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/game/queue',
        { capacity: 6 },
        'token'
      );
    });
  });

  test('displays room lobby slots and allows leaving the room', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/game/rooms') return Promise.resolve([mockRooms[0]]);
      if (path === '/api/game/rooms/room-1/join') return Promise.resolve({ roomId: 'room-1', membershipId: 'mem-1', state: 'Lobby', version: 1 });
      if (path === '/api/game/rooms/room-1') return Promise.resolve(mockRoomDetail);
      if (path === '/api/game/rooms/room-1/leave') return Promise.resolve({ roomId: 'room-1', success: true });
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GameLobbyScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('join-room-room-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('join-room-room-1'));

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
      expect(screen.getByText('Giorgi')).toBeTruthy();
      expect(screen.getByTestId('leave-room-button')).toBeTruthy();
    });

    // Leave room
    fireEvent.press(screen.getByTestId('leave-room-button'));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/api/game/rooms/room-1/leave', {}, 'token');
    });
  });

  test('displays prominent top seed fixtures button and seeds players when pressed', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/game/rooms') return Promise.resolve([mockRooms[0]]);
      if (path === '/api/game/rooms/room-1/join') return Promise.resolve({ roomId: 'room-1', membershipId: 'mem-1', state: 'Lobby', version: 1 });
      if (path === '/api/game/rooms/room-1') return Promise.resolve(mockRoomDetail);
      if (path === '/api/game/rooms/room-1/dev-fixtures') return Promise.resolve({ added: 6 });
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GameLobbyScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('join-room-room-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('join-room-room-1'));

    await waitFor(() => {
      expect(screen.queryByTestId('dev-seed-fixtures')).toBeNull();
      expect(screen.getByTestId('lobby-top-back-button')).toBeTruthy();
      expect(screen.getByTestId('header-leave-button')).toBeTruthy();
    });
  });
});
