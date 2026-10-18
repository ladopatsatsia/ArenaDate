import { Button, Text, TextInput, Card } from '../components/UI';
import { useState, useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { ApiError } from './api';
import { useAuth } from './AuthProvider';
import { getTelegramWebApp, isTelegramMiniApp, triggerHaptic } from '../telegram/telegramSdk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('../../assets/logo.png');

export function OtpAuthScreen({ onSwitchToPassword }: { onSwitchToPassword?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { manager, api } = useAuth();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inTelegram, setInTelegram] = useState(() => isTelegramMiniApp());

  useEffect(() => {
    const checkAndLogin = () => {
      if (isTelegramMiniApp()) {
        setInTelegram(true);
        void handleTelegramLogin();
        return true;
      }
      return false;
    };

    if (checkAndLogin()) return;
    const t1 = setTimeout(checkAndLogin, 100);
    const t2 = setTimeout(checkAndLogin, 400);
    const t3 = setTimeout(checkAndLogin, 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleTelegramLogin = async () => {
    const tg = getTelegramWebApp();
    if (!tg || !tg.initData) return;
    setError(null);
    setBusy(true);
    triggerHaptic('medium');
    try {
      const res = await api.loginTelegram({ initData: tg.initData });
      await manager.signInWithTokens(res.tokens);
      if (res.isNewUser || !res.hasCompleteProfile) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/discover');
      }
    } catch (err: unknown) {
      console.error('[LoginTelegram Error]:', err);
      setError('request_failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('invalid_field');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      console.log('[OtpAuthScreen] Sending OTP to:', trimmed);
      await api.sendOtp({ email: trimmed });
      setStep('code');
      setCode('1111'); // Convenient dev pre-fill or user can enter it
    } catch (err: unknown) {
      console.error('[SendOtp Error]:', err);
      if (err instanceof ApiError && err.status === 429) {
        setError('rate_limited');
      } else {
        setError('request_failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 4) {
      setError('invalid_code');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.verifyOtp({ email: email.trim(), code: trimmedCode });
      await manager.signInWithTokens(res.tokens);

      if (res.isNewUser || !res.hasCompleteProfile) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/discover');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.code === 'invalid_code' || err.status === 400)) {
        setError('invalid_code');
      } else if (err instanceof ApiError && err.status === 429) {
        setError('rate_limited');
      } else {
        setError('request_failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('brand_name')}>
      <View style={styles.heroContainer}>
        <Image
          source={logoSource}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel="ARENA"
        />
        <Text style={styles.heroSlogan}>{t('brand_slogan')}</Text>
      </View>

      <Card style={styles.authCard}>
        <Text accessibilityRole="header" style={styles.cardHeader}>
          {t('auth_otp_title')}
        </Text>

        {step === 'email' ? (
          <>
            {inTelegram && (
              <View style={styles.telegramBox}>
                <Button
                  testID="tg-login-btn"
                  variant="primary"
                  busy={busy}
                  disabled={busy}
                  title={busy ? t('working') : t('auth_telegram', '✈️ შესვლა Telegram-ით')}
                  onPress={() => void handleTelegramLogin()}
                />
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('or', 'ან')}</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>
            )}

            <Text style={styles.cardSubtitle}>{t('auth_otp_email_hint')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('field_email')}</Text>
              <TextInput
                testID="otp-email-input"
                accessibilityLabel={t('field_email')}
                style={styles.input}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setError(null);
                }}
                placeholder="name@example.com"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                maxLength={254}
              />
            </View>

            {error && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {t(error)}
              </Text>
            )}

            <Button
              testID="otp-send-btn"
              variant="primary"
              busy={busy}
              disabled={busy || !email.trim()}
              title={busy ? t('working') : t('auth_otp_send_btn')}
              onPress={() => {
                void handleSendCode();
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.cardSubtitle}>
              {t('auth_otp_code_sent_to', { email: email.trim() })}
            </Text>

            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>✨ {t('auth_otp_dev_hint')}</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth_otp_enter_code')}</Text>
              <TextInput
                testID="otp-code-input"
                accessibilityLabel={t('auth_otp_enter_code')}
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(val) => {
                  setCode(val.replace(/\D/g, '').slice(0, 4));
                  setError(null);
                }}
                placeholder="1111"
                placeholderTextColor={theme.colors.muted}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />
            </View>

            {error && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {t(error)}
              </Text>
            )}

            <Button
              testID="otp-verify-btn"
              variant="primary"
              busy={busy}
              disabled={busy || code.trim().length !== 4}
              title={busy ? t('working') : t('auth_otp_verify_btn')}
              onPress={() => {
                void handleVerifyCode();
              }}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.backBtnText}>← {t('auth_otp_change_email')}</Text>
            </Pressable>
          </>
        )}

        {onSwitchToPassword && (
          <Pressable
            accessibilityRole="button"
            onPress={onSwitchToPassword}
            style={({ pressed }) => [styles.switchBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.switchBtnText}>{t('auth_password_link')}</Text>
          </Pressable>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  logoImage: {
    width: 220,
    height: 120,
  },
  heroSlogan: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.match,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  authCard: {
    gap: 16,
    padding: 22,
    marginTop: 8,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  devBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  devBadgeText: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    color: theme.colors.text,
    fontSize: 16,
  },
  codeInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  backBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backBtnText: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  switchBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    marginTop: 4,
  },
  switchBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  telegramBox: {
    marginBottom: 8,
    gap: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
});
