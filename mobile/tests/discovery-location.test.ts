import { foregroundFix } from '../src/discovery/location';
import * as Location from 'expo-location';
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn(),
}));
beforeEach(() => jest.clearAllMocks());
test('does not request OS permission without explicit app consent', async () => {
  await expect(foregroundFix(false)).rejects.toThrow('location_consent_required');
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});
test('denied permission does not query location or substitute invented coordinates', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: false } as Location.LocationPermissionResponse);
  await expect(foregroundFix(true)).rejects.toThrow('location_denied');
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test('one explicit foreground request supplies the current fix', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 41.71, longitude: 44.82 } } as Location.LocationObject);
  expect(await foregroundFix(true)).toEqual({ latitude: 41.71, longitude: 44.82 });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
});
