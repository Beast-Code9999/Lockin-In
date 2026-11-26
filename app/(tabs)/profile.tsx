import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { signOut } from '@/features/auth/google';
import { useSession } from '@/features/auth/session';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { Avatar, BubbleButton, BubbleCard, GameText, RankBadge, Screen } from '@/ui';

/** Profile (SPEC §14.5). M0: who you are + sign out. Badges and stats arrive with M2/M7. */
export default function ProfileScreen() {
  const profile = useMyProfile();
  const session = useSession();
  const [busy, setBusy] = useState(false);

  return (
    <Screen withTabBar>
      <BubbleCard contentStyle={styles.card}>
        <Avatar inputs={{ avatarId: profile.data?.avatar_id ?? 'blaze', rank: 'rookie' }} size={120} />
        <GameText variant="title" align="center">
          {profile.data?.display_name ?? '…'}
        </GameText>
        <RankBadge rank="rookie" style={styles.center} />
        <View style={styles.meta}>
          <GameText variant="caption" tone="faint" align="center">
            {copy.profile.signedInAs}
          </GameText>
          <GameText variant="small" tone="muted" align="center">
            {session?.user.email ?? ''}
          </GameText>
        </View>
      </BubbleCard>

      <BubbleButton
        label={copy.profile.signOut}
        variant="secondary"
        fullWidth
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        }}
      />
      {__DEV__ ? <BubbleButton label={copy.profile.uiKit} variant="secondary" size="sm" icon="fx/sparkle" style={styles.center} onPress={() => router.push('/dev/ui-kit')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  center: { alignSelf: 'center' },
  // Full width so single-line centred text isn't mis-measured and clipped on Android.
  meta: { alignSelf: 'stretch', marginTop: 6, gap: 2 },
});
