export interface LanguageItem {
  code: string;
  name: string;
  labelKa: string;
  labelEn: string;
  native: string;
  flag: string;
  popular?: boolean;
}

export const LANGUAGES: LanguageItem[] = [
  // Popular / Regional
  { code: 'ka', name: 'ქართული', labelKa: 'ქართული', labelEn: 'Georgian', native: 'ქართული', flag: '🇬🇪', popular: true },
  { code: 'en', name: 'English', labelKa: 'ინგლისური', labelEn: 'English', native: 'English', flag: '🇬🇧', popular: true },
  { code: 'ru', name: 'Русский', labelKa: 'რუსული', labelEn: 'Russian', native: 'Русский', flag: '🇷🇺', popular: true },
  { code: 'de', name: 'Deutsch', labelKa: 'გერმანული', labelEn: 'German', native: 'Deutsch', flag: '🇩🇪', popular: true },
  { code: 'fr', name: 'Français', labelKa: 'ფრანგული', labelEn: 'French', native: 'Français', flag: '🇫🇷', popular: true },
  { code: 'es', name: 'Español', labelKa: 'ესპანური', labelEn: 'Spanish', native: 'Español', flag: '🇪🇸', popular: true },
  { code: 'it', name: 'Italiano', labelKa: 'იტალიური', labelEn: 'Italian', native: 'Italiano', flag: '🇮🇹', popular: true },
  { code: 'tr', name: 'Türkçe', labelKa: 'თურქული', labelEn: 'Turkish', native: 'Türkçe', flag: '🇹🇷', popular: true },
  { code: 'uk', name: 'Українська', labelKa: 'უკრაინული', labelEn: 'Ukrainian', native: 'Українська', flag: '🇺🇦', popular: true },
  { code: 'pl', name: 'Polski', labelKa: 'პოლონური', labelEn: 'Polish', native: 'Polski', flag: '🇵🇱', popular: true },
  { code: 'hy', name: 'Հայերեն', labelKa: 'სომხური', labelEn: 'Armenian', native: 'Հայերեն', flag: '🇦🇲', popular: true },
  { code: 'az', name: 'Azərbaycan', labelKa: 'აზერბაიჯანული', labelEn: 'Azerbaijani', native: 'Azərbaycan dili', flag: '🇦🇿', popular: true },

  // Europe
  { code: 'el', name: 'Ελληνικά', labelKa: 'ბერძნული', labelEn: 'Greek', native: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'pt', name: 'Português', labelKa: 'პორტუგალიური', labelEn: 'Portuguese', native: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', labelKa: 'ნიდერლანდური', labelEn: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', labelKa: 'შვედური', labelEn: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', labelKa: 'ნორვეგიული', labelEn: 'Norwegian', native: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', labelKa: 'დანიური', labelEn: 'Danish', native: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', labelKa: 'ფინური', labelEn: 'Finnish', native: 'Suomi', flag: '🇫🇮' },
  { code: 'cs', name: 'Čeština', labelKa: 'ჩეხური', labelEn: 'Czech', native: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovenčina', labelKa: 'სლოვაკური', labelEn: 'Slovak', native: 'Slovenčina', flag: '🇸🇰' },
  { code: 'ro', name: 'Română', labelKa: 'რუმინული', labelEn: 'Romanian', native: 'Română', flag: '🇷🇴' },
  { code: 'hu', name: 'Magyar', labelKa: 'უნგრული', labelEn: 'Hungarian', native: 'Magyar', flag: '🇭🇺' },
  { code: 'bg', name: 'Български', labelKa: 'ბულგარული', labelEn: 'Bulgarian', native: 'Български', flag: '🇧🇬' },
  { code: 'hr', name: 'Hrvatski', labelKa: 'ხორვატული', labelEn: 'Croatian', native: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sr', name: 'Српски', labelKa: 'სერბული', labelEn: 'Serbian', native: 'Срპски', flag: '🇷🇸' },
  { code: 'bs', name: 'Bosanski', labelKa: 'ბოსნიური', labelEn: 'Bosnian', native: 'Bosanski', flag: '🇧🇦' },
  { code: 'sl', name: 'Slovenščina', labelKa: 'სლოვენური', labelEn: 'Slovenian', native: 'Slovenščina', flag: '🇸🇮' },
  { code: 'lt', name: 'Lietuvių', labelKa: 'ლიეტუვური', labelEn: 'Lithuanian', native: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', name: 'Latviešu', labelKa: 'ლატვიური', labelEn: 'Latvian', native: 'Latviešu', flag: '🇱🇻' },
  { code: 'et', name: 'Eesti', labelKa: 'ესტონური', labelEn: 'Estonian', native: 'Eesti', flag: '🇪🇪' },
  { code: 'is', name: 'Íslenska', labelKa: 'ისლანდიური', labelEn: 'Icelandic', native: 'Íslenska', flag: '🇮🇸' },
  { code: 'ga', name: 'Gaeilge', labelKa: 'ირლანდიური', labelEn: 'Irish', native: 'Gaeilge', flag: '🇮🇪' },
  { code: 'sq', name: 'Shqip', labelKa: 'ალბანური', labelEn: 'Albanian', native: 'Shqip', flag: '🇦🇱' },
  { code: 'mk', name: 'Македонски', labelKa: 'მაკედონიური', labelEn: 'Macedonian', native: 'Македонски', flag: '🇲🇰' },
  { code: 'ca', name: 'Català', labelKa: 'კატალონიური', labelEn: 'Catalan', native: 'Català', flag: '🇪🇸' },
  { code: 'eu', name: 'Euskara', labelKa: 'ბასკური', labelEn: 'Basque', native: 'Euskara', flag: '🇪🇸' },

  // Middle East & Africa
  { code: 'he', name: 'עברית', labelKa: 'ებრაული', labelEn: 'Hebrew', native: 'עברית', flag: '🇮🇱', popular: true },
  { code: 'ar', name: 'العربية', labelKa: 'არაბული', labelEn: 'Arabic', native: 'العربية', flag: '🇸🇦', popular: true },
  { code: 'fa', name: 'فارسی', labelKa: 'სპარსული', labelEn: 'Persian', native: 'فارسی', flag: '🇮🇷' },
  { code: 'sw', name: 'Kiswahili', labelKa: 'სუაჰილი', labelEn: 'Swahili', native: 'Kiswahili', flag: '🇰🇪' },
  { code: 'af', name: 'Afrikaans', labelKa: 'აფრიკაანსი', labelEn: 'Afrikaans', native: 'Afrikaans', flag: '🇿🇦' },

  // Asia & Americas
  { code: 'hi', name: 'हिन्दी', labelKa: 'ჰინდი', labelEn: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ja', name: '日本語', labelKa: 'იაპონური', labelEn: 'Japanese', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', labelKa: 'კორეული', labelEn: 'Korean', native: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', labelKa: 'ჩინური', labelEn: 'Chinese', native: '中文', flag: '🇨🇳' },
  { code: 'id', name: 'Indonesia', labelKa: 'ინდონეზიური', labelEn: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Melayu', labelKa: 'მალაიური', labelEn: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'th', name: 'ไทย', labelKa: 'ტაილანდური', labelEn: 'Thai', native: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', labelKa: 'ვიეტნამური', labelEn: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'tl', name: 'Tagalog', labelKa: 'ფილიპინური (ტაგალოგი)', labelEn: 'Tagalog', native: 'Tagalog', flag: '🇵🇭' },
  { code: 'ur', name: 'اردو', labelKa: 'ურდუ', labelEn: 'Urdu', native: 'اردو', flag: '🇵🇰' },
  { code: 'bn', name: 'বাংলা', labelKa: 'ბენგალური', labelEn: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },

  // Central Asia & Caucasus
  { code: 'kk', name: 'Қазақша', labelKa: 'ყაზახური', labelEn: 'Kazakh', native: 'Қазақша', flag: '🇰🇿' },
  { code: 'uz', name: 'Oʻzbekcha', labelKa: 'უზბეკური', labelEn: 'Uzbek', native: 'Oʻzbekcha', flag: '🇺🇿' },
  { code: 'ky', name: 'Кыргызча', labelKa: 'ყირგიზული', labelEn: 'Kyrgyz', native: 'Кыргызча', flag: '🇰🇬' },
  { code: 'tg', name: 'Тоҷикӣ', labelKa: 'ტაჯიკური', labelEn: 'Tajik', native: 'Тоҷикӣ', flag: '🇹🇯' },
  { code: 'tk', name: 'Türkmençe', labelKa: 'თურქმენული', labelEn: 'Turkmen', native: 'Türkmençe', flag: '🇹🇲' },
  { code: 'mn', name: 'Монгол', labelKa: 'მონღოლური', labelEn: 'Mongolian', native: 'Монгол', flag: '🇲🇳' },

  // Kartvelian Languages
  { code: 'sva', name: 'ლუშნუ ნინ', labelKa: 'სვანური', labelEn: 'Svan', native: 'ლუშნუ ნინ', flag: '🇬🇪' },
  { code: 'xmf', name: 'მარგალურ ნინა', labelKa: 'მეგრული', labelEn: 'Megrelian', native: 'მარგალურ ნინა', flag: '🇬🇪' },
  { code: 'lzz', name: 'ლაზური ნენა', labelKa: 'ლაზური', labelEn: 'Laz', native: 'ლაზური ნენა', flag: '🇬🇪' },
];

export const POPULAR_LANGUAGES = LANGUAGES.filter(l => l.popular);

export function findLanguage(val: string | null | undefined): LanguageItem | undefined {
  if (!val) return undefined;
  const clean = val.trim().toLowerCase();
  return LANGUAGES.find(
    l =>
      l.name.toLowerCase() === clean ||
      l.code.toLowerCase() === clean ||
      l.labelKa.toLowerCase() === clean ||
      l.labelEn.toLowerCase() === clean ||
      l.native.toLowerCase() === clean
  );
}

export function formatLanguageDisplay(val: string, lang: 'ka' | 'en' = 'ka'): string {
  if (!val) return '';
  const item = findLanguage(val);
  if (!item) return `🌐 ${val}`;
  const label = lang === 'en' ? item.labelEn : item.labelKa;
  return `${item.flag} ${label}`;
}

export function getLanguageFlag(val: string): string {
  const item = findLanguage(val);
  return item ? item.flag : '🌐';
}

export function searchLanguages(query: string, lang: 'ka' | 'en' = 'ka'): LanguageItem[] {
  if (!query || !query.trim()) return LANGUAGES;
  const clean = query.trim().toLowerCase();
  return LANGUAGES.filter(l =>
    (lang === 'en' ? l.labelEn : l.labelKa).toLowerCase().includes(clean) ||
    l.native.toLowerCase().includes(clean) ||
    l.name.toLowerCase().includes(clean) ||
    l.code.toLowerCase().includes(clean)
  );
}
