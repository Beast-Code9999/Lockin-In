import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { rankByKey, type FlameTier, type RankKey } from '@/shared/ranks';

import { GameText } from './GameText';
import type { PixelAssetKey } from './pixelAssets.generated';
import { Sprite } from './Sprite';
import { colours, radii, rankColours, rarityColours, withOpacity, type RarityKey } from './theme';

type PillProps = {
  label: string;
  colour?: string;
  icon?: PixelAssetKey;
  /** Solid fill instead of a tinted outline. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Small rounded chip with optional pixel icon. */
export function Pill({ label, colour = colours.sky, icon, solid = false, style }: PillProps) {
  return (
    <View
      style={[
        styles.pill,
        solid ? { backgroundColor: colour, borderColor: colour } : { backgroundColor: withOpacity(colour, 0.14), borderColor: colour },
        style,
      ]}
    >
      {icon ? <Sprite name={icon} size={16} /> : null}
      <GameText variant="tag" colour={solid ? colours.ink : colour} shadow={false} uppercase>
        {label}
      </GameText>
    </View>
  );
}

export function RankBadge({ rank, style }: { rank: RankKey; style?: StyleProp<ViewStyle> }) {
  return <Pill label={rankByKey(rank).label} colour={rankColours[rank]} icon={`rank/${rank}`} style={style} />;
}

const RARITY_LABEL: Record<RarityKey, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  cursed: 'Cursed',
};

export function RarityBadge({ rarity, style }: { rarity: RarityKey; style?: StyleProp<ViewStyle> }) {
  return <Pill label={RARITY_LABEL[rarity]} colour={rarityColours[rarity]} solid={rarity === 'cursed'} style={style} />;
}

/** Flame sprite for a tier, with the streak number in pixel type. */
export function FlameStreak({ tier, streak, size = 28 }: { tier: FlameTier; streak?: number; size?: number }) {
  return (
    <View style={styles.flame} accessible accessibilityLabel={streak === undefined ? undefined : `${streak} day streak`}>
      <Sprite name={`flame/tier${tier}`} size={size} />
      {streak !== undefined ? (
        <GameText variant="label" tone={tier === 4 ? 'aqua' : tier === 0 ? 'muted' : 'gold'} style={{ fontSize: Math.round(size * 0.82), lineHeight: Math.round(size * 0.86) }}>
          {streak}
        </GameText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  flame: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
