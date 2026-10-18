import { Link, Text, Card, Button } from '../src/components/UI';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { theme } from '../src/components/theme';
import { useRouter } from 'expo-router';

import { useEffect } from 'react';
import { isTelegramMiniApp } from '../src/telegram/telegramSdk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('../assets/logo.png');

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      if (isTelegramMiniApp()) {
        router.replace('/auth');
        return true;
      }
      return false;
    };

    if (check()) return;
    const t1 = setTimeout(check, 100);
    const t2 = setTimeout(check, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router]);

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

      <Card style={styles.welcomeCard}>
        <Text accessibilityRole="header" style={styles.cardHeader}>{t('welcome_note')}</Text>
        <Text style={styles.cardBody}>{t('intro')}</Text>
        <Button
          variant="primary"
          title={t('continue')}
          onPress={() => router.push('/auth')}
        />
      </Card>

      <Text style={styles.privacyNote}>{t('welcome_privacy')}</Text>
      {__DEV__ && <Link href="/health" style={styles.healthLink}>{t('health')}</Link>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  logoImage: {
    width: 260,
    height: 180,
  },
  heroSlogan: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.match,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  welcomeCard: {
    gap: 16,
    padding: 24,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  privacyNote: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  healthLink: {
    alignSelf: 'center',
  },
});

