import { Text, type TextProps } from 'react-native';

import { colours, pixelTextShadow, typeScale, type TypeVariant } from './theme';

const TONES = {
  text: colours.text,
  muted: colours.textMuted,
  faint: colours.textFaint,
  ink: colours.ink,
  primary: colours.primaryLight,
  aqua: colours.aqua,
  clean: colours.clean,
  slipped: colours.slipped,
  missed: colours.missed,
  gold: colours.gold,
  white: colours.white,
} as const;
export type TextTone = keyof typeof TONES;

const PIXEL_VARIANTS: ReadonlySet<TypeVariant> = new Set(['hero', 'title', 'heading', 'label', 'tag', 'number']);

export type GameTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Overrides tone with any colour. */
  colour?: string;
  align?: 'left' | 'center' | 'right';
  /** Hard pixel drop shadow — on by default for pixel-font variants. */
  shadow?: boolean;
  uppercase?: boolean;
};

/** All app text goes through here so fonts, sizes and colours stay on-theme. */
export function GameText({
  variant = 'body',
  tone = 'text',
  colour,
  align,
  shadow,
  uppercase,
  style,
  children,
  ...rest
}: GameTextProps) {
  const isPixel = PIXEL_VARIANTS.has(variant);
  return (
    <Text
      maxFontSizeMultiplier={isPixel ? 1.25 : 1.6}
      {...rest}
      style={[
        typeScale[variant],
        { color: colour ?? TONES[tone] },
        (shadow ?? isPixel) && pixelTextShadow,
        align && { textAlign: align },
        uppercase && { textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
