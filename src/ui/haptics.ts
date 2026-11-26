import * as Haptics from 'expo-haptics';

/** Fire-and-forget haptics. Never throws (unsupported devices, tests, web). */
export const haptics = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  thunk: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
  tick: () => void Haptics.selectionAsync().catch(() => undefined),
};
