import { useState } from 'react';
import { AuthForm } from '../src/auth/AuthForm';
import { OtpAuthScreen } from '../src/auth/OtpAuthScreen';

export default function Login() {
  const [usePassword, setUsePassword] = useState(false);
  if (usePassword) {
    return <AuthForm mode="login" />;
  }
  return <OtpAuthScreen onSwitchToPassword={() => setUsePassword(true)} />;
}
