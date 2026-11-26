import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { DEV_PLAYERS, devSignInAvailable, signInAsDevPlayer, type DevPlayer } from '@/features/auth/devPlayers';
import { signInWithGoogle, type SignInOutcome } from '@/features/auth/google';
import { BobbingPadlock } from '@/features/onboarding/BobbingPadlock';
import { SetupNeededCard } from '@/features/onboarding/SetupNeededCard';
import { isSupabaseConfigured } from '@/lib/env';
import { BubbleButton, BubbleCard, GameText, haptics, Screen } from '@/ui';

type Busy = 'google' | DevPlayer | null;

/** Onboarding 2 — Google sign-in (SPEC §14.1). Success flips the auth guard and lands on Home. */
export default function SignInScreen() {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(which: Busy, attempt: () => Promise<SignInOutcome>) {
    setBusy(which);
    setError(null);
    const outcome = await attempt();
    setBusy(null);
    if (outcome.ok) haptics.success();
    else if (!outcome.cancelled) {
      haptics.warning();
      setError(outcome.message || copy.auth.generic);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <BubbleButton label={copy.signIn.back} variant="secondary" size="sm" onPress={() => router.back()} />

      <View style={styles.hero}>
        <BobbingPadlock size={104} />
        <GameText variant="title" align="center" accessibilityRole="header">
          {copy.signIn.title}
        </GameText>
        <GameText variant="body" tone="muted" align="center">
          {copy.signIn.subtitle}
        </GameText>
      </View>

      <SetupNeededCard />

      <BubbleButton
        label={busy === 'google' ? copy.signIn.signingIn : copy.signIn.google}
        size="lg"
        fullWidth
        haptic="thunk"
        loading={busy === 'google'}
        disabled={!isSupabaseConfigured || (busy !== null && busy !== 'google')}
        onPress={() => run('google', signInWithGoogle)}
      />

      {error ? (
        <BubbleCard padding="md" style={styles.errorCard} shine={false}>
          <GameText variant="small" tone="slipped">
            {error}
          </GameText>
        </BubbleCard>
      ) : null}

      {devSignInAvailable ? (
        <BubbleCard tone="raised" contentStyle={styles.dev}>
          <GameText variant="label" tone="aqua">
            {copy.signIn.devHeading}
          </GameText>
          <GameText variant="small" tone="muted">
            {copy.signIn.devBody}
          </GameText>
          <View style={styles.devRow}>
            {DEV_PLAYERS.map((name) => (
              <BubbleButton
                key={name}
                label={name}
                size="sm"
                variant="secondary"
                loading={busy === name}
                disabled={busy !== null && busy !== name}
                onPress={() => run(name, () => signInAsDevPlayer(name))}
              />
            ))}
          </View>
        </BubbleCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  errorCard: { borderRadius: 18 },
  dev: { gap: 8 },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
});
