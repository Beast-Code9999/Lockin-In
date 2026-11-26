import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useCreateGroup, useJoinGroup } from '@/features/crew/mutations';
import { friendlyError } from '@/features/errors';
import { useHome } from '@/features/home/useHome';
import { SetupStep } from '@/features/setup/SetupStep';
import { CONFIG } from '@/shared/constants';
import { detectTimezone } from '@/shared/timezone';
import { BubbleButton, BubbleCard, BubbleInput, GameText, haptics, Sprite } from '@/ui';

/** Setup 3 — create a crew (get an invite code) or join one. */
export default function SetupCrew() {
  const home = useHome();
  const create = useCreateGroup();
  const join = useJoinGroup();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const created = create.data;
  if (created) {
    return (
      <SetupStep step={3} title={copy.setup.crew.createdTitle(created.name)} body={copy.setup.crew.createdBody}>
        <BubbleCard tone="glow" contentStyle={styles.codeCard}>
          <Sprite name="icon/lock" size={44} />
          <GameText variant="hero" tone="aqua" selectable style={styles.code} accessibilityLabel={`Invite code ${created.invite_code.split('').join(' ')}`}>
            {created.invite_code}
          </GameText>
          <BubbleButton
            label={copy.setup.crew.share}
            variant="secondary"
            size="sm"
            style={styles.center}
            onPress={() => void Share.share({ message: copy.setup.crew.shareMessage(created.invite_code) })}
          />
        </BubbleCard>
        <BubbleButton label={copy.setup.crew.continue} size="lg" fullWidth onPress={() => router.push('/setup/pact')} />
      </SetupStep>
    );
  }

  const busy = create.isPending || join.isPending;
  return (
    <SetupStep step={3} title={copy.setup.crew.title} body={copy.setup.crew.body}>
      <BubbleCard contentStyle={styles.card}>
        <GameText variant="heading">{copy.setup.crew.createTitle}</GameText>
        <BubbleInput
          placeholder={copy.setup.crew.createPlaceholder}
          value={name}
          onChangeText={setName}
          maxLength={CONFIG.GROUP_NAME_MAX_LENGTH}
          autoCapitalize="words"
          error={create.error ? friendlyError(create.error) : null}
        />
        <BubbleButton
          label={copy.setup.crew.create}
          fullWidth
          disabled={!name.trim() || busy}
          loading={create.isPending}
          onPress={() =>
            create.mutate({ name: name.trim(), timezone: home.data?.me.timezone ?? detectTimezone() }, { onSuccess: () => haptics.success() })
          }
        />
      </BubbleCard>

      <GameText variant="label" tone="faint" align="center">
        {copy.setup.crew.or}
      </GameText>

      <BubbleCard contentStyle={styles.card}>
        <GameText variant="heading">{copy.setup.crew.joinTitle}</GameText>
        <BubbleInput
          placeholder={copy.setup.crew.joinPlaceholder}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          maxLength={CONFIG.INVITE_CODE_LENGTH}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.codeInput}
          error={join.error ? friendlyError(join.error) : null}
        />
        <BubbleButton
          label={copy.setup.crew.join}
          variant="secondary"
          fullWidth
          disabled={code.trim().length !== CONFIG.INVITE_CODE_LENGTH || busy}
          loading={join.isPending}
          onPress={() =>
            join.mutate(code.trim(), {
              onSuccess: () => {
                haptics.success();
                router.push('/setup/pact');
              },
            })
          }
        />
      </BubbleCard>

      <View style={styles.row}>
        <BubbleButton label={copy.setup.back} variant="secondary" size="sm" onPress={() => router.back()} />
      </View>
    </SetupStep>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  codeCard: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  code: { letterSpacing: 8, alignSelf: 'stretch', textAlign: 'center' },
  codeInput: { fontSize: 24, letterSpacing: 6, textAlign: 'center' },
  row: { flexDirection: 'row' },
  center: { alignSelf: 'center' },
});
