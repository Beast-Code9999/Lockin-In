import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

import type { PixelCanvas } from './canvas.ts';

/** Encode a canvas as PNG, upscaled by an integer factor with nearest-neighbour (keeps pixels crisp). */
export async function toPng(c: PixelCanvas, scale: number): Promise<Buffer> {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`Scale must be a positive integer, got ${scale}`);
  return sharp(Buffer.from(c.data.buffer, c.data.byteOffset, c.data.byteLength), {
    raw: { width: c.w, height: c.h, channels: 4 },
  })
    .resize({ width: c.w * scale, height: c.h * scale, kernel: 'nearest' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function writePng(c: PixelCanvas, file: string, scale: number): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, await toPng(c, scale));
}
