export interface CityItem {
  key: string;
  labelKa: string;
  labelEn: string;
  labelRu: string;
  aliases?: string[];
}

export const CITIES: CityItem[] = [
  { key: 'tbilisi', labelKa: 'თბილისი', labelEn: 'Tbilisi', labelRu: 'Тбилиси', aliases: ['tiflis'] },
  { key: 'batumi', labelKa: 'ბათუმი', labelEn: 'Batumi', labelRu: 'Батуми' },
  { key: 'kutaisi', labelKa: 'ქუთაისი', labelEn: 'Kutaisi', labelRu: 'Кутаиси' },
  { key: 'rustavi', labelKa: 'რუსთავი', labelEn: 'Rustavi', labelRu: 'Рустави' },
  { key: 'sokhumi', labelKa: 'სოხუმი', labelEn: 'Sokhumi', labelRu: 'Сухуми', aliases: ['sukhum', 'сухуми'] },
  { key: 'tskhinvali', labelKa: 'ცხინვალი', labelEn: 'Tskhinvali', labelRu: 'Цхинвали', aliases: ['цхинвал', 'цхинвали'] },
  { key: 'abkhazia', labelKa: 'აფხაზეთი', labelEn: 'Abkhazia', labelRu: 'Абхазия', aliases: ['აფხაზეთის რეგიონი'] },
  { key: 'samachablo', labelKa: 'სამაჩაბლო', labelEn: 'Samachablo', labelRu: 'Самачабло', aliases: ['სამაჩაბლოს რეგიონი'] },
  { key: 'gagra', labelKa: 'გაგრა', labelEn: 'Gagra', labelRu: 'Гагра' },
  { key: 'gudauta', labelKa: 'გუდაუთა', labelEn: 'Gudauta', labelRu: 'Гудаута' },
  { key: 'ochamchire', labelKa: 'ოჩამჩირე', labelEn: 'Ochamchire', labelRu: 'Очамчира' },
  { key: 'gali', labelKa: 'გალი', labelEn: 'Gali', labelRu: 'Гალ' },
  { key: 'tqvarcheli', labelKa: 'ტყვარჩელი', labelEn: 'Tqvarcheli', labelRu: 'Ткварчели' },
  { key: 'bichvinta', labelKa: 'ბიჭვინთა', labelEn: 'Bichvinta', labelRu: 'Пицунда', aliases: ['pitsunda', 'пицунда'] },
  { key: 'akhali_atoni', labelKa: 'ახალი ათონი', labelEn: 'New Athos (Akhali Atoni)', labelRu: 'Новый Афон' },
  { key: 'java', labelKa: 'ჯავა', labelEn: 'Java', labelRu: 'Дзау' },
  { key: 'mtskheta', labelKa: 'მცხეთა', labelEn: 'Mtskheta', labelRu: 'Мцхета' },
  { key: 'zugdidi', labelKa: 'ზუგდიდი', labelEn: 'Zugdidi', labelRu: 'Зугдиди' },
  { key: 'gori', labelKa: 'გორი', labelEn: 'Gori', labelRu: 'Гори' },
  { key: 'telavi', labelKa: 'თელავი', labelEn: 'Telavi', labelRu: 'Телави' },
  { key: 'poti', labelKa: 'ფოთი', labelEn: 'Poti', labelRu: 'Поти' },
  { key: 'khashuri', labelKa: 'ხაშური', labelEn: 'Khashuri', labelRu: 'Хашури' },
  { key: 'samtredia', labelKa: 'სამტრედია', labelEn: 'Samtredia', labelRu: 'Самтредиа' },
  { key: 'senaki', labelKa: 'სენაკი', labelEn: 'Senaki', labelRu: 'Сенаки' },
  { key: 'zestafoni', labelKa: 'ზესტაფონი', labelEn: 'Zestafoni', labelRu: 'Зестафони' },
  { key: 'marneuli', labelKa: 'მარნეული', labelEn: 'Marneuli', labelRu: 'Марнеули' },
  { key: 'akhaltsikhe', labelKa: 'ახალციხე', labelEn: 'Akhaltsikhe', labelRu: 'Ахалцихе' },
  { key: 'kobuleti', labelKa: 'ქობულეთი', labelEn: 'Kobuleti', labelRu: 'Кобулети' },
  { key: 'ozurgeti', labelKa: 'ოზურგეთი', labelEn: 'Ozurgeti', labelRu: 'Озургети' },
  { key: 'kaspi', labelKa: 'კასპი', labelEn: 'Kaspi', labelRu: 'Каспи' },
  { key: 'chiatura', labelKa: 'ჭიათურა', labelEn: 'Chiatura', labelRu: 'Чиатура' },
  { key: 'tsqaltubo', labelKa: 'წყალტუბო', labelEn: 'Tsqaltubo', labelRu: 'Цхалтубо' },
  { key: 'sagarejo', labelKa: 'საგარეჯო', labelEn: 'Sagarejo', labelRu: 'Сагареджо' },
  { key: 'gardabani', labelKa: 'გარდაბანი', labelEn: 'Gardabani', labelRu: 'Гардабани' },
  { key: 'borjomi', labelKa: 'ბორჯომი', labelEn: 'Borjomi', labelRu: 'Боржоми' },
  { key: 'stepantsminda', labelKa: 'სტეფანწმინდა', labelEn: 'Stepantsminda', labelRu: 'Степанцминда', aliases: ['ყაზბეგი', 'kazbegi', 'казбеги'] },
  { key: 'bakuriani', labelKa: 'ბაკურიანი', labelEn: 'Bakuriani', labelRu: 'Бакуриани' },
  { key: 'gudauri', labelKa: 'გუდაური', labelEn: 'Gudauri', labelRu: 'Гудаури' },
  { key: 'sighnaghi', labelKa: 'სიღნაღი', labelEn: 'Sighnaghi', labelRu: 'Сигнахи' },
  { key: 'dusheti', labelKa: 'დუშეთი', labelEn: 'Dusheti', labelRu: 'Душети' },
  { key: 'akhalkalaki', labelKa: 'ახალქალაქი', labelEn: 'Akhalkalaki', labelRu: 'Ахалкалаки' },
  { key: 'akhmeta', labelKa: 'ახმეტა', labelEn: 'Akhmeta', labelRu: 'Ахмета' },
  { key: 'qvareli', labelKa: 'ყვარელი', labelEn: 'Qvareli', labelRu: 'Кварели' },
  { key: 'bolnisi', labelKa: 'ბოლნისი', labelEn: 'Bolnisi', labelRu: 'Болниси' },
  { key: 'dmanisi', labelKa: 'დმანისი', labelEn: 'Dmanisi', labelRu: 'Дманиси' },
  { key: 'tsalka', labelKa: 'წალკა', labelEn: 'Tsalka', labelRu: 'Цалка' },
  { key: 'lagodekhi', labelKa: 'ლაგოდეხი', labelEn: 'Lagodekhi', labelRu: 'Лагодехи' },
  { key: 'dedoplistsqaro', labelKa: 'დედოფლისწყარო', labelEn: 'Dedoplistsqaro', labelRu: 'Дедоплисцкаро' },
  { key: 'khobi', labelKa: 'ხობი', labelEn: 'Khobi', labelRu: 'Хоби' },
  { key: 'chkhorotsqou', labelKa: 'ჩხოროწყუ', labelEn: 'Chkhorotsqou', labelRu: 'Чхороцку' },
  { key: 'martvili', labelKa: 'მარტვილი', labelEn: 'Martvili', labelRu: 'Мартвили' },
  { key: 'tsalenjikha', labelKa: 'წალენჯიხა', labelEn: 'Tsalenjikha', labelRu: 'Цаленджиха' },
  { key: 'oni', labelKa: 'ონი', labelEn: 'Oni', labelRu: 'Они' },
  { key: 'ambrolauri', labelKa: 'ამბროლაური', labelEn: 'Ambrolauri', labelRu: 'Амбролаури' },
  { key: 'mestia', labelKa: 'მესტია', labelEn: 'Mestia', labelRu: 'Местиа' },
];

