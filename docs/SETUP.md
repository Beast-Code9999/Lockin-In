# Getting Lockin' In running

Everything here is free (no credit card). Do the steps in order. Sections 0–2 get the app on your phone today without any accounts. Section 3 is the real setup your mates will need.

## 0. One-time Mac setup
1. Make sure **Docker Desktop** is installed and running. It hosts the local database.
2. Point the build at Android Studio's Java and the Android tools. Add these lines to `~/.zshrc`, then open a new terminal:
   ```bash
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   ```
3. In the project folder: `npm install` (already done in this checkout).

## 1. Get your phone ready (once)
1. **Settings → About phone** → tap **Build number** 7 times. This unlocks Developer options.
2. **Settings → System → Developer options** → turn on **USB debugging**.
3. Plug the phone into the Mac and tap **Allow** on the phone.
4. Run `adb devices`. Your phone should be listed as `device`.

## 2. Try it today: local database, no accounts (~10 min)
```bash
npm run db:start                    # starts the local database (Docker must be running)
adb reverse tcp:55321 tcp:55321     # lets the phone reach that database; redo after re-plugging
npx expo run:android                # builds, installs and opens the app on your phone
```
`.env` already points at the local database. On the phone, tap **Let's lock in**, then a **Dev shortcut** player (Jason / Miguel / Ken).

Next time there's no rebuild. Run `npm run db:start`, then the `adb reverse` line, then `npm start`, and open Lockin' In on the phone.

## 3. Real setup: Google sign-in on a hosted database (~30 min, once)

### 3a. Supabase (free plan)
1. Go to supabase.com → **New project**. Name it `lockinin`, set a database password (save it somewhere), choose region **Sydney**, and pick the **Free** plan.
2. Copy the **Project URL** (`https://<ref>.supabase.co`) and the **publishable key** (`sb_publishable_…`, or the legacy `anon` key). Both are under **Connect** or **Project Settings → API Keys**.
3. Push the database schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>    # <ref> = the part before .supabase.co; asks for the DB password
   npx supabase db push
   ```
4. **Authentication → Sign In / Providers → Email**: turn it **off**. The app only uses Google, and this stops strangers creating accounts.

### 3b. Google sign-in (Google Cloud, free)
1. Go to console.cloud.google.com and create a project called **Lockin In**.
2. Open **Google Auth Platform** (on older consoles: **APIs & Services → OAuth consent screen**):
   - app name **Lockin' In**, with your email as the support email
   - audience **External**, left in **Testing**
   - under **Test users**, add all three Gmail addresses
3. **Clients → Create client → Web application**:
   - authorised redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
   - copy the **Client ID** and **Client secret**
4. **Clients → Create client → Android**:
   - package name `com.jasonlay.lockinin`
   - SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

   That SHA-1 is the standard Expo/React Native debug key, the same for everyone. The release build in M8 will need a second Android client.
5. Back in **Supabase → Authentication → Sign In / Providers → Google**:
   - turn it **on**
   - **Client IDs:** `<web client id>,<android client id>`
   - **Client Secret:** the Web client's secret
   - save. If sign-in later fails with a *nonce* error, turn on **Skip nonce check**.

### 3c. Point the app at it
Replace the values in `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>
```
Then restart the bundler with a clean cache. The installed app picks up the change, with no rebuild needed:
```bash
npx expo start --dev-client --clear
```
On the phone: **Let's lock in → Sign in with Google**. You'll land on Home with your first name.

## Good to know
- **This is a dev build.** The app loads its code from your Mac, so the bundler (`npm start`) must be running and the phone must reach the Mac (USB, or the same Wi-Fi). A standalone APK your mates can install comes in M8.
- **Checks:** `npm run verify` (typecheck + lint + Jest) and `npm run db:test` (database tests; needs `npm run db:start`).
- **Ports:** the local database uses ports 553xx (API 55321, Studio 55323) so it can run alongside other local Supabase projects.
- **After schema changes:** `npm run db:reset` re-applies migrations locally, and `npm run db:types` regenerates the TypeScript types.

## 4. 🖐 Firebase, for push (free Spark plan, FCM only)
1. At **console.firebase.google.com**, add Firebase to the **Lockin In** Google Cloud project. Turn Google Analytics **off** and stay on **Spark**.
2. **Add app → Android:** package `com.jasonlay.lockinin`, plus the debug SHA-1 from section 3b. Download **`google-services.json`** into the repo root (it's gitignored). Skip the SDK steps.
3. Under **⚙️ Project settings → Cloud Messaging**, check that **Firebase Cloud Messaging API (V1)** is **Enabled**.
4. Under **⚙️ Project settings → Service accounts → Generate new private key**, save the file as **`service-account.json`** in the repo root (gitignored, a real secret).
5. **Grant the service account permission to send.** Go to **console.cloud.google.com/iam-admin/iam?project=<firebase-project-id> → Grant access**. Principal: `firebase-adminsdk-fbsvc@<firebase-project-id>.iam.gserviceaccount.com`. Role: **Firebase Cloud Messaging API Admin**. Without this, FCM answers 403.
6. Store the key and deploy:
   ```bash
   npx supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
   npx supabase functions deploy send-push --no-verify-jwt --use-api
   npx supabase db push
   ```

### Testing push locally
```bash
python3 -c "import json;print(\"FCM_SERVICE_ACCOUNT_JSON='\"+json.dumps(json.load(open('service-account.json')),separators=(',',':'))+\"'\")" > supabase/functions/.env.local
npx supabase functions serve send-push --no-verify-jwt --env-file supabase/functions/.env.local
# point the local DB's trigger at the local function:
docker exec supabase_db_lockinin psql -U postgres -c "update app.settings set value='http://supabase_kong_lockinin:8000/functions/v1/send-push' where key='push_function_url'"
```

## Widget
- Long-press the home screen → **Widgets** → **Lockin' In** → drag **crew board** (4×2) or **me** (2×1).
- In dev builds, **Profile → Widgets (dev)** previews every state and can pin any scenario onto the real widget.

## Later milestones will ask for
- **M4:** nothing new; notification channels and reminders use the same FCM setup.
