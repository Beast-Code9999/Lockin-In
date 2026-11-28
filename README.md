# Lockin' In 🔒🔥

A private, gamified daily check-in game for a small crew, centred on a live **Android home-screen widget**. Check in once a day, stack streaks, climb the crew leaderboard. Miss a check-in and the **Mystery Box** picks your forfeit. Hit **SOS** and the crew sends backup.

- **Product & technical spec:** [`SPEC.md`](SPEC.md) (source of truth)
- **How we build:** [`CLAUDE.md`](CLAUDE.md)
- **Decisions & deviations:** [`docs/DECISIONS.md`](docs/DECISIONS.md)
- **Developer setup:** [`docs/SETUP.md`](docs/SETUP.md)

## Stack
Expo SDK 58 (React Native 0.88, TypeScript strict, expo-router, dev client) · Supabase Free (Postgres + RLS, Auth, Realtime, Edge Functions) · FCM on Firebase Spark (from M3) · `react-native-android-widget` (from M3). Total cost: **$0**.

## Quick start
```bash
npm install
npm run db:start && npm run db:reset     # local Supabase (Docker), ports 553xx
cp .env.example .env                      # see docs/SETUP.md
adb reverse tcp:55321 tcp:55321
npx expo run:android
```

## Scripts
| Command | What it does |
|---|---|
| `npm run verify` | typecheck + lint + jest |
| `npm test` | jest: unit, discretion scan, TS↔SQL parity, asset contract |
| `npm run db:test` | pgTAP tests (`supabase/tests`) |
| `npm run gen:art` | regenerate placeholder pixel art, manifest + typed registry |
| `npm run db:types` | regenerate `src/lib/database.types.ts` from the local DB |

## Layout
```
app/                 screens (expo-router): onboarding/, (tabs)/, dev/ui-kit
src/ui/              "Bubble Arcade" UI kit: theme, BubbleButton, BubbleCard, Sprite, Avatar, XPBar, …
src/shared/          constants (§20), forbidden words, ranks/flames/XP, resolveAvatarLayers
src/features/        auth, onboarding, profile, …
src/lib/             supabase client, env, query client, generated DB types
src/copy/en.ts       user-facing copy (Australian English)
assets/pixel/        generated pixel art + manifest.json
scripts/             placeholder-art generator
supabase/            migrations, seed, pgTAP tests
tests/               repo-level tests (discretion scan, parity, assets)
```

## Milestones
- [x] **M0 Foundations:** Expo app, Bubble Arcade UI kit, pixel-art pipeline, Supabase schema foundations + RLS, Google sign-in
- [x] **M1 Groups & check-ins:** onboarding (player, clock, crew + invite code, Pact), check-in card with 5pm window, backfill, honest slips + undo, crew strip, History calendar
- [x] **M2 Scoring, stats & leaderboard:** points + streaks (SQL engine, TS preview, shared fixtures), hourly finaliser (vacation → freeze → missed), freeze tokens, vacation mode, ranks/flames/XP, rival callout, Leaderboard with podium, member profiles, Settings
- [x] **M3 Widget & push:** Leaderboard (4×2→4×3) + Mini widgets in the Bubble Arcade style, two-step widget check-in, offline queue, FCM silent refresh pushes via outbox → pg_net → Edge Function, Widget Debug screen
- [x] **M4 Notifications:** channels, daily reminder + final warning, crew events (missed, freeze, rank up, streak milestones, vacations, opt-in friend check-ins), per-category toggles + reminder time, deep links
- [x] **Widget pack:** 1×1 lock-in button, history calendar (4×1 heatmap → 4×3+ dated calendar), 2×2 streak widget
- [ ] M5 Mystery Box & loot
- [ ] M6 SOS
- [ ] M7 Seasons, badges, polish
- [ ] M8 Hardening & release