export const POPULAR_CITIES = [
  CITIES.find(c => c.key === 'tbilisi')!,
  CITIES.find(c => c.key === 'batumi')!,
  CITIES.find(c => c.key === 'kutaisi')!,
  CITIES.find(c => c.key === 'rustavi')!,
  CITIES.find(c => c.key === 'sokhumi')!,
  CITIES.find(c => c.key === 'tskhinvali')!,
  CITIES.find(c => c.key === 'zugdidi')!,
  CITIES.find(c => c.key === 'gori')!,
  CITIES.find(c => c.key === 'telavi')!,
  CITIES.find(c => c.key === 'poti')!,
];

export function findCity(text: string | null | undefined): CityItem | undefined {
  if (!text) return undefined;
  const clean = text.trim().toLowerCase();
  return CITIES.find(c =>
    c.key.toLowerCase() === clean ||
    c.labelKa.toLowerCase() === clean ||
    c.labelEn.toLowerCase() === clean ||
    (c.labelRu && c.labelRu.toLowerCase() === clean) ||
    (c.aliases && c.aliases.some(a => a.toLowerCase() === clean))
  );
}

export function formatCityName(city: string | null | undefined, lang: string): string {
  if (!city) return '';
  const item = findCity(city);
  if (!item) return city;
  if (lang === 'en') return item.labelEn;
  if (lang === 'ru' && item.labelRu) return item.labelRu;
  return item.labelKa;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function searchCities(query: string, lang?: string): CityItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return CITIES;
  return CITIES.filter(c =>
    c.labelKa.toLowerCase().includes(clean) ||
    c.labelEn.toLowerCase().includes(clean) ||
    (c.labelRu && c.labelRu.toLowerCase().includes(clean)) ||
    c.key.toLowerCase().includes(clean) ||
    (c.aliases && c.aliases.some(a => a.toLowerCase().includes(clean)))
  );
}
