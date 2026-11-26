import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { GameText, Screen } from '@/ui';
import { colours, radii } from '@/ui/theme';

export const SETUP_STEPS = 4;

/** Shared frame for the setup screens: progress pips, title, body, content. */
export function SetupStep({ step, title, body, children }: { step: number; title: string; body?: string; children: ReactNode }) {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.progress} accessibilityLabel={copy.setup.step(step, SETUP_STEPS)}>
        {Array.from({ length: SETUP_STEPS }, (_, i) => (
          <View key={i} style={[styles.pip, i < step && styles.pipOn]} />
        ))}
      </View>
      <View style={styles.head}>
        <GameText variant="caption" tone="aqua" uppercase>
          {copy.setup.step(step, SETUP_STEPS)}
        </GameText>
        <GameText variant="title" accessibilityRole="header">
          {title}
        </GameText>
        {body ? (
          <GameText variant="body" tone="muted">
            {body}
          </GameText>
        ) : null}
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  progress: { flexDirection: 'row', gap: 6 },
  pip: { flex: 1, height: 8, borderRadius: radii.pill, backgroundColor: colours.surface2 },
  pipOn: { backgroundColor: colours.aqua },
  head: { gap: 6 },
});
