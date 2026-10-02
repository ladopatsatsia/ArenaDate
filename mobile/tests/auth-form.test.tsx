import '../src/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthForm } from '../src/auth/AuthForm';
import { ApiError } from '../src/auth/api';
const mockSignIn = jest.fn();
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ manager: { signIn: mockSignIn }, api: {}, state: { status: 'signedOut', account: null } }) }));
jest.mock('expo-router', () => ({ Link: require('react-native').Text }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
test('server rejection is shown without a fake signed-in state', async () => {
  mockSignIn.mockRejectedValueOnce(new ApiError(401, 'invalid_credentials'));
  render(<AuthForm mode="login" />);
  fireEvent.changeText(screen.getByLabelText('Email'), 'a@example.test');
  fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(screen.getByText(/Unable to sign in/)).toBeTruthy());
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});
