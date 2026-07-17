# DEM-Osc Landing Page

A mobile-first, tap-to-play landing page for the **free** DEM-Osc plugin — built to turn a
TikTok tap into a download. Tap the hand-drawn cassette and it cycles through six real DEM-Osc
sounds; one big "Get DEM-Osc — Free" button drops the plugin into the cart and lands on checkout.

---

## The two things you'll actually edit

**1. The buy link — ONE place.** Open the HTML and find, right under `<body>`:

```js
window.DEMOSC_CART_LINK = "https://clayandkelsy.com/checkout/?add-to-cart=6322&quantity=1";
```

Change that one line and **every** button on the page updates (top bar, hero, sticky, final).

**2. The words.** Every headline/paragraph is marked with a comment like `<!-- EDIT: hero headline -->`.
Change the text under it. Done.

---

## Which file do I use?

| File | Use it for |
|---|---|
| **`wordpress-embed.html`** | ⭐ **Paste onto a WordPress page** (Custom HTML block). CSS is scoped so it won't touch your theme. |
| **`index-standalone.html`** | Host as its own page/URL (one self-contained file, nothing else needed). |
| `index.html` + `assets/` | The editable source (what everything is built from). |
| `artifact.html` | Internal — the version hosted on the claude.ai preview link. |
| `_source-art/` | Original hi-res artwork, for future edits. |
| `build_standalone.py` | Rebuilds the 3 output files after you edit `index.html` / `assets`. |

> After editing `index.html` or anything in `assets/`, run `python3 build_standalone.py` to
> regenerate `wordpress-embed.html`, `index-standalone.html`, and `artifact.html`.

---

## Put it on WordPress

1. Create a **new page**.
2. **Set the page template to Full-Width / Blank / Canvas** (whatever your theme calls the
   no-header, no-sidebar option). This matters — the landing wants the whole screen, and it
   keeps your theme's header from sitting on top of it. (It still works with a normal template,
   your header just appears above it.)
3. Add a single **"Custom HTML"** block.
4. Open **`wordpress-embed.html`**, select all (⌘A), copy, paste it into the block.
5. **Publish.** Point your TikTok ad at that page's URL.

No plugins, no FTP — art, all six sounds, and the 3-D code are baked into that one paste. The
CSS is scoped so it can't fight your theme (and your theme can't break it).

> **Important:** paste `wordpress-embed.html` (not `index.html`). It's the theme-safe build.
> After any edit to `index.html`/`assets`, re-run `python3 build_standalone.py` and re-paste.

**Prefer a standalone URL instead?** Upload **`index-standalone.html`** to your host (rename it
`index.html` inside a folder like `dem-osc-free`) → live at `clayandkelsy.com/dem-osc-free/`.
Fastest load, zero theme involvement.

---

## The six preview sounds

Real DEM-Osc renders in `assets/audio/`: `pad, keys, bass, lead, strings, brass`. Tapping the
cassette cycles through them; the chips jump straight to one. To swap a sound, replace the mp3
and its chip label in `index.html` (search `data-clip`), then re-run `build_standalone.py`.

---

## Availability
Currently set to **"Mac only (for now)"** with a muted "Windows soon" badge. When Windows ships,
search `Mac only (for now)` and `Windows soon` in `index.html` and update.

---

## Preview locally
```
cd "DEM-Osc Landing"
python3 -m http.server 4599
```
Open `http://localhost:4599/` on your computer, or `http://<your-mac-ip>:4599/` on your phone.

---

*Clay and Kelsy Instruments · "This is just a taste."*
