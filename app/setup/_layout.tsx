import { Stack } from 'expo-router';

import { colours } from '@/ui/theme';

/** Setup after sign-in (SPEC §14.1 steps 3–6): player → clock → crew → Pact. */
export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colours.bg }, animation: 'slide_from_right' }} />;
}
