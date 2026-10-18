export const TODAY_PLAN_ACTIVITIES = [
  { key: 'coffee', icon: '☕', labelKey: 'today_plans_activity_coffee' },
  { key: 'walk', icon: '🚶', labelKey: 'today_plans_activity_walk' },
  { key: 'cinema', icon: '🎬', labelKey: 'today_plans_activity_cinema' },
  { key: 'food', icon: '🍕', labelKey: 'today_plans_activity_food' },
  { key: 'other', icon: '✨', labelKey: 'today_plans_activity_other' },
] as const;

export function getActivityMeta(activity: string) {
  const clean = (activity || '').toLowerCase();
  return (
    TODAY_PLAN_ACTIVITIES.find(a => a.key === clean) ?? {
      key: clean,
      icon: '✨',
      labelKey: 'today_plans_activity_other',
    }
  );
}

export function formatPlanTime(
  isoDateString: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  timeZone = 'Asia/Tbilisi',
  lang = 'ka'
): string {
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return '';

    // Format date parts to compare day
    const dayFormatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    });

    const now = new Date();
    const todayStr = dayFormatter.format(now);
    const tomorrowStr = dayFormatter.format(new Date(now.getTime() + 24 * 3600 * 1000));
    const afterTomorrowStr = dayFormatter.format(new Date(now.getTime() + 48 * 3600 * 1000));
    const targetStr = dayFormatter.format(d);

    const locale = lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'ka-GE';
    const monthDayFormatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone,
    });
    const dateFormatted = monthDayFormatter.format(d);

    if (targetStr === todayStr) {
      const label = t('today_plans_day_today', { defaultValue: 'დღეს' });
      return `${label} (${dateFormatted})`;
    }
    if (targetStr === tomorrowStr) {
      const label = t('today_plans_day_tomorrow', { defaultValue: 'ხვალ' });
      return `${label} (${dateFormatted})`;
    }
    if (targetStr === afterTomorrowStr) {
      const label = t('today_plans_day_after_tomorrow', { defaultValue: 'ზეგ' });
      return `${label} (${dateFormatted})`;
    }

    return dateFormatted;
  } catch {
    return isoDateString;
  }
}

export function getQuickPresetDates(lang = 'ka', timeZone = 'Asia/Tbilisi') {
  const now = new Date();
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });

  const locale = lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'ka-GE';

  const shortFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone,
  });

  const fullFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone,
  });

  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const afterTomorrow = new Date(now.getTime() + 48 * 3600 * 1000);

  return {
    today: {
      iso: dayFormatter.format(now),
      shortDisplay: shortFormatter.format(now),
      fullDisplay: fullFormatter.format(now),
    },
    tomorrow: {
      iso: dayFormatter.format(tomorrow),
      shortDisplay: shortFormatter.format(tomorrow),
      fullDisplay: fullFormatter.format(tomorrow),
    },
    afterTomorrow: {
      iso: dayFormatter.format(afterTomorrow),
      shortDisplay: shortFormatter.format(afterTomorrow),
      fullDisplay: fullFormatter.format(afterTomorrow),
    },
  };
}

