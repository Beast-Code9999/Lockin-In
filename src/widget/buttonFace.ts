/**
 * The 1×1 lock-in button widget: a round face + a short label, for every
 * WidgetButton state (SPEC §12.3). Same two-tap confirm as the other widgets.
 */
import type { WidgetButton } from './buttonState';

export type ButtonFace = {
  /** Pixel icon key, or null to show `glyph` text instead. */
  icon: string | null;
  glyph: string | null;
  label: string;
  ring: `#${string}`;
  fill: `#${string}`;
  labelColour: `#${string}`;
  action: 'CHECK_IN' | 'OPEN_APP' | 'OPEN_URI';
  data?: Record<string, unknown>;
};

const AQUA = '#7FE7FF';
const CLEAN = '#39FF88';
const GOLD = '#FFC94D';
const FAINT = '#5B76B0';
const TEXT = '#EAF4FF';
const DISC = '#0E2052';

export function buttonFace(b: WidgetButton, streak: number | null): ButtonFace {
  switch (b.kind) {
    case 'ready':
      return { icon: 'brand/padlock', glyph: null, label: 'Lock in', ring: AQUA, fill: DISC, labelColour: TEXT, action: 'CHECK_IN', data: { date: b.date } };
    case 'backfill':
      return { icon: 'brand/padlock', glyph: null, label: 'Yesterday', ring: AQUA, fill: DISC, labelColour: TEXT, action: 'CHECK_IN', data: { date: b.date } };
    case 'confirm':
      return { icon: null, glyph: '?', label: 'Sure?', ring: GOLD, fill: GOLD, labelColour: GOLD, action: 'CHECK_IN', data: { date: b.date } };
    case 'inFlight':
      return { icon: null, glyph: '…', label: 'Locking', ring: AQUA, fill: DISC, labelColour: TEXT, action: 'OPEN_APP' };
    case 'queued':
      return { icon: 'icon/hourglass', glyph: null, label: 'Queued', ring: FAINT, fill: DISC, labelColour: FAINT, action: 'OPEN_APP' };
    case 'done':
      return {
        icon: 'status/checked',
        glyph: null,
        label: b.gained ? `+${b.gained}` : streak ? `🔥 ${streak}` : 'Locked',
        ring: CLEAN,
        fill: '#0F3D2C',
        labelColour: CLEAN,
        action: 'OPEN_APP',
      };
    case 'opensLater':
      return { icon: 'icon/hourglass', glyph: null, label: b.opensAt === '17:00' ? '5pm' : b.opensAt, ring: FAINT, fill: DISC, labelColour: FAINT, action: 'OPEN_APP' };
    case 'openBox':
      return { icon: 'status/box', glyph: null, label: 'Box', ring: GOLD, fill: DISC, labelColour: GOLD, action: 'OPEN_URI', data: { uri: `lockinin://box/${b.boxId}` } };
    case 'joinCrew':
    case 'signedOut':
      return { icon: 'brand/padlock', glyph: null, label: 'Open', ring: FAINT, fill: DISC, labelColour: FAINT, action: 'OPEN_APP' };
  }
}
