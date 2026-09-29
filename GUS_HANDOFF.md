# Hydrippo: handoff for Gus

**From:** Claude (co-builder), for Brandon at SideQuest Studio
**Date:** September 27, 2026 (updated September 28, 2026: version 0.2)
**Status:** Working web app and prototype are done and tested. The Android build, billing, notifications, widget and Play Store release are yours.

### What changed in 0.2

- **Features that answer competitors' bad reviews** (all free): edit any drink or add one you forgot (any of the last 7 days), custom quick buttons, smart reminder timing on by default, a "Reminders not showing up?" fixer for battery savers, backup and restore, a one-tap hot-day goal boost, full history never locked, a "Show Drip" switch, and a rating request that only appears once, after 5 goal days. Plus gains **Insights**.
- **Bugs found by simulation and fixed:** drinks filed to the wrong day on a spring-forward morning; CSV export of big pours; Today stuck on yesterday after a rollover with a panel open; the pop-up message sliding in off-center; a drink lost if the app is closed within 150 ms; Undo reaching past its own action; rounding drift (50 × 1 oz showed 51 oz); "104 / 104 oz" still showing as behind.
- **Tests:** 20 logic and property tests (`npm test`) plus a usage simulator (`python3 tests/sim/simulate.py`, section 4) that lives through weeks of use and random tapping, 114 checks, all passing.

---

## 0. The short version

Hydrippo is a freemium water tracker with no ads. Its main screen is the user's real bottle: they slide the water line down to where their bottle is now, and the app logs the difference. A hippo named Drip sits in a pond that fills as they drink. The user's "day" ends while they sleep instead of at midnight, so night-shift workers aren't split across two days.

**Already done (in this folder):**
- The full app UI and logic in `www/` (plain HTML, CSS and JavaScript, no framework, no bundler)
- 20 passing logic tests (`npm test`) and a usage simulator with 114 checks (`python3 tests/sim/simulate.py`)
- Code paths for Android storage, reminders, billing (RevenueCat), back button, haptics, CSV export, backups, settings shortcuts, the rating prompt and widget sync. Each is marked `GUS:` where it needs a key, native code or a real-device check.
- App icon, adaptive icon layers, splash screens, notification icon
- Play Store feature graphic, 4 captioned phone screenshots, listing text
- Privacy policy draft and suggested Play Console form answers

**Your job, in order:**
1. Check the developer account type (section 5, step 0). This one can block everything.
2. Wrap `www/` with Capacitor 8 and get it running on a phone (step 1).
3. Icons, splash, edge-to-edge check (steps 2 and 3).
4. Reminders on a real phone (step 4).
5. Billing: Play Console products, RevenueCat, test purchases (step 5).
6. Home-screen widget (step 6).
7. Full test pass on two or more phones (step 7).
8. Play Console setup, closed test with 12 testers for 14 days, then production (steps 8 to 10).

Try the prototype first: open `www/index.html` in Chrome with the phone-size device toolbar, or use Brandon's test link. Settings > Testing tools > "Load a sample week" fills the history.

---

## 1. Why this app

The research behind the pick, so you know what we're competing with.

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

Drip sits in a pond that is today's progress. Under 25% he's thirsty (droopy eyes, open mouth, sweat drop). From 75% he smiles. At 100% he's soaking up to his nostrils with happy eyes and bubbles. All original SVG in `www/js/art.js`. Plus users can give him a cap, a lily or shades.

### Free vs Plus

