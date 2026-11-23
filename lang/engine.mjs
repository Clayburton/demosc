// Language copies of our pages: the shared engine (Wren, 2026-11-23).
// Clay: every page in Chinese, Japanese and Spanish, each "a direct copy" of the English page with only the words
// swapped. This finds every piece of words in a page (text, the alt/title/aria words, words inside scripts, block
// labels), gives each a key, and puts a translation back in the same place. Tags inside a sentence travel as numbered
// placeholders (<1>...</1>, <2/>), so a translation can move them and every link, class and address stays exactly as
// it was. A translation whose placeholders do not match is skipped and reported, never half-applied.
// Runs in Node (tr.mjs) for our GitHub pages and in a wp-admin tab for WordPress pages. No dependencies.

const VOID = new Set('area base br col embed hr img input link meta source track wbr param keygen'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const SKIP = new Set(['svg', 'math', 'iframe', 'video', 'audio', 'canvas', 'object', 'code', 'pre']);
const INLINE = new Set('a abbr b bdi bdo br cite data del dfn em i ins kbd mark q s samp small span strong sub sup time u var wbr img font'.split(' '));
const ATTRS = new Set(['alt', 'title', 'placeholder', 'aria-label', 'aria-description', 'label']);
const META = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt', 'twitter:image:alt']);
// Words that look like prose but are code: key names, schema types, headers. Never offered for translation.
const CODEWORDS = /^(Escape|Enter|Tab|Backspace|Delete|Space|Shift|Control|Alt|Meta|Home|End|PageUp|PageDown|Arrow(Up|Down|Left|Right)|Content-Type|Accept|Authorization|Cache-Control|Object|Array|String|Number|Boolean|Date|Math|JSON|Promise|Error|Event|CustomEvent|Image|Audio|Infinity|NaN|Product|Offer|AggregateOffer|Organization|Person|Thing|WebPage|WebSite|BreadcrumbList|ListItem|AggregateRating|Rating|Review|Brand|SoftwareApplication|MusicGroup|MusicAlbum|MusicRecording|ImageObject|VideoObject|FAQPage|Question|Answer|Article|BlogPosting|CollectionPage|ItemList|InStock|OutOfStock|PreOrder|USD|Mac|Windows|MacOS|macOS|iOS)$/;
const BLOCK_KEYS = 'label|placeholder|text|requiredText|buttonText|submitButtonText';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: '-', ndash: '-', hellip: '...', middot: '·', times: '×', copy: '©', reg: '®', trade: '™', darr: '↓', uarr: '↑', rarr: '→', larr: '←', bull: '•', deg: '°', eacute: 'é' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return String.fromCodePoint(c); }
  return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
});
// The key every source and every copy agrees on: entities decoded, curly quotes straight, dashes plain, spaces collapsed.
export function norm(s) {
  return decode(s).replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...').replace(/[\u00A0\u2009\u202F]/g, ' ').replace(/\s+/g, ' ').trim();
}
const letters = s => /[A-Za-z\u00C0-\u024F]/.test(s);

export function parse(html) {
  const root = { tag: '#root', start: 0, cs: 0, ce: html.length, end: html.length, children: [], parent: null, attrStr: '' };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![a-zA-Z][^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) { cur.children.push({ tag: '#comment', start: m.index, end: re.lastIndex, cs: m.index + 4, ce: re.lastIndex - 3, children: [] }); continue; }
    if (m[0][1] === '!') { cur.children.push({ tag: '#comment', start: m.index, end: re.lastIndex, cs: m.index, ce: m.index, children: [] }); continue; }
    if (m[1]) {
      const t = m[1].toLowerCase();
      let e = cur; while (e !== root && e.tag !== t) e = e.parent;
      if (e === root) continue;
      let x = cur; while (x !== e) { x.ce = m.index; x.end = m.index; x = x.parent; }
      e.ce = m.index; e.end = re.lastIndex; cur = e.parent; continue;
    }
    const t = m[2].toLowerCase(), attrStr = m[3] || '';
    const el = { tag: t, start: m.index, cs: re.lastIndex, ce: null, end: null, children: [], parent: cur, attrStr, attrAt: m.index + 1 + m[2].length };
    cur.children.push(el);
    if (VOID.has(t) || /\/\s*$/.test(attrStr)) { el.ce = el.cs; el.end = el.cs; continue; }
    if (RAW.has(t)) {
      const close = new RegExp('</' + t + '\\s*>', 'ig'); close.lastIndex = re.lastIndex;
      const c = close.exec(html);
      el.ce = c ? c.index : html.length; el.end = c ? close.lastIndex : html.length; re.lastIndex = el.end; continue;
    }
    cur = el;
  }
  let x = cur; while (x !== root) { x.ce = html.length; x.end = html.length; x = x.parent; }
  return root;
}

