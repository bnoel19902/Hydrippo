// Run with: npm test   (or: node --test tests/core.test.js)
// Tests the pure logic in www/js/core.js (no browser needed).
const test = require('node:test');
const assert = require('node:assert');
const C = require('../www/js/core.js');

const oz = (n) => C.ozToMl(n);

test('goal: half body weight in oz, plus activity and heat, rounded to 4 oz', () => {
  assert.strictEqual(Math.round(C.mlToOz(C.calcGoalMl({ weight: 180, weightUnit: 'lb', activity: 'low' }))), 92);
  assert.strictEqual(Math.round(C.mlToOz(C.calcGoalMl({ weight: 180, weightUnit: 'lb', activity: 'high', hot: true }))), 128);
  // kg input converts to lb first: 80 kg = 176 lb -> 88 oz
  assert.strictEqual(Math.round(C.mlToOz(C.calcGoalMl({ weight: 80, weightUnit: 'kg', activity: 'low' }))), 88);
  // clamps
  assert.strictEqual(Math.round(C.mlToOz(C.calcGoalMl({ weight: 70, weightUnit: 'lb', activity: 'low' }))), 48);
  assert.strictEqual(Math.round(C.mlToOz(C.calcGoalMl({ weight: 400, weightUnit: 'lb', activity: 'high', hot: true }))), 160);
});

test('day key: drinks after midnight count for the previous day until the day ends', () => {
  const d = (h, m) => new Date(2026, 8, 15, h, m).getTime(); // Sep 15 2026
  assert.strictEqual(C.dayKey(d(1, 30), 0), '2026-09-15');
  assert.strictEqual(C.dayKey(d(1, 30), 180), '2026-09-14'); // day ends 3 AM
  assert.strictEqual(C.dayKey(d(3, 0), 180), '2026-09-15');
  assert.strictEqual(C.dayKey(d(10, 59), 660), '2026-09-14'); // night shift, day ends 11 AM
  assert.strictEqual(C.dayKey(d(11, 0), 660), '2026-09-15');
});

test('day range spans exactly one day from the day-end time', () => {
  const r = C.dayRange('2026-09-15', 180);
  assert.strictEqual(new Date(r.start).getHours(), 3);
  assert.strictEqual(new Date(r.start).getDate(), 15);
  assert.strictEqual(new Date(r.end).getDate(), 16);
});

test('totals respect day end and water-only mode', () => {
  const t = (h) => new Date(2026, 8, 15, h, 0).getTime();
  const log = [
    { ts: t(9), ml: oz(16), drink: 'water' },
    { ts: t(13), ml: oz(12), drink: 'coffee' },
    { ts: t(23), ml: oz(8), drink: 'water' },
    { ts: new Date(2026, 8, 16, 1, 0).getTime(), ml: oz(10), drink: 'water' } // 1 AM next calendar day
  ];
  assert.strictEqual(Math.round(C.mlToOz(C.dayTotalMl(log, '2026-09-15', 180, false))), 46);
  assert.strictEqual(Math.round(C.mlToOz(C.dayTotalMl(log, '2026-09-15', 180, true))), 34);
  assert.strictEqual(Math.round(C.mlToOz(C.dayTotalMl(log, '2026-09-15', 0, false))), 36);
});

test('streak counts back from yesterday while today is in progress', () => {
  const goal = oz(64);
  const at = (day, h) => new Date(2026, 8, day, h, 0).getTime();
  const log = [
    { ts: at(12, 12), ml: oz(70), drink: 'water' },
    { ts: at(13, 12), ml: oz(64), drink: 'water' },
    { ts: at(14, 12), ml: oz(66), drink: 'water' },
    { ts: at(15, 10), ml: oz(20), drink: 'water' } // today, not done yet
  ];
  assert.strictEqual(C.streak(log, at(15, 11), 0, goal, false), 3);
  log.push({ ts: at(15, 11), ml: oz(50), drink: 'water' });
  assert.strictEqual(C.streak(log, at(15, 12), 0, goal, false), 4);
});

