/**
 * Placeholder pixel-art sprite definitions.
 *
 * Every sprite is authored on a small grid (12/16/24 cells) and exported by
 * gen-placeholder-art.ts. Keys are stable; real art can replace the PNGs later
 * without code changes (see assets/pixel/manifest.json).
 */
import { PixelCanvas, dither, mix, toHex, withAlpha, type Colour, type Palette } from './canvas.ts';
import {
  AQUA,
  BLUE_FIRE,
  BRONZE,
  BUBBLE,
  BUBBLE_DARK,
  BUBBLE_LIGHT,
  CLEAN,
  CLEAN_DARK,
  FIRE,
  FOAM,
  FROZEN,
  GOLD,
  INK,
  RAINBOW,
  RANK_COLOURS,
  RARITY,
  SILVER,
  SKY,
  SLIPPED,
  STEEL,
  VACATION,
  WHITE,
  type RankArtKey,
} from './palette.ts';

export type SpriteDef = {
  key: string;
  canvas: PixelCanvas;
  /** Display size (dp) of the @1x export. Must be an integer multiple of the grid width. */
  baseDp: number;
  category: string;
};

// ---------------------------------------------------------------------------
// Flames (SPEC §8.2) — 16×16
// ---------------------------------------------------------------------------

type FirePalette = { outer: string; mid: string; inner: string; core: string };

function flameBody(
  c: PixelCanvas,
  o: { cx: number; tipY: number; baseY: number; maxHalf: number; fire: FirePalette; lean?: number },
): void {
  const lean = o.lean ?? 1;
  const height = o.baseY - o.tipY + 1;
  for (let y = o.tipY; y <= o.baseY; y++) {
    const t = (y - o.tipY + 0.5) / height; // 0 at the tip → 1 at the base
    let half = o.maxHalf * Math.pow(t, 0.72);
    if (t > 0.76) half *= Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.76) / 0.27, 2)));
    const shift = lean * Math.pow(1 - t, 2) * 1.8;
    for (let x = 0; x < c.w; x++) {
      const dx = x + 0.5 - (o.cx + shift);
      if (Math.abs(dx) > half) continue;
      const nx = Math.abs(dx) / Math.max(half, 0.6);
      const heat = (1 - nx) * Math.min(1, t * 1.3);
      c.set(x, y, heat > 0.6 ? o.fire.core : heat > 0.4 ? o.fire.inner : heat > 0.18 ? o.fire.mid : o.fire.outer);
    }
  }
}

