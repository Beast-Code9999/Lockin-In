import { copy } from '@/copy/en';
import { EmptyState, Screen } from '@/ui';

/** Votes (SPEC §14.7) — lands in M5. */
export default function VotesScreen() {
  return (
    <Screen withTabBar>
      <EmptyState icon="tab/votes" title={copy.soon.votes.title} body={copy.soon.votes.body} />
    </Screen>
  );
}
