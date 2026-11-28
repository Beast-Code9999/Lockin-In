'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
/**
 * MiniWidget (SPEC §12.4) — 2×1 personal status.
 *  [ava] 🔥29  #2 · 498
 *        ✓ Locked in
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { copy } from '@/copy/en';

import type { WidgetButton } from './buttonState';
import { buttonLook, FONT_DISPLAY, Pixel, W, WidgetAvatar } from './parts';
import type { WidgetSnapshot } from './snapshot';

export function MiniWidget({ snapshot, button }: { snapshot: WidgetSnapshot | null; button: WidgetButton }) {
  const me = snapshot?.members.find((m) => m.uid === snapshot.me.uid);
  const look = buttonLook(button);
  return (
    <FlexWidget
      clickAction={look.action === 'NONE' ? 'OPEN_APP' : look.action}
      clickActionData={look.data}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 22,
        backgroundGradient: { from: W.bgTop, to: W.bgBottom, orientation: 'TOP_BOTTOM' },
        flexGap: 8,
      }}
    >
      {me ? <WidgetAvatar layers={me.avatarLayers} size={40} /> : <Pixel name="brand/padlock" size={36} />}
      <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 2 }}>
        {me ? (
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <Pixel name={`flame/tier${me.flameTier}`} size={16} />
            <TextWidget text={String(me.streak)} style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: me.flameTier === 4 ? W.aqua : W.gold }} />
            <TextWidget text={copy.widget.position(me.position, me.score30d)} style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: W.text }} />
          </FlexWidget>
        ) : null}
        <FlexWidget style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: look.bg }}>
          <TextWidget text={look.label} style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: look.fg }} maxLines={1} truncate="END" />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