function flameTier(tier: 0 | 1 | 2 | 3 | 4): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  if (tier === 0) {
    // Ember: a glowing coal with a curl of grey smoke.
    c.stamp(
      [
        '................',
        '........ss......',
        '.......s........',
        '......s.........',
        '......s.........',
        '.......ss.......',
        '.........s......',
        '.........s......',
        '........s.......',
        '.......s........',
        '.......s........',
        '................',
        '......oOOo......',
        '.....oOYYOo.....',
        '.....oOOOOo.....',
        '................',
      ],
      { s: '#8D9BC0', o: '#B4472C', O: FIRE.mid, Y: FIRE.inner },
    );
    return c.outline(INK);
  }
  if (tier === 1) {
    flameBody(c, { cx: 8, tipY: 6, baseY: 14, maxHalf: 3.3, fire: FIRE });
  } else if (tier === 2) {
    flameBody(c, { cx: 5.6, tipY: 8, baseY: 14, maxHalf: 2.2, fire: FIRE, lean: -1 });
    flameBody(c, { cx: 8, tipY: 2, baseY: 14, maxHalf: 4.6, fire: FIRE });
  } else if (tier === 3) {
    // Bonfire: three tongues of flame over crossed logs.
    flameBody(c, { cx: 4.6, tipY: 6, baseY: 12, maxHalf: 2.3, fire: FIRE, lean: -1 });
    flameBody(c, { cx: 11.6, tipY: 5, baseY: 12, maxHalf: 2.4, fire: FIRE, lean: 1 });
    flameBody(c, { cx: 8, tipY: 1, baseY: 12, maxHalf: 4.4, fire: FIRE });
    c.stamp(
      [
        '.LL..........LL.',
        '.lLLLL....LLLLl.',
        '...llLLLLLLll...',
      ],
      { L: '#9A5A2B', l: '#6B3A1B' },
      0,
      13,
    );
  } else {
    // Blue flame (60+ streak): tall, electric, with sparks.
    flameBody(c, { cx: 5.4, tipY: 7, baseY: 14, maxHalf: 2.2, fire: BLUE_FIRE, lean: -1 });
    flameBody(c, { cx: 10.8, tipY: 6, baseY: 14, maxHalf: 2.2, fire: BLUE_FIRE, lean: 1 });
    flameBody(c, { cx: 8, tipY: 1, baseY: 14, maxHalf: 4.7, fire: BLUE_FIRE });
  }
  c.outline(INK);
  if (tier === 4) {
    c.set(1, 3, AQUA).set(14, 2, WHITE).set(13, 9, AQUA).set(2, 10, WHITE);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Avatars (SPEC §8.3) — 24×24 "avatar bubbles"
//   layer order: rank backdrop → base character → state overlay
// ---------------------------------------------------------------------------

export const AVATAR_IDS = ['blaze', 'frost', 'volt', 'shade', 'sprout', 'nova', 'ace', 'ghost'] as const;
export type AvatarArtId = (typeof AVATAR_IDS)[number];

const CX = 12;
const CY = 12;
const BUBBLE_R = 11.5;
const INNER_R = 10.5;

const inside = (r: number) => (x: number, y: number) => (x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2 <= r * r;

const FACE_TEMPLATE = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........SSSSSSSS........',
  '.......SSSSSSSSSS.......',
  '......SSSSSSSSSSSs......',
  '......SSSSSSSSSSSs......',
  '......SSSSSSSSSSSs......',
  '......SSSSSSSSSSSs......',
  '......SSGESSSSGESs......',
  '......SSEESSSSEESs......',
  '......SBSSSSSSSSBs......',
  '......SSSSSMMSSSSs......',
  '.......sSSSSSSSSs.......',
  '........ssSSSSss........',
  '..........kkkk..........',
  '......TTTTTVVTTTTT......',
  '....TTTTTTTvvTTTTTTT....',
  '...TTTTTTTTTTTTTTTTTt...',
  '..TTTTTTTTTTTTTTTTTTtt..',
  '..TTTTTTTTTTTTTTTTTTtt..',
  '..TTTTTTTTTTTTTTTTTTtt..',
  '..TTTTTTTTTTTTTTTTTTtt..',
];

type Character = {
  skin: string;
  skinShade: string;
  shirt: string;
  shirtShade: string;
  hair: string;
  hairShade: string;
  accent: string;
  accentShade: string;
  /** Hair drawn behind the head (volume, long hair, hoods). */
  back?: readonly string[];
  /** Hair/headwear drawn over the head (fringe, hats, glasses). */
  front: readonly string[];
};

const CHARACTERS: Record<AvatarArtId, Character> = {
  blaze: {
    skin: '#FFD7B5', skinShade: '#E8B48C', shirt: '#FF5A5F', shirtShade: '#C93A44',
    hair: '#FF8A3D', hairShade: '#D4581F', accent: '#FFD23F', accentShade: '#D9951A',
    front: [
      '........................',
      '.........H.....H........',
      '.......H.HH...HH..H.....',
      '.......HHHHH.HHHHHH.....',
      '......HHHHHHHHHHHHHH....',
      '.....HHHHhHHHHhHHHHHH...',
      '.....HHHhhHHHhhHHHHHH...',
      '.....HH.hh.HHh..hHH.H...',
      '.....H..........h.......',
    ],
  },
  frost: {
    skin: '#F2B98A', skinShade: '#D69A6A', shirt: '#4DF0FF', shirtShade: '#25B8D6',
    hair: '#3A2A20', hairShade: '#241810', accent: '#2F7BFF', accentShade: '#1B55D6',
    front: [
      '..........WW............',
      '.........WWWW...........',
      '..........WW............',
      '........AAAAAAA.........',
      '......AAAAAAAAAAA.......',
      '.....AAAAAAAAAAAAA......',
      '.....aaaaaaaaaaaaaa.....',
      '.....WaWaWaWaWaWaWa.....',
      '.....HH..........HH.....',
    ],
  },
  volt: {
    skin: '#B87243', skinShade: '#965A31', shirt: '#FFE14D', shirtShade: '#D9B21F',
    hair: '#1E1A2E', hairShade: '#3A3550', accent: '#FFB020', accentShade: '#C97F00',
    front: [
      '........................',
      '........................',
      '........H..H..H.........',
      '.......HHHHHHHHHH.......',
      '......HHHHHHHHHHHH......',
      '.....HHHhHHHHHhHHHH.....',
      '.....AAAAAAAAAAAAAA.....',
      '.....aaaaaaWaaaaaaa.....',
      '.....H............H.....',
    ],
  },
  shade: {
    skin: '#8A5230', skinShade: '#6E3F22', shirt: '#B266FF', shirtShade: '#8442D1',
    hair: '#14101F', hairShade: '#3A3550', accent: '#14101F', accentShade: '#4DF0FF',
    front: [
      '........................',
      '........................',
      '........................',
      '........HHHHHHHH........',
      '......HHHHHHHHHHHH......',
      '.....HHhhhhHHHHHHHH.....',
      '.....HHHHHHHHHHHHHH.....',
      '.....HH...........H.....',
      '........................',
      '........................',
      '......AAAAAA.AAAAAA.....',
      '.......AaAA...AaAA......',
    ],
  },
  sprout: {
    skin: '#D9965F', skinShade: '#B8783F', shirt: '#39FF88', shirtShade: '#1FB866',
    hair: '#6B3A1B', hairShade: '#4A2810', accent: '#1FB866', accentShade: '#12804A',
    front: [
      '........................',
      '........................',
      '..........W.............',
      '........AAAAAA..........',
      '......AAAAAAAAAA........',
      '.....AAAAAAAAAAAA.......',
      '.....AAAAAAAAAAAAAaaaa..',
      '.....aaaaaaaaaaaaaaaaa..',
      '.....HH.........HH......',
    ],
  },
  nova: {
    skin: '#FFD7B5', skinShade: '#E8B48C', shirt: '#6CB4FF', shirtShade: '#3F86D9',
    hair: '#FF7AC8', hairShade: '#D94AA0', accent: '#FFE14D', accentShade: '#D9B21F',
    back: [
      '........................',
      '........................',
      '........................',
      '........................',
      '......HHHHHHHHHHHH......',
      '.....HHHHHHHHHHHHHH.....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '....hHHHHHHHHHHHHHHh....',
      '....hHHHHHHHHHHHHHHh....',
      '....hhHHHHHHHHHHHHhh....',
      '.....hhH........Hhh.....',
    ],
    front: [
      '........................',
      '........................',
      '...............AA.......',
      '........HHHHHHAAAA......',
      '......HHHHHHHHHAAH......',
      '.....HHHHHhhHHHHHHH.....',
      '.....HHHhhHHHHHHHHH.....',
      '.....HHhH......hHHH.....',
      '.....HH..........HH.....',
      '.....H............H.....',
    ],
  },
  ace: {
    skin: '#5E3820', skinShade: '#4A2A16', shirt: '#FFB020', shirtShade: '#C97F00',
    hair: '#1E1A2E', hairShade: '#3A3550', accent: '#FF4D6D', accentShade: '#C42746',
    back: [
      '........................',
      '........HHHHHHHH........',
      '......HHHHHHHHHHHH......',
      '.....HHHhHHHHHHhHHH.....',
      '....HHHHHHHHHHHHHHHH....',
      '....HHhHHHHHHHHHHhHH....',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHhHHHHHHHHHHHHhHH...',
      '....HHHHHHHHHHHHHHHH....',
      '....HHHHHHHHHHHHHHHH....',
      '.....HHH........HHH.....',
    ],
    front: [
      '........................',
      '........................',
      '........................',
      '........................',
      '.......HHHhHHHHhHH......',
      '......HHHHHHHHHHHHH.....',
      '......HhHHHHHHHHHhH.....',
      '......H..........H......',
    ],
  },
  ghost: {
    skin: '#F2B98A', skinShade: '#D69A6A', shirt: '#8D9BC0', shirtShade: '#66759C',
    hair: '#8D9BC0', hairShade: '#66759C', accent: '#4A577D', accentShade: '#333E5E',
    back: [
      '........................',
      '........................',
      '.......HHHHHHHHHH.......',
      '.....HHHHHHHHHHHHHH.....',
      '....HHHHHHHHHHHHHHHH....',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '...hHHHHHHHHHHHHHHHHh...',
      '...hHHHHHHHHHHHHHHHHh...',
      '...hhHHHHHHHHHHHHHHhh...',
      '....hhHHHHHHHHHHHHhh....',
      '.....hhhHHHHHHHHhhh.....',
    ],
    front: [
      '........................',
      '........................',
      '........................',
      '........HHHHHHHH........',
      '......HHHHHHHHHHHH......',
      '.....HHhhhhhhhhhhHH.....',
      '.....Hh..........hH.....',
      '.....Hh..........hH.....',
      '.....Hh..........hH.....',
      '.....Hh..........hH.....',
      '.....Hh..........hH.....',
      '.....Hh..........hH.....',
      '.....Hh..........hH.....',
      '.....Hhh........hhH.....',
      '......Hhh......hhH......',
      '.......HHh....hHH.......',
      '..........AaaA..........',
    ],
  },
};

function characterPalette(ch: Character): Palette {
  return {
    S: ch.skin,
    s: ch.skinShade,
    k: ch.skinShade,
    E: INK,
    G: WHITE,
    M: '#7A2E3A',
    B: '#FF9AA8',
    T: ch.shirt,
    t: ch.shirtShade,
    V: ch.skin,
    v: ch.shirtShade,
    H: ch.hair,
    h: ch.hairShade,
    A: ch.accent,
    a: ch.accentShade,
    W: WHITE,
  };
}

function avatarBase(id: AvatarArtId): PixelCanvas {
  const ch = CHARACTERS[id];
  const pal = characterPalette(ch);
  const c = new PixelCanvas(24, 24);
  if (ch.back) c.stamp(ch.back, pal);
  c.stamp(FACE_TEMPLATE, pal);
  c.stamp(ch.front, pal);
  c.outline(INK);
  return c.clip(inside(INNER_R));
}

function rankBackdrop(rank: RankArtKey): PixelCanvas {
  const col = RANK_COLOURS[rank];
  const c = new PixelCanvas(24, 24);
  c.disc(CX, CY, BUBBLE_R, col.fill);
  // Soft inner glow towards the rim (dithered so it stays pixel-y).
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
      if (d > BUBBLE_R) continue;
      const t = (d - 6) / (BUBBLE_R - 6);
      if (t > 0 && dither(x, y, t * 0.85)) c.set(x, y, col.glow);
    }
  const thick = rank === 'rookie' || rank === 'grinder' ? 1 : 2;
  if (rank === 'final-boss') {
    c.ring(CX, CY, BUBBLE_R, 2, (a) => RAINBOW[Math.floor(((a + Math.PI) / (2 * Math.PI)) * RAINBOW.length) % RAINBOW.length] ?? AQUA);
  } else {
    c.ring(CX, CY, BUBBLE_R, thick, col.ring);
  }
  // Bubble shine (top-left).
  c.set(5, 5, withAlpha(WHITE, 0.9)).set(6, 4, withAlpha(WHITE, 0.9)).set(4, 7, withAlpha(WHITE, 0.6));
  // Higher ranks earn sparkles in the corners.
  const sparkle = (x: number, y: number, colour: Colour) =>
    c.set(x, y, colour).set(x - 1, y, withAlpha(colour, 0.7)).set(x + 1, y, withAlpha(colour, 0.7)).set(x, y - 1, withAlpha(colour, 0.7)).set(x, y + 1, withAlpha(colour, 0.7));
  const sparkleCount = { rookie: 0, grinder: 0, 'locked-in': 1, disciplined: 2, 'monk-mode': 3, 'final-boss': 4 }[rank];
  const spots: Array<[number, number]> = [[21, 2], [2, 21], [21, 21], [2, 2]];
  spots.slice(0, sparkleCount).forEach(([x, y]) => sparkle(x, y, rank === 'final-boss' ? AQUA : col.ring));
  return c;
}

