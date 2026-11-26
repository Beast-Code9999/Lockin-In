import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { CheckInCard } from '@/features/checkin/CheckInCard';
import { CrewStrip } from '@/features/home/CrewStrip';
import { useHome } from '@/features/home/useHome';
import { flameTierForStreak, rankForStreak, xpProgress } from '@/shared/ranks';
import { Avatar, BubbleCard, GameText, Pill, RankBadge, Screen, Sprite, StatBubble, XPBar } from '@/ui';
import { colours } from '@/ui/theme';

/**
 * Home (SPEC §14.2). M1: live check-in card + crew strip.
 * Streak, score and rank show zero until scoring lands in M2.
 */
export default function HomeScreen() {
  const { data: home } = useHome();
  if (!home) return null;

  const streak = 0;
  const rank = rankForStreak(streak);
  const xp = xpProgress(streak);
  const tier = flameTierForStreak(streak);

  return (
    <Screen withTabBar>
      <BubbleCard contentStyle={styles.header}>
        <Avatar inputs={{ avatarId: home.me.avatar_id, rank: rank.key }} size={76} accessibilityLabel={`${home.me.display_name}'s avatar`} />
        <View style={styles.headerText}>
          <GameText variant="heading" numberOfLines={1}>
            {copy.home.greeting(home.me.display_name)}
          </GameText>
          <View style={styles.pills}>
            <RankBadge rank={rank.key} />
            {home.season ? <Pill label={`S${home.season.number}`} colour={colours.sky} /> : null}
          </View>
          <XPBar current={xp.current} next={xp.next} />
        </View>
      </BubbleCard>

      <CheckInCard home={home} />

      {home.members.length ? <CrewStrip members={home.members} /> : null}

      <BubbleCard tone="raised" contentStyle={styles.flame}>
        <Sprite name={`flame/tier${tier}`} size={88} />
        <View>
          <GameText variant="hero" colour={colours.gold}>
            {streak}
          </GameText>
          <GameText variant="label" tone="muted">
            {copy.home.streakLabel}
          </GameText>
        </View>
      </BubbleCard>

      <View style={styles.stats}>
        <StatBubble label={copy.home.score} value={0} icon="icon/lock" />
        <StatBubble label={copy.home.season} value={0} icon="icon/star" />
      </View>
      <GameText variant="caption" tone="faint" align="center">
        {copy.home.scoringSoon}
      </GameText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 8 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  flame: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stats: { flexDirection: 'row', gap: 12 },
});
