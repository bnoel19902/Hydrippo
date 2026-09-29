"""
Hydrippo usage simulations.
Drives the real app in a headless phone-sized Chromium with a fake clock, living through days of
normal use, and checks invariants after every step.

Run:  python3 tests/sim/simulate.py            (all scenarios)
      python3 tests/sim/simulate.py fuzz        (one scenario by name)
Needs: pip install playwright  (and a Chromium; set PW_CHROMIUM to its path if not auto-found)
"""
import asyncio, json, os, random, re, sys, time, traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
URL = 'file://' + os.path.join(ROOT, 'www', 'index.html')
KEY = 'hydrippo.state.v1'
TZ = 'America/New_York'
OZ = 29.5735
RESULTS = []


def ny(*a):
    return datetime(*a, tzinfo=ZoneInfo(TZ))


class Sim:
    def __init__(self, browser, name, start, viewport=(390, 844), tz=TZ, dark=False):
        self.b, self.name, self.start, self.vp, self.tz, self.dark = browser, name, start, viewport, tz, dark
        self.errors, self.log = [], []

    async def open(self, seed_state=None):
        self.ctx = await self.b.new_context(viewport={'width': self.vp[0], 'height': self.vp[1]}, timezone_id=self.tz,
                                            color_scheme='dark' if self.dark else 'light', permissions=['clipboard-read', 'clipboard-write'])
        self.ctx.set_default_timeout(2500)
        self.p = await self.ctx.new_page()
        self.p.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        # A network request the test deliberately fails logs "Failed to load resource"; that's the browser, not the app.
        self.p.on('console', lambda m: self.errors.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        await self.p.clock.install(time=self.start)
        if seed_state is not None:
            await self.p.add_init_script('if(!localStorage.getItem(%s)) localStorage.setItem(%s, %s)' % (
                json.dumps(KEY), json.dumps(KEY), json.dumps(json.dumps(seed_state))))
        await self.p.goto(URL)
        await self.tick(600)

    async def close(self):
        await self.ctx.close()

    # ---------- time ----------
    async def tick(self, ms=400):
        await self.p.clock.run_for(ms)

    async def at(self, dt):
        """Jump the fake clock forward to dt (timers due along the way fire at most once)."""
        now_ms = await self.p.evaluate('Date.now()')
        delta = int(dt.timestamp() * 1000) - now_ms
        if delta > 0:
            await self.p.clock.fast_forward(delta)
        await self.tick(25000)  # let the 20 s / 30 s app timers run once

    async def now(self):
        return datetime.fromtimestamp(await self.p.evaluate('Date.now()') / 1000, ZoneInfo(self.tz))

    # ---------- state ----------
    async def state(self):
        await self.tick(300)
        raw = await self.p.evaluate('localStorage.getItem(%s)' % json.dumps(KEY))
        return json.loads(raw) if raw else None

    async def core(self, expr):
        return await self.p.evaluate(expr)

    # ---------- UI helpers ----------
    async def clear_overlays(self):
        await self.p.evaluate("['toast','banner'].forEach(function(id){var e=document.getElementById(id); if(e) e.hidden=true})")

    async def click(self, sel, overlay_ok=False, settle=300):
        if not overlay_ok:
            await self.clear_overlays()
        loc = self.p.locator(sel).first
        # Scroll it to the middle of the screen like a person would, so the sticky tab bar can't cover it.
        await loc.evaluate("e => e.scrollIntoView({block: 'center'})")
        # force: the fake clock also freezes animation frames, which Playwright's "is it stable?" check waits on
        await loc.click(force=True)
        if settle:
            await self.tick(settle)

    async def tab(self, name):
        await self.click('.tab[data-tab="%s"]' % name)

    async def drag_ml(self, ml):
        """Drag the water line down by about `ml` and return the amount the app logged."""
        await self.clear_overlays()
        await self.tab('today')
        before = await self.state()
        geo = await self.p.evaluate('''() => {
            const s = JSON.parse(localStorage.getItem('%s'));
            const b = s.bottles.find(x => x.id === s.activeBottleId) || s.bottles[0];
            const sh = HydArt.SHAPES[b.shape];
            const svg = document.querySelector('svg.bottle'); const r = svg.getBoundingClientRect();
            const k = document.querySelector('.b-knob').getBoundingClientRect();
            return { pxPerMl: (sh.empty - sh.full) / 380 * r.height / b.ml, x: k.x + k.width / 2, y: k.y + k.height / 2, bottom: r.bottom };
        }''' % KEY)
        await self.p.evaluate('window.scrollTo(0, 0)')
        k = await self.p.locator('.b-knob').bounding_box()
        x, y = k['x'] + k['width'] / 2, k['y'] + k['height'] / 2
        dy = ml * geo['pxPerMl']
        await self.p.mouse.move(x, y)
        await self.p.mouse.down()
        steps = max(4, int(dy / 6))
        for i in range(1, steps + 1):
            await self.p.mouse.move(x, y + dy * i / steps)
        await self.p.mouse.up()
        await self.tick(300)
        after = await self.state()
        if len(after['log']) > len(before['log']):
            return after['log'][-1]['ml']
        return 0

    async def onboard(self, weight=180, weight_unit='lb', activity='moderate', hot=False, units='oz',
                      shape='tumbler', schedule='day', wake=None, bed=None, remind=True):
        await self.click('[data-ob="next"]')
        if units == 'ml':
            await self.click('[data-obu="ml"]')
        if weight_unit == 'kg':
            await self.click('[data-wu="kg"]')
        await self.p.fill('#gWeight', str(weight))
        await self.click('[data-act-level="%s"]' % activity)
        if hot:
            await self.click('#gHot')
        goal_txt = await self.p.inner_text('#gOut')
        await self.click('[data-ob="next"]')
        await self.click('[data-obs="%s"]' % shape)
        await self.click('[data-ob="next"]')
        if schedule in ('day', 'night'):
            await self.click('[data-obh="%s"]' % schedule)
        if wake:
            await self.p.fill('#obWake', wake); await self.p.dispatch_event('#obWake', 'change'); await self.tick()
        if bed:
            await self.p.fill('#obBed', bed); await self.p.dispatch_event('#obBed', 'change'); await self.tick()
        roll = await self.p.inner_text('#obRoll')
        await self.click('[data-ob="next"]')
        await self.click('[data-ob="%s"]' % ('remind-yes' if remind else 'remind-no'))
        await self.tick(600)
        return goal_txt, roll

    # ---------- invariants ----------
    async def check(self, label):
        problems = []
        if self.errors:
            problems += self.errors[:]
            self.errors.clear()
        text = await self.p.evaluate('document.body.innerText')
        for bad in ['NaN', 'undefined', 'Infinity', '[object', 'null ']:
            if bad in text:
                problems.append('screen shows "%s"' % bad)
        over = await self.p.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        if over > 0:
            problems.append('page scrolls sideways by %dpx' % over)
        s = await self.state()
        if s and s.get('onboarded'):
            ids = {b['id'] for b in s['bottles']}
            if s['activeBottleId'] not in ids:
                problems.append('active bottle missing')
            for b in s['bottles']:
                lv = s['levels'].get(b['id'], b['ml'])
                if not (-0.5 <= lv <= b['ml'] + 0.5):
                    problems.append('bottle %s level %s outside 0..%s' % (b['id'], lv, b['ml']))
            for e in s['log']:
                if not (isinstance(e.get('ml'), (int, float)) and e['ml'] > 0 and e['ml'] < 10000):
                    problems.append('bad entry amount %r' % e)
            if not (900 <= s['goalMl'] <= 6000):
                problems.append('goal out of range %s' % s['goalMl'])
            if await self.p.is_visible('#tot'):
                shown = await self.p.get_attribute('#tot', 'aria-label')
                want = await self.p.evaluate('''() => { const s = JSON.parse(localStorage.getItem('%s'));
                    const k = HydCore.dayKey(Date.now(), s.dayEndMin);
                    const goal = s.goalMl + ((s.boosts && s.boosts[k]) || 0);
                    return HydCore.fmtVol(HydCore.dayTotalMl(s.log, k, s.dayEndMin, s.waterOnly), s.units) + ' of ' + HydCore.fmtVol(goal, s.units); }''' % KEY)
                if shown != want:
                    problems.append('Today shows "%s" but the saved data says "%s"' % (shown, want))
        for p_ in problems:
            self.fail(label, p_)
        return not problems

    def fail(self, label, msg):
        RESULTS.append((self.name, 'FAIL', '%s: %s' % (label, msg)))

    def note(self, msg):
        RESULTS.append((self.name, 'note', msg))

    def expect(self, cond, label):
        RESULTS.append((self.name, 'ok' if cond else 'FAIL', label))
        return cond


def oz(ml):
    return round(ml / OZ)


# =====================================================================
# Scenario 1: a day-shift worker's week
# =====================================================================
async def week(browser):
    s = Sim(browser, 'week', ny(2026, 9, 28, 6, 50))
    await s.open()
    goal_txt, roll = await s.onboard(weight=185, activity='moderate', shape='tumbler', schedule='day')
    s.expect(goal_txt == '104 oz', 'goal for 185 lb on-my-feet is 104 oz (got %s)' % goal_txt)
    s.expect('3:00 AM' in roll, 'day schedule rolls over at 3:00 AM')
    await s.check('after onboarding')
    plan = [(7, 30, 'coffee'), (9, 0, 10), (10, 30, 8), (12, 0, 12), (13, 30, 'finish'), (13, 31, 'refill'),
            (15, 0, 10), (16, 30, 'soda'), (18, 0, 8), (20, 0, 12), (21, 0, 10), (22, 0, 6)]
    ledger = {}
    streak_expected = 0
    for day in range(7):
        date = datetime(2026, 9, 28) + timedelta(days=day)
        light_day = day in (2, 5)  # skip the afternoon: goal missed
        total = 0
        for h, m, act in plan:
            if light_day and 13 <= h <= 20:
                continue
            await s.at(ny(date.year, date.month, date.day, h, m))
            if act == 'coffee':
                await s.click('[data-act="quick"][data-drink="coffee"]'); total += OZ * 12
            elif act == 'soda':
                await s.click('[data-act="quick"][data-drink="soda"]'); total += OZ * 12
            elif act == 'finish':
                st = await s.state(); b = st['bottles'][0]; lv = st['levels'][b['id']]
                await s.click('[data-act="finish"]'); total += lv if lv >= 1 else 0
            elif act == 'refill':
                await s.click('#refillBtn')
            else:
                st = await s.state(); b = st['bottles'][0]
                if st['levels'][b['id']] < act * OZ:
                    await s.click('#refillBtn')
                got = await s.drag_ml(act * OZ)
                if not s.expect(abs(got - act * OZ) <= OZ * 1.01, 'day %d %02d:%02d drag %d oz logged %s oz' % (day + 1, h, m, act, round(got / OZ, 1))):
                    pass
                total += got
            await s.check('day %d %02d:%02d' % (day + 1, h, m))
        ledger[date.date()] = total
        await s.at(ny(date.year, date.month, date.day, 23, 30))
        st = await s.state()
        shown = await s.p.get_attribute('#tot', 'aria-label')
        s.expect(shown.startswith('%d oz' % oz(total)), 'day %d end total %s matches ledger %d oz' % (day + 1, shown, oz(total)))
        met = total + 15 >= st['goalMl']
        streak_expected = streak_expected + 1 if met else 0
        pill = await s.p.inner_text('#pace')
        s.expect(('Goal reached' in pill) == met, 'day %d pace pill says "%s" (goal met: %s)' % (day + 1, pill.strip(), met))
    # next morning: history
    await s.at(ny(2026, 10, 5, 8, 0))
    await s.tab('history')
    streak_txt = await s.p.inner_text('.stats .stat >> nth=0')
    streak_num = int(re.match(r'\s*(\d+)', streak_txt).group(1))
    s.expect(streak_num == streak_expected, 'streak shows %d, expected %d' % (streak_num, streak_expected))
    rows = await s.p.locator('.day .dtot').all_inner_texts()
    exp = [oz(ledger[(datetime(2026, 10, 4) - timedelta(days=i)).date()]) for i in range(6)]
    got_rows = [int(re.sub(r'[^0-9]', '', r) or 0) for r in rows[1:7]]
    s.expect(got_rows == exp, 'history rows %s match ledger %s' % (got_rows, exp))
    goal_days = await s.p.inner_text('.stats .stat >> nth=2')
    s.note('history: streak %s, goal days %s' % (streak_txt.replace('\n', ' '), goal_days.replace('\n', ' ')))
    await s.check('history')
    await s.close()


# =====================================================================
# Scenario 2: night shift across midnight and the DST fall-back night
# =====================================================================
async def night(browser):
    s = Sim(browser, 'night-shift', ny(2026, 10, 30, 14, 30))
    await s.open()
    goal_txt, roll = await s.onboard(weight=200, activity='high', shape='jug', schedule='night')
    s.expect('11:30 AM' in roll, 'night shift (3 PM-7:30 AM) rolls over at 11:30 AM: "%s"' % roll[:60])
    st = await s.state()
    s.expect(st['dayEndMin'] == 690, 'dayEndMin saved as 690 (got %s)' % st['dayEndMin'])
    times = [(10, 30, 16, 0), (10, 30, 20, 0), (10, 30, 23, 30), (10, 31, 1, 0), (10, 31, 4, 0), (10, 31, 7, 0)]
    total = 0
    for mo, d, h, m in times:
        await s.at(ny(2026, mo, d, h, m))
        total += await s.drag_ml(16 * OZ)
        await s.check('night %s %02d:%02d' % (d, h, m))
    await s.at(ny(2026, 10, 31, 7, 15))
    shown = await s.p.get_attribute('#tot', 'aria-label')
    s.expect(shown.startswith('%d oz' % oz(total)), 'at 7:15 AM the whole shift (6 drinks) counts as one day: %s' % shown)
    hdr = await s.p.inner_text('#daylabel')
    s.expect('Oct 30' in hdr, 'header still shows Fri, Oct 30 at 7:15 AM Sat: %s' % hdr.replace('\n', ' '))
    await s.at(ny(2026, 10, 31, 11, 45))
    shown2 = await s.p.get_attribute('#tot', 'aria-label')
    s.expect(shown2.startswith('0 oz'), 'after 11:30 AM a fresh day starts at 0: %s' % shown2)
    # DST fall-back night: 1:30 AM happens twice on Nov 1
    await s.at(ny(2026, 10, 31, 22, 0))
    a = await s.drag_ml(10 * OZ)
    await s.at(datetime(2026, 11, 1, 1, 30, tzinfo=ZoneInfo(TZ), fold=0))
    b = await s.drag_ml(10 * OZ)
    await s.p.clock.fast_forward(3600 * 1000)  # 1:30 EDT -> 1:30 EST
    await s.tick(1000)
    c = await s.drag_ml(10 * OZ)
    await s.at(ny(2026, 11, 1, 6, 0))
    shown3 = await s.p.get_attribute('#tot', 'aria-label')
    s.expect(shown3.startswith('%d oz' % oz(a + b + c)), 'DST night: both 1:30 AMs count toward the same shift: %s' % shown3)
    await s.tab('history')
    await s.check('history after DST')
    rows = await s.p.locator('.day .dname').all_inner_texts()
    s.expect(rows == ['Today', 'Yesterday'], 'history lists one row per shift-day since the first drink, across DST: %s' % rows)
    await s.close()


# =====================================================================
# Scenario 3: the day rolls over while the app is open (with a sheet open)
# =====================================================================
async def rollover(browser):
    s = Sim(browser, 'rollover', ny(2026, 10, 6, 21, 0))
    await s.open()
    await s.onboard(schedule='day')
    await s.at(ny(2026, 10, 7, 2, 55))
    got = await s.drag_ml(12 * OZ)
    hdr1 = await s.p.inner_text('#daylabel')
    s.expect('Oct 6' in hdr1, '2:55 AM still belongs to Oct 6: %s' % hdr1.replace('\n', ' '))
    await s.click('[data-act="drinks"]')
    await s.at(ny(2026, 10, 7, 3, 2))
    await s.click('[data-close]')
    await s.tick(31000)
    hdr2 = await s.p.inner_text('#daylabel')
    shown = await s.p.get_attribute('#tot', 'aria-label')
    s.expect('Oct 7' in hdr2 and shown.startswith('0 oz'), 'after 3:00 AM Today resets while open: %s / %s' % (hdr2.replace('\n', ' '), shown))
    await s.tab('history')
    y = await s.p.inner_text('.day >> nth=1')
    s.expect('%d oz' % oz(got) in y, 'yesterday row keeps the 2:55 AM drink: %s' % y.replace('\n', ' '))
    await s.check('rollover')
    await s.close()


# =====================================================================
# Scenario 4: metric user, bottles, units switching, free limit, Plus
# =====================================================================
async def bottles(browser):
    s = Sim(browser, 'bottles-metric', ny(2026, 10, 8, 8, 0), viewport=(360, 740))
    await s.open()
    goal_txt, _ = await s.onboard(weight=70, weight_unit='kg', activity='high', hot=True, units='ml', shape='sport')
    s.note('metric goal for 70 kg, hard workouts, hot: %s' % goal_txt)
    lab = await s.p.inner_text('.bottle-switch')
    s.expect('750 ml bottle' in lab, 'bottle label in ml: %s' % lab)
    got = await s.drag_ml(200)
    s.expect(abs(got - 200) <= 10.5, 'metric drag of 200 ml logged %s ml' % got)
    # add a second bottle (free)
    await s.click('.bottle-switch')
    await s.click('.sheet [data-shape="jug"]')
    await s.click('#bAdd')
    st = await s.state()
    s.expect(len(st['bottles']) == 2, 'second bottle added (free)')
    got = await s.drag_ml(500)
    s.expect(abs(got - 500) <= 10.5, 'drag on the 4 L jug logged %s ml' % got)
    await s.click('[data-act="finish"]')
    st = await s.state(); jug = st['bottles'][1]
    s.expect(st['levels'][jug['id']] == 0, 'finished it empties the jug')
    # third bottle -> paywall
    await s.tab('settings')
    await s.click('[data-act="add-bottle"]')
    s.expect(await s.p.is_visible('#pwBuy'), 'third bottle opens the paywall on free')
    await s.click('#pwBuy')
    await s.tab('settings')
    await s.click('[data-act="add-bottle"]')
    await s.click('.sheet [data-shape="glass"]')
    await s.click('#bAdd')
    st = await s.state()
    s.expect(len(st['bottles']) == 3 and st['plus'], 'with Plus a third bottle is allowed')
    # units switch keeps totals
    await s.tab('today')
    before = await s.p.get_attribute('#tot', 'aria-label')
    await s.tab('settings'); await s.click('[data-act="units"][data-units="oz"]'); await s.tab('today')
    after = await s.p.get_attribute('#tot', 'aria-label')
    s.note('units switch: "%s" -> "%s"' % (before, after))
    ticks = await s.p.locator('.b-ticktext').all_text_contents()
    s.expect(len(ticks) >= 2 and all(t.isdigit() for t in ticks), 'bottle scale redrawn in oz: %s' % ticks)
    # delete the active bottle, fall back
    await s.tab('settings')
    await s.click('[data-act="del-bottle"] >> nth=2')
    st = await s.state()
    s.expect(len(st['bottles']) == 2 and st['activeBottleId'] in [b['id'] for b in st['bottles']], 'deleting the active bottle falls back to another')
    await s.check('after bottle juggling')
    # Plus off keeps extra bottles usable but settings consistent
    await s.click('[data-act="plus-off"]')
    await s.check('plus off')
    await s.close()


# =====================================================================
# Scenario 5: undo, delete, refill chains keep data consistent
# =====================================================================
async def undo(browser):
    s = Sim(browser, 'undo-chains', ny(2026, 10, 9, 9, 0))
    await s.open()
    await s.onboard()
    base = await s.state()
    await s.drag_ml(10 * OZ)
    await s.click('#toast button', overlay_ok=True)
    after = await s.state()
    s.expect(after['log'] == base['log'] and after['levels'] == base['levels'], 'undo after a drag restores log and bottle level')
    await s.click('[data-act="finish"]')
    await s.click('#refillBtn')
    await s.click('#toast button', overlay_ok=True)
    st = await s.state()
    s.expect(st['levels']['b1'] == 0 and len(st['log']) == 1, 'undo after refill leaves the bottle empty and keeps the drink')
    await s.click('[data-act="del-entry"]')
    st = await s.state()
    s.expect(len(st['log']) == 0, 'delete removes the drink')
    await s.click('#toast button', overlay_ok=True)
    st = await s.state()
    s.expect(len(st['log']) == 1, 'undo brings the deleted drink back')
    # refill when already full
    await s.click('#refillBtn'); await s.click('#refillBtn')
    t = await s.p.inner_text('#toast')
    s.expect('already full' in t, 'refilling a full bottle says so: %s' % t)
    await s.check('undo chains')
    await s.close()


# =====================================================================
# Scenario 6: reminders fire inside awake hours and stop at the goal
# =====================================================================
async def reminders(browser):
    s = Sim(browser, 'reminders', ny(2026, 10, 12, 6, 30))
    await s.open()
    await s.onboard(schedule='day')
    # record every time the reminder banner appears (it hides itself after 12 s)
    await s.p.evaluate('''() => { window.__shown = []; const b = document.getElementById('banner');
        new MutationObserver(() => { if (!b.hidden) window.__shown.push(Date.now()); }).observe(b, { attributes: true, attributeFilter: ['hidden'] }); }''')
    fired = []
    t = ny(2026, 10, 12, 6, 40)
    goal_logged = False
    while t < ny(2026, 10, 13, 12, 0):
        await s.p.clock.fast_forward(10 * 60 * 1000)
        await s.tick(21000)
        t = await s.now()
        for ms in await s.p.evaluate('window.__shown.splice(0)'):
            fired.append(datetime.fromtimestamp(ms / 1000, ZoneInfo(TZ)))
        if not goal_logged and t.hour == 13 and t.day == 12:
            st = await s.state()
            await s.p.evaluate('''() => { const s = JSON.parse(localStorage.getItem('%s')); }''' % KEY)
            # drink the whole goal in a few big quick logs
            need = st['goalMl']
            while need > 0:
                await s.click('[data-act="quick"][data-drink="water"]')
                need -= 8 * OZ
            goal_logged = True
    day1 = [f for f in fired if f.day == 12]
    day2 = [f for f in fired if f.day == 13]
    s.note('day 1 reminders at: %s' % ', '.join(f.strftime('%H:%M') for f in day1))
    s.note('day 2 reminders at: %s' % ', '.join(f.strftime('%H:%M') for f in day2))
    s.expect(all(7 <= f.hour < 23 for f in fired), 'every reminder inside 7 AM-11 PM')
    s.expect(len(day1) >= 3 and all(f.hour < 14 for f in day1), 'reminders stop for the day after the goal is hit at 1 PM')
    s.expect(len(day2) >= 2, 'reminders resume the next morning')
    await s.check('reminders')
    await s.close()


# =====================================================================
# Scenario 7: random tapping (monkey test) with invariants after every action
# =====================================================================
async def fuzz(browser, seed=7, steps=450):
    rng = random.Random(seed)
    s = Sim(browser, 'fuzz(seed %d)' % seed, ny(2026, 10, 14, 8, 0), viewport=rng.choice([(390, 844), (360, 740), (412, 915)]))
    await s.open()
    trail = []
    fails_before = len([r for r in RESULTS if r[1] == 'FAIL'])
    for i in range(steps):
        r = rng.random()
        try:
            if r < 0.50:
                cands = await s.p.evaluate('''() => {
                    const els = [...document.querySelectorAll('button, [role=tab], input[type=checkbox], .chip, .swatch, .shape, .plan')];
                    return els.map((e, i) => { e.setAttribute('data-fz', i); const r = e.getBoundingClientRect();
                        const st = getComputedStyle(e); return { i, ok: r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && !e.disabled,
                        t: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('data-act') || e.id || '').trim().slice(0, 30) }; })
                      .filter(x => x.ok); }''')
                if cands:
                    c = rng.choice(cands)
                    trail.append('tap "%s"' % c['t'])
                    try:
                        await s.p.locator('[data-fz="%d"]' % c['i']).click(timeout=600, force=True)
                    except Exception:
                        trail[-1] += ' (covered)'
            elif r < 0.68:
                if await s.p.is_visible('.b-knob') and not await s.p.is_visible('.scrim'):
                    amt = rng.choice([1, 3, 8, 12, 20, 60]) * OZ
                    trail.append('drag %d oz' % round(amt / OZ))
                    await s.drag_ml(amt)
            elif r < 0.78:
                mins = rng.choice([5, 30, 90, 240, 600])
                trail.append('wait %d min' % mins)
                await s.p.clock.fast_forward(mins * 60000)
            elif r < 0.86:
                inputs = await s.p.evaluate('''() => [...document.querySelectorAll('input[type=number], input[type=time]')]
                    .filter(e => e.getBoundingClientRect().width > 0 && !e.disabled).map((e, i) => { e.setAttribute('data-fzi', i); return { i, type: e.type }; })''')
                if inputs:
                    inp = rng.choice(inputs)
                    val = rng.choice(['', '0', '-3', '185', '99999', '1.5', '70']) if inp['type'] == 'number' else rng.choice(['', '00:00', '07:00', '23:59', '15:30', '03:00'])
                    trail.append('type "%s" into %s' % (val, inp['type']))
                    await s.p.evaluate('''([i, v]) => { const e = document.querySelector('[data-fzi="' + i + '"]'); if (!e) return;
                        e.focus(); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }''', [inp['i'], val])
            elif r < 0.92:
                trail.append('press Escape'); await s.p.keyboard.press('Escape')
            elif r < 0.96:
                trail.append('reload app'); await s.p.reload(); await s.tick(600)
            else:
                trail.append('rotate'); await s.p.set_viewport_size({'width': rng.choice([360, 390, 412, 820]), 'height': rng.choice([640, 844, 915])})
            await s.tick(350)
        except Exception as e:
            s.fail('step %d' % i, 'harness error after %s: %s' % (trail[-3:], str(e).splitlines()[0]))
        ok = await s.check('step %d after %s' % (i, trail[-1] if trail else ''))
        if not ok:
            s.note('last 8 actions: ' + ' | '.join(trail[-8:]))
            if len([r for r in RESULTS if r[1] == 'FAIL']) - fails_before > 12:
                break
    s.note('%d random actions done' % len(trail))
    await s.close()


# =====================================================================
# Scenario 8: two years of data (speed check)
# =====================================================================
async def bigdata(browser):
    start = ny(2026, 10, 15, 12, 0)
    log, refills = [], []
    rng = random.Random(3)
    t0 = int(start.timestamp() * 1000) - 730 * 86400000
    for d in range(730):
        for k in range(rng.randint(5, 12)):
            ts = t0 + d * 86400000 + (8 + k) * 3600000
            log.append({'id': 'x%d_%d' % (d, k), 'ts': ts, 'ml': round(rng.choice([6, 8, 10, 12]) * OZ), 'drink': rng.choice(['water', 'water', 'coffee', 'tea']), 'src': 'bottle', 'bottleId': 'b1'})
        refills.append({'ts': t0 + d * 86400000 + 13 * 3600000, 'bottleId': 'b1'})
    seed = {'v': 1, 'onboarded': True, 'sample': False, 'units': 'oz', 'profile': {'weight': 180, 'weightUnit': 'lb', 'activity': 'moderate', 'hot': False},
            'goalMl': round(64 * OZ), 'dayEndMin': 180, 'bottles': [{'id': 'b1', 'shape': 'tumbler', 'ml': 1183, 'color': 'river', 'drink': 'water'}],
            'activeBottleId': 'b1', 'levels': {'b1': 800}, 'log': log, 'refills': refills,
            'reminders': {'on': True, 'everyMin': 90, 'start': 420, 'end': 1380, 'smart': True, 'shift': False, 'schedule': [{'on': True, 'start': 420, 'end': 1380}] * 7},
            'plus': True, 'plusTest': True, 'waterOnly': False, 'accessory': 'cap', 'celebrated': {}}
    s = Sim(browser, 'two-years-of-data', start)
    await s.open(seed_state=seed)
    s.note('%d drinks, %.1f KB saved' % (len(log), len(json.dumps(seed)) / 1024))
    timings = {}
    for tab in ['history', 'today', 'settings', 'history']:
        t = time.perf_counter()
        await s.p.locator('.tab[data-tab="%s"]' % tab).click(force=True)
        await s.p.wait_for_selector('#screen > *')
        timings[tab] = round((time.perf_counter() - t) * 1000)
    await s.click('[data-act="range"][data-range="30"]')
    t = time.perf_counter(); await s.drag_ml(8 * OZ); drag_ms = round((time.perf_counter() - t) * 1000)
    s.note('tab switch times (ms, includes test overhead): %s; drag+save %d ms' % (timings, drag_ms))
    s.expect(max(timings.values()) < 1500, 'screens open quickly with two years of data')
    await s.check('big data')
    await s.close()


# =====================================================================
# Scenario 9: a drink logged right before the app is closed is not lost
# =====================================================================
async def persist(browser):
    s = Sim(browser, 'save-on-close', ny(2026, 10, 16, 10, 0))
    await s.open()
    await s.onboard()
    await s.click('[data-act="quick"][data-drink="water"]', settle=0)
    # background the app immediately (no time passes), then relaunch
    await s.p.evaluate("Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'))")
    raw = await s.p.evaluate('localStorage.getItem(%s)' % json.dumps(KEY))
    st = json.loads(raw)
    s.expect(len(st['log']) == 1, 'a drink logged just before the app goes to the background is saved')
    await s.close()


# =====================================================================
# Scenario 10: the review-driven features
# =====================================================================
async def features(browser):
    s = Sim(browser, 'new-features', ny(2026, 10, 20, 7, 0))
    await s.open()
    await s.onboard(weight=160, activity='moderate', schedule='day')
    # 1) precision: set a quick button to 1 oz and tap it 50 times -> exactly 50 oz
    await s.click('[data-act="edit-quick"]')
    for _ in range(7):
        await s.click('.sheet [data-qs="0"][data-dir="-1"]')
    await s.click('#qSave')
    lab = await s.p.inner_text('[data-act="quick"] >> nth=0')
    s.expect('1 oz' in lab, 'first quick button now reads 1 oz: %s' % lab.replace('\n', ' '))
    for _ in range(50):
        await s.click('[data-act="quick"] >> nth=0', settle=0)
    await s.tick(400)
    shown = await s.p.get_attribute('#tot', 'aria-label')
    s.expect(shown.startswith('50 oz'), '50 one-ounce drinks add up to exactly 50 oz: %s' % shown)
    await s.check('precision')
    # 2) add a drink you forgot, yesterday evening
    await s.at(ny(2026, 10, 20, 9, 0))
    await s.click('[data-act="add-entry"]')
    await s.p.select_option('#eDay', label='Yesterday')
    await s.p.fill('#eTime', '21:30'); await s.p.dispatch_event('#eTime', 'change')
    await s.click('.sheet [data-preset] >> nth=3')  # 16 oz
    await s.click('#eSave')
    st = await s.state()
    last = st['log'][-1]
    ts = datetime.fromtimestamp(last['ts'] / 1000, ZoneInfo(TZ))
    s.expect(ts.day == 19 and ts.hour == 21 and ts.minute == 30 and round(last['ml'] / OZ) == 16,
             'forgotten 16 oz drink saved to yesterday 9:30 PM (%s, %s oz)' % (ts, round(last['ml'] / OZ)))
    await s.tab('history')
    y = await s.p.inner_text('.day >> nth=1')
    s.expect('16 oz' in y, 'yesterday in history shows the 16 oz: %s' % y.replace('\n', ' '))
    # an after-midnight time on a 3 AM day end lands on the right calendar date
    await s.click('.day >> nth=1 >> button')
    await s.click('.day >> nth=1 >> [data-act="add-entry"]')
    await s.p.fill('#eTime', '01:15'); await s.p.dispatch_event('#eTime', 'change')
    await s.click('#eSave')
    st = await s.state(); last = st['log'][-1]
    ts = datetime.fromtimestamp(last['ts'] / 1000, ZoneInfo(TZ))
    s.expect(ts.day == 20 and ts.hour == 1, '1:15 AM added to "yesterday" is stored as Oct 20, 1:15 AM (%s)' % ts)
    # a time that hasn't happened yet is refused
    await s.tab('today')
    await s.click('[data-act="add-entry"]')
    await s.p.fill('#eTime', '23:00'); await s.p.dispatch_event('#eTime', 'change')
    await s.click('#eSave')
    s.expect(await s.p.is_visible('#eHint'), 'a time later today is refused with a message')
    await s.click('[data-close]')
    # 3) edit an entry
    n_before = len((await s.state())['log'])
    await s.click('#todayList [data-act="edit-entry"] >> nth=0')
    await s.click('.sheet [data-drink="tea"]')
    await s.click('.sheet [data-step="1"]')
    await s.click('#eSave')
    st = await s.state()
    s.expect(len(st['log']) == n_before and any(e['drink'] == 'tea' for e in st['log']), 'editing changes the drink without adding a new one')
    await s.check('edit')
    # 4) hot-day boost
    base = int((await s.p.get_attribute('#tot', 'aria-label')).split(' of ')[1].split()[0])
    await s.click('#boostBtn')
    shown = await s.p.get_attribute('#tot', 'aria-label')
    s.expect(shown.endswith('of %d oz' % (base + 16)), "hot day raises today's %d oz goal by 16 oz: %s" % (base, shown))
    await s.click('#boostBtn')
    shown = await s.p.get_attribute('#tot', 'aria-label')
    s.expect(shown.endswith('of %d oz' % base), 'tapping again goes back to %d oz: %s' % (base, shown))
    await s.check('boost')
    # 5) backup and restore
    await s.tab('settings')
    await s.click('[data-act="backup-save"]')
    backup = await s.p.evaluate('navigator.clipboard.readText()')
    b = json.loads(backup)
    s.expect(b.get('app') == 'hydrippo' and len(b['state']['log']) == n_before, 'backup holds every drink (%d)' % len(b['state']['log']))
    await s.click('[data-act="reset-arm"]'); await s.click('[data-act="reset-confirm"]')
    s.expect(await s.p.is_visible('#onboard'), 'erase sends you back to setup')
    await s.onboard(schedule='day', remind=False)
    await s.tab('settings')
    path = '/tmp/hydrippo-backup-test.json'
    open(path, 'w').write(backup)
    await s.p.set_input_files('#set-restore', path)
    await s.tick(500)
    await s.click('[data-act="restore-confirm"]')
    st = await s.state()
    s.expect(len(st['log']) == n_before and st['quick'] and round(st['quick'][0]['ml'] / OZ) == 1, 'restore brings back drinks and custom buttons')
    open(path, 'w').write('{"hello": 1}')
    await s.p.set_input_files('#set-restore', path)
    await s.tick(500)
    t = await s.p.inner_text('#toast')
    s.expect('isn’t a Hydrippo backup' in t, 'a random file is rejected politely: %s' % t)
    await s.check('backup')
    # 6) hide Drip
    await s.click('#set-showdrip')
    await s.tab('today')
    s.expect(not await s.p.is_visible('.progress-card .drip'), 'Drip can be hidden')
    await s.tab('settings'); await s.click('#set-showdrip'); await s.tab('today')
    s.expect(await s.p.is_visible('.progress-card .drip'), 'and shown again')
    # 7) reminders help
    await s.tab('settings'); await s.click('[data-act="rem-help"]')
    s.expect(await s.p.is_visible('text=Never auto sleeping apps'), 'reminder help explains Samsung battery settings')
    await s.click('[data-close]')
    # 8) the rating ask comes once, only after 5 goal days
    await s.p.evaluate("""() => { window.__rate = 0; const b = document.getElementById('banner');
        new MutationObserver(() => { if (!b.hidden && /rating/.test(b.innerText)) window.__rate++; })
          .observe(b, { attributes: true, attributeFilter: ['hidden'] }); }""")
    await s.tab('today')
    await s.click('[data-act="edit-quick"]'); await s.click('#qReset')
    asked_on = None
    for day in range(1, 8):
        d = datetime(2026, 10, 20) + timedelta(days=day)
        await s.at(ny(d.year, d.month, d.day, 12, 0))
        for _ in range(40):
            cur = await s.p.get_attribute('#tot', 'aria-label')
            if int(cur.split()[0]) >= int(cur.split(' of ')[1].split()[0]):
                break
            await s.click('[data-act="quick"] >> nth=0', settle=60)
        await s.tick(3000)
        if asked_on is None and await s.p.evaluate('window.__rate') > 0:
            asked_on = day
    st = await s.state()
    s.note('goal days celebrated: %d; rating asked on simulated day %s' % (len(st['celebrated']), asked_on))
    s.expect(asked_on is not None and await s.p.evaluate('window.__rate') == 1, 'rating asked exactly once')
    await s.check('features end')
    await s.close()


# =====================================================================
# Scenario 11: weather boost (fake weather service), crown, share card, looks, Health Connect switch
# =====================================================================
async def extras(browser):
    s = Sim(browser, 'extras', ny(2026, 7, 14, 6, 50))
    await s.open()
    await s.onboard(weight=180, activity='moderate', schedule='day', remind=False)
    calls = {'points': 0, 'forecast': 0}
    highs = {'2026-07-14': 93, '2026-07-15': 78}

    async def points(route):
        calls['points'] += 1
        await route.fulfill(json={'properties': {'forecast': 'https://api.weather.gov/gridpoints/ILN/40,70/forecast'}},
                            headers={'Access-Control-Allow-Origin': '*'})

    async def forecast(route):
        calls['forecast'] += 1
        now = await s.now()
        key = now.strftime('%Y-%m-%d')
        await route.fulfill(json={'properties': {'periods': [
            {'isDaytime': True, 'startTime': key + 'T06:00:00-04:00', 'temperature': highs.get(key, 80), 'temperatureUnit': 'F'}]}},
            headers={'Access-Control-Allow-Origin': '*'})
    await s.p.route('https://api.weather.gov/points/**', points)
    await s.p.route('https://api.weather.gov/gridpoints/**', forecast)

    await s.tab('settings')
    await s.click('#set-weather')
    await s.p.fill('#set-zip', '00012')
    await s.p.dispatch_event('#set-zip', 'change'); await s.tick(400)
    t = await s.p.inner_text('#toast')
    s.expect('couldn’t find that ZIP' in t, 'an unknown ZIP is refused: %s' % t)
    await s.p.fill('#set-zip', '45385')
    await s.p.dispatch_event('#set-zip', 'change'); await asyncio.sleep(1.0); await s.tick(1500)
    st = await s.state()
    s.expect(st['boosts'].get('2026-07-14') and st['autoBoost'].get('2026-07-14') == 93, '93°F forecast turns on the boost automatically')
    await s.tab('today')
    chip = await s.p.inner_text('#boostBtn')
    s.expect('93°F' in chip and '+16 oz' in chip, 'Today shows the hot-day chip with the temperature: %s' % chip.strip())
    await s.check('weather hot')
    # reopening the same day doesn't call the weather service again
    before = dict(calls)
    await s.p.reload(); await s.tick(600); await asyncio.sleep(1.0); await s.tick(1000)
    s.expect(calls['forecast'] == before['forecast'], 'only one forecast check per day')
    # next day is mild: no boost; forecast URL is cached (no second /points call)
    points_before = calls['points']
    await s.at(ny(2026, 7, 15, 8, 0))
    await s.p.reload(); await s.tick(600); await asyncio.sleep(1.0); await s.tick(1000)
    st = await s.state()
    s.expect(not st['boosts'].get('2026-07-15') and st['weather']['high'] == 78, '78°F day: no boost')
    s.expect(calls['points'] == points_before, 'forecast address is cached, not looked up again (points calls: %d)' % calls['points'])
    # weather service down: app keeps working
    await s.p.unroute('https://api.weather.gov/gridpoints/**')
    await s.p.route('https://api.weather.gov/gridpoints/**', lambda r: r.abort())
    await s.at(ny(2026, 7, 16, 8, 0))
    await s.p.reload(); await s.tick(600); await asyncio.sleep(1.0); await s.tick(1000)
    await s.check('weather down')

    # crown: seed a 30-day streak, then check the look unlocks for a free user
    st = await s.state()
    t0 = int(ny(2026, 6, 15, 12, 0).timestamp() * 1000)
    for d in range(31):
        st['log'].append({'id': 'c%d' % d, 'ts': t0 + d * 86400000, 'ml': st['goalMl'] + 600, 'drink': 'water', 'src': 'manual'})
    await s.p.evaluate('s => localStorage.setItem(%s, JSON.stringify(s))' % json.dumps(KEY), st)
    await s.p.reload(); await s.tick(800)
    await s.tab('settings')
    await s.click('[data-act="acc"][data-acc="crown"]')
    st = await s.state()
    s.expect(st['accessory'] == 'crown', 'a free user with a 30-day streak can wear the crown')
    await s.tab('today')
    s.expect(await s.p.get_attribute('.progress-card .drip', 'data-acc') == 'crown', 'Drip wears the crown on Today')
    # Plus looks locked for free users
    await s.tab('settings')
    await s.click('[data-act="acc"][data-acc="hardhat"]')
    s.expect(await s.p.is_visible('#pwBuy'), 'the hard hat asks for Plus')
    await s.click('#pwBuy'); await s.tab('settings')
    await s.click('[data-act="acc"][data-acc="hardhat"]')
    st = await s.state()
    s.expect(st['accessory'] == 'hardhat', 'with Plus the hard hat goes on')
    # share card
    await s.tab('history')
    await s.click('[data-act="share-card"]'); await s.tick(1500)
    ok = await s.p.evaluate("(() => { const i = document.querySelector('.sharecard'); return !!(i && i.naturalWidth === 1080 && i.naturalHeight === 1350); })()")
    s.expect(ok, 'share card renders as a 1080x1350 picture')
    if ok:
        data = await s.p.evaluate("document.querySelector('.sharecard').src")
        import base64
        open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'last-share-card.png'), 'wb').write(base64.b64decode(data.split(',')[1]))
    await s.click('[data-close]')
    # Health Connect switch in a browser explains itself and stays off
    await s.tab('settings')
    await s.click('#set-hc'); await s.tick(400)
    t = await s.p.inner_text('#toast')
    st = await s.state()
    s.expect('Android app' in t and not st['hc']['on'], 'Health Connect switch in the browser says it works in the Android app')
    await s.check('extras end')
    await s.close()


