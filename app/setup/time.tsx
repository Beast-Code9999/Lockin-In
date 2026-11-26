import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useUpdateProfile } from '@/features/crew/mutations';
import { friendlyError } from '@/features/errors';
import { SetupStep } from '@/features/setup/SetupStep';
import { friendlyTime } from '@/shared/dates';
import { COMMON_TIMEZONES, detectTimezone, timezoneCity } from '@/shared/timezone';
import { BubbleButton, BubbleCard, BubbleInput, ChoiceChip, GameText } from '@/ui';

const REMINDER_TIMES = ['19:00', '20:00', '21:00', '22:00', '23:00'] as const;

/** Setup 2 — timezone (auto-detected, editable) + reminder time. */
export default function SetupTime() {
  const detected = detectTimezone();
  const update = useUpdateProfile();
  const [timezone, setTimezone] = useState(detected);
  const [other, setOther] = useState('');
  const [reminder, setReminder] = useState('21:00');

  const options = Array.from(new Set([detected, ...COMMON_TIMEZONES]));
  const chosen = other.trim() || timezone;

  return (
    <SetupStep step={2} title={copy.setup.time.title} body={copy.setup.time.body}>
      <BubbleCard contentStyle={styles.card}>
        <GameText variant="label">{copy.setup.time.timezoneLabel}</GameText>
        <GameText variant="small" tone="muted">
          {copy.setup.time.detected(detected)}
        </GameText>
        <View style={styles.chips}>
          {options.map((tz) => (
            <ChoiceChip
              key={tz}
              label={timezoneCity(tz)}
              selected={!other.trim() && tz === timezone}
              onPress={() => {
                setOther('');
                setTimezone(tz);
              }}
            />
          ))}
        </View>
        <BubbleInput placeholder={copy.setup.time.otherPlaceholder} value={other} onChangeText={setOther} autoCapitalize="none" autoCorrect={false} />
      </BubbleCard>

      <BubbleCard contentStyle={styles.card}>
        <GameText variant="label">{copy.setup.time.reminderLabel}</GameText>
        <GameText variant="small" tone="muted">
          {copy.setup.time.reminderHint}
        </GameText>
        <View style={styles.chips}>
          {REMINDER_TIMES.map((t) => (
            <ChoiceChip key={t} label={friendlyTime(t)} selected={t === reminder} onPress={() => setReminder(t)} />
          ))}
        </View>
      </BubbleCard>

      {update.error ? (
        <GameText variant="small" tone="slipped">
          {friendlyError(update.error)}
        </GameText>
      ) : null}

      <View style={styles.row}>
        <BubbleButton label={copy.setup.back} variant="secondary" onPress={() => router.back()} />
        <BubbleButton
          label={copy.setup.next}
          size="md"
          style={styles.flex}
          fullWidth
          loading={update.isPending}
          onPress={() => update.mutate({ timezone: chosen, reminderTime: reminder }, { onSuccess: () => router.push('/setup/crew') })}
        />
      </View>
    </SetupStep>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  flex: { flex: 1 },
});
