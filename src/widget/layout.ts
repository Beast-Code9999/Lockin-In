/**
 * Leaderboard widget layout budget. RemoteViews clip anything that overflows,
 * so sizes are computed from the widget's real height (launchers differ a lot:
 * a 4×2 can be ~140–210dp) to guarantee the check-in button always fits.
 */
export type LeaderboardLayout = {
  padding: number;
  headerHeight: number;
  rowHeight: number;
  avatar: number;
  rowGap: number;
  buttonHeight: number;
  buttonFont: number;
  showRival: boolean;
  showXp: boolean;
  showLastEvent: boolean;
};

const LINE = 16; // one small text line (rival / last event)
const XP = 14;

export function leaderboardLayout(height: number, rows = 3): LeaderboardLayout {
  const padding = height < 170 ? 7 : 9;
  const headerHeight = 22;
  const buttonHeight = height < 170 ? 28 : 34;
  const sectionGap = 4;
  const rowGap = 2;
  // Fixed parts: padding, header, button (+ its lip), gaps between the 3 sections.
  const fixed = padding * 2 + headerHeight + buttonHeight + 4 + sectionGap * 2;
  let extras = 0;
  const rowsAt = (h: number) => rows * h + (rows - 1) * rowGap;

  // Extras are only added if rows can still be at least 28dp tall.
  const showXp = height - fixed - rowsAt(28) - (XP + sectionGap) - (LINE + sectionGap) * 2 >= 0;
  if (showXp) extras += XP + sectionGap;
  const showLastEvent = showXp;
  if (showLastEvent) extras += LINE + sectionGap;
  const showRival = height - fixed - extras - rowsAt(26) - (LINE + sectionGap) >= 0;
  if (showRival) extras += LINE + sectionGap;

  const rowHeight = Math.max(18, Math.min(34, Math.floor((height - fixed - extras - (rows - 1) * rowGap) / rows)));
  return {
    padding,
    headerHeight,
    rowHeight,
    avatar: Math.max(16, rowHeight - 6),
    rowGap,
    buttonHeight,
    buttonFont: buttonHeight < 30 ? 16 : 19,
    showRival,
    showXp,
    showLastEvent,
  };
}

/** Total height the layout will use (for tests / sanity). */
export function usedHeight(l: LeaderboardLayout, rows = 3): number {
  const sectionGap = 4;
  return (
    l.padding * 2 +
    l.headerHeight +
    l.buttonHeight +
    4 +
    sectionGap * 2 +
    rows * l.rowHeight +
    (rows - 1) * l.rowGap +
    (l.showRival ? 16 + sectionGap : 0) +
    (l.showXp ? 14 + sectionGap : 0) +
    (l.showLastEvent ? 16 + sectionGap : 0)
  );
}
