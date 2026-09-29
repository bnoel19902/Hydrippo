/*
 * Hydrippo core logic — pure functions, no DOM.
 * Runs in the browser (window.HydCore) and in Node (require) for tests.
 * All volumes are stored in millilitres (ml). Display units are converted at the edge.
 */
(function (root) {
  'use strict';

  var ML_PER_OZ = 29.5735; // US fluid ounce
  var MIN_PER_DAY = 1440;

  /* ---------- Units ---------- */

  function mlToOz(ml) { return ml / ML_PER_OZ; }
  function ozToMl(oz) { return oz * ML_PER_OZ; }

  // Snap step used for dragging and steppers: 1 oz, or 10 ml.
  function stepMl(units) { return units === 'ml' ? 10 : ML_PER_OZ; }

  function snapMl(ml, units) {
    var s = stepMl(units);
    return Math.round(ml / s) * s;
  }

  // Number shown to the user (no unit).
  function displayNumber(ml, units) {
    if (units === 'ml') {
      if (Math.abs(ml) >= 1000) return (Math.round(ml / 100) / 10).toString();
      return String(Math.round(ml / 10) * 10);
    }
    return String(Math.round(mlToOz(ml)));
  }

  function unitLabel(ml, units) {
    if (units === 'ml') return Math.abs(ml) >= 1000 ? 'L' : 'ml';
    return 'oz';
  }

  // "12 oz", "350 ml", "1.2 L"
  function fmtVol(ml, units) {
    return displayNumber(ml, units) + ' ' + unitLabel(ml, units);
  }

  /* ---------- Daily goal ---------- */

  var ACTIVITY_ADD_OZ = { low: 0, moderate: 12, high: 24 };
  var HEAT_ADD_OZ = 12;
  var GOAL_MIN_OZ = 48;
  var GOAL_MAX_OZ = 160;

  /*
   * Starting-point goal. Common "half your body weight (lb) in ounces" rule of thumb,
   * plus extra for activity and heat, clamped and rounded to 4 oz.
   * This is general guidance, not medical advice. The app always lets people edit it.
   */
  function calcGoalMl(profile) {
    var w = Number(profile && profile.weight) || 0;
    var lb = profile && profile.weightUnit === 'kg' ? w * 2.20462 : w;
    if (!lb || lb < 60 || lb > 700) lb = 160; // sensible fallback
    var oz = lb * 0.5;
    oz += ACTIVITY_ADD_OZ[(profile && profile.activity) || 'low'] || 0;
    if (profile && profile.hot) oz += HEAT_ADD_OZ;
    oz = Math.min(GOAL_MAX_OZ, Math.max(GOAL_MIN_OZ, oz));
    oz = Math.round(oz / 4) * 4;
    return ozToMl(oz);
  }

  /* ---------- The shift-friendly day ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function ymd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseYmd(key) {
    var p = key.split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  /*
   * Which "day" a moment belongs to. dayEndMin = minutes after midnight when the person's day
   * rolls over (0 = midnight, 420 = 7:00 AM for night shift). A drink at 2:00 AM with a 7:00 AM
   * day end counts toward the previous calendar date.
   */
  function dayKey(ts, dayEndMin) {
    // Defined through dayRange so the two always agree, even on daylight-saving days
    // when the day-end time doesn't exist (spring forward) or happens twice (fall back).
    var d = new Date(ts);
    var key = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
    return ts < dayRange(key, dayEndMin).start ? addDays(key, -1) : key;
  }

  // Start/end timestamps of a day key.
  function dayRange(key, dayEndMin) {
    var p = parseYmd(key);
    var start = new Date(p.y, p.m - 1, p.d, 0, dayEndMin || 0, 0, 0).getTime();
    var end = new Date(p.y, p.m - 1, p.d + 1, 0, dayEndMin || 0, 0, 0).getTime();
    return { start: start, end: end };
  }

  function addDays(key, n) {
    var p = parseYmd(key);
    return ymd(new Date(p.y, p.m - 1, p.d + n, 12));
  }

  function weekdayOf(key) {
    var p = parseYmd(key);
    return new Date(p.y, p.m - 1, p.d, 12).getDay();
  }

  /* ---------- Drinks ---------- */

  // caffeine: approximate mg per US fl oz (USDA-style typical values).
  var DRINKS = [
    { id: 'water', name: 'Water', free: true, caffeine: 0 },
    { id: 'coffee', name: 'Coffee', free: true, caffeine: 12 },
    { id: 'tea', name: 'Tea', free: true, caffeine: 6 },
    { id: 'soda', name: 'Soda', free: true, caffeine: 2.8 },
    { id: 'sparkling', name: 'Sparkling water', free: false, caffeine: 0 },
    { id: 'icedcoffee', name: 'Iced coffee', free: false, caffeine: 10 },
    { id: 'decaf', name: 'Decaf coffee', free: false, caffeine: 0.3 },
    { id: 'herbal', name: 'Herbal tea', free: false, caffeine: 0 },
    { id: 'milk', name: 'Milk', free: false, caffeine: 0 },
    { id: 'juice', name: 'Juice', free: false, caffeine: 0 },
    { id: 'sports', name: 'Sports drink', free: false, caffeine: 0 },
    { id: 'electrolyte', name: 'Electrolyte mix', free: false, caffeine: 0 },
    { id: 'energy', name: 'Energy drink', free: false, caffeine: 10 },
    { id: 'protein', name: 'Protein shake', free: false, caffeine: 0 },
    { id: 'coconut', name: 'Coconut water', free: false, caffeine: 0 },
    { id: 'lemonade', name: 'Lemonade', free: false, caffeine: 0 }
  ];

  function drinkById(id) {
    for (var i = 0; i < DRINKS.length; i++) if (DRINKS[i].id === id) return DRINKS[i];
    return DRINKS[0];
  }

  function counts(entry, waterOnly) {
    if (!waterOnly) return true;
    return entry.drink === 'water' || entry.drink === 'sparkling';
  }

  /* ---------- Bottles ---------- */

  var SHAPES = {
    tumbler: 'tumbler',
    sport: 'bottle',
    jug: 'jug',
    disposable: 'bottle',
    glass: 'glass'
  };

  var BOTTLE_PRESETS = [
    { shape: 'tumbler', ml: ozToMl(40) },
    { shape: 'sport', ml: ozToMl(32) },
    { shape: 'sport', ml: ozToMl(24) },
    { shape: 'jug', ml: ozToMl(128) },
    { shape: 'disposable', ml: 500 },
    { shape: 'glass', ml: ozToMl(8) }
  ];

  var BOTTLE_COLORS = [
    { id: 'reed', hex: '#4F9A6A', name: 'Reed' },
    { id: 'hippo', hex: '#8F7FB0', name: 'Hippo' },
    { id: 'river', hex: '#2E86B8', name: 'River' },
    { id: 'sun', hex: '#E0A92E', name: 'Sun' },
    { id: 'blush', hex: '#E58FA6', name: 'Blush' },
    { id: 'night', hex: '#34495A', name: 'Night' }
  ];

  function bottleLabel(b, units) {
    if (b.name) return b.name;
    if (b.shape === 'jug' && Math.abs(b.ml - ozToMl(128)) < 5 && units !== 'ml') return 'Gallon jug';
    return fmtVol(b.ml, units) + ' ' + (SHAPES[b.shape] || 'bottle');
  }

  /* ---------- Totals & stats ---------- */

  function entriesForDay(log, key, dayEndMin) {
    var r = dayRange(key, dayEndMin);
    var out = [];
    for (var i = 0; i < log.length; i++) {
      if (log[i].ts >= r.start && log[i].ts < r.end) out.push(log[i]);
    }
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out;
  }

  function dayTotalMl(log, key, dayEndMin, waterOnly) {
    var list = entriesForDay(log, key, dayEndMin);
    var t = 0;
    for (var i = 0; i < list.length; i++) if (counts(list[i], waterOnly)) t += list[i].ml;
    return t;
  }

  function dayCaffeineMg(log, key, dayEndMin) {
    var list = entriesForDay(log, key, dayEndMin);
    var mg = 0;
    for (var i = 0; i < list.length; i++) mg += mlToOz(list[i].ml) * drinkById(list[i].drink).caffeine;
    return Math.round(mg / 5) * 5;
  }

  // goal can be a number (ml) or a function(dayKey) -> ml, for days with a boost.
  function goalOf(goal, key) { return typeof goal === 'function' ? goal(key) : goal; }

  // "Reached" matches what the screen shows: within half an ounce (15 ml) counts, so a
  // display of "104 / 104 oz" never says you're still behind.
  var GOAL_TOLERANCE_ML = 15;
  function reached(totalMl, goalMl) { return totalMl + GOAL_TOLERANCE_ML >= goalMl; }

  // Consecutive goal-met days ending today (or yesterday while today is still in progress).
  function streak(log, now, dayEndMin, goal, waterOnly) {
    var today = dayKey(now, dayEndMin);
    var n = 0;
    var key = today;
    if (!reached(dayTotalMl(log, key, dayEndMin, waterOnly), goalOf(goal, key))) key = addDays(key, -1);
    for (var i = 0; i < 3650; i++) {
      if (reached(dayTotalMl(log, key, dayEndMin, waterOnly), goalOf(goal, key))) { n++; key = addDays(key, -1); }
      else break;
    }
    return n;
  }

  // Timestamp for a clock time (minutes after midnight) inside a given day.
  // With a 3:00 AM day end, "1:00 AM" on day X means 1:00 AM on the calendar date after X.
  function tsFor(key, minuteOfDay, dayEndMin) {
    var cal = minuteOfDay >= (dayEndMin || 0) ? key : addDays(key, 1);
    var p = parseYmd(cal);
    var ts = new Date(p.y, p.m - 1, p.d, 0, minuteOfDay).getTime();
    var r = dayRange(key, dayEndMin);
    return Math.max(r.start, Math.min(r.end - 60000, ts)); // clamp: daylight-saving edge cases
  }

  // Oldest day that has a drink, or null.
  function firstDayKey(log, dayEndMin) {
    var min = Infinity;
    for (var i = 0; i < log.length; i++) if (log[i].ts < min) min = log[i].ts;
    return min === Infinity ? null : dayKey(min, dayEndMin);
  }

  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  /*
   * Insights over the last `days` completed days (Plus):
   * best streak ever, average by weekday, usual first and last drink, this week vs last week.
   */
  function insights(log, now, dayEndMin, goal, waterOnly, days) {
    days = days || 28;
    var today = dayKey(now, dayEndMin);
    var first = firstDayKey(log, dayEndMin);
    var out = { bestStreak: 0, weekday: [], bestWeekday: null, firstMin: null, lastMin: null, thisWeek: 0, lastWeek: 0, daysWithData: 0 };
    if (!first) return out;
    // best streak across all history
    var run = 0, key = first, guard = 0;
    while (key <= today && guard++ < 4000) {
      if (reached(dayTotalMl(log, key, dayEndMin, waterOnly), goalOf(goal, key))) { run++; if (run > out.bestStreak) out.bestStreak = run; }
      else if (key !== today) run = 0;
      key = addDays(key, 1);
    }
    var sums = [0, 0, 0, 0, 0, 0, 0], counts = [0, 0, 0, 0, 0, 0, 0], firsts = [], lasts = [];
    for (var i = 1; i <= days; i++) {
      var k = addDays(today, -i);
      var list = entriesForDay(log, k, dayEndMin);
      if (!list.length) continue;
      out.daysWithData++;
      var wd = weekdayOf(k);
      var tot = dayTotalMl(log, k, dayEndMin, waterOnly);
      sums[wd] += tot; counts[wd]++;
      var start = dayRange(k, dayEndMin).start;
      var minsAfter = function (ts) { return Math.round((ts - start) / 60000); };
      firsts.push(minsAfter(list[list.length - 1].ts));
      lasts.push(minsAfter(list[0].ts));
      if (i <= 7) out.thisWeek += tot; else if (i <= 14) out.lastWeek += tot;
    }
    var best = -1;
    for (var w = 0; w < 7; w++) {
      var avg = counts[w] ? sums[w] / counts[w] : null;
      out.weekday.push(avg);
      if (avg != null && (best < 0 || avg > out.weekday[best])) best = w;
    }
    out.bestWeekday = best < 0 ? null : best;
    var fm = median(firsts), lm = median(lasts);
    out.firstMin = fm == null ? null : (fm + (dayEndMin || 0)) % MIN_PER_DAY;
    out.lastMin = lm == null ? null : (lm + (dayEndMin || 0)) % MIN_PER_DAY;
    return out;
  }

  function series(log, now, dayEndMin, days, waterOnly) {
    var today = dayKey(now, dayEndMin);
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var k = addDays(today, -i);
      out.push({ key: k, ml: dayTotalMl(log, k, dayEndMin, waterOnly), weekday: weekdayOf(k) });
    }
    return out;
  }

  /* ---------- Awake windows, pace, reminders ---------- */

  // Window for a calendar date key. end <= start means it ends the next calendar day (night shift).
  function windowFor(key, rem) {
    var wd = weekdayOf(key);
    var w = (rem.shift && rem.schedule && rem.schedule[wd]) ? rem.schedule[wd] : { on: true, start: rem.start, end: rem.end };
    if (!w.on) return null;
    var p = parseYmd(key);
    var s = new Date(p.y, p.m - 1, p.d, 0, w.start).getTime();
    var endDayOffset = w.end <= w.start ? 1 : 0;
    var e = new Date(p.y, p.m - 1, p.d + endDayOffset, 0, w.end).getTime();
    return { start: s, end: e };
  }

  // The awake window that contains `now`, or the next one.
  function currentOrNextWindow(now, rem) {
    var today = ymd(new Date(now));
    for (var i = -1; i <= 7; i++) {
      var w = windowFor(addDays(today, i), rem);
      if (w && now < w.end) return w;
    }
    return null;
  }

  /*
   * Pace: how much of the goal "should" be done by now if drinking is spread evenly
   * across the awake window. Returns { expectedMl, status }.
   */
  function pace(totalMl, goalMl, now, rem) {
    if (reached(totalMl, goalMl)) return { expectedMl: goalMl, status: 'done' };
    var w = currentOrNextWindow(now, rem);
    var frac = 0;
    if (w && now >= w.start) frac = Math.min(1, (now - w.start) / (w.end - w.start));
    var expected = goalMl * frac;
    var margin = goalMl * 0.08;
    var status = 'onpace';
    if (totalMl + margin < expected) status = 'behind';
    else if (totalMl > expected + margin) status = 'ahead';
    if (!w || now < w.start) status = 'resting';
    return { expectedMl: expected, status: status };
  }

  /*
   * Next reminder time after `now`, or null. Reminders start one interval after wake-up.
   * ctx (optional):
   *   lastDrinkTs - smart mode (Plus): wait a full interval after the last logged drink.
   *   quietUntil  - no reminders before this time (set to the end of today once the goal is hit).
   * Everything here can be pre-scheduled as plain local notifications; no background job needed.
   */
  function nextReminder(now, rem, ctx) {
    if (!rem || !rem.on) return null;
    ctx = ctx || {};
    var every = Math.max(30, rem.everyMin || 90) * 60000;
    var today = ymd(new Date(now));
    for (var i = -1; i <= 7; i++) {
      var w = windowFor(addDays(today, i), rem);
      if (!w) continue;
      var t = w.start + every;
      if (rem.smart && ctx.lastDrinkTs && ctx.lastDrinkTs + every > t) t = ctx.lastDrinkTs + every;
      for (; t <= w.end; t += every) {
        if (t <= now) continue;
        if (ctx.quietUntil && t < ctx.quietUntil) continue;
        return t;
      }
    }
    return null;
  }

  var REMINDER_LINES = [
    "Drip's pond is getting low. Time for a few sips?",
    'Quick sip break. Your bottle is right there.',
    "Drip wants to soak a little deeper. Help him out?",
    'Halfway through the shift? Halfway through the bottle.',
    'Small sips count. Drag the line when you drink.',
    'Hippos spend most of the day in water. You just need a glass.',
    'Refill run? Drip will count it.'
  ];

  function reminderLine(seed) {
    var i = Math.abs(Math.floor(seed || 0)) % REMINDER_LINES.length;
    return REMINDER_LINES[i];
  }

  /* ---------- Time formatting ---------- */

  function fmtMinutes(min) {
    min = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
    var h = Math.floor(min / 60), m = min % 60;
    var ap = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad2(m) + ' ' + ap;
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    return fmtMinutes(d.getHours() * 60 + d.getMinutes());
  }

  /* ---------- Weather boost (optional, US only) ---------- */

  var HOT_F = 85; // forecast high at or above this turns on the hot-day boost

  // "45385" -> { lat, lng } using the bundled ZIP-prefix table, or null.
  function zipToLatLng(zip, table) {
    var z = String(zip || '').replace(/\D/g, '');
    if (z.length !== 5 || !table) return null;
    var hit = table[z.slice(0, 3)];
    return hit ? { lat: hit[0], lng: hit[1] } : null;
  }

  // Today's daytime high (°F) from a National Weather Service forecast, or null
  // (for example in the evening, when the next daytime period is tomorrow).
  function nwsHighForDay(forecast, key) {
    var periods = forecast && forecast.properties && forecast.properties.periods;
    if (!periods || !periods.length) return null;
    for (var i = 0; i < periods.length; i++) {
      var p = periods[i];
      if (!p.isDaytime || typeof p.temperature !== 'number') continue;
      if (String(p.startTime || '').slice(0, 10) !== key) continue;
      return p.temperatureUnit === 'C' ? Math.round(p.temperature * 9 / 5 + 32) : p.temperature;
    }
    return null;
  }

  /* ---------- Health Connect reconcile ---------- */

  // Which drinks to write, rewrite or delete so Health Connect matches the log.
  // synced = { entryId: signature }. Only the last `days` days are kept in sync.
  function hcPlan(log, synced, now, dayEndMin, waterOnly, days) {
    var since = dayRange(addDays(dayKey(now, dayEndMin), -((days || 14) - 1)), dayEndMin).start;
    var upsert = [], keep = {}, del = [];
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      if (e.ts < since || !counts(e, waterOnly)) continue;
      var sig = Math.round(e.ml * 100) + '@' + e.ts;
      keep[e.id] = sig;
      if (synced[e.id] !== sig) upsert.push(e);
    }
    for (var id in synced) if (!(id in keep)) del.push(id);
    return { upsert: upsert, remove: del, next: keep };
  }

  /* ---------- CSV ---------- */

  function toCsv(log, dayEndMin, units) {
    var rows = ['day,time,drink,amount,unit,source'];
    var sorted = log.slice().sort(function (a, b) { return a.ts - b.ts; });
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      var amount = units === 'ml' ? String(Math.round(e.ml)) : String(Math.round(mlToOz(e.ml) * 10) / 10);
      rows.push([dayKey(e.ts, dayEndMin), fmtTime(e.ts), drinkById(e.drink).name, amount, units === 'ml' ? 'ml' : 'oz', e.src || ''].join(','));
    }
    return rows.join('\n');
  }

  var api = {
    ML_PER_OZ: ML_PER_OZ,
    mlToOz: mlToOz, ozToMl: ozToMl, stepMl: stepMl, snapMl: snapMl,
    displayNumber: displayNumber, unitLabel: unitLabel, fmtVol: fmtVol,
    calcGoalMl: calcGoalMl,
    dayKey: dayKey, dayRange: dayRange, addDays: addDays, weekdayOf: weekdayOf, ymd: ymd,
    DRINKS: DRINKS, drinkById: drinkById, counts: counts,
    SHAPES: SHAPES, BOTTLE_PRESETS: BOTTLE_PRESETS, BOTTLE_COLORS: BOTTLE_COLORS, bottleLabel: bottleLabel,
    entriesForDay: entriesForDay, dayTotalMl: dayTotalMl, dayCaffeineMg: dayCaffeineMg, streak: streak, series: series,
    goalOf: goalOf, reached: reached, tsFor: tsFor, firstDayKey: firstDayKey, insights: insights,
    windowFor: windowFor, currentOrNextWindow: currentOrNextWindow, pace: pace, nextReminder: nextReminder,
    REMINDER_LINES: REMINDER_LINES, reminderLine: reminderLine,
    fmtMinutes: fmtMinutes, fmtTime: fmtTime, toCsv: toCsv,
    HOT_F: HOT_F, zipToLatLng: zipToLatLng, nwsHighForDay: nwsHighForDay, hcPlan: hcPlan
  };

  root.HydCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
