import {
  LANGUAGES,
  POPULAR_LANGUAGES,
  findLanguage,
  formatLanguageDisplay,
  getLanguageFlag,
  searchLanguages,
} from '../src/components/languages';

describe('Canonical Languages System', () => {
  test('POPULAR_LANGUAGES includes Georgian and top global languages', () => {
    expect(POPULAR_LANGUAGES.length).toBeGreaterThanOrEqual(8);
    const codes = POPULAR_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('ka');
    expect(codes).toContain('en');
    expect(codes).toContain('ru');
    expect(codes).toContain('de');
    expect(codes).toContain('fr');
    expect(codes).toContain('es');
    expect(codes).toContain('tr');
  });

  test('LANGUAGES contains rich world and Kartvelian regional languages', () => {
    expect(LANGUAGES.length).toBeGreaterThan(60);
    const codes = LANGUAGES.map((l) => l.code);
    // Kartvelian regional
    expect(codes).toContain('sva'); // Svan
    expect(codes).toContain('xmf'); // Megrelian
    expect(codes).toContain('lzz'); // Laz
    // Caucasian & neighbors
    expect(codes).toContain('hy'); // Armenian
    expect(codes).toContain('az'); // Azerbaijani
    expect(codes).toContain('uk'); // Ukrainian
  });

  test('findLanguage matches by code, Georgian label, English label, and native name', () => {
    expect(findLanguage('ka')?.code).toBe('ka');
    expect(findLanguage('ქართული')?.code).toBe('ka');
    expect(findLanguage('Georgian')?.code).toBe('ka');

    expect(findLanguage('en')?.code).toBe('en');
    expect(findLanguage('ინგლისური')?.code).toBe('en');
    expect(findLanguage('English')?.code).toBe('en');

    expect(findLanguage('es')?.code).toBe('es');
    expect(findLanguage('ესპანური')?.code).toBe('es');
    expect(findLanguage('Español')?.code).toBe('es');

    expect(findLanguage('deutsch')?.code).toBe('de');
    expect(findLanguage('german')?.code).toBe('de');
  });

  test('getLanguageFlag returns the correct flag emoji', () => {
    expect(getLanguageFlag('ka')).toBe('🇬🇪');
    expect(getLanguageFlag('ქართული')).toBe('🇬🇪');
    expect(getLanguageFlag('en')).toBe('🇬🇧');
    expect(getLanguageFlag('fr')).toBe('🇫🇷');
    expect(getLanguageFlag('unknown_xyz')).toBe('🌐');
  });

  test('formatLanguageDisplay formats properly with flags and localization', () => {
    expect(formatLanguageDisplay('ka', 'ka')).toBe('🇬🇪 ქართული');
    expect(formatLanguageDisplay('ka', 'en')).toBe('🇬🇪 Georgian');
    expect(formatLanguageDisplay('ინგლისური', 'ka')).toBe('🇬🇧 ინგლისური');
    expect(formatLanguageDisplay('ინგლისური', 'en')).toBe('🇬🇧 English');
    // Fallback for custom or unknown
    expect(formatLanguageDisplay('Esperanto', 'ka')).toBe('🌐 Esperanto');
  });

  test('searchLanguages searches case-insensitively across Georgian, English, and native names', () => {
    const geoQuery = searchLanguages('ქართ', 'ka');
    expect(geoQuery.some((l) => l.code === 'ka')).toBe(true);

    const enQuery = searchLanguages('span', 'en');
    expect(enQuery.some((l) => l.code === 'es')).toBe(true);

    const nativeQuery = searchLanguages('français', 'ka');
    expect(nativeQuery.some((l) => l.code === 'fr')).toBe(true);

    const empty = searchLanguages('', 'ka');
    expect(empty.length).toBe(LANGUAGES.length);
  });
});
