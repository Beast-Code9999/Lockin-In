'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
/**
 * Calendar (resizable 4×1 → 5×4): your history as a grid of weeks.
 *   4×1  compact heatmap strip
 *   4×2+ header ("18 clean in Dec · 🔥 29") + month labels + dates + weekday labels
 * Tap → History tab.
 */
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { copy } from '@/copy/en';

import { calendarGrid, calendarLayout, calendarSvg, monthStats } from './calendar';
import { localClock } from './buttonState';
import { FONT_DISPLAY, Pixel, W } from './parts';
import type { WidgetSnapshot } from './snapshot';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function CalendarWidget({ snapshot, width, height, today }: { snapshot: WidgetSnapshot | null; width: number; height: number; today?: string }) {
  const l = calendarLayout(width, height);
  const day = today ?? (snapshot ? localClock(snapshot.me.timezone).today : new Date().toISOString().slice(0, 10));
  const history = snapshot?.history ?? null;
  const svg = calendarSvg(calendarGrid(history, day, l.cols), l);
  const me = snapshot?.members.find((m) => m.uid === snapshot.me.uid);
  const stats = monthStats(history, day);
  const month = MONTHS[Number(day.slice(5, 7)) - 1] ?? '';

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'lockinin://history' }}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: l.padding,
        borderRadius: 24,
        backgroundGradient: { from: W.bgTop, to: W.bgBottom, orientation: 'TOP_BOTTOM' },
        flexGap: 6,
      }}
    >
      {l.headerHeight ? (
        <FlexWidget style={{ width: 'match_parent', height: l.headerHeight, flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          <Pixel name="brand/padlock" size={16} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={snapshot ? copy.widget.calendarTitle(stats.clean, month) : copy.widget.calendarEmpty} style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: W.text }} maxLines={1} truncate="END" />
          </FlexWidget>
          {me ? (
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 2 }}>
              <Pixel name={`flame/tier${me.flameTier}`} size={14} />
              <TextWidget text={String(me.streak)} style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: me.flameTier === 4 ? W.aqua : W.gold }} />
            </FlexWidget>
          ) : null}
        </FlexWidget>
      ) : null}
      <SvgWidget svg={svg} style={{ width: l.svgWidth, height: l.svgHeight }} />
    </FlexWidget>
  );
}
