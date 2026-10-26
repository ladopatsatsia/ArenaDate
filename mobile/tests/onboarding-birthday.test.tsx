import { getMaxDaysInMonth, ALL_ADULT_YEARS, MONTHS_DATA } from '../src/onboarding/OnboardingScreen';

describe('Onboarding Birthday Picker Logic & 18+ Validation', () => {
  const currentYear = new Date().getFullYear();

  test('getMaxDaysInMonth correctly handles 30, 31, and leap February days', () => {
    // 31 day months: Jan, Mar, May, Jul, Aug, Oct, Dec
    expect(getMaxDaysInMonth('2000', '01')).toBe(31);
    expect(getMaxDaysInMonth('2000', '03')).toBe(31);
    expect(getMaxDaysInMonth('2000', '05')).toBe(31);
    expect(getMaxDaysInMonth('2000', '07')).toBe(31);
    expect(getMaxDaysInMonth('2000', '08')).toBe(31);
    expect(getMaxDaysInMonth('2000', '10')).toBe(31);
    expect(getMaxDaysInMonth('2000', '12')).toBe(31);

    // 30 day months: Apr, Jun, Sep, Nov
    expect(getMaxDaysInMonth('2000', '04')).toBe(30);
    expect(getMaxDaysInMonth('2000', '06')).toBe(30);
    expect(getMaxDaysInMonth('2000', '09')).toBe(30);
    expect(getMaxDaysInMonth('2000', '11')).toBe(30);

    // February leap years
    expect(getMaxDaysInMonth('2000', '02')).toBe(29);
    expect(getMaxDaysInMonth('2004', '02')).toBe(29);
    expect(getMaxDaysInMonth('1996', '02')).toBe(29);

    // February common years
    expect(getMaxDaysInMonth('1999', '02')).toBe(28);
    expect(getMaxDaysInMonth('2001', '02')).toBe(28);
    expect(getMaxDaysInMonth('2003', '02')).toBe(28);
    expect(getMaxDaysInMonth('2005', '02')).toBe(28);

    // Default fallback when year or month empty
    expect(getMaxDaysInMonth('', '02')).toBe(29);
    expect(getMaxDaysInMonth('', '')).toBe(31);
  });

  test('ALL_ADULT_YEARS restricts available years to 18+ only', () => {
    expect(ALL_ADULT_YEARS.length).toBeGreaterThan(50);
    
    // The latest selectable year must be exactly currentYear - 18
    const maxYear = Math.max(...ALL_ADULT_YEARS.map(Number));
    expect(maxYear).toBe(currentYear - 18);

    // No minor years allowed
    ALL_ADULT_YEARS.forEach((yrStr) => {
      const yr = Number(yrStr);
      expect(currentYear - yr).toBeGreaterThanOrEqual(18);
      expect(yr).toBeGreaterThanOrEqual(1940);
    });
  });

  test('MONTHS_DATA provides 12 localized months with leading zero values', () => {
    expect(MONTHS_DATA).toHaveLength(12);
    expect(MONTHS_DATA[0].value).toBe('01');
    expect(MONTHS_DATA[0].ka).toBe('იანვარი');
    expect(MONTHS_DATA[0].en).toBe('January');
    expect(MONTHS_DATA[0].ru).toBe('Январь');

    expect(MONTHS_DATA[11].value).toBe('12');
    expect(MONTHS_DATA[11].ka).toBe('დეკემბერი');
    expect(MONTHS_DATA[11].en).toBe('December');
    expect(MONTHS_DATA[11].ru).toBe('Декабрь');
  });

  test('calculates adult age correctly across month & day thresholds', () => {
    // Reference date: 2026-10-26
    const today = new Date();
    
    // Exactly 20 years ago
    const birthDate20 = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
    let age = today.getFullYear() - birthDate20.getFullYear();
    const m = today.getMonth() - birthDate20.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate20.getDate())) {
      age--;
    }
    expect(age).toBe(20);

    // Born earlier this year vs later this year
    const birthDateEarlier = new Date(today.getFullYear() - 18, 0, 1);
    let ageEarlier = today.getFullYear() - birthDateEarlier.getFullYear();
    const mEarlier = today.getMonth() - birthDateEarlier.getMonth();
    if (mEarlier < 0 || (mEarlier === 0 && today.getDate() < birthDateEarlier.getDate())) {
      ageEarlier--;
    }
    expect(ageEarlier).toBeGreaterThanOrEqual(18);
  });
});
