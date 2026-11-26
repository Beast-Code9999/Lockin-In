# CLAUDE.md — Lockin' In

You are building **Lockin' In**: a private, gamified daily-accountability app for a small friend group (3 people), with a **gamified Android home-screen widget** as the centrepiece, a **Mystery Box** forfeit system for missed check-ins, and an **SOS ("Hold the Line")** button.

**`SPEC.md` is the source of truth.** Read it fully before writing code. When this file and SPEC.md disagree, SPEC.md wins. If SPEC.md is ambiguous, pick the simplest option consistent with its rules, note the decision in `docs/DECISIONS.md`, and keep going.

---

## Non-negotiable rules

1. **$0 cost.** Never add a service, SDK or plan that needs a credit card or payment.
   - Backend = **Supabase Free** (Postgres, Auth, Storage, Realtime, Edge Functions, `pg_cron`, `pg_net`).
   - Push = **FCM only**, Firebase project on the free **Spark** plan. **No Cloud Functions, no Firestore, no Blaze plan.**
   - No Google Play Console, no Apple Developer account. Distribute APKs via GitHub Releases / Firebase App Distribution.
   - No analytics, crash-reporting or ad SDKs.
2. **Discretion.** Never put any word from `src/shared/forbiddenWords.ts` (see SPEC §3) in any user-facing string, notification, widget, asset name, app/package name, or seed caption. UI says **"Slipped"**, never the internal enum name. A test scans all strings for forbidden words. Keep it green.
3. **Honesty-first scoring.** A *missed* check-in must always be strictly worse than an honest slip (SPEC §5). Shame mechanics (clown, box, jail, chicken) attach **only** to missed check-ins and failed forfeits, **never** to honest slips. Copy after a slip is supportive.
4. **Nothing is ever posted to social media automatically.** "Open Instagram" just opens the app; the user posts manually.
5. **Server decides outcomes.** Scoring, finalisation, box rarity/contents, vote results and all game-state changes happen in **security-definer Postgres RPCs**. Clients never write game tables directly. RLS is on for every table.
6. **SQL is the source of truth for scoring.** `src/shared/scoring.ts` is a mirror for UI previews only, and both are tested against the same fixtures in `fixtures/scoring/`.
7. **All day logic uses the user's local date** (`profiles.timezone`). Never use the device's UTC date for check-in logic.
8. **Android first, iOS-safe.** Android-only modules (widget, some notification APIs) go behind `Platform.OS === 'android'` so the iOS build still compiles.
9. **Private notes** live in `checkin_notes` and are readable only by their author (RLS). Don't join them into group queries.

---

## Stack

- React Native + **Expo** (TypeScript `strict`), **expo-router**, **Expo dev build** (`expo-dev-client`). Not Expo Go.
- `@supabase/supabase-js` (session in AsyncStorage, also used by the widget headless task)
- `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken`
- `@react-native-firebase/app` + `@react-native-firebase/messaging` (FCM only)
- `react-native-android-widget` (widgets in JSX → RemoteViews). **Check its current docs for exact APIs** (task handler registration, `requestWidgetUpdate`, click actions, supported image sources and fonts) before implementing.
- `@tanstack/react-query`, `zustand`
- `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, `expo-audio`, `expo-font`
- `expo-image-picker`, `expo-image-manipulator`
- Tests: `jest`, `@testing-library/react-native`, pgTAP via `supabase test db`

Ask before adding any dependency not listed here. Prefer Expo-compatible packages (`npx expo install`).

---

## Commands

```bash
# app
npm install
npx expo install <pkg>             # add Expo-compatible deps
npx expo prebuild                  # regenerate native projects after plugin/config changes
npx expo run:android               # build + run dev build on a connected device/emulator
npm test                           # jest
npm run lint && npm run typecheck

# supabase (local dev needs Docker)
supabase start                     # local stack
supabase db reset                  # re-apply migrations + seed.sql
supabase migration new <name>
supabase test db                   # pgTAP tests in supabase/tests
supabase functions serve send-push
supabase db push                   # apply migrations to the hosted project
supabase functions deploy send-push
supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"

# release APK (local, free)
cd android && ./gradlew assembleRelease
```

Add `lint`, `typecheck`, `test` scripts to `package.json` in M0.

---

## Project layout

See SPEC §19. Key places:
- `app/` screens (expo-router)
- `src/features/*` feature logic and hooks
- `src/shared/` constants (SPEC §20), scoring mirror, `resolveAvatarLayers`, forbidden words
- `src/ui/` pixel UI kit
- `src/widget/` widgets, task handler, snapshot types/cache, refresh helpers
- `supabase/migrations`, `supabase/functions/send-push`, `supabase/seed.sql`, `supabase/tests`
- `fixtures/scoring/*.json` shared fixtures
- `scripts/` placeholder-art generator, avatar compositor
- `docs/DECISIONS.md`, `docs/INSTALL.md`

---

## How to work

- **Build milestone by milestone** (SPEC §21: M0 → M8). Don't start a milestone until the previous one runs on a device and its tests pass.
- At the end of each milestone, stop and give a short summary: what works, how to test it on a phone, open questions, and anything that needs the user to do something by hand (create Supabase project, Firebase project, OAuth client IDs, `google-services.json`, secrets).
- **Migrations are append-only.** Never edit a migration that's already been applied. Add a new one.
- Every RPC gets at least one pgTAP test for its main rule and one for its main rejection case.
- Write the SPEC §22 acceptance tests as you go (SQL for server rules, jest for client logic). Time-dependent SQL should take an injectable `now` (e.g. `p_now timestamptz default now()`) so tests can control time and timezones.
- Constants live in **one** TS file and **one** SQL config. Never hard-code magic numbers.
- Keep components small. Extract pure logic (scoring preview, avatar layers, widget button state) into pure functions with unit tests.
- **Widget:** build an in-app **Widget Debug screen** (dev builds only) that pushes fake snapshots through every state in SPEC §12.2–12.4, so every state can be checked visually on the home screen.
- Placeholder art: generate simple pixel-style PNGs with `scripts/gen-placeholder-art.ts` (`sharp`), listed in `assets/pixel/manifest.json`, so real art can replace them without code changes. Record any third-party asset licences in `assets/LICENSES.md` (CC0/OFL only).
- **Secrets** (`service-account.json`, `.env`, `google-services.json` if it holds anything sensitive) go in `.gitignore`. Commit `.env.example` instead.

---

## Manual setup the user will do (prompt them at the right milestone)

1. Create a free **Supabase** project. Copy the URL and anon key to `.env`. Enable Google auth provider.
2. Create a free **Google Cloud** OAuth client (Android + Web client IDs) for Google Sign-In.
3. Create a free **Firebase** project (Spark plan), add the Android app `com.jasonlay.lockinin`, download `google-services.json`, generate a service-account key for FCM HTTP v1, and store it as a Supabase secret.
4. Enable the `pg_cron` and `pg_net` extensions in Supabase and create the Database Webhook for `notification_outbox` → `send-push`.

---

## Style

- TypeScript strict, no `any` without a comment explaining why.
- Functional components + hooks. Name things after the game's vocabulary in SPEC §2.
- Use Australian English spelling in user-facing copy.
- Copy tone: playful, hype, a bit of trash talk. Supportive after a slip, never shaming.