function stateOverlay(state: 'clown' | 'chicken' | 'jail' | 'shield'): PixelCanvas {
  const c = new PixelCanvas(24, 24);
  if (state === 'clown') {
    c.stamp(
      [
        '........................',
        '........................',
        '........................',
        '........................',
        '....OO............BB....',
        '...OOOO..........BBBB...',
        '...OYOO..........BBGB...',
        '...OYYO..........BGGB...',
        '...OOOO..........BBBB...',
        '....OO............BB....',
        '........................',
        '...........nN...........',
        '...........NN...........',
        '........R......R........',
        '.........RRRRRR.........',
      ],
      { O: '#FF4D6D', Y: '#FFE14D', B: '#4DA3FF', G: '#39FF88', N: '#FF2B2B', n: '#FFB3B3', R: '#E0203A' },
    );
    c.outline(INK);
  } else if (state === 'chicken') {
    const hood = new PixelCanvas(24, 24);
    hood.stamp(
      [
        '..........RR............',
        '.........RRRR.R.........',
        '........RRRRRRRR........',
        '.......WWWWWWWWWWW......',
        '.....WWWWWWWWWWWWWWW....',
        '....WWWWWWWWWWWWWWWWW...',
        '....WWWWWWWWWWWWWWWWW...',
        '....WWWWWWYYYYWWWWWWW...',
        '....WWWWWWyYYyWWWWWWW...',
        '....WWw...yyyy....wWW...',
        '....WWw...........wWW...',
        '....WWw...........wWW...',
        '....WWw...........wWW...',
        '....WWww.........wwWW...',
        '.....WWww.......wwWW....',
        '......WWwww...wwwWW.....',
        '.......WWWWWWWWWWW......',
        '....WWWWWWWWWWWWWWWWW...',
        '..WWWWwWWWWWWWWWWWwWWW..',
        '..WWWwWWWWWWWWWWWWWwWW..',
        '..WWwWWWWWWWWWWWWWWWwW..',
        '..WWwWWWWWWWWWWWWWWWwW..',
        '..WWWWWWWWWWWWWWWWWWWW..',
        '..WWWWWWWWWWWWWWWWWWWW..',
      ],
      { R: '#FF3B3B', W: '#FFFFFF', w: '#D8DDE8', Y: '#FFC94D', y: '#E08A1A' },
    );
    hood.outline(INK);
    c.draw(hood);
  } else if (state === 'jail') {
    for (const x of [3, 7, 11, 15, 19]) {
      c.rect(x, 0, 1, 24, STEEL.light);
      c.rect(x + 1, 0, 1, 24, STEEL.dark);
    }
    c.rect(0, 3, 24, 1, STEEL.light).rect(0, 4, 24, 1, STEEL.dark);
    c.rect(0, 18, 24, 1, STEEL.light).rect(0, 19, 24, 1, STEEL.dark);
  } else {
    c.ring(CX, CY, BUBBLE_R, 1, withAlpha(AQUA, 1));
    c.ring(CX, CY, BUBBLE_R - 1, 1, withAlpha(AQUA, 0.55));
    c.ring(CX, CY, BUBBLE_R - 2, 1, withAlpha(AQUA, 0.2));
  }
  return c.clip(inside(BUBBLE_R));
}

