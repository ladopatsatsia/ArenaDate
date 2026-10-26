import React from 'react';
import i18n from '../src/i18n';
import { render as tlRender, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Filters } from '../src/discovery/Filters';
import type { DiscoveryApi, Settings } from '../src/discovery/api';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const render = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return tlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: { account: { id: 'test-user-id' } },
    api: {},
    manager: {
      snapshot: () => ({ account: { id: 'test-user-id' } }),
      subscribe: () => () => {},
    },
  }),
}));

const mockSettings: Settings = {
  revision: 1,
  minAge: 20,
  maxAge: 32,
  desiredGenders: ['woman'],
  radiusKm: 25,
  mode: 'city',
  city: 'თბილისი',
  hasLocation: true,
};

const mockApi = {
  save: jest.fn(),
  location: jest.fn(),
  clearLocation: jest.fn(),
  settings: jest.fn(),
  page: jest.fn(),
  current: jest.fn(),
} as unknown as DiscoveryApi;

describe('Tinder-style Discovery Filters Component', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ka');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders initial settings properly with age range, genders, and mode', () => {
    const saved = jest.fn();
    const { getByText, getByLabelText } = render(
      <Filters settings={mockSettings} api={mockApi} saved={saved} />
    );

    expect(getByText(/20 – 32/)).toBeTruthy();
    expect(getByLabelText('ქალები')).toBeTruthy();
    expect(getByLabelText('კაცები')).toBeTruthy();
    expect(getByText(/ქალაქის მიხედვით/)).toBeTruthy();
  });

  test('toggles desired genders while guarding against empty selection', () => {
    const saved = jest.fn();
    const { getByLabelText } = render(
      <Filters settings={mockSettings} api={mockApi} saved={saved} />
    );

    const menCheckbox = getByLabelText('კაცები');
    fireEvent.press(menCheckbox);

    // Now both woman and man should be selected
    const womenCheckbox = getByLabelText('ქალები');
    fireEvent.press(womenCheckbox);

    // Unselecting women works when men is still selected
    expect(menCheckbox.props.accessibilityState.checked).toBe(true);
  });

  test('quick preset buttons update min and max age', () => {
    const saved = jest.fn();
    const { getByText } = render(
      <Filters settings={mockSettings} api={mockApi} saved={saved} />
    );

    const preset2535 = getByText('25–35');
    fireEvent.press(preset2535);

    expect(getByText(/25 – 35/)).toBeTruthy();
  });

  test('submitting calls api.save and invokes saved and onClose callbacks', async () => {
    const saved = jest.fn();
    const onClose = jest.fn();
    const updatedSettings = { ...mockSettings, revision: 2 };
    jest.mocked(mockApi.save).mockResolvedValueOnce(updatedSettings);

    const { getByText } = render(
      <Filters settings={mockSettings} api={mockApi} saved={saved} onClose={onClose} />
    );

    const submitBtn = getByText(/პარამეტრების შენახვა/);
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockApi.save).toHaveBeenCalledTimes(1);
      expect(saved).toHaveBeenCalledWith(updatedSettings);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  test('switches mode between by city and all Georgia', () => {
    const saved = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <Filters settings={mockSettings} api={mockApi} saved={saved} />
    );

    // Initial state: by city is active, CityPicker is shown
    expect(queryByTestId('discovery-city')).toBeTruthy();

    // Click 'ყველა (საქართველო)'
    const allTab = getByTestId('mode-tab-all');
    fireEvent.press(allTab);

    // All Georgia banner visible
    expect(getByText(/მთელი საქართველო/)).toBeTruthy();
  });
});

