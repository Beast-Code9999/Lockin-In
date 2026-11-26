import { flameTierForStreak, rankForStreak, rankKeyFromLabel, xpProgress } from './ranks';

describe('ranks (SPEC §8.1)', () => {
  it.each([
    [0, 'Rookie'],
    [2, 'Rookie'],
    [3, 'Grinder'],
    [6, 'Grinder'],
    [7, 'Locked In'],
    [13, 'Locked In'],
    [14, 'Disciplined'],
    [29, 'Disciplined'],
    [30, 'Monk Mode'],
    [59, 'Monk Mode'],
    [60, 'Final Boss'],
    [365, 'Final Boss'],
  ])('streak %i → %s', (streak, label) => {
    expect(rankForStreak(streak).label).toBe(label);
  });

  it('maps stored labels back to keys, defaulting to Rookie', () => {
    expect(rankKeyFromLabel('Monk Mode')).toBe('monk-mode');
    expect(rankKeyFromLabel('???')).toBe('rookie');
    expect(rankKeyFromLabel(null)).toBe('rookie');
  });
});

describe('flame tiers (SPEC §8.2)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [6, 1],
    [7, 2],
    [29, 2],
    [30, 3],
    [59, 3],
    [60, 4],
  ])('streak %i → tier %i', (streak, tier) => {
    expect(flameTierForStreak(streak)).toBe(tier);
  });
});

describe('XP bar', () => {
  it('streak 10 → 3/7 toward Disciplined (SPEC example)', () => {
    expect(xpProgress(10)).toEqual({ current: 3, next: 7 });
  });
  it('starts at 0/3 for a new player', () => {
    expect(xpProgress(0)).toEqual({ current: 0, next: 3 });
  });
  it('Final Boss is maxed', () => {
    expect(xpProgress(75)).toEqual({ current: 15, next: null });
  });
});
