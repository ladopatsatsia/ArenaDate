import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Text } from '../components/UI';
import { CityPicker } from '../components/CityPicker';
import { CountryPicker } from '../components/CountryPicker';
import { theme } from '../components/theme';
import { ApiError } from '../auth/api';
import type { DiscoveryApi, Settings } from './api';
import { triggerHaptic } from '../telegram/telegramSdk';
import { useAuth } from '../auth/AuthProvider';
import { PremiumModal } from '../premium/PremiumModal';
import { PremiumApi } from '../premium/PremiumApi';

const schema = z.object({
  minAge: z.number().int().min(18).max(120),
  maxAge: z.number().int().min(18).max(120),
  desiredGenders: z.array(z.string()).min(1).max(3),
  radiusKm: z.number().refine(n => [10, 25, 50, 100].includes(n)),
  mode: z.enum(['city', 'all', 'distance', 'global', 'country']),
  city: z.string().trim().min(2).max(80),
}).refine(v => v.minAge <= v.maxAge, {
  message: 'min_age_exceeds_max',
  path: ['minAge'],
});

const GENDER_OPTIONS = [
  { key: 'woman', emoji: '👩', titleKey: 'filters_opt_woman_title', subKey: 'filters_opt_woman_sub' },
  { key: 'man', emoji: '👨', titleKey: 'filters_opt_man_title', subKey: 'filters_opt_man_sub' },
  { key: 'nonbinary', emoji: '👥', titleKey: 'filters_opt_nonbinary_title', subKey: 'filters_opt_nonbinary_sub' },
] as const;

const AGE_PRESETS = [
  { label: '18–25', min: 18, max: 25 },
  { label: '20–30', min: 20, max: 30 },
  { label: '25–35', min: 25, max: 35 },
  { label: '30–45', min: 30, max: 45 },
  { label: '18–55+', min: 18, max: 55 },
] as const;

