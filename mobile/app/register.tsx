import { useState } from 'react';
import { AuthForm } from '../src/auth/AuthForm';
import { OtpAuthScreen } from '../src/auth/OtpAuthScreen';

export default function Register() {
  const [usePassword, setUsePassword] = useState(false);
  if (usePassword) {
    return <AuthForm mode="register" />;
  }
  return <OtpAuthScreen onSwitchToPassword={() => setUsePassword(true)} />;
}
