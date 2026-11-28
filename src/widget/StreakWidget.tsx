'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
/**
 * Streak (2×2): big flame + streak, rank, XP bar to the next rank, and a check-in pill.
 *      🔥 29
 *    day streak
 *   DISCIPLINED ▮▮▮▮▯
 *   [ ✓ CHECK IN ]
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { copy } from '@/copy/en';

import type { WidgetButton } from './buttonState';
import { buttonLook, FONT_BODY, FONT_DISPLAY, Pixel, W } from './parts';
import type { WidgetSnapshot } from './snapshot';

export function StreakWidget({ snapshot, button, height }: { snapshot: WidgetSnapshot | null; button: WidgetButton; height: number }) {
  const me = snapshot?.members.find((m) => m.uid === snapshot.me.uid);
  const look = buttonLook(button);
  const compact = height < 150;
  const flame = compact ? 34 : 48;
  const fraction = !me ? 0 : me.xp.next === null ? 1 : me.xp.next <= 0 ? 0 : Math.min(1, me.xp.current / me.xp.next);
  const filled = Math.round(fraction * 8);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 24,
        backgroundGradient: { from: W.bgTop, to: W.bgBottom, orientation: 'TOP_BOTTOM' },
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
        <Pixel name={`flame/tier${me?.flameTier ?? 0}`} size={flame} />
        <TextWidget
          text={String(me?.streak ?? 0)}
          style={{ fontFamily: FONT_DISPLAY, fontSize: compact ? 40 : 54, color: me?.flameTier === 4 ? W.aqua : W.gold }}
        />
      </FlexWidget>
      <TextWidget text={copy.widget.dayStreak} style={{ fontFamily: FONT_BODY, fontSize: 12, color: W.muted }} />

      {me ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', alignItems: 'center', flexGap: 3 }}>
          <TextWidget text={me.rank.toUpperCase()} style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: W.text }} maxLines={1} />
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 2, padding: 2, borderRadius: 6, backgroundColor: '#050D24' }}>
            {Array.from({ length: 8 }, (_, i) => (
              <FlexWidget key={i} style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: i < filled ? W.aqua : '#16306F' }} />
            ))}
          </FlexWidget>
        </FlexWidget>
      ) : null}

      <FlexWidget
        clickAction={look.action === 'NONE' ? 'OPEN_APP' : look.action}
        clickActionData={look.data}
        style={{ width: 'match_parent', height: 26, borderRadius: 13, backgroundColor: look.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <TextWidget text={look.label} style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: look.fg }} maxLines={1} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  );
}
