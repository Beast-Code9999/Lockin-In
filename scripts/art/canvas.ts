/**
 * A tiny RGBA pixel canvas for authoring placeholder pixel art in code.
 * Everything is drawn at 1 art-pixel = 1 cell, then upscaled with
 * nearest-neighbour when exported (see render.ts), so edges stay crisp.
 */

export type RGBA = readonly [number, number, number, number];
export type Colour = string | RGBA;
export type Palette = Readonly<Record<string, string>>;

const TRANSPARENT_CHARS = new Set(['.', ' ']);

export function rgba(colour: Colour): RGBA {
  if (typeof colour !== 'string') return colour;
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(colour);
  if (!m) throw new Error(`Bad colour "${colour}" (use #RRGGBB or #RRGGBBAA)`);
  const n = parseInt(m[1] ?? '', 16);
  const a = m[2] ? parseInt(m[2], 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** Mix two colours (t = 0 → a, t = 1 → b). Alpha is mixed too. */
export function mix(a: Colour, b: Colour, t: number): RGBA {
  const ca = rgba(a);
  const cb = rgba(b);
  const lerp = (i: number) => Math.round((ca[i] ?? 0) + ((cb[i] ?? 0) - (ca[i] ?? 0)) * t);
  return [lerp(0), lerp(1), lerp(2), lerp(3)];
}

export function toHex(colour: Colour): string {
  const [r, g, b, a] = rgba(colour);
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a === 255 ? '' : h(a)}`;
}

export function withAlpha(colour: Colour, alpha: number): RGBA {
  const c = rgba(colour);
  return [c[0], c[1], c[2], Math.round(Math.max(0, Math.min(1, alpha)) * 255)];
}

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  alphaAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3] ?? 0;
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    const d = this.data;
    return [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, d[i + 3] ?? 0];
  }

  /** Source-over composite a colour onto one cell. */
  set(x: number, y: number, colour: Colour): this {
    if (!this.inBounds(x, y)) return this;
    const [r, g, b, a] = rgba(colour);
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (a === 255) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
      return this;
    }
    if (a === 0) return this;
    const sa = a / 255;
    const da = (d[i + 3] ?? 0) / 255;
    const oa = sa + da * (1 - sa);
    const blend = (s: number, dst: number) => (s * sa + dst * da * (1 - sa)) / oa;
    d[i] = blend(r, d[i] ?? 0);
    d[i + 1] = blend(g, d[i + 1] ?? 0);
    d[i + 2] = blend(b, d[i + 2] ?? 0);
    d[i + 3] = oa * 255;
    return this;
  }

  clear(x: number, y: number): this {
    if (!this.inBounds(x, y)) return this;
    this.data.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, colour: Colour): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, colour);
    return this;
  }

  /** Filled circle. A cell is inside when its centre is within r of (cx, cy). */
  disc(cx: number, cy: number, r: number, colour: Colour): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, colour);
      }
    return this;
  }

  /** Ring between rOuter - thickness and rOuter. Colour may vary by angle (radians, 0 = right, clockwise). */
  ring(cx: number, cy: number, rOuter: number, thickness: number, colour: Colour | ((angle: number) => Colour)): this {
    const rInner = rOuter - thickness;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= rOuter * rOuter && d2 > rInner * rInner) {
          const c = typeof colour === 'function' ? colour(Math.atan2(dy, dx)) : colour;
          this.set(x, y, c);
        }
      }
    return this;
  }

  /**
   * Stamp ASCII art. Each character maps to a palette colour; '.' and ' ' are transparent.
   * Rows can be shorter than the canvas.
   */
  stamp(rows: readonly string[], palette: Palette, ox = 0, oy = 0): this {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (TRANSPARENT_CHARS.has(ch)) return;
        const colour = palette[ch];
        if (!colour) throw new Error(`No palette colour for "${ch}" (row ${y}: "${row}")`);
        this.set(ox + x, oy + y, colour);
      });
    });
    return this;
  }

  /** Add an outline around every opaque area (4-neighbour, or 8 with corners). */
  outline(colour: Colour, opts: { corners?: boolean; threshold?: number } = {}): this {
    const threshold = opts.threshold ?? 96;
    const targets: Array<[number, number]> = [];
    const neighbours = opts.corners
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) >= threshold) continue;
        if (neighbours.some(([dx, dy]) => this.alphaAt(x + (dx ?? 0), y + (dy ?? 0)) >= threshold)) targets.push([x, y]);
      }
    for (const [x, y] of targets) {
      this.clear(x, y);
      this.set(x, y, colour);
    }
    return this;
  }

  /** Remove every cell for which keep() is false. */
  clip(keep: (x: number, y: number) => boolean): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!keep(x, y)) this.clear(x, y);
    return this;
  }

  /** Recolour every opaque cell (keeps alpha). Handy for silhouettes. */
  tint(colour: Colour): this {
    const [r, g, b] = rgba(colour);
    for (let i = 0; i < this.data.length; i += 4) {
      if ((this.data[i + 3] ?? 0) === 0) continue;
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
    }
    return this;
  }

  /** Composite another canvas on top, optionally upscaled by an integer factor. */
  draw(src: PixelCanvas, ox = 0, oy = 0, scale = 1): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c[3] === 0) continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.set(ox + x * scale + sx, oy + y * scale + sy, c);
      }
    return this;
  }

  clone(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    c.data.set(this.data);
    return c;
  }

  flipX(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.set(this.w - 1 - x, y, this.get(x, y));
    return c;
  }
}

/** 4×4 Bayer matrix, normalised to 0..1 — for retro ordered dithering. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** True when an ordered-dither pattern should light this cell for intensity t (0..1). */
export function dither(x: number, y: number, t: number): boolean {
  return t > (BAYER4[y % 4]?.[x % 4] ?? 0.5);
}
