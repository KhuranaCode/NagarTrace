# NagarTrace native app (Expo / React Native)

## Prerequisites
- Node 20+, JDK 17, Android SDK (for APK), Xcode on macOS (for iOS)
- `npm ci` (lockfile: package-lock.json included)

## Web preview
`npx expo start --web` then open the printed URL. Optional test-only hooks:
- `EXPO_PUBLIC_MOCK_AUTH=1 EXPO_PUBLIC_API_URL=<mock-server-url>` renders with an isolated mock server (never the live API).
- These hooks are env-gated; the released build compiles them out (no public flag/URL can enable them).

## Android APK (release)
1. `npx expo prebuild --platform android` (regenerates `android/`)
2. Create `android/keystore.props` locally (NOT committed) pointing to your upload keystore, and wire a release signingConfig in `android/app/build.gradle`.
3. `cd android && ./gradlew :app:assembleRelease` -> `app/build/outputs/apk/release/app-release.apk`
4. Note: if `expo.inlineModules.watchedDirectories=[]` is the last line of gradle.properties, ensure your appended lines start on a NEW line or `:expo:generateInlineModules` fails with a JSON parse error.

## iOS
Requires macOS + Xcode. EAS Build alternative needs an Expo account/Apple Developer membership (paid). Not yet built.

## Secrets policy
Never commit: upload keystores, keystore.props, .env, service keys. The Supabase publishable key in src/config.ts is client-safe by design (same key already ships in the public website) and is enforced by Row Level Security.
