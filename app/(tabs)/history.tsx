import { copy } from '@/copy/en';
import { EmptyState, Screen } from '@/ui';

/** History calendar (SPEC §14.4) — lands in M1. */
export default function HistoryScreen() {
  return (
    <Screen withTabBar>
      <EmptyState icon="tab/history" title={copy.soon.history.title} body={copy.soon.history.body} />
    </Screen>
  );
}
