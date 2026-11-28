/**
 * Push (SPEC §12.6, §13, §18.3): FCM only. Android-first; iOS is skipped until it has its own Firebase config.
 *   • `group_updated` data messages refresh the widget (and the app's data when it's open).
 *   • Visible notifications are shown by Android when the app is in the background; while it's
 *     open they appear as an in-app banner. Tapping either opens `data.link`.
 */
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

import { useBanner } from '@/features/notifications/banner';
import { routeForLink, type AppLink } from '@/features/notifications/links';
import { refreshWidgets } from '@/widget/refresh';

import { queryClient } from './queryClient';
import { supabase } from './supabase';

async function register(token: string): Promise<void> {
  await supabase.rpc('register_device', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
}

async function handle(message: RemoteMessage, foreground: boolean): Promise<void> {
  if (message.data?.type === 'group_updated') {
    await refreshWidgets();
    if (foreground) await queryClient.invalidateQueries({ queryKey: ['home'] });
    return;
  }
  if (foreground && message.notification) {
    useBanner.getState().show({
      title: message.notification.title ?? '',
      body: message.notification.body ?? '',
      link: routeForLink(message.data?.link),
    });
  }
}

/** Android 13+ asks before showing notifications. Asked once the player is in the game. */
async function askPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return;
  await PermissionsAndroid.request(permission);
}

/** Call once at startup (index.ts) so pushes are handled while the app is closed. */
export function registerBackgroundPushHandler(): void {
  if (Platform.OS !== 'android') return;
  setBackgroundMessageHandler(getMessaging(), (message) => handle(message, false));
}

/** Call when a player is signed in: registers this phone and listens while the app is open. */
export function startPush(): () => void {
  if (Platform.OS !== 'android') return () => undefined;
  const messaging = getMessaging();
  askPermission().catch(() => undefined);
  getToken(messaging)
    .then(register)
    .catch(() => undefined);
  const offRefresh = onTokenRefresh(messaging, (token) => void register(token).catch(() => undefined));
  const offMessage = onMessage(messaging, (message) => void handle(message, true));
  return () => {
    offRefresh();
    offMessage();
  };
}

/** Taps on a system notification: the one that launched the app, and any while it's backgrounded. */
export function startNotificationTaps(open: (link: AppLink) => void): () => void {
  if (Platform.OS !== 'android') return () => undefined;
  const messaging = getMessaging();
  getInitialNotification(messaging)
    .then((message) => {
      if (message) open(routeForLink(message.data?.link));
    })
    .catch(() => undefined);
  return onNotificationOpenedApp(messaging, (message) => open(routeForLink(message.data?.link)));
}