function attrs(el) {
  const out = []; const re = /([^\s=\/>"']+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>"']+)))?/g; let m;
  while ((m = re.exec(el.attrStr))) {
    if (m[2] === undefined) { out.push({ name: m[1].toLowerCase(), value: null }); continue; }
    const q = m[3] !== undefined ? 1 : m[4] !== undefined ? 1 : 0;
    const v = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
    const vs = el.attrAt + m.index + m[0].indexOf(m[2]) + q;
    out.push({ name: m[1].toLowerCase(), value: v, vs, ve: vs + v.length, quote: m[3] !== undefined ? '"' : m[4] !== undefined ? "'" : '' });
  }
  return out;
}
const attr = (el, n) => { const a = attrs(el).find(a => a.name === n); return a ? a.value : null; };

function inlineOnly(el) {
  for (const c of el.children) {
    if (c.tag === '#comment') continue;
    if (!INLINE.has(c.tag) || !inlineOnly(c)) return false;
  }
  return true;
}

// Inline markup -> numbered placeholders, and back.
function toPlaceholders(html, frag) {
  // frag: [start,end) inside html, parsed children known. Re-tokenise the fragment itself.
  const s = html.slice(frag[0], frag[1]); const tags = []; let n = 0; const stack = [];
  const text = s.replace(/<\/?([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (t, name, rest) => {
    const lower = name.toLowerCase();
    if (t[1] === '/') { const open = stack.pop(); return open ? '</' + open + '>' : ''; }
    n++; tags.push(t);
    if (VOID.has(lower) || /\/\s*$/.test(rest)) return '<' + n + '/>';
    stack.push(n); return '<' + n + '>';
  });
  return { text, tags };
}
function fromPlaceholders(tr, tags) {
  const used = new Set(); let ok = true; const closers = {};
  // closing tag names come from the opening tag at that number
  const out = tr.replace(/<(\/?)(\d+)(\/?)>/g, (m, close, num, self) => {
    const i = +num - 1; const t = tags[i];
    if (!t) { ok = false; return ''; }
    if (close) { const nm = (t.match(/^<([a-zA-Z][\w:-]*)/) || [])[1]; return '</' + nm + '>'; }
    used.add(i); return t;
  });
  if (used.size !== tags.length) ok = false;
  return ok ? out : null;
}

function prose(v) {
  v = (v || '').replace(/\{\d+\}/g, 'x');
  if (!v || !letters(v)) return false;
  if (/:\/\/|^[\/.#\[@]|^[\w-]+\s*:\s*[^\s]+;?$|=>|[{};]|^\$|^[a-z][\w-]*$|\.(png|jpe?g|webp|svg|mp[34]|js|css|json|woff2?)$/i.test(v)) return false;
  return /\s/.test(v.trim()) || /^[A-Z][a-z]{2,}/.test(v) || /[^\x00-\x7F]/.test(v);
}

// Every string literal in a script: [{s, e, quote, raw}] (s/e = the inside of the quotes).
function literals(js, base) {
  const out = []; let i = 0, prev = '';
  while (i < js.length) {
    const c = js[i];
    if (c === '/' && js[i + 1] === '/') { const e = js.indexOf('\n', i); i = e < 0 ? js.length : e; continue; }
    if (c === '/' && js[i + 1] === '*') { const e = js.indexOf('*/', i + 2); i = e < 0 ? js.length : e + 2; continue; }
    if (c === '/' && /[(,=:\[!&|?{};+\-*%<>~^]|^$/.test(prev)) {
      let j = i + 1, cls = false;
      while (j < js.length && js[j] !== '\n') { if (js[j] === '\\') { j += 2; continue; } if (js[j] === '[') cls = true; else if (js[j] === ']') cls = false; else if (js[j] === '/' && !cls) break; j++; }
      i = j + 1; prev = '/'; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < js.length && js[j] !== c) { if (js[j] === '\\') j++; else if (c !== '`' && js[j] === '\n') break; j++; }
      out.push({ s: base + i + 1, e: base + j, quote: c, raw: js.slice(i + 1, j) });
      i = j + 1; prev = 'x'; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}
const unescJs = (s, q) => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
const escJs = (s, q) => s.replace(/\\/g, '\\\\').replace(new RegExp(q === '`' ? '`' : q, 'g'), '\\' + q).replace(/\n/g, '\\n');
const escAttr = (s, q) => s.replace(/&/g, '&amp;').replace(q === "'" ? /'/g : /"/g, q === "'" ? '&#39;' : '&quot;').replace(/</g, '&lt;');

// Template-literal ${...} parts travel as {1}, {2}.
function jsToKey(raw, q) {
  const subs = [];
  let s = q === '`' ? raw.replace(/\$\{[^}]*\}/g, m => { subs.push(m); return '{' + subs.length + '}'; }) : raw;
  return { s: unescJs(s, q), subs };
}

/* units(html, opts) -> [{kind, key, s, e, ...}] in document order.
   opts.region: a class name; only words inside the first element with that class (e.g. 'entry-content'). */
export function units(html, opts = {}) {
  const root = parse(html); const out = [];
  let top = root;
  if (opts.region) {
    const find = el => { for (const c of el.children) { if (c.tag[0] === '#') continue; const hit = opts.region[0] === '#' ? attr(c, 'id') === opts.region.slice(1) : (attr(c, 'class') || '').split(/\s+/).includes(opts.region); if (hit) return c; const f = find(c); if (f) return f; } return null; };
    const body = el => { for (const c of el.children) { if (c.tag === 'body') return c; if (c.tag[0] !== '#') { const f = body(c); if (f) return f; } } return null; };
    top = find(root) || body(root) || root;
  }
  const addText = (s, e) => {
    const t = html.slice(s, e); if (!letters(norm(t))) return;
    const lead = t.length - t.trimStart().length, trail = t.length - t.trimEnd().length;
    out.push({ kind: 'text', key: norm(t), s: s + lead, e: e - trail });
  };
  const doAttrs = el => {
    const as = attrs(el);
    if (el.tag === 'meta') {
      const nm = (as.find(a => a.name === 'name' || a.name === 'property') || {}).value;
      const ct = as.find(a => a.name === 'content');
      if (nm && META.has(nm.toLowerCase()) && ct && ct.value && letters(ct.value)) out.push({ kind: 'attr', key: norm(ct.value), s: ct.vs, e: ct.ve, quote: ct.quote });
      return;
    }
    for (const a of as) {
      if (!a.value || a.vs === undefined) continue;
      const isData = a.name.startsWith('data-') && prose(decode(a.value)) && /\s/.test(a.value);
      if ((ATTRS.has(a.name) || isData) && letters(a.value)) out.push({ kind: 'attr', key: norm(a.value), s: a.vs, e: a.ve, quote: a.quote });
      if (a.name === 'value' && el.tag === 'input' && /^(submit|button)$/i.test(attr(el, 'type') || '') && letters(a.value)) out.push({ kind: 'attr', key: norm(a.value), s: a.vs, e: a.ve, quote: a.quote });
    }
  };
  const allAttrs = el => { for (const c of el.children) { if (c.tag[0] === '#') continue; doAttrs(c); if (!RAW.has(c.tag) && !SKIP.has(c.tag)) allAttrs(c); } };
  const walk = el => {
    let cursor = el.cs;
    for (const c of el.children) {
      if (c.start > cursor) addText(cursor, c.start);
      cursor = c.end;
      if (c.tag === '#comment') {
        const body = html.slice(c.cs, c.ce);
        if (/^\s*wp:/.test(body)) {
          const re = new RegExp('"(' + BLOCK_KEYS + ')":"((?:[^"\\\\]|\\\\.)*)"', 'g'); let m;
          while ((m = re.exec(body))) {
            let v; try { v = JSON.parse('"' + m[2] + '"'); } catch (e) { continue; }
            if (letters(v)) { const s = c.cs + m.index + m[0].indexOf(':"') + 2; out.push({ kind: 'block', key: norm(v), s, e: s + m[2].length }); }
          }
        }
        continue;
      }
      if (c.tag === 'script') {
        const type = (attr(c, 'type') || '').toLowerCase();
        if (type && !/javascript|module|ld\+json/.test(type)) continue;
        const ld = /ld\+json/.test(type);
        for (const L of literals(html.slice(c.cs, c.ce), c.cs)) {
          const { s } = jsToKey(L.raw, L.quote);
          if (!prose(s) || CODEWORDS.test(s)) continue;
          if (ld && !/"(description|headline|text|caption|alternativeHeadline|name|answer)"\s*:\s*$/.test(html.slice(Math.max(0, L.s - 40), L.s - 1))) continue;
          if (/<[a-z]/i.test(s)) { const ph = toPlaceholders(s, [0, s.length]); out.push({ kind: 'js', key: norm(ph.text), s: L.s, e: L.e, quote: L.quote, html: true }); }
          else out.push({ kind: 'js', key: norm(s), s: L.s, e: L.e, quote: L.quote });
        }
        continue;
      }
      if (c.tag === 'title') { if (letters(html.slice(c.cs, c.ce))) out.push({ kind: 'text', key: norm(html.slice(c.cs, c.ce)), s: c.cs, e: c.ce }); continue; }
      if (c.tag === 'style' || c.tag === 'textarea') continue;
      doAttrs(c);
      if (SKIP.has(c.tag) || VOID.has(c.tag)) continue;
      if (inlineOnly(c) && letters(norm(html.slice(c.cs, c.ce).replace(/<[^>]+>/g, ' ')))) {
        if (c.children.some(k => k.tag !== '#comment')) {
          const ph = toPlaceholders(html, [c.cs, c.ce]);
          out.push({ kind: 'html', key: norm(ph.text), s: c.cs, e: c.ce });
        } else addText(c.cs, c.ce);
        allAttrs(c);
        continue;
      }
      walk(c);
    }
    if (el.ce > cursor && el !== root) addText(cursor, el.ce);
    else if (el === root && html.length > cursor) addText(cursor, html.length);
  };
  if (top !== root) doAttrs(top);
  walk(top);
  return out.filter(u => u.key && letters(u.key));
}

/* translate(html, dict, opts) -> {out, applied, missing:[keys], bad:[keys]}
   dict: {key: translation}. opts.lang sets <html lang>; opts.region as in units(); opts.replace: [[from, to], ...]
   plain replacements done last (links, frame addresses, App Store country). */
export function translate(html, dict, opts = {}) {
  const us = units(html, opts); const edits = []; const missing = []; const bad = [];
  const spans = us.filter(u => u.kind === 'html').map(u => [u.s, u.e]);
  const inside = u => u.kind === 'attr' && spans.some(([s, e]) => u.s >= s && u.e <= e);
  for (const u of us) {
    if (inside(u)) continue;
    const tr = dict[u.key];
    if (tr === undefined || tr === null) { missing.push(u.key); continue; }
    if (tr === u.key) continue;
    let rep;
    if (u.kind === 'html') {
      const ph = toPlaceholders(html, [u.s, u.e]);
      const tags = ph.tags.map(t => t.replace(/(\s)([\w:-]+)=("([^"]*)"|'([^']*)')/g, (m, sp, name, q, v1, v2) => {
        const v = v1 !== undefined ? v1 : v2, n = name.toLowerCase();
        if (!(ATTRS.has(n) || (n.startsWith('data-') && /\s/.test(v) && prose(decode(v))))) return m;
        const tv = dict[norm(v)]; if (typeof tv !== 'string' || tv === norm(v)) return m;
        const qc = v1 !== undefined ? '"' : "'"; return sp + name + '=' + qc + escAttr(tv, qc) + qc;
      }));
      rep = fromPlaceholders(tr, tags);
      if (rep === null) { bad.push(u.key); continue; }
    } else if (u.kind === 'text') rep = tr.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/<(?!\/span>|span class="ck-ph">)/g, '&lt;');
    else if (u.kind === 'attr') rep = escAttr(tr, u.quote || '"');
    else if (u.kind === 'block') rep = JSON.stringify(tr).slice(1, -1).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/--/g, '\\u002d\\u002d');
    else if (u.kind === 'js') {
      const raw = html.slice(u.s, u.e); const k = jsToKey(raw, u.quote);
      let t = tr;
      if (u.html) { const ph = toPlaceholders(k.s, [0, k.s.length]); t = fromPlaceholders(tr, ph.tags); if (t === null) { bad.push(u.key); continue; } }
      if (k.subs.length) { let okSubs = true; t = t.replace(/\{(\d+)\}/g, (m, n) => k.subs[+n - 1] || (okSubs = false, '')); if (!okSubs) { bad.push(u.key); continue; } }
      const lead = k.s.match(/^\s*/)[0], trail = k.s.match(/\s*$/)[0];
      rep = escJs(lead + t.trim() + trail, u.quote);
    }
    edits.push([u.s, u.e, rep]);
  }
  edits.sort((a, b) => b[0] - a[0]);
  let out = html, last = Infinity;
  for (const [s, e, r] of edits) { if (e > last) continue; out = out.slice(0, s) + r + out.slice(e); last = s; }
  if (opts.lang) out = out.replace(/<html([^>]*)\slang="[^"]*"/i, '<html$1 lang="' + opts.lang + '"');
  for (const [a, b] of opts.replace || []) out = out.split(a).join(b);
  return { out, applied: edits.length, missing: [...new Set(missing)], bad: [...new Set(bad)] };
}
