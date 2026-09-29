/*
 * Hydrippo platform bridge.
 * Every function works in a plain browser (prototype mode) and switches to native Android
 * plugins when the app runs inside Capacitor. No bundler needed: native plugins are reached
 * through window.Capacitor.Plugins.
 *
 * Search for "TODO(launch)" for the one value that must be filled in before release.
 */
(function (root) {
  'use strict';

  var cap = root.Capacitor;
  var isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var P = (cap && cap.Plugins) || {};

  // TODO(launch): paste the RevenueCat *public Android* SDK key (starts with "goog_").
  // Until it's set, the app runs in test mode: Plus unlocks for free (like in a browser) so test
  // builds can try every feature, and the release build on GitHub refuses to build.
  var REVENUECAT_ANDROID_KEY = 'goog_REPLACE_ME';
  var testMode = !isNative || REVENUECAT_ANDROID_KEY.indexOf('REPLACE') !== -1;
  var ENTITLEMENT = 'plus';

  // Product IDs to create in Play Console > Monetize (see docs/PRODUCT_NOTES.md, "Pricing").
  var PRODUCTS = {
    yearly: { id: 'hydrippo_plus_yearly', price: '$9.99 / year', trialDays: 7 },
    lifetime: { id: 'hydrippo_plus_lifetime', price: '$14.99 once' }
  };

  var billingReady = false;

  /* ---------- Startup ---------- */
  async function init() {
    if (!isNative) return;
    if (P.Purchases && REVENUECAT_ANDROID_KEY.indexOf('REPLACE') === -1) {
      try { await P.Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY }); billingReady = true; }
      catch (e) { billingReady = false; }
    }
  }

  /* ---------- Plus status (Google Play is the source of truth) ---------- */
  function hasPlus(customerInfo) {
    return !!(customerInfo && customerInfo.entitlements && customerInfo.entitlements.active && customerInfo.entitlements.active[ENTITLEMENT]);
  }

  // Returns { known: true, plus } on native with billing configured, otherwise { known: false }.
  async function checkPlus() {
    if (!isNative || !billingReady) return { known: false };
    try {
      var r = await P.Purchases.getCustomerInfo();
      return { known: true, plus: hasPlus(r.customerInfo) };
    } catch (e) { return { known: false }; }
  }

  // kind: 'yearly' | 'lifetime'. Never unlocks Plus unless Google Play confirms.
  async function purchase(kind) {
    if (testMode) return { ok: true, plus: true, test: true, product: PRODUCTS[kind] };
    if (!billingReady) return { ok: false, error: 'Store isn’t ready. Check your connection and try again.' };
    try {
      var offerings = await P.Purchases.getOfferings();
      var cur = offerings && offerings.current;
      var pkg = cur && (kind === 'yearly' ? cur.annual : cur.lifetime);
      if (!pkg) return { ok: false, error: 'That plan isn’t available right now.' };
      var r = await P.Purchases.purchasePackage({ aPackage: pkg });
      return { ok: true, plus: hasPlus(r.customerInfo) };
    } catch (e) {
      // RevenueCat reports a cancelled purchase as userCancelled or code "1"; both are silent.
      if (e && (e.userCancelled || e.code === '1' || e.code === 1)) return { ok: false, cancelled: true };
      return { ok: false, error: 'Purchase didn’t go through.' };
    }
  }

  async function restore() {
    if (testMode) return { ok: true, plus: false, test: true };
    if (!billingReady) return { ok: false, error: 'Store isn’t ready.' };
    try {
      var r = await P.Purchases.restorePurchases();
      return { ok: true, plus: hasPlus(r.customerInfo) };
    } catch (e) { return { ok: false, error: 'Couldn’t reach Google Play.' }; }
  }

  /* ---------- Reminders ---------- */
  var channelMade = false;
  async function ensureChannel() {
    if (channelMade || !P.LocalNotifications) return;
    try {
      await P.LocalNotifications.createChannel({ id: 'reminders', name: 'Drink reminders', description: 'Gentle nudges from Drip', importance: 3, vibration: true });
      channelMade = true;
    } catch (e) { /* older Android: channels not needed */ }
  }

  async function requestNotificationPermission() {
    if (isNative && P.LocalNotifications) {
      try {
        var r = await P.LocalNotifications.requestPermissions();
        await ensureChannel();
        return r && r.display === 'granted';
      } catch (e) { return false; }
    }
    return true; // prototype: reminders show as in-app banners
  }

  /*
   * plan = [{ at: timestampMs, title, body }] covering the next 7 days.
   * Inexact delivery is fine. Do NOT request SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM.
   */
  async function scheduleReminders(plan) {
    if (!(isNative && P.LocalNotifications)) return { ok: true, prototype: true };
    try {
      await ensureChannel();
      var pending = await P.LocalNotifications.getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await P.LocalNotifications.cancel({ notifications: pending.notifications.map(function (n) { return { id: n.id }; }) });
      }
      if (!plan.length) return { ok: true };
      await P.LocalNotifications.schedule({
        notifications: plan.map(function (r, i) {
          // isExactNotification: false is essential. The plugin's default (true) opens Android's
          // "Alarms & reminders" settings screen on every schedule() call on Android 12+, and a
          // water reminder doesn't need to land on the exact minute anyway.
          return { id: 1000 + i, title: r.title, body: r.body, schedule: { at: new Date(r.at), allowWhileIdle: true }, isExactNotification: false, channelId: 'reminders', actionTypeId: 'LOG_WATER', smallIcon: 'ic_stat_hydrippo', iconColor: '#1A7EA2' };
        })
      });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  // Adds a "Log 8 oz" button to reminders and calls onLog() when it's tapped.
  async function onReminderAction(label, onLog) {
    if (!(isNative && P.LocalNotifications)) return;
    try {
      await P.LocalNotifications.registerActionTypes({ types: [{ id: 'LOG_WATER', actions: [{ id: 'log', title: label }] }] });
      P.LocalNotifications.addListener('localNotificationActionPerformed', function (ev) {
        if (ev && ev.actionId === 'log') onLog();
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------- Android back button ---------- */
  function onBackButton(handler) {
    if (!(isNative && P.App)) return;
    P.App.addListener('backButton', function () {
      if (!handler()) P.App.exitApp();
    });
  }

  /* ---------- Haptics ---------- */
  function haptic(kind) {
    try {
      if (isNative && P.Haptics) {
        if (kind === 'success') P.Haptics.notification({ type: 'SUCCESS' });
        else if (kind === 'tick') P.Haptics.selectionChanged();
        else P.Haptics.impact({ style: 'LIGHT' });
        return;
      }
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(kind === 'success' ? [12, 40, 12] : kind === 'tick' ? 4 : 8);
    } catch (e) { /* ignore */ }
  }

  /* ---------- CSV export (Plus) ---------- */
  async function exportCsv(text) {
    if (isNative && P.Filesystem && P.Share) {
      try {
        var name = 'hydrippo-history.csv';
        var w = await P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
        await P.Share.share({ title: 'Hydrippo history', url: w.uri, dialogTitle: 'Export your history' });
        return { ok: true, how: 'share' };
      } catch (e) { /* fall back to clipboard */ }
    }
    try {
      if (root.navigator && root.navigator.clipboard) {
        await root.navigator.clipboard.writeText(text);
        return { ok: true, how: 'clipboard' };
      }
    } catch (e) { /* ignore */ }
    return { ok: false };
  }

  /*
   * Home-screen widget (android/.../widget/). update(summary) keeps it current; the widget
   * keeps counting on its own after the day ends.
   */
  function updateWidget(summary) {
    if (isNative && P.HydrippoWidget && P.HydrippoWidget.update) {
      try { P.HydrippoWidget.update(summary); } catch (e) { /* ignore */ }
    }
  }

  // Drinks logged from the widget's "+8 oz" button while the app was closed: [{ ts, ml }]
  async function takePendingLogs() {
    if (isNative && P.HydrippoWidget && P.HydrippoWidget.takePending) {
      try { var r = await P.HydrippoWidget.takePending(); return (r && r.logs) || []; } catch (e) { return []; }
    }
    return [];
  }

  /*
   * Open a phone settings screen: 'notifications' (this app's notification settings) or
   * 'battery' (battery optimization list), through capacitor-native-settings.
   * Returns true if a screen opened.
   */
  async function openSettings(kind) {
    if (isNative && P.NativeSettings && P.NativeSettings.openAndroid) {
      try {
        var r = await P.NativeSettings.openAndroid({ option: kind === 'battery' ? 'battery_optimization' : 'app_notification' });
        return !r || r.status !== false;
      } catch (e) { return false; }
    }
    return false;
  }

  /*
   * Backup file. Native: write to cache and open the share sheet (Drive, email, Files).
   * Browser: copy the backup text to the clipboard.
   */
  async function saveBackup(text, name) {
    if (isNative && P.Filesystem && P.Share) {
      try {
        var w = await P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
        await P.Share.share({ title: 'Hydrippo backup', url: w.uri, dialogTitle: 'Save your Hydrippo backup' });
        return { ok: true, how: 'share' };
      } catch (e) { /* fall back to clipboard */ }
    }
    try {
      if (root.navigator && root.navigator.clipboard) { await root.navigator.clipboard.writeText(text); return { ok: true, how: 'clipboard' }; }
    } catch (e) { /* ignore */ }
    return { ok: false };
  }

  // Google Play in-app review (@capacitor-community/in-app-review). Returns true if asked.
  async function requestReview() {
    if (isNative && P.InAppReview && P.InAppReview.requestReview) {
      try { await P.InAppReview.requestReview(); return true; } catch (e) { return false; }
    }
    return false;
  }

  /*
   * Weather boost: today's forecast high from the US National Weather Service (free, public domain).
   * Two calls: /points/{lat},{lng} gives the local forecast URL (cached), then the forecast itself.
   * Returns { periods JSON, forecastUrl } or null. Only a ZIP-level location is ever sent.
   */
  async function weatherForecast(lat, lng, forecastUrl) {
    // Browsers and Android's WebView send their own User-Agent, which the weather service accepts.
    // (Setting a custom one here would be dropped or would force an extra CORS round trip.)
    var headers = { 'Accept': 'application/geo+json' };
    try {
      if (!forecastUrl) {
        var pr = await fetch('https://api.weather.gov/points/' + lat.toFixed(4) + ',' + lng.toFixed(4), { headers: headers });
        if (!pr.ok) return null;
        var pj = await pr.json();
        forecastUrl = pj && pj.properties && pj.properties.forecast;
        if (!forecastUrl) return null;
      }
      var fr = await fetch(forecastUrl, { headers: headers });
      if (!fr.ok) return null;
      return { forecast: await fr.json(), forecastUrl: forecastUrl };
    } catch (e) { return null; }
  }

  /*
   * Health Connect (native plugin "HydrippoHealth", written in Kotlin in android/).
   * Records are HydrationRecords keyed by the drink's id, so edits overwrite and deletes remove.
   */
  var H = function () { return isNative && P.HydrippoHealth ? P.HydrippoHealth : null; };
  async function hcAvailable() {
    if (!H()) return { available: false, reason: isNative ? 'missing' : 'web' };
    try { return await H().availability(); } catch (e) { return { available: false, reason: 'error' }; }
  }
  async function hcRequest() {
    if (!H()) return false;
    try { var r = await H().requestPermission(); return !!(r && r.granted); } catch (e) { return false; }
  }
  async function hcWrite(entries) {
    if (!H() || !entries.length) return true;
    try {
      await H().writeHydration({ records: entries.map(function (e) { return { id: e.id, ts: e.ts, ml: e.ml }; }) });
      return true;
    } catch (e) { return false; }
  }
  async function hcDelete(ids) {
    if (!H() || !ids.length) return true;
    try { await H().deleteHydration({ ids: ids }); return true; } catch (e) { return false; }
  }
  // Opens Google Play on Health Connect (to install or update it on Android 13 and older).
  function hcInstall() {
    if (H() && H().openInstall) { try { H().openInstall(); } catch (e) { /* ignore */ } }
  }

  // Localized store prices from Google Play (through RevenueCat), or null to use the defaults.
  async function getPrices() {
    if (!isNative || !billingReady) return null;
    try {
      var o = await P.Purchases.getOfferings();
      var c = o && o.current;
      if (!c) return null;
      return {
        yearly: c.annual && c.annual.product ? c.annual.product.priceString : null,
        lifetime: c.lifetime && c.lifetime.product ? c.lifetime.product.priceString : null
      };
    } catch (e) { return null; }
  }

  // Share a picture (the streak card). Native: share sheet. Browser: returns ok:false so the app shows it.
  async function shareImage(dataUrl, name) {
    if (isNative && P.Filesystem && P.Share) {
      try {
        var w = await P.Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1], directory: 'CACHE' });
        await P.Share.share({ title: 'My Hydrippo streak', url: w.uri, dialogTitle: 'Share your streak' });
        return { ok: true };
      } catch (e) { /* fall through */ }
    }
    return { ok: false };
  }

  root.HydPlatform = {
    isNative: isNative,
    PRODUCTS: PRODUCTS,
    init: init,
    checkPlus: checkPlus,
    purchase: purchase,
    restore: restore,
    requestNotificationPermission: requestNotificationPermission,
    scheduleReminders: scheduleReminders,
    onReminderAction: onReminderAction,
    testMode: testMode,
    onBackButton: onBackButton,
    hcInstall: hcInstall,
    haptic: haptic,
    exportCsv: exportCsv,
    updateWidget: updateWidget,
    takePendingLogs: takePendingLogs,
    openSettings: openSettings,
    saveBackup: saveBackup,
    requestReview: requestReview,
    weatherForecast: weatherForecast,
    hcAvailable: hcAvailable,
    hcRequest: hcRequest,
    hcWrite: hcWrite,
    hcDelete: hcDelete,
    getPrices: getPrices,
    shareImage: shareImage
  };
})(window);
