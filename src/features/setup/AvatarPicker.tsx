import { Pressable, StyleSheet, View } from 'react-native';

import { AVATAR_IDS, type AvatarId } from '@/shared/avatar';
import { Avatar, haptics } from '@/ui';
import { colours, withOpacity } from '@/ui/theme';

/** Grid of the 8 base characters, each in its Rookie bubble. */
export function AvatarPicker({ value, onChange }: { value: string; onChange: (id: AvatarId) => void }) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {AVATAR_IDS.map((id) => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Character ${id}`}
            onPress={() => {
              haptics.tick();
              onChange(id);
            }}
            style={[styles.cell, selected && styles.selected]}
          >
            <Avatar inputs={{ avatarId: id, rank: 'rookie' }} size={64} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  cell: { padding: 6, borderRadius: 44, borderWidth: 3, borderColor: 'transparent' },
  selected: { borderColor: colours.aqua, backgroundColor: withOpacity(colours.aqua, 0.12), transform: [{ scale: 1.06 }] },
});
