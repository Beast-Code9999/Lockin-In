import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BubbleBackground } from './BubbleBackground';
import { colours, space, TAB_BAR_HEIGHT } from './theme';

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Leave room for the floating tab bar. */
  withTabBar?: boolean;
  background?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, withTabBar = false, background = true, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: insets.top + space.lg,
    paddingBottom: insets.bottom + space.xl + (withTabBar ? TAB_BAR_HEIGHT + space.lg : 0),
    paddingHorizontal: space.lg,
    gap: space.lg,
  };
  return (
    <View style={styles.root}>
      {background ? <BubbleBackground /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={[padding, contentStyle]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padding, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.bg },
  fill: { flex: 1 },
});
