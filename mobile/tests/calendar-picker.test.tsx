import React from 'react';
import '../src/i18n';
import { fireEvent, render } from '@testing-library/react-native';
import { CalendarPicker } from '../src/components/CalendarPicker';
import {
  computeQuickTimePreset,
  formatCustomDateDisplay,
  formatPlanTime,
  getQuickPresetDates,
  formatPublicationTime,
} from '../src/today-plans/utils';

describe('CalendarPicker and Custom Date Utils', () => {
  const baseToday = new Date(2026, 9, 17); // 2026-10-17

  test('renders month header, weekday labels, and shortcut pills in Georgian', () => {
    const onSelectMock = jest.fn();
    const { getByText, getByTestId } = render(
      <CalendarPicker
        selectedDate="2026-10-24"
        onSelectDate={onSelectMock}
        minDate={baseToday}
        maxDaysAhead={30}
        lang="ka"
      />
    );

    // Month header contains October and 2026
    expect(getByText(/ოქტომბერი 2026/i)).toBeTruthy();

    // Weekdays
    expect(getByText('ორშ')).toBeTruthy();
    expect(getByText('პარ')).toBeTruthy();
    expect(getByText('კვი')).toBeTruthy();

    // Shortcuts
    expect(getByTestId('calendar-quick-1week')).toBeTruthy();
    expect(getByTestId('calendar-quick-2weeks')).toBeTruthy();
  });

  test('tapping +1 კვირა shortcut selects date 7 days ahead', () => {
    const onSelectMock = jest.fn();
    const { getByTestId } = render(
      <CalendarPicker
        selectedDate={null}
        onSelectDate={onSelectMock}
        minDate={baseToday}
        maxDaysAhead={30}
        lang="ka"
      />
    );

    const plusOneWeekBtn = getByTestId('calendar-quick-1week');
    fireEvent.press(plusOneWeekBtn);

    // 2026-10-17 + 7 days = 2026-10-24
    expect(onSelectMock).toHaveBeenCalledWith('2026-10-24');
  });

  test('tapping +2 კვირა shortcut selects date 14 days ahead', () => {
    const onSelectMock = jest.fn();
    const { getByTestId } = render(
      <CalendarPicker
        selectedDate={null}
        onSelectDate={onSelectMock}
        minDate={baseToday}
        maxDaysAhead={30}
        lang="ka"
      />
    );

    const plusTwoWeeksBtn = getByTestId('calendar-quick-2weeks');
    fireEvent.press(plusTwoWeeksBtn);

    // 2026-10-17 + 14 days = 2026-10-31
    expect(onSelectMock).toHaveBeenCalledWith('2026-10-31');
  });

  test('computeQuickTimePreset handles custom_date with 1 week horizon', () => {
    const result = computeQuickTimePreset('custom_date', 'Asia/Tbilisi', '2026-10-24');
    expect(result.startsAtUtc).toBeDefined();
    expect(result.expiresAtUtc).toBeDefined();

    const start = new Date(result.startsAtUtc);
    const expire = new Date(result.expiresAtUtc);
    // Expiration is exactly 6 hours after start
    expect(expire.getTime() - start.getTime()).toBe(6 * 3600 * 1000);
  });

  test('formatPlanTime includes both relative day and calendar date in Georgian', () => {
    const mockT = ((k: string, opts?: Record<string, unknown>) => {
      if (k === 'today_plans_day_today') return 'დღეს';
      if (k === 'today_plans_day_tomorrow') return 'ხვალ';
      if (k === 'today_plans_day_after_tomorrow') return 'ზეგ';
      return opts?.defaultValue ?? k;
    }) as any;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const afterTomorrow = new Date(now.getTime() + 48 * 3600 * 1000);

    const formattedToday = formatPlanTime(now.toISOString(), mockT, 'Asia/Tbilisi', 'ka');
    expect(formattedToday).toContain('დღეს');
    expect(formattedToday).toMatch(/\(.*\)/);

    const formattedTomorrow = formatPlanTime(tomorrow.toISOString(), mockT, 'Asia/Tbilisi', 'ka');
    expect(formattedTomorrow).toContain('ხვალ');
    expect(formattedTomorrow).toMatch(/\(.*\)/);

    const formattedAfterTomorrow = formatPlanTime(afterTomorrow.toISOString(), mockT, 'Asia/Tbilisi', 'ka');
    expect(formattedAfterTomorrow).toContain('ზეგ');
    expect(formattedAfterTomorrow).toMatch(/\(.*\)/);
  });

  test('getQuickPresetDates generates today, tomorrow, and afterTomorrow with short and full displays', () => {
    const dates = getQuickPresetDates('ka', 'Asia/Tbilisi');
    expect(dates.today.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dates.tomorrow.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dates.afterTomorrow.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(dates.tomorrow.shortDisplay).toBeTruthy();
    expect(dates.tomorrow.fullDisplay).toBeTruthy();
  });

  test('formatPublicationTime handles recent and today dates', () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatPublicationTime(fiveMinAgo.toISOString(), 'ka')).toContain('5 წთ-ის წინ');

    const justNow = new Date(now.getTime() - 10 * 1000);
    expect(formatPublicationTime(justNow.toISOString(), 'ka')).toBe('ახლახანს');
  });
});
