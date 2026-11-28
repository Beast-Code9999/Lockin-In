import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { copy } from '@/copy/en';
import { initAuthListener, useAuthStore } from '@/features/auth/session';
import { onboardingStage } from '@/features/home/types';
import { useHome } from '@/features/home/useHome';
import { startPush } from '@/lib/push';
import { queryClient, wireQueryFocus } from '@/lib/queryClient';
import { startSupabaseAutoRefresh } from '@/lib/supabase';
import { BubbleButton, EmptyState, Screen } from '@/ui';
import { FONT_SOURCES } from '@/ui/fonts';
import { colours } from '@/ui/theme';
import { refreshWidgets } from '@/widget/refresh';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  useEffect(() => initAuthListener(), []);
  useEffect(() => startSupabaseAutoRefresh(), []);
  useEffect(() => wireQueryFocus(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        {fontsLoaded || fontError ? <RootNavigator /> : null}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Routing gate:
 *   signed out                      → onboarding (welcome, sign-in)
 *   signed in, no crew / no Pact    → setup (profile, clock, crew, Pact)
 *   signed in and in the game       → (tabs)
 */
function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const signedIn = status === 'signedIn';
  const home = useHome();
  const stage = home.data ? onboardingStage(home.data) : null;

  const ready = status !== 'loading' && (!signedIn || home.data !== undefined || home.isError);
  const inGameNow = signedIn && stage === 'done';

  // Register this phone for pushes and keep the home-screen widget fresh (SPEC §12.6).
  useEffect(() => {
    if (!inGameNow) return;
    const stopPush = startPush();
    void refreshWidgets();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshWidgets();
    });
    return () => {
      stopPush();
      sub.remove();
    };
  }, [inGameNow]);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  if (signedIn && !home.data) {
    return (
      <Screen>
        <EmptyState
          icon="status/pending"
          title={copy.home.loadError}
          body={copy.errors.NETWORK}
          action={<BubbleButton label={copy.home.retry} onPress={() => void home.refetch()} />}
        />
      </Screen>
    );
  }

  const inGame = signedIn && stage === 'done';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: styles.root, animation: 'fade' }}>
      {/* Explicit redirects: without them the router falls back to the first available
          route alphabetically, which would be dev/ui-kit in dev builds. */}
      <Stack.Protected guard={inGame} redirectTo={signedIn ? '/setup' : '/onboarding'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/[uid]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !inGame} redirectTo={signedIn ? '/' : '/onboarding'}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev/ui-kit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="dev/widgets" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.bg },
});
