import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { signOut } from '@/features/auth/google';
import { useSession } from '@/features/auth/session';
import { useHome } from '@/features/home/useHome';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { rankKeyFromLabel } from '@/shared/ranks';
import { Avatar, BubbleButton, BubbleCard, GameText, RankBadge, Screen } from '@/ui';

/** Profile (SPEC §14.5): who you are, your crew + invite code, sign out. Badges and stats arrive with M2/M7. */
export default function ProfileScreen() {
  const profile = useMyProfile();
  const session = useSession();
  const home = useHome();
  const [busy, setBusy] = useState(false);

  return (
    <Screen withTabBar>
      <BubbleCard contentStyle={styles.card}>
        <Avatar inputs={{ avatarId: profile.data?.avatar_id ?? 'blaze', rank: rankKeyFromLabel(home.data?.stats.rank) }} size={120} />
        <GameText variant="title" align="center">
          {profile.data?.display_name ?? '…'}
        </GameText>
        <RankBadge rank={rankKeyFromLabel(home.data?.stats.rank)} style={styles.center} />
        <View style={styles.meta}>
          <GameText variant="caption" tone="faint" align="center">
            {copy.profile.signedInAs}
          </GameText>
          <GameText variant="small" tone="muted" align="center">
            {session?.user.email ?? ''}
          </GameText>
        </View>
      </BubbleCard>

      {home.data?.group ? (
        <BubbleCard tone="glow" contentStyle={styles.crew}>
          <GameText variant="caption" tone="muted" uppercase align="center" style={styles.stretch}>
            {copy.profile.crew}
          </GameText>
          <GameText variant="heading" align="center" style={styles.stretch}>
            {home.data.group.name}
          </GameText>
          <GameText variant="caption" tone="faint" uppercase align="center" style={styles.stretch}>
            {copy.profile.inviteCode}
          </GameText>
          <GameText variant="title" tone="aqua" align="center" selectable style={[styles.stretch, styles.code]}>
            {home.data.group.invite_code}
          </GameText>
          <BubbleButton
            label={copy.profile.share}
            variant="secondary"
            size="sm"
            style={styles.center}
            onPress={() => {
              const code = home.data?.group?.invite_code;
              if (code) void Share.share({ message: copy.setup.crew.shareMessage(code) });
            }}
          />
        </BubbleCard>
      ) : null}

      <BubbleButton label={copy.profile.settings} icon="status/frozen" fullWidth onPress={() => router.push('/settings')} />

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
  crew: { alignItems: 'center', gap: 6 },
  stretch: { alignSelf: 'stretch' },
  code: { letterSpacing: 6 },
});
