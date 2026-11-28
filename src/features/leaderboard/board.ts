import type { CrewMember } from '../home/types';

export type BoardTab = 'score' | 'season' | 'streak';

export const BOARD_METRIC: Record<BoardTab, (m: CrewMember) => number> = {
  score: (m) => m.stats.score_30d,
  season: (m) => m.stats.season_points,
  streak: (m) => m.stats.current_streak,
};

export type BoardRow = { member: CrewMember; value: number; position: number };

/**
 * Rank the crew for a tab. Ties share a position ("1, 1, 3"), then break by
 * current streak, then name, so the order is stable. Only players who've signed the Pact appear.
 */
export function buildBoard(members: readonly CrewMember[], tab: BoardTab): BoardRow[] {
  const metric = BOARD_METRIC[tab];
  const sorted = members
    .filter((m) => m.pact_accepted)
    .slice()
    .sort(
      (a, b) =>
        metric(b) - metric(a) ||
        b.stats.current_streak - a.stats.current_streak ||
        a.display_name.localeCompare(b.display_name),
    );
  let position = 0;
  let previous: number | null = null;
  return sorted.map((member, i) => {
    const value = metric(member);
    if (previous === null || value !== previous) position = i + 1;
    previous = value;
    return { member, value, position };
  });
}
