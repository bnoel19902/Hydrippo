# Hydrippo: product and technical notes

Background, product decisions and how the code fits together. For the step-by-step launch plan, see the launch runbook Claude keeps with Brandon; for day-to-day rules, see `CLAUDE.md`.

## 1. Why this app

The research behind the pick.

- **Health & Fitness is growing.** In-app purchase revenue in the category hit a record $4.5B in 2025, up 13% (Sensor Tower, State of Mobile 2026).
- **Simple water trackers make real money when they have personality and fair prices.** Waterllama, a simple water app with cute characters, earns roughly $1M a year (Retention.blog, citing Appfigures). It sells a cheap lifetime unlock, and its reviews praise that pricing.
- **Characters sell wellness on Android.** Finch, a self-care app built around a pet bird, reached about $30M a year with no VC money and makes over $1M a month on Android (Sparrow Apps). Plant Nanny has used the same idea for years, with plants that you "water" by drinking.
- **The big Play Store water apps are generic and ad-supported** (for example Leap Fitness "Drink Water Reminder", Waterful, Hydro Coach). SideQuest's no-ads promise is a real difference here.
- **People push back on pricey subscriptions for a water tracker.** One App Store review of a $60/year water app says $20/year is the most they'd pay. Our $9.99/year sits well under that.
- **Why not fasting:** intermittent fasting is a narrower weight-loss audience, and it's held by big funded apps (Zero, Fastic, Simple, BodyFast) that are adding AI meal logging. Water is for everyone and the core action is one gesture.
- **Why these two hooks:** mascot water trackers exploded after the viral videos (Plant Nanny, Waterllama, Dewey, Sipling and many new ones). Almost all of them log with "+ cup" buttons. Logging from your real bottle, plus a day that follows your sleep, is what makes Hydrippo different. Night-shift users are asking for this (for example a Samsung Community thread titled "Water tracker for night shift"), and it fits warehouse, nursing, factory and driving shifts.

---

## 2. The product

### The two hooks

1. **Your bottle is the button.** Pick a tumbler, sport bottle, gallon jug, disposable bottle or glass. The Today screen draws it with a scale in oz or ml. Press on the water line and slide it down; the amount shows live (−12 oz), and letting go logs it with an Undo. "Refill" tops it back up and counts refills. "Finished it" logs whatever is left.
2. **Your day ends when you sleep.** Onboarding asks when you wake up and go to sleep. The day rolls over halfway through your sleep (day schedule: 3:00 AM; night shift sleeping 7:30 AM to 3 PM: 11:30 AM). Reminders stay inside awake hours. It's editable in Settings.

### Drip the hippo

Drip sits in a pond that is today's progress. Under 25% he's thirsty (droopy eyes, open mouth, sweat drop). From 75% he smiles. At 100% he's soaking up to his nostrils with happy eyes and bubbles. All original SVG in `www/js/art.js`. Plus users can dress him in a cap, lily, shades, hard hat, headphones, beanie or sweatband; anyone with a 30-day streak earns the crown.

### Free vs Plus

| Feature | Free | Plus |
|---|---|---|
| Log by sliding the line on your bottle, refills, "Finished it" | ✓ | ✓ |
| Edit any drink, add a drink you forgot (last 7 days) | ✓ | ✓ |
| Custom quick buttons (drink + size) | ✓ | ✓ |
| Bottles | 2 | Unlimited |
| Drinks | Water, coffee, tea, soda | All 16 + caffeine tally |
| Goal calculator (weight, activity, heat) and one-tap hot-day boost | ✓ | ✓ |
| Automatic hot-day boost from the forecast (US ZIP code, no GPS) | ✓ | ✓ |
| Shift-friendly day end | ✓ | ✓ |
| Reminders in awake hours, wait after a drink, quiet once the goal is hit | ✓ | ✓ |
| "Reminders not showing up?" fixer | ✓ | ✓ |
| Shift schedule (different hours per weekday) | | ✓ |
| History: every day since your first drink, 7-day chart, streaks | ✓ | ✓ |
| 30-day chart, Insights, CSV export | | ✓ |
| Backup and restore | ✓ | ✓ |
| Show or hide Drip | ✓ | ✓ |
| Share your streak as a picture; the crown for a 30-day streak | ✓ | ✓ |
| Drip looks (7) | | ✓ |
| Home-screen widget with one-tap logging | ✓ | ✓ |
| Health Connect sync (write-only) | ✓ | ✓ |
| Ads or pop-up upgrade screens | Never | Never |

### Pricing and product IDs

| Product | Play Console type | ID | Price |
|---|---|---|---|
| Plus yearly | Subscription, base plan `yearly` (auto-renewing, 1 year), offer `trial7` (7-day free trial, new customers only) | `hydrippo_plus_yearly` | $9.99/year |
| Plus lifetime | One-time product (in-app product) | `hydrippo_plus_lifetime` | $14.99 |

