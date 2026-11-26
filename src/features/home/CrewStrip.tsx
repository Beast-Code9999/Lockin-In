import { StyleSheet, View } from 'react-native';

import { copy } from '@/copy/en';
import { Avatar, BubbleCard, GameText, Sprite } from '@/ui';

import type { CrewMember } from './types';

/** Group today strip (SPEC §14.2): everyone's avatar with ✓ (checked in) or · (not yet). */
export function CrewStrip({ members }: { members: CrewMember[] }) {
  return (
    <BubbleCard padding="md" contentStyle={styles.card}>
      <GameText variant="caption" tone="muted" uppercase>
        {copy.home.crewToday}
      </GameText>
      <View style={styles.row}>
        {members.map((m) => (
          <View
            key={m.id}
            style={styles.member}
            accessible
            accessibilityLabel={`${m.display_name}: ${m.checked_today ? 'checked in' : 'not yet'}`}
          >
            <View>
              <Avatar inputs={{ avatarId: m.avatar_id, rank: 'rookie' }} size={52} />
              <View style={styles.badge}>
                <Sprite name={m.checked_today ? 'status/checked' : 'status/pending'} size={20} />
              </View>
            </View>
            <GameText variant="caption" tone={m.is_me ? 'aqua' : 'text'} numberOfLines={1} style={styles.name}>
              {m.is_me ? copy.home.you : m.display_name}
            </GameText>
          </View>
        ))}
      </View>
    </BubbleCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  member: { alignItems: 'center', gap: 4, width: 64 },
  badge: { position: 'absolute', right: -4, bottom: -2 },
  name: { maxWidth: 64 },
});
