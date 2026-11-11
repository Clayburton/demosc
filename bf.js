/* CK Black Friday 2026 on the demosc pages (the five Osc synth pages and the Collection page).
   From Nov 27 00:00 to Dec 1 23:59:59 Pacific the prices shown switch to the sale by themselves
   ($15 each, $49 for all five) and go back after, matching the store. Once Kelsy has approved the
   words (WORDS_OK), the small label above each synth page's title reads the Black Friday line, and on the
   Collection page the line sits under the bundle's price with "That's $9.80 a synth." under the saving
   (Nov 11: the bundle's own small label went with Clay's clean-up). Kelsy approved the words Nov 11. Preview any day: add #bf-preview to the page address.
   Wren, 2026-11-06, on Clay's go. */
(function () {
  var START = Date.UTC(2026, 10, 27, 8, 0, 0);   /* Nov 27 00:00 Pacific */
  var END = Date.UTC(2026, 11, 2, 7, 59, 59);    /* Dec 1 23:59:59 Pacific */
  var WORDS_OK = true;                           /* Kelsy approved the words, Nov 11 (Margot h-20261111-6e13) */
  var W = { label: 'Black Friday: half off through Tuesday', per: "That's $9.80 a synth." };   /* no separator dot (Clay's rule set, 2026-11-10) */

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
        '.ck-bf-was-s{font-weight:400;opacity:.6;margin-right:.15em}' +
        '.ck-bf-line{font-family:var(--mono);font-weight:700;font-size:14px;color:var(--purple);margin:4px 0 8px}' +
        '.ck-bf-per{font-family:var(--mono);font-size:13px;color:var(--ink-soft);margin-top:4px}' +
        '.hero .micro.ck-bf-micro{text-transform:none!important;letter-spacing:0!important}';   /* a sentence, not spaced capitals (Kelsy: lovely, not dramatic) */
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

    /* the words, once approved: the small label above a synth page's title, and on the Collection page the
       sale line under the bundle's price and the per-synth price under the saving */
    if (words) {
      var micro = document.querySelector('.hero .micro');
      if (micro && !micro.getAttribute('data-ck-bf')) { micro.textContent = W.label; micro.classList.add('ck-bf-micro'); micro.setAttribute('data-ck-bf', '1'); }
      var bp = document.querySelector('#bundle .price'), bs = document.querySelector('#bundle .save');
      if (bp && !document.querySelector('#bundle .ck-bf-line')) {
        var ln = document.createElement('div'); ln.className = 'ck-bf-line'; ln.textContent = W.label;
        bp.insertAdjacentElement('afterend', ln);
      }
      if (bs && !document.querySelector('#bundle .ck-bf-per')) {
        var pr = document.createElement('div'); pr.className = 'ck-bf-per'; pr.textContent = W.per;
        bs.insertAdjacentElement('afterend', pr);
      }
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
  window.addEventListener('load', run);
})();