Both unlock the RevenueCat entitlement **`plus`**. The paywall shows Google Play's localized prices from RevenueCat offerings and falls back to the prices above. If the prices change, update the fallback in `openPaywall()` (`app.js`) and `store-listing/listing.md`.

---

## 3. How the web app works

- **One state object**, saved on every change (`commit()` in `app.js`) and flushed immediately when the app goes to the background. Volumes are stored in **millilitres to 0.01 ml** (never rounded to whole ml, which caused drift); oz/ml is display only. Schema version `v: 1`; `migrate()` fills in missing keys, so add new fields there.
- **Day boundary:** `core.dayKey(ts, dayEndMin)` is defined through `core.dayRange()`, so the two always agree, including daylight-saving days. Every total, streak and chart goes through it. Property tests check every 7 minutes across DST changes in three time zones.
- **Goal reached:** use `core.reached(total, goal)` everywhere (within 15 ml counts), so the app never says "behind" while the screen shows "104 / 104 oz". Today's goal is `goalFor(key)` = base goal + any hot-day boost.
- **Reminders:** `planReminders()` builds the next 7 days of reminder times with `core.nextReminder()` and hands them to `platform.scheduleReminders()`, which cancels and reschedules local notifications. It re-runs 1.5 s after any change. Reminders skip the rest of the day once the goal is met, and (default on, free) the next reminder waits one interval after the last drink. All of this is pre-scheduled, so no background job is needed.
- **Plus gate:** `plusGate()` opens the paywall. On Android, `platform.checkPlus()` asks RevenueCat at startup and overwrites the saved flag, so Google Play is the source of truth.
- **Prototype-only bits:** "Testing tools" in Settings and test-mode Plus only show when `DEBUG` is true, which is automatic in a browser and off in the native app. Set `window.HYD_DEBUG = true` for a debug build.
- **Undo:** snapshots the whole state before each change and covers exactly one action (any later change clears it). That's cheap at this size.
- **Data size:** two years of heavy use is about 6,200 drinks and 650 KB of saved data; screens still render in about 35 ms. Past about 3 years, consider moving the drink log to SQLite (for example `@capacitor-community/sqlite`) and keeping settings in Preferences.
- **Backups:** Settings › Your data saves a JSON backup (`{ app: "hydrippo", version, savedAt, state }`) through the share sheet, and restores from a file picker. Plus status is never restored from a file; it always comes from Google Play.

### Running the simulator

```bash
pip install playwright && python3 -m playwright install chromium   # once
python3 tests/sim/simulate.py            # all scenarios, about 2 minutes
python3 tests/sim/simulate.py fuzz       # just the random-tapping runs
```

It drives the real `www/` app in a phone-sized headless Chromium with a fake clock: a day-shift week, a night shift across midnight and the November daylight-saving night, the day rolling over while the app is open, metric units and bottles, undo chains, reminders, two years of data, save-on-close, features, extras (weather, crown, share card, Health Connect switch), and three runs of 450 random actions with data checks after every step. Run it after any change to `www/js`.

---

## 4. Name and legal

- **"Sippo" was Brandon's first choice but is taken.** SIPPO is a registered US trademark (Reg. No. 5096572, Intelligi LLC, 2016) covering "software for tracking a user's fluid intake". It's also used for a drink-menu app and a liquor brand. Don't use it, even as the mascot's name.
- **"Hydrippo"**: searches found no apps and no US trademarks under that name, and no close matches in the water-tracker space. That's a search, not legal clearance. Before spending money on marketing:
  1. Search USPTO's trademark search for HYDRIPPO and close spellings in classes 9 (software) and 42.
  2. Check that hydrippo.com (or .app) and social handles are free.
  3. Consider filing a US trademark application for the name in class 9. It's a few hundred dollars and protects the brand if it takes off.
- Drip is an original character. Keep it that way: no references to famous hippos (Moo Deng, Gloria from Madagascar, Hungry Hungry Hippos) in art, names or ads.

---

## 5. The Android side (`android/`)

- **Capacitor 8**, compileSdk/targetSdk 36, minSdk 26 (Health Connect needs 26). Kotlin for our own code.
- **Version:** `versionName` comes from `package.json`; `versionCode` is the GitHub build number.
- **Our plugins** are registered in `MainActivity.java`:
  - `widget/WidgetPlugin.kt` (`HydrippoWidget`): `update(summary)` saves today's total, goal, day boundaries, units and the button size; `takePending()` returns and clears drinks logged from the widget.
  - `widget/HydrippoWidgetProvider.kt`: draws the widget (compact 2x2 and wide layouts, picked by size), Drip's mood, the progress bar and the "+ 8 oz" button. `WidgetStore.kt` mirrors `core.js` day math so the widget starts a new day on its own at the day-end time. `WidgetActionReceiver.kt` (not exported) handles the button and the rollover alarm.
  - `health/HealthPlugin.kt` (`HydrippoHealth`): Health Connect, write-only hydration. Records use `clientRecordId = "hydrippo-" + drink id`, so edits replace and deletes remove. What to send is decided by `core.hcPlan()` (last 14 days).
  - `PrivacyActivity.kt`: shows `www/privacy.html`. Health Connect opens it from its permission screens (`ACTION_SHOW_PERMISSIONS_RATIONALE` on Android 13 and older, the `VIEW_PERMISSION_USAGE` alias on 14+).
