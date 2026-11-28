import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useHome } from '@/features/home/useHome';
import { rankKeyFromLabel, xpProgress } from '@/shared/ranks';
import { Avatar, BubbleButton, BubbleCard, EmptyState, FlameStreak, GameText, RankBadge, Screen, StatBubble, XPBar } from '@/ui';

/** A crew member's profile (SPEC §14.5): avatar, rank, XP and stats. Badges arrive in M7. */
export default function MemberProfile() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { data: home } = useHome();
  const member = home?.members.find((m) => m.id === uid);

  if (!member) {
    return (
      <Screen>
        <EmptyState icon="status/pending" title={copy.member.notFound} action={<BubbleButton label={copy.member.back} onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const { stats } = member;
  const rank = rankKeyFromLabel(stats.rank);
  const xp = xpProgress(stats.current_streak);
  return (
    <Screen>
      <BubbleButton label={copy.member.back} variant="secondary" size="sm" onPress={() => router.back()} />
      <BubbleCard contentStyle={styles.card}>
        <Avatar inputs={{ avatarId: member.avatar_id, rank }} size={128} accessibilityLabel={`${member.display_name}'s avatar`} />
        <GameText variant="title" align="center" style={styles.stretch}>
          {member.display_name}
        </GameText>
        <RankBadge rank={rank} style={styles.center} />
        <View style={styles.stretch}>
          <XPBar current={xp.current} next={xp.next} />
        </View>
        <GameText variant="small" tone={member.checked_today ? 'clean' : 'muted'} align="center" style={styles.stretch}>
          {member.checked_today ? copy.member.checkedToday : member.on_vacation_today ? copy.member.onVacation : copy.member.notYet}
        </GameText>
      </BubbleCard>

      <BubbleCard tone="raised" contentStyle={styles.flame}>
        <FlameStreak tier={stats.flame_tier} streak={stats.current_streak} size={56} />
        <GameText variant="label" tone="muted">
          {copy.home.streakLabel}
        </GameText>
      </BubbleCard>

      <View style={styles.stats}>
        <StatBubble label={copy.member.score} value={stats.score_30d} icon="icon/lock" />
        <StatBubble label={copy.member.season} value={stats.season_points} icon="icon/star" />
      </View>
      <View style={styles.stats}>
        <StatBubble label={copy.member.streak} value={stats.current_streak} icon="flame/tier1" />
        <StatBubble label={copy.member.longest} value={stats.longest_streak} icon="medal/1" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, paddingVertical: 22 },
  stretch: { alignSelf: 'stretch' },
  center: { alignSelf: 'center' },
  flame: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  stats: { flexDirection: 'row', gap: 12 },
});
