import { env, isLocalSupabase } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import type { SignInOutcome } from './google';

/**
 * DEV ONLY: email/password test players on a *local* Supabase stack, so group
 * flows can be exercised on emulators without Google accounts. Never shown in
 * release builds or against a hosted project. See docs/DECISIONS.md.
 */
export const DEV_PLAYERS = ['Jason', 'Miguel', 'Ken'] as const;
export type DevPlayer = (typeof DEV_PLAYERS)[number];

const DEV_PASSWORD = 'lockinin-dev-password';

export const devSignInAvailable = __DEV__ && isLocalSupabase(env.supabaseUrl);

export async function signInAsDevPlayer(name: DevPlayer): Promise<SignInOutcome> {
  if (!devSignInAvailable) return { ok: false, cancelled: false, message: 'Dev sign-in is local-only.' };
  const email = `${name.toLowerCase()}@lockinin.test`;
  const first = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD });
  if (!first.error) return { ok: true };

  const created = await supabase.auth.signUp({ email, password: DEV_PASSWORD, options: { data: { full_name: name } } });
  if (created.error) return { ok: false, cancelled: false, message: created.error.message };
  if (!created.data.session) return { ok: false, cancelled: false, message: 'Local auth wants email confirmation — disable it in supabase/config.jsonc.' };
  return { ok: true };
}
