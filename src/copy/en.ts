/**
 * User-facing copy (Australian English). Tone: playful, hype, a bit of trash talk —
 * supportive after a slip, never shaming. Keep copy here so the discretion scan
 * (tests/discretion.test.ts) and reviewers can see it in one place.
 *
 * Vocabulary (SPEC §3.2): "Check in", "Locked in", "Clean day", "Slipped",
 * "Streak", "Hold the Line", "Backup". Never the internal status names.
 */
import type { PixelAssetKey } from '@/ui/pixelAssets.generated';

export const copy = {
  appName: "Lockin' In",

  welcome: {
    title: "LOCKIN' IN",
    tagline: 'Lock in every day. Keep the crew honest.',
    points: [
      { icon: 'flame/tier2', title: 'Check in once a day', body: 'Clean day? Tap in after 5pm and stack that streak.' },
      { icon: 'tab/leaderboard', title: 'Climb the crew board', body: 'Live scores, ranks and flames — right on your home screen.' },
      { icon: 'box/owed', title: 'Ghost a day? Open the box', body: 'Miss a check-in and the Mystery Box picks your forfeit.' },
      { icon: 'icon/sos', title: 'Hold the line', body: 'Hit SOS and the crew sends backup in seconds.' },
    ] satisfies { icon: PixelAssetKey; title: string; body: string }[],
    cta: "Let's lock in",
    footnote: 'Private to your crew. Nothing is ever posted for you.',
    uiKit: 'Peek at the UI kit',
  },

  signIn: {
    title: 'Sign in',
    subtitle: "One tap with Google and you're in the game.",
    google: 'Sign in with Google',
    back: 'Back',
    devHeading: 'Dev shortcut',
    devBody: 'Local Supabase only. Signs in a test player so you can try things on an emulator.',
    signingIn: 'Locking in…',
  },

  setup: {
    title: 'Backend not hooked up',
    body: 'This build has no Supabase config yet. Add these to .env (see docs/SETUP.md), then restart the bundler:',
  },

  auth: {
    missingGoogleConfig: "Google sign-in isn't set up in this build yet (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is empty).",
    noIdToken: "Google didn't send back an ID token. Double-check the web client ID.",
    playServices: 'Google Play services is needed to sign in on this device.',
    generic: "Couldn't sign you in. Give it another crack?",
  },

  tabs: {
    home: 'Home',
    leaderboard: 'Leaderboard',
    votes: 'Votes',
    history: 'History',
    profile: 'Profile',
  },

  home: {
    greeting: (name: string) => `Hey ${name}!`,
    streakLabel: 'day streak',
    score: 'Lock-In Score',
    season: 'Season pts',
    checkInClean: 'CHECK IN CLEAN',
    checkInSoon: 'Check-ins switch on in the next build. Warm up that thumb.',
    loadError: "Couldn't load your profile.",
    retry: 'Try again',
  },

  soon: {
    leaderboard: { title: 'The board is warming up', body: 'Scores, ranks and the season race drop once check-ins are live.' },
    votes: { title: 'No votes yet', body: 'Proof checks and new box captions will land here.' },
    history: { title: 'Your calendar', body: 'Every clean day lights up here. Start the streak and watch it glow.' },
  },

  profile: {
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    uiKit: 'UI kit (dev)',
  },

  notFound: {
    title: 'Wrong turn',
    body: "This screen doesn't exist. Let's get you back in the game.",
    home: 'Back to base',
  },
} as const;
