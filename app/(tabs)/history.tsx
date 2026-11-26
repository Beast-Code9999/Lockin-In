import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { useHome } from '@/features/home/useHome';
import { calendarStatus, type CalendarStatus } from '@/features/history/dayStatus';
import { useHistory } from '@/features/history/useHistory';
import { addMonths, monthGrid, monthKey, monthLabel, shortDateLabel, type LocalDate } from '@/shared/dates';
import { BubbleButton, BubbleCard, BubbleSheet, GameText, Screen } from '@/ui';
import { colours, fonts, radii, withOpacity } from '@/ui/theme';

const STATUS_STYLE: Record<CalendarStatus, { bg: string; border: string; text: string }> = {
  clean: { bg: colours.clean, border: colours.clean, text: colours.cleanInk },
  slipped: { bg: colours.slipped, border: colours.slipped, text: colours.white },
  missed: { bg: colours.missed, border: colours.missed, text: colours.goldInk },
  frozen: { bg: colours.frozen, border: colours.frozen, text: colours.ink },
  vacation: { bg: colours.vacation, border: colours.vacation, text: colours.ink },
  open: { bg: 'transparent', border: colours.aqua, text: colours.aqua },
  empty: { bg: colours.surface2, border: colours.surface2, text: colours.textFaint },
  beforePact: { bg: 'transparent', border: 'transparent', text: colours.textFaint },
  future: { bg: 'transparent', border: 'transparent', text: colours.textFaint },
};
const LEGEND: [CalendarStatus, keyof typeof copy.history.legend][] = [
  ['clean', 'clean'],
  ['slipped', 'slipped'],
  ['missed', 'missed'],
  ['frozen', 'frozen'],
  ['vacation', 'vacation'],
  ['open', 'pending'],
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** History (SPEC §14.4): month calendar of your days; tap a day for detail + private note. */
export default function HistoryScreen() {
  const { data: home } = useHome();
  const [month, setMonth] = useState(() => (home ? monthKey(home.today_local) : '2026-01'));
  const history = useHistory(month);
  const [selected, setSelected] = useState<LocalDate | null>(null);
  if (!home) return null;

  const ctx = { today: home.today_local, yesterday: home.yesterday_local, firstEligible: home.group?.first_eligible_date ?? null };
  const days = history.data ?? {};
  const atCurrentMonth = month >= monthKey(home.today_local);
  const sel = selected ? days[selected] : undefined;
  const selStatus = selected ? calendarStatus(selected, sel?.status, ctx) : null;

  return (
    <Screen withTabBar>
      <GameText variant="title" accessibilityRole="header">
        {copy.history.title}
      </GameText>

      <BubbleCard contentStyle={styles.card}>
        <View style={styles.monthRow}>
          <BubbleButton label="‹" variant="secondary" size="sm" onPress={() => setMonth((m) => addMonths(m, -1))} accessibilityHint="Previous month" />
          <GameText variant="heading" align="center" style={styles.flex}>
            {monthLabel(month)}
          </GameText>
          <BubbleButton label="›" variant="secondary" size="sm" disabled={atCurrentMonth} onPress={() => setMonth((m) => addMonths(m, 1))} accessibilityHint="Next month" />
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((d, i) => (
            <View key={`h${i}`} style={styles.cell}>
              <GameText variant="caption" tone="faint">
                {d}
              </GameText>
            </View>
          ))}
          {monthGrid(month).map((date, i) => {
            if (!date) return <View key={`b${i}`} style={styles.cell} />;
            const status = calendarStatus(date, days[date]?.status, ctx);
            const s = STATUS_STYLE[status];
            const isToday = date === home.today_local;
            return (
              <Pressable
                key={date}
                style={styles.cell}
                disabled={status === 'future' || status === 'beforePact'}
                onPress={() => setSelected(date)}
                accessibilityRole="button"
                accessibilityLabel={`${shortDateLabel(date)}: ${status}`}
              >
                <View style={[styles.day, { backgroundColor: s.bg, borderColor: isToday ? colours.white : s.border }, status === 'open' ? styles.dashed : styles.solid]}>
                  <GameText variant="small" colour={s.text} style={styles.dayText}>
                    {Number(date.slice(8))}
                  </GameText>
                </View>
              </Pressable>
            );
          })}
        </View>
        {history.isLoading ? <ActivityIndicator color={colours.aqua} /> : null}
      </BubbleCard>

      <View style={styles.legend}>
        {LEGEND.map(([status, label]) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: STATUS_STYLE[status].bg, borderColor: STATUS_STYLE[status].border }]} />
            <GameText variant="caption" tone="muted">
              {copy.history.legend[label]}
            </GameText>
          </View>
        ))}
      </View>

      <BubbleSheet visible={selected !== null} onClose={() => setSelected(null)}>
        {selected && selStatus ? (
          <>
            <GameText variant="heading">{shortDateLabel(selected)}</GameText>
            <View style={[styles.statusPill, { backgroundColor: withOpacity(STATUS_STYLE[selStatus].border, 0.16), borderColor: STATUS_STYLE[selStatus].border }]}>
              <GameText variant="label" colour={selStatus === 'empty' ? colours.textMuted : STATUS_STYLE[selStatus].border}>
                {selStatus === 'open'
                  ? copy.history.openNow
                  : selStatus === 'empty'
                    ? copy.history.noRecord
                    : copy.history.legend[selStatus as 'clean' | 'slipped' | 'missed' | 'frozen' | 'vacation']}
              </GameText>
            </View>
            {sel?.note ? (
              <BubbleCard tone="raised" padding="md" contentStyle={styles.noteCard}>
                <GameText variant="caption" tone="aqua" uppercase>
                  {copy.history.privateNote}
                </GameText>
                <GameText variant="body">{sel.note}</GameText>
              </BubbleCard>
            ) : null}
            <BubbleButton label={copy.history.close} variant="secondary" fullWidth onPress={() => setSelected(null)} />
          </>
        ) : null}
      </BubbleSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignSelf: 'stretch', borderRadius: radii.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderStyle: 'dashed' },
  // Android keeps a previous borderStyle unless it's set explicitly.
  solid: { borderStyle: 'solid' },
  dayText: { fontFamily: fonts.bodyExtraBold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 16, height: 16, borderRadius: 5, borderWidth: 2 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 2 },
  noteCard: { gap: 4 },
});
