/**
 * Lockin' In design tokens — "Bubble Arcade".
 *
 * Deep-ocean navy surfaces, glossy bubble-blue brand colour, chunky rounded
 * "toy" shapes with a solid lip underneath, and pixel accents (pixel font for
 * numbers/headings/buttons, pixel-art sprites). Semantic and rarity colours are
 * exactly SPEC §15. Dark mode only (v1).
 */
import type { TextStyle } from 'react-native';

import type { RankKey } from '@/shared/ranks';

export const colours = {
  // Surfaces (darkest → lightest)
  abyss: '#050D24', // lips, deepest shadows, tab bar base
  bg: '#081537', // app background
  surface: '#0E2052', // cards
  surface2: '#16306F', // raised / inputs / secondary buttons
  stroke: '#1F4294', // borders on surfaces
  strokeBright: '#2F5BC2',

  // Brand
  primary: '#2F7BFF', // bubble blue
  primaryLip: '#1B4FC4',
  primaryLight: '#5C9BFF',
  sky: '#6CB4FF',
  aqua: '#7FE7FF',

  // Text
  text: '#EAF4FF',
  textMuted: '#93AEDF',
  textFaint: '#5B76B0',
  ink: '#081537', // text on bright fills

  // Semantic (SPEC §15)
  clean: '#39FF88',
  cleanLip: '#1FB866',
  cleanInk: '#04361C',
  slipped: '#FF4D6D',
  slippedLip: '#C42746',
  missed: '#FFB020',
  frozen: '#7FD8FF',
  vacation: '#3DD9C1',
  gold: '#FFC94D',
  goldLip: '#C98F12',
  goldInk: '#3A2500',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const rarityColours = {
  common: '#B8B8C8',
  rare: '#4DA3FF',
  epic: '#B266FF',
  legendary: '#FFC94D',
  cursed: '#FF3B3B',
} as const;
export type RarityKey = keyof typeof rarityColours;

/** SPEC §8.1 badge colours: grey, bronze, silver, gold, purple, rainbow-blue. */
export const rankColours: Record<RankKey, string> = {
  rookie: '#9AA6C4',
  grinder: '#D08A4E',
  'locked-in': '#C9D6EA',
  disciplined: '#FFC94D',
  'monk-mode': '#B266FF',
  'final-boss': '#7FE7FF',
};

export const radii = { xs: 8, sm: 12, md: 18, lg: 24, xl: 32, pill: 999 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export type SpaceKey = keyof typeof space;

/**
 * Font family names registered in src/ui/fonts.ts. Never combine with fontWeight on Android.
 * Display = Jersey 10: a condensed pixel face whose capitals stay legible at button size
 * (see docs/DECISIONS.md). It renders ~1.33× smaller than most fonts at the same size.
 */
export const fonts = {
  display: 'Jersey10-Regular',
  body: 'Nunito-SemiBold',
  bodyBold: 'Nunito-Bold',
  bodyExtraBold: 'Nunito-ExtraBold',
  bodyBlack: 'Nunito-Black',
} as const;

export const typeScale = {
  hero: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64 },
  title: { fontFamily: fonts.display, fontSize: 42, lineHeight: 44 },
  heading: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32 },
  label: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  tag: { fontFamily: fonts.display, fontSize: 17, lineHeight: 18, letterSpacing: 1 },
  number: { fontFamily: fonts.display, fontSize: 38, lineHeight: 40 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyExtraBold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;
export type TypeVariant = keyof typeof typeScale;

/** Hard, pixel-style text shadow (Android needs radius > 0 to draw it). */
export const pixelTextShadow: TextStyle = {
  textShadowColor: 'rgba(5, 13, 36, 0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 1,
};

/** Translucent white for gloss highlights on bubbles. */
export const gloss = (opacity: number) => `rgba(255, 255, 255, ${opacity})`;

/** Hex colour → rgba() with opacity (for tints of semantic colours). */
export function withOpacity(hex: string, opacity: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** Height of the floating tab bar (excluding the bottom safe-area inset). */
export const TAB_BAR_HEIGHT = 72;
