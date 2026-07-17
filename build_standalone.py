#!/usr/bin/env python3
"""Inline every asset into one self-contained index-standalone.html.
Run from the DEM-Osc Landing folder:  python3 build_standalone.py
"""
import base64, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, "assets")

def read(p):        return open(p, "r", encoding="utf-8").read()
def datauri(p, mime):
    b = base64.b64encode(open(p, "rb").read()).decode("ascii")
    return "data:%s;base64,%s" % (mime, b)

html   = read(os.path.join(HERE, "index.html"))
three  = read(os.path.join(A, "three.min.js"))
app    = read(os.path.join(A, "app.js"))
svg    = read(os.path.join(A, "logo.svg"))

hero   = datauri(os.path.join(A, "hero_cassette_ink_1200.webp"), "image/webp")
iface  = datauri(os.path.join(A, "interface.webp"), "image/webp")
clips  = {n: datauri(os.path.join(A, "audio", n + ".mp3"), "audio/mpeg")
          for n in ("pad", "keys", "bass", "lead", "strings", "brass")}

# --- rewrite asset paths inside app.js ---
for n in clips:
    app = app.replace("'assets/audio/%s.mp3'" % n, json.dumps(clips[n]))
app = app.replace("loader.load('assets/hero_cassette_ink_1200.webp'",
                  "loader.load(" + json.dumps(hero))

# --- rewrite index.html ---
# interface screenshot
html = html.replace('src="assets/interface.webp"', 'src="%s"' % iface)
# fallback cassette image
html = html.replace('data-src="assets/hero_cassette_ink_1200.webp"',
                    'data-src="%s"' % hero)
# logo: replace the whole fetch('assets/logo.svg') block with a direct inline injection
# (must match — otherwise the standalone keeps fetching a file that isn't hosted, and a
#  missing-file 404 page gets dumped into the logo div)
logo_script = re.search(r"<script>(?:(?!</script>).)*?fetch\('assets/logo\.svg'\).*?</script>",
                        html, re.S)
if logo_script:
    html = html.replace(logo_script.group(0),
        "<script>document.getElementById('logo').innerHTML=%s;</script>" % json.dumps(svg))
else:
    raise SystemExit("ERROR: logo inline replacement did not match — standalone would still fetch assets/logo.svg")
# three.js + app.js -> inline
html = html.replace('<script src="assets/three.min.js"></script>',
                    "<script>\n%s\n</script>" % three)
html = html.replace('<script src="assets/app.js"></script>',
                    "<script>\n%s\n</script>" % app)

out = os.path.join(HERE, "index-standalone.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote %s  (%.2f MB)" % (out, os.path.getsize(out) / 1e6))

# also emit artifact.html = <style> + <body> inner only (for claude.ai Artifact hosting)
style = re.search(r"<style>.*?</style>", html, re.S).group(0)
inner = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
art = os.path.join(HERE, "artifact.html")
open(art, "w", encoding="utf-8").write(style + "\n" + inner)
print("wrote %s  (%.2f MB)" % (art, os.path.getsize(art) / 1e6))

# ── wordpress-embed.html ──────────────────────────────────────────────────
# The page scoped under #demosc-app so it (a) can't leak into a WP theme and
# (b) wins the specificity war against theme CSS (so padding etc. survive).
ROOT = "#demosc-app"
STATE = (".playing", ".noscene", ".loading")

def split_rules(s):
    """Split CSS into (selector-or-atrule, body) pairs, brace-aware."""
    out, buf, i, n = [], "", 0, len(s)
    while i < n:
        c = s[i]
        if c == "{":
            sel = buf.strip(); depth = 1; j = i + 1
            while j < n and depth:
                if s[j] == "{": depth += 1
                elif s[j] == "}": depth -= 1
                j += 1
            out.append((sel, s[i + 1:j - 1])); buf = ""; i = j
        else:
            buf += c; i += 1
    return out

def prefix_sel(sel):
    parts = []
    for p in [x.strip() for x in sel.split(",") if x.strip()]:
        if p in (":root", "html", "body"):
            parts.append(ROOT)
        elif p == "*":
            parts.append(ROOT + " *")
        elif any(p.startswith(st) for st in STATE):   # state class lives ON the wrapper
            parts.append(ROOT + p)
        else:
            parts.append(ROOT + " " + p)
    return ", ".join(parts)

def importantize(decls):
    """Append !important to each declaration so theme rules (even element-level
    !important) can't override our scoped layout. Values here contain no ';'."""
    out = []
    for d in decls.split(";"):
        d = d.strip()
        if not d:
            continue
        out.append(d if "!important" in d else d + " !important")
    return ";".join(out)

def scope_css(s):
    out = []
    for sel, body in split_rules(s):
        low = sel.strip().lower()
        if low.startswith("@keyframes") or low.startswith("@-webkit-keyframes") or low.startswith("@font-face"):
            out.append("%s{%s}" % (sel, body))                       # leave inner untouched
        elif low.startswith("@media") or low.startswith("@supports"):
            out.append("%s{%s}" % (sel, scope_css(body)))            # recurse into inner rules
        else:
            out.append("%s{%s}" % (prefix_sel(sel), importantize(body)))
    return "".join(out)

raw_css = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
raw_css = re.sub(r"/\*.*?\*/", "", raw_css, flags=re.S)   # drop CSS comments first
css = scope_css(raw_css)
# strip HTML comments from the markup — WordPress renders them as visible text
wp_inner = re.sub(r"<!--.*?-->", "", inner, flags=re.S)
wp = ('<style>%s</style>\n<div id="demosc-app" class="loading">\n%s\n</div>' % (css, wp_inner))
wpf = os.path.join(HERE, "wordpress-embed.html")
open(wpf, "w", encoding="utf-8").write(wp)
print("wrote %s  (%.2f MB)" % (wpf, os.path.getsize(wpf) / 1e6))
