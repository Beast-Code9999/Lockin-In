import { avatarState, resolveAvatarLayers } from './avatar';

const NOW = new Date('2026-12-01T10:00:00Z');
const FUTURE = '2026-12-02T10:00:00Z';
const PAST = '2026-11-30T10:00:00Z';

describe('resolveAvatarLayers (SPEC §8.3)', () => {
  it('stacks rank bubble → base character', () => {
    expect(resolveAvatarLayers({ avatarId: 'nova', rank: 'monk-mode' }, NOW)).toEqual(['avatar/rank/monk-mode', 'avatar/base/nova']);
  });

  it('falls back to the default character for unknown ids', () => {
    expect(resolveAvatarLayers({ avatarId: 'mystery', rank: 'rookie' }, NOW)[1]).toBe('avatar/base/blaze');
  });

  it('precedence: jail > chicken > clown > shield', () => {
    const all = { avatarId: 'ace', rank: 'grinder' as const, owesBox: true, cowardUntil: FUTURE, clownUntil: FUTURE, shield: true };
    expect(avatarState(all, NOW)).toBe('jail');
    expect(avatarState({ ...all, owesBox: false }, NOW)).toBe('chicken');
    expect(avatarState({ ...all, owesBox: false, cowardUntil: null }, NOW)).toBe('clown');
    expect(avatarState({ ...all, owesBox: false, cowardUntil: null, clownUntil: null }, NOW)).toBe('shield');
    expect(resolveAvatarLayers(all, NOW).at(-1)).toBe('avatar/state/jail');
  });

  it('expired clown / chicken states fall away', () => {
    expect(avatarState({ avatarId: 'ace', rank: 'rookie', clownUntil: PAST, cowardUntil: PAST }, NOW)).toBeNull();
  });

  it('a clean record has no state overlay', () => {
    expect(resolveAvatarLayers({ avatarId: 'volt', rank: 'final-boss' }, NOW)).toHaveLength(2);
  });
});
