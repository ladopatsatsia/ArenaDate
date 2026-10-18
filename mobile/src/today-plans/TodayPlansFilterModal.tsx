import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Button } from '../components/UI';
import { POPULAR_CITIES, formatCityName } from '../components/cities';
import { CalendarPicker } from '../components/CalendarPicker';
import { TODAY_PLAN_ACTIVITIES, formatCustomDateDisplay, getQuickPresetDates } from './utils';

export type DayFilter = 'all' | 'today' | 'tomorrow' | 'after_tomorrow' | string;

interface TodayPlansFilterModalProps {
  visible: boolean;
  onClose: () => void;
  city: string;
  activity: string;
  day: DayFilter;
  onApply: (filters: { city: string; activity: string; day: DayFilter }) => void;
  onReset: () => void;
}

export function TodayPlansFilterModal({
  visible,
  onClose,
  city,
  activity,
  day,
  onApply,
  onReset,
}: TodayPlansFilterModalProps) {
  const { t, i18n } = useTranslation();

  const [tempCity, setTempCity] = useState(city);
  const [tempActivity, setTempActivity] = useState(activity);
  const [tempDay, setTempDay] = useState<DayFilter>(day);
  const [showCalendar, setShowCalendar] = useState(false);
  const presetDates = useMemo(() => getQuickPresetDates(i18n.language), [i18n.language]);

  useEffect(() => {
    if (visible) {
      setTempCity(city);
      setTempActivity(activity);
      setTempDay(day);
      setShowCalendar(false);
    }
  }, [visible, city, activity, day]);

  const activeFiltersCount =
    (tempCity !== 'all' ? 1 : 0) +
    (tempActivity !== 'all' ? 1 : 0) +
    (tempDay !== 'all' ? 1 : 0);

  const handleApply = () => {
    onApply({
      city: tempCity,
      activity: tempActivity,
      day: tempDay,
    });
    onClose();
  };

  const handleReset = () => {
    setTempCity('all');
    setTempActivity('all');
    setTempDay('all');
    setShowCalendar(false);
    onReset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('today_plans_close')}
        />
        <View style={styles.modalContent} testID="today-plans-filter-modal-content">
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWithBadge}>
              <Text style={styles.modalTitle}>
                🔍 {t('today_plans_filters_title')}
              </Text>
              {activeFiltersCount > 0 && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('today_plans_close')}
              testID="close-filter-modal-btn"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. City Filter */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                📍 {t('today_plans_filter_city_title')}
              </Text>
              <View style={styles.chipsGrid}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    tempCity === 'all' && styles.chipSelected,
                  ]}
                  onPress={() => setTempCity('all')}
                  activeOpacity={0.7}
                  testID="filter-city-all"
                >
                  <Text
                    style={[
                      styles.chipText,
                      tempCity === 'all' && styles.chipTextSelected,
                    ]}
                  >
                    {t('today_plans_filter_all_cities')}
                  </Text>
                </TouchableOpacity>
                {POPULAR_CITIES.map(c => {
                  const isSelected = tempCity === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setTempCity(isSelected ? 'all' : c.key)}
                      activeOpacity={0.7}
                      testID={`filter-city-${c.key}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {formatCityName(c.key, i18n.language)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Activity Filter */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                🎯 {t('today_plans_filter_activity_title')}
              </Text>
              <View style={styles.chipsGrid}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    tempActivity === 'all' && styles.chipSelected,
                  ]}
                  onPress={() => setTempActivity('all')}
                  activeOpacity={0.7}
                  testID="filter-activity-all"
                >
                  <Text
                    style={[
                      styles.chipText,
                      tempActivity === 'all' && styles.chipTextSelected,
                    ]}
                  >
                    {t('today_plans_filter_activity_any')}
                  </Text>
                </TouchableOpacity>
                {TODAY_PLAN_ACTIVITIES.map(act => {
                  const isSelected = tempActivity === act.key;
                  return (
                    <TouchableOpacity
                      key={act.key}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setTempActivity(isSelected ? 'all' : act.key)}
                      activeOpacity={0.7}
                      testID={`filter-activity-${act.key}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {act.icon} {t(act.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Day / Period Filter */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                📅 {t('today_plans_filter_day_title')}
              </Text>
              <View style={styles.chipsGrid}>
                <TouchableOpacity
                  style={[styles.chip, tempDay === 'all' && styles.chipSelected]}
                  onPress={() => setTempDay('all')}
                  activeOpacity={0.7}
                  testID="filter-day-all"
                >
                  <Text
                    style={[
                      styles.chipText,
                      tempDay === 'all' && styles.chipTextSelected,
                    ]}
                  >
                    {t('today_plans_filter_day_any')}
                  </Text>
                </TouchableOpacity>
                {(
                  [
                    {
                      key: 'today',
                      label: `${t('today_plans_day_today')} (${presetDates.today.shortDisplay})`,
                    },
                    {
                      key: 'tomorrow',
                      label: `${t('today_plans_day_tomorrow')} (${presetDates.tomorrow.shortDisplay})`,
                    },
                    {
                      key: 'after_tomorrow',
                      label: `${t('today_plans_day_after_tomorrow')} (${presetDates.afterTomorrow.shortDisplay})`,
                    },
                  ] as const
                ).map(d => {
                  const isSelected = tempDay === d.key;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => {
                        setShowCalendar(false);
                        setTempDay(isSelected ? 'all' : d.key);
                      }}
                      activeOpacity={0.7}
                      testID={`filter-day-${d.key}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Date Chip */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    tempDay !== 'all' &&
                      tempDay !== 'today' &&
                      tempDay !== 'tomorrow' &&
                      tempDay !== 'after_tomorrow' &&
                      styles.chipSelected,
                  ]}
                  onPress={() => setShowCalendar(v => !v)}
                  activeOpacity={0.7}
                  testID="filter-day-custom"
                >
                  <Text
                    style={[
                      styles.chipText,
                      tempDay !== 'all' &&
                        tempDay !== 'today' &&
                        tempDay !== 'tomorrow' &&
                        tempDay !== 'after_tomorrow' &&
                        styles.chipTextSelected,
                    ]}
                  >
                    {tempDay !== 'all' &&
                    tempDay !== 'today' &&
                    tempDay !== 'tomorrow' &&
                    tempDay !== 'after_tomorrow'
                      ? `📅 ${formatCustomDateDisplay(tempDay, i18n.language)}`
                      : `📅 ${t('today_plans_pick_date', 'თარიღი')}`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline CalendarPicker */}
              {showCalendar && (
                <View style={{ marginTop: 10 }}>
                  <CalendarPicker
                    selectedDate={
                      tempDay !== 'all' &&
                      tempDay !== 'today' &&
                      tempDay !== 'tomorrow' &&
                      tempDay !== 'after_tomorrow'
                        ? tempDay
                        : null
                    }
                    onSelectDate={(dateStr) => {
                      setTempDay(dateStr);
                      setShowCalendar(false);
                    }}
                    testID="filter-calendar-picker"
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Button
              variant="secondary"
              title={t('today_plans_filters_clear_btn')}
              onPress={handleReset}
              style={styles.clearBtn}
              testID="filter-reset-btn"
            />
            <Button
              variant="primary"
              title={t('today_plans_filters_apply_btn')}
              onPress={handleApply}
              style={styles.applyBtn}
              testID="filter-apply-btn"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    maxHeight: '85%',
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space.md,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  activeBadge: {
    backgroundColor: theme.colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadgeText: {
    color: theme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeBtnText: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: theme.space.md,
    gap: theme.space.lg,
  },
  sectionBlock: {
    gap: theme.space.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.space.md,
    marginTop: theme.space.md,
  },
  clearBtn: {
    flex: 1,
  },
  applyBtn: {
    flex: 2,
  },
});
