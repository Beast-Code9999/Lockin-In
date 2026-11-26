import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { PIXEL_ASSETS, type PixelAssetKey } from './pixelAssets.generated';

export type SpriteProps = {
  name: PixelAssetKey;
  /** Width in dp; height follows the art's aspect ratio. */
  size?: number;
  /** Recolour every opaque pixel (e.g. inactive tab icons). */
  tint?: string;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export function isPixelAssetKey(key: string): key is PixelAssetKey {
  return Object.prototype.hasOwnProperty.call(PIXEL_ASSETS, key);
}

/**
 * Renders a pixel-art asset. Assets are exported large with nearest-neighbour
 * scaling (scripts/gen-placeholder-art.ts), so on-device downscaling stays crisp.
 */
export function Sprite({ name, size = 24, tint, style, accessibilityLabel }: SpriteProps) {
  const asset = PIXEL_ASSETS[name];
  const height = (size * asset.height) / asset.width;
  return (
    <Image
      source={asset.source}
      fadeDuration={0}
      resizeMode="contain"
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height }, tint ? { tintColor: tint } : null, style]}
    />
  );
}