| Feature | Free | Plus |
|---|---|---|
| Log by sliding the line on your bottle, refills, "Finished it" | ✓ | ✓ |
| Edit any drink, add a drink you forgot (last 7 days) | ✓ | ✓ |
| Custom quick buttons (drink + size) | ✓ | ✓ |
| Bottles | 2 | Unlimited |
| Drinks | Water, coffee, tea, soda | All 16 + caffeine tally |
| Goal calculator (weight, activity, heat) and hot-day boost | ✓ | ✓ |
| Shift-friendly day end | ✓ | ✓ |
| Reminders in awake hours, wait after a drink, quiet once the goal is hit | ✓ | ✓ |
| "Reminders not showing up?" fixer | ✓ | ✓ |
| Shift schedule (different hours per weekday) | | ✓ |
| History: every day since your first drink, 7-day chart, streaks | ✓ | ✓ |
| 30-day chart, Insights, CSV export | | ✓ |
| Backup and restore | ✓ | ✓ |
| Show or hide Drip | ✓ | ✓ |
| Drip accessories | | ✓ |
| Home-screen widget | ✓ | ✓ |
| Ads or pop-up upgrade screens | Never | Never |

### Pricing and product IDs

| Product | Play Console type | ID | Price |
|---|---|---|---|
| Plus yearly | Subscription, base plan `yearly` (auto-renewing, 1 year), offer `trial7` (7-day free trial, new customers only) | `hydrippo_plus_yearly` | $9.99/year |
| Plus lifetime | One-time product (in-app product) | `hydrippo_plus_lifetime` | $14.99 |

Both unlock the RevenueCat entitlement **`plus`**. Brandon may change prices; if he does, update `openPaywall()` in `app.js` (the prices are also shown in `store-listing/listing.md`). Better still, read prices from RevenueCat offerings (`pkg.product.priceString`) so they're localized. That's a good small improvement.

---

## 3. What's in this folder

```
hydrippo/
├── GUS_HANDOFF.md            this file
├── README.md                 quick start
├── package.json              Capacitor 8 + plugins, npm scripts
├── capacitor.config.json     appId com.sidequeststudio.hydrippo, webDir www
├── www/                      the whole app (this becomes the Android WebView content)
│   ├── index.html
│   ├── css/fonts.css         bundled fonts (works offline)
│   ├── css/app.css           design tokens, light + dark themes, all components
│   ├── fonts/                Sniglet + Atkinson Hyperlegible Next (SIL OFL licenses included)
│   └── js/
│       ├── core.js           pure logic: units, goal, day boundary, stats, reminder timing, CSV
│       ├── store.js          storage: Capacitor Preferences on Android, localStorage in browser
│       ├── platform.js       native bridge: billing, notifications, back button, haptics, share, widget
│       ├── art.js            Drip and the bottle shapes (SVG)
│       └── app.js            screens, onboarding, sheets, paywall, gestures
├── tests/core.test.js        node --test: logic tests
├── tests/property.test.js    node --test: day boundaries across daylight saving, reminders, goal, CSV
├── tests/sim/simulate.py     usage simulator: headless phone, fake clock, 10 scenarios + random tapping
├── assets/                   icon.svg, icon-only/foreground/background.png, splash(-dark).png, notification-icon.svg
└── store-listing/            listing.md, privacy-policy.md, play-console-answers.md,
                              play-icon-512.png, feature-graphic.png, screenshots/phone-1..4.png
```

## 4. How the code works

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

It drives the real `www/` app in a phone-sized headless Chromium with a fake clock: a day-shift week, a night shift across midnight and the November daylight-saving night, the day rolling over while the app is open, metric units and bottles, undo chains, reminders, two years of data, save-on-close, the 0.2 features, and three runs of 450 random actions with data checks after every step. Run it after any change to `www/js`.

---

## 5. Build steps

### Step 0: Check the developer account type first

Google's Play Console rules say certain apps must be published from an **Organization** account (which needs a free D-U-N-S number and can take days or weeks to get). Google's wording names "Health apps, such as Medical apps and Human Subjects Research apps". Hydrippo is a **health and fitness** app, not medical, so a personal account should be fine, but some developer blogs report stricter enforcement in 2026. When you create the app in Play Console (the same account as the Dragonwilds Codex), check whether choosing the Health & Fitness category or filling in the Health apps declaration asks for an organization account. If it does, Brandon needs to start the D-U-N-S request for SideQuest Studio right away, because it's the longest wait.

