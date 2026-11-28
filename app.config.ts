import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo app config. Values here are build-time only (not secrets).
 * Plugins added in later milestones: react-native-android-widget + @react-native-firebase (M3).
 */
const BG = '#081537';

// Reversed iOS client ID (com.googleusercontent.apps.XXXX) — only needed for iOS Google Sign-In.
const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Lockin' In",
  slug: 'lockinin',
  version: '0.3.0',
  orientation: 'portrait',
  scheme: 'lockinin',
  userInterfaceStyle: 'dark',
  backgroundColor: BG,
  icon: './assets/images/icon.png',
  android: {
    package: 'com.jasonlay.lockinin',
    // Bump on every APK you hand out so Android installs it as an update.
    versionCode: 3,
    adaptiveIcon: {
      backgroundColor: '#2F7BFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: 'com.jasonlay.lockinin',
    supportsTablet: false,
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: BG, image: './assets/images/splash-icon.png', imageWidth: 140 }],
    googleIosUrlScheme ? ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] : '@react-native-google-signin/google-signin',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
