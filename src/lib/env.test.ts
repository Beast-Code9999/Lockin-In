import { isLocalSupabase, missingEnv } from './env';

describe('env', () => {
  it('lists missing Supabase variables', () => {
    expect(missingEnv({ supabaseUrl: '', supabaseAnonKey: '', googleWebClientId: '', googleIosClientId: '' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    ]);
    expect(missingEnv({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k', googleWebClientId: '', googleIosClientId: '' })).toEqual([]);
  });

  it.each([
    ['http://127.0.0.1:55321', true],
    ['http://localhost:55321', true],
    ['http://10.0.2.2:55321', true],
    ['http://192.168.1.20:55321', true],
    ['https://abcd.supabase.co', false],
    ['not a url', false],
  ])('isLocalSupabase(%p) → %p', (url, expected) => {
    expect(isLocalSupabase(url)).toBe(expected);
  });
});
