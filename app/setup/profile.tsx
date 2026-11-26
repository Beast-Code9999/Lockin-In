import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useUpdateProfile } from '@/features/crew/mutations';
import { friendlyError } from '@/features/errors';
import { useHome } from '@/features/home/useHome';
import { AvatarPicker } from '@/features/setup/AvatarPicker';
import { SetupStep } from '@/features/setup/SetupStep';
import { CONFIG } from '@/shared/constants';
import { containsForbiddenWord } from '@/shared/forbiddenWords';
import { BubbleButton, BubbleInput, GameText } from '@/ui';

/** Setup 1 — display name + base character. */
export default function SetupProfile() {
  const home = useHome();
  const update = useUpdateProfile();
  const [name, setName] = useState(home.data?.me.display_name ?? '');
  const [avatar, setAvatar] = useState(home.data?.me.avatar_id ?? CONFIG.DEFAULT_AVATAR_ID);

  const trimmed = name.trim();
  const localError = !trimmed ? null : containsForbiddenWord(trimmed) ? copy.errors.FORBIDDEN_WORD : null;
  const serverError = update.error ? friendlyError(update.error) : null;

  return (
    <SetupStep step={1} title={copy.setup.profile.title} body={copy.setup.profile.body}>
      <BubbleInput
        label={copy.setup.profile.nameLabel}
        placeholder={copy.setup.profile.namePlaceholder}
        value={name}
        onChangeText={setName}
        maxLength={CONFIG.DISPLAY_NAME_MAX_LENGTH}
        showCount
        autoCapitalize="words"
        autoCorrect={false}
        error={localError ?? serverError}
      />
      <View style={styles.gap}>
        <GameText variant="caption" tone="muted" uppercase>
          {copy.setup.profile.avatarLabel}
        </GameText>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </View>
      <BubbleButton
        label={copy.setup.next}
        size="lg"
        fullWidth
        disabled={!trimmed || !!localError}
        loading={update.isPending}
        onPress={() =>
          update.mutate({ displayName: trimmed, avatarId: avatar }, { onSuccess: () => router.push('/setup/time') })
        }
      />
    </SetupStep>
  );
}

const styles = StyleSheet.create({ gap: { gap: 10 } });
