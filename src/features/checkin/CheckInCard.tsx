import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { friendlyError } from '@/features/errors';
import { friendlyTime } from '@/shared/dates';
import { BubbleButton, BubbleCard, GameText, haptics, Sprite } from '@/ui';

import type { HomeData } from '../home/types';
import { checkinCardState, slipTarget } from './cardState';
import { useCheckIn, useUndoSlip } from './mutations';
import { SlipSheet } from './SlipSheet';

/** The Home check-in card (SPEC §14.2). State-aware, mirrors the widget button (SPEC §12.3). */
export function CheckInCard({ home }: { home: HomeData }) {
  const [now, setNow] = useState(() => Date.now());
  const state = checkinCardState(home, now);
  const checkIn = useCheckIn();
  const undo = useUndoSlip();
  // The date the slip sheet was opened for. Kept separately so the sheet stays mounted
  // (and can show its follow-up) after the card itself flips to the slipped state.
  const [slipFor, setSlipFor] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Keep the undo countdown honest while it's showing.
  const ticking = state.kind === 'doneSlipped' && state.undoUntil !== null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 3_500);
    return () => clearTimeout(id);
  }, [flash]);

  const lockIn = (date: string, success: string) =>
    checkIn.mutate(
      { date, status: 'clean' },
      {
        onSuccess: () => {
          haptics.success();
          setFlash(success);
        },
        onError: () => haptics.warning(),
      },
    );

  const slipDate = slipTarget(state);
  const opensAt = friendlyTime(home.opens_at);

  return (
    <BubbleCard tone={state.kind === 'doneClean' ? 'clean' : 'glow'} contentStyle={styles.card}>
      {state.kind === 'backfill' ? (
        <>
          <GameText variant="small" tone="muted" align="center">
            {copy.checkin.yesterdayHint}
          </GameText>
          <BubbleButton
            label={copy.checkin.checkInYesterday}
            variant="clean"
            size="lg"
            icon="status/checked"
            fullWidth
            haptic="thunk"
            loading={checkIn.isPending}
            onPress={() => lockIn(state.date, copy.checkin.backfillSuccess)}
          />
        </>
      ) : null}

      {state.kind === 'ready' ? (
        <BubbleButton
          label={copy.checkin.checkInClean}
          variant="clean"
          size="lg"
          icon="status/checked"
          fullWidth
          haptic="thunk"
          loading={checkIn.isPending}
          onPress={() => lockIn(state.date, copy.checkin.success)}
        />
      ) : null}

      {state.kind === 'opensLater' ? (
        <>
          <BubbleButton label={copy.checkin.opensAt(opensAt)} size="lg" icon="icon/hourglass" fullWidth disabled />
          <GameText variant="small" tone="muted" align="center">
            {copy.checkin.opensAtHint(opensAt)}
          </GameText>
        </>
      ) : null}

      {state.kind === 'doneClean' ? (
        <View style={styles.done}>
          <Sprite name="flame/tier2" size={56} />
          <View style={styles.flex}>
            <GameText variant="heading" tone="clean">
              {copy.checkin.lockedIn}
            </GameText>
            <GameText variant="small" tone="muted">
              {copy.checkin.lockedInHint}
            </GameText>
          </View>
        </View>
      ) : null}

      {state.kind === 'doneSlipped' ? (
        <>
          <View style={styles.done}>
            <Sprite name="icon/shield" size={52} />
            <View style={styles.flex}>
              <GameText variant="heading">{copy.checkin.ownedIt}</GameText>
              <GameText variant="small" tone="muted">
                {copy.checkin.ownedItHint}
              </GameText>
            </View>
          </View>
          {state.undoUntil ? (
            <BubbleButton
              label={copy.checkin.undo}
              variant="secondary"
              size="sm"
              style={styles.center}
              loading={undo.isPending}
              onPress={() => undo.mutate(state.date)}
            />
          ) : null}
        </>
      ) : null}

      {state.kind === 'notEligible' ? (
        <GameText variant="small" tone="muted" align="center">
          {copy.checkin.notEligible}
        </GameText>
      ) : null}

      {flash ? (
        <GameText variant="heading" tone="clean" align="center" accessibilityLiveRegion="polite">
          {flash}
        </GameText>
      ) : null}

      {checkIn.error || undo.error ? (
        <GameText variant="small" tone="slipped" align="center">
          {friendlyError(checkIn.error ?? undo.error)}
        </GameText>
      ) : null}

      {slipDate ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setSlipFor(slipDate)} style={styles.center}>
          <GameText variant="small" tone="faint" style={styles.link}>
            {copy.checkin.slippedLink}
          </GameText>
        </Pressable>
      ) : null}

      {slipFor ? <SlipSheet visible date={slipFor} undoMinutes={home.undo_minutes} onClose={() => setSlipFor(null)} /> : null}
    </BubbleCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  link: { textDecorationLine: 'underline' },
});
