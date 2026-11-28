import { leaderboardLayout, usedHeight } from './layout';

describe('leaderboardLayout', () => {
  it.each([140, 150, 165, 180, 200, 215, 240, 260, 320])('everything fits at %idp (the button is never clipped)', (h) => {
    const l = leaderboardLayout(h);
    expect(usedHeight(l)).toBeLessThanOrEqual(h);
    expect(l.rowHeight).toBeGreaterThanOrEqual(18);
  });

  it('a tight 4×2 drops the extras but keeps three rows and the button', () => {
    const l = leaderboardLayout(150);
    expect(l.showRival).toBe(false);
    expect(l.showXp).toBe(false);
  });

  it('a roomy 4×2 shows the rival line', () => {
    expect(leaderboardLayout(205).showRival).toBe(true);
  });

  it('a 4×3 adds XP and the last event (SPEC §12.2)', () => {
    const l = leaderboardLayout(260);
    expect(l.showXp && l.showLastEvent && l.showRival).toBe(true);
  });
});
