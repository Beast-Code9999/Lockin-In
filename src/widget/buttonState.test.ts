import { EMPTY_LOCAL_STATE, freshDayFlags, localClock, staleLabel, widgetButton } from './buttonState';
import type { WidgetSnapshot } from './snapshot';

const snap = (me: Partial<WidgetSnapshot['me']> = {}): WidgetSnapshot => ({
  version: 1,
  generatedAt: '2026-12-10T08:00:00Z',
  me: {
    uid: 'u1',
    timezone: 'Australia/Darwin',
    todayLocal: '2026-12-10',
    localTime: '17:30',
    checkinOpensAt: '17:00',
    inGame: true,
    checkedInToday: false,
    yesterdayPending: false,
    owedBoxId: null,
    ...me,
  },
  season: { number: 1, endsOn: '2026-12-31', daysLeft: 21 },
  members: [],
  rival: null,
  activeSos: null,
  lastEvent: null,
});
const at = (time: string, today = '2026-12-10') => ({ today, time });
const NOW = Date.parse('2026-12-10T08:30:00Z');

describe('widgetButton (SPEC §12.3)', () => {
  it('not signed in / not in a crew', () => {
    expect(widgetButton(null, EMPTY_LOCAL_STATE, at('18:00')).kind).toBe('signedOut');
    expect(widgetButton(snap({ inGame: false }), EMPTY_LOCAL_STATE, at('18:00')).kind).toBe('joinCrew');
  });

  it('an owed box beats everything', () => {
    expect(widgetButton(snap({ owedBoxId: 'b1', yesterdayPending: true }), EMPTY_LOCAL_STATE, at('18:00'))).toEqual({ kind: 'openBox', boxId: 'b1' });
  });

  it('waits for 5pm, then offers the clean check-in', () => {
    expect(widgetButton(snap(), EMPTY_LOCAL_STATE, at('16:59'))).toEqual({ kind: 'opensLater', opensAt: '17:00' });
    expect(widgetButton(snap(), EMPTY_LOCAL_STATE, at('17:00'))).toEqual({ kind: 'ready', date: '2026-12-10' });
  });

  it('offers yesterday first, at any time of day', () => {
    expect(widgetButton(snap({ yesterdayPending: true }), EMPTY_LOCAL_STATE, at('09:00'))).toEqual({ kind: 'backfill', date: '2026-12-09' });
  });

  it('two-step confirm: armed for a few seconds, then reverts (SPEC §22.16)', () => {
    const armed = { ...EMPTY_LOCAL_STATE, pendingConfirmUntil: new Date(NOW + 3_000).toISOString() };
    const expired = { ...EMPTY_LOCAL_STATE, pendingConfirmUntil: new Date(NOW - 1).toISOString() };
    expect(widgetButton(snap(), armed, at('18:00'), NOW)).toEqual({ kind: 'confirm', date: '2026-12-10' });
    expect(widgetButton(snap(), expired, at('18:00'), NOW)).toEqual({ kind: 'ready', date: '2026-12-10' });
  });

  it('in flight, queued offline, done with a points flash', () => {
    expect(widgetButton(snap(), { ...EMPTY_LOCAL_STATE, inFlight: true }, at('18:00')).kind).toBe('inFlight');
    expect(widgetButton(snap(), { ...EMPTY_LOCAL_STATE, queuedDate: '2026-12-10' }, at('18:00')).kind).toBe('queued');
    expect(widgetButton(snap({ checkedInToday: true }), { ...EMPTY_LOCAL_STATE, justGained: 12 }, at('18:00'))).toEqual({ kind: 'done', gained: 12 });
  });

  it('a stale queued item from days ago no longer blocks', () => {
    expect(widgetButton(snap(), { ...EMPTY_LOCAL_STATE, queuedDate: '2026-12-01' }, at('18:00')).kind).toBe('ready');
  });
});

describe('self-correction on a new day (SPEC §12.5)', () => {
  it('yesterday checked → today open, nothing pending', () => {
    expect(freshDayFlags(snap({ checkedInToday: true }), at('08:00', '2026-12-11'))).toEqual({ checkedInToday: false, yesterdayPending: false, stale: true });
  });
  it('yesterday not checked → yesterday pending', () => {
    const s = snap({ checkedInToday: false });
    expect(freshDayFlags(s, at('08:00', '2026-12-11'))).toEqual({ checkedInToday: false, yesterdayPending: true, stale: true });
    expect(widgetButton(s, EMPTY_LOCAL_STATE, at('08:00', '2026-12-11'))).toEqual({ kind: 'backfill', date: '2026-12-10' });
  });
});

describe('helpers', () => {
  it('local clock in the player timezone', () => {
    expect(localClock('Australia/Darwin', new Date('2026-12-10T07:29:00Z'))).toEqual({ today: '2026-12-10', time: '16:59' });
    expect(localClock('Asia/Dili', new Date('2026-12-10T15:30:00Z'))).toEqual({ today: '2026-12-11', time: '00:30' });
  });
  it('stale label after 2h', () => {
    expect(staleLabel('2026-12-10T08:00:00Z', 2, Date.parse('2026-12-10T09:59:00Z'))).toBeNull();
    expect(staleLabel('2026-12-10T08:00:00Z', 2, Date.parse('2026-12-10T10:00:00Z'))).toBe('updated 2h ago');
    expect(staleLabel('2026-12-10T08:00:00Z', 2, Date.parse('2026-12-13T08:00:00Z'))).toBe('updated 3d ago');
  });
});
