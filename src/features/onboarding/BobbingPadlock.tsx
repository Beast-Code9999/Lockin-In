import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Sprite } from '@/ui';

/** The brand padlock, gently bobbing like it's floating in a bubble. */
export function BobbingPadlock({ size = 132 }: { size?: number }) {
  const still = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!still) t.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [still, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * t.get() }, { rotate: `${(t.get() - 0.5) * 6}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Sprite name="brand/padlock" size={size} accessibilityLabel="Lockin' In padlock" />
    </Animated.View>
  );
}
