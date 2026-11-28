'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
/**
 * Shared widget building blocks (react-native-android-widget → RemoteViews).
 * No animation or custom drawing in widgets: pre-rendered pixel PNGs + rounded
 * flex boxes in the Bubble Arcade palette (SPEC §12.8).
 */
import { FlexWidget, ImageWidget, OverlapWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import { copy } from '@/copy/en';
import { PIXEL_ASSETS, type PixelAssetKey } from '@/ui/pixelAssets.generated';

import type { WidgetButton } from './buttonState';
import type { TodayStatus } from './snapshot';

export const W = {
  bgTop: '#13286A',
  bgBottom: '#081537',
  row: '#0E2052',
  rowMe: '#1A3A8A',
  stroke: '#1F4294',
  aqua: '#7FE7FF',
  text: '#EAF4FF',
  muted: '#93AEDF',
  faint: '#5B76B0',
  ink: '#081537',
  clean: '#39FF88',
  cleanInk: '#04361C',
  gold: '#FFC94D',
  goldInk: '#3A2500',
  primary: '#2F7BFF',
  disabled: '#1A2B5C',
  slipped: '#FF4D6D',
} as const;

export const FONT_DISPLAY = 'Jersey10-Regular';
export const FONT_BODY = 'Nunito-ExtraBold';

export function Pixel({ name, size }: { name: string; size: number }) {
  const asset = PIXEL_ASSETS[name as PixelAssetKey];
  if (!asset) return <FlexWidget style={{ width: size, height: size }} />;
  return <ImageWidget image={asset.source} imageWidth={size} imageHeight={(size * asset.height) / asset.width} />;
}

/** Avatar layers stacked with OverlapWidget (rank bubble → character → state). */
export function WidgetAvatar({ layers, size }: { layers: string[]; size: number }) {
  return (
    <OverlapWidget style={{ width: size, height: size }}>
      {layers.map((key) => (
        <Pixel key={key} name={key} size={size} />
      ))}
    </OverlapWidget>
  );
}

const STATUS_ICON: Record<TodayStatus, PixelAssetKey> = {
  checked: 'status/checked',
  pending: 'status/pending',
  box: 'status/box',
  coward: 'status/coward',
  clown: 'status/clown',
  vacation: 'status/vacation',
  frozen: 'status/frozen',
};
export const statusIcon = (s: TodayStatus) => STATUS_ICON[s] ?? 'status/pending';

/** Truncate names for widget rows (SPEC §12.2: 10 characters). */
export const shortName = (name: string, max = 10) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

type ButtonLook = { label: string; bg: ColorProp; fg: ColorProp; action: string; data?: Record<string, unknown> };

export function buttonLook(b: WidgetButton): ButtonLook {
  switch (b.kind) {
    case 'signedOut':
      return { label: copy.widget.signIn, bg: W.primary, fg: '#FFFFFF', action: 'OPEN_APP' };
    case 'joinCrew':
      return { label: copy.widget.joinCrew, bg: W.primary, fg: '#FFFFFF', action: 'OPEN_APP' };
    case 'openBox':
      return { label: copy.widget.openBox, bg: W.gold, fg: W.goldInk, action: 'OPEN_URI', data: { uri: `lockinin://box/${b.boxId}` } };
    case 'opensLater':
      return { label: copy.widget.opensAt(b.opensAt === '17:00' ? '5pm' : b.opensAt), bg: W.disabled, fg: W.faint, action: 'OPEN_APP' };
    case 'backfill':
      return { label: copy.widget.checkInYesterday, bg: W.clean, fg: W.cleanInk, action: 'CHECK_IN', data: { date: b.date } };
    case 'ready':
      return { label: copy.widget.checkIn, bg: W.clean, fg: W.cleanInk, action: 'CHECK_IN', data: { date: b.date } };
    case 'confirm':
      return { label: copy.widget.confirm, bg: W.gold, fg: W.goldInk, action: 'CHECK_IN', data: { date: b.date } };
    case 'inFlight':
      return { label: copy.widget.inFlight, bg: W.rowMe, fg: W.text, action: 'NONE' };
    case 'queued':
      return { label: copy.widget.queued, bg: W.rowMe, fg: W.muted, action: 'OPEN_APP' };
    case 'done':
      return { label: b.gained ? copy.widget.gained(b.gained) : copy.widget.done, bg: '#0F3D2C', fg: W.clean, action: 'OPEN_APP' };
  }
}

/** The big pill at the bottom: a bubble face on a darker lip. */
export function WidgetButtonPill({ button, height = 40, fontSize = 20 }: { button: WidgetButton; height?: number; fontSize?: number }) {
  const look = buttonLook(button);
  return (
    <FlexWidget
      clickAction={look.action}
      clickActionData={look.data}
      accessibilityLabel={look.label}
      style={{ width: 'match_parent', height: height + 4, borderRadius: (height + 4) / 2, backgroundColor: '#050D24' }}
    >
      <FlexWidget
        clickAction={look.action}
        clickActionData={look.data}
        style={{
          width: 'match_parent',
          height,
          borderRadius: height / 2,
          backgroundColor: look.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <TextWidget text={look.label} style={{ fontFamily: FONT_DISPLAY, fontSize, color: look.fg }} maxLines={1} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  );
}
