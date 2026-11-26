/**
 * App entry (SPEC §19).
 * M0: boots expo-router.
 * M3 adds: the react-native-android-widget task handler and the FCM background
 * message handler — both must be registered here, before the router mounts,
 * because they also run headless (no UI) when the app is closed.
 */
import 'expo-router/entry';
