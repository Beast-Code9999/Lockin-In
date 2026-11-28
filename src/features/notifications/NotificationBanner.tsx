import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BubbleCard, GameText, haptics } from '@/ui';

import { useBanner } from './banner';

const VISIBLE_MS = 4500;

/** Slides in from the top when a notification arrives while the app is open. Tap to open it. */
export function NotificationBanner() {
  const banner = useBanner((s) => s.banner);
  const dismiss = useBanner((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!banner) return;
    haptics.tap();
    const t = setTimeout(() => dismiss(banner.id), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [banner, dismiss]);

  if (!banner) return null;
  return (
    <Animated.View key={banner.id} entering={SlideInUp.springify().damping(16)} exiting={SlideOutUp} style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the notification"
        onPress={() => {
          dismiss(banner.id);
          // Links are allow-listed by routeForLink before they get here.
          router.push(banner.link as Href);
        }}
      >
        <BubbleCard tone="glow" padding="md" contentStyle={styles.card}>
          <GameText variant="label">{banner.title}</GameText>
          {banner.body ? (
            <GameText variant="small" tone="muted">
              {banner.body}
            </GameText>
          ) : null}
        </BubbleCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 100 },
  card: { gap: 2 },
});
