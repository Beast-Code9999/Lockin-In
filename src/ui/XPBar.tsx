import { StyleSheet, View } from 'react-native';

import { GameText } from './GameText';
import { colours, gloss, radii } from './theme';

export type XPBarProps = {
  current: number;
  /** Points needed for the next rank; null = max rank ("MAX", full bar). */
  next: number | null;
  segments?: number;
  colour?: string;
  showLabel?: boolean;
};

/** A rounded track filled with chunky pixel segments. */
export function XPBar({ current, next, segments = 12, colour = colours.aqua, showLabel = true }: XPBarProps) {
  const fraction = next === null ? 1 : next <= 0 ? 0 : Math.max(0, Math.min(1, current / next));
  const filled = Math.round(fraction * segments);
  const label = next === null ? 'MAX' : `${current}/${next}`;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={next === null ? 'Max rank' : `${current} of ${next} to next rank`}
      accessibilityValue={{ min: 0, max: next ?? 1, now: next === null ? 1 : current }}
    >
      <View style={styles.track}>
        {Array.from({ length: segments }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < filled ? colour : colours.surface2 }]}>
            {i < filled ? <View style={styles.segmentShine} /> : null}
          </View>
        ))}
      </View>
      {showLabel ? (
        <GameText variant="tag" tone={next === null ? 'gold' : 'muted'} style={styles.label}>
          {label}
        </GameText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: colours.abyss,
    borderWidth: 2,
    borderColor: colours.stroke,
  },
  segment: { flex: 1, height: 10, borderRadius: 3, overflow: 'hidden' },
  segmentShine: { height: 3, backgroundColor: gloss(0.45) },
  label: { minWidth: 36, textAlign: 'right' },
});
