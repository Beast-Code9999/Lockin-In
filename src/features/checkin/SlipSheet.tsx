import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { friendlyError } from '@/features/errors';
import { CONFIG } from '@/shared/constants';
import { shortDateLabel, type LocalDate } from '@/shared/dates';
import { BubbleButton, BubbleInput, BubbleSheet, GameText, haptics, Sprite } from '@/ui';

import { useCheckIn, useUndoSlip } from './mutations';

type Props = {
  visible: boolean;
  date: LocalDate;
  undoMinutes: number;
  onClose: () => void;
};

/**
 * "I slipped" (SPEC §5): supportive copy, optional private note, confirm.
 * Then a supportive follow-up with the misclick undo. Never shaming.
 */
export function SlipSheet({ visible, date, undoMinutes, onClose }: Props) {
  const checkIn = useCheckIn();
  const undo = useUndoSlip();
  const [note, setNote] = useState('');
  const [logged, setLogged] = useState(false);

  const close = () => {
    setNote('');
    setLogged(false);
    checkIn.reset();
    undo.reset();
    onClose();
  };

  return (
    <BubbleSheet visible={visible} onClose={close}>
      {!logged ? (
        <>
          <View style={styles.head}>
            <Sprite name="icon/shield" size={44} />
            <GameText variant="heading" style={styles.flex}>
              {copy.slip.title}
            </GameText>
          </View>
          <GameText variant="body" tone="muted">
            {copy.slip.body}
          </GameText>
          <GameText variant="caption" tone="aqua" uppercase>
            {copy.slip.forDate(shortDateLabel(date))}
          </GameText>
          <BubbleInput
            placeholder={copy.slip.notePlaceholder}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={CONFIG.CHECKIN_NOTE_MAX_LENGTH}
            style={styles.note}
          />
          {checkIn.error ? (
            <GameText variant="small" tone="slipped">
              {friendlyError(checkIn.error)}
            </GameText>
          ) : null}
          <BubbleButton
            label={copy.slip.confirm}
            fullWidth
            loading={checkIn.isPending}
            onPress={() =>
              checkIn.mutate(
                { date, status: 'relapse', note: note.trim() || undefined },
                {
                  onSuccess: () => {
                    haptics.thunk();
                    setLogged(true);
                  },
                },
              )
            }
          />
          <BubbleButton label={copy.slip.cancel} variant="secondary" size="sm" style={styles.center} onPress={close} />
        </>
      ) : (
        <>
          <View style={styles.head}>
            <Sprite name="flame/tier0" size={48} />
            <GameText variant="heading" style={styles.flex}>
              {copy.slip.doneTitle}
            </GameText>
          </View>
          <GameText variant="body" tone="muted">
            {copy.slip.doneBody}
          </GameText>
          <BubbleButton label={copy.slip.close} fullWidth onPress={close} />
          <GameText variant="caption" tone="faint" align="center">
            {copy.slip.undoHint(undoMinutes)}
          </GameText>
          {undo.error ? (
            <GameText variant="small" tone="slipped" align="center">
              {friendlyError(undo.error)}
            </GameText>
          ) : null}
          <BubbleButton
            label={copy.checkin.undo}
            variant="secondary"
            size="sm"
            style={styles.center}
            loading={undo.isPending}
            onPress={() => undo.mutate(date, { onSuccess: close })}
          />
        </>
      )}
    </BubbleSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  note: { minHeight: 90, textAlignVertical: 'top' },
  center: { alignSelf: 'center' },
});
