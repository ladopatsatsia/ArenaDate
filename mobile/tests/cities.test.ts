import { CITIES, POPULAR_CITIES, findCity, formatCityName, searchCities } from '../src/components/cities';

describe('Canonical Cities System', () => {
  test('POPULAR_CITIES has the top hubs of Georgia', () => {
    expect(POPULAR_CITIES.length).toBe(10);
    const keys = POPULAR_CITIES.map(c => c.key);
    expect(keys).toContain('tbilisi');
    expect(keys).toContain('batumi');
    expect(keys).toContain('kutaisi');
    expect(keys).toContain('rustavi');
    expect(keys).toContain('sokhumi');
    expect(keys).toContain('tskhinvali');
  });

  test('findCity matches by key, Georgian name, English name, and aliases', () => {
    expect(findCity('tbilisi')?.key).toBe('tbilisi');
    expect(findCity('თბილისი')?.key).toBe('tbilisi');
    expect(findCity('Tbilisi')?.key).toBe('tbilisi');
    expect(findCity('tiflis')?.key).toBe('tbilisi');
    expect(findCity('სოხუმი')?.key).toBe('sokhumi');
    expect(findCity('Sokhumi')?.key).toBe('sokhumi');
    expect(findCity('ცხინვალი')?.key).toBe('tskhinvali');
    expect(findCity('Tskhinvali')?.key).toBe('tskhinvali');
    expect(findCity('აფხაზეთი')?.key).toBe('abkhazia');
    expect(findCity('ყაზბეგი')?.key).toBe('stepantsminda');
    expect(findCity('kazbegi')?.key).toBe('stepantsminda');
  });

  test('formatCityName returns localized name according to language', () => {
    expect(formatCityName('tbilisi', 'ka')).toBe('თბილისი');
    expect(formatCityName('tbilisi', 'en')).toBe('Tbilisi');
    expect(formatCityName('თბილისი', 'en')).toBe('Tbilisi');
    expect(formatCityName('sokhumi', 'ka')).toBe('სოხუმი');
    expect(formatCityName('sokhumi', 'en')).toBe('Sokhumi');
    expect(formatCityName('tskhinvali', 'ka')).toBe('ცხინვალი');
    expect(formatCityName('tskhinvali', 'en')).toBe('Tskhinvali');
    expect(formatCityName('Batumi', 'ka')).toBe('ბათუმი');
    expect(formatCityName('ბათუმი', 'en')).toBe('Batumi');
    // Non-canonical / foreign city returns original
    expect(formatCityName('Berlin', 'ka')).toBe('Berlin');
    expect(formatCityName('', 'ka')).toBe('');
    expect(formatCityName(null, 'ka')).toBe('');
  });

  test('searchCities matches both Georgian and English characters', () => {
    const resultsGeo = searchCities('ბათ', 'ka');
    expect(resultsGeo.some(c => c.key === 'batumi')).toBe(true);

    const resultsEn = searchCities('kuta', 'en');
    expect(resultsEn.some(c => c.key === 'kutaisi')).toBe(true);

    const emptySearch = searchCities('', 'ka');
    expect(emptySearch.length).toBe(CITIES.length);
  });
});
