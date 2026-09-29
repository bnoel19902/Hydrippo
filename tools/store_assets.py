"""Renders the app icon, splash, Play Store icon, feature graphic and captioned screenshots.
Run: python3 tools/store_assets.py   (needs Playwright + Chromium)"""
import asyncio, base64, os, pathlib, datetime, tempfile
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
A = ROOT / 'assets'
SS = ROOT / 'store-listing' / 'screenshots'
SS.mkdir(parents=True, exist_ok=True)
URL = 'file://' + str(ROOT / 'www/index.html')
TMP = pathlib.Path(tempfile.mkdtemp(prefix='hydrippo-assets-'))
TMP.mkdir(exist_ok=True)

def font_face():
    f = ROOT / 'www/fonts'
    b = lambda n: base64.b64encode((f / n).read_bytes()).decode()
    return ("@font-face{font-family:Sniglet;font-weight:800;src:url(data:font/woff2;base64,%s)}"
            "@font-face{font-family:Sniglet;font-weight:400;src:url(data:font/woff2;base64,%s)}"
            "@font-face{font-family:'Atkinson Hyperlegible Next';font-weight:200 800;src:url(data:font/woff2;base64,%s)}") % (
        b('sniglet-latin-800-normal.woff2'), b('sniglet-latin-400-normal.woff2'), b('atkinson-hyperlegible-next-latin-wght-normal.woff2'))

ICON = (A / 'icon.svg').read_text()
FG = ICON.replace('<rect width="512" height="512" fill="#D3EAEE"/>', '')

