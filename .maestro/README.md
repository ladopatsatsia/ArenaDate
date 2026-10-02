# Native E2E Testing with Maestro

This directory contains reproducible end-to-end flows for iOS and Android using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. Install Maestro CLI:
   - macOS / Linux: `curl -FsSL "https://get.maestro.mobile.dev" | bash`
   - Windows: follow official Maestro instructions or run via WSL / macOS runner.
2. Build and install the development client / release APK or .app:
   - Android: `npm run android` or build APK via EAS: `eas build --platform android --profile development`
   - iOS: `npm run ios` or build simulator app via EAS: `eas build --platform ios --profile development`
3. Launch your emulator / simulator or connect a physical device.

## Running the Flows

### iOS
```bash
maestro test .maestro/ios/flow.yaml
```

### Android
```bash
maestro test .maestro/android/flow.yaml
```

## Covered Scenarios
- **Onboarding & Authentication**: App launch, welcome screen, registration with age validation (18+), email verification code entry.
- **Discovery & Swiping**: Viewing candidate profile card, accessible swipe gestures.
- **Match Notification**: Mutual match confirmation modal and navigation.
- **Real-Time Chat**: Opening match, composing message, sending with keyboard safety and persistence.
- **Safety Actions**: Accessing safety actions, blocking the user, and confirming state isolation.
