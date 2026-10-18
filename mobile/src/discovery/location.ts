import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { findCity } from '../components/cities';

function getWebPosition(timeoutMs = 6000): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('location_unavailable'));
    }
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error('location_unavailable'));
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      },
      (err) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          if (err.code === 1) { // PERMISSION_DENIED
            reject(new Error('location_denied'));
          } else {
            reject(new Error('location_unavailable'));
          }
        }
      },
      { timeout: timeoutMs - 1000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  });
}

// Called only after the user's explicit explanation/consent button; never on mount/resume.
export async function foregroundFix(consent: boolean): Promise<{ latitude: number; longitude: number }> {
  if (!consent) throw new Error('location_consent_required');

  // Web / Telegram WebApp direct browser geolocation
  if (Platform.OS === 'web') {
    try {
      return await getWebPosition(6000);
    } catch (webErr) {
      // If web navigator fails with denied, rethrow immediately
      if (webErr instanceof Error && webErr.message === 'location_denied') {
        throw webErr;
      }
      // Otherwise fall through to expo-location if present
    }
  }

  // Native expo-location with strict timeouts
  const permission = await Promise.race([
    Location.requestForegroundPermissionsAsync(),
    new Promise<Location.LocationPermissionResponse>((_, reject) =>
      setTimeout(() => reject(new Error('location_unavailable')), 5000)
    ),
  ]);

  if (!permission.granted) throw new Error('location_denied');

  const location = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<Location.LocationObject>((_, reject) =>
      setTimeout(() => reject(new Error('location_unavailable')), 6000)
    ),
  ]);

  return { latitude: location.coords.latitude, longitude: location.coords.longitude };
}

export async function detectLocationAndCity(
  consent: boolean,
  lang: string = 'ka'
): Promise<{
  latitude: number;
  longitude: number;
  cityName?: string;
  canonicalKey?: string;
}> {
  const coords = await foregroundFix(consent);

  try {
    const addresses = await Promise.race([
      Location.reverseGeocodeAsync(coords),
      new Promise<Location.LocationGeocodedAddress[]>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ]).catch(() => [] as Location.LocationGeocodedAddress[]);

    const addr = addresses[0];
    if (addr) {
      const rawCity = addr.city || addr.subregion || addr.region || addr.district;
      const country = addr.country;
      if (rawCity) {
        const matched = findCity(rawCity);
        let cityName: string;
        if (matched) {
          cityName = lang === 'en' ? matched.labelEn : lang === 'ru' ? matched.labelRu : matched.labelKa;
        } else if (country && country.trim().toLowerCase() !== rawCity.trim().toLowerCase()) {
          cityName = `${rawCity}, ${country}`;
        } else {
          cityName = rawCity;
        }
        return {
          ...coords,
          cityName,
          canonicalKey: matched?.key,
        };
      } else if (country) {
        return {
          ...coords,
          cityName: country,
        };
      }
    }
  } catch {
    // Reverse geocode failed or timed out
  }

  // Fallback to default city in Georgia if coordinates are around Georgia
  if (coords.latitude >= 41.0 && coords.latitude <= 43.6 && coords.longitude >= 40.0 && coords.longitude <= 46.8) {
    const defaultCity = lang === 'en' ? 'Tbilisi' : lang === 'ru' ? 'Тбилиси' : 'თბილისი';
    return {
      ...coords,
      cityName: defaultCity,
      canonicalKey: 'tbilisi',
    };
  }

  return coords;
}
