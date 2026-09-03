/* Pro-Osc v2 — the Hook page's engine (app.js), trimmed to what a synth page needs. Runs two ways.
   STANDALONE (this document is the scroller): sticky nav, Lenis smooth scroll, native scroll events.
   EMBEDDED (inside clayandkelsy.com's auto-growing iframe, which never scrolls itself): the host
   posts its viewport ({hookHost:"vp", top, vh}) on every scroll; everything that follows the page
   measures against that; the nav is pinned by JS and only shows once the C&K menu bar has
   scrolled away; we post our height and theme color back up so the frame fits and the page
   behind it matches. Everything degrades: no JS → static page; reduced motion → no animation. */
/* Reusable on any C&K page: everything down to the hold-to-catch block (viewport pipe, nav, reveals,
   reading light, theme + nightfall, walkthrough, height posting). Hook-only: hold-to-catch, hero phone,
   rhyme demo. Blocks are marked  ---------- name ----------  in block comments, so you can grep for them. */

const doc = document.documentElement;
const IS_EMBEDDED = window.self !== window.top;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse  = matchMedia("(pointer: coarse)").matches;
const NAV_H = 64;
const THEME_BG = { light: "#f0e8d7", dark: "#161009" };
const themeMeta = document.querySelector('meta[name="theme-color"]');
let userTouchedTheme = false;
if (IS_EMBEDDED) document.body.classList.add("embedded");

/* ---------- the viewport we measure against ----------
   Embedded: host.top = the frame's top edge in the host viewport (positive while the C&K header
   is above us, negative once we've scrolled past the top), host.vh = the host viewport height.
   An element's position relative to the host viewport is its frame position + host.top. */
const host = { top: 0, vh: 0, top0: null, ready: false, nav: false, adminH: 0 };   /* adminH: live coverage of the WP admin bar (0 for visitors) */
/* host-driven measurement only once an auto-grow host has actually posted a viewport message
   (host.ready); until then — standalone, or inside a fixed-height iframe that posts nothing —
   fall back to this document's own native scroll, so the page is never stuck invisible. */
const vpH   = () => (IS_EMBEDDED && host.ready) ? (host.vh || 800) : innerHeight;
const vpTop = () => (IS_EMBEDDED && host.ready) ? Math.max(0, -host.top) : (window.scrollY || 0);
const off   = () => (IS_EMBEDDED && host.ready) ? host.top : 0;
const relTop    = el => el.getBoundingClientRect().top + off();
const relBottom = el => el.getBoundingClientRect().bottom + off();
function setVh() { doc.style.setProperty("--vh", vpH() + "px"); }
setVh();
/* ---------- smooth scroll: standalone desktop only (embedded, the host page does it) ---------- */
let lenis = null;
if (!IS_EMBEDDED && !reduced && !coarse && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
/* ---------- one pipe for everything that follows the page ---------- */
const scrollHandlers = [];
function tick() { for (const h of scrollHandlers) h(); }
if (IS_EMBEDDED) {
  addEventListener("message", e => {
    const d = e.data; if (!d || !d.hookHost) return;
    /* a host with its own fixed menu bar (the newer embed) sends its link clicks down here */
    if (d.hookHost === "go") { const t = d.id && document.querySelector(d.id); if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); return; }
    if (d.hookHost !== "vp" || typeof d.top !== "number") return;
    if (d.nav && !host.nav) { host.nav = true; const n = document.getElementById("nav"); if (n) n.style.display = "none"; }
    host.top = d.top; if (typeof d.vh === "number" && d.vh > 0) host.vh = d.vh;
    if (typeof d.adminH === "number") host.adminH = d.adminH;
    if (!host.ready) { host.ready = true; host.top0 = Math.max(0, d.top); fitHero(); }
    setVh(); tick();
  });
}
/* native scroll ALSO drives the page — standalone, AND inside a fixed-height iframe (the current
   demosc /pro-osc/ embed posts no viewport messages). Harmless under an auto-grow host: that iframe
   is content-height so it never scrolls internally, and host.ready makes the helpers ignore scrollY. */
