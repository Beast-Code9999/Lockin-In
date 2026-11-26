import { copy } from '@/copy/en';
import { EmptyState, Screen } from '@/ui';

/** Leaderboard (SPEC §14.3) — lands in M2. */
export default function LeaderboardScreen() {
  return (
    <Screen withTabBar>
      <EmptyState icon="medal/1" title={copy.soon.leaderboard.title} body={copy.soon.leaderboard.body} />
    </Screen>
  );
}
