import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { rankKeyFromLabel } from '@/shared/ranks';
import { Avatar, GameText, Sprite } from '@/ui';
import { colours, gloss, radii } from '@/ui/theme';

import type { BoardRow } from './board';

const SLOT = {
  1: { height: 120, colour: colours.gold, medal: 'medal/1', delay: 250 },
  2: { height: 88, colour: '#C9D6EA', medal: 'medal/2', delay: 0 },
  3: { height: 64, colour: '#D08A4E', medal: 'medal/3', delay: 120 },
} as const;

function Step({ row, place, unit, onPress }: { row: BoardRow; place: 1 | 2 | 3; unit: string; onPress: () => void }) {
  const slot = SLOT[place];
  const still = useReducedMotion();
  const rise = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (!still) rise.set(withDelay(slot.delay, withSpring(1, { damping: 12, stiffness: 120 })));
  }, [rise, slot.delay, still]);
  const barStyle = useAnimatedStyle(() => ({ height: slot.height * rise.get() }));
  const headStyle = useAnimatedStyle(() => ({ opacity: rise.get(), transform: [{ translateY: (1 - rise.get()) * 20 }] }));

  return (
    <Pressable style={styles.step} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${place}: ${row.member.display_name}, ${row.value} ${unit}`}>
      <Animated.View style={[styles.head, headStyle]}>
        <Sprite name={slot.medal} size={place === 1 ? 34 : 28} />
        <Avatar inputs={{ avatarId: row.member.avatar_id, rank: rankKeyFromLabel(row.member.stats.rank) }} size={place === 1 ? 72 : 58} />
        <GameText variant="label" numberOfLines={1} tone={row.member.is_me ? 'aqua' : 'text'} style={styles.name}>
          {row.member.display_name}
        </GameText>
        <GameText variant="number" colour={slot.colour} style={styles.value}>
          {row.value}
        </GameText>
      </Animated.View>
      <Animated.View style={[styles.bar, { backgroundColor: slot.colour }, barStyle]}>
        <View style={styles.barShine} />
        <GameText variant="title" colour={colours.ink} shadow={false} style={styles.place}>
          {place}
        </GameText>
      </Animated.View>
    </Pressable>
  );
}

/** Animated podium for the top three (SPEC §14.3). Order on screen: 2 · 1 · 3. */
export function Podium({ rows, unit, onSelect }: { rows: BoardRow[]; unit: string; onSelect: (id: string) => void }) {
  const top = rows.slice(0, 3);
  const order: [BoardRow | undefined, 1 | 2 | 3][] = [
    [top[1], 2],
    [top[0], 1],
    [top[2], 3],
  ];
  return (
    <View style={styles.podium}>
      {order.map(([row, place]) =>
        row ? <Step key={row.member.id} row={row} place={place} unit={unit} onPress={() => onSelect(row.member.id)} /> : <View key={place} style={styles.step} />,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  step: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  head: { alignItems: 'center', gap: 2, marginBottom: 6 },
  name: { maxWidth: 100, fontSize: 20 },
  value: { fontSize: 30, lineHeight: 32 },
  bar: { alignSelf: 'stretch', borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md, alignItems: 'center', overflow: 'hidden' },
  barShine: { position: 'absolute', top: 6, left: 10, right: 10, height: 6, borderRadius: 3, backgroundColor: gloss(0.4) },
  place: { marginTop: 12 },
});
