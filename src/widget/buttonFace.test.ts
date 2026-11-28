import { PIXEL_ASSETS } from '@/ui/pixelAssets.generated';

import { buttonFace } from './buttonFace';
import type { WidgetButton } from './buttonState';

const ALL: WidgetButton[] = [
  { kind: 'signedOut' },
  { kind: 'joinCrew' },
  { kind: 'openBox', boxId: 'b1' },
  { kind: 'opensLater', opensAt: '17:00' },
  { kind: 'backfill', date: '2026-12-09' },
  { kind: 'ready', date: '2026-12-10' },
  { kind: 'confirm', date: '2026-12-10' },
  { kind: 'inFlight' },
  { kind: 'queued' },
  { kind: 'done', gained: null },
];

describe('buttonFace (1×1 widget)', () => {
  it.each(ALL.map((b) => [b.kind, b] as const))('%s has a short label and a real icon', (_kind, b) => {
    const face = buttonFace(b, 12);
    expect(face.label.length).toBeLessThanOrEqual(10);
    if (face.icon) expect(PIXEL_ASSETS).toHaveProperty([face.icon]);
    else expect(face.glyph).toBeTruthy();
  });

  it('only ready / yesterday / confirm can check in, and they carry the date', () => {
    const checkIns = ALL.filter((b) => buttonFace(b, null).action === 'CHECK_IN').map((b) => b.kind);
    expect(checkIns).toEqual(['backfill', 'ready', 'confirm']);
    expect(buttonFace({ kind: 'ready', date: '2026-12-10' }, null).data).toEqual({ date: '2026-12-10' });
  });

  it('done shows points just gained, else the streak', () => {
    expect(buttonFace({ kind: 'done', gained: 12 }, 30).label).toBe('+12');
    expect(buttonFace({ kind: 'done', gained: null }, 30).label).toBe('🔥 30');
  });
});
