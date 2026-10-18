import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Text } from '../components/UI';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { useAuth } from '../auth/AuthProvider';
import { PushApi, type TelegramSubscriberStatus } from './api';
import { getTelegramWebApp, isTelegramMiniApp } from '../telegram/telegramSdk';

export default function NotificationSettingsScreen() {
  const [testLoading, setTestLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const { t } = useTranslation();
  const { state, api: authApi, manager } = useAuth();
  const queryClient = useQueryClient();

  const accountId = state.account?.id;
  const pushApi = useMemo(() => new PushApi(authApi, manager), [authApi, manager, accountId]);

  // Query Telegram Subscriber Status
  const { data: tgStatus, isLoading: tgLoading } = useQuery({
    queryKey: ['account', accountId, 'telegram-status'],
    queryFn: () => pushApi.telegramStatus(),
    enabled: !!accountId,
  });

  // Toggle Telegram notifications mutation
  const toggleTelegramMutation = useMutation({
    mutationFn: (isActive: boolean) => pushApi.telegramToggle(isActive),
    onMutate: async (newActive) => {
      await queryClient.cancelQueries({ queryKey: ['account', accountId, 'telegram-status'] });
      const previous = queryClient.getQueryData<TelegramSubscriberStatus>(['account', accountId, 'telegram-status']);
      if (previous) {
        queryClient.setQueryData(['account', accountId, 'telegram-status'], { ...previous, isActive: newActive });
      }
      return { previous };
    },
    onError: (_err, _newActive, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['account', accountId, 'telegram-status'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['account', accountId, 'telegram-status'] });
    },
  });

  // Send Test Telegram Notification
  const handleSendTestNotification = async () => {
    setTestLoading(true);
    setTestFeedback(null);
    try {
      await pushApi.telegramTest();
      setTestFeedback({ success: true, message: t('telegram_test_success') });
    } catch {
      setTestFeedback({ success: false, message: t('telegram_test_failed') });
    } finally {
      setTestLoading(false);
    }
  };

  // Link Telegram Account
  const handleLinkTelegram = async () => {
    const inTg = isTelegramMiniApp();
    const tg = getTelegramWebApp();
    const tgUser = tg?.initDataUnsafe?.user;

    if (inTg && tgUser) {
      setLinkLoading(true);
      try {
        await pushApi.telegramLink({
          telegramUserId: tgUser.id,
          chatId: tgUser.id,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          lastName: tgUser.last_name ?? null,
        });
        await queryClient.invalidateQueries({ queryKey: ['account', accountId, 'telegram-status'] });
      } catch {
        const bot = tgStatus?.botUsername || 'ARENA_ge_bot';
        void Linking.openURL(`https://t.me/${bot}`);
      } finally {
        setLinkLoading(false);
      }
    } else {
      const bot = tgStatus?.botUsername || 'ARENA_ge_bot';
      void Linking.openURL(`https://t.me/${bot}`);
    }
  };

  return (
    <Screen title={t('push_title')}>
      <View style={styles.container}>
        {/* Intro Header */}
        <View style={styles.headerBox}>
          <Text style={styles.headerIcon}>🔔</Text>
          <Text style={styles.headerTitle}>{t('push_title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('push_header_subtitle', 'მართეთ შეტყობინებები ახალი წყვილებისა და ჩატის შესახებ')}
          </Text>
        </View>

        {/* 1. Telegram Notifications Card */}
        <Card style={styles.telegramCard}>
          <View style={styles.telegramHeaderRow}>
            <View style={styles.telegramTitleBox}>
              <Text style={{ fontSize: 22 }}>✈️</Text>
              <Text style={styles.telegramTitle}>{t('telegram_notifications_title', 'Telegram-ის შეტყობინებები')}</Text>
            </View>

            {/* Live status badge */}
            {tgLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : !tgStatus?.isLinked ? (
              <View style={styles.badgeMuted}>
                <Text style={styles.badgeMutedText}>{t('telegram_status_not_linked', 'არაა დაკავშირებული')}</Text>
              </View>
            ) : tgStatus.isActive ? (
              <View style={styles.badgeActive}>
                <Text style={styles.badgeActiveText}>🟢 {t('telegram_status_active', 'აქტიურია')}</Text>
              </View>
            ) : (
              <View style={styles.badgePaused}>
                <Text style={styles.badgePausedText}>🟡 {t('telegram_status_paused', 'შეჩერებულია')}</Text>
              </View>
            )}
          </View>

          <Text style={styles.telegramDesc}>
            {t('telegram_notifications_desc', 'მიიღეთ შეტყობინებები ახალ წყვილებზე, ჩატის წერილებსა და გეგმებზე პირდაპირ Telegram-ის ჩატში')}
          </Text>

          {/* Test notification feedback message */}
          {testFeedback && (
            <View style={testFeedback.success ? styles.successBox : styles.alertBox}>
              <Text style={testFeedback.success ? styles.successText : styles.alertText}>
                {testFeedback.message}
              </Text>
            </View>
          )}

          {/* Linked subscriber details & controls */}
          {tgStatus?.isLinked ? (
            <View style={styles.telegramActionsCol}>
              {/* Linked user info badge */}
              <View style={styles.linkedInfoRow}>
                <Text style={styles.linkedInfoLabel}>დაკავშირებული ჩატი:</Text>
                <Text style={styles.linkedInfoValue}>
                  {tgStatus.username ? `@${tgStatus.username}` : (tgStatus.firstName || `ID: ${tgStatus.telegramUserId}`)}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Toggle switch row */}
              <View style={styles.switchRow}>
                <View style={styles.labelCol}>
                  <Text style={styles.settingTitle}>შეტყობინებების მიღება</Text>
                  <Text style={styles.settingDesc}>
                    {tgStatus.isActive
                      ? 'ბოტი გამოგიგზავნით შეტყობინებას ყოველი ახალი მეჩისა და მესიჯის დროს'
                      : 'შეტყობინებები დროებით შეჩერებულია'}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={t('telegram_notifications_title')}
                  disabled={toggleTelegramMutation.isPending}
                  value={tgStatus.isActive}
                  onValueChange={(val) => toggleTelegramMutation.mutate(val)}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#0284C7' }}
                  thumbColor={tgStatus.isActive ? '#FFFFFF' : '#94A3B8'}
                  ios_backgroundColor="rgba(255, 255, 255, 0.16)"
                />
              </View>

              {/* Send Test Notification Button */}
              <TouchableOpacity
                style={[styles.testButton, testLoading && styles.btnDisabled]}
                disabled={testLoading}
                onPress={handleSendTestNotification}
                activeOpacity={0.8}
              >
                {testLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.testButtonText}>{t('telegram_test_btn', '🔔 ტესტ-შეტყობინების გაგზავნა')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* Not linked state */
            <View style={styles.unlinkedBox}>
              <TouchableOpacity
                style={[styles.linkButton, linkLoading && styles.btnDisabled]}
                disabled={linkLoading}
                onPress={handleLinkTelegram}
                activeOpacity={0.8}
              >
                {linkLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.linkButtonText}>{t('telegram_link_btn', '🔗 Telegram ბოტთან დაკავშირება')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>
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
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  telegramCard: {
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    gap: 14,
  },
  telegramHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  telegramTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  telegramTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38BDF8',
  },
  telegramDesc: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  badgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeActiveText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
  },
  badgePaused: {
    backgroundColor: 'rgba(234, 179, 8, 0.16)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgePausedText: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeMuted: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeMutedText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  telegramActionsCol: {
    gap: 14,
    marginTop: 4,
  },
  linkedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  linkedInfoLabel: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  linkedInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
  },
  testButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  unlinkedBox: {
    marginTop: 4,
  },
  linkButton: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  settingsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 16,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  deviceHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  labelCol: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  settingDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  infoDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  successText: {
    color: '#4ADE80',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  alertBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  alertText: {
    color: theme.colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
});

