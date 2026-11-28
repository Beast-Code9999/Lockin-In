/**
 * App entry (SPEC §19). Besides booting expo-router, this registers the two things
 * that must also run headless (app closed): the widget task handler and the FCM
 * background message handler. Both are Android-only.
 */
import 'expo-router/entry';

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  /* eslint-disable @typescript-eslint/no-require-imports -- loaded lazily so iOS never touches Android-only native modules */
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/widgetTaskHandler') as typeof import('./src/widget/widgetTaskHandler');
  const { registerBackgroundPushHandler } = require('./src/lib/push') as typeof import('./src/lib/push');
  /* eslint-enable @typescript-eslint/no-require-imports */
  registerWidgetTaskHandler(widgetTaskHandler);
  registerBackgroundPushHandler();
}
