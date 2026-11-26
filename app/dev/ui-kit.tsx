import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AVATAR_IDS } from '@/shared/avatar';
import { RANKS, flameTierForStreak, xpProgress } from '@/shared/ranks';
import {
  Avatar,
  BubbleButton,
  BubbleCard,
  EmptyState,
  FlameStreak,
  GameText,
  Pill,
  RankBadge,
  RarityBadge,
  Screen,
  Sprite,
  StatBubble,
  XPBar,
  type PixelAssetKey,
} from '@/ui';
import { colours, rarityColours, type RarityKey, type TypeVariant } from '@/ui/theme';

/** DEV ONLY (guarded in app/_layout.tsx): every UI-kit piece on one screen for on-device review. */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <GameText variant="heading" tone="aqua">
        {title}
      </GameText>
      {children}
    </View>
  );
}

const SWATCHES: [string, string][] = [
  ['bg', colours.bg],
  ['surface', colours.surface],
  ['surface2', colours.surface2],
  ['stroke', colours.stroke],
  ['primary', colours.primary],
  ['sky', colours.sky],
  ['aqua', colours.aqua],
  ['clean', colours.clean],
  ['slipped', colours.slipped],
  ['missed', colours.missed],
  ['frozen', colours.frozen],
  ['vacation', colours.vacation],
];

const TYPE_SAMPLES: [TypeVariant, string][] = [
  ['hero', '498'],
  ['title', 'Locked In'],
  ['heading', 'Season 3 · 4d left'],
  ['label', 'CHECK IN CLEAN'],
  ['tag', 'LEGENDARY'],
  ['bodyStrong', 'Reset, not over. Owning it is the move.'],
  ['body', 'Your 30-day score keeps most of your progress.'],
  ['caption', '12 pts to catch Miguel'],
];

const STATUS: PixelAssetKey[] = ['status/checked', 'status/pending', 'status/box', 'status/coward', 'status/clown', 'status/vacation', 'status/frozen'];
const BOXES: PixelAssetKey[] = ['box/owed', 'box/common', 'box/rare', 'box/epic', 'box/legendary', 'box/cursed'];
const ICONS: PixelAssetKey[] = ['medal/1', 'medal/2', 'medal/3', 'icon/sos', 'icon/coin', 'icon/shield', 'icon/hourglass', 'icon/lock', 'icon/star', 'tab/home', 'tab/leaderboard', 'tab/votes', 'tab/history', 'tab/profile'];

export default function UIKitScreen() {
  const [loading, setLoading] = useState(false);
  return (
    <Screen>
      <View style={styles.topRow}>
        <BubbleButton label="Close" variant="secondary" size="sm" onPress={() => router.back()} />
        <GameText variant="title">UI kit</GameText>
      </View>

      <Section title="Palette">
        <View style={styles.wrap}>
          {SWATCHES.map(([name, hex]) => (
            <View key={name} style={styles.swatch}>
              <View style={[styles.swatchChip, { backgroundColor: hex }]} />
              <GameText variant="caption" tone="muted">
                {name}
              </GameText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Type">
        <BubbleCard contentStyle={styles.gap}>
          {TYPE_SAMPLES.map(([variant, sample]) => (
            <GameText key={variant} variant={variant}>
              {sample}
            </GameText>
          ))}
        </BubbleCard>
      </Section>

      <Section title="Bubble buttons">
        <BubbleButton label="CHECK IN CLEAN" variant="clean" size="lg" icon="status/checked" fullWidth />
        <BubbleButton label="Open your box" variant="gold" icon="status/box" fullWidth />
        <BubbleButton label="Hold for backup" variant="danger" icon="icon/sos" fullWidth />
        <BubbleButton
          label="Primary"
          fullWidth
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1200);
          }}
        />
        <View style={styles.row}>
          <BubbleButton label="Secondary" variant="secondary" size="sm" />
          <BubbleButton label="Opens at 5pm" size="sm" disabled />
        </View>
      </Section>

      <Section title="Cards & stats">
        <View style={styles.row}>
          <StatBubble label="Lock-In Score" value={498} icon="icon/lock" />
          <StatBubble label="Season pts" value={-12} icon="icon/star" valueColour={colours.slipped} />
        </View>
        <BubbleCard tone="gold">
          <GameText variant="label" tone="gold">
            You owe a Mystery Box 📦
          </GameText>
        </BubbleCard>
        <BubbleCard tone="clean">
          <GameText variant="label" tone="clean">
            🔥 Locked in today
          </GameText>
        </BubbleCard>
      </Section>

      <Section title="Ranks & XP">
        {RANKS.map((rank) => {
          const streak = rank.minStreak + 2; // stays inside every rank band
          const xp = xpProgress(streak);
          return (
            <BubbleCard key={rank.key} padding="md" contentStyle={styles.rankRow}>
              <Avatar inputs={{ avatarId: AVATAR_IDS[RANKS.indexOf(rank) % AVATAR_IDS.length] ?? 'blaze', rank: rank.key }} size={52} />
              <View style={styles.flex}>
                <View style={styles.rowBetween}>
                  <RankBadge rank={rank.key} />
                  <FlameStreak tier={flameTierForStreak(streak)} streak={streak} />
                </View>
                <XPBar current={xp.current} next={xp.next} />
              </View>
            </BubbleCard>
          );
        })}
      </Section>

      <Section title="Avatars">
        <View style={styles.wrap}>
          {AVATAR_IDS.map((id) => (
            <Avatar key={id} inputs={{ avatarId: id, rank: 'rookie' }} size={64} />
          ))}
        </View>
        <View style={styles.wrap}>
          <Avatar inputs={{ avatarId: 'ace', rank: 'disciplined', clownUntil: '2999-01-01T00:00:00Z' }} size={72} />
          <Avatar inputs={{ avatarId: 'ghost', rank: 'grinder', cowardUntil: '2999-01-01T00:00:00Z' }} size={72} />
          <Avatar inputs={{ avatarId: 'blaze', rank: 'locked-in', owesBox: true }} size={72} />
          <Avatar inputs={{ avatarId: 'nova', rank: 'monk-mode', shield: true }} size={72} />
        </View>
      </Section>

      <Section title="Flames">
        <View style={styles.row}>
          {([0, 1, 2, 3, 4] as const).map((tier) => (
            <FlameStreak key={tier} tier={tier} size={44} />
          ))}
        </View>
      </Section>

      <Section title="Badges">
        <View style={styles.wrap}>
          {(Object.keys(rarityColours) as RarityKey[]).map((r) => (
            <RarityBadge key={r} rarity={r} />
          ))}
          <Pill label="Slipped" colour={colours.slipped} />
          <Pill label="Frozen" colour={colours.frozen} icon="status/frozen" />
          <Pill label="Vacation" colour={colours.vacation} icon="status/vacation" />
        </View>
      </Section>

      <Section title="Sprites">
        <BubbleCard contentStyle={styles.wrap}>
          {[...STATUS, ...ICONS].map((key) => (
            <Sprite key={key} name={key} size={36} />
          ))}
        </BubbleCard>
        <View style={styles.wrap}>
          {BOXES.map((key) => (
            <Sprite key={key} name={key} size={72} />
          ))}
        </View>
      </Section>

      <Section title="Empty state">
        <EmptyState icon="tab/votes" title="No votes yet" body="Proof checks and new box captions will land here." />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  section: { gap: 12 },
  gap: { gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  flex: { flex: 1, gap: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { alignItems: 'center', gap: 4, width: 64 },
  swatchChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colours.stroke },
});
