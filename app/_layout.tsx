import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initAuthListener, useAuthStore } from '@/features/auth/session';
import { queryClient, wireQueryFocus } from '@/lib/queryClient';
import { startSupabaseAutoRefresh } from '@/lib/supabase';
import { FONT_SOURCES } from '@/ui/fonts';
import { colours } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const status = useAuthStore((s) => s.status);

  useEffect(() => initAuthListener(), []);
  useEffect(() => startSupabaseAutoRefresh(), []);
  useEffect(() => wireQueryFocus(), []);

  const ready = (fontsLoaded || fontError !== null) && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  const signedIn = status === 'signedIn';

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.root, animation: 'fade' }}>
          {/* Explicit redirects: without them the router falls back to the first available
              route alphabetically, which would be dev/ui-kit in dev builds. */}
          <Stack.Protected guard={signedIn} redirectTo="/onboarding">
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn} redirectTo="/">
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={__DEV__}>
            <Stack.Screen name="dev/ui-kit" options={{ animation: 'slide_from_bottom' }} />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.bg },
});
