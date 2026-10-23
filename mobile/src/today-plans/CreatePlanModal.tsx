import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Button, TextInput } from '../components/UI';
import { CITIES, POPULAR_CITIES, formatCityName, type CityItem } from '../components/cities';
import { CalendarPicker } from '../components/CalendarPicker';
import {
  TODAY_PLAN_ACTIVITIES,
  computeQuickTimePreset,
  formatCustomDateDisplay,
  getQuickPresetDates,
} from './utils';
import type { CreateTodayPlanRequest } from './api';

interface CreatePlanModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (request: CreateTodayPlanRequest) => Promise<void>;
  onOpenPremium?: () => void;
  defaultCity?: string;
  isSubmitting?: boolean;
}

export function CreatePlanModal({
  visible,
  onClose,
  onSubmit,
  onOpenPremium,
  defaultCity = 'tbilisi',
  isSubmitting = false,
}: CreatePlanModalProps) {
  const { t, i18n } = useTranslation();
  const presetDates = useMemo(() => getQuickPresetDates(i18n.language), [i18n.language]);

  const [activity, setActivity] = useState<string>('coffee');
  const [city, setCity] = useState<string>(defaultCity || 'tbilisi');
  const [citySearch, setCitySearch] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [timePreset, setTimePreset] = useState<
    'today_evening' | 'now' | 'tomorrow' | 'after_tomorrow' | 'custom_date'
  >('today_evening');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [targetParticipantsCount, setTargetParticipantsCount] = useState<number>(1);
  const [budget, setBudget] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setActivity('coffee');
    setCity(defaultCity || 'tbilisi');
    setDistrict('');
    setTitle('');
    setDescription('');
    setTimePreset('today_evening');
    setCustomDate(null);
    setBudget('');
    setTargetParticipantsCount(1);
    setCitySearch('');
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2 || cleanTitle.length > 100) {
      setErrorMessage(t('today_plans_form_validation_title'));
      return;
    }
    if (!city.trim()) {
      setErrorMessage(t('today_plans_form_validation_city'));
      return;
    }

    const { startsAtUtc, expiresAtUtc } = computeQuickTimePreset(timePreset, undefined, customDate);
    const budgetAmount = budget.trim() ? parseFloat(budget.trim()) : null;

    const request: CreateTodayPlanRequest = {
      city: city.trim(),
      district: district.trim() ? district.trim() : null,
      activity,
      title: cleanTitle,
      description: description.trim() ? description.trim() : null,
      startsAtUtc,
      expiresAtUtc,
      budgetAmount: budgetAmount && !isNaN(budgetAmount) ? budgetAmount : null,
      targetParticipantsCount,
    };

    try {
      await onSubmit(request);
      handleClose();
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
      if (msg.includes('active_plan_limit_reached') || msg.includes('400')) {
        setErrorMessage(t('today_plans_limit_reached_plan_body', { limit: 1 }));
      } else {
        setErrorMessage(t('today_plans_load_error'));
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t('today_plans_create_title')}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('today_plans_close')}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {errorMessage.includes(t('today_plans_limit_reached_plan_title')) ||
                errorMessage.includes('Premium') || errorMessage.includes('ARENA') ? (
                  <TouchableOpacity
                    style={styles.premiumBannerBtn}
                    onPress={() => {
                      handleClose();
                      onOpenPremium?.();
                    }}
                  >
                    <Text style={styles.premiumBannerBtnText}>
                      {t('today_plans_upgrade_premium')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Activity Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('today_plans_form_activity')}</Text>
              <View style={styles.activityGrid}>
                {TODAY_PLAN_ACTIVITIES.map(item => {
                  const selected = activity === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.activityChip,
                        selected && styles.activityChipSelected,
                      ]}
                      onPress={() => setActivity(item.key)}
                      activeOpacity={0.7}
                      testID={`activity-select-${item.key}`}
                    >
                      <Text style={styles.activityChipIcon}>{item.icon}</Text>
                      <Text
                        style={[
                          styles.activityChipText,
                          selected && styles.activityChipTextSelected,
                        ]}
                      >
                        {t(item.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Title Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('today_plans_form_title')}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('today_plans_form_title_placeholder')}
                maxLength={100}
                style={styles.input}
                testID="plan-title-input"
              />
            </View>

            {/* City Selection */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('today_plans_form_city')}</Text>
                <Text style={styles.selectedCityBadge}>✓ {formatCityName(city, i18n.language)}</Text>
              </View>

              {/* Major Cities Quick Chips */}
              <View style={styles.majorCitiesRow}>
                {POPULAR_CITIES.slice(0, 4).map(c => {
                  const selected = city.toLowerCase() === c.key.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.cityChip, selected && styles.cityChipSelected]}
                      onPress={() => {
                        setCity(c.key);
                        setCitySearch('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.cityChipText,
                          selected && styles.cityChipTextSelected,
                        ]}
                      >
                        {formatCityName(c.key, i18n.language)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* City Search Field */}
              <TextInput
                value={citySearch}
                onChangeText={setCitySearch}
                placeholder="🔍 მოძებნე საქართველოს ქალაქი..."
                style={styles.citySearchInput}
                testID="plan-city-search-input"
              />

              {/* City Search Results */}
              {citySearch.trim().length > 0 && (
                <View style={styles.citySearchResultsContainer}>
                  {CITIES.filter((c: CityItem) =>
                    c.labelKa.toLowerCase().includes(citySearch.toLowerCase()) ||
                    c.labelEn.toLowerCase().includes(citySearch.toLowerCase()) ||
                    c.key.toLowerCase().includes(citySearch.toLowerCase())
                  ).slice(0, 8).map((c: CityItem) => (
                    <TouchableOpacity
                      key={c.key}
                      style={styles.citySearchResultItem}
                      onPress={() => {
                        setCity(c.key);
                        setCitySearch('');
                      }}
                    >
                      <Text style={styles.citySearchResultText}>
                        📍 {formatCityName(c.key, i18n.language)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* District Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('today_plans_form_district')}</Text>
              <TextInput
                value={district}
                onChangeText={setDistrict}
                placeholder={t('today_plans_form_district_placeholder')}
                maxLength={60}
                style={styles.input}
                testID="plan-district-input"
              />
            </View>

            {/* When / Start Time Presets */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('today_plans_form_when', 'როდის?')}</Text>
                <Text style={styles.fieldHint}>{t('today_plans_time_agreement_hint', 'საათზე შეთანხმდებით ჩატში')}</Text>
              </View>
              <View style={styles.whenGrid}>
                {[
                  { key: 'now', label: t('today_plans_form_today_now', 'ახლავე') },
                  {
                    key: 'today_evening',
                    label: `${t('today_plans_day_today', 'დღეს')} (${presetDates.today.shortDisplay})`,
                  },
                  {
                    key: 'tomorrow',
                    label: `${t('today_plans_form_tomorrow', 'ხვალ')} (${presetDates.tomorrow.shortDisplay})`,
                  },
                  {
                    key: 'after_tomorrow',
                    label: `${t('today_plans_day_after_tomorrow', 'ზეგ')} (${presetDates.afterTomorrow.shortDisplay})`,
                  },
                  {
                    key: 'custom_date',
                    label: customDate && timePreset === 'custom_date'
                      ? `📅 ${formatCustomDateDisplay(customDate, i18n.language)}`
                      : `📅 ${t('today_plans_pick_date', 'თარიღის არჩევა')}`,
                  },
                ].map(item => {
                  const selected = timePreset === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.whenChip, selected && styles.whenChipSelected]}
                      onPress={() => {
                        setTimePreset(item.key as typeof timePreset);
                        if (item.key === 'now' || item.key === 'today_evening') {
                          setCustomDate(presetDates.today.iso);
                        } else if (item.key === 'tomorrow') {
                          setCustomDate(presetDates.tomorrow.iso);
                        } else if (item.key === 'after_tomorrow') {
                          setCustomDate(presetDates.afterTomorrow.iso);
                        } else if (item.key === 'custom_date') {
                          if (!customDate) {
                            setCustomDate(presetDates.tomorrow.iso);
                          }
                        }
                      }}
                      activeOpacity={0.7}
                      testID={`when-preset-${item.key}`}
                    >
                      <Text
                        style={[
                          styles.whenChipText,
                          selected && styles.whenChipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected Scheduled Date Confirmation Banner */}
              <View style={styles.selectedDateBanner} testID="plan-scheduled-date-banner">
                <View style={styles.selectedDateBannerContent}>
                  <Text style={styles.selectedDateBannerIcon}>📅</Text>
                  <View style={styles.selectedDateBannerTextWrapper}>
                    <Text style={styles.selectedDateBannerLabel}>
                      {t('today_plans_scheduled_date_title', 'დაგეგმილი თარიღი:')}
                    </Text>
                    <Text style={styles.selectedDateBannerValue}>
                      {timePreset === 'now'
                        ? `${t('today_plans_form_today_now', 'ახლავე')} (${presetDates.today.fullDisplay})`
                        : timePreset === 'today_evening'
                        ? `${t('today_plans_day_today', 'დღეს')}, ${presetDates.today.fullDisplay}`
                        : timePreset === 'tomorrow'
                        ? `${t('today_plans_form_tomorrow', 'ხვალ')}, ${presetDates.tomorrow.fullDisplay}`
                        : timePreset === 'after_tomorrow'
                        ? `${t('today_plans_day_after_tomorrow', 'ზეგ')}, ${presetDates.afterTomorrow.fullDisplay}`
                        : customDate
                        ? formatCustomDateDisplay(customDate, i18n.language)
                        : t('today_plans_pick_date', 'თარიღის არჩევა')}
                    </Text>
                  </View>
                </View>
                {timePreset !== 'custom_date' && (
                  <TouchableOpacity
                    style={styles.openCalendarBtn}
                    onPress={() => {
                      setTimePreset('custom_date');
                      if (!customDate) setCustomDate(presetDates.tomorrow.iso);
                    }}
                    activeOpacity={0.7}
                    testID="open-calendar-from-banner"
                  >
                    <Text style={styles.openCalendarBtnText}>
                      {t('today_plans_calendar_open', 'კალენდარი 🗓️')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Inline Beautiful Calendar when custom_date is selected */}
              {timePreset === 'custom_date' && (
                <View style={styles.calendarContainer} testID="custom-date-calendar-container">
                  <View style={styles.calendarHeaderRow}>
                    <Text style={styles.calendarHeaderTitle}>
                      📅 {t('today_plans_choose_custom_date', 'აირჩიე სასურველი თარიღი:')}
                    </Text>
                    {customDate && (
                      <View style={styles.selectedDateBadge}>
                        <Text style={styles.selectedDateBadgeText}>
                          ✓ {formatCustomDateDisplay(customDate, i18n.language)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <CalendarPicker
                    selectedDate={customDate}
                    onSelectDate={(dateStr) => {
                      setCustomDate(dateStr);
                    }}
                    testID="plan-calendar-picker"
                  />
                </View>
              )}
            </View>

            {/* Participants Count */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {t('today_plans_participants_label', 'რამდენი ადამიანი გინდა შემოგიერთდეს?')}
              </Text>
              <View style={styles.participantsRow}>
                {[1, 2, 3, 4, 5].map(cnt => {
                  const selected = targetParticipantsCount === cnt;
                  return (
                    <TouchableOpacity
                      key={cnt}
                      style={[styles.participantChip, selected && styles.participantChipSelected]}
                      onPress={() => setTargetParticipantsCount(cnt)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.participantChipText,
                          selected && styles.participantChipTextSelected,
                        ]}
                      >
                        👤 {cnt === 5 ? '5+' : cnt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Budget Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('today_plans_form_budget')}</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                placeholder={t('today_plans_form_budget_placeholder')}
                keyboardType="numeric"
                maxLength={10}
                style={styles.input}
                testID="plan-budget-input"
              />
            </View>

            {/* Description Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('today_plans_form_description')}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('today_plans_form_description_placeholder')}
                multiline
                numberOfLines={3}
                maxLength={400}
                style={[styles.input, styles.textArea]}
                testID="plan-desc-input"
              />
            </View>

            {/* Submit Button */}
            <Button
              variant="primary"
              title={t('today_plans_form_submit')}
              onPress={handleSubmit}
              busy={isSubmitting}
              style={styles.submitBtn}
              testID="submit-create-plan-btn"
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: theme.colors.muted,
  },
  formScroll: {
    padding: theme.space.lg,
  },
  formContent: {
    gap: theme.space.md,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.control,
    padding: theme.space.md,
    gap: 8,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  premiumBannerBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.control,
    alignSelf: 'flex-start',
  },
  premiumBannerBtnText: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activityChipSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: theme.colors.primary,
  },
  activityChipIcon: {
    fontSize: 16,
  },
  activityChipText: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  activityChipTextSelected: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipsScroll: {
    gap: 8,
  },
  cityChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cityChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  cityChipText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  cityChipTextSelected: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
  },
  whenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  whenChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  whenChipSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: theme.colors.primary,
  },
  whenChipText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  whenChipTextSelected: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  selectedCityBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  majorCitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  citySearchInput: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: theme.colors.text,
  },
  citySearchResultsContainer: {
    marginTop: 6,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.control,
    overflow: 'hidden',
    maxHeight: 180,
  },
  citySearchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  citySearchResultText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  fieldHint: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  participantsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  participantChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.control,
  },
  participantChipSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: theme.colors.primary,
  },
  participantChipText: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  participantChipTextSelected: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: theme.space.md,
  },
  calendarContainer: {
    marginTop: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calendarHeaderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  selectedDateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  selectedDateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D8B4FE',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  selectedDateBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectedDateBannerIcon: {
    fontSize: 20,
  },
  selectedDateBannerTextWrapper: {
    flex: 1,
  },
  selectedDateBannerLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  selectedDateBannerValue: {
    fontSize: 14,
    color: '#DDD6FE',
    fontWeight: '700',
    marginTop: 2,
  },
  openCalendarBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openCalendarBtnText: {
    fontSize: 12,
    color: '#EDE9FE',
    fontWeight: '600',
  },
});
