import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;

export const profileQueryKey = (uid: string | null) => ['profile', uid] as const;

/** The signed-in player's own profile row (RLS: own row only in M0). */
export function useMyProfile() {
  const uid = useUserId();
  return useQuery({
    queryKey: profileQueryKey(uid),
    enabled: uid !== null,
    queryFn: async (): Promise<Profile> => {
      if (!uid) throw new Error('Not signed in');
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (error) throw error;
      return data;
    },
  });
}
