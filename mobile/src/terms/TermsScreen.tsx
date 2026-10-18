import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { Text } from '../components/UI';
import { theme } from '../components/theme';
import { TermsContent } from './TermsContent';

export default function TermsScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('terms_and_conditions', 'წესები და პირობები')}>
      <View style={styles.container}>
        <View style={styles.headerBox}>
          <Text style={styles.headerIcon}>📜</Text>
          <Text style={styles.headerTitle}>
            {t('terms_and_conditions', 'წესები და პირობები')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t(
              'terms_subtitle',
              'გაეცანით ARENA-ს საზოგადოების წესებს, ეთიკის სტანდარტებსა და უსაფრთხოების რეკომენდაციებს'
            )}
          </Text>
        </View>

        <TermsContent />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  headerBox: {
    paddingVertical: 8,
    gap: 4,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
});
