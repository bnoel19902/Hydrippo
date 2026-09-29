"""Inlines www/ into one self-contained HTML page (the browser test link).
Run: python3 tools/build_single.py out.html"""
import base64, json, re, pathlib, sys

www = pathlib.Path(__file__).resolve().parent.parent / 'www'
out = pathlib.Path(sys.argv[1])

fonts_css = (www / 'css/fonts.css').read_text()
def embed(m):
    path = (www / 'css' / m.group(1)).resolve()
    b64 = base64.b64encode(path.read_bytes()).decode()
    return "url('data:font/woff2;base64," + b64 + "')"
fonts_css = re.sub(r"url\('([^']+)'\)", embed, fonts_css)
app_css = (www / 'css/app.css').read_text()

html = (www / 'index.html').read_text()
body = html.split('<body>')[1].split('</body>')[0]

def inline_script(m):
    return '<script>\n' + (www / m.group(1)).read_text() + '\n</script>'
body = re.sub(r'<script src="([^"]+)"></script>', inline_script, body)

# The privacy page is shown in a sheet; in the single file it rides along as a string.
privacy = json.dumps((www / 'privacy.html').read_text()).replace('</', '<\\/')  # keep </script> from closing early
body = '<script>window.HYD_PRIVACY_HTML = ' + privacy + ';</script>\n' + body

page = ('<title>Hydrippo</title>\n'
        '<style>\n' + fonts_css + '\n' + app_css + '\n</style>\n' + body.strip() + '\n')
out.write_text(page)
print(out, len(page) // 1024, 'KB')
