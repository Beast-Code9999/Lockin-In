import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_LOCAL_STATE, type WidgetLocalState } from './buttonState';
import type { WidgetSnapshot } from './snapshot';

const LOCAL_KEY = 'widget_local_v1';
const DEBUG_KEY = 'widget_debug_override_v1';

export async function loadLocalState(): Promise<WidgetLocalState> {
  try {
    return { ...EMPTY_LOCAL_STATE, ...(JSON.parse((await AsyncStorage.getItem(LOCAL_KEY)) ?? '{}') as Partial<WidgetLocalState>) };
  } catch {
    return EMPTY_LOCAL_STATE;
  }
}

export async function patchLocalState(patch: Partial<WidgetLocalState>): Promise<WidgetLocalState> {
  const next = { ...(await loadLocalState()), ...patch };
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  return next;
}

/** DEV ONLY: the Widget Debug screen can pin a fake snapshot + state onto the real home-screen widget. */
export type DebugOverride = { snapshot: WidgetSnapshot | null; local: WidgetLocalState; clock: { today: string; time: string } };

export async function loadDebugOverride(): Promise<DebugOverride | null> {
  if (!__DEV__) return null;
  try {
    const raw = await AsyncStorage.getItem(DEBUG_KEY);
    return raw ? (JSON.parse(raw) as DebugOverride) : null;
  } catch {
    return null;
  }
}

export async function setDebugOverride(override: DebugOverride | null): Promise<void> {
  if (override) await AsyncStorage.setItem(DEBUG_KEY, JSON.stringify(override));
  else await AsyncStorage.removeItem(DEBUG_KEY);
}
