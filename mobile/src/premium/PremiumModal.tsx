import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Button } from '../components/UI';
import { PremiumApi, SubscribeResult } from './PremiumApi';
import { useAuth } from '../auth/AuthProvider';
import { getTelegramWebApp, isTelegramMiniApp, triggerHaptic } from '../telegram/telegramSdk';

interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PremiumModal({ visible, onClose, onSuccess }: PremiumModalProps) {
  const { t } = useTranslation();
  const { state, api: auth, manager } = useAuth();
  const accountId = state.account?.id;
  const cache = useQueryClient();
  const api = React.useMemo(() => new PremiumApi(auth, manager), [auth, manager]);

  const [selectedPackageId, setSelectedPackageId] = useState<string>('one_month');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inTelegram] = useState(() => isTelegramMiniApp());

  const statusQuery = useQuery({
    queryKey: ['account', accountId, 'premium-status'],
    queryFn: api.status,
    enabled: visible,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (pkgId: string) => {
      const tg = getTelegramWebApp();
      if (inTelegram && tg) {
        // 1. Generate Telegram Stars invoice link from backend
        const invoice = await api.createTelegramStarsInvoice({
          itemType: 'subscription',
          itemId: pkgId,
        });

        // 2. Open native Telegram invoice modal via WebApp SDK
        return new Promise<SubscribeResult>((resolve, reject) => {
          tg.openInvoice(invoice.invoiceLink, async (status) => {
            if (status === 'paid') {
              try {
                // 3. Verify and immediately fulfill on backend
                const verifyRes = await api.verifyTelegramStarsPayment({
                  payload: invoice.payload,
                });
                resolve({
                  success: true,
                  message: verifyRes.message || t('premium_activated_msg', 'პრემიუმ პაკეტი გააქტიურებულია!'),
                  status: verifyRes.premiumStatus ?? (await api.status()),
                });
              } catch {
                // Fallback: Webhook fulfills in background, fetch current status
                const currentStatus = await api.status();
                resolve({
                  success: true,
                  message: t('payment_received', 'გადახდა მიღებულია!'),
                  status: currentStatus,
                });
              }
            } else if (status === 'cancelled') {
              reject(new Error(t('payment_cancelled', 'გადახდა გაუქმდა.')));
            } else {
              reject(new Error(t('payment_failed', 'გადახდა ვერ განხორციელდა.')));
            }
          });
        });
      }

      // Non-telegram fallback
      return api.subscribe({
        packageId: pkgId,
        platform: 'mobile',
        idempotencyKey: Math.random().toString(36).substring(2),
      });
    },
    onSuccess: (data) => {
      setErrorMessage(null);
      void cache.invalidateQueries({ queryKey: ['account', accountId, 'premium-status'] });
      void cache.invalidateQueries({ queryKey: ['account', accountId, 'requests'] });
      Alert.alert('გილოცავთ! 👑', data.message || t('premium_success_msg', 'პრემიუმ პაკეტი გააქტიურებულია!'));
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(err instanceof Error ? err.message : t('premium_fail_msg', 'პაკეტის გააქტიურება ვერ მოხერხდა. სცადეთ მოგვიანებით.'));
    },
  });

  const packages = statusQuery.data?.packages ?? [
    {
      id: 'two_weeks',
      name: t('premium_pkg_2weeks_name', '2 კვირა'),
      description: t('premium_pkg_2weeks_desc', 'სწრაფი წვდომა 14 დღით'),
      durationDays: 14,
      priceAmount: 2.9,
      currency: 'GEL',
      priceDisplay: '2.90 ₾',
      badge: null,
      isPopular: false,
    },
    {
      id: 'one_month',
      name: t('premium_pkg_1month_name', '1 თვე'),
      description: t('premium_pkg_1month_desc', 'ყველაზე პოპულარული არჩევანი'),
      durationDays: 30,
      priceAmount: 4.9,
      currency: 'GEL',
      priceDisplay: '4.90 ₾',
      badge: t('premium_pkg_1month_badge', 'პოპულარული'),
      isPopular: true,
    },
    {
      id: 'three_months',
      name: t('premium_pkg_3months_name', '3 თვე'),
      description: t('premium_pkg_3months_desc', 'ეკონომიური პაკეტი'),
      durationDays: 90,
      priceAmount: 10.0,
      currency: 'GEL',
      priceDisplay: '10.00 ₾',
      badge: t('premium_pkg_3months_badge', 'ეკონომია'),
      isPopular: false,
    },
    {
      id: 'lifetime',
      name: t('premium_pkg_lifetime_name', 'ულიმიტო'),
      description: t('premium_pkg_lifetime_desc', 'ერთხელ გადახდა, სამუდამო პრემიუმი'),
      durationDays: null,
      priceAmount: 40.0,
      currency: 'GEL',
      priceDisplay: '40.00 ₾',
      badge: t('premium_pkg_lifetime_badge', 'საუკეთესო'),
      isPopular: false,
    },
  ];

  const hasPremium = statusQuery.data?.hasPremium;
  const isLifetime = statusQuery.data?.isLifetime;
  const expiresAt = statusQuery.data?.expiresAtUtc;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.crownCircle}>
              <Text style={styles.crownEmoji}>🖤</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>ARENA BLACK</Text>
            <Text style={styles.subtitle}>
              {t('menu_premium_sub', 'ექსკლუზიური წვდომა, VIP სტატუსი')}
            </Text>

            {hasPremium && (
              <View style={styles.activeBanner}>
                <Text style={styles.activeBannerText}>
                  {t('premium_active_title', '🖤 Arena Black აქტიურია')}
                  {isLifetime
                    ? t('premium_lifetime_label', ' (სამუდამო ულიმიტო წვდომა)')
                    : expiresAt
                    ? t('premium_until_label', {
                        date: new Date(expiresAt).toLocaleDateString(),
                        defaultValue: ` (${new Date(expiresAt).toLocaleDateString()}-მდე)`,
                      })
                    : ''}
                </Text>
              </View>
            )}

            {/* Benefits List */}
            <View style={styles.benefitsCard}>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>👁️</Text>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    {t('premium_benefit_crush_title', 'გაიგე ვისი Crush ხარ')}
                  </Text>
                  <Text style={styles.benefitDesc}>
                    {t('premium_benefit_crush_desc', 'ნახე ყველა, ვინც შენით მოიხიბლა')}
                  </Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>⚡</Text>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    {t('premium_benefit_direct_match_title', 'პირდაპირი მეჩი')}
                  </Text>
                  <Text style={styles.benefitDesc}>
                    {t('premium_benefit_direct_match_desc', 'აღარ გჭირდება ლოდინი — მომენტალურად გადადი პირად მიმოწერაში')}
                  </Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>👑</Text>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    {t('premium_benefit_spotlight_title', 'არენის ყურადღების ცენტრში')}
                  </Text>
                  <Text style={styles.benefitDesc}>
                    {t('premium_benefit_spotlight_desc', 'შენი პროფილი ყოველთვის სიის სათავეშია — მიიქციე მაქსიმალური ყურადღება არენაზე')}
                  </Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>🗓️</Text>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    {t('premium_benefit_today_plans_title', '„დღეს მინდა“ — 3 აქტიური გეგმა')}
                  </Text>
                  <Text style={styles.benefitDesc}>
                    {t('premium_benefit_today_plans_desc', 'შექმენი 3 აქტიური გეგმა ერთდროულად (1-ის ნაცვლად)')}
                  </Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>💬</Text>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    {t('premium_benefit_today_responses_title', '„დღეს მინდა“ — 10 გამოხმაურება დღეში')}
                  </Text>
                  <Text style={styles.benefitDesc}>
                    {t('premium_benefit_today_responses_desc', 'გამოეხმაურე სხვების გეგმებს 10-ჯერ დღეში (3-ის ნაცვლად)')}
                  </Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✈️</Text>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    {t('premium_benefit_passport_title', 'კონკრეტული ქვეყნის არჩევა (Passport)')}
                  </Text>
                  <Text style={styles.benefitDesc}>
                    {t('premium_benefit_passport_desc', 'მოძებნე და ისვაიპე მსოფლიოს ნებისმიერ სასურველ ქვეყანაში')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Packages Selector */}
            <Text style={styles.sectionHeading}>
              {t('premium_choose_package', 'აირჩიე სასურველი პაკეტი:')}
            </Text>
            <View style={styles.packageGrid}>
              {packages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                const pkgName =
                  pkg.id === 'two_weeks'
                    ? t('premium_pkg_2weeks_name', pkg.name)
                    : pkg.id === 'one_month'
                    ? t('premium_pkg_1month_name', pkg.name)
                    : pkg.id === 'three_months'
                    ? t('premium_pkg_3months_name', pkg.name)
                    : pkg.id === 'lifetime'
                    ? t('premium_pkg_lifetime_name', pkg.name)
                    : pkg.name;
                const pkgDesc =
                  pkg.id === 'two_weeks'
                    ? t('premium_pkg_2weeks_desc', pkg.description)
                    : pkg.id === 'one_month'
                    ? t('premium_pkg_1month_desc', pkg.description)
                    : pkg.id === 'three_months'
                    ? t('premium_pkg_3months_desc', pkg.description)
                    : pkg.id === 'lifetime'
                    ? t('premium_pkg_lifetime_desc', pkg.description)
                    : pkg.description;
                const pkgBadge =
                  pkg.id === 'one_month'
                    ? t('premium_pkg_1month_badge', 'პოპულარული')
                    : pkg.id === 'three_months'
                    ? t('premium_pkg_3months_badge', 'ეკონომია')
                    : pkg.id === 'lifetime'
                    ? t('premium_pkg_lifetime_badge', 'საუკეთესო')
                    : pkg.badge;

                return (
                  <Pressable
                    key={pkg.id}
                    onPress={() => setSelectedPackageId(pkg.id)}
                    style={[
                      styles.packageCard,
                      isSelected && styles.packageCardSelected,
                      pkg.isPopular && styles.packageCardPopular,
                    ]}
                  >
                    {pkgBadge && (
                      <View style={[styles.badge, pkg.isPopular ? styles.badgePopular : styles.badgeEco]}>
                        <Text style={styles.badgeText}>{pkgBadge}</Text>
                      </View>
                    )}
                    <Text style={[styles.packageName, isSelected && styles.packageNameSelected]}>
                      {pkgName}
                    </Text>
                    <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                      {pkg.priceDisplay}
                    </Text>
                    {inTelegram && (
                      <Text style={styles.starsTag}>
                        ⭐ {pkg.id === 'two_weeks' ? '50' : pkg.id === 'one_month' ? '90' : pkg.id === 'three_months' ? '180' : '750'} Stars
                      </Text>
                    )}
                    <Text style={styles.packageDesc} numberOfLines={2}>
                      {pkgDesc}
                    </Text>
                    {isSelected && (
                      <View style={styles.selectedCheckCircle}>
                        <Text style={styles.selectedCheckMark}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Button
              title={
                subscribeMutation.isPending
                  ? t('premium_processing', 'მუშავდება...')
                  : inTelegram
                  ? t('premium_pay_stars', '⭐ გადახდა Telegram Stars-ით')
                  : hasPremium
                  ? t('premium_extend_package', '⚡ პაკეტის გაგრძელება / შეცვლა')
                  : t('premium_activate_black', '🖤 Arena Black-ის გააქტიურება')
              }
              variant="primary"
              disabled={subscribeMutation.isPending}
              onPress={() => {
                triggerHaptic('heavy');
                subscribeMutation.mutate(selectedPackageId);
              }}
              style={styles.activateBtn}
              textStyle={styles.activateBtnText}
            />

            <Text style={styles.footerNote}>
              {t('premium_secure_note', 'გადახდა უსაფრთხოა. არანაირი ფარული გადასახადი.')}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 4, 15, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1329',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '92%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#3b295c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  crownCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownEmoji: {
    fontSize: 22,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2d2342',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: theme.colors.muted,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
  },
  activeBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  activeBannerText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  benefitsCard: {
    backgroundColor: '#241b38',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#3a2d54',
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    fontSize: 22,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  benefitDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  packageCard: {
    width: '48%',
    backgroundColor: '#241b38',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#3a2d54',
    position: 'relative',
    minHeight: 110,
    justifyContent: 'space-between',
  },
  packageCardSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#2e2147',
  },
  packageCardPopular: {
    borderColor: '#8b5cf6',
  },
  badge: {
    position: 'absolute',
    top: -9,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgePopular: {
    backgroundColor: '#8b5cf6',
  },
  badgeEco: {
    backgroundColor: '#10b981',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  packageName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  packageNameSelected: {
    color: '#fbbf24',
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginVertical: 4,
  },
  packagePriceSelected: {
    color: '#fef08a',
  },
  packageDesc: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  selectedCheckCircle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckMark: {
    fontSize: 12,
    color: '#000',
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  activateBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  activateBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  starsTag: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 12,
  },
});
