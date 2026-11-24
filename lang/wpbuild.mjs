// Builds the language copy of one WordPress page from a wp-admin tab (Wren, 2026-11-23).
// Loaded from clayburton.github.io/demosc/lang/ next to engine.mjs and the dictionaries, so a build call is tiny:
//   const W = await import('https://clayburton.github.io/demosc/lang/wpbuild.mjs?v=N');
//   await W.run({ en: 6922, type: 'pages', lang: 'ja', slug: 'plugins', parent: 7489 })
// It reads the English page's saved content, swaps the words, points frames and links at the same language, and
// creates the copy (or updates it, after checking the copy still holds what this builder last wrote). Search title
// and description come from the dictionary's translation of the English page's own title and description.
import { translate, norm } from './engine.mjs';

const BASE = new URL('.', import.meta.url).href;
const SITE = 'https://clayandkelsy.com';
const dicts = {};
async function dict(lang, v) {
  if (!dicts[lang]) dicts[lang] = await fetch(BASE + 'tr-' + lang + '.json?v=' + v, { cache: 'no-store' }).then(r => r.json());
  return dicts[lang];
}
async function nonce() {
  if (!window.__N) window.__N = await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { cache: 'no-store' }).then(r => r.text());
  return window.__N;
}
async function api(path, opts = {}) {
  const n = await nonce();
  const r = await fetch('/wp-json/' + path + (path.includes('?') ? '&' : '?') + 'ckt=' + Date.now(), {
    cache: 'no-store', ...opts, headers: { 'X-WP-Nonce': n, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

// English path -> path in each language (only pages that have that language).
export const PAGES = {
  '/': { ja: '/ja/', zh: '/zh/', es: '/es/' },
  '/plugins/': 'all', '/pro-osc/': 'all', '/moo-osc/': 'all', '/digi-osc/': 'all', '/jx-osc/': 'all', '/chip-osc/': 'all',
  '/dem-osc/': 'all', '/freethings/': 'all', '/aboutus/': 'all', '/contact-us/': 'all', '/install-guide-faq/': 'all',
  '/press/': 'all', '/music/': 'all', '/i-am/': 'all', '/hot-mess/': 'all', '/songwriting/': 'all',
  '/shopcki/': { ja: '/ja/osc-collection/', zh: '/zh/osc-collection/', es: '/es/osc-collection/' },
  '/how-to-write-a-song-for-someone/': 'all', '/gifts-for-songwriters/': 'all', '/best-songwriting-apps/': 'all',
  '/songwriting-iphone-duo/': 'all', '/magdalena-bay-watching-tv-synth-solo/': 'all', '/capture-a-song-idea/': 'all',
  '/medusa-sicilian-flag/': { es: '/es/medusa-sicilian-flag/' }, '/minerva-in-the-odyssey/': { es: '/es/minerva-in-the-odyssey/' },
};
const pathIn = (en, lang) => { const p = PAGES[en]; if (!p) return null; return p === 'all' ? '/' + lang + en : (p[lang] || null); };
const GH = ['demosc/pro-osc/', 'demosc/moo-osc/', 'demosc/digi-osc/', 'demosc/jx-osc/', 'demosc/chip-osc/', 'demosc/dem-osc/',
  'demosc/collection/', 'free-things/', 'cki-about/'];

export function replacements(lang, opts = {}) {
  const out = [];
  for (const en of Object.keys(PAGES)) {
    const tp = pathIn(en, lang); if (!tp) continue;
    for (const end of ['"', "'", '#', '?']) {
      out.push([SITE + en + end, SITE + tp + end]);
      if (en !== '/') { out.push(['"' + en + end, '"' + tp + end]); out.push(["'" + en + end, "'" + tp + end]); }
    }
  }
  if (!opts.noFrames) for (const g of GH) for (const end of ['"', "'"]) out.push(['https://clayburton.github.io/' + g + end, 'https://clayburton.github.io/' + g + lang + '.html' + end]);
  // Dates a page script writes (the journal rail) come out in the page's language (Japanese audit, 2026-11-23).
  out.push(["toLocaleDateString('en-US'", "toLocaleDateString('" + { ja: 'ja-JP', zh: 'zh-CN', es: 'es-MX' }[lang] + "'"]);
  if (lang === 'ja') out.push(['https://apps.apple.com/app/', 'https://apps.apple.com/jp/app/']);
  if (lang === 'zh') out.push(['https://apps.apple.com/app/', 'https://apps.apple.com/cn/app/']);
  return out;
}

const MARK = (lang, en) => '<!-- ck-lang ' + lang + ' from ' + en + ' -->';

/* cfg: {en, type:'pages'|'posts', lang, slug, parent, template?, v, dry, head:{title, description} (English, from the
   page's head), extraReplace:[[a,b]], noFrames} */
export async function run(cfg) {
  const d = await dict(cfg.lang, cfg.v || 1);
  const src = await api('wp/v2/' + (cfg.type || 'pages') + '/' + cfg.en + '?context=edit');
  if (src.status !== 200) return { error: 'read ' + src.status };
  let raw = src.j.content.raw; const preMissing = [];
  for (const [a, b] of (cfg.pre || {})[cfg.lang] || []) { if (!raw.includes(a)) preMissing.push(a.slice(0, 60)); raw = raw.split(a).join(b); }
  const tpl = cfg.template || src.j.template || 'template-page-builder-no-sidebar.php';
  const reps = replacements(cfg.lang, cfg).concat(cfg.extraReplace || []);
  const r = translate(raw, d, { replace: reps });
  const cjk = cfg.lang === 'ja' || cfg.lang === 'zh' ? '<!-- wp:html --><style id="ck-cjk-lines">.ck-ph{white-space:nowrap;display:inline-block}html[lang] #ck-plugins .ckp-h1{white-space:nowrap;font-size:clamp(44px,7.4vw,104px)}html[lang] .livingIntro .h{font-size:clamp(34px,9vw,52px);line-height:1.25;max-width:none}</style><!-- /wp:html -->\n' : '';
  const content = MARK(cfg.lang, cfg.en) + '\n' + cjk + r.out;
  const t = cfg.head || {};
  const title = t.title ? (d[norm(t.title)] || t.title) : (d[norm(src.j.title.raw)] || src.j.title.raw);
  const desc = t.description ? (d[norm(t.description)] || null) : null;
  const pageTitle = title.replace(/\s*[|｜]\s*Clay and Kelsy\s*$/, '');
  const result = { lang: cfg.lang, en: cfg.en, slug: cfg.slug, preMissing, applied: r.applied, missing: r.missing.length, bad: r.bad.length, missingKeys: r.missing.slice(0, 8).map(k => k.slice(0, 70)), badKeys: r.bad.slice(0, 5).map(k => k.slice(0, 70)) };
  if (cfg.dry) return result;
  // Find an existing copy at this slug under this parent.
  const found = await api('wp/v2/pages?slug=' + encodeURIComponent(cfg.slug) + '&parent=' + cfg.parent + '&status=publish,draft,private&context=edit');
  const ex = (found.j || [])[0];
  if (ex && !ex.content.raw.startsWith(MARK(cfg.lang, cfg.en)) && !cfg.adopt) return { ...result, error: 'a page already sits at this address and was not made by this builder: ' + ex.id };
  const body = { title: pageTitle, slug: cfg.slug, parent: cfg.parent, status: 'publish', template: tpl, content };
  const w = ex ? await api('wp/v2/pages/' + ex.id, { method: 'POST', body: JSON.stringify(body) })
               : await api('wp/v2/pages', { method: 'POST', body: JSON.stringify(body) });
  if (w.status !== 200 && w.status !== 201) return { ...result, error: 'write ' + w.status + ' ' + (w.j.message || '') };
  const id = w.j.id;
  const back = await api('wp/v2/pages/' + id + '?context=edit');
  result.id = id; result.link = back.j.link; result.exact = back.j.content.raw === content; result.template = back.j.template;
  // Search title and description (AIOSEO): set only what we have a translation for.
  if (cfg.seo !== false) {
    const a = await api('aioseo/v1/post', { method: 'POST', body: JSON.stringify({ id, title, description: desc || '#post_content' }) });
    result.seo = a.status;
  }
  return result;
}

/* Build every page of the manifest for one language, one after another (results gather in window.__R).
   parents: {ja: 7489, zh: 7474, es: <id>}. only: optional list of English ids. */
export async function runAll(lang, parents, only, v, adopt) {
  const m = await fetch(BASE + 'pages.json?v=' + v, { cache: 'no-store' }).then(r => r.json());
  window.__R = window.__R || {}; const out = window.__R[lang] = [];
  for (const e of m) {
    if (!e.langs.includes(lang) || (only && !only.includes(e.en))) continue;
    try {
      out.push(await run({ en: e.en, type: e.type, lang, slug: (e.slugs && e.slugs[lang]) || e.slug, parent: e.parent0 ? 0 : parents[lang],
        template: e.template, head: e.head, pre: e.pre, extraReplace: (e.extra || {})[lang] || [], adopt: !!adopt, v }));
    } catch (err) { out.push({ en: e.en, error: String(err).slice(0, 120) }); }
  }
  out.push({ done: true });
  return out;
}
