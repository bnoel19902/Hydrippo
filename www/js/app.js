/*
 * Hydrippo app UI.
 * State lives in one object, saved on every change through HydStore.
 * Free vs Plus gates are marked with plusGate().
 */
(function () {
  'use strict';

  var C = window.HydCore, S = window.HydStore, P = window.HydPlatform, A = window.HydArt;
  var FREE_BOTTLES = 2;
  var FREE_DAYS = 7;
  // Testing tools and test-mode Plus only show in the browser prototype or when HYD_DEBUG is set.
  // Testing tools (sample week, test Plus) show in a browser and in test builds without a store key.
  var DEBUG = !P.isNative || P.testMode || !!window.HYD_DEBUG;
  var APP_VERSION = '0.3.0'; // keep in step with package.json (a test checks)

  /* ---------------- Icons (original, 24px stroke) ---------------- */
  function ic(path, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  var ICON = {
    lock: ic('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 'lock'),
    close: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
    x: ic('<path d="M7 7l10 10M17 7L7 17"/>'),
    chev: ic('<path d="M9 5l7 7-7 7"/>', 'chev'),
    down: ic('<path d="M6 9l6 6 6-6"/>'),
    check: ic('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    refill: ic('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>'),
    drop: ic('<path d="M12 3c3.5 4.2 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.2 12 3Z"/>'),
    bottle: ic('<path d="M9 3h6M10 3v3.5c-2 .8-3 2.3-3 4.5v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8c0-2.2-1-3.7-3-4.5V3"/><path d="M7 13h10"/>'),
    moon: ic('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
    bell: ic('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    chart: ic('<path d="M5 20V11M10 20V6M15 20v-8M20 20V9"/>'),
    cup: ic('<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16"/>'),
    sparkle: ic('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
    shield: ic('<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6Z"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    sun: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    edit: ic('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/>'),
    save: ic('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>')
  };

  /* ---------------- Helpers ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function now() { return Date.now(); }
  function newId() { return Math.random().toString(36).slice(2, 10); }
  function toHHMM(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  function fromHHMM(v) { var p = String(v || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }

  var state = null;
  var ui = { tab: 'today', open: {}, range: 7, resetArmed: false };
  var art = { drip: null, bottle: null, bottleKey: '' };

  function units() { return state.units; }
  function fmt(ml) { return C.fmtVol(ml, state.units); }
  function todayKey() { return C.dayKey(now(), state.dayEndMin); }
  function todayTotal() { return C.dayTotalMl(state.log, todayKey(), state.dayEndMin, state.waterOnly); }
  function activeBottle() {
    for (var i = 0; i < state.bottles.length; i++) if (state.bottles[i].id === state.activeBottleId) return state.bottles[i];
    return state.bottles[0];
  }
  function levelOf(b) { var l = state.levels[b.id]; return l == null ? b.ml : Math.max(0, Math.min(b.ml, l)); }
  // Store amounts to 0.01 ml so many small logs never add up to a wrong total (1 oz x 50 = 50 oz, not 51).
  function q(ml) { return Math.round(ml * 100) / 100; }
  // Today's goal can be raised for a hot or heavy day.
  function goalFor(key) { return state.goalMl + ((state.boosts && state.boosts[key]) || 0); }
  function todayGoal() { return goalFor(todayKey()); }
  function boostMl() { return units() === 'ml' ? 500 : C.ozToMl(16); }

  // Drip's looks. The crown is earned by anyone with a 30-day streak; the rest come with Plus.
  var LOOKS = [['none', 'Plain'], ['cap', 'Cap'], ['hardhat', 'Hard hat'], ['headphones', 'Headphones'], ['beanie', 'Beanie'],
    ['sweatband', 'Sweatband'], ['shades', 'Shades'], ['lily', 'Lily'], ['crown', 'Crown']];
  var CROWN_DAYS = 30;
  function bestStreak() { return C.insights(state.log, now(), state.dayEndMin, goalFor, state.waterOnly, 1).bestStreak; }
  function lookAllowed(look) { return look === 'none' || (look === 'crown' ? bestStreak() >= CROWN_DAYS : state.plus); }
  var accCache = { key: '', val: 'none' };
  function effAcc() {
    var key = state.accessory + '|' + state.plus + '|' + state.log.length + '|' + todayKey();
    if (accCache.key !== key) accCache = { key: key, val: lookAllowed(state.accessory) ? state.accessory : 'none' };
    return accCache.val;
  }
  function colorHex(id) {
    for (var i = 0; i < C.BOTTLE_COLORS.length; i++) if (C.BOTTLE_COLORS[i].id === id) return C.BOTTLE_COLORS[i].hex;
    return C.BOTTLE_COLORS[2].hex;
  }
  function refillsOn(key) {
    var n = 0;
    for (var i = 0; i < state.refills.length; i++) if (C.dayKey(state.refills[i].ts, state.dayEndMin) === key) n++;
    return n;
  }
  function bottleName(b) {
    var name = C.bottleLabel(b, units());
    if (b.drink && b.drink !== 'water') name += ' · ' + C.drinkById(b.drink).name;
    return name;
  }
  function dayName(key) {
    var t = todayKey();
    if (key === t) return 'Today';
    if (key === C.addDays(t, -1)) return 'Yesterday';
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // "at 3:30 PM", "tomorrow at 8:30 AM", "Monday at 8:30 AM"
  function whenText(ts) {
    var calToday = C.ymd(new Date(now())), cal = C.ymd(new Date(ts));
    if (cal === calToday) return 'at ' + C.fmtTime(ts);
    if (cal === C.addDays(calToday, 1)) return 'tomorrow at ' + C.fmtTime(ts);
    return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' }) + ' at ' + C.fmtTime(ts);
  }

  /* ---------------- State ---------------- */
  function schedule(start, end) {
    var s = [];
    for (var i = 0; i < 7; i++) s.push({ on: true, start: start, end: end });
    return s;
  }

  function defaultState() {
    var profile = { weight: 170, weightUnit: 'lb', activity: 'moderate', hot: false };
    var b = { id: 'b1', shape: 'tumbler', ml: C.ozToMl(40), color: 'river', drink: 'water' };
    return {
      v: 1, onboarded: false, sample: false, units: 'oz',
      profile: profile, goalMl: C.calcGoalMl(profile),
      dayEndMin: 180,
      bottles: [b], activeBottleId: b.id, levels: { b1: b.ml },
      log: [], refills: [],
      reminders: { on: true, everyMin: 90, start: 420, end: 1380, smart: true, shift: false, schedule: schedule(420, 1380) },
      plus: false, plusTest: false, waterOnly: false, accessory: 'none', celebrated: {},
      quick: null, boosts: {}, showDrip: true, reviewAsked: false,
      weather: { on: false, zip: '', lat: null, lng: null, url: null, checked: null, high: null }, autoBoost: {},
      hc: { on: false, synced: {} }
    };
  }

  function migrate(s) {
    var d = defaultState();
    if (!s || typeof s !== 'object') return d;
    for (var k in d) if (!(k in s)) s[k] = d[k];
    for (var r in d.reminders) if (!(r in s.reminders)) s.reminders[r] = d.reminders[r];
    if (!s.bottles || !s.bottles.length) { s.bottles = d.bottles; s.activeBottleId = 'b1'; s.levels = d.levels; }
    return s;
  }

  // Undo covers exactly one action: any later change clears it, so Undo never rolls back something else.
  var undoSnap = null, undoArmed = false;
  function snapshot() { undoSnap = JSON.stringify(state); undoArmed = true; }
  function undo() {
    if (!undoSnap) { toast('Nothing to undo'); return; }
    state = JSON.parse(undoSnap);
    undoSnap = null;
    commit();
    toast('Undone');
  }

  // The one-tap amount used by the widget and the reminder's "Log" button.
  function quickAddMl() { return state.units === 'ml' ? 250 : q(C.ozToMl(8)); }

  // Send today's numbers to the home-screen widget (Android). The widget keeps counting on its
  // own after the day ends, so it also gets the day's boundaries and the goal without any boost.
  function pushWidget() {
    if (!state || !state.onboarded) return;
    var key = todayKey(), r = C.dayRange(key, state.dayEndMin);
    P.updateWidget({
      v: 1, totalMl: q(todayTotal()), goalMl: todayGoal(), baseGoalMl: state.goalMl, units: state.units,
      dayEndMin: state.dayEndMin, dayStart: r.start, dayEnd: r.end, addMl: quickAddMl()
    });
  }

  var planTimer = null;
  function commit() {
    if (undoArmed) undoArmed = false;
    else if (undoSnap) { undoSnap = null; var tb = $('#toast button'); if (tb) hideToast(); }
    S.save(state);
    pushWidget();
    clearTimeout(planTimer);
    planTimer = setTimeout(planReminders, 1500);
    clearTimeout(hcTimer);
    hcTimer = setTimeout(hcSync, 2000);
    render();
  }

  /* ---------------- Health Connect sync (optional) ---------------- */
  var hcTimer = null, hcBusy = false;
  // Makes Health Connect match the last 14 days of the log: adds new drinks, rewrites edited ones,
  // removes deleted or undone ones. Safe to run any time; it only sends differences.
  function hcSync() {
    if (!state || !state.hc || !state.hc.on || hcBusy) return;
    var plan = C.hcPlan(state.log, state.hc.synced || {}, now(), state.dayEndMin, state.waterOnly, 14);
    if (!plan.upsert.length && !plan.remove.length) return;
    hcBusy = true;
    P.hcWrite(plan.upsert).then(function (ok1) {
      return P.hcDelete(plan.remove).then(function (ok2) {
        if (ok1 && ok2) { state.hc.synced = plan.next; S.save(state); }
      });
    }).then(function () { hcBusy = false; }, function () { hcBusy = false; });
  }

  /* ---------------- Weather boost (optional, US) ---------------- */
  var weatherBusy = false;
  // Once a day: if today's forecast high is HOT_F or more, turn on the hot-day boost for today.
  function checkWeather(force) {
    var w = state && state.weather;
    if (!w || !w.on || w.lat == null || weatherBusy) return;
    var key = todayKey();
    if (!force && w.checked === key) return;
    weatherBusy = true;
    P.weatherForecast(w.lat, w.lng, w.url).then(function (r) {
      weatherBusy = false;
      if (!r) {
        if (force) toast('Couldn’t reach the weather service right now.' + (P.isNative ? ' It will try again later.' : ' (This test page can’t go online; the Android app can.)'));
        return;
      }
      w.url = r.forecastUrl;
      w.checked = key;
      w.high = C.nwsHighForDay(r.forecast, C.ymd(new Date(now())));
      if (w.high != null && w.high >= C.HOT_F && !(state.boosts && state.boosts[key])) {
        snapshot();
        state.boosts = state.boosts || {}; state.autoBoost = state.autoBoost || {};
        state.boosts[key] = q(boostMl()); state.autoBoost[key] = w.high;
        commit();
        toast('Forecast high ' + w.high + '°F today. Drip added ' + fmt(boostMl()) + ' to your goal.', { undo: true });
      } else {
        S.save(state);
        if (ui.tab === 'settings') render();
      }
    });
  }

  /* ---------------- Reminders ---------------- */
  var nextReminderAt = null;

  // Context that shapes reminder timing: quiet once the goal is hit; smart mode waits after the last drink.
  function reminderCtx() {
    var last = 0;
    for (var i = 0; i < state.log.length; i++) if (state.log[i].ts > last) last = state.log[i].ts;
    return {
      lastDrinkTs: state.reminders.smart ? last : 0,
      quietUntil: C.reached(todayTotal(), todayGoal()) ? C.dayRange(todayKey(), state.dayEndMin).end : 0
    };
  }
  function remSettings() {
    var r = state.reminders;
    return { on: r.on, everyMin: r.everyMin, start: r.start, end: r.end, smart: !!r.smart, shift: state.plus && r.shift, schedule: r.schedule };
  }

  // Builds the next 7 days of reminders. Re-run after every change (commit() does this).
  function planReminders() {
    var plan = [];
    var t = now();
    var rem = remSettings(), ctx = reminderCtx();
    for (var i = 0; i < 80; i++) {
      var n = C.nextReminder(t, rem, ctx);
      if (!n || n - now() > 7 * 24 * 3600000) break;
      plan.push({ at: n, title: 'Hydrippo', body: C.reminderLine(n / 60000) });
      t = n + 1000;
    }
    nextReminderAt = plan.length ? plan[0].at : null;
    P.scheduleReminders(plan);
  }

  // Prototype only: while the app is open, show a due reminder as an in-app banner.
  setInterval(function () {
    if (!state || !state.onboarded || !state.reminders.on || !nextReminderAt) return;
    if (now() < nextReminderAt) return;
    var due = nextReminderAt;
    nextReminderAt = C.nextReminder(now() + 1000, remSettings(), reminderCtx());
    if (!document.hidden) showBanner(C.reminderLine(due / 60000));
  }, 20000);

  var bannerTimer = null;
  function showBanner(line) {
    var bn = $('#banner');
    var d = A.drip({ fill: todayTotal() / todayGoal(), accessory: effAcc() });
    var ml = units() === 'ml' ? 250 : C.ozToMl(8);
    bn.innerHTML = '<div class="bslot"></div><div class="btext"><span class="bapp">HYDRIPPO · now</span><span class="bmsg"></span>' +
      '<div class="bact"><button class="btn btn--primary btn--small" data-b="log">Log ' + esc(fmt(ml)) + '</button><button class="btn btn--ghost btn--small" data-b="later">Later</button></div></div>';
    $('.bslot', bn).replaceWith(d.el);
    $('.bmsg', bn).textContent = line;
    bn.hidden = false;
    bn.onclick = function (e) {
      var b = e.target.closest('[data-b]');
      if (!b) return;
      bn.hidden = true;
      if (b.getAttribute('data-b') === 'log') logQuick(ml, 'water');
    };
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bn.hidden = true; }, 12000);
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function hideToast() { $('#toast').hidden = true; }
  // opts.undo adds an Undo button; opts.action = { label, run } adds any other button.
  function toast(msg, opts) {
    var t = $('#toast');
    var act = opts && opts.action;
    t.innerHTML = '<span></span>' + (opts && opts.undo ? '<button type="button">Undo</button>' : act ? '<button type="button"></button>' : '');
    t.firstChild.textContent = msg;
    if (opts && opts.undo) t.querySelector('button').onclick = function () { hideToast(); undo(); };
    else if (act) { var b = t.querySelector('button'); b.textContent = act.label; b.onclick = function () { hideToast(); act.run(); }; }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts && (opts.undo || act) ? 6000 : 3200);
  }

  /* ---------------- Logging ---------------- */
  function afterLog(before, msg) {
    var after = todayTotal(), key = todayKey(), goal = todayGoal();
    if (!C.reached(before, goal) && C.reached(after, goal) && !state.celebrated[key]) {
      state.celebrated[key] = true;
      S.save(state);
      P.haptic('success');
      toast('Goal reached! Drip is fully soaked.', { undo: true });
      // Ask for a rating once, only after 5 goal days, right after a good moment.
      if (!state.reviewAsked && Object.keys(state.celebrated).length >= 5) {
        state.reviewAsked = true;
        S.save(state);
        setTimeout(showReviewAsk, 2500);
      }
    } else {
      toast(msg, { undo: true });
    }
  }

  function logFromBottle(b, amt, newLevel) {
    snapshot();
    var before = todayTotal();
    state.levels[b.id] = Math.max(0, newLevel);
    state.log.push({ id: newId(), ts: now(), ml: q(amt), drink: b.drink || 'water', src: 'bottle', bottleId: b.id });
    P.haptic('tap');
    commit();
    afterLog(before, 'Logged ' + fmt(amt) + ' from your ' + C.bottleLabel(b, units()));
  }

  function logQuick(ml, drink) {
    snapshot();
    var before = todayTotal();
    state.log.push({ id: newId(), ts: now(), ml: q(ml), drink: drink, src: 'quick' });
    P.haptic('tap');
    commit();
    var d = C.drinkById(drink);
    afterLog(before, 'Logged ' + fmt(ml) + ' of ' + d.name.toLowerCase());
  }

  function refill() {
    var b = activeBottle();
    if (levelOf(b) >= b.ml - 1) { toast('Your bottle is already full.'); return; }
    snapshot();
    state.levels[b.id] = b.ml;
    state.refills.push({ ts: now(), bottleId: b.id });
    P.haptic('tap');
    commit();
    var n = refillsOn(todayKey());
    toast('Refilled. That’s refill ' + n + ' today.', { undo: true });
  }

  function finishBottle() {
    var b = activeBottle();
    var l = levelOf(b);
    if (l < 1) { toast('Already empty. Tap Refill after you top it up.'); return; }
    logFromBottle(b, l, 0);
  }

  function deleteEntry(id) {
    snapshot();
    state.log = state.log.filter(function (e) { return e.id !== id; });
    commit();
    toast('Drink removed', { undo: true });
  }

  /* ---------------- Plus gate ---------------- */
  function plusGate() {
    if (state.plus) return true;
    openPaywall();
    return false;
  }

  /* ---------------- Render root ---------------- */
  function render() {
    if (!state.onboarded) { $('#app').hidden = true; renderOnboarding(); return; }
    $('#onboard').hidden = true;
    $('#app').hidden = false;
    renderHeader();
    $$('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === ui.tab)); });
    if (ui.tab === 'today') renderToday();
    else if (ui.tab === 'history') renderHistory();
    else renderSettings();
  }

  function renderHeader() {
    var key = todayKey();
    var p = key.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2], 12).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    var end = state.dayEndMin === 0 ? 'Day ends at midnight' : 'Day ends ' + C.fmtMinutes(state.dayEndMin);
    $('#daylabel').innerHTML = '<strong>' + esc(d) + '</strong>' + esc(end);
  }

  /* ---------------- Today ---------------- */
  function defaultQuick() {
    var metric = units() === 'ml';
    return [
      { drink: 'water', ml: metric ? 250 : C.ozToMl(8) },
      { drink: 'coffee', ml: metric ? 350 : C.ozToMl(12) },
      { drink: 'tea', ml: metric ? 250 : C.ozToMl(8) },
      { drink: 'soda', ml: metric ? 330 : C.ozToMl(12) }
    ];
  }
  function quickList() { return state.quick && state.quick.length ? state.quick : defaultQuick(); }
  function quickLabel(x) { return x.drink === 'water' ? 'Glass' : x.drink === 'soda' ? 'Can of soda' : C.drinkById(x.drink).name; }
  function quickChips() {
    return quickList().map(function (x) {
      var locked = !C.drinkById(x.drink).free && !state.plus;
      return '<button class="chip" data-act="quick" data-drink="' + x.drink + '" data-ml="' + q(x.ml) + '">' + esc(quickLabel(x)) + ' <small>' + esc(fmt(x.ml)) + '</small>' + (locked ? ICON.lock : '') + '</button>';
    }).join('');
  }

  function entryRows(list, key) {
    var add = '<button class="addpast" data-act="add-entry" data-key="' + key + '">' + ICON.plus + 'Add a drink you forgot</button>';
    if (!list.length) return '<p class="empty">Nothing yet. Drag the line on your bottle when you drink.</p>' + add;
    return '<ul class="entries">' + list.map(function (e) {
      var d = C.drinkById(e.drink);
      var src = e.src === 'bottle' ? ' <span class="fine">from bottle</span>' : e.src === 'widget' ? ' <span class="fine">from widget</span>' : '';
      var muted = !C.counts(e, state.waterOnly) ? ' <span class="fine">(not counted)</span>' : '';
      return '<li><button class="entry" data-act="edit-entry" data-id="' + e.id + '" aria-label="Edit ' + esc(d.name) + ', ' + esc(fmt(e.ml)) + ' at ' + esc(C.fmtTime(e.ts)) + '">' +
          '<span class="t">' + esc(C.fmtTime(e.ts)) + '</span><span>' + esc(d.name) + src + muted + '</span><span class="a">' + esc(fmt(e.ml)) + '</span></button>' +
        '<button class="x" data-act="del-entry" data-id="' + e.id + '" aria-label="Remove ' + esc(d.name) + ' at ' + esc(C.fmtTime(e.ts)) + '">' + ICON.x + '</button></li>';
    }).join('') + '</ul>' + add;
  }

  function renderToday() {
    var b = activeBottle();
    var scr = $('#screen');
    scr.innerHTML =
      (state.sample ? '<div class="sample-note"><span>This is a sample day.</span><button class="linkbtn" data-act="clear-sample">Start fresh</button></div>' : '') +
      '<section class="card progress-card' + (state.showDrip === false ? ' no-drip' : '') + '" aria-label="Today’s progress">' +
        (state.showDrip === false ? '' : '<div id="dripSlot"></div>') +
        '<div class="ptext"><div class="eyebrow">Today</div><div class="big" id="tot"></div><div class="bar" aria-hidden="true"><i id="totbar"></i></div><div id="pace"></div>' +
        '<button class="chip chip--sm" data-act="boost" id="boostBtn"></button></div>' +
      '</section>' +
      '<section class="card bottle-card" aria-label="Your bottle">' +
        '<div class="bottle-head"><button class="bottle-switch" data-act="bottles">' + esc(bottleName(b)) + ICON.down + '</button><span class="refills num" id="refills"></span></div>' +
        '<div class="bottle-wrap" id="bottleWrap"><div class="readout" id="readout" hidden></div></div>' +
        '<p class="hint" id="hint"></p>' +
        '<div class="bottle-actions"><button class="btn btn--ghost" data-act="finish">Finished it</button><button class="btn btn--primary" data-act="refill" id="refillBtn">' + ICON.refill + 'Refill</button></div>' +
      '</section>' +
      '<section class="quick" aria-label="Log another drink"><div class="quick-head"><h2 class="section-title">Not from your bottle?</h2><button class="linkbtn" data-act="edit-quick">Edit buttons</button></div><div class="chips">' + quickChips() + '<button class="chip" data-act="drinks">More drinks</button></div></section>' +
      '<section class="quick" aria-label="Today’s drinks"><h2 class="section-title">Today’s drinks</h2><div class="card list-card" id="todayList"></div></section>';

    if (!art.drip) art.drip = A.drip({});
    if ($('#dripSlot')) $('#dripSlot').replaceWith(art.drip.el);

    var key = b.id + '|' + b.shape + '|' + b.color + '|' + b.ml;
    if (!art.bottle || art.bottleKey !== key) {
      art.bottle = A.bottle(b.shape, colorHex(b.color));
      art.bottleKey = key;
      bindBottle(art.bottle);
    }
    art.bottle.setTicks(b.ml, units());
    $('#bottleWrap').insertBefore(art.bottle.el, $('#readout'));
    updateToday();
  }

  function updateToday() {
    var b = activeBottle();
    var tot = todayTotal(), goal = todayGoal(), frac = goal ? tot / goal : 0;
    var boosted = !!(state.boosts && state.boosts[todayKey()]);
    var metricBig = units() === 'ml' && goal >= 1000;
    var totTxt = metricBig ? (tot < 50 ? '0' : (Math.round(tot / 100) / 10).toFixed(1)) : C.displayNumber(tot, units());
    $('#tot').innerHTML = esc(totTxt) + '<span class="of"> / ' + esc(fmt(goal)) + '</span>';
    $('#tot').setAttribute('aria-label', fmt(tot) + ' of ' + fmt(goal));
    $('#totbar').style.width = Math.min(100, frac * 100).toFixed(1) + '%';
    art.drip.update({ fill: frac, accessory: effAcc() });
    var bb = $('#boostBtn');
    bb.setAttribute('aria-pressed', String(boosted));
    var auto = state.autoBoost && state.autoBoost[todayKey()];
    bb.innerHTML = ICON.sun + (boosted ? 'Hot day' + (auto ? ' (' + auto + '°F)' : '') + ': +' + esc(fmt(state.boosts[todayKey()])) : 'Hot or heavy day? +' + esc(fmt(boostMl())));

    var p = C.pace(tot, goal, now(), remSettings());
    var pills = {
      done: ICON.check + 'Goal reached',
      ahead: 'Ahead of pace',
      onpace: 'On pace',
      behind: 'A bit behind · aim for ' + esc(fmt(p.expectedMl)) + ' by now',
      resting: ICON.moon + 'Resting hours'
    };
    $('#pace').innerHTML = '<span class="pill pill--' + p.status + '">' + pills[p.status] + '</span>';

    var r = refillsOn(todayKey());
    $('#refills').innerHTML = r ? 'Refill <b>' + r + '</b> today' : 'No refills yet';

    var l = levelOf(b);
    art.bottle.setLevel(l / b.ml);
    var h = art.bottle.handle;
    h.setAttribute('aria-valuemin', '0');
    h.setAttribute('aria-valuemax', C.displayNumber(b.ml, units()));
    h.setAttribute('aria-valuenow', C.displayNumber(l, units()));
    h.setAttribute('aria-valuetext', fmt(l) + ' left. Arrow down to log a drink, Enter to save.');
    $('#hint').textContent = l < 1 ? 'Empty. Tap Refill when you top it up.' : 'Drag the water line down to where your bottle is now.';
    $('#refillBtn').classList.toggle('is-nudge', l < 1);

    $('#todayList').innerHTML = entryRows(C.entriesForDay(state.log, todayKey(), state.dayEndMin), todayKey());
  }

  /* Bottle drag: the core interaction. */
  function bindBottle(bt) {
    var svg = bt.el, drag = null, kb = null, kbTimer = null;
    var step = function () { return C.stepMl(units()); };

    function snapLevel(startMl, rawMl) {
      var amt = Math.max(0, startMl - rawMl);
      amt = Math.round(amt / step()) * step();
      var lvl = startMl - amt;
      if (lvl < step() / 2) lvl = 0;
      return Math.max(0, Math.min(startMl, lvl));
    }

    function showReadout(amt, frac) {
      var ro = $('#readout');
      if (!ro) return;
      var rect = svg.getBoundingClientRect(), wrap = svg.parentNode.getBoundingClientRect();
      var y = bt.empty - frac * (bt.empty - bt.full);
      ro.style.top = (rect.top - wrap.top + (y / 380) * rect.height - 18) + 'px';
      ro.textContent = amt > 0 ? '−' + fmt(amt) : 'Drag down';
      ro.hidden = false;
    }
    function hideReadout() { var ro = $('#readout'); if (ro) ro.hidden = true; }

    // Only a press near the water line starts a drag; anywhere else the page scrolls as usual.
    var GRAB_PX = 56;
    function nearLine(clientY) { return Math.abs(clientY - bt.lineClientY()) <= GRAB_PX; }
    svg.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1 && nearLine(e.touches[0].clientY)) e.preventDefault();
    }, { passive: false });

    svg.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var b = activeBottle();
      if (!nearLine(e.clientY)) {
        var hint = $('#hint');
        if (hint && levelOf(b) >= 1) hint.textContent = 'Press on the water line, then slide down.';
        return;
      }
      drag = { id: e.pointerId, y0: e.clientY, start: levelOf(b), cur: levelOf(b), moved: false, b: b };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientY - drag.y0) < 6) return;
      if (drag.start < 1) return;
      drag.moved = true;
      svg.classList.add('is-dragging');
      var f = bt.fracFromClient(e.clientX, e.clientY);
      if (f == null) return;
      var lvl = snapLevel(drag.start, f * drag.b.ml);
      if (lvl !== drag.cur) P.haptic('tick');
      drag.cur = lvl;
      bt.setLevel(lvl / drag.b.ml, drag.start / drag.b.ml);
      showReadout(drag.start - lvl, lvl / drag.b.ml);
      e.preventDefault();
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag;
      drag = null;
      svg.classList.remove('is-dragging');
      hideReadout();
      if (!d.moved) {
        if (d.start < 1) { var rb = $('#refillBtn'); if (rb) rb.focus(); }
        else { var hint = $('#hint'); if (hint) { hint.textContent = 'Now slide it down to where your bottle is.'; } }
        return;
      }
      var amt = d.start - d.cur;
      if (amt < step() / 2) { bt.setLevel(d.start / d.b.ml); return; }
      logFromBottle(d.b, amt, d.cur);
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', function () {
      if (!drag) return;
      bt.setLevel(drag.start / drag.b.ml);
      drag = null;
      svg.classList.remove('is-dragging');
      hideReadout();
    });

    // Keyboard: arrows move the line, Enter saves, Escape cancels, pause 1.5 s also saves.
    function kbCommit() {
      clearTimeout(kbTimer);
      if (!kb) return;
      var k = kb; kb = null;
      hideReadout();
      var amt = k.start - k.cur;
      if (amt >= step() / 2) logFromBottle(k.b, amt, k.cur);
      else bt.setLevel(k.start / k.b.ml);
    }
    bt.handle.addEventListener('keydown', function (e) {
      var b = activeBottle();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!kb) kb = { start: levelOf(b), cur: levelOf(b), b: b };
        var delta = e.key === 'ArrowDown' ? -step() : step();
        kb.cur = Math.max(0, Math.min(kb.start, kb.cur + delta));
        if (kb.cur < step() / 2) kb.cur = 0;
        bt.setLevel(kb.cur / b.ml, kb.start / b.ml);
        showReadout(kb.start - kb.cur, kb.cur / b.ml);
        clearTimeout(kbTimer);
        kbTimer = setTimeout(kbCommit, 1500);
      } else if (e.key === 'Enter') {
        e.preventDefault(); kbCommit();
      } else if (e.key === 'Escape' && kb) {
        clearTimeout(kbTimer); bt.setLevel(kb.start / kb.b.ml); kb = null; hideReadout();
      }
    });
    bt.handle.addEventListener('blur', kbCommit);
  }

  /* ---------------- History ---------------- */
  function chartSvg(ser, goal) {
    var W = 320, H = 172, padL = 6, padR = 6, padT = 22, padB = 22;
    var max = goal * 1.18;
    ser.forEach(function (d) { if (d.ml * 1.08 > max) max = d.ml * 1.08; });
    var n = ser.length, gap = n > 10 ? 3 : 10;
    var bw = (W - padL - padR - gap * (n - 1)) / n;
    var y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily totals for the last ' + n + ' days">';
    out += '<line class="c-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (H - padB) + '" y2="' + (H - padB) + '"/>';
    var letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    ser.forEach(function (d, i) {
      var x = padL + i * (bw + gap);
      var top = y(d.ml), h = Math.max(0, (H - padB) - top);
      var cls = 'c-bar' + (C.reached(d.ml, goalFor(d.key)) ? ' met' : '') + (i === n - 1 ? ' today' : '');
      if (h > 0) out += '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(6, bw / 2).toFixed(1) + '"><title>' + esc(dayName(d.key) + ': ' + fmt(d.ml)) + '</title></rect>';
      if (n <= 10) {
        if (d.ml > 0) out += '<text class="c-val" x="' + (x + bw / 2).toFixed(1) + '" y="' + (top - 5).toFixed(1) + '" text-anchor="middle">' + esc(C.displayNumber(d.ml, units())) + '</text>';
        out += '<text class="c-text" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + letters[d.weekday] + '</text>';
      } else if (i % 5 === 4 || i === n - 1) {
        out += '<text class="c-text" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (+d.key.split('-')[2]) + '</text>';
      }
    });
    var gy = y(goal);
    out += '<line class="c-goal" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>';
    out += '</svg><div class="legend"><svg viewBox="0 0 26 6" aria-hidden="true"><line class="c-goal" x1="0" x2="26" y1="3" y2="3"/></svg>Your goal, ' + esc(fmt(goal)) + '</div>';
    return out;
  }

  function insightsCard() {
    if (!state.plus) {
      return '<section class="card insights locked"><div class="chart-head"><h2 class="section-title">Insights</h2><span class="pill pill--plus">' + ICON.lock + 'Plus</span></div>' +
        '<p class="fine">Your best streak, your best weekday, when you usually start and stop drinking, and this week vs last.</p>' +
        '<button class="btn btn--plus btn--small" data-act="paywall">See Plus</button></section>';
    }
    var i = C.insights(state.log, now(), state.dayEndMin, goalFor, state.waterOnly, 28);
    if (!i.daysWithData) return '<section class="card insights"><h2 class="section-title">Insights</h2><p class="fine">Log a few days and your patterns show up here.</p></section>';
    var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var change = i.lastWeek ? Math.round((i.thisWeek - i.lastWeek) / i.lastWeek * 100) : null;
    var rows = [
      ['Best streak ever', i.bestStreak + (i.bestStreak === 1 ? ' day' : ' days')],
      ['Best weekday', i.bestWeekday == null ? '–' : names[i.bestWeekday] + ' (' + fmt(i.weekday[i.bestWeekday]) + ' avg)'],
      ['Usual first drink', i.firstMin == null ? '–' : C.fmtMinutes(i.firstMin)],
      ['Usual last drink', i.lastMin == null ? '–' : C.fmtMinutes(i.lastMin)],
      ['Last 7 days vs the 7 before', change == null ? 'Needs 2 weeks' : (change >= 0 ? '+' : '') + change + '%']
    ];
    return '<section class="card insights"><h2 class="section-title">Insights</h2><dl>' +
      rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd class="num">' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="fine">Based on your last 4 weeks.</p></section>';
  }

  function renderHistory() {
    var range = state.plus ? ui.range : 7;
    var ser = C.series(state.log, now(), state.dayEndMin, range, state.waterOnly);
    var last7 = C.series(state.log, now(), state.dayEndMin, 7, state.waterOnly);
    var prev7 = C.series(state.log, now(), state.dayEndMin, 8, state.waterOnly).slice(0, 7);
    var streak = C.streak(state.log, now(), state.dayEndMin, goalFor, state.waterOnly);
    var withData = prev7.filter(function (d) { return d.ml > 0; });
    var avg = withData.length ? withData.reduce(function (a, d) { return a + d.ml; }, 0) / withData.length : 0;
    var met = last7.filter(function (d) { return C.reached(d.ml, goalFor(d.key)); }).length;

    // Every day since your first drink is listed, free. Your own history is never locked.
    var today = todayKey(), first = C.firstDayKey(state.log, state.dayEndMin) || today;
    var show = ui.histShow || 14, keys = [];
    for (var k = today; k >= first && keys.length < show; k = C.addDays(k, -1)) keys.push(k);
    var more = C.addDays(keys[keys.length - 1], -1) >= first;
    var rows = keys.map(function (key) {
      var list = C.entriesForDay(state.log, key, state.dayEndMin);
      var total = C.dayTotalMl(state.log, key, state.dayEndMin, state.waterOnly), goal = goalFor(key);
      var open = !!ui.open[key];
      var pct = Math.min(100, goal ? total / goal * 100 : 0);
      var refills = refillsOn(key);
      var sub = list.length + (list.length === 1 ? ' drink' : ' drinks') + (refills ? ' · ' + refills + (refills === 1 ? ' refill' : ' refills') : '') + (state.boosts && state.boosts[key] ? ' · hot day' : '');
      var cafLine = state.plus
        ? '<p class="caf">' + ICON.cup + 'Caffeine about ' + C.dayCaffeineMg(state.log, key, state.dayEndMin) + ' mg</p>'
        : '<p class="caf">' + ICON.lock + 'Caffeine tally is part of Plus</p>';
      return '<div class="day" data-open="' + open + '"><button data-act="toggle-day" data-key="' + key + '" aria-expanded="' + open + '">' +
        '<span><span class="dname">' + esc(dayName(key)) + '</span><span class="dsub">' + esc(sub) + '</span><span class="dbar"><i style="width:' + pct.toFixed(1) + '%"></i></span></span>' +
        '<span class="dtot">' + (C.reached(total, goal) ? '<span class="pill pill--done">' + ICON.check + esc(fmt(total)) + '</span>' : esc(fmt(total))) + '</span>' + ICON.chev + '</button>' +
        (open ? '<div class="detail">' + entryRows(list, key) + cafLine + '</div>' : '') + '</div>';
    }).join('');

    $('#screen').innerHTML =
      '<div class="stats">' +
        '<div class="card stat"><span class="v">' + streak + '<small>' + (streak === 1 ? 'day' : 'days') + '</small></span><span class="k">Streak</span></div>' +
        '<div class="card stat"><span class="v">' + esc(C.displayNumber(avg, units())) + '<small>' + esc(C.unitLabel(avg, units())) + '</small></span><span class="k">Daily average</span></div>' +
        '<div class="card stat"><span class="v">' + met + '<small>/ 7</small></span><span class="k">Goal days</span></div>' +
      '</div>' +
      '<section class="card chart-card"><div class="chart-head"><h2 class="section-title">' + (range === 7 ? 'Last 7 days' : 'Last 30 days') + '</h2>' +
        '<div class="seg" role="group" aria-label="Chart range"><button data-act="range" data-range="7" aria-pressed="' + (range === 7) + '">7 days</button><button data-act="range" data-range="30" aria-pressed="' + (range === 30) + '">30 days' + (state.plus ? '' : ' ' + ICON.lock) + '</button></div></div>' +
        chartSvg(ser, state.goalMl) + '</section>' +
      insightsCard() +
      '<section class="card days" aria-label="Day by day">' + rows + '</section>' +
      (more ? '<button class="btn btn--ghost btn--block" data-act="more-days">Show older days</button>' : '') +
      '<button class="btn btn--primary btn--block" data-act="share-card">' + ICON.sparkle + 'Share my streak</button>' +
      '<button class="btn btn--ghost btn--block" data-act="export">' + (state.plus ? '' : ICON.lock) + 'Export history as CSV</button>';
  }

  /* ---------------- Settings ---------------- */
  function renderSettings() {
    var r = state.reminders, shiftOn = state.plus && r.shift;
    var nxt = r.on ? C.nextReminder(now(), remSettings(), reminderCtx()) : null;
    var nxtTxt = !r.on ? 'Reminders are off' : nxt ? 'Next reminder ' + whenText(nxt) : 'No reminders scheduled';
    var bottles = state.bottles.map(function (b) {
      var active = b.id === state.activeBottleId;
      return '<div class="row bottle-row">' + A.bottleIcon(b.shape, colorHex(b.color)) +
        '<button class="radio" data-act="use-bottle" data-id="' + b.id + '" aria-pressed="' + active + '"><span>' + esc(bottleName(b)) + '<small>' + (active ? 'In use' : 'Tap to use') + '</small></span></button>' +
        (state.bottles.length > 1 ? '<button class="iconbtn" data-act="del-bottle" data-id="' + b.id + '" aria-label="Remove ' + esc(bottleName(b)) + '">' + ICON.x + '</button>' : '<span></span>') + '</div>';
    }).join('');
    var best = bestStreak();

    $('#screen').innerHTML =
      '<section class="group"><h2>Goal</h2><div class="card rows">' +
        '<div class="row"><span class="label"><b>Daily goal</b><span>A starting point you can change</span></span><button class="btn btn--ghost btn--small" data-act="goal">' + esc(fmt(state.goalMl)) + '</button></div>' +
        '<div class="row"><span class="label"><b>Units</b></span><div class="seg" role="group" aria-label="Units"><button data-act="units" data-units="oz" aria-pressed="' + (units() === 'oz') + '">oz</button><button data-act="units" data-units="ml" aria-pressed="' + (units() === 'ml') + '">ml</button></div></div>' +
        '<div class="row"><span class="label"><b>Count only water</b><span>Coffee, tea and soda still get logged but don’t count</span></span><label class="switch"><input type="checkbox" id="set-wateronly" ' + (state.waterOnly ? 'checked' : '') + '><span></span><b class="sr">Count only water</b></label></div>' +
        '<div class="row"><span class="label"><b>Automatic hot-day boost</b><span>On days the forecast hits ' + C.HOT_F + '°F, today’s goal goes up ' + esc(fmt(boostMl())) + '. US only. Uses your ZIP code, not GPS.</span></span><label class="switch"><input type="checkbox" id="set-weather" ' + (state.weather.on ? 'checked' : '') + '><span></span><b class="sr">Automatic hot-day boost</b></label></div>' +
        (state.weather.on ? '<div class="row"><span class="label"><b>Your ZIP code</b><span>' + esc(weatherStatus()) + '</span></span><input type="text" id="set-zip" class="zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="45385" value="' + esc(state.weather.zip || '') + '" aria-label="ZIP code"></div>' : '') +
      '</div></section>' +

      '<section class="group"><h2>Your day</h2><div class="card rows">' +
        '<div class="row"><span class="label"><b>Day ends at</b><span>Drinks before this time count toward the day before. Good for night shifts.</span></span><button class="btn btn--ghost btn--small" data-act="dayend">' + esc(state.dayEndMin === 0 ? 'Midnight' : C.fmtMinutes(state.dayEndMin)) + '</button></div>' +
      '</div></section>' +

      '<section class="group"><h2>Reminders</h2><div class="card rows">' +
        '<div class="row"><span class="label"><b>Remind me to drink</b><span>' + esc(nxtTxt) + '</span></span><label class="switch"><input type="checkbox" id="set-rem-on" ' + (r.on ? 'checked' : '') + '><span></span><b class="sr">Reminders</b></label></div>' +
        '<div class="row"><span class="label"><b>How often</b><span>They stop for the day once you hit your goal</span></span><div class="seg" role="group" aria-label="How often">' +
          [60, 90, 120].map(function (m) { return '<button data-act="every" data-min="' + m + '" aria-pressed="' + (r.everyMin === m) + '">' + (m === 60 ? '1 h' : m === 90 ? '1.5 h' : '2 h') + '</button>'; }).join('') + '</div></div>' +
        '<div class="row col"><span class="label"><b>Awake hours</b><span>' + (shiftOn ? 'Using your shift schedule below' : 'Reminders and pace follow these hours') + '</span></span>' +
          '<div class="timepair"><input type="time" id="set-rem-start" value="' + toHHMM(r.start) + '" aria-label="Awake from" ' + (shiftOn ? 'disabled' : '') + '><span>to</span><input type="time" id="set-rem-end" value="' + toHHMM(r.end) + '" aria-label="Awake until" ' + (shiftOn ? 'disabled' : '') + '></div></div>' +
        '<div class="row"><span class="label"><b>Wait after I drink</b><span>The next reminder waits a full interval after your last drink</span></span><label class="switch"><input type="checkbox" id="set-rem-smart" ' + (r.smart ? 'checked' : '') + '><span></span><b class="sr">Wait after I drink</b></label></div>' +
        '<div class="row"><span class="label"><b>Shift schedule ' + (state.plus ? '' : ICON.lock) + '</b><span>' + (shiftOn ? 'On · different hours on different days' : 'Different hours on different days') + '</span></span><button class="btn btn--ghost btn--small" data-act="shift">' + (shiftOn ? 'Edit' : 'Set up') + '</button></div>' +
        '<div class="row"><span class="label"><b>Try it</b><span>See what a reminder looks like</span></span><button class="btn btn--ghost btn--small" data-act="test-reminder">' + ICON.bell + 'Send test</button></div>' +
        '<div class="row"><span class="label"><b>Reminders not showing up?</b><span>Some phones put apps to sleep to save battery</span></span><button class="btn btn--ghost btn--small" data-act="rem-help">Fix it</button></div>' +
      '</div></section>' +

      '<section class="group"><h2>Bottles</h2><div class="card rows">' + bottles +
        '<div class="row"><span class="label"><b>Add a bottle</b><span>' + (state.plus ? 'Tumbler, jug, glass and more' : 'Free: ' + FREE_BOTTLES + ' bottles. Plus: as many as you own') + '</span></span><button class="btn btn--ghost btn--small" data-act="add-bottle">' + (state.plus || state.bottles.length < FREE_BOTTLES ? 'Add' : ICON.lock + 'Add') + '</button></div>' +
      '</div></section>' +

      '<section class="group"><h2>Drip</h2><div class="card rows">' +
        '<div class="row"><span class="label"><b>Show Drip on Today</b><span>Turn off for a plain progress bar</span></span><label class="switch"><input type="checkbox" id="set-showdrip" ' + (state.showDrip !== false ? 'checked' : '') + '><span></span><b class="sr">Show Drip</b></label></div>' +
        '<div class="row col"><span class="label"><b>Drip’s look ' + (state.plus ? '' : ICON.lock) + '</b></span><div class="acc-grid" id="accGrid">' +
        LOOKS.map(function (a) {
          var on = effAcc() === a[0];
          var locked = a[0] === 'crown' ? best < CROWN_DAYS : a[0] !== 'none' && !state.plus;
          var note = a[0] === 'crown' ? '<small>' + (best >= CROWN_DAYS ? 'Earned' : CROWN_DAYS + '-day streak') + '</small>' : '';
          return '<button class="acc" data-act="acc" data-acc="' + a[0] + '" aria-pressed="' + on + '"><span class="accslot" data-acc-slot="' + a[0] + '"></span>' + a[1] + note + (locked ? ICON.lock : '') + '</button>';
        }).join('') + '</div></div></div></section>' +

      '<section class="group"><h2>Hydrippo Plus</h2><div class="card rows">' +
        (state.plus
          ? '<div class="row"><span class="label"><b>Plus is on' + (state.plusTest ? ' (test mode)' : '') + '</b><span>Thanks for backing SideQuest Studio</span></span><span class="pill pill--plus">' + ICON.sparkle + 'Plus</span></div>'
          : '<div class="row"><span class="label"><b>Get more out of Hydrippo</b><span>Unlimited bottles, all drinks, shift schedules, full history</span></span><button class="btn btn--plus btn--small" data-act="paywall">See Plus</button></div>') +
        '<div class="row"><span class="label"><b>Restore purchases</b><span>Bought Plus on another phone?</span></span><button class="btn btn--ghost btn--small" data-act="restore">Restore</button></div>' +
      '</div></section>' +

      '<section class="group"><h2>Your data</h2><div class="card rows">' +
        '<div class="row"><span class="label"><b>Sync to Health Connect</b><span>Adds your drinks to Health Connect, where Samsung Health and Google Fit can see them</span></span><label class="switch"><input type="checkbox" id="set-hc" ' + (state.hc && state.hc.on ? 'checked' : '') + '><span></span><b class="sr">Sync to Health Connect</b></label></div>' +
        '<div class="row"><span class="label"><b>Save a backup</b><span>A file with all your drinks and settings, for a new phone</span></span><button class="btn btn--ghost btn--small" data-act="backup-save">' + ICON.save + 'Save</button></div>' +
        (ui.restore
          ? '<div class="row col"><span class="label"><b>Replace this phone’s data with your backup?</b><span>Backup from ' + esc(new Date(ui.restore.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })) + ' with ' + ui.restore.state.log.length + ' drinks. What’s on this phone now will be replaced.</span></span>' +
            '<span class="confirm"><button class="btn btn--primary btn--small" data-act="restore-confirm">Restore</button><button class="btn btn--ghost btn--small" data-act="restore-cancel">Cancel</button></span></div>'
          : '<div class="row"><span class="label"><b>Restore from a backup</b><span>Pick a Hydrippo backup file</span></span><label class="btn btn--ghost btn--small filebtn">Choose file<input type="file" id="set-restore" accept="application/json,.json" class="sr"></label></div>') +
        '<div class="row"><span class="label"><b>Erase all data</b><span>Deletes every drink and setting on this phone</span></span>' +
          (ui.resetArmed ? '<span class="confirm"><button class="btn btn--danger btn--small" data-act="reset-confirm">Erase</button><button class="btn btn--ghost btn--small" data-act="reset-cancel">Keep</button></span>' : '<button class="btn btn--ghost btn--small" data-act="reset-arm">Erase</button>') + '</div>' +
      '</div></section>' +

      '<section class="group"><h2>About</h2><div class="card rows"><div class="row col about">' +
        '<p class="fine"><b>Our promises:</b> no ads, no pop-up upgrade screens, no diet talk, and your history is never locked. Your data stays on this phone.</p>' +
        '<p class="fine">Hydrippo gives general hydration guidance. It is not a medical device and does not diagnose, treat, cure, or prevent any condition. If a doctor has given you a fluid limit or target, follow their advice.</p>' +
        '<p class="fine">Version ' + APP_VERSION + ' · SideQuest Studio · <button class="linkbtn" data-act="privacy">Privacy policy</button></p></div>' +
      '</div></section>' +

      (!DEBUG ? '' : '<section class="group"><h2>Testing tools</h2><div class="card rows">' +
        '<div class="row"><span class="label"><b>Load a sample week</b><span>Fills history so you can see the charts</span></span><button class="btn btn--ghost btn--small" data-act="sample-week">Load</button></div>' +
        (state.plus && state.plusTest ? '<div class="row"><span class="label"><b>Turn off test Plus</b><span>Go back to the free version</span></span><button class="btn btn--ghost btn--small" data-act="plus-off">Turn off</button></div>' : '') +
      '</div></section>');

    $$('[data-acc-slot]').forEach(function (slot) {
      var d = A.drip({ fill: 0.8, accessory: slot.getAttribute('data-acc-slot') });
      slot.replaceWith(d.el);
    });
  }

  function weatherStatus() {
    var w = state.weather;
    if (w.lat == null) return 'Enter a 5-digit US ZIP code';
    if (w.checked === todayKey()) {
      if (w.high == null) return 'Checked today. No daytime forecast left for today.';
      return 'Today’s forecast high: ' + w.high + '°F' + (w.high >= C.HOT_F ? ' · boost on' : '');
    }
    return 'Checks the forecast when you open the app';
  }

  /* ---------------- Sheets ---------------- */
  var lastFocus = null;
  function openSheet(title, body, onMount, opts) {
    closeSheet(true);
    lastFocus = document.activeElement;
    var root = $('#sheet-root');
    root.innerHTML = '<div class="scrim"><div class="sheet' + (opts && opts.cls ? ' ' + opts.cls : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-grab"></div><div class="sheet-head"><h2>' + esc(title) + '</h2><button class="iconbtn" data-close aria-label="Close">' + ICON.close + '</button></div>' + body + '</div></div>';
    var scrim = $('.scrim', root), sheet = $('.sheet', root);
    scrim.addEventListener('click', function (e) { if (e.target === scrim || e.target.closest('[data-close]')) closeSheet(); });
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    if (onMount) onMount(sheet);
    var f = sheet.querySelector('[data-close]');
    if (f) f.focus();
    return sheet;
  }
  function closeSheet(silent) {
    var root = $('#sheet-root');
    if (!root.innerHTML) return;
    root.innerHTML = '';
    if (!silent && lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
    if (!silent) refreshIfNewDay();
  }

  var PRICES = { yearly: '$9.99', lifetime: '$14.99' };
  function openPaywall() {
    var pick = 'yearly';
    var perks = [
      [ICON.bottle, 'Every bottle you own', 'Tumbler at work, jug at the gym, glass at home'],
      [ICON.cup, 'All 16 drinks + caffeine tally', 'Iced coffee, energy drinks, electrolytes and more'],
      [ICON.moon, 'Shift schedules', 'Different awake hours on different days, for rotating and night shifts'],
      [ICON.chart, 'Insights and trends', 'Best weekday, usual first and last drink, 30-day chart, CSV export'],
      [ICON.sparkle, 'Dress up Drip', 'A hard hat, headphones, a beanie and more, with new looks added over time']
    ];
    var body =
      '<div class="paywall" style="display:flex;flex-direction:column;gap:16px">' +
        '<div class="hero"><span id="pwDrip"></span><div><h2>Hydrippo <span>Plus</span></h2><p class="fine" style="margin-top:6px">Everything in the free app, plus the extras below. Still no ads, ever.</p></div></div>' +
        '<ul class="perks">' + perks.map(function (p) { return '<li>' + p[0] + '<div><b>' + p[1] + '</b><span>' + p[2] + '</span></div></li>'; }).join('') + '</ul>' +
        '<div class="plans" role="group" aria-label="Choose a plan">' +
          '<button class="plan" data-plan="yearly" aria-pressed="true"><span class="tag">7 days free</span><span class="pname">Yearly</span><span class="price" id="pY">' + esc(PRICES.yearly) + '</span><span class="pnote">Less than a dollar a month</span></button>' +
          '<button class="plan" data-plan="lifetime" aria-pressed="false"><span class="pname">Lifetime</span><span class="price" id="pL">' + esc(PRICES.lifetime) + '</span><span class="pnote">Pay once, keep it</span></button>' +
        '</div>' +
        '<button class="btn btn--plus btn--block" id="pwBuy">Start 7-day free trial</button>' +
        '<p class="fine" id="pwFine">Free for 7 days, then ' + esc(PRICES.yearly) + ' a year. Cancel anytime in Google Play.</p>' +
        '<div class="free-note"><b>Free forever:</b> bottle logging, refills, editing and adding past drinks, custom quick buttons, smart reminders, the hot-day boost, the shift-friendly day, your full history, backups and streaks.</div>' +
        (P.isNative ? '' : '<p class="fine">Prototype: nothing is charged here. In the Android app, purchases go through Google Play.</p>') +
      '</div>';
    openSheet('Upgrade', body, function (sheet) {
      $('#pwDrip', sheet).replaceWith(A.drip({ fill: 1, accessory: 'hardhat' }).el);
      // Show the real Google Play prices in the person's own currency when the store answers.
      P.getPrices().then(function (pr) {
        if (!pr || !document.contains(sheet)) return;
        if (pr.yearly) { PRICES.yearly = pr.yearly; $('#pY', sheet).textContent = pr.yearly; }
        if (pr.lifetime) { PRICES.lifetime = pr.lifetime; $('#pL', sheet).textContent = pr.lifetime; }
        if (pick === 'yearly') $('#pwFine', sheet).textContent = 'Free for 7 days, then ' + PRICES.yearly + ' a year. Cancel anytime in Google Play.';
      });
      sheet.addEventListener('click', function (e) {
        var pl = e.target.closest('[data-plan]');
        if (pl) {
          pick = pl.getAttribute('data-plan');
          $$('[data-plan]', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b === pl)); });
          $('#pwBuy', sheet).textContent = pick === 'yearly' ? 'Start 7-day free trial' : 'Buy lifetime for ' + PRICES.lifetime;
          $('#pwFine', sheet).textContent = pick === 'yearly' ? 'Free for 7 days, then ' + PRICES.yearly + ' a year. Cancel anytime in Google Play.' : 'One payment. Plus stays unlocked on this Google account.';
        }
        if (e.target.closest('#pwBuy')) {
          P.purchase(pick).then(function (r) {
            if (r.ok && r.plus) {
              state.plus = true; state.plusTest = !!r.test;
              closeSheet(); commit();
              toast(r.test ? 'Plus unlocked (test mode, no charge)' : 'Welcome to Plus!');
              P.haptic('success');
            } else if (!r.cancelled) {
              toast(r.error || 'Purchase didn’t go through. Try again.');
            }
          });
        }
      });
    }, { cls: '' });
  }

  /* Edit a drink, or add one you forgot (free). */
  function openEntrySheet(entry, key) {
    var metric = units() === 'ml';
    var editing = !!entry;
    var dayKeyNow = todayKey();
    var e = editing ? { drink: entry.drink, ml: entry.ml, key: C.dayKey(entry.ts, state.dayEndMin), min: new Date(entry.ts).getHours() * 60 + new Date(entry.ts).getMinutes() }
                    : { drink: 'water', ml: metric ? 250 : C.ozToMl(8), key: key || dayKeyNow, min: null };
    if (e.min == null) {
      var n = new Date(now());
      e.min = e.key === dayKeyNow ? n.getHours() * 60 + n.getMinutes() : 12 * 60;
    }
    var days = [];
    for (var i = 0; i < 7; i++) days.push(C.addDays(dayKeyNow, -i));
    if (days.indexOf(e.key) < 0) days.push(e.key);
    var presets = metric ? [100, 250, 330, 500] : [4, 8, 12, 16, 20].map(C.ozToMl);
    var stepBy = metric ? 10 : C.ozToMl(1);
    var body =
      '<div class="field"><span class="flabel">Drink</span><div class="drink-grid">' +
        C.DRINKS.map(function (d) {
          var locked = !d.free && !state.plus && d.id !== e.drink;
          return '<button class="chip" data-drink="' + d.id + '" aria-pressed="' + (d.id === e.drink) + '"><span>' + esc(d.name) + '</span>' + (locked ? ICON.lock : '') + '</button>';
        }).join('') + '</div></div>' +
      '<div class="field"><span class="flabel">Amount</span><div class="chips">' +
        presets.map(function (p) { return '<button class="chip" data-preset="' + q(p) + '">' + esc(fmt(p)) + '</button>'; }).join('') + '</div>' +
        '<div class="stepper"><button data-step="-1" aria-label="Less">−</button><output id="eAmt"></output><button data-step="1" aria-label="More">+</button></div></div>' +
      '<div class="timepair"><div class="field"><label for="eDay">Day</label><select id="eDay">' +
        days.map(function (k) { return '<option value="' + k + '"' + (k === e.key ? ' selected' : '') + '>' + esc(dayName(k)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="eTime">Time</label><input type="time" id="eTime" value="' + toHHMM(e.min) + '"></div></div>' +
      '<p class="fine" id="eHint" hidden></p>' +
      '<button class="btn btn--primary btn--block" id="eSave">' + (editing ? 'Save changes' : 'Add drink') + '</button>' +
      (editing ? '<button class="btn btn--danger btn--block" id="eDel">Remove this drink</button>' : '');
    openSheet(editing ? 'Edit drink' : 'Add a drink you forgot', body, function (sheet) {
      function paint() {
        $('#eAmt', sheet).textContent = fmt(e.ml);
        $$('[data-drink]', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-drink') === e.drink)); });
      }
      paint();
      $('#eDay', sheet).addEventListener('change', function (ev) { e.key = ev.target.value; });
      $('#eTime', sheet).addEventListener('change', function (ev) { if (ev.target.value) e.min = fromHHMM(ev.target.value); });
      sheet.addEventListener('click', function (ev) {
        var d = ev.target.closest('[data-drink]');
        if (d) {
          var drink = C.drinkById(d.getAttribute('data-drink'));
          if (!drink.free && !state.plus && drink.id !== e.drink) { openPaywall(); return; }
          e.drink = drink.id; paint();
        }
        var pr = ev.target.closest('[data-preset]');
        if (pr) { e.ml = +pr.getAttribute('data-preset'); paint(); }
        var st = ev.target.closest('[data-step]');
        if (st) { e.ml = Math.max(stepBy, Math.min(metric ? 4000 : C.ozToMl(128), e.ml + (+st.getAttribute('data-step')) * stepBy)); paint(); }
        if (ev.target.closest('#eSave')) {
          var ts = C.tsFor(e.key, e.min, state.dayEndMin);
          if (ts > now() + 60000) {
            var h = $('#eHint', sheet); h.hidden = false; h.textContent = 'That time hasn’t happened yet. Pick an earlier time.';
            return;
          }
          snapshot();
          var before = todayTotal();
          if (editing) {
            var target = state.log.filter(function (x) { return x.id === entry.id; })[0];
            if (target) { target.drink = e.drink; target.ml = q(e.ml); target.ts = ts; }
          } else {
            state.log.push({ id: newId(), ts: ts, ml: q(e.ml), drink: e.drink, src: 'manual' });
          }
          closeSheet(); commit();
          var where = e.key === todayKey() ? '' : ' to ' + dayName(e.key).replace(/^Yesterday$/, 'yesterday');
          if (editing) toast('Drink updated', { undo: true });
          else afterLog(before, 'Added ' + fmt(e.ml) + ' of ' + C.drinkById(e.drink).name.toLowerCase() + where);
        }
        if (ev.target.closest('#eDel')) { closeSheet(); deleteEntry(entry.id); }
      });
    });
  }

  /* Choose the four quick buttons on Today (free; Plus drinks need Plus). */
  function openQuickSheet() {
    var metric = units() === 'ml';
    var slots = JSON.parse(JSON.stringify(quickList()));
    var stepBy = metric ? 10 : C.ozToMl(1);
    function rowsHtml() {
      return slots.map(function (x, i) {
        return '<div class="qslot"><select data-qd="' + i + '" aria-label="Button ' + (i + 1) + ' drink">' +
          C.DRINKS.map(function (d) {
            var locked = !d.free && !state.plus;
            return '<option value="' + d.id + '"' + (d.id === x.drink ? ' selected' : '') + (locked ? ' disabled' : '') + '>' + esc(d.name) + (locked ? ' (Plus)' : '') + '</option>';
          }).join('') + '</select>' +
          '<div class="stepper"><button data-qs="' + i + '" data-dir="-1" aria-label="Less">−</button><output>' + esc(fmt(x.ml)) + '</output><button data-qs="' + i + '" data-dir="1" aria-label="More">+</button></div></div>';
      }).join('');
    }
    var body = '<p class="fine" style="font-size:15px">Set the four buttons under “Not from your bottle?” to the drinks and sizes you actually have.</p>' +
      '<div class="qslots" id="qSlots">' + rowsHtml() + '</div>' +
      '<button class="btn btn--primary btn--block" id="qSave">Save buttons</button>' +
      '<button class="btn btn--ghost btn--block" id="qReset">Back to the defaults</button>';
    openSheet('Quick buttons', body, function (sheet) {
      function redraw() { $('#qSlots', sheet).innerHTML = rowsHtml(); }
      sheet.addEventListener('change', function (ev) {
        var t = ev.target;
        if (t.hasAttribute('data-qd')) slots[+t.getAttribute('data-qd')].drink = t.value;
      });
      sheet.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-qs]');
        if (b) {
          var i = +b.getAttribute('data-qs');
          slots[i].ml = Math.max(stepBy, Math.min(metric ? 2000 : C.ozToMl(64), slots[i].ml + (+b.getAttribute('data-dir')) * stepBy));
          redraw();
        }
        if (ev.target.closest('#qSave')) { snapshot(); state.quick = slots.map(function (x) { return { drink: x.drink, ml: q(x.ml) }; }); closeSheet(); commit(); toast('Quick buttons saved', { undo: true }); }
        if (ev.target.closest('#qReset')) { snapshot(); state.quick = null; closeSheet(); commit(); toast('Quick buttons reset', { undo: true }); }
      });
    });
  }

  /* Help for reminders that don't arrive (battery savers on Samsung and other phones). */
  function openReminderHelp() {
    var body =
      '<ol class="steps">' +
        '<li><b>Allow notifications.</b> Hydrippo needs permission to show reminders.<button class="btn btn--ghost btn--small" data-open="notifications">Open notification settings</button></li>' +
        '<li><b>Stop the phone from putting Hydrippo to sleep.</b>' +
          '<span class="fine">Samsung: Settings › Battery › Background usage limits. Make sure Hydrippo isn’t under “Sleeping apps” or “Deep sleeping apps”, and add it to “Never auto sleeping apps”.</span>' +
          '<span class="fine">Pixel and most others: Settings › Apps › Hydrippo › App battery usage › Unrestricted.</span>' +
          '<button class="btn btn--ghost btn--small" data-open="battery">Open battery settings</button></li>' +
        '<li><b>Check Do Not Disturb</b> and any bedtime or focus modes, which can hold reminders back.</li>' +
        '<li><b>Send yourself a test.</b><button class="btn btn--ghost btn--small" data-test>Send a test reminder</button></li>' +
      '</ol>';
    openSheet('Reminders not showing up?', body, function (sheet) {
      sheet.addEventListener('click', function (ev) {
        var o = ev.target.closest('[data-open]');
        if (o) P.openSettings(o.getAttribute('data-open')).then(function (ok) { if (!ok) toast('On your phone, this button opens that settings screen.'); });
        if (ev.target.closest('[data-test]')) { closeSheet(); showBanner(C.reminderLine(now() / 60000)); }
      });
    });
  }

  // The privacy policy ships inside the app (www/privacy.html), so it works offline.
  function openPrivacy() {
    var src = window.HYD_PRIVACY_HTML ? '' : ' src="privacy.html"';
    openSheet('Privacy policy', '<iframe class="policy" title="Privacy policy"' + src + '></iframe>', function (sheet) {
      var f = $('iframe', sheet);
      if (window.HYD_PRIVACY_HTML) f.srcdoc = window.HYD_PRIVACY_HTML; // single-file test build
      f.addEventListener('load', function () {
        // Links to other sites open in the browser, not inside the sheet.
        try { Array.prototype.forEach.call(f.contentDocument.querySelectorAll('a[href^="http"]'), function (a) { a.target = '_blank'; a.rel = 'noopener'; }); } catch (e) { /* cross-origin: leave as is */ }
      });
    }, { cls: 'sheet--tall' });
  }

  /* A picture of your streak to share (free). Drawn on a canvas so it works offline. */
  function dripImage(fill, look) {
    // Render Drip off-screen with the light palette, copy each shape's real colors onto it,
    // then turn it into an image. Works in any theme and doesn't depend on reading stylesheets.
    var d = A.drip({ fill: fill, accessory: look });
    var svg = d.el;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', '960'); svg.setAttribute('height', '720');
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:960px;height:720px;pointer-events:none;';
    var light = { '--hippo': '#9486AD', '--hippo-shade': '#7F7199', '--cheek': '#F2A1B5', '--mud': '#B99D7C', '--reed': '#8DBF9A', '--sky': '#D3EAEE', '--water': '#2BA6CD' };
    for (var k in light) holder.style.setProperty(k, light[k]);
    holder.appendChild(svg);
    document.body.appendChild(holder);
    var props = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'display'];
    Array.prototype.forEach.call(svg.querySelectorAll('*'), function (el) {
      if (el.tagName === 'clipPath' || el.closest('defs')) return;
      var cs = getComputedStyle(el);
      props.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) el.setAttribute(p, v); });
    });
    var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    document.body.removeChild(holder);
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }

  function makeShareCard() {
    var streak = C.streak(state.log, now(), state.dayEndMin, goalFor, state.waterOnly);
    var tot = todayTotal();
    var big = streak >= 1 ? String(streak) : C.displayNumber(tot, units());
    var label = streak >= 1 ? (streak === 1 ? 'day streak' : 'day streak') : C.unitLabel(tot, units()) + ' today';
    var sub = streak >= 1 ? 'Hit my water goal ' + streak + (streak === 1 ? ' day' : ' days') + ' in a row' : 'Drinking from my own bottle';
    var W = 1080, H = 1350;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 200px Sniglet'), document.fonts.load('700 56px "Atkinson Hyperlegible Next"')]) : Promise.resolve();
    return fonts.catch(function () {}).then(function () { return dripImage(Math.max(0.9, tot / todayGoal()), effAcc()); }).then(function (img) {
      ctx.fillStyle = '#E6F1F2'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#15303A'; ctx.font = '800 76px Sniglet, sans-serif'; ctx.fillText('Hydr', 72, 140);
      var wHydr = ctx.measureText('Hydr').width;
      ctx.fillStyle = '#2BA6CD'; ctx.fillText('ippo', 72 + wHydr, 140);
      ctx.fillStyle = '#15303A'; ctx.font = '800 240px Sniglet, sans-serif'; ctx.fillText(big, 64, 410);
      var wBig = ctx.measureText(big).width;
      ctx.font = '700 64px "Atkinson Hyperlegible Next", sans-serif'; ctx.fillStyle = '#4C6670'; ctx.fillText(label, 64 + wBig + 24, 410);
      ctx.font = '700 48px "Atkinson Hyperlegible Next", sans-serif'; ctx.fillStyle = '#15303A'; ctx.fillText(sub, 70, 500);
      // Drip in a rounded window
      var x = 60, y = 560, w = 960, h = 720, r = 72;
      ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.clip();
      ctx.drawImage(img, x, y, w, h); ctx.restore();
      ctx.font = '700 34px "Atkinson Hyperlegible Next", sans-serif'; ctx.fillStyle = '#4C6670'; ctx.textAlign = 'center';
      ctx.fillText('Drink from your own bottle. No ads.', W / 2, 1322);
      return cv.toDataURL('image/png');
    });
  }

  function shareCard() {
    makeShareCard().then(function (url) {
      P.shareImage(url, 'hydrippo-streak.png').then(function (r) {
        if (r.ok) return;
        openSheet('Your streak card', '<img class="sharecard" src="' + url + '" alt="Hydrippo streak card">' +
          '<p class="fine">Press and hold the picture to save or share it. In the Android app this opens your share menu.</p>');
      });
    }, function () { toast('Couldn’t make the picture on this device.'); });
  }

  function showReviewAsk() {
    var bn = $('#banner');
    var d = A.drip({ fill: 1, accessory: effAcc() });
    bn.innerHTML = '<div class="bslot"></div><div class="btext"><span class="bmsg">Enjoying Hydrippo? A quick rating helps a small studio a lot.</span>' +
      '<div class="bact"><button class="btn btn--primary btn--small" data-b="rate">Rate Hydrippo</button><button class="btn btn--ghost btn--small" data-b="later">Not now</button></div></div>';
    $('.bslot', bn).replaceWith(d.el);
    bn.hidden = false;
    bn.onclick = function (e) {
      var b = e.target.closest('[data-b]');
      if (!b) return;
      bn.hidden = true;
      if (b.getAttribute('data-b') === 'rate') P.requestReview().then(function (ok) { if (!ok) toast('Thanks! On your phone this opens the Google Play rating.'); });
    };
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bn.hidden = true; }, 15000);
  }

  function openDrinkSheet() {
    var metric = units() === 'ml';
    var pick = 'water';
    var ml = metric ? 250 : C.ozToMl(8);
    var presets = metric ? [100, 250, 330, 500] : [4, 8, 12, 16, 20].map(C.ozToMl);
    var stepBy = metric ? 25 : C.ozToMl(1);
    var body =
      '<div class="field"><span class="flabel">What did you drink?</span><div class="drink-grid">' +
        C.DRINKS.map(function (d) {
          var locked = !d.free && !state.plus;
          return '<button class="chip" data-drink="' + d.id + '" aria-pressed="' + (d.id === pick) + '"><span>' + esc(d.name) + '</span>' + (locked ? ICON.lock : '') + '</button>';
        }).join('') + '</div></div>' +
      '<div class="field"><span class="flabel">How much?</span><div class="chips">' +
        presets.map(function (p) { return '<button class="chip" data-preset="' + q(p) + '">' + esc(fmt(p)) + '</button>'; }).join('') + '</div>' +
        '<div class="stepper"><button data-step="-1" aria-label="Less">−</button><output id="dAmt"></output><button data-step="1" aria-label="More">+</button></div></div>' +
      '<button class="btn btn--primary btn--block" id="dLog"></button>';
    openSheet('Log a drink', body, function (sheet) {
      function paint() {
        $('#dAmt', sheet).textContent = fmt(ml);
        $('#dLog', sheet).textContent = 'Log ' + fmt(ml) + ' of ' + C.drinkById(pick).name.toLowerCase();
        $$('[data-drink]', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-drink') === pick)); });
      }
      paint();
      sheet.addEventListener('click', function (e) {
        var d = e.target.closest('[data-drink]');
        if (d) {
          var drink = C.drinkById(d.getAttribute('data-drink'));
          if (!drink.free && !state.plus) { openPaywall(); return; }
          pick = drink.id; paint();
        }
        var pr = e.target.closest('[data-preset]');
        if (pr) { ml = +pr.getAttribute('data-preset'); paint(); }
        var st = e.target.closest('[data-step]');
        if (st) { ml = Math.max(stepBy, Math.min(metric ? 2000 : C.ozToMl(64), ml + (+st.getAttribute('data-step')) * stepBy)); paint(); }
        if (e.target.closest('#dLog')) { closeSheet(); logQuick(ml, pick); }
      });
    });
  }

  function openBottleSheet(startAdding) {
    var metric = units() === 'ml';
    var canAdd = state.plus || state.bottles.length < FREE_BOTTLES;
    var draft = { shape: 'sport', ml: metric ? 750 : C.ozToMl(32), color: 'reed', drink: 'water' };
    var defaults = {
      tumbler: metric ? 1200 : C.ozToMl(40), sport: metric ? 750 : C.ozToMl(32), jug: metric ? 4000 : C.ozToMl(128),
      disposable: 500, glass: metric ? 250 : C.ozToMl(8)
    };
    var names = { tumbler: 'Tumbler', sport: 'Sport bottle', jug: 'Jug', disposable: 'Water bottle', glass: 'Glass' };
    var stepBy = metric ? 50 : C.ozToMl(1);

    var list = state.bottles.map(function (b) {
      return '<div class="row bottle-row">' + A.bottleIcon(b.shape, colorHex(b.color)) +
        '<button class="radio" data-use="' + b.id + '" aria-pressed="' + (b.id === state.activeBottleId) + '"><span>' + esc(bottleName(b)) + '<small>' + (b.id === state.activeBottleId ? 'In use · ' + esc(fmt(levelOf(b))) + ' left' : 'Tap to switch') + '</small></span></button><span></span></div>';
    }).join('');

    var addForm = canAdd
      ? '<div class="field"><span class="flabel">Add a bottle</span><div class="shape-grid">' +
          Object.keys(names).map(function (s) { return '<button class="shape" data-shape="' + s + '" aria-pressed="' + (s === draft.shape) + '">' + A.bottleIcon(s, colorHex(draft.color)) + names[s] + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="flabel">Size</span><div class="stepper"><button data-bstep="-1" aria-label="Smaller">−</button><output id="bSize"></output><button data-bstep="1" aria-label="Bigger">+</button></div></div>' +
        '<div class="field"><span class="flabel">Lid color</span><div class="swatches">' +
          C.BOTTLE_COLORS.map(function (c) { return '<button class="swatch" data-color="' + c.id + '" aria-pressed="' + (c.id === draft.color) + '" aria-label="' + c.name + '" style="background:' + c.hex + '"></button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="flabel">What’s usually in it?</span><div class="chips">' +
          C.DRINKS.filter(function (d) { return d.free; }).map(function (d) { return '<button class="chip" data-bdrink="' + d.id + '" aria-pressed="' + (d.id === draft.drink) + '">' + esc(d.name) + '</button>'; }).join('') + '</div></div>' +
        '<button class="btn btn--primary btn--block" id="bAdd"></button>'
      : '<div class="free-note"><b>The free app holds ' + FREE_BOTTLES + ' bottles.</b> Plus lets you add every bottle you own.</div><button class="btn btn--plus btn--block" data-pw>See Plus</button>';

    openSheet('Your bottles', '<div class="card rows" style="box-shadow:none;background:var(--surface-2)">' + list + '</div>' + addForm, function (sheet) {
      function paint() {
        if (!canAdd) return;
        var tmp = { shape: draft.shape, ml: draft.ml };
        $('#bSize', sheet).textContent = fmt(draft.ml);
        $('#bAdd', sheet).textContent = 'Add ' + C.bottleLabel(tmp, units());
        $$('[data-shape]', sheet).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-shape') === draft.shape));
          var icon = b.querySelector('.bottle-icon'); if (icon) icon.style.setProperty('--bottle-color', colorHex(draft.color));
        });
        $$('[data-color]', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-color') === draft.color)); });
        $$('[data-bdrink]', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-bdrink') === draft.drink)); });
      }
      paint();
      if (startAdding && canAdd) { var s0 = $('[data-shape]', sheet); if (s0) s0.scrollIntoView({ block: 'center' }); }
      sheet.addEventListener('click', function (e) {
        var u = e.target.closest('[data-use]');
        if (u) { state.activeBottleId = u.getAttribute('data-use'); closeSheet(); commit(); toast('Switched to your ' + C.bottleLabel(activeBottle(), units())); return; }
        if (e.target.closest('[data-pw]')) { openPaywall(); return; }
        var sh = e.target.closest('[data-shape]');
        if (sh) { draft.shape = sh.getAttribute('data-shape'); draft.ml = defaults[draft.shape]; paint(); }
        var st = e.target.closest('[data-bstep]');
        if (st) { draft.ml = Math.max(metric ? 100 : C.ozToMl(4), Math.min(metric ? 7500 : C.ozToMl(256), draft.ml + (+st.getAttribute('data-bstep')) * stepBy)); paint(); }
        var co = e.target.closest('[data-color]');
        if (co) { draft.color = co.getAttribute('data-color'); paint(); }
        var dr = e.target.closest('[data-bdrink]');
        if (dr) { draft.drink = dr.getAttribute('data-bdrink'); paint(); }
        if (e.target.closest('#bAdd')) {
          var b = { id: newId(), shape: draft.shape, ml: Math.round(draft.ml), color: draft.color, drink: draft.drink };
          state.bottles.push(b);
          state.levels[b.id] = b.ml;
          state.activeBottleId = b.id;
          closeSheet(); commit();
          toast('Added your ' + C.bottleLabel(b, units()) + '. It starts full.');
        }
      });
    });
  }

  function goalBody(t) {
    var metric = units() === 'ml';
    return '<div class="field"><label for="gWeight">Your weight</label><div class="timepair"><input type="number" id="gWeight" inputmode="decimal" min="50" max="700" value="' + esc(t.profile.weight) + '">' +
        '<div class="seg" role="group" aria-label="Weight unit"><button data-wu="lb" aria-pressed="' + (t.profile.weightUnit === 'lb') + '">lb</button><button data-wu="kg" aria-pressed="' + (t.profile.weightUnit === 'kg') + '">kg</button></div></div></div>' +
      '<div class="field"><span class="flabel">Your usual day</span><div class="activity">' +
        [['low', 'Mostly sitting'], ['moderate', 'On my feet a lot'], ['high', 'Physical work or hard workouts']].map(function (a) {
          return '<button class="chip" data-act-level="' + a[0] + '" aria-pressed="' + (t.profile.activity === a[0]) + '">' + a[1] + '</button>';
        }).join('') + '</div></div>' +
      '<div class="row" style="border:0;padding:0"><span class="label"><b>I work or live somewhere hot</b><span>Adds a little extra</span></span><label class="switch"><input type="checkbox" id="gHot" ' + (t.profile.hot ? 'checked' : '') + '><span></span><b class="sr">Hot</b></label></div>' +
      '<p class="fine" id="gHint" hidden></p>' +
      '<div class="goal-preview"><span class="label"><b>Daily goal</b><span class="fine">Adjust it if you like</span></span><div class="stepper"><button data-g="-1" aria-label="Lower">−</button><output id="gOut"></output><button data-g="1" aria-label="Higher">+</button></div></div>' +
      '<p class="fine">Starting point: half your weight (lb) in ounces, plus extra for activity and heat. This is general guidance, not medical advice. If a doctor has given you a fluid limit, use their number.' + (metric ? '' : '') + '</p>';
  }

  function bindGoal(root, t, onChange) {
    var gStep = units() === 'ml' ? 100 : C.ozToMl(4);
    function validWeight() {
      var w = Number(t.profile.weight), lb = t.profile.weightUnit === 'kg' ? w * 2.20462 : w;
      return w > 0 && lb >= 60 && lb <= 700;
    }
    // A blank or impossible weight keeps the current goal and says why.
    function recalc() {
      var ok = validWeight();
      var hint = $('#gHint', root);
      if (hint) {
        hint.hidden = ok;
        hint.textContent = 'Enter a weight between ' + (t.profile.weightUnit === 'kg' ? '28 and 317 kg' : '60 and 700 lb') + ' to recalculate.';
      }
      if (ok) t.goalMl = C.calcGoalMl(t.profile);
      paint();
    }
    function paint() {
      $('#gOut', root).textContent = fmt(t.goalMl);
      $$('[data-wu]', root).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-wu') === t.profile.weightUnit)); });
      $$('[data-act-level]', root).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-act-level') === t.profile.activity)); });
      if (onChange) onChange();
    }
    paint();
    $('#gWeight', root).addEventListener('input', function (e) { t.profile.weight = +e.target.value; recalc(); });
    $('#gHot', root).addEventListener('change', function (e) { t.profile.hot = e.target.checked; recalc(); });
    root.addEventListener('click', function (e) {
      var wu = e.target.closest('[data-wu]');
      if (wu) {
        var to = wu.getAttribute('data-wu');
        if (to !== t.profile.weightUnit) {
          t.profile.weight = Math.round(to === 'kg' ? t.profile.weight / 2.20462 : t.profile.weight * 2.20462);
          t.profile.weightUnit = to;
          $('#gWeight', root).value = t.profile.weight;
        }
        recalc();
      }
      var al = e.target.closest('[data-act-level]');
      if (al) { t.profile.activity = al.getAttribute('data-act-level'); recalc(); }
      var g = e.target.closest('[data-g]');
      if (g) { t.goalMl = Math.max(C.ozToMl(32), Math.min(C.ozToMl(200), t.goalMl + (+g.getAttribute('data-g')) * gStep)); paint(); }
    });
  }

  function openGoalSheet() {
    var t = { profile: JSON.parse(JSON.stringify(state.profile)), goalMl: state.goalMl };
    openSheet('Daily goal', goalBody(t) + '<button class="btn btn--primary btn--block" id="gSave">Save goal</button>', function (sheet) {
      bindGoal(sheet, t);
      $('#gSave', sheet).addEventListener('click', function () {
        snapshot();
        state.profile = t.profile; state.goalMl = Math.round(t.goalMl);
        closeSheet(); commit();
        toast('Goal set to ' + fmt(state.goalMl), { undo: true });
      });
    });
  }

  function sleepMidpoint(wake, bed) {
    var sleepLen = ((wake - bed) + 1440) % 1440;
    var mid = (bed + sleepLen / 2) % 1440;
    return Math.round(mid / 30) * 30 % 1440;
  }

  function openDayEndSheet() {
    var val = state.dayEndMin;
    var r = state.reminders;
    var suggest = sleepMidpoint(r.start, r.end);
    var presets = [[0, 'Midnight'], [180, '3:00 AM'], [360, '6:00 AM'], [660, '11:00 AM']];
    var body =
      '<p class="fine" style="font-size:15px">Most apps start a new day at midnight. If you’re up late or work nights, that splits your day in two. Pick a time when you’re usually asleep.</p>' +
      '<div class="chips">' + presets.map(function (p) { return '<button class="chip" data-de="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<div class="field"><label for="deTime">Or pick a time</label><input type="time" id="deTime" value="' + toHHMM(val) + '"></div>' +
      '<div class="rolls">Based on your awake hours (' + esc(C.fmtMinutes(r.start)) + ' to ' + esc(C.fmtMinutes(r.end)) + '), the middle of your sleep is <b>' + esc(C.fmtMinutes(suggest)) + '</b>. <button class="linkbtn" data-de="' + suggest + '">Use it</button></div>' +
      '<button class="btn btn--primary btn--block" id="deSave">Save</button>';
    openSheet('When does your day end?', body, function (sheet) {
      function paint() {
        $('#deTime', sheet).value = toHHMM(val);
        $$('.chip[data-de]', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-de') === val)); });
      }
      paint();
      sheet.addEventListener('click', function (e) {
        var d = e.target.closest('[data-de]');
        if (d) { val = +d.getAttribute('data-de'); paint(); }
        if (e.target.closest('#deSave')) {
          snapshot(); state.dayEndMin = val; closeSheet(); commit();
          toast('Your day now ends ' + (val === 0 ? 'at midnight' : 'at ' + C.fmtMinutes(val)), { undo: true });
        }
      });
      $('#deTime', sheet).addEventListener('change', function (e) { if (e.target.value) { val = fromHHMM(e.target.value); paint(); } });
    });
  }

  function openShiftSheet() {
    var r = state.reminders;
    var sched = JSON.parse(JSON.stringify(r.schedule && r.schedule.length === 7 ? r.schedule : schedule(r.start, r.end)));
    var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function rows() {
      return names.map(function (n, i) {
        var s = sched[i];
        return '<div class="sched-row"><b>' + n + '</b><label class="switch"><input type="checkbox" data-son="' + i + '" ' + (s.on ? 'checked' : '') + '><span></span><b class="sr">' + n + ' on</b></label>' +
          '<div class="timepair"><input type="time" data-sstart="' + i + '" value="' + toHHMM(s.start) + '" aria-label="' + n + ' awake from" ' + (s.on ? '' : 'disabled') + '><input type="time" data-send="' + i + '" value="' + toHHMM(s.end) + '" aria-label="' + n + ' awake until" ' + (s.on ? '' : 'disabled') + '></div></div>';
      }).join('');
    }
    var body = '<p class="fine" style="font-size:15px">Set your awake hours for each day. Night shift? Put in something like 3:00 PM to 7:00 AM. Days switched off get no reminders.</p>' +
      '<div class="chips"><button class="chip" data-copy>Copy Monday to all weekdays</button><button class="chip" data-nights>Night shift Mon–Fri</button></div>' +
      '<div class="sched" id="schedRows">' + rows() + '</div>' +
      '<button class="btn btn--primary btn--block" id="sSave">Use this schedule</button>' +
      (r.shift ? '<button class="btn btn--ghost btn--block" id="sOff">Turn off shift schedule</button>' : '');
    openSheet('Shift schedule', body, function (sheet) {
      function redraw() { $('#schedRows', sheet).innerHTML = rows(); }
      sheet.addEventListener('change', function (e) {
        var t = e.target;
        if (t.hasAttribute('data-son')) { sched[+t.getAttribute('data-son')].on = t.checked; redraw(); }
        if (t.hasAttribute('data-sstart') && t.value) sched[+t.getAttribute('data-sstart')].start = fromHHMM(t.value);
        if (t.hasAttribute('data-send') && t.value) sched[+t.getAttribute('data-send')].end = fromHHMM(t.value);
      });
      sheet.addEventListener('click', function (e) {
        if (e.target.closest('[data-copy]')) { for (var i = 2; i <= 5; i++) sched[i] = JSON.parse(JSON.stringify(sched[1])); redraw(); }
        if (e.target.closest('[data-nights]')) { for (var j = 1; j <= 5; j++) sched[j] = { on: true, start: 900, end: 420 }; sched[0] = { on: true, start: 600, end: 1380 }; sched[6] = { on: true, start: 600, end: 1380 }; redraw(); }
        if (e.target.closest('#sSave')) {
          snapshot(); state.reminders.schedule = sched; state.reminders.shift = true; closeSheet(); commit();
          toast('Shift schedule is on', { undo: true });
        }
        if (e.target.closest('#sOff')) { snapshot(); state.reminders.shift = false; closeSheet(); commit(); toast('Using the same hours every day', { undo: true }); }
      });
    });
  }

  /* ---------------- Onboarding ---------------- */
  var ob = null;
  function renderOnboarding() {
    var host = $('#onboard');
    host.hidden = false;
    if (!ob) ob = { step: 0, units: 'oz', profile: { weight: 170, weightUnit: 'lb', activity: 'moderate', hot: false }, goalMl: 0, bottle: { shape: 'tumbler', color: 'river' }, wake: 420, bed: 1380, remind: true };
    if (!ob.goalMl) ob.goalMl = C.calcGoalMl(ob.profile);
    var dots = '<div class="dots" aria-hidden="true">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i === ob.step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    var back = '<button class="iconbtn" data-ob="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>';
    var html = '';

    if (ob.step === 0) {
      html = '<div class="ob"><div class="welcome"><span id="obDrip"></span><div class="wordmark">Hydr<b>ippo</b></div>' +
        '<p class="lede">Drink from your own bottle. Drip keeps count.</p>' +
        '<ul class="welcome-points">' +
          '<li>' + ICON.bottle + '<span><b>Your bottle is the button.</b> Slide the water line to where your bottle is now. That’s it.</span></li>' +
          '<li>' + ICON.moon + '<span><b>Your day, your hours.</b> Work nights? Your day ends when you sleep, not at midnight.</span></li>' +
          '<li>' + ICON.shield + '<span><b>No ads. No account.</b> Everything stays on your phone.</span></li>' +
        '</ul></div>' +
        '<div class="ob-actions"><button class="btn btn--primary btn--block" data-ob="next">Set up in 30 seconds</button><button class="btn btn--ghost btn--block" data-ob="sample">Look around with a sample day</button></div></div>';
    } else if (ob.step === 1) {
      html = '<div class="ob"><div class="ob-top">' + back + dots + '<span style="width:44px"></span></div>' +
        '<div class="ob-body"><h1>Your daily goal</h1>' +
        '<div class="row" style="border:0;padding:0"><span class="label"><b>Units</b></span><div class="seg" role="group" aria-label="Units"><button data-obu="oz" aria-pressed="' + (ob.units === 'oz') + '">oz</button><button data-obu="ml" aria-pressed="' + (ob.units === 'ml') + '">ml</button></div></div>' +
        '<div id="obGoal"></div></div>' +
        '<div class="ob-actions"><button class="btn btn--primary btn--block" data-ob="next">Next</button></div></div>';
    } else if (ob.step === 2) {
      var shapes = { tumbler: ['40 oz tumbler', '1.2 L tumbler'], sport: ['32 oz bottle', '750 ml bottle'], jug: ['Gallon jug', '4 L jug'], disposable: ['16.9 oz bottle', '500 ml bottle'], glass: ['8 oz glass', '250 ml glass'] };
      html = '<div class="ob"><div class="ob-top">' + back + dots + '<span style="width:44px"></span></div>' +
        '<div class="ob-body"><h1>Which bottle do you use most?</h1><p class="lede">You can add more later.</p>' +
        '<div class="shape-grid">' + Object.keys(shapes).map(function (s) {
          return '<button class="shape" data-obs="' + s + '" aria-pressed="' + (ob.bottle.shape === s) + '">' + A.bottleIcon(s, colorHex(ob.bottle.color)) + shapes[s][ob.units === 'ml' ? 1 : 0] + '</button>';
        }).join('') + '</div>' +
        '<div class="field"><span class="flabel">Lid color</span><div class="swatches">' + C.BOTTLE_COLORS.map(function (c) {
          return '<button class="swatch" data-obc="' + c.id + '" aria-pressed="' + (ob.bottle.color === c.id) + '" aria-label="' + c.name + '" style="background:' + c.hex + '"></button>';
        }).join('') + '</div></div></div>' +
        '<div class="ob-actions"><button class="btn btn--primary btn--block" data-ob="next">Next</button></div></div>';
    } else if (ob.step === 3) {
      var de = sleepMidpoint(ob.wake, ob.bed);
      html = '<div class="ob"><div class="ob-top">' + back + dots + '<span style="width:44px"></span></div>' +
        '<div class="ob-body"><h1>When are you usually awake?</h1><p class="lede">Reminders stay inside these hours, and your day rolls over while you sleep.</p>' +
        '<div class="chips"><button class="chip" data-obh="day" aria-pressed="' + (ob.wake === 420 && ob.bed === 1380) + '">Day schedule</button><button class="chip" data-obh="night" aria-pressed="' + (ob.wake === 900 && ob.bed === 450) + '">' + ICON.moon + 'Night shift</button></div>' +
        '<div class="timepair"><div class="field"><label for="obWake">I wake up around</label><input type="time" id="obWake" value="' + toHHMM(ob.wake) + '"></div><div class="field"><label for="obBed">I go to sleep around</label><input type="time" id="obBed" value="' + toHHMM(ob.bed) + '"></div></div>' +
        '<div class="rolls" id="obRoll">Your day will roll over at <b>' + esc(de === 0 ? 'midnight' : C.fmtMinutes(de)) + '</b>, while you’re asleep. A drink at 1 AM still counts for the day you were living.</div></div>' +
        '<div class="ob-actions"><button class="btn btn--primary btn--block" data-ob="next">Next</button></div></div>';
    } else {
      html = '<div class="ob"><div class="ob-top">' + back + dots + '<span style="width:44px"></span></div>' +
        '<div class="ob-body" style="align-items:center;text-align:center"><span id="obDrip"></span><h1>Want a nudge when Drip’s pond gets low?</h1>' +
        '<p class="lede" style="margin:0 auto">Every 90 minutes between ' + esc(C.fmtMinutes(ob.wake)) + ' and ' + esc(C.fmtMinutes(ob.bed)) + '. Change it anytime.</p></div>' +
        '<div class="ob-actions"><button class="btn btn--primary btn--block" data-ob="remind-yes">' + ICON.bell + 'Yes, remind me</button><button class="btn btn--ghost btn--block" data-ob="remind-no">Not now</button></div></div>';
    }
    host.innerHTML = html;

    var slot = $('#obDrip', host);
    if (slot) {
      var d = A.drip({ fill: 0.15 });
      var target = ob.step === 0 ? 0.82 : 1;
      slot.replaceWith(d.el);
      setTimeout(function () { d.update({ fill: target }); }, 350);
    }
    if (ob.step === 1) {
      var t = { profile: ob.profile, goalMl: ob.goalMl };
      var g = $('#obGoal', host);
      var prevUnits = state.units;
      state.units = ob.units; // goal UI formats in the chosen units
      g.innerHTML = goalBody(t);
      bindGoal(g, t, function () { ob.goalMl = t.goalMl; });
      state.units = prevUnits;
    }
    host.scrollTop = 0;
    host.onclick = onboardClick;
    host.onchange = function (e) {
      if (e.target.id === 'obWake' && e.target.value) { ob.wake = fromHHMM(e.target.value); renderOnboarding(); }
      if (e.target.id === 'obBed' && e.target.value) { ob.bed = fromHHMM(e.target.value); renderOnboarding(); }
    };
  }

  function onboardClick(e) {
    var t = e.target.closest('[data-ob],[data-obu],[data-obs],[data-obc],[data-obh]');
    if (!t) return;
    // Keep goal formatting in the chosen units during onboarding.
    if (t.hasAttribute('data-obu')) { ob.units = t.getAttribute('data-obu'); state.units = ob.units; renderOnboarding(); return; }
    if (t.hasAttribute('data-obs')) { ob.bottle.shape = t.getAttribute('data-obs'); renderOnboarding(); return; }
    if (t.hasAttribute('data-obc')) { ob.bottle.color = t.getAttribute('data-obc'); renderOnboarding(); return; }
    if (t.hasAttribute('data-obh')) {
      if (t.getAttribute('data-obh') === 'day') { ob.wake = 420; ob.bed = 1380; } else { ob.wake = 900; ob.bed = 450; }
      renderOnboarding(); return;
    }
    var a = t.getAttribute('data-ob');
    if (a === 'back') { ob.step = Math.max(0, ob.step - 1); renderOnboarding(); return; }
    if (a === 'next') { ob.step++; renderOnboarding(); return; }
    if (a === 'sample') { state = sampleState(state.plus, state.plusTest); ob = null; ui.tab = 'today'; commit(); toast('Sample day loaded. Try dragging the water line.'); return; }
    if (a === 'remind-yes' || a === 'remind-no') {
      var yes = a === 'remind-yes';
      finishOnboarding(yes);
      if (yes) P.requestNotificationPermission();
    }
  }

  function finishOnboarding(remind) {
    var metric = ob.units === 'ml';
    var sizes = {
      tumbler: metric ? 1200 : C.ozToMl(40), sport: metric ? 750 : C.ozToMl(32), jug: metric ? 4000 : C.ozToMl(128),
      disposable: 500, glass: metric ? 250 : C.ozToMl(8)
    };
    var b = { id: 'b1', shape: ob.bottle.shape, ml: Math.round(sizes[ob.bottle.shape]), color: ob.bottle.color, drink: 'water' };
    var plus = state.plus, plusTest = state.plusTest;
    state = defaultState();
    state.plus = plus; state.plusTest = plusTest;
    state.units = ob.units;
    state.profile = ob.profile;
    state.goalMl = Math.round(ob.goalMl);
    state.bottles = [b]; state.activeBottleId = b.id; state.levels = {}; state.levels[b.id] = b.ml;
    state.dayEndMin = sleepMidpoint(ob.wake, ob.bed);
    state.reminders.start = ob.wake; state.reminders.end = ob.bed; state.reminders.on = !!remind;
    state.reminders.schedule = schedule(ob.wake, ob.bed);
    state.onboarded = true;
    ob = null;
    ui.tab = 'today';
    commit();
    toast('You’re set. Drag the line when you drink.');
  }

  /* ---------------- Sample data ---------------- */
  function sampleState(plus, plusTest) {
    var s = defaultState();
    s.plus = !!plus; s.plusTest = !!plusTest;
    s.onboarded = true; s.sample = true;
    s.goalMl = Math.round(C.ozToMl(96));
    s.dayEndMin = 180;
    s.bottles = [
      { id: 'b1', shape: 'tumbler', ml: Math.round(C.ozToMl(40)), color: 'river', drink: 'water' },
      { id: 'b2', shape: 'jug', ml: Math.round(C.ozToMl(128)), color: 'reed', drink: 'water' }
    ];
    s.activeBottleId = 'b1';
    s.reminders.start = 420; s.reminders.end = 1380; s.reminders.schedule = schedule(420, 1380);
    var t = now();
    var today = C.dayKey(t, s.dayEndMin);
    var sips = [10, 8, 12, 9, 11, 7, 10, 12];
    var targets = [104, 88, 100, 70, 97, 99, 92]; // oz, oldest first (6 past days + spare)
    var log = [], refills = [];
    function fillDay(key, targetOz, limitTs) {
      var r = C.dayRange(key, s.dayEndMin);
      var t0 = r.start + (420 - s.dayEndMin) * 60000 + 25 * 60000;
      var total = 0, i = 0, inBottle = 40;
      if (!limitTs || t0 < limitTs) {
        log.push({ id: newId(), ts: t0, ml: Math.round(C.ozToMl(12)), drink: 'coffee', src: 'quick' });
        total += 12;
      }
      var ts = t0 + 50 * 60000;
      while (total < targetOz && (!limitTs || ts < limitTs)) {
        var oz = Math.min(sips[i % sips.length], targetOz - total);
        if (oz > inBottle) { refills.push({ ts: ts - 60000, bottleId: 'b1' }); inBottle = 40; }
        log.push({ id: newId(), ts: ts, ml: Math.round(C.ozToMl(oz)), drink: 'water', src: 'bottle', bottleId: 'b1' });
        inBottle -= oz; total += oz; i++;
        ts += (48 + (i * 7) % 25) * 60000;
      }
      return inBottle;
    }
    for (var d = 6; d >= 1; d--) fillDay(C.addDays(today, -d), targets[6 - d]);
    var left = fillDay(today, 96, t - 5 * 60000);
    s.log = log; s.refills = refills;
    s.levels = { b1: Math.round(C.ozToMl(Math.max(0, left))), b2: Math.round(C.ozToMl(128)) };
    return s;
  }

  /* ---------------- Global events ---------------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (tab) { ui.tab = tab.getAttribute('data-tab'); ui.resetArmed = false; render(); $('#screen').scrollTop = 0; window.scrollTo(0, 0); return; }
    var t = e.target.closest('[data-act]');
    if (!t || t.closest('.sheet')) return;
    var act = t.getAttribute('data-act');
    switch (act) {
      case 'bottles': openBottleSheet(false); break;
      case 'add-bottle': if (state.plus || state.bottles.length < FREE_BOTTLES) openBottleSheet(true); else openPaywall(); break;
      case 'finish': finishBottle(); break;
      case 'refill': refill(); break;
      case 'quick': {
        var qd = C.drinkById(t.getAttribute('data-drink'));
        if (!qd.free && !plusGate()) break;
        logQuick(+t.getAttribute('data-ml'), qd.id); break;
      }
      case 'edit-quick': openQuickSheet(); break;
      case 'edit-entry': {
        var en = state.log.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        if (en) openEntrySheet(en); break;
      }
      case 'add-entry': openEntrySheet(null, t.getAttribute('data-key')); break;
      case 'boost': {
        var bk = todayKey();
        snapshot();
        state.boosts = state.boosts || {};
        if (state.boosts[bk]) { delete state.boosts[bk]; commit(); toast('Back to your usual goal today', { undo: true }); }
        else { state.boosts[bk] = q(boostMl()); commit(); toast('Hot day: today’s goal is ' + fmt(todayGoal()), { undo: true }); }
        break;
      }
      case 'more-days': ui.histShow = (ui.histShow || 14) + 30; render(); break;
      case 'share-card': shareCard(); break;
      case 'rem-help': openReminderHelp(); break;
      case 'privacy': openPrivacy(); break;
      case 'backup-save': {
        var payload = JSON.stringify({ app: 'hydrippo', version: 1, savedAt: now(), state: state });
        P.saveBackup(payload, 'hydrippo-backup-' + C.ymd(new Date(now())) + '.json').then(function (r) {
          toast(r.how === 'share' ? 'Backup ready. Save it to Drive or send it to yourself.' : r.ok ? 'Backup copied. Paste it into a note or email to keep it.' : 'Couldn’t make a backup on this device.');
        });
        break;
      }
      case 'restore-confirm': {
        var plusNow = state.plus, ptNow = state.plusTest;
        snapshot();
        state = migrate(ui.restore.state); state.plus = plusNow; state.plusTest = ptNow;
        ui.restore = null; art.bottle = null; lastKey = null;
        commit(); toast('Backup restored', { undo: true }); break;
      }
      case 'restore-cancel': ui.restore = null; render(); break;
      case 'drinks': openDrinkSheet(); break;
      case 'del-entry': deleteEntry(t.getAttribute('data-id')); break;
      case 'clear-sample': {
        var plus = state.plus, pt = state.plusTest;
        state = defaultState(); state.plus = plus; state.plusTest = pt; art.bottle = null; commit(); break;
      }
      case 'toggle-day': { var k = t.getAttribute('data-key'); ui.open[k] = !ui.open[k]; render(); break; }
      case 'range': { var rg = +t.getAttribute('data-range'); if (rg === 30 && !plusGate()) break; ui.range = rg; render(); break; }
      case 'export': {
        if (!plusGate()) break;
        P.exportCsv(C.toCsv(state.log, state.dayEndMin, state.units)).then(function (r) {
          toast(r.ok ? 'CSV copied. Paste it into Google Sheets or Excel.' : 'Couldn’t copy the CSV on this device.');
        });
        break;
      }
      case 'paywall': openPaywall(); break;
      case 'goal': openGoalSheet(); break;
      case 'units': snapshot(); state.units = t.getAttribute('data-units'); art.bottle = null; commit(); break;
      case 'dayend': openDayEndSheet(); break;
      case 'every': snapshot(); state.reminders.everyMin = +t.getAttribute('data-min'); commit(); break;
      case 'shift': if (plusGate()) openShiftSheet(); break;
      case 'test-reminder': showBanner(C.reminderLine(now() / 60000)); break;
      case 'use-bottle': state.activeBottleId = t.getAttribute('data-id'); commit(); toast('Now using your ' + C.bottleLabel(activeBottle(), units())); break;
      case 'del-bottle': {
        var id = t.getAttribute('data-id');
        snapshot();
        state.bottles = state.bottles.filter(function (b) { return b.id !== id; });
        delete state.levels[id];
        if (state.activeBottleId === id) state.activeBottleId = state.bottles[0].id;
        commit(); toast('Bottle removed', { undo: true }); break;
      }
      case 'acc': {
        var ac = t.getAttribute('data-acc');
        if (ac === 'crown' && !lookAllowed('crown')) { toast('Hit your goal ' + CROWN_DAYS + ' days in a row to earn the crown. Best so far: ' + bestStreak() + '.'); break; }
        if (ac !== 'none' && ac !== 'crown' && !plusGate()) break;
        state.accessory = ac; commit(); break;
      }
      case 'restore':
        P.restore().then(function (r) {
          if (r.ok && r.plus) { state.plus = true; state.plusTest = false; commit(); toast('Plus restored'); }
          else if (r.ok) toast(r.test ? 'Prototype: no purchases to restore.' : 'No Plus purchase found on this Google account.');
          else toast(r.error || 'Couldn’t reach Google Play.');
        });
        break;
      case 'plus-off': state.plus = false; state.plusTest = false; state.reminders.smart = false; state.reminders.shift = false; commit(); toast('Back to the free version'); break;
      case 'sample-week': { var p = state.plus, pt2 = state.plusTest; state = sampleState(p, pt2); art.bottle = null; ui.tab = 'history'; commit(); toast('Sample week loaded'); break; }
      case 'reset-arm': ui.resetArmed = true; render(); break;
      case 'reset-cancel': ui.resetArmed = false; render(); break;
      case 'reset-confirm': S.clear(); state = defaultState(); ui = { tab: 'today', open: {}, range: 7, resetArmed: false }; art.bottle = null; ob = null; commit(); break;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!state || t.closest('.sheet') || t.closest('#onboard')) return;
    if (t.id === 'set-wateronly') { snapshot(); state.waterOnly = t.checked; commit(); }
    if (t.id === 'set-rem-on') {
      state.reminders.on = t.checked; commit();
      if (t.checked) P.requestNotificationPermission();
    }
    if (t.id === 'set-rem-start' && t.value) { state.reminders.start = fromHHMM(t.value); commit(); }
    if (t.id === 'set-rem-end' && t.value) { state.reminders.end = fromHHMM(t.value); commit(); }
    if (t.id === 'set-rem-smart') { state.reminders.smart = t.checked; commit(); }
    if (t.id === 'set-showdrip') { state.showDrip = t.checked; commit(); }
    if (t.id === 'set-weather') {
      state.weather.on = t.checked; commit();
      if (t.checked && state.weather.lat != null) checkWeather(true);
    }
    if (t.id === 'set-zip') {
      var z = C.zipToLatLng(t.value, window.HydZip3);
      if (!z) { toast('We couldn’t find that ZIP code. US ZIP codes only for now.'); return; }
      state.weather.zip = t.value.replace(/\D/g, ''); state.weather.lat = z.lat; state.weather.lng = z.lng;
      state.weather.url = null; state.weather.checked = null; state.weather.high = null;
      commit(); checkWeather(true);
    }
    if (t.id === 'set-hc') {
      if (!t.checked) {
        state.hc.on = false; commit();
        toast('Stopped syncing. Drinks already added stay in Health Connect.');
        return;
      }
      P.hcAvailable().then(function (av) {
        if (!av || !av.available) {
          t.checked = false;
          var reason = av && av.reason;
          if (reason === 'web') toast('Health Connect sync works in the Android app.');
          else if (reason === 'update') toast('Health Connect needs an update first.', { action: { label: 'Update', run: P.hcInstall } });
          else if (reason === 'unavailable') toast('Install Health Connect from Google Play, then try again.', { action: { label: 'Get it', run: P.hcInstall } });
          else toast('Health Connect isn’t available on this phone.');
          return;
        }
        P.hcRequest().then(function (ok) {
          if (!ok) { t.checked = false; toast('Permission not given. You can turn this on anytime.'); return; }
          state.hc = state.hc || { synced: {} }; state.hc.on = true; state.hc.synced = state.hc.synced || {};
          commit(); hcSync();
          toast('Syncing your last 14 days to Health Connect');
        });
      });
    }
    if (t.id === 'set-restore' && t.files && t.files[0]) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var b = JSON.parse(String(reader.result));
          if (!b || b.app !== 'hydrippo' || !b.state || !Array.isArray(b.state.log) || !Array.isArray(b.state.bottles)) throw new Error('not a backup');
          ui.restore = b; render();
        } catch (err) { toast('That file isn’t a Hydrippo backup.'); }
      };
      reader.readAsText(t.files[0]);
    }
  });

  // Keep "today" fresh if the app stays open across the day rollover. Sheets live outside
  // #screen, so redrawing the screen underneath an open sheet is safe.
  var lastKey = null;
  function refreshIfNewDay() {
    if (!state || !state.onboarded) return;
    var k = todayKey();
    if (k === lastKey) return;
    lastKey = k;
    render();
    checkWeather(false);
  }
  setInterval(refreshIfNewDay, 30000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { S.flush(); return; }
    if (!state || !state.onboarded) return;
    mergeWidgetLogs();
    lastKey = null;
    refreshIfNewDay();
    checkWeather(false);
    hcSync();
  });
  // Write any pending save right away when the app is closed or sent to the background.
  window.addEventListener('pagehide', function () { S.flush(); });

  // Pull in drinks logged from the home-screen widget while the app was closed.
  function mergeWidgetLogs() {
    P.takePendingLogs().then(function (logs) {
      if (!logs.length) return;
      var added = 0;
      logs.forEach(function (l) {
        var ts = +l.ts, ml = +l.ml;
        if (!(ts > 0) || !(ml > 0) || ml > 5000) return;
        state.log.push({ id: newId(), ts: ts, ml: q(ml), drink: 'water', src: 'widget' });
        added++;
      });
      if (added) { undoSnap = null; commit(); }
    });
  }

  /* ---------------- Boot ---------------- */
  // Android back button: close a sheet, then go back to Today, then leave the app.
  P.onBackButton(function () {
    if ($('#sheet-root').innerHTML) { closeSheet(); return true; }
    if (!state.onboarded && ob && ob.step > 0) { ob.step--; renderOnboarding(); return true; }
    if (state.onboarded && ui.tab !== 'today') { ui.tab = 'today'; render(); return true; }
    return false;
  });

  S.load().then(function (loaded) {
    state = migrate(loaded);
    lastKey = state.onboarded ? todayKey() : null;
    render();
    planReminders();
    if (state.onboarded) { pushWidget(); mergeWidgetLogs(); checkWeather(false); hcSync(); }
    P.onReminderAction('Log ' + fmt(quickAddMl()), function () { logQuick(quickAddMl(), 'water'); });
    // On Android, Google Play decides whether Plus is active; the saved flag is only a cache.
    P.init().then(P.checkPlus).then(function (r) {
      if (r && r.known && r.plus !== state.plus) { state.plus = r.plus; state.plusTest = false; commit(); }
    });
  });
})();
