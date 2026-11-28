/**
 * DEV ONLY: fake snapshots covering every widget state (SPEC §12.2–12.4, §22.15),
 * used by the Widget Debug screen and widget tests.
 */
import { EMPTY_LOCAL_STATE, type LocalClock, type WidgetLocalState } from './buttonState';
import { enrichSnapshot, type WidgetSnapshot } from './snapshot';

type RawMember = { uid: string; name: string; avatarId: string; score30d: number; seasonPoints: number; streak: number; flameTier: 0 | 1 | 2 | 3 | 4; rank: string; todayStatus: 'checked' | 'pending' | 'box' | 'coward' | 'clown' | 'vacation' | 'frozen'; position: number };

const CREW: RawMember[] = [
  { uid: 'miguel', name: 'Miguel', avatarId: 'sprout', score30d: 512, seasonPoints: 211, streak: 34, flameTier: 3, rank: 'Monk Mode', todayStatus: 'checked', position: 1 },
  { uid: 'jason', name: 'Jason', avatarId: 'volt', score30d: 498, seasonPoints: 240, streak: 29, flameTier: 2, rank: 'Disciplined', todayStatus: 'pending', position: 2 },
  { uid: 'ken', name: 'Ken', avatarId: 'ace', score30d: 301, seasonPoints: 120, streak: 6, flameTier: 1, rank: 'Grinder', todayStatus: 'pending', position: 3 },
];

/** ~4 months of mostly-clean history ending on 2026-12-10, with one of everything. */
function fixtureHistory(): NonNullable<WidgetSnapshot['history']> {
  const from = '2025-12-05'; // WIDGET_HISTORY_DAYS (371) back from 2026-12-10
  const pactIndex = 240; // ≈ 2026-08-02
  const days = Array.from({ length: 371 }, (_, i) => {
    if (i < pactIndex) return '-';
    if (i >= 369) return '-'; // yesterday + today still open
    if (i % 23 === 0) return 's';
    if (i === 300) return 'm';
    if (i === 301 || i === 333) return 'f';
    if (i >= 310 && i <= 314) return 'v';
    return 'c';
  }).join('');
  return { from, firstEligible: '2026-08-02', days };
}

function make(opts: { crew?: RawMember[]; me?: Partial<WidgetSnapshot['me']>; extra?: Partial<Omit<WidgetSnapshot, 'members' | 'me'>> } = {}): WidgetSnapshot {
  return enrichSnapshot(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      me: {
        uid: 'jason',
        todayLocal: '2026-12-10',
        localTime: '18:00',
        checkinOpensAt: '17:00',
        inGame: true,
        checkedInToday: false,
        yesterdayPending: false,
        owedBoxId: null,
        ...opts.me,
      },
      season: { number: 3, endsOn: '2026-12-14', daysLeft: 4 },
      members: opts.crew ?? CREW,
      rival: { text: '14 pts to catch Miguel 🎯' },
      activeSos: null,
      lastEvent: { text: 'Ken checked in 20m ago', at: new Date().toISOString() },
      history: fixtureHistory(),
      ...opts.extra,
    },
    'Australia/Darwin',
  );
}

const withStatus = (status: RawMember['todayStatus'], who = 'all') => CREW.map((m) => (who === 'all' || m.uid === who ? { ...m, todayStatus: status } : m));
const evening: LocalClock = { today: '2026-12-10', time: '18:00' };
const morning: LocalClock = { today: '2026-12-10', time: '09:00' };

export type WidgetScenario = { name: string; snapshot: WidgetSnapshot | null; local: WidgetLocalState; clock: LocalClock; height?: number };

export const WIDGET_SCENARIOS: WidgetScenario[] = [
  { name: 'Ready to check in (≥ 5pm)', snapshot: make(), local: EMPTY_LOCAL_STATE, clock: evening },
  { name: 'Opens at 5pm', snapshot: make(), local: EMPTY_LOCAL_STATE, clock: morning },
  { name: 'Yesterday still open', snapshot: make({ me: { yesterdayPending: true } }), local: EMPTY_LOCAL_STATE, clock: morning },
  { name: 'Tap again to confirm', snapshot: make(), local: { ...EMPTY_LOCAL_STATE, pendingConfirmUntil: '2999-01-01T00:00:00Z' }, clock: evening },
  { name: 'Locking in…', snapshot: make(), local: { ...EMPTY_LOCAL_STATE, inFlight: true }, clock: evening },
  { name: 'Queued offline', snapshot: make(), local: { ...EMPTY_LOCAL_STATE, queuedDate: '2026-12-10' }, clock: evening },
  { name: 'Locked in +12', snapshot: make({ me: { checkedInToday: true }, crew: withStatus('checked', 'jason') }), local: { ...EMPTY_LOCAL_STATE, justGained: 12 }, clock: evening },
  { name: 'Everyone checked in', snapshot: make({ me: { checkedInToday: true }, crew: withStatus('checked') }), local: EMPTY_LOCAL_STATE, clock: evening },
  { name: 'Nobody checked in', snapshot: make({ crew: withStatus('pending') }), local: EMPTY_LOCAL_STATE, clock: evening },
  { name: 'Owes a Mystery Box', snapshot: make({ me: { owedBoxId: 'box-1' }, crew: withStatus('box', 'jason') }), local: EMPTY_LOCAL_STATE, clock: evening },
  { name: 'Shame states (clown / chicken / vacation)', snapshot: make({ crew: [{ ...CREW[0]!, todayStatus: 'vacation' }, { ...CREW[1]!, todayStatus: 'clown' }, { ...CREW[2]!, todayStatus: 'coward' }] }), local: EMPTY_LOCAL_STATE, clock: evening },
  { name: 'Active SOS', snapshot: make({ extra: { activeSos: { id: 'sos-1', uid: 'miguel', name: 'Miguel', endsAt: new Date().toISOString() } } }), local: EMPTY_LOCAL_STATE, clock: evening },
  {
    name: 'Stale snapshot (offline)',
    snapshot: { ...make(), generatedAt: new Date(Date.now() - 5 * 3_600_000).toISOString() },
    local: EMPTY_LOCAL_STATE,
    clock: evening,
  },
  {
    name: 'Bigger crew — you outside the top 3',
    snapshot: make({
      crew: [
        ...CREW.filter((m) => m.uid !== 'jason').map((m, i) => ({ ...m, position: i + 1 })),
        { uid: 'tom', name: 'Tomasz-Long-Name', avatarId: 'ghost', score30d: 280, seasonPoints: 90, streak: 4, flameTier: 1, rank: 'Grinder', todayStatus: 'checked', position: 3 },
        { ...CREW[1]!, score30d: 150, position: 4 },
      ],
    }),
    local: EMPTY_LOCAL_STATE,
    clock: evening,
  },
  { name: '4×3 (tall)', snapshot: make(), local: EMPTY_LOCAL_STATE, clock: evening, height: 260 },
  { name: 'Not in a crew yet', snapshot: make({ me: { inGame: false }, crew: [] }), local: EMPTY_LOCAL_STATE, clock: evening },
  { name: 'Signed out', snapshot: null, local: EMPTY_LOCAL_STATE, clock: evening },
];
