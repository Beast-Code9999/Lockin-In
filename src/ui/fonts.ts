import { fonts } from './theme';

/** Passed to expo-font's useFonts() in the root layout. Licences: assets/LICENSES.md (OFL). */
export const FONT_SOURCES = {
  [fonts.display]: require('../../assets/fonts/Jersey10-Regular.ttf'),
  [fonts.body]: require('../../assets/fonts/Nunito-SemiBold.ttf'),
  [fonts.bodyBold]: require('../../assets/fonts/Nunito-Bold.ttf'),
  [fonts.bodyExtraBold]: require('../../assets/fonts/Nunito-ExtraBold.ttf'),
  [fonts.bodyBlack]: require('../../assets/fonts/Nunito-Black.ttf'),
} as const;
