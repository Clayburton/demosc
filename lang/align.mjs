// Lines a translated page up against its English original and writes {English key: translation} (Wren, 2026-11-23).
// Used once to bring pages made before the shared engine into the word lists, without translating anything again.
//   node align.mjs <out.json> <english.html>[@region] <translated.html>[@region]
import fs from 'node:fs';
import { units } from './engine.mjs';
const [out, enSpec, trSpec] = process.argv.slice(2);
const load = spec => { const [f, region] = spec.split('@'); return { html: fs.readFileSync(f, 'utf8'), region }; };
const E = load(enSpec), T = load(trSpec);
const eu = units(E.html, E.region ? { region: E.region } : {});
const tu = units(T.html, T.region ? { region: T.region, anyScript: true } : { anyScript: true });
const tags = s => (s.match(/<\/?\d+\/?>/g) || []).map(t => t.replace(/\d+/, 'n')).join('');
const sig = u => u.kind + ':' + tags(u.key);
// Longest-common-subsequence alignment on the shape of each piece (kind + its tag skeleton).
const n = eu.length, m = tu.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
  L[i][j] = sig(eu[i]) === sig(tu[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
const pairs = []; let i = 0, j = 0; const loneE = [], loneT = [];
while (i < n && j < m) {
  if (sig(eu[i]) === sig(tu[j])) { pairs.push([eu[i], tu[j]]); i++; j++; }
  else if (L[i + 1][j] >= L[i][j + 1]) loneE.push(eu[i++]); else loneT.push(tu[j++]);
}
while (i < n) loneE.push(eu[i++]); while (j < m) loneT.push(tu[j++]);
// Placeholder numbers follow each page's own tag order; renumber the translation's so each tag keeps its English twin.
function openTags(html, u) { return [...html.slice(u.s, u.e).matchAll(/<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)].map(m => m[0]); }
const home = u => u.replace(/clayandkelsy\.com\/(ja|zh|es)\//, 'clayandkelsy.com/').replace('/osc-collection/', '/shopcki/')
  .replace(/apps\.apple\.com\/(jp|cn)\//, 'apps.apple.com/').replace(/\/(ja|zh|es)\.html/, '/');
const ident = t => { const nm = (t.match(/^<([a-zA-Z][\w:-]*)/) || [])[1]; const at = n => ((t.match(new RegExp('\\s' + n + '="([^"]*)"')) || [])[1] || ''); return nm + '|' + home(at('href')) + '|' + home(at('src')) + '|' + at('class') + '|' + at('id'); };
const tname = t => (t.match(/^<([a-zA-Z][\w:-]*)/) || [])[1];
function remap(key, en, tr) {
  if (en.length !== tr.length) return null;
  const used = new Set(), map = {};
  for (let k = 0; k < tr.length; k++) {
    let j = en.findIndex((x, i) => !used.has(i) && x === tr[k]);
    if (j < 0) j = en.findIndex((x, i) => !used.has(i) && ident(x) === ident(tr[k]));
    if (j < 0) j = en.findIndex((x, i) => !used.has(i) && tname(x) === tname(tr[k]));
    if (j < 0) return null;
    used.add(j); map[k + 1] = j + 1;
  }
  return key.replace(/<(\/?)(\d+)(\/?)>/g, (m, a, num, b) => '<' + a + map[num] + b + '>');
}
// A plain-text English piece that became a heading split into ck-ph phrases pairs with the lone piece in its place.
const dict = {}; let conflicts = 0, remapFail = 0;
for (const [e, t] of pairs) {
  let tr = t.key;
  if (e.kind === 'text' || e.kind === 'html') tr = T.html.slice(t.s, t.e).trim();
  if (e.kind === 'html') tr = remap(t.key, openTags(E.html, e), openTags(T.html, t));
  if (tr === null) { remapFail++; continue; }
  if (dict[e.key] !== undefined && dict[e.key] !== tr) conflicts++;
  if (dict[e.key] === undefined) dict[e.key] = tr;
}
for (const e of loneE) {
  const k = loneT.findIndex(t => t.kind === 'html' && /^(<\d+>[^<]*<\/\d+>)+$/.test(t.key) && T.html.slice(t.s, t.e).includes('ck-ph'));
  if (e.kind === 'text' && k > -1) { dict[e.key] = T.html.slice(loneT[k].s, loneT[k].e).trim(); loneT.splice(k, 1); e.done = true; }
}
const left = loneE.filter(e => !e.done && dict[e.key] === undefined);
fs.writeFileSync(out, JSON.stringify(dict, null, 0));
console.log(out, 'english', n, 'translated', m, 'paired', pairs.length, 'conflicts', conflicts, 'tag mismatches', remapFail, 'english left without a match', left.length);
for (const e of left.slice(0, 12)) console.log('   left:', e.kind, e.key.slice(0, 80));
