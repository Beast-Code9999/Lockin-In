import { Redirect } from 'expo-router';

import { onboardingStage } from '@/features/home/types';
import { useHome } from '@/features/home/useHome';

/** Resume where the player left off: already in a crew → straight to the Pact. */
export default function SetupIndex() {
  const home = useHome();
  if (!home.data) return null;
  return <Redirect href={onboardingStage(home.data) === 'pact' ? '/setup/pact' : '/setup/profile'} />;
}
