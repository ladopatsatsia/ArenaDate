import * as Location from 'expo-location';
// Called only after the user's explicit explanation/consent button; never on mount/resume.
export async function foregroundFix(consent: boolean): Promise<{ latitude: number; longitude: number }> {
  if (!consent) throw new Error('location_consent_required');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('location_denied');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('location_unavailable')), 15000); }),
    ]);
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  } finally { clearTimeout(timeout); }
}
