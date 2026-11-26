import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

import type { HomeData } from './types';

export const homeQueryKey = (uid: string | null) => ['home', uid] as const;

/** One call for Home + the onboarding gate. Refreshes each minute so "Opens at 5pm" flips on time. */
export function useHome() {
  const uid = useUserId();
  return useQuery({
    queryKey: homeQueryKey(uid),
    enabled: uid !== null,
    refetchInterval: 60_000,
    queryFn: async (): Promise<HomeData> => {
      const { data, error } = await supabase.rpc('get_home');
      if (error) throw error;
      // The RPC returns jsonb (typed as Json); its shape is defined by app.get_home_impl.
      return data as unknown as HomeData;
    },
  });
}