SCENARIOS = {'week': week, 'night': night, 'rollover': rollover, 'bottles': bottles, 'undo': undo,
             'reminders': reminders, 'fuzz': fuzz, 'bigdata': bigdata, 'persist': persist, 'features': features,
             'extras': extras}


async def main(names):
    exe = os.environ.get('PW_CHROMIUM')
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=exe) if exe else await p.chromium.launch()
        for n in names:
            t = time.perf_counter()
            try:
                if n == 'fuzz':
                    for seed in (7, 21, 99):
                        await fuzz(browser, seed=seed)
                else:
                    await SCENARIOS[n](browser)
            except Exception:
                tb = traceback.format_exc().strip().splitlines()
                where = [l.strip() for l in tb if 'simulate.py' in l]
                msg = [l.strip() for l in tb if 'Error' in l][-1:] or tb[-1:]
                RESULTS.append((n, 'FAIL', 'scenario crashed at %s: %s' % (' <- '.join(where[-3:]), msg[0][:300])))
            RESULTS.append((n, 'time', '%.0fs' % (time.perf_counter() - t)))
        await browser.close()
    fails = [r for r in RESULTS if r[1] == 'FAIL']
    for r in RESULTS:
        if r[1] != 'ok':
            print('%-18s %-5s %s' % r)
    print('\nchecks passed: %d   failed: %d' % (len([r for r in RESULTS if r[1] == 'ok']), len(fails)))
    return 1 if fails else 0


if __name__ == '__main__':
    sel = sys.argv[1:] or list(SCENARIOS)
    sys.exit(asyncio.run(main(sel)))
