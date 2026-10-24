import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { OtpAuthScreen } from '../src/auth/OtpAuthScreen';

export default function Welcome() {
  const { state } = useAuth();
  if (state.status === 'signedIn') {
    return <Redirect href="/(tabs)/discover" />;
  }
  return <OtpAuthScreen />;
}
