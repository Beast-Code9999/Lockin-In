/**
 * Public runtime config. Expo inlines EXPO_PUBLIC_* values at build time — only
 * static `process.env.EXPO_PUBLIC_X` access works. Everything here ships inside
 * the app, so never put a secret in an EXPO_PUBLIC_ variable.
 */
export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleWebClientId: string;
  googleIosClientId: string;
};

export const env: PublicEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
};

/** Names of required variables that are empty. */
export function missingEnv(e: PublicEnv = env): string[] {
  const missing: string[] = [];
  if (!e.supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!e.supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}

export const isSupabaseConfigured = missingEnv().length === 0;

/** True for a Supabase CLI stack on this machine / LAN (dev-only conveniences key off this). */
export function isLocalSupabase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '10.0.2.2' ||
      host.endsWith('.local') ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host)
    );
  } catch {
    return false;
  }
}
