import { StyleSheet, View } from 'react-native';

import { BubbleCard, type BubbleCardTone } from './BubbleCard';
import { GameText } from './GameText';
import type { PixelAssetKey } from './pixelAssets.generated';
import { Sprite } from './Sprite';

export type StatBubbleProps = {
  label: string;
  value: string | number;
  icon?: PixelAssetKey;
  tone?: BubbleCardTone;
  valueColour?: string;
};

/** A compact card with a big pixel number — scores, streaks, tokens. */
export function StatBubble({ label, value, icon, tone = 'surface', valueColour }: StatBubbleProps) {
  return (
    <BubbleCard tone={tone} padding="md" style={styles.card}>
      <View style={styles.row}>
        {icon ? <Sprite name={icon} size={22} /> : null}
        <GameText variant="caption" tone="muted" uppercase numberOfLines={1} style={styles.label}>
          {label}
        </GameText>
      </View>
      <GameText variant="number" colour={valueColour} accessibilityLabel={`${label}: ${value}`}>
        {value}
      </GameText>
    </BubbleCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  label: { flexShrink: 1, letterSpacing: 0.6 },
});
