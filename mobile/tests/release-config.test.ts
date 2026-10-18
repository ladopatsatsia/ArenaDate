describe('Mobile Release Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('development configuration loads with local defaults and security descriptors', () => {
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.EXPO_PUBLIC_API_URL;
    const config = require('../app.config').default;
    expect(config.name).toBe('ARENA');
    expect(config.slug).toBe('dating-mvp');
    expect(config.version).toBe('0.1.0');
    expect(config.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(config.ios?.supportsTablet).toBe(false);
    expect(config.ios?.infoPlist?.NSPhotoLibraryUsageDescription).toBe('Choose photos for your dating profile.');
    expect(config.ios?.infoPlist?.NSLocationWhenInUseUsageDescription).toBe('Use your approximate area to find nearby people.');
    expect(config.android?.permissions).toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(config.android?.permissions).toContain('android.permission.POST_NOTIFICATIONS');
    expect(config.android?.blockedPermissions).toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
    expect(config.icon).toBe('./assets/icon.png');
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe('./assets/adaptive-icon.png');
  });

  test('production profile fails if HTTPS API URL is missing or insecure', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'http://insecure.example.com';
    process.env.IOS_BUNDLE_IDENTIFIER = 'com.datingmvp.app';
    process.env.ANDROID_APPLICATION_ID = 'com.datingmvp.app';
    process.env.EAS_PROJECT_ID = '00000000-0000-0000-0000-000000000000';
    expect(() => require('../app.config')).toThrow(/Preview\/production requires HTTPS API URL/);
  });

  test('production profile fails if bundle identifier or package is missing', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.datingmvp.example.com';
    delete process.env.IOS_BUNDLE_IDENTIFIER;
    process.env.ANDROID_APPLICATION_ID = 'com.datingmvp.app';
    process.env.EAS_PROJECT_ID = '00000000-0000-0000-0000-000000000000';
    expect(() => require('../app.config')).toThrow(/Preview\/production requires HTTPS API URL and owner-provided bundle/);
  });

  test('production profile loads properly with valid environment variables', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.datingmvp.example.com';
    process.env.IOS_BUNDLE_IDENTIFIER = 'com.datingmvp.app';
    process.env.ANDROID_APPLICATION_ID = 'com.datingmvp.app';
    process.env.EAS_PROJECT_ID = '12345678-1234-1234-1234-123456789abc';
    process.env.IOS_BUILD_NUMBER = '42';
    process.env.ANDROID_VERSION_CODE = '42';
    process.env.APP_ASSOCIATED_DOMAIN = 'api.datingmvp.example.com';

    const config = require('../app.config').default;
    expect(config.ios?.bundleIdentifier).toBe('com.datingmvp.app');
    expect(config.ios?.buildNumber).toBe('42');
    expect(config.ios?.associatedDomains).toEqual(['applinks:api.datingmvp.example.com']);
    expect(config.android?.package).toBe('com.datingmvp.app');
    expect(config.android?.versionCode).toBe(42);
    expect(config.extra?.eas?.projectId).toBe('12345678-1234-1234-1234-123456789abc');
  });
});
