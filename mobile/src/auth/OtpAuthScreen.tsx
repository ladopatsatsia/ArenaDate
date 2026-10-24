import { Button, Text, Card } from '../components/UI';
import { useState, useEffect, useCallback } from 'react';
import { Image, StyleSheet, View, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { useAuth } from './AuthProvider';
import { getTelegramWebApp, getTelegramInitData, isTelegramMiniApp, triggerHaptic } from '../telegram/telegramSdk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('../../assets/logo.png');

const TELEGRAM_BOT_URL = 'https://t.me/ArenaDate_Bot/app';

export function OtpAuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { manager, api } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inTelegram, setInTelegram] = useState(() => isTelegramMiniApp());

  const handleTelegramLogin = useCallback(async () => {
    const initData = getTelegramInitData();
    if (!initData) {
      setError('auth_telegram_browser_note');
      setInTelegram(false);
      return;
    }
    setInTelegram(true);
    setError(null);
    setBusy(true);
    triggerHaptic('medium');
    try {
      const res = await api.loginTelegram({ initData });
      await manager.signInWithTokens(res.tokens);
      if (res.isNewUser) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/discover');
      }
    } catch (err: unknown) {
      console.error('[LoginTelegram Error]:', err);
      setError('auth_telegram_error');
    } finally {
      setBusy(false);
    }
  }, [api, manager, router]);

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
  }, [handleTelegramLogin]);

  const handleOpenBot = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(TELEGRAM_BOT_URL, '_blank');
    } else {
      void Linking.openURL(TELEGRAM_BOT_URL);
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
          {t('auth_telegram_title', 'ავტორიზაცია')}
        </Text>

        {inTelegram ? (
          <>
            <Text style={styles.cardSubtitle}>
              {t('auth_telegram_sub', 'სწრაფი და უსაფრთხო შესვლა Telegram ანგარიშით')}
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} accessibilityRole="alert">
                  {t(error, 'ავტორიზაცია ვერ მოხერხდა. გთხოვთ სცადოთ ხელახლა.')}
                </Text>
              </View>
            )}

            <Button
              testID="tg-login-btn"
              variant="primary"
              busy={busy}
              disabled={busy}
              title={busy ? t('working', 'მიმდინარეობს შესვლა...') : t('auth_telegram', '✈️ შესვლა Telegram-ით')}
              onPress={() => void handleTelegramLogin()}
            />
          </>
        ) : (
          <>
            <Text style={styles.cardSubtitle}>
              {t(
                'auth_telegram_browser_note',
                'აპლიკაციაში შესვლა შესაძლებელია მხოლოდ Telegram-ის მეშვეობით. გასაგრძელებლად გახსენით ჩვენი ოფიციალური ბოტი.'
              )}
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} accessibilityRole="alert">
                  {t(error, 'ავტორიზაცია ვერ მოხერხდა. გთხოვთ სცადოთ ხელახლა.')}
                </Text>
              </View>
            )}

            <Button
              testID="open-telegram-bot-btn"
              variant="primary"
              title={t('auth_telegram_open_bot', '🤖 Telegram-ში გახსნა')}
              onPress={handleOpenBot}
            />

            <Button
              testID="retry-telegram-check-btn"
              variant="secondary"
              busy={busy}
              disabled={busy}
              title={t('auth_telegram_retry', 'ხელახლა შემოწმება')}
              onPress={() => {
                if (isTelegramMiniApp()) {
                  setInTelegram(true);
                  void handleTelegramLogin();
                } else {
                  setError('auth_telegram_browser_note');
                }
              }}
            />
          </>
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
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },
});
