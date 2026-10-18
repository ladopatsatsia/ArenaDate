import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import ka from './locales/ka.json';
import ru from './locales/ru.json';
import en from './locales/en.json';

export const resources = {
  ka: { translation: ka },
  ru: { translation: ru },
  en: { translation: en },
};

export type SupportedLanguage = 'ka' | 'ru' | 'en';

export const SUPPORTED_LANGUAGES: Array<{
  code: SupportedLanguage;
  label: string;
  native: string;
  flag: string;
}> = [
  { code: 'ka', label: 'ქართული', native: 'ქართული', flag: '🇬🇪' },
  { code: 'ru', label: 'რუსული', native: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'ინგლისური', native: 'English', flag: '🇬🇧' },
];

export const LANGUAGE_STORAGE_KEY = 'dating.app_language';

export function normalizeLanguageCode(lng?: string | null): SupportedLanguage | null {
  if (!lng) return null;
  const lower = lng.toLowerCase();
  if (lower.startsWith('ka')) return 'ka';
  if (lower.startsWith('ru')) return 'ru';
  if (lower.startsWith('en')) return 'en';
  return null;
}

export function getWebPersistedLanguage(): SupportedLanguage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return normalizeLanguageCode(saved);
    }
  } catch {
    // ignore
  }
  return null;
}

export function persistLanguage(lng: string): void {
  const code = normalizeLanguageCode(lng);
  if (!code) return;

  if (Platform.OS === 'web' || typeof window !== 'undefined') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      }
    } catch {
      // ignore
    }
  }

  if (Platform.OS !== 'web') {
    try {
      void SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, code, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }).catch(() => {
        // ignore
      });
    } catch {
      // ignore
    }
  }
}

function detectInitialLanguage(): SupportedLanguage {
  // 1. Check synchronous Web storage (e.g. Telegram WebApp or browser reload)
  const saved = getWebPersistedLanguage();
  if (saved) return saved;

  try {
    // 2. If running inside Telegram Mini App, check user's Telegram language
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tgLang = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      const normalizedTg = normalizeLanguageCode(tgLang);
      if (normalizedTg) return normalizedTg;
    }

    // 3. Check system device locale
    const detected = getLocales()[0]?.languageCode;
    const normalizedDetected = normalizeLanguageCode(detected);
    if (normalizedDetected) return normalizedDetected;
  } catch {
    // ignore
  }

  // 4. Default to Georgian for ARENA dating app
  return 'ka';
}

const initialLanguage = detectInitialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Automatically persist language whenever i18n.changeLanguage is called
i18n.on('languageChanged', (lng: string) => {
  persistLanguage(lng);
});

// On native platforms (iOS/Android), asynchronously load persisted language from SecureStore
if (Platform.OS !== 'web') {
  try {
    void SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
      .then((saved) => {
        const normalized = normalizeLanguageCode(saved);
        if (normalized && i18n.language !== normalized) {
          void i18n.changeLanguage(normalized);
        }
      })
      .catch(() => {
        // ignore
      });
  } catch {
    // ignore
  }
}

export default i18n;