// ---------------------------------------------------------------------------
// Small icons — 12×12 (status) and 16×16 (tabs, SOS, medals)
// ---------------------------------------------------------------------------

function icon(rows: readonly string[], palette: Palette, size = 12): PixelCanvas {
  const c = new PixelCanvas(size, size);
  c.stamp(rows, palette);
  return c.outline(INK);
}

const STATUS_ICONS: Record<string, () => PixelCanvas> = {
  checked: () =>
    icon(
      [
        '............',
        '............',
        '.........GG.',
        '........GGG.',
        '.......GGG..',
        '.GG...GGG...',
        '.GGG.GGGd...',
        '..GGGGGd....',
        '...GGGd.....',
        '....Gd......',
        '............',
        '............',
      ],
      { G: CLEAN, d: CLEAN_DARK },
    ),
  pending: () =>
    icon(
      [
        '............',
        '............',
        '............',
        '............',
        '....pppp....',
        '...pPPPPp...',
        '...pPPPPp...',
        '....pppp....',
        '............',
        '............',
        '............',
        '............',
      ],
      { p: '#5B76B0', P: '#93AEDF' },
    ),
  box: () =>
    icon(
      [
        '............',
        '............',
        '..LLLLRLLL..',
        '.LLLLLRLLLL.',
        '.DDDDDRDDDD.',
        '..BBBBRBBB..',
        '..BBBBRBBB..',
        '..BBBBRBBB..',
        '..bbbbRbbb..',
        '............',
        '............',
        '............',
      ],
      { L: GOLD.light, D: GOLD.dark, B: GOLD.base, b: GOLD.dark, R: SLIPPED },
    ),
  coward: () =>
    icon(
      [
        '....RR......',
        '...RRRR.....',
        '...WWWWW....',
        '..WWWWWWW...',
        '..WWEWWWW...',
        '..WWWWWYYY..',
        '..WWWWWYy...',
        '..WWWRWW....',
        '...WWRWW....',
        '...wWWWW....',
        '....www.....',
        '............',
      ],
      { R: '#FF3B3B', W: WHITE, w: '#D8DDE8', E: INK, Y: GOLD.base, y: '#E08A1A' },
    ),
  clown: () =>
    icon(
      [
        '............',
        '.OO......BB.',
        'OOOWWWWWWBBB',
        'OO.WWWWWW.BB',
        '..WWEWWEWW..',
        '..WWWWWWWW..',
        '..WWWNNWWW..',
        '..WWWNNWWW..',
        '..WMWWWWMW..',
        '...WMMMMW...',
        '....WWWW....',
        '............',
      ],
      { O: '#FF4D6D', B: '#4DA3FF', W: WHITE, E: INK, N: '#FF2B2B', M: '#E0203A' },
    ),
  vacation: () =>
    icon(
      [
        '............',
        '..LL..LLL...',
        '.LLLLLLLLL..',
        'LL..LTLL.LL.',
        'L...TT...L..',
        '....T.......',
        '....TT......',
        '.....T......',
        '.....T......',
        '..SSSSSSS...',
        '.SSSSSSSSS..',
        '............',
      ],
      { L: VACATION, T: '#B87243', S: '#FFE08A' },
    ),
  frozen: () =>
    icon(
      [
        '............',
        '..IIIIIIII..',
        '.IWWIIIIIIi.',
        '.IWIIIIIIIi.',
        '.IIIIIWIIIi.',
        '.IIIIIIIIIi.',
        '.IIIIIIIIIi.',
        '.IIIIIIIIIi.',
        '.IiIIIIIIii.',
        '..iiiiiiii..',
        '............',
        '............',
      ],
      { I: FROZEN, W: WHITE, i: '#3FA6E0' },
    ),
};

