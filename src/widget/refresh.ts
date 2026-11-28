/**
 * Widget refresh helpers (SPEC §12.6). Android only; safe no-ops elsewhere.
 * Triggers: app foreground, after your own check-in, `group_updated` pushes,
 * the 30-minute periodic update, and widget added/resized.
 */
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { flushQueue } from '@/lib/offlineQueue';

import { renderWidgetFor, WIDGET_NAMES } from './render';
import { fetchSnapshot, saveSnapshot } from './snapshot';
import { patchLocalState } from './state';

/** Re-render every placed widget from the cache (no network). */
export async function updateWidgets(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    WIDGET_NAMES.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: (info) => renderWidgetFor(info) }).catch(() => undefined)),
  );
}

let inFlight: Promise<boolean> | null = null;

/** Flush queued check-ins, fetch a fresh snapshot, cache it. Returns false if offline. */
export function refreshSnapshot(): Promise<boolean> {
  inFlight ??= (async () => {
    try {
      const synced = await flushQueue().catch(() => 0);
      if (synced) await patchLocalState({ queuedDate: null });
      const snapshot = await fetchSnapshot();
      await saveSnapshot(snapshot);
      return true;
    } catch {
      return false; // offline: keep rendering the cached snapshot
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function refreshWidgets(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await refreshSnapshot();
  await patchLocalState({ justGained: null });
  await updateWidgets();
}

/** On sign-out: forget the crew and show "Sign in". */
export async function clearWidgets(): Promise<void> {
  await saveSnapshot(null);
  await updateWidgets();
}
