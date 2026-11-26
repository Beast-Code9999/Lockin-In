import { Stack } from 'expo-router';

import { colours } from '@/ui/theme';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colours.bg }, animation: 'slide_from_right' }} />;
}
