# MyOrbisAgents Native App — setup & ship checklist

The native iOS + Android apps are a **Capacitor shell** around the live web
dashboard (`app.myorbisagents.com`), plus native **push** and **biometrics**.
Everything codeable is built and committed. This doc is the list of accounts,
keys, and steps needed to actually **build and ship** — the parts that require
your accounts and a Mac-in-the-cloud build (Codemagic), which can't run on the
Linux dev box.

Bundle id: **`com.myorbisagents.app`** · App name: **MyOrbisAgents**

---

## What's already built (in the repo)

| Area | Where |
|---|---|
| Capacitor shell (config → live web app, plugins, allow-list) | `apps/mobile/capacitor.config.ts`, `apps/mobile/package.json` |
| App icon + splash (Orby brand) | `apps/mobile/assets/{icon,splash,splash-dark}.png` |
| Native bootstrap (register push token, notification-tap routing, biometric) | `apps/web/src/lib/native.ts`, `apps/web/src/components/NativeBootstrap.tsx` |
| Companion nav (native hides setup/config, keeps daily surfaces) | `apps/web/src/components/SidebarNav.tsx` |
| Push token backend (`PushDevice` + `/push/register-native` + FCM v1 send) | `prisma/schema.prisma`, `apps/api/src/services/push.service.ts`, `apps/api/src/routes/push.ts` |
| Booking → push trigger (Web Push **and** native) | `apps/api/src/services/appointment.service.ts` |
| Cloud build pipeline (iOS + Android) | `codemagic.yaml` |

Push already fires on the **PWA today** (VAPID is configured). Native delivery
switches on once you complete the Firebase steps below.

---

## Accounts & keys you need to create

### 1. Apple Developer — $99/yr
- Enroll at developer.apple.com. Register the App ID **`com.myorbisagents.app`** with **Push Notifications** capability enabled.
- Create an **App Store Connect API key** (Users & Access → Keys) → note Key ID, Issuer ID, download the `.p8`. Codemagic uses this to sign + upload to TestFlight.
- Create the app record in App Store Connect (name, bundle id). The 12 store screenshots we made drop straight in.

### 2. Google Play — $25 one-time
- Create the app in Play Console (bundle id `com.myorbisagents.app`).
- Create an **upload keystore** (`keytool -genkey -v -keystore upload.jks -alias myorbisagents -keyalg RSA -keysize 2048 -validity 10000`). Keep it safe — you sign every release with it.
- Create a **service account** with Play publishing permission → download its JSON (for Codemagic's Play publishing).

### 3. Firebase project (powers native push on both platforms)
- Create a Firebase project. Add an **Android app** (`com.myorbisagents.app`) → download **`google-services.json`**. Add an **iOS app** (same bundle id) → download **`GoogleService-Info.plist`**.
- Under Firebase → Project settings → **Cloud Messaging**, upload your **APNs auth key** (the `.p8` from step 1, or a dedicated APNs key). This is what lets FCM deliver to iPhones.
- Project settings → Service accounts → **Generate new private key** → this JSON is what the backend uses to *send* pushes.

### 4. Backend: enable native sending
- Paste the Firebase **service-account JSON** (step 3) into `Admin → System Settings` under **`fcm_service_account`** (stored encrypted). Until this is set, native push safely no-ops; the code path is already live.

### 5. Codemagic (the cloud Mac build) — free tier to start
- Sign up, connect this Git repo. Codemagic reads `codemagic.yaml` (two workflows: Android, iOS).
- Add environment variable **groups** exactly as named in `codemagic.yaml`:
  - `firebase`: `GOOGLE_SERVICES_JSON` (base64 of the Android file), `GOOGLE_SERVICE_INFO_PLIST` (base64 of the iOS file).
  - `android_keystore`: `CM_KEYSTORE` (base64 of upload.jks), `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, `CM_KEY_PASSWORD`, `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` (Play service-account JSON).
  - iOS: add an **App Store Connect API key integration** named `MyOrbisAgents ASC key` (paste the `.p8` + Key ID + Issuer ID).

---

## Build & ship flow

1. Push this repo (already committed).
2. In Codemagic, run the **Android** workflow → it runs `npx cap add android`, injects `google-services.json`, builds a signed `.aab`, publishes to Play **internal** testing.
3. Run the **iOS** workflow (mac_mini instance) → `npx cap add ios`, pods, signs, builds `.ipa`, submits to **TestFlight**.
4. Install from Play internal / TestFlight on a real device. Log in (SSO works in-app), grant notifications, then book a test showing with Orby → the phone gets **"Showing booked."**
5. Promote to production listings when happy.

> Icons/splash: run `npx @capacitor/assets generate` in `apps/mobile` (uses `assets/icon.png` + `assets/splash.png`) — or let the first Codemagic build do it. Add `@capacitor/assets` to devDependencies if you generate locally.

---

## What's left after accounts (small, code-side)
- Add the **new-lead** push trigger (mirror the booking trigger on contact-qualified) — one hook, same `sendToTenant` + `sendNativeToTenant` pattern.
- The signature screens from the plan (Catch Ledger, Handoff, Tonight's Five) are separate feature builds in the shared web codebase — they'll appear in both web and app.

Blocking summary: **nothing more from me is required to build** — the app is code-complete for Phase-1. The build itself needs the five accounts above + a Codemagic run.
