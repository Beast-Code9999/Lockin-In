import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { CheckInCard } from '@/features/checkin/CheckInCard';
import { CrewStrip } from '@/features/home/CrewStrip';
import { useHome } from '@/features/home/useHome';
import { rankKeyFromLabel, xpProgress } from '@/shared/ranks';
import { Avatar, BubbleCard, GameText, Pill, RankBadge, Screen, Sprite, StatBubble, XPBar } from '@/ui';
import { colours } from '@/ui/theme';

/** Home (SPEC §14.2): avatar + rank + XP, check-in card, crew strip, flame, scores, rival. */
export default function HomeScreen() {
  const { data: home } = useHome();
  if (!home) return null;

  const { stats } = home;
  const rank = rankKeyFromLabel(stats.rank);
  const xp = xpProgress(stats.current_streak);

  return (
    <Screen withTabBar>
      <BubbleCard contentStyle={styles.header}>
        <Avatar inputs={{ avatarId: home.me.avatar_id, rank }} size={76} accessibilityLabel={`${home.me.display_name}'s avatar`} />
        <View style={styles.headerText}>
          <GameText variant="heading" numberOfLines={1}>
            {copy.home.greeting(home.me.display_name)}
          </GameText>
          <View style={styles.pills}>
            <RankBadge rank={rank} />
            {home.season ? <Pill label={copy.home.seasonLeft(home.season.number, home.season.days_left)} colour={colours.sky} /> : null}
          </View>
          <XPBar current={xp.current} next={xp.next} />
        </View>
      </BubbleCard>

      <CheckInCard home={home} />

      {home.rival ? (
        <Pressable onPress={() => router.push('/leaderboard')} accessibilityRole="button">
          <BubbleCard tone="raised" padding="md" contentStyle={styles.rival}>
            <Sprite name="medal/1" size={30} />
            <GameText variant="label" style={styles.flex}>
              {home.rival}
            </GameText>
          </BubbleCard>
        </Pressable>
      ) : null}

      {home.members.length ? <CrewStrip members={home.members} /> : null}

      <BubbleCard tone="raised" contentStyle={styles.flame}>
        <Sprite name={`flame/tier${stats.flame_tier}`} size={88} />
        <View>
          <GameText variant="hero" colour={stats.flame_tier === 4 ? colours.aqua : colours.gold}>
            {stats.current_streak}
          </GameText>
          <GameText variant="label" tone="muted">
            {copy.home.streakLabel}
          </GameText>
          <GameText variant="caption" tone="faint">
            {copy.home.longest(stats.longest_streak)}
          </GameText>
        </View>
      </BubbleCard>

      <View style={styles.stats}>
        <StatBubble label={copy.home.score} value={stats.score_30d} icon="icon/lock" />
        <StatBubble
          label={copy.home.season}
          value={stats.season_points}
          icon="icon/star"
          valueColour={stats.season_points < 0 ? colours.slipped : undefined}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 8 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rival: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  flame: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stats: { flexDirection: 'row', gap: 12 },
});
