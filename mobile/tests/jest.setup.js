jest.mock('react-native/Libraries/Core/Devtools/getDevServer', () => () => ({
  url: 'http://localhost:8081/',
  bundleLoadedFromServer: false,
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  digestStringAsync: jest.fn(async () => 'mocked-hash'),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  CryptoEncoding: {
    HEX: 'hex',
    BASE64: 'base64',
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
}));
