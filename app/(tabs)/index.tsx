import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { flameTierForStreak, rankForStreak, xpProgress } from '@/shared/ranks';
import { Avatar, BubbleButton, BubbleCard, GameText, RankBadge, Screen, Sprite, StatBubble, XPBar } from '@/ui';
import { colours } from '@/ui/theme';

/**
 * Home (SPEC §14.2). M0 shows the signed-in player and the layout skeleton.
 * Stats are zero until scoring lands (M2); the check-in card goes live in M1.
 */
export default function HomeScreen() {
  const profile = useMyProfile();
  const streak = 0;
  const rank = rankForStreak(streak);
  const xp = xpProgress(streak);
  const tier = flameTierForStreak(streak);
  const name = profile.data?.display_name ?? '…';

  return (
    <Screen withTabBar>
      <BubbleCard contentStyle={styles.header}>
        <Avatar inputs={{ avatarId: profile.data?.avatar_id ?? 'blaze', rank: rank.key }} size={76} accessibilityLabel={`${name}'s avatar`} />
        <View style={styles.headerText}>
          <GameText variant="heading" numberOfLines={1}>
            {copy.home.greeting(name)}
          </GameText>
          <RankBadge rank={rank.key} />
          <XPBar current={xp.current} next={xp.next} />
        </View>
      </BubbleCard>

      {profile.isError ? (
        <BubbleCard padding="md" contentStyle={styles.error}>
          <GameText variant="small" tone="slipped">
            {copy.home.loadError}
          </GameText>
          <BubbleButton label={copy.home.retry} size="sm" variant="secondary" onPress={() => void profile.refetch()} />
        </BubbleCard>
      ) : null}

      <BubbleCard tone="raised" contentStyle={styles.flame}>
        <Sprite name={`flame/tier${tier}`} size={96} />
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

      <BubbleCard tone="glow" contentStyle={styles.checkin}>
        <BubbleButton label={copy.home.checkInClean} variant="clean" size="lg" fullWidth disabled icon="status/checked" />
        <GameText variant="small" tone="muted" align="center">
          {copy.home.checkInSoon}
        </GameText>
      </BubbleCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 8 },
  error: { gap: 10 },
  flame: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stats: { flexDirection: 'row', gap: 12 },
  checkin: { gap: 12 },
});