addEventListener("scroll", tick, { passive: true });
addEventListener("resize", () => { setVh(); tick(); });
/* embedded: the hero fills what's visible under the C&K header when the page opens */
function fitHero() {
  const hero = document.querySelector(".hero");
  if (hero && IS_EMBEDDED) hero.style.minHeight = Math.max(560, host.vh - (host.top0 || 0)) + "px";
}
/* ---------- in-page links glide (scrollIntoView reaches the host page when embedded) ---------- */
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href"); if (!id || id.length < 2) return;
  const t = document.querySelector(id); if (!t) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(t, { offset: -76, duration: 1.15 });
  else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}));

/* embedded under a host menu bar: links marked data-host-go ask the host to scroll up and swap the frame */
document.querySelectorAll("a[data-host-go]").forEach(a => a.addEventListener("click", e => {
  if (!IS_EMBEDDED || !host.nav) return;
  e.preventDefault(); parent.postMessage({ hook: "go", href: "notify.html" }, "*");
}));
/* ---------- nav: rides along. Standalone it's sticky; embedded it's pinned by hand and only
   appears once the C&K menu bar has scrolled off the top ---------- */
(() => {
  const nav = document.getElementById("nav"); if (!nav) return;
  scrollHandlers.push(() => {
    if (host.ready) {
      /* auto-grow host only: the iframe never scrolls itself, so pin the bar by hand and drop it below the
         WP admin bar (host.adminH is the bar's live coverage — 0 for visitors, so their view is unchanged). */
      if (!nav.classList.contains("embedded")) nav.classList.add("embedded");
      nav.style.transform = `translate3d(0,${vpTop() + host.adminH}px,0)`;
      nav.classList.toggle("pinned", vpTop() > 10);
    } else {
      /* standalone OR a fixed-window iframe (the page scrolls natively): native CSS sticky — smooth,
         no per-scroll transform, so nothing to jitter. */
      if (nav.classList.contains("embedded")) { nav.classList.remove("embedded"); nav.style.transform = ""; }
      nav.classList.toggle("scrolled", vpTop() > 8);
    }
  });
})();
/* ---------- hero entrance: stagger order for the CSS rise ---------- */
document.querySelectorAll(".rise").forEach((el, i) => el.style.setProperty("--i", i));
/* ---------- reveal on approach — position-driven, so it never lags behind the page ---------- */
(() => {
  const els = [...document.querySelectorAll(".reveal")];
  if (reduced) { els.forEach(el => el.classList.add("in")); return; }
  let pending = els;
  scrollHandlers.push(() => {
    if (!pending.length) return;
    const limit = vpH() * 0.93;
    pending = pending.filter(el => { if (relTop(el) < limit) { el.classList.add("in"); return false; } return true; });
  });
})();
/* ---------- reading light: long-form paragraphs sit faint and the ink settles as they
   enter the reading zone (a band ~16–68% down the viewport), tracking the scroll ---------- */