export function Filters({
  settings,
  api,
  saved,
  onClose,
}: {
  settings: Settings;
  api: DiscoveryApi;
  saved: (s: Settings) => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const { state: authState, api: authApi, manager } = useAuth();
  const premiumApi = useMemo(() => new PremiumApi(authApi, manager), [authApi, manager]);
  const premiumQuery = useQuery({
    queryKey: ['account', authState.account?.id, 'premium-status'],
    queryFn: async () => {
      try {
        if (!premiumApi) return { hasPremium: false };
        const res = await premiumApi.status();
        return res ?? { hasPremium: false };
      } catch {
        return { hasPremium: false };
      }
    },
    enabled: !!authState.account?.id && !!premiumApi,
    staleTime: 60_000,
  });
  const hasPremium = Boolean(premiumQuery.data?.hasPremium);

  type SearchScope = 'local' | 'global' | 'country';
  const [scope, setScope] = useState<SearchScope>(() => {
    if (settings.mode === 'global') return 'global';
    if (settings.mode === 'country') return 'country';
    return 'local';
  });

  const initialMode = (
    settings.mode === 'global'
      ? 'global'
      : settings.mode === 'country'
      ? 'country'
      : settings.mode === 'all'
      ? 'all'
      : 'city'
  ) as 'city' | 'all' | 'distance' | 'global' | 'country';

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      minAge: Number(settings.minAge),
      maxAge: Number(settings.maxAge),
      desiredGenders: settings.desiredGenders,
      radiusKm: Number(settings.radiusKm) || 25,
      mode: initialMode,
      city: settings.city || 'თბილისი',
    },
  });

  const minAge = watch('minAge');
  const maxAge = watch('maxAge');
  const desiredGenders = watch('desiredGenders') ?? [];
  const mode = watch('mode');

  const submit = handleSubmit(async values => {
    setMessage('');
    try {
      triggerHaptic('medium');
      if (values.mode === 'country' && !hasPremium) {
        setPremiumModalVisible(true);
        return;
      }
      const updated = await api.save({
        ...values,
        radiusKm: values.radiusKm || 25,
        city: values.city.trim() || settings.city || 'თბილისი',
        revision: settings.revision,
      });
      saved(updated);
      if (onClose) onClose();
    } catch (error) {
      triggerHaptic('heavy');
      setMessage(
        error instanceof ApiError && error.status === 429
          ? 'discovery_rate_limited'
          : error instanceof ApiError && error.status === 403
          ? 'premium_required'
          : 'discovery_save_failed'
      );
    }
  });

  // Calculate percentage of age range bar
  const minPercent = Math.max(0, Math.min(100, ((minAge - 18) / (60 - 18)) * 100));
  const maxPercent = Math.max(0, Math.min(100, ((maxAge - 18) / (60 - 18)) * 100));
  const barWidth = Math.max(4, maxPercent - minPercent);

  return (
    <View style={styles.container}>
      {/* SECTION 1: ვინ გაინტერესებს (Show Me) */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            👥 {t('filters_show_me', 'ვინ გაინტერესებს')}
          </Text>
          <Text style={styles.sectionHeaderBadge}>
            {desiredGenders.length === 3
              ? t('filters_everyone', 'ყველა')
              : t('filters_selected_count', { count: desiredGenders.length, defaultValue: `${desiredGenders.length} არჩეული` })}
          </Text>
        </View>

        <Controller
          control={control}
          name="desiredGenders"
          render={({ field }) => (
            <View style={styles.cardGroup}>
              {GENDER_OPTIONS.map((opt, idx) => {
                const isSelected = field.value.includes(opt.key);
                const isLast = idx === GENDER_OPTIONS.length - 1;

                const handleToggle = () => {
                  triggerHaptic('light');
                  if (isSelected) {
                    if (field.value.length <= 1) return;
                    field.onChange(field.value.filter(v => v !== opt.key));
                  } else {
                    field.onChange([...field.value, opt.key]);
                  }
                };

                return (
                  <View key={opt.key}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={t(opt.titleKey)}
                      onPress={handleToggle}
                      style={({ pressed }) => [
                        styles.genderRow,
                        isSelected && styles.genderRowActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={styles.genderIconCircle}>
                        <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                      </View>

                      <View style={styles.genderTextCol}>
                        <Text style={[styles.genderTitle, isSelected && styles.genderTitleActive]}>
                          {t(opt.titleKey)}
                        </Text>
                        <Text style={styles.genderSubtitle}>
                          {t(opt.subKey)}
                        </Text>
                      </View>

                      <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                        {isSelected && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                    </Pressable>
                    {!isLast && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>
          )}
        />
      </View>

      {/* SECTION 2: ასაკობრივი დიაპაზონი (Age Preference) */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            🎂 {t('filters_age_range', 'ასაკობრივი დიაპაზონი')}
          </Text>
          <View style={styles.ageBadge}>
            <Text style={styles.ageBadgeText}>
              {minAge} – {maxAge} {t('filters_years', 'წელი')}
            </Text>
          </View>
        </View>

        <View style={styles.cardGroup}>
          {/* Visual Range Bar (Tinder Track) */}
          <View style={styles.sliderTrackContainer}>
            <View style={styles.sliderTrackBackground}>
              <View
                style={[
                  styles.sliderTrackActive,
                  {
                    left: `${minPercent}%`,
                    width: `${barWidth}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Stepper Controls Row */}
          <View style={styles.steppersRow}>
            {/* Min Age Box */}
            <View style={styles.stepperBox}>
              <Text style={styles.stepperBoxLabel}>
                {t('filters_min_age', 'მინიმალური ასაკი')}
              </Text>
              <Text style={styles.stepperBoxValue}>{minAge}</Text>
              <View style={styles.stepperButtonsRow}>
                <Pressable
                  disabled={minAge <= 18}
                  onPress={() => {
                    if (minAge > 18) {
                      triggerHaptic('light');
                      setValue('minAge', minAge - 1);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    minAge <= 18 && styles.stepperBtnDisabled,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.stepperBtnText, minAge <= 18 && styles.stepperBtnTextDisabled]}>–</Text>
                </Pressable>

                <Pressable
                  disabled={minAge >= maxAge}
                  onPress={() => {
                    if (minAge < maxAge) {
                      triggerHaptic('light');
                      setValue('minAge', minAge + 1);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    minAge >= maxAge && styles.stepperBtnDisabled,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.stepperBtnText, minAge >= maxAge && styles.stepperBtnTextDisabled]}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.stepperBoxSeparator}>
              <Text style={styles.stepperSeparatorText}>–</Text>
            </View>

            {/* Max Age Box */}
            <View style={styles.stepperBox}>
              <Text style={styles.stepperBoxLabel}>
                {t('filters_max_age', 'მაქსიმალური ასაკი')}
              </Text>
              <Text style={styles.stepperBoxValue}>{maxAge}</Text>
              <View style={styles.stepperButtonsRow}>
                <Pressable
                  disabled={maxAge <= minAge}
                  onPress={() => {
                    if (maxAge > minAge) {
                      triggerHaptic('light');
                      setValue('maxAge', maxAge - 1);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    maxAge <= minAge && styles.stepperBtnDisabled,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.stepperBtnText, maxAge <= minAge && styles.stepperBtnTextDisabled]}>–</Text>
                </Pressable>

                <Pressable
                  disabled={maxAge >= 99}
                  onPress={() => {
                    if (maxAge < 99) {
                      triggerHaptic('light');
                      setValue('maxAge', maxAge + 1);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    maxAge >= 99 && styles.stepperBtnDisabled,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.stepperBtnText, maxAge >= 99 && styles.stepperBtnTextDisabled]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Quick Presets Row */}
          <View style={styles.presetsWrap}>
            <Text style={styles.presetsLabel}>
              {t('filters_quick_presets', 'სწრაფი არჩევანი:')}
            </Text>
            <View style={styles.presetPillsRow}>
              {AGE_PRESETS.map(p => {
                const isPresetActive = minAge === p.min && maxAge === p.max;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => {
                      triggerHaptic('light');
                      setValue('minAge', p.min);
                      setValue('maxAge', p.max);
                    }}
                    style={({ pressed }) => [
                      styles.presetPill,
                      isPresetActive && styles.presetPillActive,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={[styles.presetPillText, isPresetActive && styles.presetPillTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 3: ლოკაცია და რეჟიმი (Location & Search Mode) */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            📍 {t('filters_location_and_mode', 'ლოკაცია და ძიების არეალი')}
          </Text>
        </View>

        <View style={styles.cardGroup}>
          {/* Main 3 Scope Selector */}
          <View style={styles.scopeTabsContainer}>
            {/* Tab 1: 🇬🇪 ლოკალურად */}
            <Pressable
              testID="scope-tab-local"
              onPress={() => {
                triggerHaptic('light');
                setScope('local');
                if (mode === 'global' || mode === 'country') {
                  setValue('mode', 'all');
                  setValue('city', 'საქართველო');
                }
              }}
              style={[styles.scopeTab, scope === 'local' && styles.scopeTabActive]}
            >
              <Text style={[styles.scopeTabText, scope === 'local' && styles.scopeTabTextActive]}>
                🇬🇪 {t('filters_scope_local', 'ლოკალურად')}
              </Text>
              <Text style={[styles.scopeTabSub, scope === 'local' && styles.scopeTabSubActive]}>
                {t('filters_scope_local_sub', 'საქართველო')}
              </Text>
            </Pressable>

            {/* Tab 2: 🌐 გლობალურად */}
            <Pressable
              testID="scope-tab-global"
              onPress={() => {
                triggerHaptic('light');
                setScope('global');
                setValue('mode', 'global');
              }}
              style={[styles.scopeTab, scope === 'global' && styles.scopeTabActive]}
            >
              <Text style={[styles.scopeTabText, scope === 'global' && styles.scopeTabTextActive]}>
                🌐 {t('filters_scope_global', 'გლობალურად')}
              </Text>
              <Text style={[styles.scopeTabSub, scope === 'global' && styles.scopeTabSubActive]}>
                {t('filters_scope_global_sub', 'მსოფლიო')}
              </Text>
            </Pressable>

            {/* Tab 3: 👑 კონკრეტული ქვეყანა */}
            <Pressable
              testID="scope-tab-country"
              onPress={() => {
                if (!hasPremium) {
                  triggerHaptic('heavy');
                  setPremiumModalVisible(true);
                } else {
                  triggerHaptic('light');
                  setScope('country');
                  setValue('mode', 'country');
                  const currentCity = watch('city');
                  if (!currentCity || currentCity === 'თბილისი' || currentCity === 'საქართველო') {
                    setValue('city', 'აშშ');
                  }
                }
              }}
              style={[
                styles.scopeTab,
                scope === 'country' && styles.scopeTabActive,
                !hasPremium && styles.scopeTabVipBorder,
              ]}
            >
              <View style={styles.scopeTabHeader}>
                <Text style={[styles.scopeTabText, scope === 'country' && styles.scopeTabTextActive]}>
                  👑 {t('filters_scope_country', 'ქვეყანა')}
                </Text>
                {!hasPremium && (
                  <View style={styles.vipBadgeSmall}>
                    <Text style={styles.vipBadgeSmallText}>VIP</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.scopeTabSub, scope === 'country' && styles.scopeTabSubActive]}>
                {t('filters_scope_country_sub', 'Passport')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.rowDivider} />

          {/* Sub-content based on scope */}
          {scope === 'local' && (
            <View style={styles.localSubContainer}>
              <View style={styles.modeTabsRow}>
                <Pressable
                  testID="mode-tab-all"
                  onPress={() => {
                    triggerHaptic('light');
                    setValue('mode', 'all');
                    setValue('city', 'საქართველო');
                  }}
                  style={[styles.modeTab, mode === 'all' && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabText, mode === 'all' && styles.modeTabTextActive]}>
                    🇬🇪 {t('filters_mode_all', 'მთელი საქართველო')}
                  </Text>
                </Pressable>

                <Pressable
                  testID="mode-tab-city"
                  onPress={() => {
                    triggerHaptic('light');
                    setValue('mode', 'city');
                    if (watch('city') === 'საქართველო') {
                      setValue('city', 'თბილისი');
                    }
                  }}
                  style={[styles.modeTab, mode === 'city' && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabText, mode === 'city' && styles.modeTabTextActive]}>
                    🏙️ {t('filters_mode_by_city', 'ქალაქის მიხედვით')}
                  </Text>
                </Pressable>
              </View>

              {mode === 'city' ? (
                <View style={{ marginTop: 12 }}>
                  <Controller
                    control={control}
                    name="city"
                    render={({ field }) => (
                      <CityPicker
                        testID="discovery-city"
                        label={t('filters_city_label', 'ქალაქი')}
                        value={field.value}
                        onChange={field.onChange}
                        showGpsButton={false}
                        error={errors.city?.message}
                      />
                    )}
                  />
                </View>
              ) : (
                <View style={[styles.allCitiesBanner, { marginTop: 12 }]}>
                  <Text style={styles.allCitiesEmoji}>🇬🇪</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allCitiesTitle}>
                      {t('filters_all_cities_title', 'მთელი საქართველო')}
                    </Text>
                    <Text style={styles.allCitiesSubtitle}>
                      {t('filters_all_cities_subtitle', 'სვაიპში ნაჩვენები იქნება პროფილები საქართველოს ყველა ქალაქიდან')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {scope === 'global' && (
            <View style={styles.globalCard}>
              <View style={styles.globalCardHeader}>
                <Text style={styles.globalCardEmoji}>🌐</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.globalCardTitle}>
                      {t('filters_global_mode_title', 'გლობალური სვაიპი (მსოფლიო)')}
                    </Text>
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>უფასო</Text>
                    </View>
                  </View>
                  <Text style={styles.globalCardSubtitle}>
                    {t(
                      'filters_global_mode_desc',
                      'სვაიპის დროს შეგხვდებათ ადამიანები მსოფლიოს ნებისმიერი ქვეყნიდან — საქართველო, ევროპა, აშშ და სხვა.'
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.globalFeaturesRow}>
                <View style={styles.globalFeaturePill}>
                  <Text style={styles.globalFeatureText}>✨ ულიმიტო არეალი</Text>
                </View>
                <View style={styles.globalFeaturePill}>
                  <Text style={styles.globalFeatureText}>🌍 ყველა ქვეყანა</Text>
                </View>
              </View>
            </View>
          )}

          {scope === 'country' && (
            hasPremium ? (
              <View style={styles.countryContainer}>
                <View style={styles.passportActiveBanner}>
                  <Text style={styles.passportActiveEmoji}>✈️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passportActiveTitle}>
                      👑 ARENA BLACK Passport
                    </Text>
                    <Text style={styles.passportActiveSub}>
                      {t('filters_passport_active_sub', 'არჩეული ქვეყნის პროფილები გამოჩნდება სვაიპში')}
                    </Text>
                  </View>
                </View>

                <Controller
                  control={control}
                  name="city"
                  render={({ field }) => (
                    <CountryPicker
                      testID="discovery-country"
                      value={field.value}
                      onChange={(countryLabel) => {
                        field.onChange(countryLabel);
                      }}
                    />
                  )}
                />
              </View>
            ) : (
              <View style={styles.vipLockedCard}>
                <View style={styles.vipLockedHeader}>
                  <Text style={styles.vipCrownIcon}>👑</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.vipLockedTitle}>ARENA BLACK Passport</Text>
                      <View style={styles.vipBadge}>
                        <Text style={styles.vipBadgeText}>VIP</Text>
                      </View>
                    </View>
                    <Text style={styles.vipLockedSub}>
                      {t('filters_country_vip_title', 'კონკრეტული ქვეყნის არჩევა')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.vipLockedDesc}>
                  {t(
                    'filters_country_vip_desc',
                    'კონკრეტული ქვეყნის არჩევა და იქ სვაიპი ხელმისაწვდომია მხოლოდ ARENA BLACK პრემიუმ წევრებისთვის.'
                  )}
                </Text>

                <Pressable
                  testID="vip-upgrade-trigger"
                  style={styles.vipUpgradeBtn}
                  onPress={() => {
                    triggerHaptic('medium');
                    setPremiumModalVisible(true);
                  }}
                >
                  <Text style={styles.vipUpgradeBtnText}>👑 ARENA BLACK ჩართვა</Text>
                </Pressable>
              </View>
            )
          )}
        </View>
      </View>

      {/* Validation Errors & Alerts */}
      {Object.keys(errors).length > 0 && (
        <View style={styles.errorBanner}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            ⚠️ {t('profile_invalid', 'გთხოვთ შეამოწმოთ მითითებული პარამეტრები')}
          </Text>
        </View>
      )}

      {!!message && (
        <View style={styles.errorBanner}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {t(message)}
          </Text>
        </View>
      )}

      {/* Bottom Save & Apply Button */}
      <Pressable
        disabled={isSubmitting}
        onPress={() => { void submit(); }}
        style={({ pressed }) => [
          styles.submitBtn,
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          isSubmitting && { opacity: 0.7 },
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.onPrimary} size="small" />
        ) : (
          <Text style={styles.submitBtnText}>
            ✓ {t('filters_save_btn', 'პარამეტრების შენახვა')}
          </Text>
        )}
      </Pressable>

      <PremiumModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingBottom: 24,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeaderBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  cardGroup: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 14,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  genderRowActive: {
    backgroundColor: theme.colors.soft,
  },
  genderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  genderEmoji: {
    fontSize: 20,
  },
  genderTextCol: {
    flex: 1,
    gap: 2,
  },
  genderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  genderTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  genderSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  ageBadge: {
    backgroundColor: theme.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ageBadgeText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  sliderTrackContainer: {
    paddingVertical: 6,
  },
  sliderTrackBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.soft,
    position: 'relative',
    overflow: 'hidden',
  },
  sliderTrackActive: {
    position: 'absolute',
    height: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  steppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperBox: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  stepperBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.muted,
    textTransform: 'uppercase',
  },
  stepperBoxValue: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  stepperButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
    borderColor: 'transparent',
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  stepperBtnTextDisabled: {
    color: theme.colors.muted,
  },
  stepperBoxSeparator: {
    paddingHorizontal: 4,
  },
  stepperSeparatorText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  presetsWrap: {
    gap: 8,
    marginTop: 4,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetPill: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  presetPillActive: {
    backgroundColor: theme.colors.soft,
    borderColor: theme.colors.primary,
  },
  presetPillText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  presetPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modeSection: {
    gap: 8,
  },
  modeSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: theme.colors.primary,
  },
  modeTabDisabled: {
    opacity: 0.4,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  modeTabTextActive: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
  },
  modeTabTextDisabled: {
    color: theme.colors.muted,
  },
  radiusContainer: {
    gap: 8,
    paddingTop: 4,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  radiusValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  radiusPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  radiusPillActive: {
    backgroundColor: theme.colors.soft,
    borderColor: theme.colors.primary,
  },
  radiusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  radiusPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  allCitiesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  allCitiesEmoji: {
    fontSize: 28,
  },
  allCitiesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  allCitiesSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  // New Scope & Country / Global styles
  scopeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scopeTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeTabActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  scopeTabVipBorder: {
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  scopeTabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scopeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  scopeTabTextActive: {
    color: theme.colors.onPrimary,
    fontWeight: '800',
  },
  scopeTabSub: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 2,
  },
  scopeTabSubActive: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  vipBadgeSmall: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  vipBadgeSmallText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000000',
  },
  localSubContainer: {
    gap: 4,
  },
  globalCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    gap: 12,
  },
  globalCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  globalCardEmoji: {
    fontSize: 28,
  },
  globalCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  globalCardSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    lineHeight: 17,
  },
  freeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  globalFeaturesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  globalFeaturePill: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  globalFeatureText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
  countryContainer: {
    gap: 12,
  },
  passportActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  passportActiveEmoji: {
    fontSize: 24,
  },
  passportActiveTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  passportActiveSub: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  vipLockedCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    gap: 12,
  },
  vipLockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vipCrownIcon: {
    fontSize: 28,
  },
  vipLockedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.3,
  },
  vipLockedSub: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  vipBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  vipLockedDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 17,
  },
  vipUpgradeBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  vipUpgradeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});
