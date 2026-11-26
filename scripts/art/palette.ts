/**
 * Art palette for placeholder pixel art. Mirrors the app theme (src/ui/theme.ts)
 * and the semantic colours in SPEC §15. Kept separate so this script has no app imports.
 */

/** Outline colour for every sprite — the deepest navy, so outlines melt into the dark UI. */
export const INK = '#0A1433';
export const WHITE = '#FFFFFF';
export const FOAM = '#EAF4FF';

// Brand blues ("bubble blue" family)
export const BUBBLE = '#2F7BFF';
export const BUBBLE_LIGHT = '#5C9BFF';
export const BUBBLE_DARK = '#1B55D6';
export const SKY = '#6CB4FF';
export const AQUA = '#7FE7FF';
export const DEEP = '#081537';
export const NAVY = '#0E2052';
export const OCEAN = '#16306F';
export const MARINE = '#1F4294';

// Semantic colours (SPEC §15)
export const CLEAN = '#39FF88';
export const CLEAN_DARK = '#1FB866';
export const SLIPPED = '#FF4D6D';
export const MISSED = '#FFB020';
export const FROZEN = '#7FD8FF';
export const VACATION = '#3DD9C1';

export const RARITY = {
  common: '#B8B8C8',
  rare: '#4DA3FF',
  epic: '#B266FF',
  legendary: '#FFC94D',
  cursed: '#FF3B3B',
} as const;

// Fire
export const FIRE = { outer: '#F0462E', mid: '#FF8A1F', inner: '#FFD23F', core: '#FFF6C9' } as const;
export const BLUE_FIRE = { outer: '#1E5BFF', mid: '#38A0FF', inner: '#7FE7FF', core: '#E6FBFF' } as const;

// Metals
export const GOLD = { light: '#FFE58A', base: '#FFC94D', dark: '#D9951A' } as const;
export const SILVER = { light: '#F4F8FF', base: '#C9D6EA', dark: '#8C9DBA' } as const;
export const BRONZE = { light: '#F2B27A', base: '#D08A4E', dark: '#9A5A2B' } as const;
export const STEEL = { light: '#FFFFFF', base: '#BFD8F7', dark: '#7C9CC9' } as const;

/** Rank colours (SPEC §8.1: grey, bronze, silver, gold, purple, rainbow/blue). Keys match src/shared/ranks.ts. */
export const RANK_COLOURS = {
  rookie: { ring: '#8D9BC0', fill: '#13285F', glow: '#2A3F78' },
  grinder: { ring: BRONZE.base, fill: '#1A2A5C', glow: '#5A3A2A' },
  'locked-in': { ring: SILVER.base, fill: '#152D6A', glow: '#4A5D85' },
  disciplined: { ring: GOLD.base, fill: '#172E6E', glow: '#6B5420' },
  'monk-mode': { ring: RARITY.epic, fill: '#1E2366', glow: '#5E3AA8' },
  'final-boss': { ring: AQUA, fill: '#0F2A78', glow: '#2F7BFF' },
} as const;
export type RankArtKey = keyof typeof RANK_COLOURS;

export const RAINBOW = ['#FF4D6D', '#FFB020', '#FFE14D', '#39FF88', '#4DF0FF', '#4D8BFF', '#B266FF'] as const;