- **Reminders** are pre-scheduled local notifications with `isExactNotification: false`. Without that, the notifications plugin opens Android's "Alarms & reminders" screen on every schedule. The exact-alarm permission is removed from the manifest.
- **Widget art** (`res/drawable-*nodpi/drip_*.png`, light and dark) is rendered from the real `art.js` by `tools/widget_art.py`.
- **Builds run on GitHub Actions** (`.github/workflows/android.yml`): tests, then a test APK posted as the "Latest test build" release on every push to `main`; a signed `.aab` when the workflow is run by hand with "release" checked.
- **Test builds** are signed with the checked-in `android/app/debug.keystore`, so each one installs over the last and keeps your data. It can't publish to Play.

---

## 6. Roadmap after v1

In rough order of value:

1. **Wear OS tile** with the + button (Galaxy Watch users). Needs a real watch to test.
2. **Seasonal pond themes** (Plus) and a monthly limited look for retention.
3. **Time markers on the bottle** ("by 10 AM", "by 2 PM") as a Plus bottle style.
4. **Drinking with friends** (a small team streak). Needs a server and accounts, which breaks the "no account, data stays on your phone" promise, so it's on hold until Brandon decides it's worth that. The share card covers the social side for now.
5. **SideQuest pass:** if the studio launches a subscription, Hydrippo Plus can be one of its entitlements in RevenueCat.
6. **iOS** later: the same `www/` wraps with Capacitor for iPhone (Health Connect becomes HealthKit).

## 7. Known limits

- In a browser, reminders only show as in-app banners while the page is open. Real notifications need the Android app.
- The water level is linear in height. Real tumblers taper, so readings near the bottom of a tapered tumbler run slightly high.
- Deleting a drink from the list doesn't put the water back in the bottle. Undo does.
- Drinks logged on the widget reach the app's log (and Health Connect) the next time the app opens. Until then, reminders already scheduled for today still fire.
- **Samsung Health doesn't currently read water from Health Connect.** Samsung removed hydration from its Health Connect sync in Samsung Health 6.30 (late 2025) and, per its community forum, hasn't restored it as of September 2026. Hydrippo's sync still works for apps that read hydration; don't promise Samsung Health in the listing.
- The hot-day boost is US-only (it uses the National Weather Service).

## 8. Design notes

- **Palette:** river blue `#2BA6CD` (water), deep river `#1A7EA2` (buttons), hippo lilac `#9486AD`, cheek pink `#F2A1B5`, mist background `#E6F1F2`, ink `#15303A`. Dark theme tokens are in `app.css`. Keep all colors as tokens.
- **Type:** Sniglet (display: wordmark, headings, big numbers) and Atkinson Hyperlegible Next (everything else). Atkinson has slashed zeros by design; it's built for low-vision readability.
- **Voice:** short, friendly, plain. Never guilt ("Drip will die"); Drip only gets happier.

---

## Sources

- Sensor Tower, "Health and Fitness Apps See Surging Revenue Fueled by AI": https://sensortower.com/blog/health-and-fitness-apps-ai
- Retention.Blog, "Solve a single problem" (Waterllama): https://www.retention.blog/p/solve-a-single-problem
- Sparrow Apps, "Finch: How a Self-Care App Hit $30M ARR Without VC Money": https://blog.sparrowapps.io/p/finch-how-a-self-care-app-hit-30m-arr-without-vc-money
- Plant Nanny on Google Play: https://play.google.com/store/apps/details?id=com.fourdesire.plantnanny2
- My Water on the App Store (reviews on pricing): https://apps.apple.com/us/app/my-water-daily-water-tracker/id1395390713
- HealthyOne, "Best Intermittent Fasting Apps 2026": https://www.healthyoneapp.com/blog/best-intermittent-fasting-app-2026
- Samsung Community, "Water tracker for night shift": https://us.community.samsung.com/t5/Samsung-Apps-and-Services/Water-tracker-for-night-shift/td-p/3465411
- SIPPO trademark, Reg. No. 5096572: https://trademarks.justia.com/867/10/sippo-86710558.html
- Play Console Help, target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Play Console Help, testing requirements for new personal developer accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Play Console Help, choose a developer account type: https://support.google.com/googleplay/android-developer/answer/13634885
- Play Console Help, health apps declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Play Developer Program Policy (health disclaimer): https://support.google.com/googleplay/android-developer/answer/16933379
- Capacitor Local Notifications: https://capacitorjs.com/docs/apis/local-notifications
