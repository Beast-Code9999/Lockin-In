import { router } from 'expo-router';

import { copy } from '@/copy/en';
import { BubbleButton, EmptyState, Screen } from '@/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState
        icon="status/pending"
        title={copy.notFound.title}
        body={copy.notFound.body}
        action={<BubbleButton label={copy.notFound.home} onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