test('reminders: every N minutes inside awake hours, including overnight shifts', () => {
  const rem = { on: true, everyMin: 90, start: 420, end: 1380, shift: false };
  const n1 = C.nextReminder(new Date(2026, 8, 15, 6, 0).getTime(), rem);
  assert.strictEqual(new Date(n1).getHours() * 60 + new Date(n1).getMinutes(), 510); // 8:30 AM
  const night = { on: true, everyMin: 120, start: 900, end: 420, shift: false }; // 3 PM - 7 AM
  const n2 = C.nextReminder(new Date(2026, 8, 16, 2, 30).getTime(), night);
  assert.strictEqual(new Date(n2).getHours(), 3); // 3:00 AM, still inside last night's window
  assert.strictEqual(C.nextReminder(Date.now(), { on: false }), null);
});

test('smart timing waits a full interval after the last drink; goal reached silences the rest of the day', () => {
  const rem = { on: true, everyMin: 90, start: 420, end: 1380, shift: false, smart: true };
  const now = new Date(2026, 8, 15, 10, 0).getTime();
  const lastDrink = new Date(2026, 8, 15, 9, 50).getTime();
  const n = new Date(C.nextReminder(now, rem, { lastDrinkTs: lastDrink }));
  assert.strictEqual(n.getHours() * 60 + n.getMinutes(), 11 * 60 + 20); // 9:50 + 1.5 h
  const quietUntil = C.dayRange('2026-09-15', 180).end; // goal hit: nothing until the next day
  const q = new Date(C.nextReminder(now, { ...rem, smart: false }, { quietUntil }));
  assert.strictEqual(q.getDate(), 16);
  assert.strictEqual(q.getHours() * 60 + q.getMinutes(), 510); // 8:30 AM next day
});

test('shift schedule: days switched off get no reminders', () => {
  const sched = [];
  for (let i = 0; i < 7; i++) sched.push({ on: i !== 0 && i !== 6, start: 420, end: 1380 });
  const rem = { on: true, everyMin: 60, start: 420, end: 1380, shift: true, schedule: sched };
  // Saturday Sep 19 2026, 9 AM -> next reminder should be Monday Sep 21 at 8 AM
  const n = new Date(C.nextReminder(new Date(2026, 8, 19, 9, 0).getTime(), rem));
  assert.strictEqual(n.getDay(), 1);
  assert.strictEqual(n.getHours(), 8);
});

test('pace flags when someone is behind', () => {
  const rem = { on: true, everyMin: 90, start: 420, end: 1380, shift: false };
  const noon = new Date(2026, 8, 15, 15, 0).getTime(); // halfway through 7 AM - 11 PM
  assert.strictEqual(C.pace(oz(10), oz(96), noon, rem).status, 'behind');
  assert.strictEqual(C.pace(oz(48), oz(96), noon, rem).status, 'onpace');
  assert.strictEqual(C.pace(oz(80), oz(96), noon, rem).status, 'ahead');
  assert.strictEqual(C.pace(oz(96), oz(96), noon, rem).status, 'done');
});

test('formatting and labels', () => {
  assert.strictEqual(C.fmtVol(oz(40), 'oz'), '40 oz');
  assert.strictEqual(C.fmtVol(350, 'ml'), '350 ml');
  assert.strictEqual(C.fmtVol(1183, 'ml'), '1.2 L');
  assert.strictEqual(C.bottleLabel({ shape: 'jug', ml: oz(128) }, 'oz'), 'Gallon jug');
  assert.strictEqual(C.bottleLabel({ shape: 'tumbler', ml: oz(40) }, 'oz'), '40 oz tumbler');
  assert.strictEqual(C.fmtMinutes(0), '12:00 AM');
  assert.strictEqual(C.fmtMinutes(690), '11:30 AM');
});

test('tsFor puts late-night clock times on the right calendar date', () => {
  const t = new Date(C.tsFor('2026-09-15', 60, 180)); // 1:00 AM with a 3 AM day end
  assert.strictEqual(t.getDate(), 16);
  assert.strictEqual(t.getHours(), 1);
  assert.strictEqual(C.dayKey(t.getTime(), 180), '2026-09-15');
  const u = new Date(C.tsFor('2026-09-15', 14 * 60, 180));
  assert.strictEqual(u.getDate(), 15);
  for (const de of [0, 180, 660]) for (let m = 0; m < 1440; m += 17) {
    assert.strictEqual(C.dayKey(C.tsFor('2026-11-01', m, de), de), '2026-11-01', `m=${m} de=${de}`);
  }
});

