export interface CountryItem {
  key: string;
  flag: string;
  labelKa: string;
  labelEn: string;
  labelRu: string;
  aliases?: string[];
}

export const COUNTRIES: CountryItem[] = [
  { key: 'GE', flag: '🇬🇪', labelKa: 'საქართველო', labelEn: 'Georgia', labelRu: 'Грузия', aliases: ['georgia', 'ge'] },
  { key: 'US', flag: '🇺🇸', labelKa: 'აშშ', labelEn: 'United States', labelRu: 'США', aliases: ['usa', 'america', 'united states'] },
  { key: 'DE', flag: '🇩🇪', labelKa: 'გერმანია', labelEn: 'Germany', labelRu: 'Германия', aliases: ['germany', 'deutschland'] },
  { key: 'GB', flag: '🇬🇧', labelKa: 'დიდი ბრიტანეთი', labelEn: 'United Kingdom', labelRu: 'Великобритания', aliases: ['uk', 'england', 'britain'] },
  { key: 'UA', flag: '🇺🇦', labelKa: 'უკრაინა', labelEn: 'Ukraine', labelRu: 'Украина', aliases: ['ukraine'] },
  { key: 'TR', flag: '🇹🇷', labelKa: 'თურქეთი', labelEn: 'Turkey', labelRu: 'Турция', aliases: ['turkey', 'turkiye'] },
  { key: 'FR', flag: '🇫🇷', labelKa: 'საფრანგეთი', labelEn: 'France', labelRu: 'Франция', aliases: ['france'] },
  { key: 'IT', flag: '🇮🇹', labelKa: 'იტალია', labelEn: 'Italy', labelRu: 'Италия', aliases: ['italy', 'italia'] },
  { key: 'ES', flag: '🇪🇸', labelKa: 'ესპანეთი', labelEn: 'Spain', labelRu: 'Испания', aliases: ['spain', 'espana'] },
  { key: 'PL', flag: '🇵🇱', labelKa: 'პოლონეთი', labelEn: 'Poland', labelRu: 'Польша', aliases: ['poland', 'polska'] },
  { key: 'CA', flag: '🇨🇦', labelKa: 'კანადა', labelEn: 'Canada', labelRu: 'Канада', aliases: ['canada'] },
  { key: 'AM', flag: '🇦🇲', labelKa: 'სომხეთი', labelEn: 'Armenia', labelRu: 'Армения', aliases: ['armenia'] },
  { key: 'AZ', flag: '🇦🇿', labelKa: 'აზერბაიჯანი', labelEn: 'Azerbaijan', labelRu: 'Азербайджан', aliases: ['azerbaijan'] },
  { key: 'GR', flag: '🇬🇷', labelKa: 'საბერძნეთი', labelEn: 'Greece', labelRu: 'Греция', aliases: ['greece', 'hellas'] },
  { key: 'AE', flag: '🇦🇪', labelKa: 'არაბთა გაერთიანებული საამიროები (დუბაი)', labelEn: 'UAE (Dubai)', labelRu: 'ОАЭ (Дубай)', aliases: ['uae', 'dubai'] },
  { key: 'CY', flag: '🇨🇾', labelKa: 'კვიპროსი', labelEn: 'Cyprus', labelRu: 'Кипр', aliases: ['cyprus'] },
  { key: 'IL', flag: '🇮🇱', labelKa: 'ისრაელი', labelEn: 'Israel', labelRu: 'Израиль', aliases: ['israel'] },
  { key: 'KZ', flag: '🇰🇿', labelKa: 'ყაზახეთი', labelEn: 'Kazakhstan', labelRu: 'Казахстан', aliases: ['kazakhstan'] },
  { key: 'CZ', flag: '🇨🇿', labelKa: 'ჩეხეთი', labelEn: 'Czechia', labelRu: 'Чехия', aliases: ['czechia', 'czech republic'] },
  { key: 'NL', flag: '🇳🇱', labelKa: 'ნიდერლანდები', labelEn: 'Netherlands', labelRu: 'Нидерланды', aliases: ['holland', 'netherlands'] },
  { key: 'SE', flag: '🇸🇪', labelKa: 'შვედეთი', labelEn: 'Sweden', labelRu: 'Швеция', aliases: ['sweden'] },
  { key: 'CH', flag: '🇨🇭', labelKa: 'შვეიცარია', labelEn: 'Switzerland', labelRu: 'Швейцария', aliases: ['switzerland'] },
  { key: 'AT', flag: '🇦🇹', labelKa: 'ავსტრია', labelEn: 'Austria', labelRu: 'Австрия', aliases: ['austria'] },
  { key: 'BE', flag: '🇧🇪', labelKa: 'ბელგია', labelEn: 'Belgium', labelRu: 'Бельгия', aliases: ['belgium'] },
  { key: 'BR', flag: '🇧🇷', labelKa: 'ბრაზილია', labelEn: 'Brazil', labelRu: 'Бразилия', aliases: ['brazil', 'brasil'] },
  { key: 'JP', flag: '🇯🇵', labelKa: 'იაპონია', labelEn: 'Japan', labelRu: 'Япония', aliases: ['japan'] },
  { key: 'KR', flag: '🇰🇷', labelKa: 'სამხრეთ კორეა', labelEn: 'South Korea', labelRu: 'Южная Корея', aliases: ['korea'] },
  { key: 'AU', flag: '🇦🇺', labelKa: 'ავსტრალია', labelEn: 'Australia', labelRu: 'Австралия', aliases: ['australia'] },
];

export const POPULAR_COUNTRIES: CountryItem[] = [
  COUNTRIES.find(c => c.key === 'GE')!,
  COUNTRIES.find(c => c.key === 'US')!,
  COUNTRIES.find(c => c.key === 'DE')!,
  COUNTRIES.find(c => c.key === 'GB')!,
  COUNTRIES.find(c => c.key === 'UA')!,
  COUNTRIES.find(c => c.key === 'TR')!,
];

export function findCountry(query: string): CountryItem | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  return COUNTRIES.find(c =>
    c.key.toLowerCase() === q ||
    c.labelKa.toLowerCase() === q ||
    c.labelEn.toLowerCase() === q ||
    c.labelRu.toLowerCase() === q ||
    c.aliases?.some(a => a.toLowerCase() === q)
  );
}