async def shot_html(browser, html, path, w, h, transparent=False):
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
    p = await ctx.new_page()
    await p.set_content(html)
    await p.wait_for_timeout(300)
    await p.screenshot(path=str(path), omit_background=transparent)
    await ctx.close()

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        SIZED = '<svg width="100%" height="100%" style="display:block" '
        def svg_page(svg, bg='transparent'):
            return '<html><body style="margin:0;height:100vh;background:' + bg + '">' + svg.replace('<svg ', SIZED, 1) + '</body></html>'
        await shot_html(b, svg_page(ICON), A / 'icon-only.png', 1024, 1024)
        await shot_html(b, svg_page(ICON), ROOT / 'store-listing' / 'play-icon-512.png', 512, 512)
        await shot_html(b, svg_page(FG), A / 'icon-foreground.png', 1024, 1024, transparent=True)
        await shot_html(b, '<html><body style="margin:0;background:#D3EAEE"></body></html>', A / 'icon-background.png', 1024, 1024)
        # Splash: Drip centered on the app background
        splash = lambda bg, word: f'''<html><head><style>{font_face()}body{{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:60px;background:{bg}}}
          .ic{{width:900px;height:900px;border-radius:200px;overflow:hidden}} .w{{font:800 220px Sniglet;color:{word}}} .w b{{color:#2BA6CD}}</style></head>
          <body><div class="ic">{ICON}</div><div class="w">Hydr<b>ippo</b></div></body></html>'''
        await shot_html(b, splash('#E6F1F2', '#15303A'), A / 'splash.png', 2732, 2732)
        await shot_html(b, splash('#0D1A20', '#E3F0F2'), A / 'splash-dark.png', 2732, 2732)

        # Feature graphic 1024x500
        fg = f'''<html><head><style>{font_face()}
          body{{margin:0;width:1024px;height:500px;overflow:hidden;background:#E6F1F2;font-family:'Atkinson Hyperlegible Next',sans-serif;color:#15303A;display:grid;grid-template-columns:440px 1fr;align-items:center}}
          .art{{height:500px;display:flex;align-items:center;justify-content:center}} .art svg{{width:360px;height:360px;border-radius:72px;display:block;box-shadow:0 18px 50px rgba(21,48,58,.18)}}
          .copy{{display:flex;flex-direction:column;gap:18px;padding-right:56px}}
          .w{{font:800 92px/1 Sniglet;letter-spacing:.01em}} .w b{{color:#2BA6CD}}
          .t{{font-size:38px;font-weight:700;line-height:1.15}}
          .chips{{display:flex;gap:10px;flex-wrap:wrap}} .chips span{{background:#fff;border:2px solid #C3D8DB;border-radius:999px;padding:8px 16px;font-size:22px;font-weight:700;color:#1A7EA2}}
          </style></head><body><div class="art">{ICON}</div><div class="copy"><div class="w">Hydr<b>ippo</b></div>
          <div class="t">Log water by sliding the line on your own bottle.</div>
          <div class="chips"><span>No ads</span><span>Night-shift friendly</span><span>Offline</span></div></div></body></html>'''
        await shot_html(b, fg, ROOT / 'store-listing' / 'feature-graphic.png', 1024, 500)

        # Raw app screens at a fixed time of day so the sample looks mid-day.
        fixed = datetime.datetime(2026, 9, 23, 14, 40)
        async def app_page(**kw):
            ctx = await b.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2, timezone_id='America/New_York', **kw)
            p = await ctx.new_page()
            await p.clock.set_fixed_time(fixed)
            await p.goto(URL)
            await p.wait_for_timeout(400)
            return ctx, p

        ctx, p = await app_page()
        await p.wait_for_timeout(900)
        await p.screenshot(path=str(TMP / 'welcome.png'))
        await p.click('[data-ob="sample"]')
        await p.wait_for_timeout(1300)
        await p.click('#refillBtn'); await p.wait_for_timeout(700)
        await p.evaluate("window.scrollTo(0,0); document.scrollingElement.scrollTop = 0"); await p.wait_for_timeout(300)
        await p.evaluate("document.getElementById('toast').hidden = true; var n=document.querySelector('.sample-note'); if(n) n.remove()")
        knob = await p.query_selector('.b-knob'); bb = await knob.bounding_box()
        x, y = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
        await p.mouse.move(x, y); await p.mouse.down()
        for i in range(1, 9): await p.mouse.move(x, y + i * 8)
        await p.wait_for_timeout(200)
        await p.screenshot(path=str(TMP / 'drag.png'))
        await p.mouse.up(); await p.wait_for_timeout(300)
        await p.evaluate("document.getElementById('toast').hidden = true")
        await p.click('.tab[data-tab="history"]'); await p.wait_for_timeout(300)
        await p.evaluate("var n=document.querySelector('.sample-note'); if(n) n.remove()")
        await p.screenshot(path=str(TMP / 'history.png'))
        await ctx.close()

        ctx, p = await app_page()
        await p.click('text=Set up in 30 seconds'); await p.click('[data-ob="next"]'); await p.click('[data-ob="next"]')
        await p.click('[data-obh="night"]'); await p.wait_for_timeout(200)
        await p.screenshot(path=str(TMP / 'night.png'))
        await ctx.close()

        # Compose captioned 1080x1920 store screenshots.
        caps = [
            ('drag.png', 'Slide the line on <b>your own bottle.</b>', 'That’s the whole log.'),
            ('night.png', 'Work nights? <b>Your day ends when you sleep.</b>', 'Not at midnight.'),
            ('history.png', 'Streaks, charts, <b>and every refill.</b>', 'Drip gets a deeper soak as you drink.'),
            ('welcome.png', 'No ads. No account. <b>Just water.</b>', 'Everything stays on your phone.'),
        ]
        for i, (img, title, sub) in enumerate(caps, 1):
            data = base64.b64encode((TMP / img).read_bytes()).decode()
            html = f'''<html><head><style>{font_face()}
              body{{margin:0;width:1080px;height:1920px;overflow:hidden;background:#1A7EA2;font-family:'Atkinson Hyperlegible Next',sans-serif;display:flex;flex-direction:column;align-items:center}}
              .cap{{padding:96px 80px 56px;text-align:center;color:#fff}} h1{{margin:0;font:800 76px/1.08 Sniglet;letter-spacing:.005em}} h1 b{{color:#BFE9F6;font-weight:800}}
              p{{margin:22px 0 0;font-size:38px;color:#D6F0F7;font-weight:600}}
              .phone{{width:780px;border-radius:64px;overflow:hidden;border:14px solid #0E2A35;box-shadow:0 30px 80px rgba(0,0,0,.35);background:#E6F1F2}}
              .phone img{{display:block;width:100%}}</style></head>
              <body><div class="cap"><h1>{title}</h1><p>{sub}</p></div><div class="phone"><img src="data:image/png;base64,{data}"></div></body></html>'''
            await shot_html(b, html, SS / f'phone-{i}.png', 1080, 1920)
        await b.close()

asyncio.run(main())
print('done')
