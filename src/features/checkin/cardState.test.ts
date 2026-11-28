import type { HomeData } from '../home/types';
import { onboardingStage } from '../home/types';
import { checkinCardState, slipTarget } from './cardState';

const base: HomeData = {
  now: '2026-12-10T08:00:00Z',
  me: { id: 'u1', display_name: 'Jason', avatar_id: 'blaze', timezone: 'Australia/Darwin', reminder_time: '21:00', auto_use_freeze: true },
  today_local: '2026-12-10',
  yesterday_local: '2026-12-09',
  local_time: '17:30',
  opens_at: '17:00',
  undo_minutes: 5,
  group: {
    id: 'g1',
    name: 'The Crew',
    invite_code: 'ABC234',
    timezone: 'Australia/Darwin',
    role: 'owner',
    pact_accepted_at: '2026-12-01T03:00:00Z',
    first_eligible_date: '2026-12-01',
  },
  season: { number: 1, starts_on: '2026-12-01', ends_on: '2026-12-31', days_left: 21 },
  stats: { current_streak: 0, longest_streak: 0, score_30d: 0, season_points: 0, rank: 'Rookie', flame_tier: 0, freeze_tokens_left: 2 },
  rival: null,
  today: null,
  yesterday: { status: 'clean', source: 'app', created_at: '', updated_at: '', note: null },
  members: [],
  vacations: [],
};
const day = (status: 'clean' | 'relapse', updated_at = '2026-12-10T08:00:00Z') => ({ status, source: 'app' as const, created_at: updated_at, updated_at, note: null });

describe('checkinCardState', () => {
  it('offers yesterday first when it is still open', () => {
    expect(checkinCardState({ ...base, yesterday: null })).toEqual({ kind: 'backfill', date: '2026-12-09' });
  });

  it('does not offer yesterday if it was before the Pact', () => {
    const s = checkinCardState({ ...base, yesterday: null, group: { ...base.group!, first_eligible_date: '2026-12-10' } });
    expect(s.kind).toBe('ready');
  });

  it('is ready after opens-at and waits before it', () => {
    expect(checkinCardState(base)).toEqual({ kind: 'ready', date: '2026-12-10' });
    expect(checkinCardState({ ...base, local_time: '16:59' })).toEqual({ kind: 'opensLater', date: '2026-12-10', opensAt: '17:00' });
    expect(checkinCardState({ ...base, local_time: '17:00' }).kind).toBe('ready');
  });

  it('shows done states', () => {
    expect(checkinCardState({ ...base, today: day('clean') }).kind).toBe('doneClean');
  });

  it('keeps undo available for 5 minutes after a slip', () => {
    const slipped = { ...base, today: day('relapse', '2026-12-10T08:00:00Z') };
    expect(checkinCardState(slipped, Date.parse('2026-12-10T08:04:00Z'))).toEqual({
      kind: 'doneSlipped',
      date: '2026-12-10',
      undoUntil: '2026-12-10T08:05:00.000Z',
    });
    expect(checkinCardState(slipped, Date.parse('2026-12-10T08:06:00Z'))).toEqual({ kind: 'doneSlipped', date: '2026-12-10', undoUntil: null });
  });

  it('is not eligible before the Pact', () => {
    expect(checkinCardState({ ...base, group: { ...base.group!, pact_accepted_at: null } }).kind).toBe('notEligible');
    expect(checkinCardState({ ...base, group: null }).kind).toBe('notEligible');
  });

  it('only offers "I slipped" where it makes sense', () => {
    expect(slipTarget({ kind: 'ready', date: '2026-12-10' })).toBe('2026-12-10');
    expect(slipTarget({ kind: 'backfill', date: '2026-12-09' })).toBe('2026-12-09');
    expect(slipTarget({ kind: 'doneClean', date: '2026-12-10' })).toBe('2026-12-10');
    expect(slipTarget({ kind: 'doneSlipped', date: '2026-12-10', undoUntil: null })).toBeNull();
  });
});

describe('onboardingStage', () => {
  it('walks crew → pact → done', () => {
    expect(onboardingStage({ ...base, group: null })).toBe('crew');
    expect(onboardingStage({ ...base, group: { ...base.group!, pact_accepted_at: null } })).toBe('pact');
    expect(onboardingStage(base)).toBe('done');
  });
});
