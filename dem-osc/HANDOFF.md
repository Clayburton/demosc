# DEM-Osc v2 — handoff (2026-09-02)

**Plain summary.** The free-synth page is the one we run ads to, and phones don't convert. This is a
second version built for the phone first, on the same system as Hook and Pro-Osc v2. The download
flow is untouched: every button still goes to the WordPress checkout for the free product (#6322),
in the top window, where the email is captured and the download is granted. Preview:
https://clayburton.github.io/hook-site/dem-osc-v2/ . Nothing is live.

## Why phones weren't converting (what I found)
1. **The page weighs 2.4 MB.** The current page inlines seven sound clips and three images as
   base64 and ships a 1.8 MB 3D library to spin a cassette. On a phone in TikTok's browser that is
   a long wait before anything moves. v2 is ~350 KB on first load: one cassette image, one
   stylesheet, one script; the sounds stream only when tapped.
2. **A phone can't install a Mac plugin.** People arrive from TikTok, want it, can't act, leave. The
   page never said what to do about that. Clay's own plan (`C&K Marketing/website-prompts.md`,
   Prompt 2) is the answer, and the checkout already does it: a free order emails the download
   link. v2 says so on phones, right under the button: "On your phone? Same button. Check out free
   and we'll email you the download link, so it's waiting when you're back at your computer."
3. **The button drifts out of reach.** v2 adds a thumb-zone bar on phones that appears once the
   hero button has scrolled away. One sticky reach, nowhere else.
4. **The ask came late.** Hero order on a phone: name, promise, button, the phone line, three
   facts, then the tape. The button is inside the first screen.

## What stayed from the current page (it was good)
The hand-drawn cassette and "tap to hear her"; the six named sounds (Winter Pad, Dem EP, Big Stack,
Tube Army, Dem Ensemble, 1984) as tap-to-play; every line of copy, verbatim, from both the demosc page
and the WordPress page; the purple accent; the "adds to your cart — just add email & check out" note;
the FAQ. The 3D cassette is replaced by the same drawing, which wobbles while a sound plays.

## New lines (Kelsy signs off)
The phone note above (it's Clay's wording from Prompt 2, lightly trimmed); the three fact pills
("Free, no time limit" · "Full instrument, nothing crippled" · "25 presets that already sound
finished" — all from the FAQ and lead); "Hear it first"; "Tap a sound. It streams, nothing to
download."; the FAQ heading "Before you download."; the makers paragraph is Kelsy's from Hook with
the product name changed.

## Check before it goes live
- **The WooCommerce product is still named "Dem-Osc (Kontakt)"** — that's what people see at
  checkout, on a phone, after a page that says VST3/AU. Rename it in WooCommerce ("DEM-Osc — free
  synth for Mac"). I did not touch WordPress.
- Confirm the free-order email actually contains the download link (the phone line promises it).
- Checkout asks first name, last name, email, and offers an account. Fine on a phone; shorter is better.
- `secret.mp3` (32 KB) came out of the old page — an easter egg I didn't wire. Keep or drop.
- The click on any download button posts `{hook:"event", name:"free_synth_click"}` to the host page;
  add one line to the WordPress block to push it to GTM's dataLayer (`free_synth_click`).

## Embedding
Same host block pattern as Hook (`../wordpress-embed.html`): ORIGIN/path to this folder, the
wordmark, the link ids (`#hear`, `#inside`, `#faq`). The host draws the menu bar; on phones this page
also shows its own thumb bar, which is correct here (an ad landing page wants the action in reach).
