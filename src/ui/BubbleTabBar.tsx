import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameText } from './GameText';
import { haptics } from './haptics';
import type { PixelAssetKey } from './pixelAssets.generated';
import { Sprite } from './Sprite';
import { colours, gloss, radii, TAB_BAR_HEIGHT } from './theme';

const TAB_ICONS: Record<string, PixelAssetKey> = {
  index: 'tab/home',
  leaderboard: 'tab/leaderboard',
  votes: 'tab/votes',
  history: 'tab/history',
  profile: 'tab/profile',
};

function TabButton({ focused, label, icon, badge, onPress }: { focused: boolean; label: string; icon: PixelAssetKey; badge?: string | number; onPress: () => void }) {
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.set(withSpring(focused ? 1 : 0, { damping: 13, stiffness: 240 }));
  }, [focused, progress]);
  const bubbleStyle = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ scale: 0.6 + progress.get() * 0.4 }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.get() * 2 }, { scale: 1 + progress.get() * 0.12 }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
    >
      <Animated.View style={[styles.activeBubble, bubbleStyle]}>
        <View style={styles.activeShine} />
      </Animated.View>
      <Animated.View style={iconStyle}>
        <Sprite name={icon} size={28} tint={focused ? undefined : colours.textFaint} />
        {badge !== undefined ? (
          <View style={styles.badge}>
            <GameText variant="tag" colour={colours.white} shadow={false} style={styles.badgeText}>
              {badge}
            </GameText>
          </View>
        ) : null}
      </Animated.View>
      <GameText variant="caption" tone={focused ? 'text' : 'faint'} numberOfLines={1} adjustsFontSizeToFit style={styles.label}>
        {label}
      </GameText>
    </Pressable>
  );
}

/** Floating, bubbly tab bar with pixel icons (inactive icons are muted silhouettes). */
export function BubbleTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 10 }]}>
      <View style={styles.lip}>
        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key]?.options;
            const label = typeof options?.title === 'string' ? options.title : route.name;
            const onPress = () => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptics.tick();
                navigateToTab(route.key);
              }
            };
            return (
              <TabButton
                key={route.key}
                focused={focused}
                label={label}
                icon={TAB_ICONS[route.name] ?? 'tab/home'}
                badge={options?.tabBarBadge}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  lip: { borderRadius: radii.xl, backgroundColor: colours.abyss, paddingBottom: 4 },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: radii.xl,
    backgroundColor: colours.surface,
    borderWidth: 2,
    borderColor: colours.stroke,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 },
  activeBubble: {
    position: 'absolute',
    top: 6,
    width: 52,
    height: 40,
    borderRadius: 20,
    backgroundColor: colours.surface2,
    borderWidth: 2,
    borderColor: colours.primary,
  },
  activeShine: { position: 'absolute', top: 4, left: 9, width: 14, height: 4, borderRadius: 2, backgroundColor: gloss(0.3) },
  label: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colours.slipped,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colours.surface,
  },
  badgeText: { fontSize: 14, lineHeight: 15 },
});
