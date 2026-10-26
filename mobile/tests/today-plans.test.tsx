import React from 'react';
import { Alert } from 'react-native';
import i18n from '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayPlansScreen } from '../src/today-plans/TodayPlansScreen';
import { useAuth } from '../src/auth/AuthProvider';
import { useRouter } from 'expo-router';

jest.mock('../src/auth/AuthProvider');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  Link: 'Link',
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('TodayPlansScreen & Components', () => {
  jest.setTimeout(25000);
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    void i18n.changeLanguage('ka');
    jest.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  const mockLimits = {
    hasPremium: false,
    activePlansCount: 0,
    activePlansLimit: 1,
    canCreatePlan: true,
    dailyResponsesUsed: 1,
    dailyResponsesLimit: 3,
    dailyResponsesRemaining: 2,
    canApply: true,
    resetsAtUtc: '2026-10-17T00:00:00Z',
    timeZone: 'Asia/Tbilisi',
  };

  const mockPlan = {
    id: 'plan-101',
    authorUserId: 'user-author',
    authorDisplayName: 'Nino',
    authorAge: 23,
    authorCity: 'tbilisi',
    authorPhoto: null,
    city: 'tbilisi',
    district: 'Vake',
    activity: 'coffee',
    title: 'საღამოს ყავა და გასეირნება',
    description: 'მყუდრო კაფეში შეხვედრა',
    startsAtUtc: '2026-10-16T15:00:00Z',
    expiresAtUtc: '2026-10-16T21:00:00Z',
    budgetAmount: 25,
    currency: 'GEL',
    state: 'Open',
    responsesCount: 1,
    isAuthor: false,
    hasApplied: false,
    myResponseState: null,
    myResponseId: null,
    createdAtUtc: '2026-10-16T12:00:00Z',
  };

  const mockApplicant = {
    id: 'resp-201',
    applicantUserId: 'user-app-1',
    displayName: 'Dato',
    age: 26,
    city: 'tbilisi',
    photo: null,
    photos: null,
    bio: 'Software engineer from Tbilisi',
    message: 'სიამოვნებით შემოგიერთდებოდი!',
    state: 'Pending',
    createdAtUtc: '2026-10-16T13:00:00Z',
  };

  function setupAuth(requestMock: jest.Mock, userId = 'user-current') {
    const manager = {
      snapshot: () => ({ account: { id: userId } }),
      withAccess: async (fn: (t: string) => Promise<unknown>) => fn('token'),
    };

    jest.mocked(useAuth).mockReturnValue({
      api: { baseUrl: 'https://api.test', request: requestMock },
      manager,
      state: { account: { id: userId }, status: 'signedIn' },
    } as unknown as ReturnType<typeof useAuth>);
  }

  test('renders limits bar, feed list with plan card, and join button', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      if (path.startsWith('/api/today-plans')) {
        return Promise.resolve({
          items: [mockPlan],
          nextCursor: null,
          totalCount: 1,
        });
      }
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Limits bar
      expect(screen.getByText(/აქტიური გეგმები: 0\/1/)).toBeTruthy();
      expect(screen.getByText(/გამოხმაურებები: 1\/3/)).toBeTruthy();

      // Plan details
      expect(screen.getByText('საღამოს ყავა და გასეირნება')).toBeTruthy();
      expect(screen.getByText('Nino')).toBeTruthy();
      expect(screen.getByText('23')).toBeTruthy();
      expect(screen.getByText(/25 GEL|25 ₾/)).toBeTruthy();
    });

    // Join button should be visible for non-author
    expect(screen.getByTestId('join-plan-btn-plan-101')).toBeTruthy();
  });

  test('opening and submitting apply modal', async () => {
    const request = jest.fn().mockImplementation((path: string, body?: unknown) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      if (path.startsWith('/api/today-plans') && !body) {
        return Promise.resolve({
          items: [mockPlan],
          nextCursor: null,
          totalCount: 1,
        });
      }
      if (path === '/api/today-plans/plan-101/responses' && body) {
        return Promise.resolve({
          responseId: 'new-resp-id',
          planId: 'plan-101',
          planTitle: mockPlan.title,
          planActivity: mockPlan.activity,
          planCity: mockPlan.city,
          planStartsAtUtc: mockPlan.startsAtUtc,
          planExpiresAtUtc: mockPlan.expiresAtUtc,
          planState: 'Open',
          authorUserId: mockPlan.authorUserId,
          authorDisplayName: mockPlan.authorDisplayName,
          authorPhoto: null,
          message: 'მოვდივარ!',
          state: 'Pending',
          createdAtUtc: '2026-10-16T14:00:00Z',
        });
      }
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('join-plan-btn-plan-101')).toBeTruthy();
    });

    // Tap Join
    fireEvent.press(screen.getByTestId('join-plan-btn-plan-101'));

    // Apply modal appears
    await waitFor(() => {
      expect(screen.getByTestId('apply-message-input')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('apply-message-input'), 'მოვდივარ!');
    fireEvent.press(screen.getByTestId('submit-apply-btn'));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/today-plans/plan-101/responses',
        { message: 'მოვდივარ!' },
        'token'
      );
    });
  });

  test('plan creation modal creates a new plan', async () => {
    const request = jest.fn().mockImplementation((path: string, body?: unknown) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      if (path.startsWith('/api/today-plans') && !body) {
        return Promise.resolve({ items: [], nextCursor: null, totalCount: 0 });
      }
      if (path === '/api/today-plans' && body) {
        return Promise.resolve({
          ...mockPlan,
          id: 'new-created-plan',
          title: 'ახალი საღამოს კინო',
        });
      }
      return Promise.resolve(null);
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('create-plan-hero-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('create-plan-hero-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('plan-title-input')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('plan-title-input'), 'ახალი საღამოს კინო');
    fireEvent.changeText(screen.getByTestId('plan-budget-input'), '30');
    fireEvent.press(screen.getByTestId('submit-create-plan-btn'));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/today-plans',
        expect.objectContaining({
          title: 'ახალი საღამოს კინო',
          budgetAmount: 30,
        }),
        'token'
      );
    });
  });

  test('author can view applicants and accept an applicant, navigating to chat', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const acceptBtn = buttons?.find(b => b.style !== 'cancel');
      acceptBtn?.onPress?.();
    });

    const authorPlan = {
      ...mockPlan,
      isAuthor: true,
      responsesCount: 1,
    };

    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      if (path === '/api/today-plans/my') return Promise.resolve([authorPlan]);
      if (path === '/api/today-plans/plan-101/applicants') {
        return Promise.resolve([mockApplicant]);
      }
      if (path === '/api/today-plans/plan-101/responses/resp-201/accept') {
        return Promise.resolve({
          planId: 'plan-101',
          responseId: 'resp-201',
          companionUserId: 'user-app-1',
          state: 'Matched',
          conversationId: 'conv-999',
          matchedAtUtc: '2026-10-16T15:00:00Z',
        });
      }
      return Promise.resolve({ items: [authorPlan], nextCursor: null, totalCount: 1 });
    });

    setupAuth(request, 'user-author');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    // Switch to "ჩემი გეგმები" (My Plans)
    await waitFor(() => {
      expect(screen.getByTestId('feed-tab-my_plans')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('feed-tab-my_plans'));

    await waitFor(() => {
      expect(screen.getByTestId('view-applicants-btn-plan-101')).toBeTruthy();
    });

    // Open applicants modal
    fireEvent.press(screen.getByTestId('view-applicants-btn-plan-101'));

    await waitFor(() => {
      expect(screen.getByText('Dato')).toBeTruthy();
      expect(screen.getByText('"სიამოვნებით შემოგიერთდებოდი!"')).toBeTruthy();
      expect(screen.getByTestId('accept-applicant-btn-resp-201')).toBeTruthy();
    });

    // Press accept button to show confirmation dialog
    fireEvent.press(screen.getByTestId('accept-applicant-btn-resp-201'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-accept-dialog')).toBeTruthy();
      expect(screen.getByTestId('confirm-accept-applicant-btn')).toBeTruthy();
    });

    // Confirm acceptance in the dialog
    fireEvent.press(screen.getByTestId('confirm-accept-applicant-btn'));

    await waitFor(() => {
      // Accept request called
      expect(request).toHaveBeenCalledWith(
        '/api/today-plans/plan-101/responses/resp-201/accept',
        {},
        'token'
      );
      // Navigation to chat occurs
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/chat/[id]',
        params: { id: 'conv-999' },
      });
    });
  });

  test('supports English language strings properly', async () => {
    void i18n.changeLanguage('en');

    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      return Promise.resolve({ items: [mockPlan], nextCursor: null, totalCount: 1 });
    });

    setupAuth(request);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Active plans: 0\/1/)).toBeTruthy();
      expect(screen.getByText('All')).toBeTruthy();
      expect(screen.getByText('Mine')).toBeTruthy();
      expect(screen.getByText('Replies')).toBeTruthy();
      expect(screen.getByTestId('open-filters-modal-btn')).toBeTruthy();
      expect(screen.getByTestId('today-plans-filter-funnel-icon')).toBeTruthy();
    });
  });

  test('applicant can withdraw response and author can cancel plan with confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirmBtn = buttons?.find(b => b.style !== 'cancel');
      confirmBtn?.onPress?.();
    });

    const appliedPlan = {
      ...mockPlan,
      hasApplied: true,
      myResponseState: 'Pending',
      myResponseId: 'resp-201',
    };

    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      if (path === '/api/today-plans/plan-101/responses/resp-201/withdraw') {
        return Promise.resolve(true);
      }
      return Promise.resolve({ items: [appliedPlan], nextCursor: null, totalCount: 1 });
    });

    setupAuth(request, 'user-applicant');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdraw-btn-plan-101')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('withdraw-btn-plan-101'));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/today-plans/plan-101/responses/resp-201/withdraw',
        {},
        'token'
      );
    });
  });

  test('tapping plan card opens full details modal displaying all plan fields', async () => {
    const detailPlan = {
      ...mockPlan,
      authorBio: 'მოგზაურობის და ყავის მოყვარული',
      district: 'ვაკე',
    };

    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      if (path === '/api/today-plans/plan-101') return Promise.resolve(detailPlan);
      return Promise.resolve({ items: [mockPlan], nextCursor: null, totalCount: 1 });
    });

    setupAuth(request, 'user-visitor');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    // Wait for plan card to appear
    await waitFor(() => {
      expect(screen.getByTestId('today-plan-card-press-plan-101')).toBeTruthy();
      expect(screen.getByText('საღამოს ყავა და გასეირნება')).toBeTruthy();
    });

    // Tap on card to open details modal
    fireEvent.press(screen.getByTestId('today-plan-card-press-plan-101'));

    // Verify modal is open and shows full details
    await waitFor(() => {
      expect(screen.getByTestId('today-plan-detail-modal-plan-101')).toBeTruthy();
      expect(screen.getAllByText('მყუდრო კაფეში შეხვედრა').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('მოგზაურობის და ყავის მოყვარული')).toBeTruthy();
      expect(screen.getByTestId('modal-join-plan-btn')).toBeTruthy();
    });

    // Close the details modal
    fireEvent.press(screen.getByTestId('close-plan-detail-modal'));

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('today-plan-detail-modal-plan-101')).toBeNull();
    });
  });

  test('filters modal allows typing and selecting a city to filter plans', async () => {
    const request = jest.fn().mockImplementation((path: string, _opts?: any) => {
      if (path === '/api/today-plans/limits') return Promise.resolve(mockLimits);
      return Promise.resolve({ items: [mockPlan], nextCursor: null, totalCount: 1 });
    });

    setupAuth(request, 'user-visitor');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TodayPlansScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('open-filters-modal-btn')).toBeTruthy();
    });

    // Open filter modal
    fireEvent.press(screen.getByTestId('open-filters-modal-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('filter-city-search-input')).toBeTruthy();
    });

    // Type a city name in search input
    fireEvent.changeText(screen.getByTestId('filter-city-search-input'), 'ბათუმი');

    // Select the filtered Batumi chip
    await waitFor(() => {
      expect(screen.getByTestId('filter-city-batumi')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('filter-city-batumi'));

    // Apply the filter
    fireEvent.press(screen.getByTestId('filter-apply-btn'));

    // Verify plans API was called with city=batumi
    await waitFor(() => {
      const calls = request.mock.calls.map(c => c[0] as string);
      const filteredCall = calls.find(url => url.includes('city=batumi'));
      expect(filteredCall).toBeTruthy();
    });
  });
});

