import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Sprite } from './Sprite';
import { gloss } from './theme';

// Positions are fractions of the screen so the layout holds on any phone.
const BUBBLES = [
  { x: 0.07, y: 0.16, r: 24, period: 5200 },
  { x: 0.88, y: 0.07, r: 13, period: 4300 },
  { x: 0.82, y: 0.36, r: 38, period: 6400 },
  { x: 0.1, y: 0.55, r: 11, period: 3900 },
  { x: 0.94, y: 0.66, r: 19, period: 5600 },
  { x: 0.16, y: 0.84, r: 32, period: 7000 },
  { x: 0.66, y: 0.93, r: 9, period: 4600 },
] as const;

const SPARKLES = [
  { x: 0.3, y: 0.05, delay: 0 },
  { x: 0.64, y: 0.21, delay: 900 },
  { x: 0.04, y: 0.34, delay: 1700 },
  { x: 0.9, y: 0.5, delay: 400 },
  { x: 0.44, y: 0.73, delay: 1300 },
] as const;

function FloatingBubble({ x, y, r, period, width, height, still }: (typeof BUBBLES)[number] & { width: number; height: number; still: boolean }) {
  const t = useSharedValue(0.5);
  useEffect(() => {
    if (still) return;
    t.set(withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [still, period, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (t.get() - 0.5) * 16 }] }));
  return (
    <Animated.View style={[styles.bubble, { left: x * width - r, top: y * height - r, width: r * 2, height: r * 2, borderRadius: r }, style]}>
      <View style={[styles.bubbleShine, { width: r * 0.42, height: r * 0.42, borderRadius: r, top: r * 0.32, left: r * 0.32 }]} />
    </Animated.View>
  );
}

function Twinkle({ x, y, delay, width, height, still }: (typeof SPARKLES)[number] & { width: number; height: number; still: boolean }) {
  const o = useSharedValue(still ? 0.6 : 0.15);
  useEffect(() => {
    if (still) return;
    o.set(withDelay(delay, withRepeat(withTiming(0.9, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true)));
  }, [still, delay, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={[styles.abs, { left: x * width, top: y * height }, style]}>
      <Sprite name="fx/sparkle" size={14} />
    </Animated.View>
  );
}

/** Decorative deep-sea backdrop: dithered pixel glow, drifting bubbles, twinkling sparkles. */
export function BubbleBackground() {
  const { width, height } = useWindowDimensions();
  const still = useReducedMotion();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Sprite name="fx/glow" size={width} style={styles.glow} />
      {BUBBLES.map((b, i) => (
        <FloatingBubble key={i} {...b} width={width} height={height} still={still} />
      ))}
      {SPARKLES.map((s, i) => (
        <Twinkle key={i} {...s} width={width} height={height} still={still} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  glow: { position: 'absolute', top: 0, left: 0, opacity: 0.38 },
  bubble: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: gloss(0.1),
    backgroundColor: gloss(0.025),
  },
  bubbleShine: { position: 'absolute', backgroundColor: gloss(0.16) },
});
