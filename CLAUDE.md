# Hydrippo — project notes for Claude

Hydrippo is a freemium Android water tracker for SideQuest Studio (owner: Brandon). The mascot is **Drip** the hippo.
Two hooks set it apart: **bottle-first drag logging** (drag the water line on your own bottle) and a **day that ends when you sleep**
(default 3:00 AM, so night-shift drinks count toward the right day).

## Stack
- Plain HTML/CSS/JS in `www/` (no bundler, no framework). Script order: `core.js`, `zip3.js`, `store.js`, `platform.js`, `art.js`, `app.js`.
- Wrapped for Android with **Capacitor 8** (`android/`). App id `com.sidequeststudio.hydrippo`. compileSdk/targetSdk 36, minSdk 26.
- Native plugins are reached through `window.Capacitor.Plugins` in `www/js/platform.js`. Everything degrades gracefully in a plain browser.
- Billing: RevenueCat, entitlement `plus`. Products `hydrippo_plus_yearly` ($9.99/yr, 7-day trial) and `hydrippo_plus_lifetime` ($14.99).
  The RevenueCat Android key in `platform.js` is still `goog_REPLACE_ME`; until it's set the app runs in test mode
  (Plus unlocks free, Testing tools show) and the GitHub release build refuses to run.

## Files that matter
- `www/js/core.js` — pure logic (units, goal math, day boundaries, streaks, insights, reminders, weather, Health Connect plan). Unit-tested.
- `www/js/app.js` — all UI: Today, History, Settings, sheets, onboarding.
- `www/js/platform.js` — native bridges: notifications, purchases, share, widget, Health Connect, weather (api.weather.gov).
- `www/js/art.js` — Drip SVG (moods + 8 looks) and the bottle shapes.
- `store-listing/` — Play listing text, privacy policy, Play Console answers, icon, feature graphic, screenshots.
- `android/app/src/main/java/com/sidequeststudio/hydrippo/` — our native code: `widget/` (home-screen widget + `HydrippoWidget` plugin),
  `health/HealthPlugin.kt` (`HydrippoHealth`, write-only Health Connect), `PrivacyActivity.kt`.
- `docs/PRODUCT_NOTES.md` — why the app exists, free vs Plus, how the code works, roadmap, known limits.
- `tools/` — `privacy_html.py` (builds `www/privacy.html` from the policy), `build_single.py` (one-file browser test build),
  `widget_art.py` (widget Drip images), `store_assets.py` (icons, feature graphic, screenshots).

## Rules that must hold
- All volumes are stored in **ml with 0.01 precision** (`q()`); convert only for display.
- `dayKey` is defined through `dayRange` so they agree on daylight-saving days. Don't change one without the other.
- "Goal reached" uses a 15 ml tolerance (`C.reached`) everywhere.
- Data stays on the phone. No accounts, no ads, no analytics. Health Connect and weather are opt-in and off by default.
- Never commit signing keys, keystore passwords or API secrets. (`android/app/debug.keystore` is the shared test-build key, not a secret.)
- Reminders must stay `isExactNotification: false` (see `platform.js`); the plugin's default opens Android's Alarms screen.
- After editing `store-listing/privacy-policy.md`, run `npm run privacy` so the in-app copy matches (a test checks).

## Testing
- `npm test` — unit + property tests (run with `TZ=America/New_York`, `Europe/London`, `Australia/Sydney`).
- `python3 tests/sim/simulate.py [scenario]` — Playwright simulations of real use with a fake clock
  (week, night, rollover, bottles, undo, reminders, fuzz, bigdata, persist, features, extras). Last full run: 126 checks, 0 failed.

## Status (Sep 29, 2026)
Done: the web app; the Android project with the widget, Health Connect, privacy screen, icons and launch screen;
GitHub Actions builds (every push to `main` posts a test APK as the `test-latest` release).
Left before launch: RevenueCat key, upload key + GitHub secrets, public privacy policy URL, studio support email,
Play Console setup, closed test (12 testers x 14 days for a personal account), then production.

Android builds can't run in the Claude cloud sandbox (Google Maven is blocked there), so they run on GitHub Actions.
Build results (not logs) can be read from the GitHub API; warnings and errors are posted as check-run annotations.
