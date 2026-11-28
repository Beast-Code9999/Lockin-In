# Decisions

Choices made where SPEC.md was silent or ambiguous, or where a later instruction overrides it. Newest milestone on top.

## Widget pack (added after M4, requested by the crew)

- **Three new widgets**, alongside the SPEC's crew board and mini:
  - **Button (1×1):** a round lock-in button.
  - **Calendar (resizable, 4×1 → 4×3 and up):** your history, like the History tab.
  - **Streak (2×2):** a big flame, rank, XP to the next rank and a check-in pill.
- **The button keeps the two-tap confirm** (SPEC §12.7): tap → "Sure?" → tap. A one-tap check-in from the home screen would be too easy to hit by accident, and a wrong clean check-in can't be undone. The confirm state is shared, so every widget shows it at once.
- **The calendar is one `SvgWidget`.** A year of days as separate `FlexWidget`s would be over 700 RemoteViews, which risks Android's widget size limit. The grid, layout and SVG are pure functions (`src/widget/calendar.ts`, unit-tested) sized from the widget's real dimensions:
  - At 4×1 (under 110dp) it's a compact heatmap with no header or numbers.
  - Bigger sizes add a header ("22 clean in Nov · 🔥 5"), month labels, date numbers and weekday labels.
  - The columns are weeks, Monday first, ending with this week.
- **History comes with the widget snapshot.** `get_widget_snapshot` gains `history`: one character per local day for `WIDGET_HISTORY_DAYS` (371 = 53 weeks), plus the Pact date. It's about 400 bytes, so the calendar renders offline from the cache like everything else.
  - Today and yesterday without a check-in show as "open" (outlined).
  - Older days with no record, before the finaliser has run, show as empty. Days before the Pact are dimmed.
- **Colours match the History tab:** slips are red there too. The SPEC's honesty rule is about shame mechanics (clown, box and so on), which a personal calendar doesn't use.

## M4 — Notifications

- **One queue function.** Everything that notifies calls `app.notify()`:
  - It skips players with no registered phone and respects `notify_prefs`.
  - It de-duplicates with a once-key logged in `app.notify_log`, so cron re-runs, undo → redo and finaliser re-runs never double-send.
  - `app.notify_crew()` fans out to the rest of the crew (Pact signed).
- **Events come from triggers**, like the M3 refresh pushes:
  - On `checkins`: missed (self + crew), frozen (crew), and friend checked in (crew, opt-in).
  - On `user_stats`: rank up or streak milestone (crew). A rank up wins when both happen together.
  - On `vacations`: a vacation was booked (crew).
- **Honest slips are never announced as slips.** The opt-in "friend checked in" notice says "✅ Miguel checked in" for both clean days and slips (CLAUDE.md rule 3).
- **Box copy waits for M5.** "You owe a Mystery Box" and "…or the box gets you 📦" describe boxes that don't exist yet, so M4 says "Your streak reset" and "…or it counts as missed". M5 switches to the SPEC wording.
- **Reminders** (`app.send_reminders`, every 15 minutes) use "the time has passed and nothing was sent today", not an exact 15-minute slot, so a late or skipped cron run never loses one.
  - A reminder time before 5pm waits until check-in opens.
  - The final warning goes `FINAL_WARNING_HOURS` (2) before yesterday's deadline, if yesterday is still open and not a vacation day.
- **Preferences:** `reminders`, `group`, `boxes` (default on) and `friend_checkins` (default off). `set_notify_prefs` rejects unknown keys and refuses `sos`, which can only be muted in Android settings (SPEC §13).
- **No notification library.** `plugins/withNotifications.js`:
  - creates the four channels natively in `MainApplication.onCreate`, so they exist before the first push even while the app has never opened;
  - ships a white padlock as `@drawable/notification_icon` and makes it FCM's default icon.
  - `send-push` also sets the icon and the brand blue on each message.
- **Showing notifications:** Android shows FCM notifications on its own while the app is in the background. While it's open, the app shows an in-app banner instead.
- **Taps:** both open `data.link`, but only routes on the `routeForLink` allow-list (unit-tested); anything else opens Home.
- **Permission:** Android 13+ asks for notification permission once the player is in the game (`PermissionsAndroid`, no extra dependency).

## Leave crew (added after M3)

- **`leave_group()` removes your data from the crew** (SPEC §14.12): check-ins (private notes cascade), stats, events you caused, and your vacations. Your profile stays, so you can start or join another crew straight away.
  - Leaving clears your check-ins because `checkins.group_id` is required and `(user_id, local_date)` is unique; rejoining starts clean.
  - From M5, open boxes will also be closed here ("stops all forfeits").
- **Ownership** passes to the longest-standing member. When the last member leaves, the crew is deleted.
- **`groups.created_by` is now nullable, `on delete set null`.** Before this, deleting the account of anyone who'd created a crew failed with a foreign-key error.
- **The crew sees "<name> left the crew 👋"** on the widget's last-event line, and the remaining members' widgets refresh.

## M3 — Widget & push