(() => {
  const els = [...document.querySelectorAll(".rl")];
  if (!els.length) return;
  scrollHandlers.push(() => {
    const vh = vpH(), top = vh * 0.16, bot = vh * 0.68, ramp = vh * 0.24;
    for (const el of els) {
      const c = (relTop(el) + relBottom(el)) / 2;
      let o = 1;
      if (c < top) o = 1 - Math.min(1, (top - c) / ramp);
      else if (c > bot) o = 1 - Math.min(1, (c - bot) / ramp);
      el.style.opacity = (0.28 + 0.72 * o).toFixed(3);
    }
  });
})();
/* ---------- theme + nightfall ---------- */
function setTheme(t, persist) {
  doc.setAttribute("data-theme", t);
  if (themeMeta) themeMeta.setAttribute("content", THEME_BG[t]);
  const lab = document.getElementById("nfLabel");
  if (lab) lab.textContent = t === "dark" ? "Turn off dark mode" : "Turn on dark mode";
  if (persist) userTouchedTheme = true;
  if (IS_EMBEDDED) parent.postMessage({ hook: "bg", color: THEME_BG[t] }, "*");   /* the WP page matches */
}
function cinema(t, persist, ms) {
  doc.classList.add("theme-cinema"); setTheme(t, persist);
  setTimeout(() => doc.classList.remove("theme-cinema"), ms);
}
setTheme("light", false);
document.getElementById("themeToggle")?.addEventListener("click", () => {
  cinema(doc.getAttribute("data-theme") === "dark" ? "light" : "dark", true, 1300);
});
/* no nightfall on the synth pages — Clay: the dark dip was Hook's, not the collection's *//* ---------- walkthrough: the phone stays, the steps scroll, the screen follows ---------- */
(() => {
  const walk = document.querySelector(".walk"), phone = document.getElementById("walkPhone");
  const imgs = phone ? [...phone.querySelectorAll("[data-step]")] : [];   /* the page frames AND the highlight frames, matched by data-step */
  imgs.forEach(im => im.decode && im.decode().catch(() => {}));   /* frames decoded before they are asked for */
  const steps = [...document.querySelectorAll(".walk-step")];
  if (!steps.length || !phone) return;
  const desktop = () => matchMedia("(min-width: 900px)").matches;
  /* the phone is native position:sticky by default (smooth); it only becomes JS-pinned under an auto-grow host */
  let cur = -1;
  scrollHandlers.push(() => {
    if (!desktop()) { phone.style.transform = ""; phone.classList.remove("embedded"); return; }   /* phone flows in normal position on mobile */
    const h = vpH(); let idx = 0;
    steps.forEach((s, i) => { if (relTop(s) < h * 0.55) idx = i; });
    if (idx !== cur) {
      cur = idx; const key = String(idx);
      imgs.forEach(im => im.classList.toggle("on", im.dataset.step === key));
      steps.forEach((s, i) => s.classList.toggle("active", i === idx));
    }
    /* auto-grow host only: the frame never scrolls, so pin the phone by hand. In a fixed-window iframe
       (or standalone) the page scrolls natively, so native CSS position:sticky handles it — no jitter. */
    if (host.ready && walk) {
      if (!phone.classList.contains("embedded")) phone.classList.add("embedded");
      const want = NAV_H + h * 0.05 - relTop(walk);
      const y = Math.max(0, Math.min(want, walk.getBoundingClientRect().height - phone.getBoundingClientRect().height));
      phone.style.transform = `translate3d(0,${Math.round(y)}px,0)`;
    } else if (phone.classList.contains("embedded")) {
      phone.classList.remove("embedded"); phone.style.transform = "";
    }
  });
})();

/* ---------- hero: the interface cycles through its pages (like Hook's phone) ----------
   Frames are <img data-cycle="n"> stacked in one grid cell; .on shows one. Add a page: drop the
   screenshot in the folder, run tools/tabs.py, add an <img data-cycle> and its name to TABS. ---------- */
(() => {
  const rig = document.getElementById("rig"); if (!rig) return;
  const imgs = [...rig.querySelectorAll("img[data-cycle]")], tab = document.getElementById("rigTab");
  const TABS = ["Env/Cut", "Reverb/FX", "C-LFO/ModW", "Stepped Seq", "Vib/Misc"];
  if (imgs.length < 2 || reduced) return;
  /* decode every frame up front so the first showing of each never paints late (that read as a glitch) */
  imgs.forEach(im => im.decode && im.decode().catch(() => {}));
  let i = 0;
  const visible = () => relBottom(rig) > 0 && relTop(rig) < vpH();
  setInterval(() => {
    if (!visible()) return;
    i = (i + 1) % imgs.length;
    imgs.forEach(im => im.classList.toggle("on", +im.dataset.cycle === i));
    if (tab) tab.textContent = TABS[i] || "";
  }, 2600);
})();

/* ---------- THE SIGNATURE: the interface in use ----------
   The hand-drawn interface breathes while a sound plays: the crystal glows with the level and a
   cut-off light sweeps the filter. Driven by the player below through window.__rig. ---------- */
(() => {
  const rig = document.getElementById("rig"); if (!rig) return;
  const glow = rig.querySelector(".glow"), cut = rig.querySelector(".cut"), cap = document.getElementById("rigCap");
  let level = 0, smooth = 0, on = false;
  window.__rig = {
    set(l) { level = l; },
    live(v, name) { on = v; rig.classList.toggle("live", v); if (cap) cap.textContent = v ? "now playing · " + name : "tap a sound and it moves"; if (!v) level = 0; }
  };
  const frame = () => {
    smooth += (level - smooth) * 0.25;
    glow.style.opacity = (0.12 + smooth * 0.88).toFixed(3);
    glow.style.transform = `translate(-50%,-50%) scale(${(0.85 + smooth * 0.6).toFixed(3)})`;
    cut.style.left = (61 + smooth * 34).toFixed(2) + "%";
    requestAnimationFrame(frame);
  };
  if (!reduced) requestAnimationFrame(frame);
})();

