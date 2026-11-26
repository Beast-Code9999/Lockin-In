# Lockin' In — Product & Technical Specification (v1)

> A private, gamified accountability app for a small group of friends (initially 3: Jason, Miguel, Ken).
> Everyone checks in once a day. Scores, streaks, ranks and a live leaderboard keep everyone honest.
> Missed check-ins trigger a **Mystery Box** forfeit. An **SOS button** calls in backup when someone needs it.
> **The Android home-screen widget is the centrepiece of the product.**

---

## 0. Table of contents

1. Goals, non-goals, hard constraints
2. Glossary
3. Discretion & privacy rules (read before writing any user-facing string)
4. The day model (dates, timezones, windows)
5. Check-ins
6. Freeze tokens & vacation mode
7. Scoring (exact formulas + worked examples)
8. Ranks, flames, badges, seasons
9. Mystery Box (forfeit system)
10. Loot pool (captions) & voting
11. SOS ("Hold the Line")
12. Android widget (centrepiece)
13. Notifications
14. Screens & UX
15. Visual design direction
16. Data model (Postgres schema)
17. Row Level Security & storage
18. Backend logic (RPCs, cron jobs, Edge Functions, push)
19. Client architecture & project structure
20. Tunable constants
21. Build milestones (do them in order)
22. Edge cases & acceptance tests
23. Seed loot pool
24. Future (not v1)

---

## 1. Goals, non-goals, hard constraints

### Goals
- One daily check-in per person: **Clean** or **Slipped**.
- A scoring system that rewards **consistency** and **honesty**, not just raw streaks.
- A **fun, gamified, arcade-style** experience: ranks, evolving pixel avatars, flames, badges, seasons, loot-box style forfeits.
- A **live Android widget** showing the leaderboard, who has checked in today, shame states, and a check-in button.
- **SOS** button: instantly ping the group for support and start a 10-minute "Hold the Line" timer.

### Non-goals (v1)
- No content blocking, screen monitoring, or device surveillance of any kind.
- No automatic posting to Instagram or any social network. Ever.
- No public profiles, no discovery, no global leaderboard.
- No iOS widget in v1 (iOS app must still *compile and run* — see constraints).
- No monetisation, ads, analytics SDKs, or tracking.

### Hard constraints
- **$0 total cost.** Do not introduce any service that requires a credit card or a paid plan.
  - Backend: **Supabase Free plan** (no card required).
  - Push: **Firebase Cloud Messaging only** (FCM is free on the Firebase Spark plan). **Do not use Cloud Functions, Firestore, or anything that requires the Firebase Blaze plan.**
  - Distribution: APK via GitHub Releases or Firebase App Distribution. **No Google Play Console ($25)**, **no Apple Developer account ($99/yr)** for now.
- **Android is the primary platform.** Code must stay cross-platform-safe (React Native + Expo) so iOS can be added later; wrap Android-only modules (widget) behind `Platform.OS === 'android'` checks.
- **One group per user in v1** (simplifies the widget and RLS). Schema should allow multiple later.
- Supabase Free projects pause after ~7 days of no database activity. Daily check-ins keep it active; no keep-alive hack needed.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Group** | The friend group (invite-only). v1: a user belongs to exactly one. |
| **Local date** | A calendar date (`YYYY-MM-DD`) in the user's own timezone. All day logic uses this. |
| **Check-in** | The single daily record for a user + local date. Status: `clean`, `relapse` (UI: "Slipped"), `missed`, `frozen`, `vacation`. |
| **Streak** | Consecutive `clean` days. `frozen`/`vacation` days pause it (don't add, don't break). |
| **Lock-In Score** | Rolling 30-day sum of daily points. The main leaderboard number. |
| **Season** | A calendar month (group timezone). Separate "season points" total, podium, champion. |
| **Mystery Box** | Forfeit created when a day is finalised as `missed`. Opened in-app, gacha-style. |
| **Loot item** | A caption + photo prompt + post type inside the box pool. |
| **Forfeit** | The thing the box tells you to do (post a photo with a caption on IG). Done **manually** by the user. |
| **Proof** | Screenshot the user uploads to show they did the forfeit. Group votes on it. |
| **SOS** | Panic button that alerts the group and starts the Hold the Line timer. |
| **Wingman** | A friend who responds to an SOS. |
| **Pact** | The opt-in agreement every member accepts on joining (forfeit rules + consent). |

---

## 3. Discretion & privacy rules (MANDATORY)

This app's purpose is private. Anyone glancing at a phone, a notification, or the widget must see only a fun "discipline game".

1. **Forbidden words** must never appear in any user-facing string, notification, widget, app name, package name, store/listing text, file names of shared assets, or loot captions:
   `nofap`, `no fap`, `fap`, `porn`, `masturbat*`, `semen`, `retention`, `nnn`, `no nut`, `coom*`, `goon*`, `edging`.
   - Keep a single constant list in `src/shared/forbiddenWords.ts` **and** mirror it in SQL (`app.forbidden_words()`), used to validate loot submissions server-side.
   - Write a unit test that scans all string resources/i18n files and fails if any forbidden word appears.
2. **Neutral vocabulary in UI:** "Check in", "Locked in", "Clean day", "Slipped", "Streak", "Hold the Line", "Backup". Internal enum `relapse` is fine in code/DB but the UI says **"Slipped"**.
3. **App name:** `Lockin' In`. Android package: `com.jasonlay.lockinin`. Icon: neutral pixel padlock / flame.
4. **Notifications** are discreet by default (examples in §13). Never mention what was slipped on.
5. **Private notes** (optional note attached to a check-in) are visible **only to their author** — enforced by RLS, stored in a separate table (§16).
6. **Group-only:** All data is only readable by members of the same group.
7. **Forfeit content rules** (shown on the pact screen and loot submission screen, and enforced by the forbidden-word check):
   - Captions never reference the app or why you're posting.
   - Nothing offensive, sexual, political, or about real third parties.
   - No tagging employers, workplaces, or anyone outside the group.
   - Instagram only. **No LinkedIn or professional networks.**
   - You only ever post a photo **of yourself**. Nobody posts anyone else's photo.
8. **Consent:** Each member must explicitly accept the Pact before their first check-in. Anyone may leave the group at any time (§14 Settings), which stops all forfeits for them.
9. **Proof screenshots** are private to the group, stored in a private bucket, served via short-lived signed URLs, and **deleted automatically when the season ends** (a text record stays on the Wall of Shame).
10. **Supportive tone after a slip.** Never shame an honest slip. Shame mechanics (clown, box, chicken) are tied **only** to *missed* check-ins and failed forfeits, never to honest slips.

---

## 4. The day model

All day logic is per user, in the user's timezone (`profiles.timezone`, IANA name, default `Australia/Darwin`).

- `today_local` = current date in the user's timezone.
- A user can check in for:
  - **Today** — but only from `CHECKIN_OPENS_AT` (default **17:00 local**) onwards. Reason: a "clean" check-in should cover most of the day. Before 17:00, the button shows "Opens at 5pm".
  - **Yesterday** — any time today (the **backfill window**).
- **Deadline for date D** = end of `D + 1` in the user's local time (i.e. 23:59:59 local on the following day).
- After the deadline passes with no check-in, the server **finalises** date D as:
  1. `vacation` if D is inside an active vacation range, else
  2. `frozen` if the user has a freeze token and `auto_use_freeze = true` (consume one token), else
  3. `missed` → creates a Mystery Box (§9).
- The user's **first eligible date** is the local date they accepted the Pact. Nothing before that is ever finalised.
- **Timezone changes** (travel): when a user changes timezone, set `profiles.tz_changed_at = now()`. The finaliser skips that user for 24h after a change (grace period). Existing check-ins keep their `local_date`; a user can never have two check-ins for the same `local_date` (unique constraint) and can never check in for a date after `today_local` in their *current* timezone.

---

## 5. Check-ins

### Statuses
| Status | Set by | Points | Streak effect |
|---|---|---|---|
| `clean` | user | `10 + ceil(min(streak,60)/6)` | +1 |
| `relapse` (UI "Slipped") | user | 0 | resets to 0 |
| `missed` | system (finaliser) | −5 | resets to 0, + Mystery Box, + clown state |
| `frozen` | system (token) | 0 | paused (no add, no break) |
| `vacation` | system (vacation range) | 0 | paused (no add, no break) |

