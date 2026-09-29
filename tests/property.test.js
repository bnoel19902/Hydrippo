// Property tests: hammer the day-boundary and reminder math across many dates,
// including daylight-saving changes. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const C = require('../www/js/core.js');

const DAY_ENDS = [0, 30, 120, 150, 180, 240, 420, 660, 690, 1080, 1439];
// Around US DST changes (Nov 1 2026, Mar 14 2027) plus ordinary days and year end.
const START_DATES = ['2026-10-29', '2027-03-11', '2026-12-30', '2026-09-27'];

test('day ranges tile perfectly: every minute belongs to exactly the day whose range contains it', () => {
  for (const de of DAY_ENDS) {
    for (const start of START_DATES) {
      let key = start;
      for (let d = 0; d < 6; d++) {
        const r = C.dayRange(key, de);
        const next = C.dayRange(C.addDays(key, 1), de);
        assert.strictEqual(r.end, next.start, `gap/overlap after ${key} (dayEnd ${de})`);
        assert.ok(r.end > r.start, `empty day ${key} (dayEnd ${de})`);
        for (let t = r.start; t < r.end; t += 7 * 60000) {
          assert.strictEqual(C.dayKey(t, de), key, `minute ${new Date(t).toString()} misfiled (dayEnd ${de}, expected ${key})`);
        }
        assert.strictEqual(C.dayKey(r.end - 1, de), key);
        assert.strictEqual(C.dayKey(r.end, de), C.addDays(key, 1));
        key = C.addDays(key, 1);
      }
    }
  }
});

test('reminders always land inside awake hours, after now, and never repeat', () => {
  const windows = [[420, 1380], [900, 450], [0, 1439], [360, 600], [1320, 360]];
  for (const [start, end] of windows) {
    for (const every of [60, 90, 120]) {
      const rem = { on: true, everyMin: every, start, end, shift: false };
      let t = new Date(2026, 9, 30, 5, 17).getTime();
      let last = 0;
      for (let i = 0; i < 60; i++) {
        const n = C.nextReminder(t, rem);
        assert.ok(n && n > t, 'reminder must be in the future');
        assert.ok(n > last, 'reminders must move forward');
        const mins = new Date(n).getHours() * 60 + new Date(n).getMinutes();
        const inside = end > start ? mins >= start && mins <= end : mins >= start || mins <= end;
        assert.ok(inside, `reminder at ${new Date(n).toString()} outside ${start}-${end}`);
        last = n; t = n;
      }
    }
  }
});

test('goal calculator never returns nonsense for odd inputs', () => {
  const weights = [0, -5, 1, 59, 60, 100, 250, 700, 701, NaN, undefined, '180', 'abc'];
  for (const w of weights) for (const u of ['lb', 'kg']) for (const a of ['low', 'moderate', 'high', 'bogus']) for (const hot of [true, false]) {
    const oz = C.mlToOz(C.calcGoalMl({ weight: w, weightUnit: u, activity: a, hot }));
    assert.ok(Number.isFinite(oz) && oz >= 47.9 && oz <= 160.1, `goal ${oz} for ${w}${u} ${a}`);
  }
});

test('csv amounts are plain numbers in the stated unit, even for big pours', () => {
  const log = [{ ts: new Date(2026, 8, 15, 9, 5).getTime(), ml: 3785, drink: 'water', src: 'bottle' }];
  const ml = C.toCsv(log, 0, 'ml').split('\n')[1].split(',');
  assert.strictEqual(ml[3], '3785');
  assert.strictEqual(ml[4], 'ml');
  const oz = C.toCsv(log, 0, 'oz').split('\n')[1].split(',');
  assert.strictEqual(oz[3], '128');
});

test('series and streak agree with day totals', () => {
  const goal = C.ozToMl(64);
  const log = [];
  const base = new Date(2026, 9, 25, 12, 0).getTime();
  for (let d = 0; d < 10; d++) log.push({ ts: base + d * 86400000, ml: d === 4 ? C.ozToMl(20) : C.ozToMl(70), drink: 'water' });
  const now = base + 9 * 86400000 + 3600000;
  const s = C.series(log, now, 180, 10, false);
  assert.strictEqual(s.length, 10);
  s.forEach((x) => assert.strictEqual(x.ml, C.dayTotalMl(log, x.key, 180, false)));
  assert.strictEqual(C.streak(log, now, 180, goal, false), 5);
});
