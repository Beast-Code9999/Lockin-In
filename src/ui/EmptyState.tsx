import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BubbleCard } from './BubbleCard';
import { GameText } from './GameText';
import type { PixelAssetKey } from './pixelAssets.generated';
import { Sprite } from './Sprite';

export type EmptyStateProps = {
  icon: PixelAssetKey;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <BubbleCard padding="xl" contentStyle={styles.content}>
      <View style={styles.iconBubble}>
        <Sprite name={icon} size={64} />
      </View>
      <GameText variant="heading" align="center" style={styles.text}>
        {title}
      </GameText>
      {body ? (
        <GameText variant="body" tone="muted" align="center" style={styles.text}>
          {body}
        </GameText>
      ) : null}
      {action}
    </BubbleCard>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 12 },
  iconBubble: { marginBottom: 4 },
  // Full width so centred text isn't mis-measured and clipped on Android.
  text: { alignSelf: 'stretch' },
});
