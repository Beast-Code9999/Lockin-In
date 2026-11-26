# Decisions

Choices made where SPEC.md was silent or ambiguous, or where a later instruction overrides it. Newest milestone on top.

## M1 — Groups & check-ins

- **RPCs are thin wrappers around `app.*_impl` functions.** The impls take the user ID and an injectable `p_now`, so the pgTAP tests control time and timezones. The public wrappers always pass `auth.uid()` and `now()`, so a client can never fake the clock.
- **Errors are stable keys** (`CHECKIN_NOT_OPEN`, `UNDO_EXPIRED`, …) raised by `app.fail()`. The app maps them to friendly copy in `src/copy/en.ts` → `errors`.
- **An honest slip can be logged any time of day.** The 5pm opening applies to *clean* check-ins only. That rule exists so a clean day covers most of the day, and making someone wait until 5pm to own up would work against honesty-first scoring.
- **Undo is its own RPC, `undo_slip(date)`,** usable for 5 minutes. A fresh slip is deleted; a slip that replaced a clean check-in goes back to clean. `check_in` also allows slipped → clean inside the window, but the 5pm rule still applies to that path (SPEC §22.4).
- **Yesterday's check-ins are stored with source `backfill`** automatically.
- **Onboarding is split in two route groups:** `onboarding/` (welcome and sign-in, signed out) and `setup/` (player, clock, crew, Pact, signed in). The gate in `app/_layout.tsx` works it out from `get_home`: no crew → crew step, no Pact → Pact, otherwise into the tabs. No extra "onboarded" column is needed.
- **First eligible date** is the Pact acceptance date in the player's timezone, so yesterday is never offered on your first day.
- **`create_group` creates season 1** for the current month in the group's timezone (SPEC §18.1). `user_stats`, scoring and the finaliser are M2.
- **Display and crew names** are trimmed, have repeated spaces squashed, are length-checked, and pass the forbidden-word check, since they appear on the widget.
- **The crew strip** shows a tick for anyone who has checked in today, clean or slipped. Slips aren't hidden, but they're not called out on Home either.
- **Profiles are readable by group members.** Private notes stay author-only, and other groups can read nothing (tested).
- **pgTAP helpers** live in `supabase/tests/helpers.psql`, included with `\ir` inside each test's transaction.

## M0 — Foundations

### Visual direction: "Bubble Arcade" (overrides SPEC §15 palette + fonts)
Requested at kickoff: *bubbly, widget-focused, blue, modern and rounded but also pixelated*.
- **Palette:** deep-ocean navy surfaces (`#081537` bg, `#0E2052` surface, `#16306F` raised) with a glossy "bubble blue" brand colour (`#2F7BFF`) and aqua highlights (`#7FE7FF`). Replaces §15's purple-navy base colours.
- **Kept exactly from §15:** every semantic colour (clean / slipped / missed / frozen / vacation) and every rarity colour. The clean check-in button stays bright green (§12.3).
- **Shapes:** chunky rounded "toy" components. Every card and button sits on a solid darker *lip*, so it reads as 3D, and carries a small gloss highlight like a bubble reflection. Buttons squish down onto their lip when pressed.
- **Pixel accents:** pixel font for headings, numbers and buttons; pixel-art sprites; segmented pixel XP bars inside rounded tracks; a dithered pixel glow and drifting bubbles behind screens.
- **Fonts:** **Jersey 10** (display: headings, numbers, buttons) + **Nunito** (body) instead of Press Start 2P + Inter. Both are OFL. Chosen by rendering the candidates side by side on an Android emulator at button size:
  - Pixelify Sans (every weight): the capital C closes up, so "CHECK IN CLEAN" read as "OHEOK IN OLEAN". Rejected.
  - Press Start 2P: crisp, but so wide that short labels wrap, so 10-character names won't fit a 4×2 widget row. Rejected.
  - Silkscreen: legible but very wide, with an odd "4". Rejected.
  - Jersey 10: chunky pixels, clear capitals, and condensed enough for dense widget rows. **Chosen.**

  Nunito's rounded terminals match the bubbly shapes. Jersey renders about 1.33× smaller than other fonts at the same point size, so the type ramp in `src/ui/theme.ts` is sized for it. To swap fonts, change `fonts` in `src/ui/theme.ts` and `src/ui/fonts.ts`.
- Still dark-mode only (v1).

