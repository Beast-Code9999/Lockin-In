import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { requestPinWidget, WidgetPreview } from 'react-native-android-widget';

import { BubbleButton, BubbleCard, ChoiceChip, GameText, Screen } from '@/ui';
import { staleLabel, widgetButton } from '@/widget/buttonState';
import { WIDGET_SCENARIOS } from '@/widget/fixtures';
import { LeaderboardWidget } from '@/widget/LeaderboardWidget';
import { MiniWidget } from '@/widget/MiniWidget';
import { refreshWidgets, updateWidgets } from '@/widget/refresh';
import { setDebugOverride } from '@/widget/state';

/**
 * DEV ONLY (guarded in app/_layout.tsx): Widget Debug screen (CLAUDE.md, SPEC §21 M3).
 * Previews every widget state in-app, and can pin a scenario onto the real
 * home-screen widget so it can be checked on the launcher.
 */
export default function WidgetDebugScreen() {
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState<string | null>(null);
  const scenario = WIDGET_SCENARIOS[index] ?? WIDGET_SCENARIOS[0]!;
  const button = widgetButton(scenario.snapshot, scenario.local, scenario.clock);
  const stale = scenario.snapshot ? staleLabel(scenario.snapshot.generatedAt, 2) : null;
  const height = scenario.height ?? 165;

  return (
    <Screen>
      <View style={styles.top}>
        <BubbleButton label="Close" variant="secondary" size="sm" onPress={() => router.back()} />
        <GameText variant="title">Widgets</GameText>
      </View>

      <View style={styles.chips}>
        {WIDGET_SCENARIOS.map((s, i) => (
          <ChoiceChip key={s.name} label={s.name} selected={i === index} onPress={() => setIndex(i)} />
        ))}
      </View>

      {Platform.OS === 'android' ? (
        <>
          <GameText variant="caption" tone="muted" uppercase>
            Crew board · 4×{height >= 230 ? 3 : 2}
          </GameText>
          <WidgetPreview
            renderWidget={() => <LeaderboardWidget snapshot={scenario.snapshot} button={button} stale={stale} height={height} />}
            width={330}
            height={height}
          />
          <GameText variant="caption" tone="muted" uppercase>
            Mini · 2×1
          </GameText>
          <WidgetPreview renderWidget={() => <MiniWidget snapshot={scenario.snapshot} button={button} />} width={180} height={72} />
        </>
      ) : (
        <GameText tone="muted">Widgets are Android-only.</GameText>
      )}

      <BubbleCard contentStyle={styles.card}>
        <GameText variant="small" tone="muted">
          {pinned ? `Home-screen widget pinned to: ${pinned}` : 'Home-screen widget shows live data.'}
        </GameText>
        <View style={styles.chips}>
          <BubbleButton label="Add crew board" variant="secondary" size="sm" onPress={() => void requestPinWidget({ widgetName: 'Leaderboard' })} />
          <BubbleButton label="Add mini" variant="secondary" size="sm" onPress={() => void requestPinWidget({ widgetName: 'Mini' })} />
        </View>
        <BubbleButton
          label="Pin to home-screen widget"
          fullWidth
          onPress={async () => {
            await setDebugOverride({ snapshot: scenario.snapshot, local: scenario.local, clock: scenario.clock });
            await updateWidgets();
            setPinned(scenario.name);
          }}
        />
        <BubbleButton
          label="Back to live data"
          variant="secondary"
          fullWidth
          onPress={async () => {
            await setDebugOverride(null);
            await refreshWidgets();
            setPinned(null);
          }}
        />
      </BubbleCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 10 },
});