/** Rank emblems (12×12) for rank chips. */
function rankIcon(rank: RankArtKey): PixelCanvas {
  const col = RANK_COLOURS[rank];
  const pal = { C: col.ring, c: toHex(mix(col.ring, INK, 0.35)), W: WHITE };
  const shapes: Record<RankArtKey, readonly string[]> = {
    rookie: ['............', '............', '............', '............', '..C......C..', '..CC....CC..', '...CC..CC...', '....CCCC....', '.....cc.....', '............', '............', '............'],
    grinder: ['............', '............', '..C......C..', '..CC....CC..', '...CC..CC...', '....CCCC....', '..C.cccc.C..', '..CC....CC..', '...CC..CC...', '....CCCC....', '.....cc.....', '............'],
    'locked-in': ['............', '....CCCC....', '...C....C...', '...C....C...', '..CCCCCCCC..', '..CCCCCCCC..', '..CCCWWCCC..', '..CCCWWCCC..', '..CCCCCCCC..', '..cccccccc..', '............', '............'],
    disciplined: ['............', '.....CC.....', '.....CC.....', '....CCCC....', 'CCCCCCCCCCCC', '.CCCCWCCCCC.', '..CCCCCCCC..', '..CCCCCCCC..', '.CCCc..cCCC.', '.CCc....cCC.', '.cc......cc.', '............'],
    'monk-mode': ['............', '.....CC.....', '....CCCC....', '...CCWCCC...', '..CCWCCCCC..', '.CCCCCCCCCC.', '.cCCCCCCCCc.', '..cCCCCCCc..', '...cCCCCc...', '....cCCc....', '.....cc.....', '............'],
    'final-boss': ['............', '.......CC...', '......CCC...', '.....CCC....', '....CCC.....', '...CCCCCCC..', '..CCCCCCC...', '.....CCC....', '....CCC.....', '...CCc......', '...Cc.......', '............'],
  };
  return icon(shapes[rank], pal);
}

