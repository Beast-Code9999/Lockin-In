/**
 * The pixel-art contract: manifest.json ↔ generated registry ↔ files on disk.
 * Real art can replace PNGs later; these keys and files must keep existing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AVATAR_IDS, resolveAvatarLayers } from '../src/shared/avatar';
import { RANKS } from '../src/shared/ranks';
import { PIXEL_ASSETS } from '../src/ui/pixelAssets.generated';

type Manifest = { assets: Record<string, { file: string; grid: [number, number]; baseDp: number }> };

const PIXEL_DIR = join(__dirname, '..', 'assets', 'pixel');
const manifest = JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')) as Manifest;

describe('pixel assets', () => {
  it('registry and manifest list the same keys', () => {
    expect(Object.keys(PIXEL_ASSETS).sort()).toEqual(Object.keys(manifest.assets).sort());
  });

  it('every asset has @1x, @2x and @3x files', () => {
    const missing: string[] = [];
    for (const { file } of Object.values(manifest.assets)) {
      for (const suffix of ['', '@2x', '@3x']) {
        const path = join(PIXEL_DIR, file.replace(/\.png$/, `${suffix}.png`));
        if (!existsSync(path)) missing.push(path);
      }
    }
    expect(missing).toEqual([]);
  });

  it('base dp is a whole multiple of the art grid (keeps pixels square)', () => {
    for (const [key, e] of Object.entries(manifest.assets)) {
      expect([key, e.baseDp % e.grid[0]]).toEqual([key, 0]);
    }
  });

  it('every avatar layer the app can request exists', () => {
    const states = [{}, { owesBox: true }, { cowardUntil: '2999-01-01T00:00:00Z' }, { clownUntil: '2999-01-01T00:00:00Z' }, { shield: true }];
    for (const avatarId of AVATAR_IDS)
      for (const rank of RANKS)
        for (const extra of states)
          for (const layer of resolveAvatarLayers({ avatarId, rank: rank.key, ...extra })) expect(PIXEL_ASSETS).toHaveProperty([layer]);
  });

  it('has a flame for every tier and an icon for every rank', () => {
    for (const tier of [0, 1, 2, 3, 4]) expect(PIXEL_ASSETS).toHaveProperty([`flame/tier${tier}`]);
    for (const rank of RANKS) expect(PIXEL_ASSETS).toHaveProperty([`rank/${rank.key}`]);
  });
});
