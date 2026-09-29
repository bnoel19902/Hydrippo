# Hydrippo — project notes for Claude

Hydrippo is a freemium Android water tracker for SideQuest Studio (owner: Brandon). The mascot is **Drip** the hippo.
Two hooks set it apart: **bottle-first drag logging** (drag the water line on your own bottle) and a **day that ends when you sleep**
(default 3:00 AM, so night-shift drinks count toward the right day).

## Stack
- Plain HTML/CSS/JS in `www/` (no bundler, no framework). Script order: `core.js`, `zip3.js`, `store.js`, `platform.js`, `art.js`, `app.js`.
- Wrapped for Android with **Capacitor 8** (`android/`). App id `com.sidequeststudio.hydrippo`. compileSdk/targetSdk 36, minSdk 26.
- Native plugins are reached through `window.Capacitor.Plugins` in `www/js/platform.js`. Everything degrades gracefully in a plain browser.
- Billing: RevenueCat, entitlement `plus`. Products `hydrippo_plus_yearly` ($9.99/yr, 7-day trial) and `hydrippo_plus_lifetime` ($14.99).
  The RevenueCat Android key in `platform.js` is still `goog_REPLACE_ME`.

## Files that matter
- `www/js/core.js` — pure logic (units, goal math, day boundaries, streaks, insights, reminders, weather, Health Connect plan). Unit-tested.
- `www/js/app.js` — all UI: Today, History, Settings, sheets, onboarding.
- `www/js/platform.js` — native bridges: notifications, purchases, share, widget, Health Connect, weather (api.weather.gov).
- `www/js/art.js` — Drip SVG (moods + 8 looks) and the bottle shapes.
- `store-listing/` — Play listing text, privacy policy, Play Console answers, icon, feature graphic, screenshots.
- `GUS_HANDOFF.md` — older, longer build notes (written when Gus was going to do the native work). Still accurate on details.

## Rules that must hold
- All volumes are stored in **ml with 0.01 precision** (`q()`); convert only for display.
- `dayKey` is defined through `dayRange` so they agree on daylight-saving days. Don't change one without the other.
- "Goal reached" uses a 15 ml tolerance (`C.reached`) everywhere.
- Data stays on the phone. No accounts, no ads, no analytics. Health Connect and weather are opt-in and off by default.
- Never commit signing keys, keystore passwords or API secrets.

## Testing
- `npm test` — unit + property tests (run with `TZ=America/New_York`, `Europe/London`, `Australia/Sydney`).
- `python3 tests/sim/simulate.py [scenario]` — Playwright simulations of real use with a fake clock
  (week, night, rollover, bottles, undo, reminders, fuzz, bigdata, persist, features, extras). Last full run: 126 checks, 0 failed.

## Status (Sep 28, 2026)
Done: the whole web app, including weather boost, Health Connect UI, share card, Drip looks, streak crown, backups, insights.
In progress: native Android side —
1. Kotlin setup in `android/` (Kotlin Gradle plugin added; app module still needs `kotlin-android`, Java/Kotlin 21 targets, dependencies).
2. Home-screen widget: `AppWidgetProvider` + Capacitor plugin `HydrippoWidget` with `update(summary)` and `takePending()` → `{logs:[{ts,ml}]}`.
3. Health Connect: Capacitor plugin `HydrippoHealth` with `availability()`, `requestPermission()`, `writeHydration({records:[{id,ts,ml}]})`,
   `deleteHydration({ids})`; `androidx.health.connect:connect-client:1.1.0`; rationale activity + `VIEW_PERMISSION_USAGE` alias.
4. GitHub Actions workflow to build a debug APK on every push and a signed release AAB from secrets.
5. Launch runbook, privacy policy updates for weather and Health Connect, final test pass.

Android builds can't run in the Claude cloud sandbox (Google Maven is blocked there), so they run on GitHub Actions.