const TAB_ICONS: Record<string, () => PixelCanvas> = {
  home: () =>
    icon(
      [
        '................',
        '.......RR.......',
        '......RRRR......',
        '.....RRRRRR.....',
        '....RRRRRRRR....',
        '...RRRRRRRRRR...',
        '..RRRRRRRRRRRR..',
        '...WWWWWWWWWW...',
        '...WWWWWWWWWW...',
        '...WWBBWWDDWW...',
        '...WWBBWWDDWW...',
        '...WWWWWWDDWW...',
        '...WWWWWWDDWW...',
        '...wwwwwwDDww...',
        '................',
        '................',
      ],
      { R: BUBBLE, W: FOAM, w: '#B5C9EC', B: AQUA, D: '#FF8A3D' },
      16,
    ),
  leaderboard: () =>
    icon(
      [
        '................',
        '...GGGGGGGGGG...',
        '.GGGLLGGGGGGGGG.',
        '.G.GLGGGGGGGG.G.',
        '.G.GLGGGGGGGG.G.',
        '..GGGGGGGGGGGG..',
        '....GGGGGGGG....',
        '.....GGGGGG.....',
        '......dGGd......',
        '.......GG.......',
        '.......GG.......',
        '.....dGGGGd.....',
        '....BBBBBBBB....',
        '....BBBBBBBB....',
        '................',
        '................',
      ],
      { G: GOLD.base, L: GOLD.light, d: GOLD.dark, B: '#9A5A2B' },
      16,
    ),
  votes: () =>
    icon(
      [
        '................',
        '.....PPPPPP.....',
        '.....PWWWWP.....',
        '.....PWGGWP.....',
        '.....PWWWWP.....',
        '..BBBBBBBBBBBB..',
        '..BbbbbbbbbbbB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBBBBBBBB..',
        '..dddddddddddd..',
        '................',
        '................',
        '................',
      ],
      { P: '#D8DDE8', W: WHITE, G: CLEAN, B: '#FF7AC8', b: '#8A2A60', d: '#C94A90' },
      16,
    ),
  history: () =>
    icon(
      [
        '................',
        '...R.......R....',
        '..RRRRRRRRRRRR..',
        '..RRRRRRRRRRRR..',
        '..WWWWWWWWWWWW..',
        '..WGGWCCWGGWWW..',
        '..WGGWCCWGGWWW..',
        '..WWWWWWWWWWWW..',
        '..WGGWOOWGGWWW..',
        '..WGGWOOWGGWWW..',
        '..WWWWWWWWWWWW..',
        '..WTTWGGWWWWWW..',
        '..WTTWGGWWWWWW..',
        '..wwwwwwwwwwww..',
        '................',
        '................',
      ],
      { R: SLIPPED, W: FOAM, w: '#B5C9EC', G: CLEAN, C: SKY, O: '#FFB020', T: VACATION },
      16,
    ),
  profile: () =>
    icon(
      [
        '................',
        '......SSSS......',
        '.....SSSSSS.....',
        '.....SSSSSS.....',
        '.....SSSSSS.....',
        '......SSSS......',
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAAAAAAAAAA..',
        '..AAAAAAAAAAAA..',
        '..aaaaaaaaaaaa..',
        '................',
        '................',
        '................',
        '................',
      ],
      { S: '#FFD7B5', A: AQUA, a: '#36B5D6' },
      16,
    ),
};

