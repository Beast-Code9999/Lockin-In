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
  version: '0.4.0',
  orientation: 'portrait',
  scheme: 'lockinin',
  userInterfaceStyle: 'dark',
  backgroundColor: BG,
  icon: './assets/images/icon.png',
  android: {
    package: 'com.jasonlay.lockinin',
    // Bump on every APK you hand out so Android installs it as an update.
    versionCode: 4,
    adaptiveIcon: {
      backgroundColor: '#2F7BFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Firebase (FCM only, Spark plan). Downloaded from the Firebase console; gitignored.
    googleServicesFile: './google-services.json',
  },
  ios: {
    bundleIdentifier: 'com.jasonlay.lockinin',
    supportsTablet: false,
  },
  plugins: [
    'expo-router',
    './plugins/withGradleMemory',
    ['expo-splash-screen', { backgroundColor: BG, image: './assets/images/splash-icon.png', imageWidth: 140 }],
    googleIosUrlScheme ? ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] : '@react-native-google-signin/google-signin',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    [
      'react-native-android-widget',
      {
        fonts: ['./assets/fonts/Jersey10-Regular.ttf', './assets/fonts/Nunito-ExtraBold.ttf'],
        widgets: [
          {
            // SPEC §12.1: LeaderboardWidget — 4×2 default, resizable to 4×3.
            name: 'Leaderboard',
            label: "Lockin' In crew board",
            description: 'Live leaderboard, streaks and one-tap check-in.',
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            maxResizeHeight: '320dp',
            resizeMode: 'horizontal|vertical',
            previewImage: './assets/images/widget-preview-leaderboard.png',
            updatePeriodMillis: 1800000,
          },
          {
            // SPEC §12.1: MiniWidget — 2×1 personal status.
            name: 'Mini',
            label: "Lockin' In me",
            description: 'Your streak, position and check-in.',
            minWidth: '110dp',
            minHeight: '40dp',
            targetCellWidth: 2,
            targetCellHeight: 1,
            resizeMode: 'horizontal',
            previewImage: './assets/images/widget-preview-mini.png',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
