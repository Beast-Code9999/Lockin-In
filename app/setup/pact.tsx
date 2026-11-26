import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useAcceptPact } from '@/features/crew/mutations';
import { friendlyError } from '@/features/errors';
import { SetupStep } from '@/features/setup/SetupStep';
import { BubbleButton, BubbleCard, GameText, haptics, Sprite } from '@/ui';
import { colours, radii } from '@/ui/theme';

function Bullets({ items, icon }: { items: readonly string[]; icon: 'status/checked' | 'icon/shield' }) {
  return (
    <View style={styles.bullets}>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <Sprite name={icon} size={20} style={styles.bulletIcon} />
          <GameText variant="small" style={styles.flex}>
            {item}
          </GameText>
        </View>
      ))}
    </View>
  );
}

/**
 * Setup 4 — The Pact (SPEC §3.7, §3.8): the rules, the forfeit content rules, and
 * explicit consent. Accepting sets first_eligible_date; the router then lands on Home.
 */
export default function SetupPact() {
  const accept = useAcceptPact();
  const [agreed, setAgreed] = useState(false);

  return (
    <SetupStep step={4} title={copy.setup.pact.title} body={copy.setup.pact.body}>
      <BubbleCard contentStyle={styles.card}>
        <GameText variant="heading" tone="aqua">
          {copy.setup.pact.rulesTitle}
        </GameText>
        <Bullets items={copy.setup.pact.rules} icon="status/checked" />
      </BubbleCard>

      <BubbleCard tone="gold" contentStyle={styles.card}>
        <GameText variant="heading" tone="gold">
          {copy.setup.pact.forfeitTitle}
        </GameText>
        <Bullets items={copy.setup.pact.forfeit} icon="icon/shield" />
      </BubbleCard>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => {
          haptics.tick();
          setAgreed((a) => !a);
        }}
        style={[styles.consent, agreed && styles.consentOn]}
      >
        <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <Sprite name="status/checked" size={22} /> : null}</View>
        <GameText variant="bodyStrong" style={styles.flex}>
          {copy.setup.pact.consent}
        </GameText>
      </Pressable>

      {accept.error ? (
        <GameText variant="small" tone="slipped">
          {friendlyError(accept.error)}
        </GameText>
      ) : null}

      <BubbleButton
        label={copy.setup.pact.accept}
        variant="clean"
        size="lg"
        fullWidth
        haptic="thunk"
        disabled={!agreed}
        loading={accept.isPending}
        onPress={() => accept.mutate(undefined, { onSuccess: () => haptics.success() })}
      />
    </SetupStep>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  bullets: { gap: 10 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletIcon: { marginTop: 1 },
  flex: { flex: 1 },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colours.stroke,
    backgroundColor: colours.surface,
  },
  consentOn: { borderColor: colours.clean },
  box: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colours.strokeBright,
    backgroundColor: colours.abyss,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: colours.clean },
});