### Design rationale (keep this behaviour exactly)
- **Missed must always be strictly worse than an honest slip.** Slip = streak reset. Missed = streak reset **+ −5 points + Mystery Box + clown avatar**. This removes any incentive to "go silent" instead of admitting a slip, which keeps the data honest.

### Allowed transitions (within the backfill window only)
- none → `clean` ✅
- none → `relapse` ✅
- `clean` → `relapse` ✅ (you can always own up later the same window)
- `relapse` → `clean` ❌ — **except** a 5-minute undo (`UNDO_WINDOW_MINUTES`) for misclicks.
- After the deadline: the record is locked. No edits.
- `missed`/`frozen`/`vacation` are system-only; users can't edit them.

### Check-in sources
`app`, `widget`, `backfill` (yesterday), `system`. Stored for stats/debugging.

### Slip flow (UI)
- On Home, "I slipped" is a small secondary link under the big Clean button.
- Tapping opens a confirm sheet: supportive copy — *"Reset, not over. Your 30-day score keeps most of your progress. Owning it is the move."* — optional private note, confirm button.
- **Slips can only be logged in-app** (never from the widget) to prevent accidents.
- After confirming: show current Lock-In Score, how many days until the 30-day window drops this, and an option to start an SOS-style 10-minute reset timer (reuse the Hold the Line screen without alerting the group — "Solo reset").

---

## 6. Freeze tokens & vacation mode

### Freeze tokens
- `FREEZE_TOKENS_PER_MONTH = 2`, reset on the 1st of each calendar month (user-local), **no rollover**.
- Lazily reset: when reading/using tokens, if `freeze_tokens_month != current YYYY-MM` → set tokens to 2 and update the month.
- Auto-used by the finaliser if `auto_use_freeze = true` (default true). Toggle in Settings.
- Using a token notifies the group (data-only refresh + optional visible notification: *"🧊 Jason used a freeze token"*). Accountability, not punishment.

### Vacation mode
- Set a date range **in advance**: `start_date >= today_local + 1`.
- Max `VACATION_MAX_DAYS_PER_30 = 10` vacation days in any rolling 30-day window; max single range 10 days.
- Days in range finalise as `vacation` (if not checked in — a user *can* still check in clean while on vacation and earn points normally).
- Group is notified when a vacation is scheduled: *"🏝️ Jason is on vacation 3–9 Dec"*.
- Can be cancelled any time (future days only).

---

## 7. Scoring

### 7.1 Daily points
```
clean:     points = 10 + ceil(min(streak_after_this_day, 60) / 6)
           → day 1..6 = 11, day 7..12 = 12, …, day 55..60+ = 20
relapse:   0
missed:    −5
frozen:    0
vacation:  0
(no record yet / open day): not counted
```
`streak_after_this_day` for a clean day = previous streak + 1.

### 7.2 Streak
Walk check-ins backwards from the most recent finalised-or-today record:
- `clean` → +1, continue
- `frozen` / `vacation` → skip (continue without adding)
- `relapse` / `missed` → stop
- A gap (date with no record that is still inside its open window, i.e. yesterday not yet checked in) → **skip, don't break** (it's still pending).

`longest_streak` = max streak ever achieved.

### 7.3 Lock-In Score (main leaderboard number)
```
score_30d = max(0, sum(points) over check-ins with local_date in [today_local − 29, today_local])
```
Max possible ≈ 600. Display as an integer.

