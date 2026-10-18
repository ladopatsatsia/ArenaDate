import i18n, {
  LANGUAGE_STORAGE_KEY,
  normalizeLanguageCode,
  getWebPersistedLanguage,
  persistLanguage,
} from '../src/i18n';

describe('Language Persistence System', () => {
  const originalLocalStorage = window.localStorage;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  test('normalizeLanguageCode correctly resolves language codes and regional prefixes', () => {
    expect(normalizeLanguageCode('ka')).toBe('ka');
    expect(normalizeLanguageCode('ka-GE')).toBe('ka');
    expect(normalizeLanguageCode('KA')).toBe('ka');

    expect(normalizeLanguageCode('ru')).toBe('ru');
    expect(normalizeLanguageCode('ru-RU')).toBe('ru');

    expect(normalizeLanguageCode('en')).toBe('en');
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('en-GB')).toBe('en');

    expect(normalizeLanguageCode('de')).toBeNull();
    expect(normalizeLanguageCode(null)).toBeNull();
    expect(normalizeLanguageCode(undefined)).toBeNull();
  });

  test('persistLanguage saves normalized code to storage', () => {
    persistLanguage('ka');
    expect(mockStorage[LANGUAGE_STORAGE_KEY]).toBe('ka');

    persistLanguage('en-US');
    expect(mockStorage[LANGUAGE_STORAGE_KEY]).toBe('en');

    persistLanguage('ru');
    expect(mockStorage[LANGUAGE_STORAGE_KEY]).toBe('ru');
  });

  test('getWebPersistedLanguage retrieves and normalizes saved language', () => {
    mockStorage[LANGUAGE_STORAGE_KEY] = 'ka';
    expect(getWebPersistedLanguage()).toBe('ka');

    mockStorage[LANGUAGE_STORAGE_KEY] = 'ru-RU';
    expect(getWebPersistedLanguage()).toBe('ru');

    mockStorage[LANGUAGE_STORAGE_KEY] = 'invalid_lang';
    expect(getWebPersistedLanguage()).toBeNull();
  });

  test('i18n.changeLanguage triggers automatic persistence', async () => {
    await i18n.changeLanguage('ka');
    expect(mockStorage[LANGUAGE_STORAGE_KEY]).toBe('ka');

    await i18n.changeLanguage('ru');
    expect(mockStorage[LANGUAGE_STORAGE_KEY]).toBe('ru');

    await i18n.changeLanguage('en');
    expect(mockStorage[LANGUAGE_STORAGE_KEY]).toBe('en');
  });
});
