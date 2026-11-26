/**
 * Minimal Reanimated mock for Jest. Reanimated 4.7's bundled `react-native-reanimated/mock`
 * still initialises the real module (it needs a worklets runtime), so we mock just the
 * surface the UI kit uses. Animations resolve instantly to their target value.
 */
const React = require('react');
const RN = require('react-native');

function makeSharedValue(initial) {
  let current = initial;
  return {
    get value() {
      return current;
    },
    set value(next) {
      current = next;
    },
    get: () => current,
    set: (next) => {
      current = typeof next === 'function' ? next(current) : next;
    },
  };
}

const identityEasing = (t) => t;
const Easing = new Proxy({}, { get: () => () => identityEasing });
const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  createAnimatedComponent: (component) => component,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  Easing,
  useSharedValue: (initial) => React.useRef(makeSharedValue(initial)).current,
  useAnimatedStyle: (factory) => factory(),
  useReducedMotion: () => false,
  withTiming: (to) => to,
  withSpring: (to) => to,
  withDelay: (_ms, animation) => animation,
  withRepeat: (animation) => animation,
  withSequence: (...animations) => animations[animations.length - 1],
  runOnJS: (fn) => fn,
};
