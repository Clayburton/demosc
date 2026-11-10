/* CK Black Friday 2026 on the demosc pages (the five Osc synth pages and the Collection page).
   From Nov 27 00:00 to Dec 1 23:59:59 Pacific the prices shown switch to the sale by themselves
   ($15 each, $49 for all five) and go back after, matching the store. Once Kelsy has approved the
   words (WORDS_OK), the small label above each title reads the Black Friday line. Only text changes,
   so nothing moves on the page. Preview any day: add #bf-preview to the page address.
   Wren, 2026-11-06, on Clay's go. */
(function () {
  var START = Date.UTC(2026, 10, 27, 8, 0, 0);   /* Nov 27 00:00 Pacific */
  var END = Date.UTC(2026, 11, 2, 7, 59, 59);    /* Dec 1 23:59:59 Pacific */
  var WORDS_OK = false;                          /* true once Kelsy has approved the words below */
  var W = { label: 'Black Friday: half off through Tuesday' };   /* no separator dot (Clay's rule set, 2026-11-10) */

  var preview = /(^|[#&])bf-preview\b/.test(location.hash);
  var now = Date.now();
  if (!preview && !(now >= START && END >= now)) { return; }
  var words = WORDS_OK || preview;

  /* swap inside text nodes only, so links, icons and markup stay as they are */
  function swap(el, from, to) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = walk.nextNode())) {
      if (n.nodeValue.indexOf(from) !== -1) { n.nodeValue = n.nodeValue.split(from).join(to); }
    }
  }
  function strike(el, was, sale, cls) {
    if (el.getAttribute('data-ck-bf')) { return; }
    el.innerHTML = '<s class="' + cls + '">' + was + '</s> ' + sale;
    el.setAttribute('data-ck-bf', '1');
  }
  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function run() {
    if (!document.getElementById('ck-bf-css')) {
      var css = document.createElement('style');
      css.id = 'ck-bf-css';
      css.textContent = '.ck-bf-was{font-size:.5em;font-weight:400;opacity:.55;margin-right:.2em;vertical-align:middle}' +
        '.ck-bf-was-s{font-weight:400;opacity:.6;margin-right:.15em}';
      document.head.appendChild(css);
    }

    /* the synth pages: the nav pill, both big prices, and the Collection lines under them */
    document.querySelectorAll('.pill-cta').forEach(function (a) { swap(a, '$29', '$15'); });
    document.querySelectorAll('.price').forEach(function (p) {
      if (text(p) === '$29') { strike(p, '$29', '$15', 'ck-bf-was'); }
    });
    /* the Collection compares with its everyday $99, never $145 (Hermes's final call, made for Clay on Nov 6) */
    document.querySelectorAll('.fine').forEach(function (f) { swap(f, '$99', '$49'); swap(f, 'save $46', 'save $50'); });

    /* the Collection page: both buy buttons, the big price ($99 crossed out, $49), the saving, and the five synth chips */
    document.querySelectorAll('.hero-buy, #bundleCta').forEach(function (a) { swap(a, '$99', '$49'); });
    var acc = document.querySelector('.price .acc');
    if (acc && text(acc) === '$99') {
      acc.textContent = '$49';
      var was = acc.parentNode.querySelector('.was'); if (was && text(was) === '$145') { was.textContent = '$99'; }
    }
    /* "All five synths, save $46 vs. buying separately." becomes "All five synths, save $50." because at
       sale prices the five bought separately are $75, so "vs. buying separately" would not be true */
    document.querySelectorAll('.save').forEach(function (s) { swap(s, 'save $46', 'save $50'); swap(s, ' vs. buying separately.', '.'); });
    document.querySelectorAll('.chip .pr').forEach(function (p) {
      if (text(p) === '$29') { strike(p, '$29', '$15', 'ck-bf-was-s'); }
    });

    /* the words, once approved: the small label above the title (synth pages) and the bundle's kicker */
    if (words) {
      [document.querySelector('.hero .micro'), document.querySelector('#bundle .kick')].forEach(function (el) {
        if (el && !el.getAttribute('data-ck-bf')) { el.textContent = W.label; el.setAttribute('data-ck-bf', '1'); }
      });
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
  window.addEventListener('load', run);
})();
