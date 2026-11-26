import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { BobbingPadlock } from '@/features/onboarding/BobbingPadlock';
import { SetupNeededCard } from '@/features/onboarding/SetupNeededCard';
import { BubbleButton, BubbleCard, GameText, Screen, Sprite } from '@/ui';

/** Onboarding 1 — Welcome: what the game is, in neutral copy (SPEC §14.1). */
export default function WelcomeScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <BobbingPadlock />
        <GameText variant="hero" align="center" accessibilityRole="header">
          {copy.welcome.title}
        </GameText>
        <GameText variant="bodyStrong" tone="muted" align="center">
          {copy.welcome.tagline}
        </GameText>
      </View>

      <View style={styles.points}>
        {copy.welcome.points.map((p) => (
          <BubbleCard key={p.title} padding="md" contentStyle={styles.point}>
            <View style={styles.pointIcon}>
              <Sprite name={p.icon} size={40} />
            </View>
            <View style={styles.pointText}>
              <GameText variant="label">{p.title}</GameText>
              <GameText variant="small" tone="muted">
                {p.body}
              </GameText>
            </View>
          </BubbleCard>
        ))}
      </View>

      <SetupNeededCard />

      <BubbleButton label={copy.welcome.cta} size="lg" fullWidth haptic="thunk" onPress={() => router.push('/onboarding/sign-in')} />
      <GameText variant="caption" tone="faint" align="center">
        {copy.welcome.footnote}
      </GameText>
      {__DEV__ ? (
        <BubbleButton label={copy.welcome.uiKit} variant="secondary" size="sm" icon="fx/sparkle" style={styles.center} onPress={() => router.push('/dev/ui-kit')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  hero: { alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 6 },
  points: { gap: 12 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: { width: 48, alignItems: 'center' },
  pointText: { flex: 1, gap: 2 },
  center: { alignSelf: 'center' },
});
