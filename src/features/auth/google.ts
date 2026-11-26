import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { copy } from '@/copy/en';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type SignInOutcome = { ok: true } | { ok: false; cancelled: boolean; message: string };

let configured = false;
function configureOnce(): void {
  if (configured) return;
  GoogleSignin.configure({
    // The *web* client ID: Google issues an ID token for this audience, which Supabase verifies.
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId || undefined,
  });
  configured = true;
}

/** Native Google sign-in → Supabase session via signInWithIdToken (SPEC §19). */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  if (!env.googleWebClientId) return { ok: false, cancelled: false, message: copy.auth.missingGoogleConfig };
  try {
    configureOnce();
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return { ok: false, cancelled: true, message: '' };
    const idToken = result.data.idToken;
    if (!idToken) return { ok: false, cancelled: false, message: copy.auth.noIdToken };
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { ok: false, cancelled: false, message: error.message };
    return { ok: true };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS || e.code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, cancelled: true, message: '' };
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { ok: false, cancelled: false, message: copy.auth.playServices };
    }
    return { ok: false, cancelled: false, message: e instanceof Error ? e.message : copy.auth.generic };
  }
}

export async function signOut(): Promise<void> {
  try {
    configureOnce();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google (e.g. a dev test player) — nothing to clear.
  }
  await supabase.auth.signOut();
}
