'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
import type { WidgetInfo } from 'react-native-android-widget';

import { CONFIG } from '@/shared/constants';

import { localClock, staleLabel, widgetButton } from './buttonState';
import { LeaderboardWidget } from './LeaderboardWidget';
import { MiniWidget } from './MiniWidget';
import { loadCachedSnapshot } from './snapshot';
import { loadDebugOverride, loadLocalState } from './state';

/** Names must match the widget entries in app.config.ts. */
export const WIDGET_NAMES = ['Leaderboard', 'Mini'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Build the JSX for one widget from the cached snapshot + local widget state. */
export async function renderWidgetFor(info: Pick<WidgetInfo, 'widgetName' | 'height'>) {
  const debug = await loadDebugOverride();
  const snapshot = debug ? debug.snapshot : await loadCachedSnapshot();
  const local = debug ? debug.local : await loadLocalState();
  const clock = debug ? debug.clock : snapshot ? localClock(snapshot.me.timezone) : null;
  const button = widgetButton(snapshot, local, clock);
  const stale = snapshot && !debug ? staleLabel(snapshot.generatedAt, CONFIG.WIDGET_STALE_HOURS) : null;

  if (info.widgetName === 'Mini') return <MiniWidget snapshot={snapshot} button={button} />;
  return <LeaderboardWidget snapshot={snapshot} button={button} stale={stale} height={info.height} />;
}