function sosIcon(): PixelCanvas {
  // Lifebuoy ring: red & white quarters.
  const c = new PixelCanvas(16, 16);
  c.ring(8, 8, 7.5, 3.4, (a) => (Math.floor(((a + Math.PI / 4 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 2 === 0 ? '#FF3B3B' : WHITE));
  c.outline(INK);
  // Inner hole outline (outline() only handles the outer edge of each shape).
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (d <= 4.1 && d > 3.1) c.set(x, y, INK);
    }
  c.set(4, 3, withAlpha(WHITE, 0.8));
  return c;
}

const MISC_ICONS: Record<string, () => PixelCanvas> = {
  coin: () =>
    icon(
      ['............', '....YYYY....', '...YLLYYY...', '..YLYYYYdY..', '..YLYddYdY..', '..YYYdYYdY..', '..YYYdYYdY..', '..YYYddYdY..', '...YYYYdY...', '....dddd....', '............', '............'],
      { Y: GOLD.base, L: GOLD.light, d: GOLD.dark },
    ),
  sparkle: () => {
    const c = new PixelCanvas(8, 8);
    c.stamp(['...W....', '...W....', '..WAW...', 'WWAAAWW.', '..WAW...', '...W....', '...W....', '........'], { W: WHITE, A: AQUA });
    return c;
  },
  shield: () =>
    icon(
      ['............', '.BBBBBBBBBB.', '.BLLBBBBBBB.', '.BLBBBBBBBB.', '.BBBBWWBBBB.', '.BBBWWWWBBB.', '.BBBBWWBBBB.', '..BBBBBBBB..', '..BBBBBBBB..', '...BBBBBB...', '....BBBB....', '.....BB.....'],
      { B: BUBBLE, L: BUBBLE_LIGHT, W: AQUA },
    ),
  hourglass: () =>
    icon(
      ['............', '..WWWWWWWW..', '...GYYYYG...', '...GYYYYG...', '....GYYG....', '.....GG.....', '.....GG.....', '....GG.G....', '...G.YY.G...', '...GYYYYG...', '..WWWWWWWW..', '............'],
      { W: '#B87243', G: FROZEN, Y: GOLD.base },
    ),
  lock: () =>
    icon(
      ['............', '....SSSS....', '...S....S...', '...S....S...', '..BBBBBBBB..', '..BLLBBBBB..', '..BBBOOBBB..', '..BBBOOBBB..', '..BBBBBBBB..', '..dddddddd..', '............', '............'],
      { S: STEEL.base, B: BUBBLE, L: BUBBLE_LIGHT, O: FIRE.mid, d: BUBBLE_DARK },
    ),
  bell: () =>
    icon(
      ['.....YY.....', '....YYYY....', '...YLYYYY...', '...YLYYYY...', '...YYYYYY...', '..YYYYYYYY..', '..YYYYYYYY..', '.YYYYYYYYYY.', '.dddddddddd.', '.....dd.....', '............', '............'],
      { Y: GOLD.base, L: GOLD.light, d: GOLD.dark },
    ),
  bolt: () => rankIcon('final-boss'),
  star: () =>
    icon(
      ['............', '.....YY.....', '.....YY.....', '....YYYY....', 'YYYYYYYYYYYY', '.YYYYLYYYYY.', '..YYYYYYYY..', '..YYYYYYYY..', '.YYYd..dYYY.', '.YYd....dYY.', '.dd......dd.', '............'],
      { Y: GOLD.base, L: WHITE, d: GOLD.dark },
    ),
};

// ---------------------------------------------------------------------------
// Medals (leaderboard positions) — 16×16
// ---------------------------------------------------------------------------

function crown(): PixelCanvas {
  return icon(
    [
      '................',
      '................',
      '................',
      '.R.....BB.....R.',
      '.G.....GG.....G.',
      '.GG...GGGG...GG.',
      '.GGG.GGLLGG.GGG.',
      '.GGGGGGLLGGGGGG.',
      '.GGGGGGGGGGGGGG.',
      '.GGGGRGGGGBGGGG.',
      '.GGGGGGGGGGGGGG.',
      '.dddddddddddddd.',
      '.dddddddddddddd.',
      '................',
      '................',
      '................',
    ],
    { G: GOLD.base, L: GOLD.light, d: GOLD.dark, R: SLIPPED, B: '#4DA3FF' },
    16,
  );
}

function medal(place: 2 | 3): PixelCanvas {
  const metal = place === 2 ? SILVER : BRONZE;
  const digit =
    place === 2
      ? ['DDD', '..D', 'DDD', 'D..', 'DDD']
      : ['DDD', '..D', '.DD', '..D', 'DDD'];
  const c = new PixelCanvas(16, 16);
  c.stamp(
    ['...RR......BB...', '....RR....BB....', '.....RR..BB.....', '......RRBB......'],
    { R: '#FF4D6D', B: '#4DA3FF' },
  );
  c.disc(8, 9.5, 5.6, metal.base);
  c.ring(8, 9.5, 5.6, 1, metal.dark);
  c.set(5, 7, metal.light).set(5, 8, metal.light).set(6, 6, metal.light);
  c.stamp(digit, { D: metal.dark }, 7, 7);
  return c.outline(INK);
}

// ---------------------------------------------------------------------------
// Mystery box (SPEC §9) — 24×24, palette-swapped per rarity
// ---------------------------------------------------------------------------

const BOX_ROWS = [
  '........................',
  '........................',
  '........................',
  '.......R.........R......',
  '......RRR.......RRR.....',
  '.......RRR.....RRR......',
  '.........RR...RR........',
  '...LLLLLLLLRRRLLLLLLLL..',
  '..LLLLLLLLLRRRLLLLLLLLL.',
  '..LhhLLLLLLRRRLLLLLLLLL.',
  '..DDDDDDDDDRRRDDDDDDDDD.',
  '...BBBBBBBBRRRBBBBBBBB..',
  '...BBBQQQBBRRRBBBBBBBB..',
  '...BBQBBBQBRRRBBBBBBBB..',
  '...BBBBBBQBRRRBBBBBBBB..',
  '...BBBBBQBBRRRBBBBBBBB..',
  '...BBBBQBBBRRRBBBBBBBB..',
  '...BBBBBBBBRRRBBBBBBBB..',
  '...BBBBQBBBRRRBBBBBBBB..',
  '...bbbbbbbbRRRbbbbbbbb..',
  '...bbbbbbbbrrrbbbbbbbb..',
  '........................',
  '........................',
  '........................',
];

function mysteryBox(theme: 'owed' | keyof typeof RARITY): PixelCanvas {
  const themes = {
    owed: { L: '#5C6FD6', D: '#2E3A8C', B: '#3F4FB8', b: '#2B3684', R: AQUA, r: '#36B5D6', Q: AQUA },
    common: { L: '#D8DCE8', D: '#8C93A8', B: RARITY.common, b: '#8C93A8', R: '#5B76B0', r: '#3F548A', Q: WHITE },
    rare: { L: '#8CC2FF', D: '#2A6FD0', B: RARITY.rare, b: '#2A6FD0', R: GOLD.base, r: GOLD.dark, Q: WHITE },
    epic: { L: '#D2A3FF', D: '#7A3CC4', B: RARITY.epic, b: '#7A3CC4', R: AQUA, r: '#36B5D6', Q: WHITE },
    legendary: { L: GOLD.light, D: GOLD.dark, B: GOLD.base, b: GOLD.dark, R: SLIPPED, r: '#C42746', Q: WHITE },
    cursed: { L: '#FF8080', D: '#991B1B', B: RARITY.cursed, b: '#991B1B', R: '#1E1A2E', r: '#0E0C17', Q: '#1E1A2E' },
  } as const;
  const t = themes[theme];
  const c = new PixelCanvas(24, 24);
  c.stamp(BOX_ROWS, { ...t, h: WHITE });
  return c.outline(INK);
}

// ---------------------------------------------------------------------------
// Brand: padlock (with a flame keyhole) — 24×24
// ---------------------------------------------------------------------------

export function padlock(): PixelCanvas {
  const c = new PixelCanvas(24, 24);
  // Shackle: top half of a ring + two legs.
  const shackle = new PixelCanvas(24, 24);
  shackle.ring(12, 10, 7, 3, (a) => (a < -Math.PI * 0.62 ? STEEL.light : a > -Math.PI * 0.3 ? STEEL.dark : STEEL.base));
  shackle.clip((_x, y) => y <= 9);
  shackle.rect(5, 10, 3, 2, STEEL.base).rect(16, 10, 3, 2, STEEL.dark);
  c.draw(shackle);
  // Body: a rounded "bubble" block.
  c.stamp(
    [
      '.....LLLLLLLLLLLLLL.....',
      '....LLLLLLLLLLLLLLLL....',
      '...LWWWLLLLLLLLLLLLLL...',
      '...LWBBBBBBBBBBBBBBBB...',
      '...BBBBBBBBBBBBBBBBBB...',
      '...BBBBBBBBBBBBBBBBBB...',
      '...BBBBBBBBBBBBBBBBBB...',
      '...BBBBBBBBBBBBBBBBBB...',
      '...BBBBBBBBBBBBBBBBBB...',
      '...BBBBBBBBBBBBBBBBBB...',
      '...DDDBBBBBBBBBBBBDDD...',
      '....DDDDDDDDDDDDDDDD....',
      '.....DDDDDDDDDDDDDD.....',
    ],
    { L: BUBBLE_LIGHT, W: WHITE, B: BUBBLE, D: BUBBLE_DARK },
    0,
    10,
  );
  // Flame keyhole.
  const flame = new PixelCanvas(24, 24);
  flame.stamp(
    ['...O..', '..OO..', '..OYO.', '.OYYO.', 'OYYWYO', 'OYWWYO', '.OYYO.', '..OO..'],
    { O: FIRE.mid, Y: FIRE.inner, W: FIRE.core },
    9,
    12,
  );
  flame.outline(INK);
  c.draw(flame);
  return c.outline(INK);
}

/** Dithered glow used behind headers (64×32). */
function glow(): PixelCanvas {
  const c = new PixelCanvas(64, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) {
      const dx = (x + 0.5 - 32) / 32;
      const dy = (y + 0.5 - 4) / 28;
      const t = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      if (dither(x, y, t * 1.1)) c.set(x, y, withAlpha(BUBBLE, 0.55));
      if (dither(x + 2, y + 1, t * 0.55)) c.set(x, y, withAlpha(AQUA, 0.45));
    }
  return c;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const RANK_KEYS: readonly RankArtKey[] = ['rookie', 'grinder', 'locked-in', 'disciplined', 'monk-mode', 'final-boss'];

export function allSprites(): SpriteDef[] {
  const sprites: SpriteDef[] = [];
  const add = (key: string, canvas: PixelCanvas, baseDp: number, category: string) => sprites.push({ key, canvas, baseDp, category });

  add('brand/padlock', padlock(), 120, 'brand');
  add('fx/glow', glow(), 384, 'fx');
  add('fx/sparkle', MISC_ICONS.sparkle?.() ?? new PixelCanvas(8, 8), 24, 'fx');

  ([0, 1, 2, 3, 4] as const).forEach((tier) => add(`flame/tier${tier}`, flameTier(tier), 96, 'flame'));

  add('medal/1', crown(), 48, 'medal');
  add('medal/2', medal(2), 48, 'medal');
  add('medal/3', medal(3), 48, 'medal');

  for (const [name, make] of Object.entries(STATUS_ICONS)) add(`status/${name}`, make(), 48, 'status');
  for (const rank of RANK_KEYS) add(`rank/${rank}`, rankIcon(rank), 36, 'rank');
  for (const [name, make] of Object.entries(TAB_ICONS)) add(`tab/${name}`, make(), 32, 'tab');
  add('icon/sos', sosIcon(), 48, 'icon');
  for (const [name, make] of Object.entries(MISC_ICONS)) if (name !== 'sparkle') add(`icon/${name}`, make(), 48, 'icon');

  add('box/owed', mysteryBox('owed'), 192, 'box');
  for (const rarity of Object.keys(RARITY) as Array<keyof typeof RARITY>) add(`box/${rarity}`, mysteryBox(rarity), 192, 'box');

  for (const rank of RANK_KEYS) add(`avatar/rank/${rank}`, rankBackdrop(rank), 120, 'avatar');
  for (const id of AVATAR_IDS) add(`avatar/base/${id}`, avatarBase(id), 120, 'avatar');
  for (const state of ['clown', 'chicken', 'jail', 'shield'] as const) add(`avatar/state/${state}`, stateOverlay(state), 120, 'avatar');

  return sprites;
}