### Platform & tooling
- **Expo SDK 58 / React Native 0.88 / React 19.3 / TypeScript 6** (latest at kickoff, released two months earlier). `react-native-android-widget` 0.26 supports Expo ≥ 54.
- **Routes live in root `app/`**, per SPEC §19. The SDK 58 template defaults to `src/app/`; Expo Router supports both.
- **Tabs use `expo-router/js-tabs`** with a custom `BubbleTabBar`. Native tabs can't take the bubbly pixel styling.
- **Auth guard:** `Stack.Protected` in `app/_layout.tsx` (the SDK 58 pattern). Signed out → `onboarding`; signed in → `(tabs)`; `dev/*` only in dev builds. Every guard sets an explicit `redirectTo`. Without one, the router falls back to the first *available* route alphabetically, and on-device testing showed that sent signed-out users to `dev/ui-kit`.
- **Android text quirk:** a single line of centred text that shrink-wraps inside an `alignItems: 'center'` column can be measured a touch too narrow on Android. It then wraps and the second line is clipped (seen with an email address). Centred text in those layouts uses `alignSelf: 'stretch'`.
- **No `react-native-url-polyfill`.** Expo SDK 58 ships `URL`/`URLSearchParams`. There's also no auth `lock` option: supabase-js 2.119 deprecated it ("the client now coordinates session refreshes without a lock").
- **TypeScript 6** no longer auto-includes `@types/*` globals, so `tsconfig.json` lists `types: ["jest", "node"]`.
- **Scripts run on Node's built-in TypeScript type stripping** (Node ≥ 23.6; this machine runs 24). That avoids adding `tsx`/`ts-node`. `scripts/package.json` marks them as ESM.
- **Dev dependencies added beyond the CLAUDE.md list** (tooling only, nothing shipped in the app): `supabase` (pins the CLI version so `npx supabase …` is reproducible), `sharp` (named in CLAUDE.md for the art scripts), `eslint` + `eslint-config-expo`, `jest-expo` + `@react-native/jest-preset`.
- **Jest + Reanimated:** Reanimated 4.7's bundled mock still initialises the real module, which needs a worklets runtime. We use a small explicit mock instead (`tests/mocks/reanimated.js`).

### Backend layout
- **Schema split:** internals (config, validation, triggers, future cron jobs) live in schema `app`, which PostgREST doesn't expose. **Client-callable RPCs go in `public`** as `SECURITY DEFINER` functions with `search_path` pinned, because `public` is the only schema the API exposes. Default `EXECUTE` is revoked from `anon`/`PUBLIC` in both schemas, so every grant is explicit.
- **Profile creation:** a trigger on `auth.users` (`app.handle_new_user`) creates the `profiles` row at sign-up. It takes the first word of Google's `full_name`, falling back to the email's local part, capped at 20 characters. Onboarding step 3 (M1) lets the player change name and avatar via `update_profile`.
- **Profiles RLS in M0:** select own row only; no direct writes. M1 widens reads to same-group members.
- **Constants:** `src/shared/constants.ts` (`CONFIG`) mirrors SQL `app.config()`, and `tests/parity.test.ts` fails on any drift. Beyond §20 we added the server-side numbers the spec mentions inline, so nothing is hard-coded later: `VACATION_MAX_RANGE_DAYS`, `BOX_RESUBMIT_EXTENSION_HOURS` (12), `CLOWN_MIN_HOURS` (48), `SOS_STALE_HOURS` (2), `TZ_CHANGE_GRACE_HOURS` (24), the defaults (timezone, reminder time, avatar), max lengths, and the invite-code length and alphabet (no `0 O 1 I L`).
- **Rank** is stored as its *label* (`user_stats.rank` defaults to `'Rookie'`, per §16). Code and asset names use kebab-case keys (`monk-mode`); see `src/shared/ranks.ts`.

### Discretion check (SPEC §3)
- **Matching rule (identical in TS and SQL):** split camelCase, strip accents, lowercase. A term must start at a word boundary, may continue with anything (a prefix match), and the words of a phrase may be joined by nothing or by space / `.` / `_` / `-`. This catches hashtags, camelCase names and inflections, but never ordinary words that merely contain the letters (for example "basement", "lagoon", "hedging").
- **Known false positives,** accepted for discretion's sake: the two-word phrase in the list also matches inside a few normal phrases ("…nutella", "…nuts"), so loot captions with those get rejected.
- **The repo scan** (`tests/discretion.test.ts`) checks every file *name*, plus the *contents* of every shipped or user-facing text file: app, src, assets, supabase (including seed and migrations), docs, scripts, config, package.json. It skips only SPEC.md, CLAUDE.md, and text explicitly wrapped in `@forbidden-begin` / `@forbidden-end` markers (the canonical lists and their own test inputs).
- A second check fails if `src/copy/` ever uses the internal status name; the UI always says "Slipped".

### Pixel art & avatars
- **Generator:** `scripts/gen-placeholder-art.ts` (with `sharp`). Sprites are authored in code as ASCII rows plus a few parametric shapes. Each is exported with **nearest-neighbour** scaling at @1x/@2x/@3x, with a base size at or above its largest on-screen size, so phones only ever *downscale*, which stays crisp. `assets/pixel/manifest.json` and the typed registry `src/ui/pixelAssets.generated.ts` are generated together. Marking an asset `"custom": true` makes the generator leave a hand-made replacement alone.
- **Avatar layers:** SPEC §8.3 calls for "base + rank overlay + state overlay". The rank overlay is a **rank-coloured bubble behind the character**: grey or bronze ring, silver/gold/purple double ring, a rainbow ring for Final Boss, and corner sparkles that grow with rank. Layer order is rank bubble → character → state. State precedence is jail > chicken > clown, with the optional shield last. All layers share a 24×24 grid, so the widget can stack them (`OverlapWidget`) or pre-compose them (M3).
- 8 base characters: blaze, frost, volt, shade, sprout, nova, ace, ghost.

### Local development
- **Local Supabase ports are 553xx** (API 55321, DB 55322, Studio 55323) so this stack can run alongside another local Supabase project on the default 543xx ports.
- **Dev test players (dev builds + a local Supabase URL only):** "Jason / Miguel / Ken" email/password accounts (`@lockinin.test`) let group flows be tested on emulators without Google accounts. The code path is gated on `__DEV__` and a local URL. Recommendation: turn the **Email** provider **off** on the hosted project, since the app only uses Google there.
