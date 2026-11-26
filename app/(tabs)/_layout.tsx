import { Tabs } from 'expo-router/js-tabs';

import { copy } from '@/copy/en';
import { BubbleTabBar } from '@/ui';
import { colours } from '@/ui/theme';

/** Tab bar: Home · Leaderboard · Votes · History · Profile (SPEC §14). */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <BubbleTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colours.bg } }}>
      <Tabs.Screen name="index" options={{ title: copy.tabs.home }} />
      <Tabs.Screen name="leaderboard" options={{ title: copy.tabs.leaderboard }} />
      <Tabs.Screen name="votes" options={{ title: copy.tabs.votes }} />
      <Tabs.Screen name="history" options={{ title: copy.tabs.history }} />
      <Tabs.Screen name="profile" options={{ title: copy.tabs.profile }} />
    </Tabs>
  );
}
