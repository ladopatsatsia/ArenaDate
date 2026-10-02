import '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HealthScreen } from '../src/components/HealthScreen';
import { getReadiness } from '../src/api/client';
jest.mock('../src/api/client');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
const readiness = jest.mocked(getReadiness);
test('shows failure then successful retry only after the API resolves', async () => {
  readiness.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 'ready' });
  render(<HealthScreen />);
  fireEvent.press(screen.getByText('Check connection'));
  await waitFor(() => expect(screen.getByText(/Cannot reach a ready API/)).toBeTruthy());
  expect(screen.queryByText('API and database are ready.')).toBeNull();
  fireEvent.press(screen.getByText('Check connection'));
  await waitFor(() => expect(screen.getByText('API and database are ready.')).toBeTruthy());
});
