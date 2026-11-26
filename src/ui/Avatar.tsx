import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveAvatarLayers, type AvatarInputs } from '@/shared/avatar';

import { Sprite, isPixelAssetKey } from './Sprite';

export type AvatarProps = {
  /** Either pre-resolved layer keys (e.g. from a widget snapshot) or the inputs to resolve them. */
  layers?: readonly string[];
  inputs?: AvatarInputs;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Stacks pixel layers: rank bubble → character → state overlay (SPEC §8.3). */
export function Avatar({ layers, inputs, size = 64, style, accessibilityLabel }: AvatarProps) {
  const keys = (layers ?? (inputs ? resolveAvatarLayers(inputs) : [])).filter(isPixelAssetKey);
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, style]}
    >
      {keys.map((key, i) => (
        <Sprite key={key} name={key} size={size} style={i === 0 ? undefined : StyleSheet.absoluteFill} />
      ))}
    </View>
  );
}
