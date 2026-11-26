import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { GameText } from './GameText';
import { haptics } from './haptics';
import type { PixelAssetKey } from './pixelAssets.generated';
import { Sprite } from './Sprite';
import { colours, gloss } from './theme';

const VARIANTS = {
  primary: { face: colours.primary, lip: colours.primaryLip, label: colours.white, shine: 0.3 },
  clean: { face: colours.clean, lip: colours.cleanLip, label: colours.cleanInk, shine: 0.45 },
  gold: { face: colours.gold, lip: colours.goldLip, label: colours.goldInk, shine: 0.45 },
  danger: { face: colours.slipped, lip: colours.slippedLip, label: colours.white, shine: 0.3 },
  secondary: { face: colours.surface2, lip: colours.abyss, label: colours.text, shine: 0.1 },
} as const;
const DISABLED = { face: '#1A2B5C', lip: '#0B1638', label: colours.textFaint, shine: 0.06 };

const SIZES = {
  lg: { height: 64, lip: 6, px: 26, icon: 28, font: 28 },
  md: { height: 52, lip: 5, px: 22, icon: 22, font: 24 },
  sm: { height: 40, lip: 4, px: 16, icon: 18, font: 20 },
} as const;

export type BubbleButtonVariant = keyof typeof VARIANTS;

export type BubbleButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: BubbleButtonVariant;
  size?: keyof typeof SIZES;
  icon?: PixelAssetKey;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Haptic on press-in. Defaults to a light tap. */
  haptic?: 'tap' | 'thunk' | 'none';
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The signature "bubble" button: a glossy pill face sitting on a solid lip.
 * Pressing squishes the face down onto the lip with a springy release.
 */
export function BubbleButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  haptic = 'tap',
  accessibilityHint,
  testID,
  style,
}: BubbleButtonProps) {
  const pressed = useSharedValue(0);
  const v = disabled ? DISABLED : VARIANTS[variant];
  const s = SIZES[size];
  const radius = s.height / 2;
  const inactive = disabled || loading;

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.get() * (s.lip - 1) }, { scale: 1 - pressed.get() * 0.015 }],
  }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={6}
      onPress={onPress}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: 60 }));
        if (haptic !== 'none') haptics[haptic]();
      }}
      onPressOut={() => {
        pressed.set(withSpring(0, { damping: 10, stiffness: 340, mass: 0.6 }));
      }}
      style={[fullWidth ? styles.fullWidth : styles.hug, style]}
    >
      <View style={[styles.lip, { backgroundColor: v.lip, borderRadius: radius, paddingBottom: s.lip }]}>
        <Animated.View
          style={[styles.face, { backgroundColor: v.face, borderRadius: radius, height: s.height, paddingHorizontal: s.px }, faceStyle]}
        >
          <View pointerEvents="none" style={[styles.shine, { borderRadius: radius, backgroundColor: gloss(v.shine) }]} />
          <View pointerEvents="none" style={[styles.shineDot, { backgroundColor: gloss(Math.min(0.9, v.shine * 2)) }]} />
          {loading ? (
            <ActivityIndicator color={v.label} />
          ) : (
            <>
              {icon ? <Sprite name={icon} size={s.icon} /> : null}
              <GameText
                variant="label"
                colour={v.label}
                shadow={variant !== 'clean' && variant !== 'gold'}
                style={{ fontSize: s.font, lineHeight: s.font + 2 }}
                numberOfLines={1}
              >
                {label}
              </GameText>
            </>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hug: { alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  lip: { overflow: 'visible' },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  shine: { position: 'absolute', top: 4, left: 14, right: 14, height: '34%' },
  shineDot: { position: 'absolute', top: 7, left: 10, width: 6, height: 6, borderRadius: 3 },
});
