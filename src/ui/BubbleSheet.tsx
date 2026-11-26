import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colours, gloss, radii } from './theme';

export type BubbleSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tapping the backdrop closes the sheet (default true). */
  dismissable?: boolean;
};

/** Bottom sheet in the bubble style: rounded top, lip, gloss, slides up. */
export function BubbleSheet({ visible, onClose, children, dismissable = true }: BubbleSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={dismissable ? onClose : undefined} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grabber} />
          <View style={styles.shine} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 13, 36, 0.72)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colours.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colours.stroke,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colours.strokeBright },
  shine: { position: 'absolute', top: 14, left: 22, width: '24%', height: 5, borderRadius: 3, backgroundColor: gloss(0.1) },
  content: { padding: 20, gap: 14 },
});
