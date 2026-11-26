import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { env } from './env';

/**
 * The one Supabase client. The session lives in AsyncStorage so the widget's
 * headless task (M3) can reuse it from the same JS bundle.
 *
 * When the build has no Supabase config we still create a client (pointing
 * nowhere) so imports never crash; the UI shows a setup card instead.
 */
export const supabase = createClient<Database>(env.supabaseUrl || 'http://127.0.0.1:55321', env.supabaseAnonKey || 'not-configured', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // No `lock` option: supabase-js ≥ 2.119 coordinates refreshes itself (the option is deprecated).
  },
});

/** Refresh tokens only while the app is in the foreground (Supabase's RN guidance). Returns an unsubscribe. */
export function startSupabaseAutoRefresh(): () => void {
  if (AppState.currentState === 'active') void supabase.auth.startAutoRefresh();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  return () => sub.remove();
}