test('streak honours per-day goals (hot-day boost)', () => {
  const at = (day, h) => new Date(2026, 8, day, h, 0).getTime();
  const log = [{ ts: at(13, 12), ml: oz(70), drink: 'water' }, { ts: at(14, 12), ml: oz(70), drink: 'water' }];
  const goal = (key) => key === '2026-09-14' ? oz(80) : oz(64);
  assert.strictEqual(C.streak(log, at(15, 9), 0, goal, false), 0);
  assert.strictEqual(C.streak(log, at(15, 9), 0, oz(64), false), 2);
});

test('insights: best streak, best weekday, usual first and last drink', () => {
  const log = [];
  for (let d = 1; d <= 20; d++) {
    const day = new Date(2026, 8, d);
    const big = day.getDay() === 2; // Tuesdays are big days
    log.push({ ts: new Date(2026, 8, d, 7, 30).getTime(), ml: oz(20), drink: 'water' });
    log.push({ ts: new Date(2026, 8, d, 21, 45).getTime(), ml: oz(big ? 80 : 50), drink: 'water' });
  }
  const i = C.insights(log, new Date(2026, 8, 21, 10, 0).getTime(), 180, oz(64), false, 28);
  assert.strictEqual(i.bestStreak, 20);
  assert.strictEqual(i.bestWeekday, 2);
  assert.strictEqual(i.firstMin, 7 * 60 + 30);
  assert.strictEqual(i.lastMin, 21 * 60 + 45);
  assert.ok(i.thisWeek > 0 && i.lastWeek > 0);
});

test('a total that displays as the goal counts as reaching it', () => {
  const rem = { on: true, everyMin: 90, start: 420, end: 1380, shift: false };
  const noon = new Date(2026, 8, 15, 12, 0).getTime();
  assert.strictEqual(C.fmtVol(oz(103.6), 'oz'), '104 oz');
  assert.strictEqual(C.pace(oz(103.6), oz(104), noon, rem).status, 'done');
  assert.strictEqual(C.reached(oz(103.4), oz(104)), false);
});

test('weather: ZIP prefix lookup and National Weather Service high for today', () => {
  const Z = require('../www/js/zip3.js');
  const x = C.zipToLatLng('45385', Z); // Xenia, OH
  assert.ok(x && Math.abs(x.lat - 39.7) < 0.5 && Math.abs(x.lng + 84) < 0.5);
  assert.strictEqual(C.zipToLatLng('4538', Z), null);
  assert.strictEqual(C.zipToLatLng('00000', Z), null);
  const fc = { properties: { periods: [
    { isDaytime: false, startTime: '2026-07-14T18:00:00-04:00', temperature: 72, temperatureUnit: 'F' },
    { isDaytime: true, startTime: '2026-07-15T06:00:00-04:00', temperature: 91, temperatureUnit: 'F' }] } };
  assert.strictEqual(C.nwsHighForDay(fc, '2026-07-15'), 91);
  assert.strictEqual(C.nwsHighForDay(fc, '2026-07-14'), null); // evening: tomorrow's high is not today's
});

test('Health Connect plan: add new, rewrite edited, remove deleted, skip old', () => {
  const now = new Date(2026, 8, 20, 12).getTime();
  const log = [
    { id: 'a', ts: now - 3600000, ml: 300, drink: 'water' },
    { id: 'b', ts: now - 7200000, ml: 250, drink: 'coffee' },
    { id: 'old', ts: now - 40 * 86400000, ml: 250, drink: 'water' }
  ];
  const p1 = C.hcPlan(log, {}, now, 180, false, 14);
  assert.deepStrictEqual(p1.upsert.map((e) => e.id).sort(), ['a', 'b']);
  log[0].ml = 350; // edited
  const p2 = C.hcPlan(log.filter((e) => e.id !== 'b'), p1.next, now, 180, false, 14); // b deleted
  assert.deepStrictEqual(p2.upsert.map((e) => e.id), ['a']);
  assert.deepStrictEqual(p2.remove, ['b']);
  const p3 = C.hcPlan(log, {}, now, 180, true, 14); // water only
  assert.deepStrictEqual(p3.upsert.map((e) => e.id), ['a']);
});

test('csv export has one row per drink', () => {
  const log = [{ ts: new Date(2026, 8, 15, 9, 5).getTime(), ml: oz(12), drink: 'coffee', src: 'quick' }];
  const csv = C.toCsv(log, 0, 'oz').split('\n');
  assert.strictEqual(csv[0], 'day,time,drink,amount,unit,source');
  assert.strictEqual(csv[1], '2026-09-15,9:05 AM,Coffee,12,oz,quick');
});
