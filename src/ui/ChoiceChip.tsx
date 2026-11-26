import { Pressable, StyleSheet } from 'react-native';

import { GameText } from './GameText';
import { haptics } from './haptics';
import { colours, fonts, radii, withOpacity } from './theme';

export type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Selectable pill for small option sets (timezones, reminder times). */
export function ChoiceChip({ label, selected, onPress }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      <GameText variant="small" colour={selected ? colours.aqua : colours.textMuted} style={styles.text}>
        {label}
      </GameText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 2 },
  on: { borderColor: colours.aqua, backgroundColor: withOpacity(colours.aqua, 0.14) },
  off: { borderColor: colours.stroke, backgroundColor: colours.surface2 },
  text: { fontFamily: fonts.bodyExtraBold },
});
