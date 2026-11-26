/**
 * Ranks, flame tiers and XP (SPEC §8.1–8.2). Pure functions, shared by app + widget.
 * The server stores the rank *label* (user_stats.rank, default 'Rookie').
 */
export const RANKS = [
  { key: 'rookie', label: 'Rookie', minStreak: 0 },
  { key: 'grinder', label: 'Grinder', minStreak: 3 },
  { key: 'locked-in', label: 'Locked In', minStreak: 7 },
  { key: 'disciplined', label: 'Disciplined', minStreak: 14 },
  { key: 'monk-mode', label: 'Monk Mode', minStreak: 30 },
  { key: 'final-boss', label: 'Final Boss', minStreak: 60 },
] as const;

export type Rank = (typeof RANKS)[number];
export type RankKey = Rank['key'];
export type FlameTier = 0 | 1 | 2 | 3 | 4;

const FIRST_RANK: Rank = RANKS[0];

export function rankForStreak(streak: number): Rank {
  let current: Rank = FIRST_RANK;
  for (const rank of RANKS) if (streak >= rank.minStreak) current = rank;
  return current;
}

export function rankByKey(key: RankKey): Rank {
  return RANKS.find((r) => r.key === key) ?? FIRST_RANK;
}

/** Maps a stored label ('Monk Mode') back to its key; unknown labels fall back to Rookie. */
export function rankKeyFromLabel(label: string | null | undefined): RankKey {
  return RANKS.find((r) => r.label === label)?.key ?? FIRST_RANK.key;
}

/** 0 ember · 1 small (1–6) · 2 medium (7–29) · 3 bonfire (30–59) · 4 blue (60+). */
export function flameTierForStreak(streak: number): FlameTier {
  if (streak >= 60) return 4;
  if (streak >= 30) return 3;
  if (streak >= 7) return 2;
  if (streak >= 1) return 1;
  return 0;
}

/**
 * Progress from the current rank threshold to the next one.
 * e.g. streak 10 → { current: 3, next: 7 } (toward Disciplined at 14).
 * Final Boss has no next rank: { current, next: null } → show a full bar with "MAX".
 */
export function xpProgress(streak: number): { current: number; next: number | null } {
  const rank = rankForStreak(streak);
  const index = RANKS.findIndex((r) => r.key === rank.key);
  const nextRank = RANKS[index + 1];
  const current = Math.max(0, streak - rank.minStreak);
  return { current, next: nextRank ? nextRank.minStreak - rank.minStreak : null };
}
