import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { missingEnv } from '@/lib/env';
import { BubbleCard, GameText, Sprite } from '@/ui';

/** Shown when the build has no Supabase config, so a fresh checkout still boots. */
export function SetupNeededCard() {
  const missing = missingEnv();
  if (missing.length === 0) return null;
  return (
    <BubbleCard tone="gold" contentStyle={styles.content}>
      <View style={styles.row}>
        <Sprite name="icon/hourglass" size={28} />
        <GameText variant="heading" tone="gold">
          {copy.backendSetup.title}
        </GameText>
      </View>
      <GameText variant="small" tone="muted">
        {copy.backendSetup.body}
      </GameText>
      {missing.map((name) => (
        <GameText key={name} variant="caption" tone="text">
          • {name}
        </GameText>
      ))}
    </BubbleCard>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