### Step 1: Wrap with Capacitor 8

```bash
npm install
npm test                      # 11 passing
npm run android:add           # creates android/
npm run android:sync
npm run android:open          # opens Android Studio
```

- **Package name:** `com.sidequeststudio.hydrippo`. It can never change after the first upload. If the Dragonwilds Codex used a different studio prefix, match it now in `capacitor.config.json`.
- **Target SDK:** new apps and updates must target **Android 16 (API 36)** since August 31, 2026. Confirm `targetSdkVersion` and `compileSdkVersion` are 36 in `android/variables.gradle`.
- **No bundler needed.** Plugins are reached through `window.Capacitor.Plugins` (see `platform.js`). If you prefer imports, add Vite with `www` as the root; the app has no other build step.
- Add the **Haptics, App, Preferences, LocalNotifications, Filesystem, Share** and **RevenueCat** plugins (already in `package.json`) and run `npx cap sync android`.

### Step 2: Icons and splash

```bash
npm run android:assets
```

This reads `assets/icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png` and `splash-dark.png`. Check the adaptive icon on a Pixel launcher (circle mask) and a Samsung one (squircle): Drip's ears and droplet should sit inside the safe zone.

For the **notification icon**, import `assets/notification-icon.svg` in Android Studio (File > New > Vector Asset) as `ic_stat_hydrippo`. It must be plain white on transparent.

### Step 3: Edge-to-edge check

Apps targeting Android 15+ draw behind the status bar and navigation bar. The CSS uses `env(safe-area-inset-*)` for the top bar, tab bar, toasts and sheets. On a real phone, check that the header isn't under the status bar and the tab bar isn't under the gesture bar. If the insets come through as 0, use Capacitor 8's system bars / insets handling (or add padding from native insets) until both bars clear.

### Step 4: Reminders

Already coded in `platform.js`:
- Creates the channel `reminders` ("Drink reminders").
- Asks for `POST_NOTIFICATIONS` at the end of onboarding (Android 13+).
- Schedules 7 days ahead with `allowWhileIdle`, inexact. **Don't** add `SCHEDULE_EXACT_ALARM` or `USE_EXACT_ALARM`; a water app doesn't qualify and Play will question it.
- Adds a **"Log 8 oz"** action button (or "Log 250 ml"). Tapping it logs a glass of water through `localNotificationActionPerformed`.

To test on a phone: set "How often" to 1 h and awake hours to include now, lock the phone and wait. Also check that reminders still come after a reboot (the plugin reschedules them on boot) and that they stop for the day after reaching the goal.

**"Reminders not showing up?" fixer.** Settings has a help sheet with two buttons that call `platform.openSettings('notifications' | 'battery')`. Add the **`capacitor-native-settings`** plugin (already in `package.json`); it opens the app's notification settings and the battery-optimization list. Test on Brandon's Samsung: One UI's "Sleeping apps" is the usual reason reminders stop, and competitor reviews (Hydro Coach) complain about exactly this. Check that the Samsung path in the sheet text matches the phone's current menus and adjust the wording if Samsung renamed anything.

**Rating prompt.** After the 5th goal day, once, the app calls `platform.requestReview()`. Add **`@capacitor-community/in-app-review`** (in `package.json`). Google decides whether the dialog actually shows (it has its own quota), so the app never asks twice either way.

**Backups.** `platform.saveBackup()` writes the file to cache and opens the share sheet (Filesystem + Share, already listed). Restore uses a normal file input, which works in the Android WebView. Also leave Android's automatic Google backup on (`android:allowBackup="true"`, the Capacitor default) so Preferences come back on a new phone for people who never make a manual backup; test it with `adb shell bmgr backupnow com.sidequeststudio.hydrippo` and a reinstall.

