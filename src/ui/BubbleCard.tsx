import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colours, gloss, radii, space, withOpacity, type SpaceKey } from './theme';

const TONES = {
  surface: { bg: colours.surface, border: colours.stroke, lip: colours.abyss },
  raised: { bg: colours.surface2, border: colours.strokeBright, lip: colours.abyss },
  primary: { bg: colours.primary, border: colours.primaryLight, lip: colours.primaryLip },
  glow: { bg: colours.surface, border: colours.aqua, lip: colours.abyss },
  gold: { bg: withOpacity(colours.gold, 0.14), border: colours.gold, lip: colours.abyss },
  clean: { bg: withOpacity(colours.clean, 0.12), border: colours.clean, lip: colours.abyss },
} as const;
export type BubbleCardTone = keyof typeof TONES;

export type BubbleCardProps = {
  children?: ReactNode;
  tone?: BubbleCardTone;
  padding?: SpaceKey;
  radius?: number;
  /** Bubble gloss highlight in the top-left corner. */
  shine?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A rounded "bubble" surface on a solid lip — the base container for everything. */
export function BubbleCard({
  children,
  tone = 'surface',
  padding = 'lg',
  radius = radii.lg,
  shine = true,
  style,
  contentStyle,
  testID,
}: BubbleCardProps) {
  const t = TONES[tone];
  return (
    <View testID={testID} style={[styles.lip, { backgroundColor: t.lip, borderRadius: radius }, style]}>
      <View style={[styles.body, { backgroundColor: t.bg, borderColor: t.border, borderRadius: radius, padding: space[padding] }, contentStyle]}>
        {shine ? (
          <>
            <View pointerEvents="none" style={[styles.shine, { borderRadius: radii.pill }]} />
            <View pointerEvents="none" style={styles.shineDot} />
          </>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lip: { paddingBottom: 4 },
  body: { borderWidth: 2, overflow: 'hidden' },
  shine: { position: 'absolute', top: 7, left: 18, width: '28%', height: 5, backgroundColor: gloss(0.12) },
  shineDot: { position: 'absolute', top: 7, left: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: gloss(0.22) },
});