/* ---------- hear it: one player, streaming, tap to play, one at a time ---------- */
(() => {
  const btns = [...document.querySelectorAll(".snd")]; if (!btns.length) return;
  const hint = document.getElementById("hearHint");
  const audio = new Audio(); audio.preload = "none"; audio.crossOrigin = "anonymous";   /* demosc sends CORS *, so the meter can listen */
  let ctx = null, an = null, data = null, cur = null, raf = 0;
  function meter() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); const s = ctx.createMediaElementSource(audio);
      an = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.82;
      s.connect(an); an.connect(ctx.destination); data = new Uint8Array(an.frequencyBinCount);
    } catch (_) { an = null; }
  }
  function tick() {
    if (!cur) return;
    let level = 0;
    if (an) { an.getByteFrequencyData(data); let sum = 0; for (let i = 2; i < 40; i++) sum += data[i]; level = Math.min(1, sum / 38 / 150); }
    cur.querySelectorAll(".bars i").forEach((b, i) => {
      const v = an ? data[3 + i * 5] / 255 : 0.25 + 0.75 * Math.abs(Math.sin(performance.now() / 260 + i * 0.9));
      b.style.transform = `scaleY(${Math.max(0.12, v).toFixed(2)})`;
    });
    cur.style.setProperty("--p", audio.duration ? (audio.currentTime / audio.duration).toFixed(3) : 0);
    window.__rig && window.__rig.set(level);
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    audio.pause(); cancelAnimationFrame(raf); raf = 0;
    if (cur) { cur.classList.remove("on"); cur.setAttribute("aria-pressed", "false"); cur.style.setProperty("--p", 0); cur.querySelectorAll(".bars i").forEach(b => b.style.transform = ""); }
    cur = null; window.__rig && window.__rig.live(false);
    if (hint) hint.textContent = "Tap a sound. It streams, nothing to download.";
  }
  function play(b) {
    if (cur === b) { stop(); return; }
    stop();
    if (!ctx) meter(); if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    audio.src = b.dataset.src; audio.play().catch(() => {});
    cur = b; b.classList.add("on"); b.setAttribute("aria-pressed", "true");
    window.__rig && window.__rig.live(true, b.querySelector("b").textContent);
    if (hint) hint.textContent = "Playing " + b.querySelector("b").textContent + " · tap again to stop";
    raf = requestAnimationFrame(tick);
  }
  btns.forEach(b => b.addEventListener("click", () => play(b)));
  audio.addEventListener("ended", stop);
  audio.addEventListener("error", () => { if (hint) hint.textContent = "That sound didn't load — try another."; stop(); });
  document.getElementById("hearFirst")?.addEventListener("click", e => {
    e.preventDefault(); play(btns[0]);
    const t = document.getElementById("hear"); if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
})();

/* ---------- see it move: the thumbnail until you ask (YouTube's player weighs ~500 KB) ---------- */
(() => {
  const y = document.getElementById("yt"); if (!y) return;
  y.addEventListener("click", () => {
    y.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${y.dataset.id}?autoplay=1&rel=0" title="Pro-Osc in action" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    y.classList.add("live");
  }, { once: true });
})();

/* ---------- embedded: tell the host how tall we are, whenever that changes ---------- */
if (IS_EMBEDDED) {
  const foot = document.querySelector("footer.foot") || document.querySelector("body > footer");   /* the PAGE footer — blockquotes and cards may have their own <footer> */
  let lastH = 0;
  const postHeight = () => {
    const h = Math.ceil(Math.max(foot ? foot.getBoundingClientRect().bottom + (window.scrollY || 0) : 0, document.body.scrollHeight));
    if (h > 0 && Math.abs(h - lastH) > 4) { lastH = h; parent.postMessage({ hook: "h", h }, "*"); }
  };
  addEventListener("load", postHeight);
  if ("ResizeObserver" in window) new ResizeObserver(postHeight).observe(document.body);
  postHeight(); setTimeout(postHeight, 700); setTimeout(postHeight, 2500);
}

/* first paint: everything that follows the page, computed once */
tick();
