import { Link } from '../components/UI';
import { Button, Text, TextInput } from '../components/UI';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { ApiError } from './api';
import { useAuth } from './AuthProvider';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { manager, api, state } = useAuth();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const needsPassword = mode === 'login' || mode === 'register' || mode === 'reset';
  const needsCode = mode === 'verify' || mode === 'reset';
  const schema = z.object({
    email: z.email().max(254),
    password: needsPassword ? z.string().min(mode === 'login' ? 1 : 12).max(128) : z.string(),
    dateOfBirth: mode === 'register' ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/) : z.string(),
    code: needsCode ? z.string().min(1).max(2048) : z.string(),
  });
  const { control, handleSubmit, getValues, reset, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(schema), defaultValues: { email: '', password: '', dateOfBirth: '', code: '' },
  });
  function showError(error: unknown) {
    const known = ['invalid_credentials', 'invalid_code', 'adult_required', 'password_policy', 'refresh_conflict'];
    setError(error instanceof ApiError ? (error.status === 429 ? 'rate_limited' : known.includes(error.code) ? error.code : 'request_failed') : 'connection_error');
  }
  const submit = handleSubmit(async values => {
    setError(null); setResult(null);
    try {
      if (mode === 'login') {
        await manager.signIn({ email: values.email.trim(), password: values.password });
        router.replace('/(tabs)/discover');
        return;
      }
      if (mode === 'register') {
        await api.register({ email: values.email.trim(), password: values.password, dateOfBirth: values.dateOfBirth });
        await manager.signIn({ email: values.email.trim(), password: values.password });
        router.replace('/(tabs)/discover');
        return;
      }
      if (mode === 'verify') await api.verify({ email: values.email.trim(), code: values.code.trim() });
      if (mode === 'forgot') await api.forgot(values.email.trim());
      if (mode === 'reset') await api.reset({ email: values.email.trim(), code: values.code.trim(), password: values.password });
      setResult(mode === 'verify' ? 'verified' : mode === 'reset' ? 'password_reset' : 'email_accepted'); reset({ ...values, password: '', code: '' });
    } catch (error) { showError(error); }
  });
  const fields: ('email' | 'password' | 'dateOfBirth' | 'code')[] = ['email'];
  if (needsPassword) fields.push('password');
  if (mode === 'register') fields.push('dateOfBirth');
  if (needsCode) fields.push('code');
  return <Screen title={t('auth_' + mode)}>
      {mode === 'register' && <Text>{t('age_notice')}</Text>}
      {state.notice && <Text accessibilityRole="alert">{t(state.notice)}</Text>}
      {fields.map(name => <Controller key={name} control={control} name={name} render={({ field: { onChange, onBlur, value }, fieldState }) =>
        <>
          <Text>{t('field_' + name)}</Text>
          <TextInput testID={'auth-'+name} accessibilityLabel={t('field_' + name)} style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none" autoCorrect={false} secureTextEntry={name === 'password' || name === 'code'}
            keyboardType={name === 'email' ? 'email-address' : name === 'dateOfBirth' ? 'numbers-and-punctuation' : 'default'}
            autoComplete={name === 'email' ? 'email' : name === 'password' ? (mode === 'login' ? 'current-password' : 'new-password') : 'off'}
            maxLength={name === 'email' ? 254 : name === 'password' ? 128 : name === 'dateOfBirth' ? 10 : 2048} />
          {fieldState.error && <Text style={styles.error} accessibilityRole="alert">{t(name === 'password' && mode !== 'login' ? 'password_policy' : 'invalid_field')}</Text>}
        </>
      } />)}
      {error && <Text style={styles.error} accessibilityRole="alert">{t(error)}</Text>}
      {result && <Text accessibilityLiveRegion="polite">{t(result)}</Text>}
      <Button testID="auth-submit" variant="primary" busy={isSubmitting} disabled={isSubmitting || resending} title={isSubmitting ? t('working') : t('auth_' + mode)} onPress={() => { void submit(); }} />
      {mode === 'verify' && <Button disabled={resending || isSubmitting} title={t('resend')} onPress={() => {
        if (!z.email().safeParse(getValues('email')).success) { setError('invalid_field'); return; }
        setResending(true); setError(null);
        void api.resend(getValues('email').trim()).then(() => setResult('email_accepted'), showError).finally(() => setResending(false));
      }} />}
      <Link href="/auth">{t('auth_login')}</Link>
      <Link href="/register">{t('auth_register')}</Link>
      <Link href="/verify">{t('auth_verify')}</Link>
      <Link href="/forgot">{t('auth_forgot')}</Link>
      <Link href="/reset">{t('auth_reset')}</Link>
    </Screen>;
}
const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    color: theme.colors.text,
  },
  error: {
    color: theme.colors.danger,
  },
});
