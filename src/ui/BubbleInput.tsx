import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { GameText } from './GameText';
import { colours, fonts, radii } from './theme';

export type BubbleInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Show "12/20" under the field. */
  showCount?: boolean;
};

/** Rounded text field on a lip; glows aqua when focused. */
export function BubbleInput({ label, hint, error, showCount, style, maxLength, value, onFocus, onBlur, ...rest }: BubbleInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <GameText variant="caption" tone="muted" uppercase style={styles.label}>
          {label}
        </GameText>
      ) : null}
      <View style={styles.lip}>
        <TextInput
          {...rest}
          value={value}
          maxLength={maxLength}
          placeholderTextColor={colours.textFaint}
          selectionColor={colours.aqua}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { borderColor: error ? colours.slipped : focused ? colours.aqua : colours.stroke }, style]}
        />
      </View>
      {error || hint || (showCount && maxLength) ? (
        <View style={styles.footer}>
          <GameText variant="caption" tone={error ? 'slipped' : 'faint'} style={styles.flex}>
            {error ?? hint ?? ''}
          </GameText>
          {showCount && maxLength ? (
            <GameText variant="caption" tone="faint">
              {(value ?? '').length}/{maxLength}
            </GameText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { letterSpacing: 0.6 },
  lip: { borderRadius: radii.md, backgroundColor: colours.abyss, paddingBottom: 3 },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 2,
    backgroundColor: colours.surface2,
    color: colours.text,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
  },
  footer: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
