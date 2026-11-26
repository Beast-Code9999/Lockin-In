import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  setSession: (session) => set({ session, status: session ? 'signedIn' : 'signedOut' }),
}));

export const useSession = () => useAuthStore((s) => s.session);
export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);

/**
 * Loads the persisted session and keeps the store in sync with Supabase auth.
 * Call once from the root layout. Returns an unsubscribe.
 */
export function initAuthListener(): () => void {
  const { setSession } = useAuthStore.getState();
  if (!isSupabaseConfigured) {
    setSession(null);
    return () => undefined;
  }
  supabase.auth
    .getSession()
    .then(({ data }) => setSession(data.session))
    .catch(() => setSession(null));
  // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the auth lock.
  const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  return () => data.subscription.unsubscribe();
}
