import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from './theme';
import { triggerHaptic } from '../telegram/telegramSdk';

export interface CalendarPickerProps {
  selectedDate: string | null; // Format: 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
  minDate?: Date;
  maxDaysAhead?: number;
  lang?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const GEORGIAN_MONTHS = [
  'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
  'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი',
];

const WEEKDAYS_KA = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
const WEEKDAYS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function formatDateToIsoString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CalendarPicker({
  selectedDate,
  onSelectDate,
  minDate = new Date(),
  maxDaysAhead = 30,
  lang: propLang,
  style,
  testID = 'calendar-picker',
}: CalendarPickerProps) {
  const { i18n, t } = useTranslation();
  const lang = propLang || i18n.language || 'ka';

  const today = useMemo(() => {
    const d = minDate ? new Date(minDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minDate]);

  const todayIso = useMemo(() => formatDateToIsoString(today), [today]);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxDaysAhead);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [today, maxDaysAhead]);

  // Current viewing month & year
  const parsedParts = selectedDate ? selectedDate.split('-') : [];
  const initialYear = parsedParts[0] ? parseInt(parsedParts[0], 10) : today.getFullYear();
  const initialMonth = parsedParts[1] ? parseInt(parsedParts[1], 10) - 1 : today.getMonth();

  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth);

  // Weekday labels
  const weekdays = useMemo(() => {
    if (lang === 'en') return WEEKDAYS_EN;
    if (lang === 'ru') return WEEKDAYS_RU;
    return WEEKDAYS_KA;
  }, [lang]);

  // Month title display
  const monthTitle = useMemo(() => {
    if (lang === 'ka') {
      return `${GEORGIAN_MONTHS[currentMonth]} ${currentYear}`;
    }
    const d = new Date(currentYear, currentMonth, 1);
    const locale = lang === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  }, [currentMonth, currentYear, lang]);

  // Can we navigate back to previous month?
  const canGoPrev = useMemo(() => {
    const prevMonthDate = new Date(currentYear, currentMonth, 1);
    const minMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    return prevMonthDate.getTime() > minMonthDate.getTime();
  }, [currentYear, currentMonth, today]);

  // Can we navigate to next month?
  const canGoNext = useMemo(() => {
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const maxMonthDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    return nextMonthDate.getTime() <= maxMonthDate.getTime();
  }, [currentYear, currentMonth, maxDate]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    triggerHaptic('light');
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    triggerHaptic('light');
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  // Calendar days grid
  const daysInGrid = useMemo(() => {
    // Number of days in currentMonth
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Day of the week for the 1st day of month (0 = Sun, 1 = Mon ... 6 = Sat)
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    // Shift so Monday is index 0 (Mon = 0, Tue = 1, ... Sun = 6)
    const startOffset = (firstDayOfWeek + 6) % 7;

    const cells: Array<{
      dayNumber: number | null;
      isoString: string | null;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    // Empty leading cells
    for (let i = 0; i < startOffset; i++) {
      cells.push({
        dayNumber: null,
        isoString: null,
        isToday: false,
        isSelected: false,
        isDisabled: true,
      });
    }

    // Actual day cells
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const cellDate = new Date(currentYear, currentMonth, dayNum);
      cellDate.setHours(0, 0, 0, 0);

      const cellIso = formatDateToIsoString(cellDate);
      const isPast = cellDate.getTime() < today.getTime();
      const isTooFar = cellDate.getTime() > maxDate.getTime();
      const isToday = cellIso === todayIso;
      const isSelected = selectedDate === cellIso;

      cells.push({
        dayNumber: dayNum,
        isoString: cellIso,
        isToday,
        isSelected,
        isDisabled: isPast || isTooFar,
      });
    }

    return cells;
  }, [currentYear, currentMonth, today, maxDate, todayIso, selectedDate]);

  // Quick preset shortcuts
  const handleQuickAddDays = (days: number) => {
    triggerHaptic('light');
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const iso = formatDateToIsoString(target);
    setCurrentYear(target.getFullYear());
    setCurrentMonth(target.getMonth());
    onSelectDate(iso);
  };

  return (
    <View testID={testID} style={[styles.container, style]}>
      {/* Quick Shortcuts Bar */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          onPress={() => handleQuickAddDays(7)}
          style={[
            styles.shortcutPill,
            selectedDate === formatDateToIsoString(new Date(today.getTime() + 7 * 86400000)) &&
              styles.shortcutPillActive,
          ]}
          activeOpacity={0.7}
          testID="calendar-quick-1week"
        >
          <Text
            style={[
              styles.shortcutText,
              selectedDate === formatDateToIsoString(new Date(today.getTime() + 7 * 86400000)) &&
                styles.shortcutTextActive,
            ]}
          >
            🗓️ {t('calendar_plus_1week', '+1 კვირა (7 დღე)')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleQuickAddDays(14)}
          style={[
            styles.shortcutPill,
            selectedDate === formatDateToIsoString(new Date(today.getTime() + 14 * 86400000)) &&
              styles.shortcutPillActive,
          ]}
          activeOpacity={0.7}
          testID="calendar-quick-2weeks"
        >
          <Text
            style={[
              styles.shortcutText,
              selectedDate === formatDateToIsoString(new Date(today.getTime() + 14 * 86400000)) &&
                styles.shortcutTextActive,
            ]}
          >
            ✨ {t('calendar_plus_2weeks', '+2 კვირა (14 დღე)')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month & Year Navigation Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          disabled={!canGoPrev}
          onPress={handlePrevMonth}
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
          accessibilityLabel={t('previous_month', 'წინა თვე')}
          testID="calendar-prev-month"
        >
          <Text style={[styles.navBtnText, !canGoPrev && styles.navBtnTextDisabled]}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.monthTitleText}>{monthTitle}</Text>

        <TouchableOpacity
          disabled={!canGoNext}
          onPress={handleNextMonth}
          style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
          accessibilityLabel={t('next_month', 'შემდეგი თვე')}
          testID="calendar-next-month"
        >
          <Text style={[styles.navBtnText, !canGoNext && styles.navBtnTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Weekdays Row */}
      <View style={styles.weekdaysRow}>
        {weekdays.map((dayName, idx) => {
          const isWeekend = idx >= 5;
          return (
            <View key={dayName} style={styles.weekdayCell}>
              <Text style={[styles.weekdayText, isWeekend && styles.weekendText]}>
                {dayName}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Days Grid */}
      <View style={styles.gridContainer}>
        {daysInGrid.map((cell, idx) => {
          if (cell.dayNumber === null) {
            return <View key={`empty-${idx}`} style={styles.dayCell} />;
          }

          return (
            <TouchableOpacity
              key={cell.isoString || `day-${cell.dayNumber}`}
              disabled={cell.isDisabled}
              onPress={() => {
                if (cell.isoString) {
                  triggerHaptic('light');
                  onSelectDate(cell.isoString);
                }
              }}
              style={[
                styles.dayCell,
                cell.isToday && styles.todayCell,
                cell.isSelected && styles.selectedCell,
                cell.isDisabled && styles.disabledCell,
              ]}
              testID={`calendar-day-${cell.isoString}`}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.dayText,
                  cell.isToday && styles.todayText,
                  cell.isSelected && styles.selectedText,
                  cell.isDisabled && styles.disabledText,
                ]}
              >
                {cell.dayNumber}
              </Text>
              {cell.isToday && !cell.isSelected && <View style={styles.todayDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C152B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    padding: 14,
    marginTop: 10,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  shortcutPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: '#A78BFA',
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D8B4FE',
  },
  shortcutTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.25,
  },
  navBtnText: {
    fontSize: 22,
    color: '#E9D5FF',
    fontWeight: '700',
    marginTop: -2,
  },
  navBtnTextDisabled: {
    color: '#71717A',
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F5F3FF',
    letterSpacing: 0.3,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.15)',
    paddingBottom: 6,
  },
  weekdayCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
    textTransform: 'uppercase',
  },
  weekendText: {
    color: '#F472B6',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
    position: 'relative',
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.65)',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  selectedCell: {
    backgroundColor: theme.colors.primary,
    borderColor: '#C084FC',
    borderWidth: 1,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledCell: {
    opacity: 0.28,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E4E4E7',
  },
  todayText: {
    color: '#C084FC',
    fontWeight: '700',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabledText: {
    color: '#71717A',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
});
