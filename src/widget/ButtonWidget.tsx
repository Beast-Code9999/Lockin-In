'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
/**
 * Lock-in button (1×1): tap → "Sure?" → tap = checked in, without opening the app.
 *   ( 🔒 )
 *   Lock in
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { buttonFace } from './buttonFace';
import type { WidgetButton } from './buttonState';
import { FONT_DISPLAY, Pixel, W } from './parts';
import type { WidgetSnapshot } from './snapshot';

export function ButtonWidget({ snapshot, button, width, height }: { snapshot: WidgetSnapshot | null; button: WidgetButton; width: number; height: number }) {
  const me = snapshot?.members.find((m) => m.uid === snapshot.me.uid);
  const face = buttonFace(button, me?.streak ?? null);
  const disc = Math.max(34, Math.min(64, Math.min(width - 16, height - 34)));
  const ringWidth = Math.max(3, Math.round(disc / 14));
  return (
    <FlexWidget
      clickAction={face.action}
      clickActionData={face.data}
      accessibilityLabel={face.label}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        backgroundGradient: { from: W.bgTop, to: W.bgBottom, orientation: 'TOP_BOTTOM' },
        flexGap: 4,
      }}
    >
      <FlexWidget
        clickAction={face.action}
        clickActionData={face.data}
        style={{
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          borderWidth: ringWidth,
          borderColor: face.ring,
          backgroundColor: face.fill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {face.icon ? (
          <Pixel name={face.icon} size={Math.round(disc * 0.55)} />
        ) : (
          <TextWidget text={face.glyph ?? ''} style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(disc * 0.6), color: face.fill === face.ring ? W.goldInk : face.ring }} />
        )}
      </FlexWidget>
      <TextWidget text={face.label} style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: face.labelColour }} maxLines={1} truncate="END" />
    </FlexWidget>
  );
}
