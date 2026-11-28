import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useHome } from '@/features/home/useHome';
import { buildBoard, type BoardTab } from '@/features/leaderboard/board';
import { Podium } from '@/features/leaderboard/Podium';
import { rankKeyFromLabel } from '@/shared/ranks';
import { Avatar, BubbleCard, ChoiceChip, EmptyState, FlameStreak, GameText, RankBadge, Screen } from '@/ui';
import { colours } from '@/ui/theme';

const TABS: BoardTab[] = ['score', 'season', 'streak'];

/** Leaderboard (SPEC §14.3): Lock-In Score (30d) · Season · Streak. Podium + full list. */
export default function LeaderboardScreen() {
  const { data: home } = useHome();
  const [tab, setTab] = useState<BoardTab>('score');
  if (!home) return null;

  const rows = buildBoard(home.members, tab);
  const unit = copy.leaderboard.units[tab];
  const explain =
    tab === 'season' && home.season ? copy.leaderboard.explain.season(home.season.number, home.season.days_left) : tab === 'season' ? '' : copy.leaderboard.explain[tab];
  const open = (id: string) => router.push({ pathname: '/profile/[uid]', params: { uid: id } });

  return (
    <Screen withTabBar>
      <GameText variant="title" accessibilityRole="header">
        {copy.leaderboard.title}
      </GameText>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <ChoiceChip key={t} label={copy.leaderboard.tabs[t]} selected={tab === t} onPress={() => setTab(t)} />
        ))}
      </View>
      <GameText variant="small" tone="muted">
        {explain}
      </GameText>

      {rows.length === 0 ? (
        <EmptyState icon="medal/1" title={copy.leaderboard.title} body={copy.leaderboard.empty} />
      ) : (
        <>
          <BubbleCard padding="md">
            <Podium key={tab} rows={rows} unit={unit} onSelect={open} />
          </BubbleCard>

          <View style={styles.list}>
            {rows.map((row) => (
              <Pressable key={row.member.id} onPress={() => open(row.member.id)} accessibilityRole="button">
                <BubbleCard
                  padding="sm"
                  shine={false}
                  tone={row.member.is_me ? 'glow' : 'surface'}
                  contentStyle={styles.row}
                >
                  <GameText variant="heading" tone="muted" style={styles.pos}>
                    {row.position}
                  </GameText>
                  <Avatar inputs={{ avatarId: row.member.avatar_id, rank: rankKeyFromLabel(row.member.stats.rank) }} size={46} />
                  <View style={styles.who}>
                    <GameText variant="label" numberOfLines={1}>
                      {row.member.display_name}
                      {row.member.is_me ? (
                        <GameText variant="caption" tone="aqua">
                          {`  ${copy.leaderboard.you}`}
                        </GameText>
                      ) : null}
                    </GameText>
                    <RankBadge rank={rankKeyFromLabel(row.member.stats.rank)} />
                  </View>
                  <View style={styles.right}>
                    <GameText variant="number" colour={row.value < 0 ? colours.slipped : undefined}>
                      {row.value}
                    </GameText>
                    <FlameStreak tier={row.member.stats.flame_tier} streak={row.member.stats.current_streak} size={18} />
                  </View>
                </BubbleCard>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pos: { width: 28, textAlign: 'center' },
  who: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 2 },
});