export function formatPublicationTime(
  isoDateString: string,
  lang = 'ka',
  timeZone = 'Asia/Tbilisi'
): string {
  try {
    const created = new Date(isoDateString);
    if (isNaN(created.getTime())) return '';

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - created.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    // If less than 1 minute ago
    if (diffMin < 1) {
      if (lang === 'en') return 'just now';
      if (lang === 'ru') return 'только что';
      return 'ახლახანს';
    }

    // If less than 60 minutes ago
    if (diffMin < 60) {
      if (lang === 'en') return `${diffMin}m ago`;
      if (lang === 'ru') return `${diffMin} мин назад`;
      return `${diffMin} წთ-ის წინ`;
    }

    // Check if created today or yesterday in target timeZone
    const dayFormatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    });

    const todayStr = dayFormatter.format(now);
    const yesterdayStr = dayFormatter.format(new Date(now.getTime() - 24 * 3600 * 1000));
    const createdStr = dayFormatter.format(created);

    const timeFormatter = new Intl.DateTimeFormat('ka-GE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    });
    const timeStr = timeFormatter.format(created);

    if (createdStr === todayStr) {
      if (lang === 'en') return `Today, ${timeStr}`;
      if (lang === 'ru') return `Сегодня, ${timeStr}`;
      return `დღეს, ${timeStr}`;
    }

    if (createdStr === yesterdayStr) {
      if (lang === 'en') return `Yesterday, ${timeStr}`;
      if (lang === 'ru') return `Вчера, ${timeStr}`;
      return `გუშინ, ${timeStr}`;
    }

    // Otherwise format date and time
    const locale = lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'ka-GE';
    const monthDayFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone,
    });
    return `${monthDayFormatter.format(created)}, ${timeStr}`;
  } catch {
    return '';
  }
}

export function formatCustomDateDisplay(
  isoDateStr: string,
  lang = 'ka',
  timeZone = 'Asia/Tbilisi'
): string {
  try {
    const parts = isoDateStr.split('-').map(Number);
    const year = parts[0] ?? 2026;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const locale = lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone,
    }).format(d);
  } catch {
    return isoDateStr;
  }
}

export function formatDetailedDateTime(
  isoDateString: string,
  timeZone = 'Asia/Tbilisi'
): string {
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ka-GE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(d);
  } catch {
    return isoDateString;
  }
}

export function computeQuickTimePreset(
  preset: 'now' | 'today_evening' | 'tomorrow' | 'after_tomorrow' | 'custom_date',
  timeZone = 'Asia/Tbilisi',
  customDateIso?: string | null
): { startsAtUtc: string; expiresAtUtc: string } {
  const now = new Date();

  // Create a target date in Asia/Tbilisi
  const tzNowParts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(now);

  const getPart = (type: string) => Number(tzNowParts.find(p => p.type === type)?.value ?? '0');
  const year = getPart('year');
  const month = getPart('month') - 1;
  const day = getPart('day');
  const hour = getPart('hour');

  let targetDate = new Date(Date.UTC(year, month, day, hour + 1, 0, 0));

  if (preset === 'now') {
    // 1 hour from now
    targetDate = new Date(now.getTime() + 60 * 60 * 1000);
  } else if (preset === 'today_evening') {
    // 19:00 Tbilisi time today = 15:00 UTC
    targetDate = new Date(Date.UTC(year, month, day, 15, 0, 0));
    if (targetDate.getTime() <= now.getTime()) {
      targetDate = new Date(now.getTime() + 2 * 3600 * 1000);
    }
  } else if (preset === 'tomorrow') {
    // 19:00 Tbilisi time tomorrow
    targetDate = new Date(Date.UTC(year, month, day + 1, 15, 0, 0));
  } else if (preset === 'after_tomorrow') {
    // 19:00 Tbilisi time day after tomorrow
    targetDate = new Date(Date.UTC(year, month, day + 2, 15, 0, 0));
  } else if (preset === 'custom_date' && customDateIso) {
    // Custom date chosen from Calendar (YYYY-MM-DD)
    const cParts = customDateIso.split('-').map(Number);
    const cYear = cParts[0] ?? year;
    const cMonth = cParts[1] ?? (month + 1);
    const cDay = cParts[2] ?? day;
    targetDate = new Date(Date.UTC(cYear, cMonth - 1, cDay, 15, 0, 0));
    if (targetDate.getTime() <= now.getTime()) {
      targetDate = new Date(now.getTime() + 2 * 3600 * 1000);
    }
  }

  // ExpiresAtUtc defaults to 6 hours after StartsAtUtc
  const expiresDate = new Date(targetDate.getTime() + 6 * 3600 * 1000);

  return {
    startsAtUtc: targetDate.toISOString(),
    expiresAtUtc: expiresDate.toISOString(),
  };
}
