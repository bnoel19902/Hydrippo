"""Renders the widget's Drip images (4 moods x light/dark) and the widget preview image
from the real app CSS and art.js, so the widget matches the app exactly.
Run: python3 tools/widget_art.py   (needs Playwright + Chromium)"""
import asyncio, os, pathlib, tempfile
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
WWW = ROOT / 'www'
RES = ROOT / 'android/app/src/main/res'
MOODS = {'thirsty': 0.12, 'ok': 0.5, 'happy': 0.86, 'splash': 1.0}

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/fonts.css"><link rel="stylesheet" href="css/app.css">
<style>html,body{background:transparent!important;margin:0}
#out{display:flex;gap:10px;padding:10px}
#out svg{width:320px;height:240px;display:block}
*{animation:none!important;transition:none!important}</style></head>
<body><div id="out"></div><script src="js/art.js"></script>
<script>
var moods = %s;
Object.keys(moods).forEach(function(k){
  var d = HydArt.drip({fill: moods[k]});
  d.el.id = 'm-' + k; document.getElementById('out').appendChild(d.el);
});
</script></body></html>"""

PREVIEW = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;font-family:Roboto,"Noto Sans",Arial,sans-serif}
.w{width:%(w)dpx;height:%(h)dpx;box-sizing:border-box;padding:10px;border-radius:22px;background:%(surface)s;display:flex;flex-direction:column}
.top{flex:1;display:flex;align-items:center;gap:8px;min-height:0}
.top img{width:52px;height:39px}
.t{font-size:22px;font-weight:700;color:%(ink)s;line-height:1.1}
.g{font-size:12px;color:%(ink2)s}
.bar{height:6px;border-radius:3px;background:%(track)s;margin:6px 0 8px;overflow:hidden}
.bar i{display:block;height:100%%;width:46%%;background:%(water)s;border-radius:3px}
.btn{height:36px;border-radius:18px;background:%(btn)s;color:%(btnink)s;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="w" id="w"><div class="top"><img src="%(drip)s"><div><div class="t">48 oz</div><div class="g">of 104 oz</div></div></div>
<div class="bar"><i></i></div><div class="btn">+ 8 oz</div></div></body></html>"""

LIGHT = dict(surface='#F8FCFC', ink='#15303A', ink2='#4C6670', track='#C3D8DB', water='#2BA6CD', btn='#1A7EA2', btnink='#FFFFFF')


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme, folder in (('light', 'drawable-nodpi'), ('dark', 'drawable-night-nodpi')):
            ctx = await b.new_context(color_scheme=scheme, device_scale_factor=2, viewport={'width': 1400, 'height': 400})
            page = await ctx.new_page()
            tmp = WWW / '_widget_art.html'
            tmp.write_text(PAGE % str(MOODS).replace("'", '"'))
            await page.goto(tmp.as_uri())
            await page.wait_for_timeout(300)
            out = RES / folder
            out.mkdir(parents=True, exist_ok=True)
            for k in MOODS:
                await page.locator('#m-' + k).screenshot(path=str(out / f'drip_{k}.png'), omit_background=True)
            tmp.unlink()
            await ctx.close()
        # Preview image for the widget picker on Android 11 and older.
        ctx = await b.new_context(device_scale_factor=2, viewport={'width': 400, 'height': 300})
        page = await ctx.new_page()
        html = PREVIEW % dict(LIGHT, w=170, h=130, drip=(RES / 'drawable-nodpi/drip_ok.png').as_uri())
        prev = pathlib.Path(tempfile.mkdtemp()) / '_preview.html'
        prev.write_text(html)
        await page.goto(prev.as_uri())
        await page.locator('#w').screenshot(path=str(RES / 'drawable-nodpi/widget_preview.png'), omit_background=True)
        await b.close()
    for f in sorted(RES.glob('drawable*nodpi/*.png')):
        print(f.relative_to(RES), os.path.getsize(f))

asyncio.run(main())
