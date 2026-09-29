"""Builds www/privacy.html from store-listing/privacy-policy.md.
The same page is shown inside the app (Settings > About, and when Health Connect asks)
and can be hosted on the web for the Play Store listing.
Run: python3 tools/privacy_html.py   (needs: pip install markdown)"""
import pathlib, re
import markdown

ROOT = pathlib.Path(__file__).resolve().parent.parent
md = (ROOT / 'store-listing/privacy-policy.md').read_text()
body = markdown.markdown(md)
# Turn bare web addresses into links.
body = re.sub(r'(?<![">])(https://[^\s<)]+[^\s<).,])', r'<a href="\1">\1</a>', body)

page = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hydrippo Privacy Policy</title>
<style>
  :root { --bg:#E6F1F2; --surface:#F8FCFC; --ink:#15303A; --ink-2:#4C6670; --line:#C3D8DB; --link:#1A7EA2; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0D1A20; --surface:#14262E; --ink:#E3F0F2; --ink-2:#A2BAC1; --line:#294550; --link:#7FD6F0; }
  }
  html { background: var(--bg); }
  body { margin: 0; padding: 20px 16px 40px; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--bg); }
  main { max-width: 680px; margin: 0 auto; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 8px 20px 20px; }
  h1 { font-size: 24px; line-height: 1.25; margin: 16px 0 4px; }
  h2 { font-size: 18px; margin: 24px 0 6px; }
  p, li { color: var(--ink); }
  em { color: var(--ink-2); font-style: normal; font-size: 14px; }
  a { color: var(--link); overflow-wrap: anywhere; }
  ul { padding-left: 22px; }
</style>
</head>
<body>
<main>
%s
</main>
</body>
</html>
""" % body
(ROOT / 'www/privacy.html').write_text(page)
print('wrote www/privacy.html', len(page), 'bytes')