### 7.4 Season points
```
season_points = sum(points) over check-ins whose local_date falls in the season month
              − 50 × (failed forfeits this season)
```
Can go negative (it's funny). Display as-is.

### 7.5 Source of truth
- **SQL is the source of truth.** Scores are computed by `app.recompute_user_stats(user_id)` from the `checkins` table and cached in `user_stats`.
- `checkins.points` and `checkins.streak_after` are stored per row at write time, then **recomputed for all rows after any edit** (an edit to yesterday affects today's streak bonus). Recomputation is cheap: at most ~a few hundred rows per user.
- A TypeScript mirror (`src/shared/scoring.ts`) exists **only** for UI previews ("check in now → +12 pts") and is tested against the **same JSON fixtures** as the SQL implementation (`/fixtures/scoring/*.json`) so they can't drift.

### 7.6 Worked example (use as a test fixture)
| Day | Status | Streak after | Points |
|---|---|---|---|
| 1 | clean | 1 | 11 |
| 2 | clean | 2 | 11 |
| 3 | clean | 3 | 11 |
| 4 | clean | 4 | 11 |
| 5 | clean | 5 | 11 |
| 6 | clean | 6 | 11 |
| 7 | clean | 7 | 12 |
| 8 | relapse | 0 | 0 |
| 9 | clean | 1 | 11 |
| 10 | missed | 0 | −5 (+ box) |
| 11 | frozen | 0 | 0 |
| 12 | clean | 1 | 11 |

Total over these 12 days = **95**. Current streak = 1. Longest = 7.

Second fixture: 60 consecutive clean days → day 60 earns 20; day 61 earns 20; streak 61.

Third fixture: clean 1–5, vacation 6–8, clean 9 → streak = 6 (vacation pauses), day 9 points = 10 + ceil(6/6) = 11.

---

## 8. Ranks, flames, badges, seasons

### 8.1 Ranks (based on current streak)
| Rank | Streak | Badge colour |
|---|---|---|
| Rookie | 0–2 | grey |
| Grinder | 3–6 | bronze |
| Locked In | 7–13 | silver |
| Disciplined | 14–29 | gold |
| Monk Mode | 30–59 | purple |
| Final Boss | 60+ | animated-looking rainbow/blue |

- **XP bar** = progress from current rank threshold to next (e.g. streak 10 → 3/7 toward Disciplined at 14). Final Boss shows a full bar with "MAX".
- **Rank up** → full-screen celebration in-app (confetti, sound, haptic) + group notification.
- Rank drops silently (no shame notification).

### 8.2 Flame tiers (streak)
| Tier | Streak | Asset |
|---|---|---|
| 0 | 0 | ember (grey smoke) |
| 1 | 1–6 | small flame |
| 2 | 7–29 | medium flame |
| 3 | 30–59 | bonfire |
| 4 | 60+ | blue flame |

### 8.3 Avatar
- Each user picks a **base pixel character** at onboarding (≥ 8 options, `avatar_id`).
- The rendered avatar = base + **rank overlay** (aura/armour that upgrades per rank) + **state overlay**:
  - 🤡 **clown** (clown nose + wig) while `clown_until > now()` — set when a day finalises as `missed`, lasts until that box is confirmed or 48h, whichever is later.
  - 🐔 **chicken** (chicken costume) while `coward_until > now()` — 7 days after a failed forfeit.
  - 🔒 **jail bars** while the user owes an unopened box.
  - 🛡️ **shield glow** while the user has an active SOS that's going well (optional polish).
- Precedence when multiple apply: jail > chicken > clown > normal.
- Avatars are **pre-rendered PNG layers** (see §15). Write a pure function `resolveAvatarLayers(stats) → string[]` used by both app and widget.

### 8.4 Badges
| Key | Condition |
|---|---|
| `streak_3`, `streak_7`, `streak_14`, `streak_30`, `streak_60`, `streak_90`, `streak_180`, `streak_365` | streak milestones (permanent) |
| `perfect_week` | 7 clean check-ins Mon–Sun (user-local week) — repeatable, show count |
| `owned_it` | first honest slip logged (one-time; normalises honesty) |
| `season_champion` | #1 in season points at season end (per season) |
| `podium` | top 3 at season end (per season) |
| `wingman` | responded to an SOS within 5 minutes (count) |
| `held_the_line` | completed an SOS with outcome `held` (count) |
| `box_survivor` | completed a Legendary forfeit |
| `coward` | failed a forfeit (season-scoped, shown in red, removed at season end) |
| `early_bird` | first in the group to check in on 7 different days (count) |

Badge grants are idempotent (`unique(user_id, badge_key, season_id)`; counts stored in `user_stats` or a `badge_counts` jsonb).

### 8.5 Seasons
- A season = calendar month in the **group timezone** (`groups.timezone`, default `Australia/Darwin`).
- Season numbering starts at 1 for the group's first month.
- Season end job (§18): snapshot standings into `seasons.results` (jsonb), grant `season_champion` / `podium`, clear `coward` badges and `coward_until`, reset rerolls, delete proof images for that season, open next season.
- **Season Wrap** screen on first app open after season end: podium animation, each member's stats (clean days, best streak, boxes survived, urges defeated, wingman count), and the champion's crown.
- Widget shows season label + countdown: `S3 · 4d left`.

---

## 9. Mystery Box (forfeit system)

### 9.1 Trigger
- One box is created **each time a day is finalised as `missed`**. Boxes queue if several are owed.
- Never created for `relapse`, `frozen`, or `vacation`.

### 9.2 Box lifecycle (state machine)
```
owed ──open──▶ opened ──submit proof──▶ proof_submitted ──votes──▶ confirmed ✅
  │               │                          │
  │ (24h, auto-   │ (24h no proof)           └─rejected──▶ opened (1 resubmit allowed)
  │  open w/ +1   ▼                                          │ (2nd rejection)
  │  tier bump) failed ❌ ◀─────────────────────────────────┘
  ▼
opened
```
- **owed:** created by finaliser. `open_deadline = created_at + 24h`.
  - While a user has any `owed` box, **they cannot check in** (the app shows the box modal first; the widget button becomes "Open your box 📦" which deep-links to the box screen).
  - If not opened by `open_deadline`: auto-open with rarity bumped **one tier** ("Chicken tax"). Notify the group: *"⏰ Jason was too scared to open his box. It opened itself… and got worse."*
- **opened:** rarity, loot item and modifier are rolled **server-side at open time** (RPC `open_box`). `proof_deadline = opened_at + 24h`. User can now check in normally again.
- **proof_submitted:** user uploads a screenshot. Other members vote.
- **confirmed:** resolved. Clears clown state for that box. Grants `box_survivor` if Legendary.
- **failed:** −50 season points, `coward` badge for the season, `coward_until = now() + 7 days` (chicken avatar). Group notified.

### 9.3 Rarity odds
`n` = number of `missed` days in the last 30 days **including this one**.

| n | Common | Rare | Epic | Legendary | Cursed modifier chance |
|---|---|---|---|---|---|
| 1 | 70% | 25% | 5% | 0% | 10% |
| 2 | 40% | 40% | 17% | 3% | 20% |
| 3 | 15% | 35% | 35% | 15% | 35% |
| 4+ | 0% | 20% | 45% | 35% | 50% |

Store the table in SQL (`app.box_odds(n)`), not hard-coded in the client.

### 9.4 What each rarity means
| Rarity | Colour | Post type | Must stay up |
|---|---|---|---|
| Common | grey `#B8B8C8` | IG story, any selfie | 24h (story lifetime) |
| Rare | blue `#4DA3FF` | IG story, specific photo prompt | 24h |
| Epic | purple `#B266FF` | IG feed post, specific staged photo | 48h |
| Legendary | gold `#FFC94D` | IG feed post **or** profile picture change, or Wildcard | 7 days |

### 9.5 Rolling the contents (server-side, `open_box`)
1. Roll rarity from odds table (or bump if auto-open).
2. Pick a random **approved** loot item of that rarity from the group pool + global seed pool, **excluding items this user has received before** until they've received every item of that rarity (then allow repeats).
3. Roll cursed modifier chance; if hit, pick a random modifier.
4. Legendary has a 25% chance of being **Wildcard** instead of a pool item (§9.7).
5. Persist everything on the box row. Return it to the client for the reveal animation.
6. Use Postgres `random()` inside the security-definer function. The client never decides outcomes.

### 9.6 Cursed modifiers (seed list)
| Key | Text |
|---|---|
| `thank_you_queen` | Reply "thank you queen 👑" to every comment. |
| `emoji_flood` | Your caption must include at least 10 emojis. |
| `dawn_patrol` | Post between 6:00 and 7:00 am. |
| `inspirations` | Tag the other members with "my inspirations 🙏". |
| `filter_roulette` | Your mates choose the filter. |
| `caps_lock` | The whole caption must be in CAPS. |
| `pinned` | Pin a comment saying "this is my villain origin story". |
| `voice_crack` | Add a song to the story chosen by your mates. |

### 9.7 Wildcard (Legendary only)
- Reveal shows "🃏 WILDCARD". Other members get a push: *"🃏 Jason pulled a Wildcard. You write his forfeit."*
- Other members have **12h** to submit a caption + photo prompt (forbidden-word checked). The first submission wins, but the other members can upvote a later one within the 12h to override (most upvotes wins at the deadline; ties → earliest).
- If nobody submits in 12h → fall back to a random Legendary pool item.
- `proof_deadline` starts when the wildcard text is locked in.

### 9.8 Reroll ("Double or Nothing")
- 1 reroll **per user per season**.
- Allowed only in `opened` state before proof is submitted (not for Wildcards).
- Re-roll rarity using the same odds row, but the result is `max(current_rarity, rolled_rarity)` — it can never go down. Then re-pick item & modifier.
- The group is notified: *"🎲 Jason went double or nothing…"* followed by the result.

### 9.9 Proof & voting
- Proof = 1 image (screenshot of the post/story/profile). Compressed client-side to ≤ 1280px longest edge, JPEG ~0.7, before upload.
- Stored at `proofs/{group_id}/{season_id}/{box_id}.jpg` (private bucket).
- Voters = all **other** current group members.
- **Confirmed** when `confirms >= ceil(voters / 2)` **and** `confirms > rejects`.
- **Rejected** when all voters have voted and `rejects >= confirms`. User gets **one resubmit** (back to `opened`, same deadline + 12h extension). A second rejection → `failed`.
- **Auto-confirm:** if 24h pass after proof submission without a decision → confirmed (don't punish someone for lazy friends).
- **"Deleted early" flag:** for Epic/Legendary, during the must-stay-up window, any other member can flag "taken down early 👀". If a majority of voters flag it → `failed`.
- Voting UI shows the proof image, the required caption/prompt/modifier side-by-side, and big ✅ / ❌ buttons.

### 9.10 Spectating
- When a box is **opened**, others get a push: *"👀 Jason is opening a box…"*. Tapping it opens a live spectate view (Supabase Realtime on the box row) that plays the same reveal animation when the result lands.

### 9.11 The reveal (in-app, the big moment)
1. Box sits on screen shaking, with rarity-neutral glow; user **holds** to open (1.5s hold, haptic ticks).
2. Box bursts; light colour reveals rarity (grey/blue/purple/gold); for Legendary, screen flash + extra particles + sound sting.
3. Card flips to show: rarity banner, **caption** (large, copyable with one tap), **photo prompt**, **post type & duration**, **cursed modifier** (if any, in a red "CURSED" ribbon), **deadline countdown**.
4. Buttons: **Copy caption**, **Open Instagram** (share intent / deep link — just opens IG; user creates the post manually), **Double or Nothing** (if available), **I've posted → upload proof**.

### 9.12 Wall of Shame
- In-app list of all forfeits this season and history: avatar, rarity, caption, outcome, date. Proof thumbnails visible this season only (deleted at season end).

---

## 10. Loot pool & voting

- **Global seed pool** (`group_id = null`) loaded from `supabase/seed.sql` (§23). Always approved.
- **Group submissions:** any member can submit `{rarity, caption, photo_prompt, post_type}`.
  - Server validates: lengths (caption ≤ 220 chars, prompt ≤ 140), forbidden-word check, rarity/post_type compatibility (story → Common/Rare, feed → Epic/Legendary, profile_pic → Legendary).
  - Status `pending` → other members vote approve/reject. Approved when approvals `>= ceil(voters/2)` and approvals > rejections. Rejected similarly. Submitter can't vote.
- **Browsing the pool:** Common and Rare items are visible to all. Epic and Legendary items are shown as `???` cards ("you'll find out…") — except to the submitter.
- Users **can** receive their own submissions (poetic justice).

---

## 11. SOS — "Hold the Line"

### 11.1 Trigger
- **Home screen:** large SOS button, **hold for 1.5s** to activate (prevents accidents), with a filling ring + haptics.
- **Widget:** small 🆘 icon → deep-links into the app's SOS screen, where the user does the hold-to-activate. (Widgets can't do hold gestures.)
- Limit: `SOS_MAX_PER_DAY = 3`. If exceeded, offer Solo reset (timer without alerting the group).

### 11.2 On activation
1. RPC `start_sos()` creates an `sos_events` row: `started_at = now()`, `ends_at = now() + 10 min`.
2. High-priority push to all other members: **"🚨 Jason needs backup. Send something now."** (tap → respond screen).
3. Group widgets refresh to show a banner: `🚨 Jason needs backup` (tap → respond screen).

### 11.3 Requester screen
- Big **10:00 countdown** timer.
- **Box-breathing animation** (4s in, 4s hold, 4s out, 4s hold) with a pixel art square that fills/empties.
- **Rotating challenge card** every 2 minutes (seed list): "Do 20 push-ups", "Drink a full glass of water", "Step outside for 2 minutes", "Text someone (not about this)", "Put your phone in another room for 5 minutes", "Do 30 squats", "Take a cold shower", "Go for a walk around the block", "Plan tomorrow's training session", "Clean one thing in your room". Tappable "Done ✅" (counts toward `challenges_done` stat).
- **Live feed of responses** from friends (Supabase Realtime), shown as chat bubbles with their avatars, with a pop sound + haptic per message.
- Button: "I'm good now" (ends early → outcome prompt).

### 11.4 Responder screen
- Shows requester avatar + timer remaining.
- **Quick replies** (one tap): "Hold the line 🛡️", "You got this 💪", "Think of the box 📦", "Go do push-ups. Now. 🏋️", "Call me 📞", "Ironman doesn't train itself 🏊🚴🏃", plus **custom text** (≤ 140 chars).
- "Call me" opens the dialer if the requester has a phone number in their profile (optional field).
- First response within 5 minutes grants a `wingman` count.

### 11.5 Resolution
- At timer end (or "I'm good now"): **"Did you hold the line?"**
  - **Yes** → outcome `held`, `urges_defeated += 1`, `held_the_line` badge count +1, celebration + group notification *"🛡️ Jason held the line. Thanks, Miguel & Ken."*
  - **No** → outcome `relapsed` → supportive copy, then leads into the Slip flow (§5) with **no extra penalty**.
- Unresolved after 2 hours → outcome `abandoned` (no effect).
- **No points for SOS** (so it can't be farmed). Only stats and badges.

---

## 12. Android widget (CENTREPIECE)

Library: **`react-native-android-widget`** (renders JSX to native Android RemoteViews; supports Expo via config plugin; click actions supported). Verify exact APIs against the library's current docs before implementing — key concepts: widget components (`FlexWidget`, `TextWidget`, `ImageWidget`, …), a `widgetTaskHandler` registered in the app entry, `requestWidgetUpdate()` from app code, and `clickAction` / `clickActionData` props.

### 12.1 Widgets to ship
1. **`LeaderboardWidget`** — default 4×2, resizable to 4×3 (shows more rows/details when taller). **Primary.**
2. **`MiniWidget`** — 2×1, personal status.

### 12.2 LeaderboardWidget layout (4×2)
```
┌──────────────────────────────────────────┐
│ 🔒 LOCKIN' IN           S3 · 4d left 🆘 │  ← header (pixel font), SOS icon
│ 👑 1 [ava] Miguel   512  🔥34   ✓        │
│ 🥈 2 [ava] Jason    498  🔥29   ✓        │  ← "you" row highlighted
│ 🥉 3 [ava] Ken      301  🔥6    📦       │
│ 12 pts to catch Miguel 🎯                │  ← rival callout
│ [        ✓  CHECK IN CLEAN        ]      │  ← state-dependent button
└──────────────────────────────────────────┘
```
- Row content: medal/position, avatar (composited layers; see 12.6), display name (truncate at 10 chars), Lock-In Score, flame icon (tier asset) + streak number, today-status icon.
- Today-status icons: `✓` checked in today · `·` not yet · `📦` owes a box · `🐔` coward · `🤡` clown (missed recently) · `🏝️` on vacation · `🧊` frozen today.
- If the group has > 3 members (future): show top 3 + the current user's row if not in top 3.
- 4×3 adds: XP bar for "you" row, season points column, and last group event line ("Ken opened a Rare box 20m ago").
- Tapping anywhere except the button/SOS icon → opens app Home.

### 12.3 Button states (bottom of widget)
| Condition | Button |
|---|---|
| Not signed in | "Sign in to Lockin' In" → opens app |
| Owes an unopened box | "📦 Open your box" (gold) → deep link `lockinin://box/{id}` |
| Today not checked in, before 17:00, yesterday checked | "Opens at 5pm ⏳" (disabled look) |
| Yesterday not checked in (backfill available) | "✓ Check in for yesterday" |
| Today not checked in, ≥ 17:00 | "✓ CHECK IN CLEAN" (bright green) |
| After first tap | "Tap again to confirm (5s)" (two-step confirm; reverts after 5s) |
| Request in flight | "Locking in…" |
| Queued offline | "Queued ⏳ — will sync" |
| Checked in today | "🔥 Locked in today" (no action, or opens app) |
| Active SOS from someone else | Banner row above the button: "🚨 Miguel needs backup" → deep link `lockinin://sos/{id}/respond` |

**Slips can never be logged from the widget.**

### 12.4 MiniWidget layout (2×1)
```
┌───────────────────────┐
│ [ava] 🔥29  #2 · 498 │
│      ✓ Locked in     │  (or tap-to-check-in state, or 📦)
└───────────────────────┘
```

### 12.5 Data flow
- The widget **never queries Supabase directly during render.** It renders from a cached **widget snapshot** JSON stored locally (AsyncStorage or MMKV key `widget_snapshot_v1`).
- Snapshot shape (`src/widget/snapshot.ts`, typed):
```ts
type WidgetSnapshot = {
  version: 1;
  generatedAt: string;          // ISO
  me: { uid: string; todayLocal: string; checkinOpensAt: string /* "17:00" */;
        checkedInToday: boolean; yesterdayPending: boolean; owedBoxId: string | null };
  season: { number: number; endsAt: string };
  members: Array<{
    uid: string; name: string; avatarLayers: string[];
    score30d: number; seasonPoints: number; streak: number; flameTier: 0|1|2|3|4;
    rank: string; xp: { current: number; next: number | null };
    todayStatus: 'checked' | 'pending' | 'box' | 'coward' | 'clown' | 'vacation' | 'frozen';
    position: number;
  }>;
  rival: { text: string } | null;
  activeSos: { id: string; uid: string; name: string; endsAt: string } | null;
  lastEvent: { text: string; at: string } | null;
};
```
- The snapshot is produced by a single RPC **`get_widget_snapshot()`** (server computes positions, rival text, statuses) so all phones agree.
- **Self-correction on render:** if `me.todayLocal` != current local date when rendering, treat `checkedInToday = false` and show stale-safe state, and trigger a background refresh.
- If `generatedAt` is older than 2h, show a tiny "updated 2h ago" in the header.

### 12.6 Refresh triggers
1. App comes to foreground → fetch snapshot → `requestWidgetUpdate` for both widgets.
2. After the user's own check-in (app or widget) → refresh.
3. **FCM data message** `{type: "group_updated"}` received (foreground or background handler via `@react-native-firebase/messaging` `setBackgroundMessageHandler`) → fetch snapshot → `requestWidgetUpdate`. The server sends this to every member's device on: any check-in, finalisation, box state change, SOS start/response/end, vote result, season rollover. Use an FCM `collapse_key` of `group_updated` so bursts merge.
4. Fallback periodic update: `updatePeriodMillis` = 30 min (Android minimum) in the widget config.
5. On `WIDGET_ADDED` / `WIDGET_RESIZED` → render from cache immediately, then refresh.

### 12.7 Check-in from the widget
- Click action `CHECK_IN` → two-step confirm (store `pendingConfirmUntil` in local storage; re-render with confirm label; if second tap within 5s → proceed).
- Handler (headless JS) loads the persisted Supabase session, calls RPC `check_in(local_date, 'clean', null, 'widget')`.
- If offline/fails: push to the **offline queue** (`offline_checkins` in local storage), render "Queued ⏳". The queue flushes on next app open, connectivity change, or next widget update. Queued items carry the intended `local_date`; the server still enforces the window.
- On success: haptic is not available in widgets — instead, re-render with "🔥 Locked in today" and a brief "+12" text flash state for one render cycle.

### 12.8 Rendering assets
- Widgets cannot run animations or custom drawing. Use **pre-rendered PNG assets** bundled with the app (pixel art: avatars layers, flames, medals, rank badges, box icons). Pixel art should be scaled with nearest-neighbour (export at final pixel sizes: 24dp, 48dp → @1x/@2x/@3x).
- Avatar composition: widgets can stack images (overlay via layout) — if overlay layout proves unreliable in RemoteViews, pre-compose avatar variants at build time with a script (`scripts/compose-avatars.ts` using `sharp`) for every `base × rank × state` combination (8 × 6 × 5 = 240 small PNGs is fine).
- Fonts: use a pixel font (e.g. **Press Start 2P**, OFL licence) for headers if the widget library supports custom fonts; otherwise use bold system font for the widget and the pixel font in-app only.
- Colours: see §15.

---

## 13. Notifications

Android notification channels (create on startup):
| Channel ID | Name | Importance |
|---|---|---|
| `reminders` | Reminders | default |
| `group` | Group activity | low/default |
| `boxes` | Mystery boxes | high |
| `sos` | Backup requests | **max/high**, bypass DND **off** |

All copy must pass the §3 forbidden-word rule. Examples:

| Event | Recipients | Copy |
|---|---|---|
| Daily reminder at `reminder_time` if not checked in | self | "🔒 Lock in. Check in for today." |
| Final warning 2h before yesterday's deadline | self | "⏰ 2 hours left to check in for yesterday… or the box gets you 📦" |
| Day finalised as missed | self | "📦 You owe a Mystery Box. Open it within 24h." |
| Day finalised as missed | others | "🤡 Jason missed a check-in. A box has appeared…" |
| Box opening | others | "👀 Jason is opening a box…" |
| Box result | others | "🟣 Jason pulled an EPIC." |
| Wildcard | others | "🃏 Jason pulled a Wildcard. You write his forfeit." |
| Proof submitted | others | "🗳️ Jason submitted proof. Vote now." |
| Proof verdict | self + others | "✅ Forfeit confirmed." / "❌ Proof rejected — 1 resubmit left." |
| Forfeit failed | others | "🐔 Jason chickened out. −50 season points." |
| Auto-opened box | others | "⏰ Jason was too scared to open his box. It opened itself… and got worse." |
| SOS started | others | "🚨 Jason needs backup. Send something now." |
| SOS response | requester | "🛡️ Miguel: Hold the line 🛡️" |
| SOS held | others | "🛡️ Jason held the line." |
| Rank up | others | "⬆️ Ken reached Monk Mode." |
| Milestone | others | "🔥 Miguel hit a 30-day streak." |
| Freeze used | others | "🧊 Jason used a freeze token." |
| Vacation scheduled | others | "🏝️ Jason is on vacation 3–9 Dec." |
| Loot submission | others | "📝 New box caption submitted. Vote it in." |
| Season end | all | "🏆 Season 3 is over. See who won." |
| Friend checked in | others | **Data-only** by default (widget refresh). Visible notification optional (Settings toggle, default off). |

Settings lets users toggle each category except `sos` (SOS can be muted only via Android system settings — it's the whole point).

---

## 14. Screens & UX

Use **expo-router** (file-based). Deep link scheme: `lockinin://`.

1. **Onboarding** (`/onboarding/*`)
   1. Welcome — what the game is (neutral copy).
   2. Google sign-in.
   3. Display name + pick base avatar (grid of pixel characters).
   4. Timezone (auto-detected, editable) + reminder time (default 21:00).
   5. Create group (name → generates 6-char invite code, uppercase, no ambiguous chars `0O1IL`) **or** join with code.
   6. **The Pact** — rules of the game, forfeit rules (§3.7), consent checkbox: "I'm in. If I miss a check-in, I open the box and do the forfeit." → `pact_accepted_at`.
   7. Notification permission prompt.
   8. "Add the widget" guide (illustrated steps: long-press home screen → Widgets → Lockin' In). On Android 8+, try `requestPinAppWidget` via the library if supported.
2. **Home** (`/`)
   - Header: avatar (with states), rank badge, XP bar.
   - Big flame + streak number.
   - Lock-In Score + season points.
   - Rival callout.
   - **Check-in card:** big "CHECK IN CLEAN" button (state-aware like the widget), small "I slipped" link. If yesterday is pending, show "Check in for yesterday" first.
   - Owed box banner (blocks check-in until opened).
   - **SOS button** (hold to activate).
   - Group today strip: avatars with ✓ / · / 📦 states.
3. **Leaderboard** (`/leaderboard`) — tabs: **Lock-In Score** (30d), **Season**, **Streak**. Animated podium for top 3, list below. Tap a member → their profile.
4. **History** (`/history`) — calendar heatmap: clean (green, intensity by streak), slipped (red), missed (amber + 📦 icon), frozen (ice blue), vacation (teal), pending (outlined). Tap a day → detail sheet (status, points, private note if own; edit if within window).
5. **Profile** (`/profile/[uid]`) — avatar, rank, badges grid, longest streak, current streak, clean days total, urges defeated, wingman count, boxes survived, coward badges. Others' profiles show their calendar statuses (no notes).
6. **Mystery Box** (`/box/[id]`) — reveal flow (§9.11), proof upload, status timeline, reroll.
7. **Votes** (`/votes`) — pending proof votes, pending loot votes. Badge count on tab icon.
8. **Loot Pool** (`/loot`) — browse (Epic/Legendary hidden as `???`), submit new.
9. **SOS** (`/sos/[id]`) requester view; (`/sos/[id]/respond`) responder view.
10. **Wall of Shame** (`/shame`).
11. **Season Wrap** (`/season/[id]`).
12. **Settings** (`/settings`) — reminder time, timezone, vacation mode (schedule/cancel), freeze tokens left + auto-use toggle, notification toggles, optional phone number (for "Call me"), change avatar, leave group (confirm: "This ends your forfeits and removes your data from the group"), sign out, delete account (deletes all user data).

Tab bar: Home · Leaderboard · Votes · History · Profile. (Loot, Shame, Settings reachable from Profile/Home menus.)

**Feel:** every meaningful action gets feedback — haptics (`expo-haptics`), short 8-bit sound effects (`expo-audio`; toggle in settings), micro-animations (`react-native-reanimated`). Check-in success = flame burst + "+12" floating text + coin sound.

---

## 15. Visual design direction

- **Theme:** retro arcade / pixel art, dark mode only (v1).
- **Palette:**
  - Background `#14111F`, surface `#1E1A2E`, surface-2 `#2A2440`, text `#F4F1FF`, muted `#9A93B8`.
  - Clean / success `#39FF88` · Slipped `#FF4D6D` · Missed / warning `#FFB020` · Frozen `#7FD8FF` · Vacation `#3DD9C1`.
  - Rarity: Common `#B8B8C8`, Rare `#4DA3FF`, Epic `#B266FF`, Legendary `#FFC94D`, Cursed `#FF3B3B`.
- **Type:** pixel font (Press Start 2P, OFL) for headings, numbers, buttons; a readable sans (Inter, OFL) for body text. Bundle via `expo-font`.
- **Assets (all free):** generate placeholder pixel art **programmatically** (simple SVG → PNG via `sharp` in `scripts/`) with a clear manifest (`assets/pixel/manifest.json`) so real art can be swapped later without code changes. Optionally use CC0 packs (e.g. itch.io CC0 pixel art) — record licence in `assets/LICENSES.md`.
- **Animations:** prefer **Reanimated** for the box reveal, flame and podium (free, full control). Lottie is optional.

---

## 16. Data model (Postgres / Supabase)

Use a dedicated schema `app` for functions; tables in `public` (Supabase default) with RLS on **all** tables. Use `uuid` PKs (`gen_random_uuid()`), `timestamptz` everywhere.

```sql
-- Enums
create type checkin_status as enum ('clean','relapse','missed','frozen','vacation');
create type checkin_source as enum ('app','widget','backfill','system');
create type rarity as enum ('common','rare','epic','legendary');
create type post_type as enum ('story','feed','profile_pic');
create type box_status as enum ('owed','opened','proof_submitted','confirmed','failed');
create type vote_kind as enum ('confirm','reject');
create type sos_outcome as enum ('held','relapsed','abandoned');
create type loot_status as enum ('pending','approved','rejected');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_id text not null,
  timezone text not null default 'Australia/Darwin',
  tz_changed_at timestamptz,
  reminder_time time not null default '21:00',
  auto_use_freeze boolean not null default true,
  phone text,                                   -- optional, for "Call me"
  notify_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  timezone text not null default 'Australia/Darwin',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  pact_accepted_at timestamptz,
  first_eligible_date date,                    -- local date of pact acceptance
  primary key (group_id, user_id),
  unique (user_id)                              -- v1: one group per user
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  local_date date not null,
  status checkin_status not null,
  points int not null default 0,
  streak_after int not null default 0,
  source checkin_source not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index on checkins (group_id, local_date);

create table checkin_notes (                    -- private, owner-only RLS
  checkin_id uuid primary key references checkins(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  note text not null check (char_length(note) <= 500)
);

create table user_stats (                       -- cache, recomputed from checkins
  user_id uuid primary key references profiles(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  score_30d int not null default 0,
  season_points int not null default 0,
  rank text not null default 'Rookie',
  flame_tier int not null default 0,
  last_checkin_date date,
  freeze_tokens_left int not null default 2,
  freeze_tokens_month text,                     -- 'YYYY-MM'
  reroll_used_season_id uuid,
  clown_until timestamptz,
  coward_until timestamptz,
  urges_defeated int not null default 0,
  wingman_count int not null default 0,
  challenges_done int not null default 0,
  boxes_completed int not null default 0,
  badge_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table vacations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  number int not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active','finished')),
  results jsonb,
  unique (group_id, number)
);

create table badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_key text not null,
  season_id uuid references seasons(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique nulls not distinct (user_id, badge_key, season_id)
);

create table loot_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,  -- null = global seed
  rarity rarity not null,
  caption text not null check (char_length(caption) <= 220),
  photo_prompt text not null check (char_length(photo_prompt) <= 140),
  post_type post_type not null,
  submitted_by uuid references profiles(id) on delete set null,
  status loot_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table loot_votes (
  loot_item_id uuid not null references loot_items(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  approve boolean not null,
  created_at timestamptz not null default now(),
  primary key (loot_item_id, voter_id)
);

create table modifiers (
  key text primary key,
  text text not null
);

create table mystery_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  missed_date date not null,
  status box_status not null default 'owed',
  rarity rarity,
  loot_item_id uuid references loot_items(id),
  modifier_key text references modifiers(key),
  is_wildcard boolean not null default false,
  wildcard_caption text,
  wildcard_photo_prompt text,
  wildcard_deadline timestamptz,
  auto_opened boolean not null default false,
  rerolled boolean not null default false,
  open_deadline timestamptz not null,
  opened_at timestamptz,
  proof_deadline timestamptz,
  proof_path text,
  proof_submitted_at timestamptz,
  resubmits_used int not null default 0,
  stay_up_until timestamptz,                   -- for Epic/Legendary "deleted early" flags
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, missed_date)
);

create table box_votes (
  box_id uuid not null references mystery_boxes(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  vote vote_kind not null,
  round int not null default 1,                -- 1 = first proof, 2 = resubmit
  created_at timestamptz not null default now(),
  primary key (box_id, voter_id, round)
);

create table box_flags (                       -- "taken down early"
  box_id uuid not null references mystery_boxes(id) on delete cascade,
  flagger_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (box_id, flagger_id)
);

create table wildcard_submissions (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references mystery_boxes(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  caption text not null check (char_length(caption) <= 220),
  photo_prompt text not null check (char_length(photo_prompt) <= 140),
  upvotes uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  solo boolean not null default false,         -- solo reset (no group alert)
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  outcome sos_outcome,
  resolved_at timestamptz
);

create table sos_responses (
  id uuid primary key default gen_random_uuid(),
  sos_id uuid not null references sos_events(id) on delete cascade,
  responder_id uuid not null references profiles(id) on delete cascade,
  preset_key text,
  message text check (char_length(message) <= 140),
  created_at timestamptz not null default now()
);

create table device_tokens (
  token text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('android','ios')),
  updated_at timestamptz not null default now()
);

create table notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,                          -- 'visible' | 'data'
  channel text,                                -- reminders|group|boxes|sos
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,     -- e.g. {type:'group_updated'} or deep link
  collapse_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);

create table group_events (                    -- feed for "last event" line + spectating
  id bigint generated always as identity primary key,
  group_id uuid not null references groups(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

---

## 17. Row Level Security & storage

- Enable RLS on **every** table.
- Helper: `app.my_group_id()` → the caller's group id (security definer, stable).
- **Read policies:** members can `select` rows where `group_id = app.my_group_id()` on `groups`, `group_members`, `checkins`, `user_stats`, `seasons`, `mystery_boxes`, `box_votes`, `box_flags`, `wildcard_submissions` (author-hidden until locked is fine to skip), `sos_events`, `sos_responses` (via join), `group_events`, `badges` (via member join), `vacations` (via member join). `profiles`: select own + same-group members.
- `loot_items`: select where `group_id is null or group_id = app.my_group_id()`. **Epic/Legendary hiding is done in the client** (data is visible; acceptable for v1 between friends) — or better, expose a view `loot_items_visible` that nulls caption/prompt for epic/legendary unless `submitted_by = auth.uid()`. Prefer the view.
- `checkin_notes`: select/insert/update/delete **only** where `user_id = auth.uid()`.
- `device_tokens`: own rows only.
- `notification_outbox`: no client access.
- **Writes:** clients do **not** insert/update game tables directly. All mutations go through **security-definer RPCs** (§18) that validate rules. Only allow direct writes for: `profiles` (own row, limited columns via RPC preferred), `device_tokens` (own), `checkin_notes` (own).
- **Storage:** private bucket `proofs`. Policy: a user can upload only to `proofs/{their group_id}/…/{box_id}.jpg` for their own box in `opened` state (validate in `submit_proof` RPC too). Group members can create signed URLs for objects under their group prefix (read via RPC `get_proof_url(box_id)` returning a 10-minute signed URL, or a storage select policy on the path prefix).

---

## 18. Backend logic

### 18.1 RPCs (Postgres functions, `security definer`, `set search_path = public, app`)
All return JSON; all validate `auth.uid()` membership; all write a `group_events` row and enqueue a `group_updated` data push to every group member where relevant.

| RPC | Purpose / rules |
|---|---|
| `create_group(name, timezone)` | creates group, invite code, membership (owner), first season |
| `join_group(invite_code)` | joins (fails if already in a group) |
| `accept_pact()` | sets `pact_accepted_at`, `first_eligible_date = today_local`, creates `user_stats` row |
| `update_profile(...)` | display name, avatar, timezone (sets `tz_changed_at` if changed), reminder time, prefs, phone |
| `check_in(local_date, status, note, source)` | validates: pact accepted; no owed box; date is today (≥ opens-at) or yesterday; transition allowed (§5); upserts; writes note to `checkin_notes`; calls `recompute_user_stats`; badge checks; events + pushes (rank up, milestone) |
| `recompute_user_stats(user_id)` | internal; rewrites `points`/`streak_after` for all user rows in date order; updates `user_stats` (streak, longest, score_30d, season_points incl. −50 per failed box this season, rank, flame) |
| `set_vacation(start, end)` / `cancel_vacation(id)` | validation per §6 |
| `open_box(box_id)` | owner only, state `owed`; rolls per §9.5; sets `opened_at`, `proof_deadline`; returns full box. (`stay_up_until` is set later in `submit_proof` as `proof_submitted_at + rarity duration`.) |
| `reroll_box(box_id)` | per §9.8 |
| `submit_proof(box_id, path)` | owner, state `opened`, path matches convention |
| `vote_box(box_id, vote)` | non-owner group member; evaluates §9.9 rules → confirm/reject/fail transitions |
| `flag_box_deleted(box_id)` | non-owner; within `stay_up_until`; majority → failed |
| `submit_wildcard(box_id, caption, prompt)` / `upvote_wildcard(submission_id)` | per §9.7 |
| `submit_loot(rarity, caption, prompt, post_type)` / `vote_loot(id, approve)` | per §10 |
| `start_sos(solo boolean)` | per §11, rate limited |
| `respond_sos(sos_id, preset_key, message)` | non-owner; grants wingman if first within 5 min |
| `resolve_sos(sos_id, outcome)` | owner; updates stats |
| `complete_sos_challenge(sos_id)` | increments `challenges_done` |
| `get_widget_snapshot()` | builds the §12.5 JSON for the caller |
| `get_home()` | one call for Home screen data (stats, today state, owed box, rival, group strip) |
| `register_device(token, platform)` | upsert device token |
| `leave_group()` / `delete_account()` | cleanup |

### 18.2 Scheduled jobs (`pg_cron`, all in UTC, logic converts to local)
| Job | Schedule | Does |
|---|---|---|
| `app.finalize_missed_days()` | every hour at :05 | for every member: compute local now; for each date D from `first_eligible_date` to `today_local − 2` (deadline passed) with no check-in → vacation / frozen / missed (create box with `open_deadline = now()+24h`, set `clown_until`), skip if `tz_changed_at` within 24h; recompute stats; pushes |
| `app.process_box_deadlines()` | every 10 min | auto-open owed boxes past `open_deadline` (tier +1, `auto_opened = true`); fail opened boxes past `proof_deadline`; auto-confirm `proof_submitted` boxes 24h after submission; lock wildcards past `wildcard_deadline` |
| `app.send_reminders()` | every 15 min | users whose local time just passed `reminder_time` (within the last 15 min) and haven't checked in today → reminder; users within 2h of yesterday's deadline with yesterday pending → final warning. Track last sent per user/day to avoid duplicates (`notify_prefs->'last_reminder_date'` or a small table) |
| `app.resolve_stale_sos()` | every 15 min | outcome `abandoned` after 2h |
| `app.season_rollover()` | every hour at :15 | per group, if group-local date is past `ends_on`: snapshot results, badges, reset coward/rerolls, delete proof objects for that season (via `storage.objects` delete or Edge Function), create next season, push |
| `app.recompute_all_scores()` | daily 00:30 Darwin | recompute `score_30d` for everyone (the 30-day window slides even without new check-ins) + refresh push |

### 18.3 Push delivery (free)
- Any code that wants to notify inserts into `notification_outbox`.
- A **Supabase Database Webhook** (uses `pg_net`) on `insert` into `notification_outbox` calls the Edge Function **`send-push`** (batching: the function also sweeps any unsent rows).
- `send-push` (Deno/TypeScript):
  1. Loads unsent rows (limit 100), joins `device_tokens`.
  2. Gets an OAuth2 access token for **FCM HTTP v1** by signing a JWT with the Firebase **service account** key (stored as Supabase secret `FCM_SERVICE_ACCOUNT_JSON`; cache token ~55 min).
  3. Sends `POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`:
     - `kind = 'visible'` → `notification` + `android.notification.channel_id` + `data` (deep link).
     - `kind = 'data'` → data-only message, `android.priority = 'high'`, `collapse_key`.
  4. Marks `sent_at` or `error`; deletes tokens that FCM reports as `UNREGISTERED`.
- Firebase project stays on the **free Spark plan** and is used **only** for FCM (+ optionally App Distribution).

### 18.4 Realtime
Enable Supabase Realtime on: `sos_responses`, `sos_events`, `mystery_boxes`, `group_events`, `checkins` (for the in-app group strip). Client subscribes filtered by `group_id`.

---

## 19. Client architecture & project structure

### Stack
- **React Native + Expo** (TypeScript, strict), **expo-router**, **Expo dev build** (`expo-dev-client`) — not Expo Go (native modules).
- `@supabase/supabase-js` with session persisted in AsyncStorage (must be readable from the widget headless task — same JS bundle).
- Auth: `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken({ provider: 'google', token })`. (Google Cloud OAuth client IDs are free.)
- Push: `@react-native-firebase/app` + `@react-native-firebase/messaging` (config plugin, `google-services.json`).
- Widget: `react-native-android-widget` (config plugin).
- Data fetching/cache: `@tanstack/react-query`.
- Local state: `zustand` (small).
- Animation/feel: `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, `expo-audio`.
- Images: `expo-image-picker` + `expo-image-manipulator` (proof compression).
- Fonts: `expo-font`.
- Tests: `jest` + `@testing-library/react-native`; SQL tests via `supabase test db` (pgTAP).

### Structure
```
lockinin/
├─ app/                         # expo-router screens (§14)
│  ├─ (tabs)/index.tsx          # Home
│  ├─ (tabs)/leaderboard.tsx
│  ├─ (tabs)/votes.tsx
│  ├─ (tabs)/history.tsx
│  ├─ (tabs)/profile.tsx
│  ├─ onboarding/…
│  ├─ box/[id].tsx
│  ├─ sos/[id].tsx, sos/[id]/respond.tsx
│  ├─ loot.tsx, shame.tsx, settings.tsx, season/[id].tsx, profile/[uid].tsx
├─ src/
│  ├─ lib/supabase.ts, lib/push.ts, lib/deeplinks.ts, lib/offlineQueue.ts
│  ├─ features/{checkin,scoring,boxes,loot,sos,leaderboard,seasons,badges}/…
│  ├─ shared/scoring.ts          # TS mirror of scoring (UI previews only)
│  ├─ shared/avatar.ts           # resolveAvatarLayers()
│  ├─ shared/forbiddenWords.ts
│  ├─ shared/constants.ts        # §20
│  ├─ ui/                        # pixel UI kit: PixelButton, PixelCard, RarityBadge, FlameIcon, XPBar…
│  └─ widget/
│     ├─ LeaderboardWidget.tsx
│     ├─ MiniWidget.tsx
│     ├─ widgetTaskHandler.ts    # WIDGET_ADDED/UPDATE/RESIZED/CLICK
│     ├─ snapshot.ts             # types + fetch + cache
│     └─ refresh.ts              # requestWidgetUpdate helpers
├─ assets/pixel/… + manifest.json, assets/fonts/, assets/sfx/, assets/LICENSES.md
├─ scripts/compose-avatars.ts, scripts/gen-placeholder-art.ts
├─ fixtures/scoring/*.json       # shared by SQL + TS tests
├─ supabase/
│  ├─ migrations/*.sql
│  ├─ functions/send-push/index.ts
│  ├─ seed.sql                   # modifiers + global loot pool (§23)
│  └─ tests/*.sql                # pgTAP
├─ index.ts                      # registers expo-router entry + widget task handler + FCM background handler
├─ app.config.ts                 # plugins: widget, firebase, google-signin; scheme lockinin
├─ CLAUDE.md
└─ SPEC.md
```

---

## 20. Tunable constants

Keep in `src/shared/constants.ts` **and** an SQL `app.config` function/table so both sides agree.

| Constant | Default |
|---|---|
| `CHECKIN_OPENS_AT` | `17:00` local |
| `UNDO_WINDOW_MINUTES` | 5 |
| `BASE_POINTS` | 10 |
| `STREAK_BONUS_CAP_DAYS` | 60 |
| `STREAK_BONUS_DIVISOR` | 6 |
| `MISSED_POINTS` | −5 |
| `SCORE_WINDOW_DAYS` | 30 |
| `FAILED_FORFEIT_SEASON_PENALTY` | −50 |
| `FREEZE_TOKENS_PER_MONTH` | 2 |
| `VACATION_MAX_DAYS_PER_30` | 10 |
| `BOX_OPEN_DEADLINE_HOURS` | 24 |
| `BOX_PROOF_DEADLINE_HOURS` | 24 |
| `BOX_AUTO_CONFIRM_HOURS` | 24 |
| `WILDCARD_WINDOW_HOURS` | 12 |
| `LEGENDARY_WILDCARD_CHANCE` | 0.25 |
| `REROLLS_PER_SEASON` | 1 |
| `COWARD_AVATAR_DAYS` | 7 |
| `SOS_DURATION_MINUTES` | 10 |
| `SOS_MAX_PER_DAY` | 3 |
| `SOS_WINGMAN_MINUTES` | 5 |
| `WIDGET_CONFIRM_SECONDS` | 5 |
| `WIDGET_STALE_HOURS` | 2 |

---

## 21. Build milestones (do in order; each ends with a working, testable app)

**M0 — Foundations**
- Expo TS app with expo-router, dev build running on a physical Android device.
- Supabase project (free) + local dev via Supabase CLI (Docker). Initial migration with enums + `profiles`.
- Google sign-in end-to-end. Pixel UI kit skeleton, fonts, palette. Placeholder art generator.

**M1 — Groups & check-ins**
- `groups`, `group_members`, `checkins`, `checkin_notes`, RLS, RPCs `create_group`, `join_group`, `accept_pact`, `check_in`.
- Onboarding flow, Home with check-in card, History calendar. Transition rules + window rules tested.

**M2 — Scoring, stats & leaderboard**
- `user_stats`, `recompute_user_stats`, fixtures (§7.6) passing in **both** SQL and TS.
- `finalize_missed_days` cron (without boxes yet — just `missed`), freeze tokens, vacations.
- Leaderboard screen (3 tabs), ranks, flames, XP bar, rival callout.

**M3 — Widget (the centrepiece)**
- `get_widget_snapshot` RPC; local snapshot cache.
- LeaderboardWidget + MiniWidget rendering from cache with all states (§12.2–12.4) — build a **debug screen** in-app that cycles fake snapshots through every state so the widget can be visually verified.
- Widget check-in with two-step confirm, offline queue.
- Firebase (Spark) project for FCM, `device_tokens`, `notification_outbox`, `send-push` Edge Function, DB webhook; `group_updated` data messages refresh every member's widget within seconds.

**M4 — Notifications**
- Channels, reminders + final-warning cron, all event notifications (§13), settings toggles, deep links.

**M5 — Mystery Box & loot**
- Box tables, odds, `open_box`, reveal animation, proof upload + compression, voting, resubmit, auto-open, auto-confirm, failure penalties, clown/chicken/jail avatar states, reroll, wildcard, spectating, Wall of Shame.
- Loot pool seed + submissions + voting + hidden Epic/Legendary view.

**M6 — SOS**
- `start_sos` / `respond_sos` / `resolve_sos`, push, realtime feed, requester & responder screens, breathing animation, challenge cards, solo reset, widget banner.

**M7 — Seasons, badges, polish**
- Season rollover job, Season Wrap screen, all badges, rank-up celebrations, sound effects, haptics, empty states, error states.

**M8 — Hardening & release**
- Timezone/travel tests, offline tests, RLS tests (a non-member can read nothing), forbidden-word scan test.
- Build release APK (local Gradle build), publish via GitHub Releases (or Firebase App Distribution). Write `docs/INSTALL.md` for friends (enable "install unknown apps", add widget).

---

## 22. Edge cases & acceptance tests (must all pass)

1. Check in clean for today at 16:59 local → rejected ("opens at 5pm"); at 17:00 → accepted.
2. Check in for yesterday at 23:58 local today → accepted. At 00:01 the next day → rejected (finalised).
3. Clean → Slipped same window → allowed; streak and points recompute; today's bonus also recomputes if yesterday changed.
4. Slipped → Clean after 6 minutes → rejected; within 5 minutes → allowed (undo).
5. Missed day: streak resets, −5 applied, box created, clown state on widget for all members within ~1 minute (push).
6. User with owed box tries to check in (app or widget) → blocked with box prompt.
7. Box not opened for 24h → auto-opened, rarity +1 tier (Legendary stays Legendary), group notified.
8. Proof: 2 voters, 1 confirm & 0 reject → confirmed. 1 confirm & 1 reject → rejected (needs confirms > rejects) → resubmit allowed once; second rejection → failed (−50 season points, coward badge, chicken avatar 7 days).
9. Proof with no votes after 24h → auto-confirmed.
10. Reroll never decreases rarity; only once per season.
11. Freeze token auto-used on a missed day when available; month change restores 2; tokens don't roll over.
12. Vacation days don't break streak and don't create boxes; can't schedule vacation starting today.
13. Timezone change Darwin → Dili (UTC+9): no double-finalisation, no lost day; finaliser skips for 24h after the change.
14. New member who joins mid-month: no missed days before `first_eligible_date`.
15. Widget renders correctly with: no network, stale snapshot, signed out, owed box, active SOS, all three members checked in, nobody checked in.
16. Widget two-step confirm: single tap doesn't check in; second tap within 5s does; after 5s it reverts.
17. Offline widget check-in → "Queued" → syncs on reconnect; if the window expired meanwhile, the server rejects and the app explains it.
18. SOS: push arrives on other phones; responses appear live; first responder within 5 min gets wingman; 4th SOS in a day is refused (solo reset offered); SOS gives no points.
19. Forbidden-word scan test passes; loot submission containing a forbidden word is rejected server-side.
20. RLS: a user from another group (create a second test group) cannot read any rows or proof images; nobody but the author can read `checkin_notes`.
21. Season rollover: results snapshot correct, champion/podium badges granted, coward badges cleared, proof images deleted, new season active, widget label updates.
22. Scoring fixtures in §7.6 produce identical results in SQL and TS.

---

## 23. Seed loot pool (`supabase/seed.sql`, `group_id = null`, `status = 'approved'`)

All captions are original and must pass the forbidden-word check.

### Common — `story`, photo prompt mostly "any selfie"
| Caption | Photo prompt |
|---|---|
| Just found out I'm allergic to productivity. Thoughts and prayers appreciated 🙏 | Any selfie, looking tired |
| Do you ever just stare at a wall and think about soup | Selfie staring blankly at a wall |
| The barista spelled my name right today and honestly I teared up 🥹 | Selfie holding any drink |
| Hot take: I still can't fold a fitted sheet and I've made peace with it | Selfie with a messy bed |
| Not to brag but I drank 3 glasses of water today. Hydration king 👑💧 | Selfie holding a glass of water like a trophy |
| Me after one (1) push-up | Selfie lying on the floor |
| Main character energy, side character results | Dramatic selfie looking into the distance |
| Currently accepting applications for someone to tell me I'm doing great | Selfie with a hopeful face |
| My toxic trait is thinking I can finish a whole series in one night | Selfie in bed with a remote/phone |
| Daily reminder that I can't whistle and I've accepted it | Selfie attempting to whistle |

### Rare — `story`, specific photo
| Caption | Photo prompt |
|---|---|
| Finally found someone who actually listens 🌳❤️ | Hugging a tree |
| Met my soulmate today. His name is Gary 🐟 | Holding a whole fish (supermarket counts) |
| Bulking season update: emotionally 💪 | Gym mirror selfie flexing absolutely nothing |
| Not me crying to Taylor Swift in the Coles carpark again | Sad face in your parked car |
| Me and my new best friend. We don't talk much but he gets me 🦆 | Selfie with a duck/bird/pigeon in the background |
| Living my best life 🛒✨ | Riding (or pretending to ride) a shopping trolley |
| Plot twist: I'm the problem | Pointing at yourself in a mirror |
| Unlocked a new level of peace 🧘 | Meditating pose in a ridiculous location (laundry, car park) |
| Date night with my one true love 🍕 | Candle-lit dinner for one with fast food |
| Contemplating my life choices in the cereal aisle | Selfie in a supermarket cereal aisle |

### Epic — `feed`, staged photo, stays up 48h
| Caption | Photo prompt |
|---|---|
| Some people chase money. I chase the feeling of a fresh pair of socks. Grateful. 🧦✨ #Blessed #SockJourney | Staring out a window holding a mug, socks visible |
| I got rejected 47 times today. By a vending machine. Here's what it taught me about leadership 🧵👇 | Dead-serious headshot in a collared shirt |
| Sausage sizzle is my love language and I'm done hiding it 🌭 | At a Bunnings snag (or holding a sausage in bread) |
| Starting my journey as a wellness influencer. Use code JASON10 for 10% off nothing 💅 | Mirror selfie with a ring light / phone torch |
| Hard work. Dedication. Mostly snacks. 🏆 | Posing with a "trophy" made of snack packets |
| They said I couldn't do it. They were right. But here's a photo anyway 📸 | Victory pose somewhere completely ordinary |
| Officially a plant parent. Her name is Brenda and she's already disappointed in me 🪴 | Holding a pot plant like a newborn |
| Manifesting a life where I'm this confident in real situations 🦁 | Power pose on a park bench |

### Legendary — `feed` or `profile_pic`, stays up 7 days
| Caption | Photo prompt | Post type |
|---|---|---|
| I am officially announcing my retirement from being cool. Thank you for the memories 🎤⬇️ | Dramatic black-and-white mic-drop photo | feed |
| Roses are red / my rizz has fled / I've named my pillow Derek / and he's my best friend instead 🛏️ | Cuddling a pillow, eyes closed | feed |
| My new profile picture says everything I can't 🫡 | Photo of you mid-sneeze or mid-blink (pick the worst one) | profile_pic |
| I've decided to become a morning person. Day 1. Send help ☀️😵 | Selfie at sunrise looking destroyed | feed |
| Thank you to everyone who made this possible. Especially me. 🏅 | Wearing a homemade medal, giving a speech face | feed |
| Profile pic chosen by my mates. I have no say in this. ⚖️ | Photo chosen by the other members | profile_pic |

### Modifiers
Seed from §9.6.

---

## 24. Future (not v1)

- iOS: TestFlight + WidgetKit widget (Swift, via `expo-apple-targets`) once there's budget for the Apple Developer Program.
- Multiple groups per user.
- **Ironman training app integration:** keep auth, profiles and groups generic so a future training app (Garmin data, etc.) can live in the **same Supabase project** (the free plan allows only 2 projects) and potentially become one "hub" for the crew.
- Weekly recap push ("Miguel had a perfect week").
- Reactions on check-ins.
- Light theme.
