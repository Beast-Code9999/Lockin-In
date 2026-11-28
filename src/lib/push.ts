/**
 * Push (SPEC §12.6, §18.3): FCM only. Android-first; iOS is skipped until it has its own Firebase config.
 * `group_updated` data messages refresh the widget (and the app's data when it's open).
 */
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

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
  }
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
