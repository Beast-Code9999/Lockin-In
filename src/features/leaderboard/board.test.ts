import type { CrewMember, PlayerStats } from '../home/types';
import { buildBoard } from './board';

const stats = (s: Partial<PlayerStats>): PlayerStats => ({
  current_streak: 0,
  longest_streak: 0,
  score_30d: 0,
  season_points: 0,
  rank: 'Rookie',
  flame_tier: 0,
  freeze_tokens_left: 2,
  ...s,
});
const member = (id: string, s: Partial<PlayerStats>, pact = true): CrewMember => ({
  id,
  display_name: id,
  avatar_id: 'blaze',
  is_me: false,
  pact_accepted: pact,
  checked_today: false,
  on_vacation_today: false,
  stats: stats(s),
});

describe('buildBoard', () => {
  const crew = [
    member('Ken', { score_30d: 301, season_points: 40, current_streak: 6 }),
    member('Miguel', { score_30d: 512, season_points: 90, current_streak: 34 }),
    member('Jason', { score_30d: 498, season_points: 120, current_streak: 29 }),
    member('Newbie', { score_30d: 999 }, false),
  ];

  it('sorts by the 30-day score and hides players who have not signed the Pact', () => {
    expect(buildBoard(crew, 'score').map((r) => [r.member.id, r.position, r.value])).toEqual([
      ['Miguel', 1, 512],
      ['Jason', 2, 498],
      ['Ken', 3, 301],
    ]);
  });

  it('has season and streak tabs', () => {
    expect(buildBoard(crew, 'season').map((r) => r.member.id)).toEqual(['Jason', 'Miguel', 'Ken']);
    expect(buildBoard(crew, 'streak').map((r) => r.member.id)).toEqual(['Miguel', 'Jason', 'Ken']);
  });

  it('ties share a position', () => {
    const tied = [member('A', { score_30d: 10, current_streak: 2 }), member('B', { score_30d: 10, current_streak: 1 }), member('C', { score_30d: 5 })];
    expect(buildBoard(tied, 'score').map((r) => r.position)).toEqual([1, 1, 3]);
  });
});