### Step 5: Billing (Google Play through RevenueCat)

RevenueCat handles receipts and entitlements, so there's no server to run. It's free at small scale.

1. **Play Console > Monetize:** create the two products from section 2. The subscription needs a base plan `yearly` and an offer `trial7` (7-day free trial, new customers).
2. **Play Console > Setup > License testing:** add Brandon's and testers' Gmail addresses so test purchases aren't charged.
3. **RevenueCat:** create a project, add an Android app with the package name, and connect a Play service-account JSON (RevenueCat's docs walk through it). Create entitlement **`plus`** and attach both products. Create offering **`default`** with the Annual package (yearly) and the Lifetime package.
4. Paste the **public Android SDK key** (starts with `goog_`) into `REVENUECAT_ANDROID_KEY` in `platform.js`.
5. Test: buy yearly with a license tester, cancel, restore, buy lifetime, reinstall and restore. Check the `GUS:` note about how cancellation comes back (the code treats `userCancelled` or code `"1"` as a silent cancel).

Note: Play has to have the app uploaded to at least an internal testing track before products can be created and bought.

### Step 6: Home-screen widget (free feature)

Needs native Android code, since Capacitor can't draw widgets.

- **Widget (Jetpack Glance), 2×2 and 4×1:** shows today's total ("58 / 96 oz"), a progress ring or bar, a small Drip image (5 prerendered pond levels are enough) and a **+8 oz** button (or +250 ml).
- **Custom Capacitor plugin `HydrippoWidget`**, two methods:
  - `update({ totalMl, goalMl, units, label })`: save to SharedPreferences and refresh the widget. The web app already calls it after every change.
  - `takePending()` → `{ logs: [{ ts, ml }] }`: return and clear the drinks tapped on the widget while the app was closed. The web app already calls it on start and on resume, then merges them.
- **The +8 oz button:** a Glance `ActionCallback` that appends `{ ts: now, ml }` to a pending list in SharedPreferences, adds the ml to the saved total so the widget updates at once, and gives a quick haptic tick.
- Known limit: if the day rolls over while the app stays closed, the widget total should reset. Store the day-end minutes in `update()` as well and have the widget compare dates.

### Step 7: Test pass on real phones

At least one Samsung (Brandon's S23 Ultra) and one Pixel or emulator, on Android 14 and 16.

- [ ] Onboarding in oz and in ml; weight in lb and kg; night-shift preset shows day end 11:30 AM
- [ ] Dragging the line: smooth, snaps by 1 oz / 10 ml, haptic ticks, readout visible, Undo works
- [ ] Swiping on the page away from the line scrolls instead of logging
- [ ] Refill, "Finished it", empty-bottle prompt
- [ ] Quick chips and the "More drinks" sheet; locked drinks open the paywall
- [ ] Goal reached: toast, haptic, Drip at full soak, reminders stop for the day
- [ ] Day rollover: log at 1 AM with a 3 AM day end, confirm it counts for the previous day
- [ ] History: streak, 7-day chart, day details, caffeine line (Plus)
- [ ] Settings: units switch redraws the bottle scale; add and remove bottles; free limit of 2
- [ ] Reminders fire, show the action button, and the action logs water
- [ ] Purchases: yearly with trial, lifetime, restore, reinstall
- [ ] Android back button: closes sheets, goes back to Today, then exits
- [ ] Dark mode (system setting) on every screen
- [ ] Big font size (Settings > Display > Font size at max): nothing clipped
- [ ] TalkBack: tabs, buttons and the bottle slider are announced. Arrow keys on the slider (with a keyboard) log a drink after a pause.
- [ ] Airplane mode: everything except purchases works
- [ ] Edit a drink (amount, type, time) and add a forgotten drink to yesterday at 1:15 AM; both land on the right day
- [ ] Custom quick buttons: set one to 1 oz, tap it 50 times, total reads exactly 50 oz
- [ ] Hot-day boost raises today's goal only; tapping again removes it
- [ ] Save a backup to Drive, erase, restore it; a random file is refused
- [ ] "Reminders not showing up?" buttons open the right Samsung and Pixel settings screens
- [ ] Run `python3 tests/sim/simulate.py` after any code change: all checks pass

### Step 8: Play Console setup

1. Create the app: name "Hydrippo: Water Tracker", default language English (US), App, Free.
2. Fill in **Policy > App content** using `store-listing/play-console-answers.md` (health apps declaration, data safety, content rating, target audience, ads).
3. **Main store listing** from `store-listing/listing.md` plus the graphics in that folder.
4. **Closed testing is required** for personal developer accounts created after November 13, 2023: at least **12 testers opted in continuously for 14 days** before you can apply for production. Start this as early as possible. The same 12 people can test the Dragonwilds Codex and Hydrippo at the same time. Testers who opt out before 14 days don't count.

### Step 9: Privacy policy

`store-listing/privacy-policy.md` needs a public web page (no PDF, not editable by others). Fill in the date and a studio support email, then host it on the SideQuest site or a free static host. The same link goes in Play Console and should also open from the app's About section. Add a "Privacy policy" link row there once you have the URL.

### Step 10: Release

- Build a signed **AAB** (same upload key process as the Dragonwilds Codex).
- Version code 1, version name 0.1.0.
- Roll out to production at 20% first, watch Android vitals and reviews for a few days, then go to 100%.

---

## 6. Before launch: name and legal

- **"Sippo" was Brandon's first choice but is taken.** SIPPO is a registered US trademark (Reg. No. 5096572, Intelligi LLC, 2016) covering "software for tracking a user's fluid intake". It's also used for a drink-menu app and a liquor brand. Don't use it, even as the mascot's name.
- **"Hydrippo"**: searches found no apps and no US trademarks under that name, and no close matches in the water-tracker space. That's a search, not legal clearance. Before spending money on marketing:
  1. Search USPTO's trademark search for HYDRIPPO and close spellings in classes 9 (software) and 42.
  2. Check that hydrippo.com (or .app) and social handles are free.
  3. Consider filing a US trademark application for the name in class 9. It's a few hundred dollars and protects the brand if it takes off.
- Drip is an original character. Keep it that way: no references to famous hippos (Moo Deng, Gloria from Madagascar, Hungry Hungry Hippos) in art, names or ads.

---

## 7. Roadmap after v1

In rough order of value:

1. **Localized prices** from RevenueCat offerings on the paywall.
2. **Health Connect sync** (write `HydrationRecord`). It helps Samsung Health and Google Fit users, but it adds `WRITE_HYDRATION`, a Health apps declaration update, a permissions rationale screen and privacy policy changes. Ship v1 without it.
3. **Hot-day boost:** one tap for "+12 oz today" on hot or heavy-work days.
4. **Wear OS tile** with the +8 oz button (Samsung Galaxy Watch users).
5. **More Drip looks** and seasonal pond themes (Plus), plus a monthly limited accessory for retention.
6. **Time markers on the bottle** ("by 10 AM", "by 2 PM") as a Plus bottle style.
7. **SideQuest pass:** if Brandon launches a studio subscription, Hydrippo Plus can be one of its entitlements in RevenueCat.
8. **iOS** later: the same `www/` wraps with Capacitor for iPhone.

## 8. Known limits of the prototype

- In a browser, reminders only show as in-app banners while the page is open. Real notifications need the Android build.
- The water level is linear in height. Real tumblers taper, so readings near the bottom of a tapered tumbler run slightly high. That's fine for v1; per-shape volume curves could come later.
- Deleting a drink from the list doesn't put the water back in the bottle. Undo does. That's by design, but watch for tester confusion.
- Browser storage can be cleared by the browser. On Android, data lives in Capacitor Preferences.

## 9. Design notes

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
