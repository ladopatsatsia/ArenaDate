export interface CityItem {
  key: string;
  labelKa: string;
  labelEn: string;
  labelRu: string;
  aliases?: string[];
  lat?: number;
  lng?: number;
}

export const CITIES: CityItem[] = [
  { key: 'tbilisi', labelKa: 'თბილისი', labelEn: 'Tbilisi', labelRu: 'Тбилиси', aliases: ['tiflis'], lat: 41.7151, lng: 44.8271 },
  { key: 'batumi', labelKa: 'ბათუმი', labelEn: 'Batumi', labelRu: 'Батуми', lat: 41.6416, lng: 41.6359 },
  { key: 'kutaisi', labelKa: 'ქუთაისი', labelEn: 'Kutaisi', labelRu: 'Кутаиси', lat: 42.2679, lng: 42.6946 },
  { key: 'rustavi', labelKa: 'რუსთავი', labelEn: 'Rustavi', labelRu: 'Рустави', lat: 41.5495, lng: 45.0094 },
  { key: 'sokhumi', labelKa: 'სოხუმი', labelEn: 'Sokhumi', labelRu: 'Сухуми', aliases: ['sukhum', 'сухуми'], lat: 43.0033, lng: 41.0153 },
  { key: 'tskhinvali', labelKa: 'ცხინვალი', labelEn: 'Tskhinvali', labelRu: 'Цхинвали', aliases: ['цхинвал', 'цхинвали'], lat: 42.2256, lng: 43.9703 },
  { key: 'abkhazia', labelKa: 'აფხაზეთი', labelEn: 'Abkhazia', labelRu: 'Абхазия', aliases: ['აფხაზეთის რეგიონი'], lat: 43.0016, lng: 41.0234 },
  { key: 'samachablo', labelKa: 'სამაჩაბლო', labelEn: 'Samachablo', labelRu: 'Самачабло', aliases: ['სამაჩაბლოს რეგიონი'], lat: 42.2256, lng: 43.9703 },
  { key: 'gagra', labelKa: 'გაგრა', labelEn: 'Gagra', labelRu: 'Гагра', lat: 43.2797, lng: 40.2686 },
  { key: 'gudauta', labelKa: 'გუდაუთა', labelEn: 'Gudauta', labelRu: 'Гудаута', lat: 43.1056, lng: 40.6192 },
  { key: 'ochamchire', labelKa: 'ოჩამჩირე', labelEn: 'Ochamchire', labelRu: 'Очамчира', lat: 42.7122, lng: 41.4686 },
  { key: 'gali', labelKa: 'გალი', labelEn: 'Gali', labelRu: 'Гал', lat: 42.6267, lng: 41.7381 },
  { key: 'tqvarcheli', labelKa: 'ტყვარჩელი', labelEn: 'Tqvarcheli', labelRu: 'Ткварчели', lat: 42.8433, lng: 41.6817 },
  { key: 'bichvinta', labelKa: 'ბიჭვინთა', labelEn: 'Bichvinta', labelRu: 'Пицунда', aliases: ['pitsunda', 'пицунда'], lat: 43.1594, lng: 40.3406 },
  { key: 'akhali_atoni', labelKa: 'ახალი ათონი', labelEn: 'New Athos (Akhali Atoni)', labelRu: 'Новый Афон', lat: 43.0856, lng: 40.8172 },
  { key: 'java', labelKa: 'ჯავა', labelEn: 'Java', labelRu: 'Дзау', lat: 42.3997, lng: 43.9367 },
  { key: 'mtskheta', labelKa: 'მცხეთა', labelEn: 'Mtskheta', labelRu: 'Мцхета', lat: 41.8458, lng: 44.7189 },
  { key: 'zugdidi', labelKa: 'ზუგდიდი', labelEn: 'Zugdidi', labelRu: 'Зугдиди', lat: 42.5088, lng: 41.8709 },
  { key: 'gori', labelKa: 'გორი', labelEn: 'Gori', labelRu: 'Гори', lat: 41.9842, lng: 44.1158 },
  { key: 'telavi', labelKa: 'თელავი', labelEn: 'Telavi', labelRu: 'Телави', lat: 41.9198, lng: 45.4731 },
  { key: 'poti', labelKa: 'ფოთი', labelEn: 'Poti', labelRu: 'Поти', lat: 42.1462, lng: 41.6720 },
  { key: 'khashuri', labelKa: 'ხაშური', labelEn: 'Khashuri', labelRu: 'Хашури', lat: 41.9941, lng: 43.5999 },
  { key: 'samtredia', labelKa: 'სამტრედია', labelEn: 'Samtredia', labelRu: 'Самтредиа', lat: 42.1626, lng: 42.3411 },
  { key: 'senaki', labelKa: 'სენაკი', labelEn: 'Senaki', labelRu: 'Сенаки', lat: 42.2689, lng: 42.0679 },
  { key: 'zestafoni', labelKa: 'ზესტაფონი', labelEn: 'Zestafoni', labelRu: 'Зестафони', lat: 42.1103, lng: 43.0336 },
  { key: 'marneuli', labelKa: 'მარნეული', labelEn: 'Marneuli', labelRu: 'Марнеули', lat: 41.4789, lng: 44.8108 },
  { key: 'akhaltsikhe', labelKa: 'ახალციხე', labelEn: 'Akhaltsikhe', labelRu: 'Ахалцихе', lat: 41.6390, lng: 42.9826 },
  { key: 'kobuleti', labelKa: 'ქობულეთი', labelEn: 'Kobuleti', labelRu: 'Кобулети', lat: 41.8214, lng: 41.7792 },
  { key: 'ozurgeti', labelKa: 'ოზურგეთი', labelEn: 'Ozurgeti', labelRu: 'Озургети', lat: 41.9269, lng: 42.0044 },
  { key: 'kaspi', labelKa: 'კასპი', labelEn: 'Kaspi', labelRu: 'Каспи', lat: 41.9248, lng: 44.4257 },
  { key: 'chiatura', labelKa: 'ჭიათურა', labelEn: 'Chiatura', labelRu: 'Чиатура', lat: 42.2903, lng: 43.2828 },
  { key: 'tsqaltubo', labelKa: 'წყალტუბო', labelEn: 'Tsqaltubo', labelRu: 'Цхалтубо', lat: 42.3263, lng: 42.6006 },
  { key: 'sagarejo', labelKa: 'საგარეჯო', labelEn: 'Sagarejo', labelRu: 'Сагареджо', lat: 41.7339, lng: 45.3333 },
  { key: 'gardabani', labelKa: 'გარდაბანი', labelEn: 'Gardabani', labelRu: 'Гардабани', lat: 41.4608, lng: 44.9961 },
  { key: 'borjomi', labelKa: 'ბორჯომი', labelEn: 'Borjomi', labelRu: 'Боржоми', lat: 41.8399, lng: 43.3831 },
  { key: 'stepantsminda', labelKa: 'სტეფანწმინდა', labelEn: 'Stepantsminda', labelRu: 'Степанцминда', aliases: ['ყაზბეგი', 'kazbegi', 'казбеги'], lat: 42.6567, lng: 44.6433 },
  { key: 'bakuriani', labelKa: 'ბაკურიანი', labelEn: 'Bakuriani', labelRu: 'Бакуриани', lat: 41.7508, lng: 43.5333 },
  { key: 'gudauri', labelKa: 'გუდაური', labelEn: 'Gudauri', labelRu: 'Гудаури', lat: 42.4778, lng: 44.4786 },
  { key: 'sighnaghi', labelKa: 'სიღნაღი', labelEn: 'Sighnaghi', labelRu: 'Сигнахи', lat: 41.6206, lng: 45.9214 },
  { key: 'dusheti', labelKa: 'დუშეთი', labelEn: 'Dusheti', labelRu: 'Душети', lat: 42.0528, lng: 44.6983 },
  { key: 'akhalkalaki', labelKa: 'ახალქალაქი', labelEn: 'Akhalkalaki', labelRu: 'Ахалкалаки', lat: 41.4056, lng: 43.4861 },
  { key: 'akhmeta', labelKa: 'ახმეტა', labelEn: 'Akhmeta', labelRu: 'Ахмета', lat: 42.0369, lng: 45.2078 },
  { key: 'qvareli', labelKa: 'ყვარელი', labelEn: 'Qvareli', labelRu: 'Кварели', lat: 41.9561, lng: 45.8156 },
  { key: 'bolnisi', labelKa: 'ბოლნისი', labelEn: 'Bolnisi', labelRu: 'Болниси', lat: 41.4489, lng: 44.5264 },
  { key: 'dmanisi', labelKa: 'დმანისი', labelEn: 'Dmanisi', labelRu: 'Дманиси', lat: 41.3325, lng: 44.3486 },
  { key: 'tsalka', labelKa: 'წალკა', labelEn: 'Tsalka', labelRu: 'Цалка', lat: 41.5947, lng: 44.0886 },
  { key: 'lagodekhi', labelKa: 'ლაგოდეხი', labelEn: 'Lagodekhi', labelRu: 'Лагодехи', lat: 41.8267, lng: 46.2758 },
  { key: 'dedoplistsqaro', labelKa: 'დედოფლისწყარო', labelEn: 'Dedoplistsqaro', labelRu: 'Дедоплисцкаро', lat: 41.4650, lng: 46.1042 },
  { key: 'khobi', labelKa: 'ხობი', labelEn: 'Khobi', labelRu: 'Хоби', lat: 42.3167, lng: 41.9000 },
  { key: 'chkhorotsqou', labelKa: 'ჩხოროწყუ', labelEn: 'Chkhorotsqou', labelRu: 'Чхороцку', lat: 42.5250, lng: 42.1333 },
  { key: 'martvili', labelKa: 'მარტვილი', labelEn: 'Martvili', labelRu: 'Мартвили', lat: 42.4167, lng: 42.3833 },
  { key: 'tsalenjikha', labelKa: 'წალენჯიხა', labelEn: 'Tsalenjikha', labelRu: 'Цаленджиха', lat: 42.6108, lng: 42.0714 },
  { key: 'oni', labelKa: 'ონი', labelEn: 'Oni', labelRu: 'Они', lat: 42.5856, lng: 43.4425 },
  { key: 'ambrolauri', labelKa: 'ამბროლაური', labelEn: 'Ambrolauri', labelRu: 'Амбролаури', lat: 42.5217, lng: 43.1597 },
  { key: 'mestia', labelKa: 'მესტია', labelEn: 'Mestia', labelRu: 'Местиа', lat: 43.0447, lng: 42.7297 },
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
    (c.labelRu && c.labelRu.toLowerCase() === clean) ||
    c.key.toLowerCase().includes(clean) ||
    (c.aliases && c.aliases.some(a => a.toLowerCase() === clean))
  );
}

/**
 * Finds the nearest Georgian city based on GPS coordinates using the Haversine formula.
 * Returns undefined if no city is found within maxDistanceKm (default 80km).
 */
export function findNearestCity(lat: number, lng: number, maxDistanceKm = 80): CityItem | undefined {
  let closest: CityItem | undefined;
  let minDistance = Infinity;

  for (const city of CITIES) {
    if (typeof city.lat === 'number' && typeof city.lng === 'number') {
      const dLat = (city.lat - lat) * (Math.PI / 180);
      const dLon = (city.lng - lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * (Math.PI / 180)) *
          Math.cos(city.lat * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371 * c; // in kilometers

      if (distance < minDistance) {
        minDistance = distance;
        closest = city;
      }
    }
  }

  if (closest && minDistance <= maxDistanceKm) {
    return closest;
  }
  return undefined;
}