- **Push path without a manual dashboard webhook.** Any insert into `notification_outbox` fires a statement trigger. The trigger uses `pg_net` to POST to `send-push`; the URL is in `app.settings.push_function_url`, not a secret. A pg_cron sweep every 5 minutes retries anything left unsent.
- **`send-push` is deployed with `--no-verify-jwt`.** It takes no input and only drains the outbox, so calling it can do nothing but deliver pushes already queued. That means no service key needs storing in SQL.
- **The function claims rows atomically.** `claim_outbox()` (`FOR UPDATE SKIP LOCKED`, service-role only) means overlapping runs never double-send. Tokens FCM reports as unregistered or invalid are deleted.
- **Refresh pushes come from triggers, not RPC code.** Statement-level triggers on `checkins` and `group_members`, and row triggers on name/avatar/vacation changes, queue one deduped `group_updated` data push per crew member with a device. Every path that changes the board (check-ins, undo, the finaliser, joins) refreshes widgets without extra code. FCM `collapse_key` merges bursts.
- **Snapshot (SPEC §12.5):** the server builds positions, statuses, season and rival (`get_widget_snapshot`). The client adds avatar layer keys and XP, using the same pure functions as the app, before caching under `widget_snapshot_v1`.
- **Widget rendering:**
  - Widget components carry `'use no memo'`. The project enables the React Compiler, whose memoisation hooks are illegal in widget JSX ("Invalid Hook Call").
  - Avatars are stacked layers (`OverlapWidget`); no pre-composited images were needed.
  - Fonts: Jersey 10 and Nunito ExtraBold, bundled through the widget plugin.
- **The layout is sized from the widget's real height** (`src/widget/layout.ts`, unit-tested). Launchers give a 4×2 anywhere from about 140 to 210dp. The check-in button always fits; the rival line appears when there's room; XP and the last event appear at 4×3.
- **Widget check-in:**
  - A two-step confirm (5 seconds), stored in local storage. The headless task re-renders and reverts after the window.
  - Slips can't be logged from the widget.
  - If the request fails offline, it goes into `offline_checkins` and is retried on the next app foreground, push or widget update. Server rejections are kept, and Home explains them once.
- **The SOS icon opens the app for now;** M6 points it at the SOS screen.
- **Gradle memory:** `plugins/withGradleMemory.js` raises the JVM to 4 GB heap / 1.5 GB metaspace. Firebase plus the widget library overflow the template's 512 MB metaspace.
- **Firebase setup lesson.** When Firebase is added to an *existing* Google Cloud project, its Admin SDK service account (`firebase-adminsdk-fbsvc@…`) may get **no IAM role**. FCM then returns 403 `cloudmessaging.messages.create`. Fix: grant it **Firebase Cloud Messaging API Admin** (see SETUP.md).
- **Push is Android-only for now.** iOS needs its own Firebase config (`GoogleService-Info.plist`) when we get there.

## M2 — Scoring, stats & leaderboard

- **Scoring core is one pure SQL function,** `app.score_sequence(statuses[])`, which turns statuses in date order into points and a streak per day. `app.recompute_user_stats` applies it to every row, then refreshes the `user_stats` cache. The TS mirror (`src/shared/scoring.ts`) is used only for the "Worth +12 pts" preview.
- **One set of fixtures drives both sides.** The fixtures in `fixtures/scoring/*.json` were computed independently from the spec formula. `tests/scoring.test.ts` runs the TS mirror against them, and also generates `supabase/tests/020_scoring_fixtures.test.sql` for the SQL engine. Jest fails if that generated file is stale; regenerate it with `UPDATE_SCORING_SQL=1 npx jest tests/scoring.test.ts`.
- **Gaps don't break a streak.** A day with no record is skipped. The finaliser turns every past gap into missed, frozen or vacation within the hour, so there are no lasting gaps.
- **Season = the calendar month in the group's timezone, derived from the clock** (`app.current_season`). Season number counts months since the group's first season. Season points and the "S1 · 2d left" label stay correct before the M7 rollover job exists. M7 adds the snapshot and badges.
- **One hourly cron job (`:05`) does both jobs:** it finalises missed days and recomputes everyone. That replaces the spec's separate daily "recompute all scores" job, and it also slides the 30-day window.
- **Finaliser order:** vacation, then a freeze token (if auto-use is on), then missed. It skips a player for 24h after a timezone change. Mystery Boxes and the clown state for missed days arrive in M5.
- **Freeze tokens are spent from the month the finaliser runs in** (lazy monthly reset in the player's timezone). A day on the 30th finalised on the 2nd uses the new month's tokens.
- **Vacation cancel:** a vacation that hasn't started is cancelled outright. One already under way is cut short at today, so the days already spent stay as vacation.
- **M1 impls were renamed, not copied.** `check_in_impl`, `undo_slip_impl` and `accept_pact_impl` became `*_core`, and new impls call the core and then recompute. That keeps the migration append-only without duplicating M1's rules. `check_in` now also returns the day's `points` and `streak_after`.
- **Rival callout** is computed on the server from the 30-day score (ties broken by streak, then name): "X pts to catch Y 🎯", "Top of the board — X pts clear of Y 👑", or a tie message.
- **Leaderboard sorting happens on the client** from `get_home` member stats (small crews). Ties share a position.
- **Rank** stays a label in the database (`Rookie` … `Final Boss`); the client maps labels to keys for assets.

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
