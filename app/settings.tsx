import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { copy } from '@/copy/en';
import { useCancelVacation, useSetVacation, useUpdateProfile } from '@/features/crew/mutations';
import { friendlyError } from '@/features/errors';
import { useHome } from '@/features/home/useHome';
import { CONFIG } from '@/shared/constants';
import { addDays, shortDateLabel } from '@/shared/dates';
import { BubbleButton, BubbleCard, GameText, haptics, Screen, Sprite } from '@/ui';
import { colours } from '@/ui/theme';

function Stepper({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled: boolean; plusDisabled: boolean }) {
  return (
    <View style={styles.stepper}>
      <GameText variant="caption" tone="muted" uppercase style={styles.stepLabel}>
        {label}
      </GameText>
      <BubbleButton label="−" variant="secondary" size="sm" disabled={minusDisabled} onPress={onMinus} accessibilityHint={`Decrease ${label}`} />
      <GameText variant="label" align="center" style={styles.stepValue}>
        {value}
      </GameText>
      <BubbleButton label="+" variant="secondary" size="sm" disabled={plusDisabled} onPress={onPlus} accessibilityHint={`Increase ${label}`} />
    </View>
  );
}

/** Settings (SPEC §14.12) — M2: freeze tokens + vacation mode. More arrives with M4. */
export default function SettingsScreen() {
  const { data: home } = useHome();
  const update = useUpdateProfile();
  const book = useSetVacation();
  const cancel = useCancelVacation();
  const [startOffset, setStartOffset] = useState(1);
  const [length, setLength] = useState(3);
  if (!home) return null;

  const start = addDays(home.today_local, startOffset);
  const end = addDays(start, length - 1);
  const error = update.error ?? book.error ?? cancel.error;

  return (
    <Screen>
      <View style={styles.top}>
        <BubbleButton label={copy.member.back} variant="secondary" size="sm" onPress={() => router.back()} />
        <GameText variant="title" accessibilityRole="header">
          {copy.settings.title}
        </GameText>
      </View>

      <BubbleCard contentStyle={styles.card}>
        <View style={styles.row}>
          <Sprite name="status/frozen" size={36} />
          <GameText variant="heading" style={styles.flex}>
            {copy.settings.freezeTitle}
          </GameText>
          <GameText variant="number" tone="aqua">
            {home.stats.freeze_tokens_left}
          </GameText>
        </View>
        <GameText variant="small" tone="muted">
          {copy.settings.freezeBody(home.stats.freeze_tokens_left, CONFIG.FREEZE_TOKENS_PER_MONTH)}
        </GameText>
        <View style={styles.row}>
          <GameText variant="bodyStrong" style={styles.flex}>
            {copy.settings.autoFreeze}
          </GameText>
          <Switch
            value={home.me.auto_use_freeze}
            onValueChange={(v) => {
              haptics.tick();
              update.mutate({ autoUseFreeze: v });
            }}
            trackColor={{ false: colours.surface2, true: colours.primary }}
            thumbColor={home.me.auto_use_freeze ? colours.aqua : colours.textMuted}
            accessibilityLabel={copy.settings.autoFreeze}
          />
        </View>
      </BubbleCard>

      <BubbleCard contentStyle={styles.card}>
        <View style={styles.row}>
          <Sprite name="status/vacation" size={36} />
          <GameText variant="heading" style={styles.flex}>
            {copy.settings.vacationTitle}
          </GameText>
        </View>
        <GameText variant="small" tone="muted">
          {copy.settings.vacationBody}
        </GameText>

        {home.vacations.length ? (
          home.vacations.map((v) => (
            <View key={v.id} style={styles.booking}>
              <GameText variant="bodyStrong" style={styles.flex}>
                {copy.settings.range(shortDateLabel(v.start_date), shortDateLabel(v.end_date))}
              </GameText>
              <BubbleButton label={copy.settings.cancel} variant="secondary" size="sm" loading={cancel.isPending && cancel.variables === v.id} onPress={() => cancel.mutate(v.id)} />
            </View>
          ))
        ) : (
          <GameText variant="small" tone="faint">
            {copy.settings.noVacations}
          </GameText>
        )}

        <Stepper
          label={copy.settings.startLabel}
          value={shortDateLabel(start)}
          onMinus={() => setStartOffset((o) => o - 1)}
          onPlus={() => setStartOffset((o) => o + 1)}
          minusDisabled={startOffset <= 1}
          plusDisabled={startOffset >= 60}
        />
        <Stepper
          label={copy.settings.lengthLabel}
          value={copy.settings.days(length)}
          onMinus={() => setLength((l) => l - 1)}
          onPlus={() => setLength((l) => l + 1)}
          minusDisabled={length <= 1}
          plusDisabled={length >= CONFIG.VACATION_MAX_RANGE_DAYS}
        />
        <GameText variant="label" tone="aqua" align="center" style={styles.stretch}>
          {copy.settings.range(shortDateLabel(start), shortDateLabel(end))}
        </GameText>
        <BubbleButton
          label={copy.settings.book}
          fullWidth
          loading={book.isPending}
          onPress={() => book.mutate({ start, end }, { onSuccess: () => haptics.success() })}
        />
      </BubbleCard>

      {error ? (
        <GameText variant="small" tone="slipped" align="center">
          {friendlyError(error)}
        </GameText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
  booking: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { width: 56 },
  stepValue: { flex: 1, fontSize: 21 },
});
