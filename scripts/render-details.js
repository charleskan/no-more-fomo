#!/usr/bin/env node
// Usage: bun scripts/render-details.js ~/no-more-fomo/2026-07-09-zh-details.md
// One authored markdown holds an explainer section per news item; this emits
// ONE standalone detail page per item: <base>--<slug>.html
// Each page = three-question beginner explanation, with the source ref link(s)
// shown next to the title. Slug = the item's English title in kebab-case.
//
// Authored markdown format (zh digests use the Chinese headings and 信号:):
//   # (ignored page title)
//   ## <Item title> {#english-slug}
//   kicker: Models & Releases   (optional — section label shown above title)
//   ref: [OpenAI announcement](url) · [HN](url)
//   ### What's this about?
//   ...prose / lists / > quotes ...
//   ### What exactly is <term>?
//   ...
//   ### What's the community saying?
//   Signal: HN 636 points, 422 comments
//   1. ...

const fs = require('fs');
const path = require('path');
const { LOCALES, localeFromBase, applyL10n } = require('./l10n.js');

const mdPath = process.argv[2];
if (!mdPath || !/-details\.md$/.test(mdPath)) {
  console.error('Usage: bun scripts/render-details.js <path-to-YYYY-MM-DD[-zh]-details.md>');
  process.exit(1);
}

const scriptDir = path.dirname(__filename);
const repoDir = path.dirname(scriptDir);
const templatePath = path.join(repoDir, 'template', 'detail.html');
const outputDir = path.dirname(path.resolve(mdPath));

const base = path.basename(mdPath).replace(/-details\.md$/, '');   // e.g. 2026-07-09-zh
const lang = localeFromBase(base);
const T = LOCALES[lang];
const digestLink = `./${base}.html`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inlineFmt(text) {
  const links = [];
  const withPlaceholders = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const idx = links.length;
    links.push(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`);
    return `\x00LINK${idx}\x00`;
  });
  let result = esc(withPlaceholders);
  result = result.replace(/\x00LINK(\d+)\x00/g, (_, idx) => links[idx]);
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  return result;
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// --- Split authored markdown into per-item blocks ---
const md = fs.readFileSync(path.resolve(mdPath), 'utf-8');
const lines = md.split('\n');
const items = [];
let cur = null;
for (const raw of lines) {
  const line = raw.replace(/\s+$/, '');
  if (line.startsWith('# ') && !line.startsWith('## ')) continue;   // page title, ignore
  const h = line.match(/^##\s+(.+?)(?:\s*\{#([a-z0-9-]+)\})?\s*$/);
  if (h) {
    if (cur) items.push(cur);
    const title = h[1].trim();
    cur = { title, slug: h[2] || slugify(title), kicker: '', refs: [], body: [] };
    continue;
  }
  if (!cur) continue;
  const kick = line.match(/^kicker:\s*(.+)$/i);
  if (kick) { cur.kicker = kick[1].trim(); continue; }
  const ref = line.match(/^ref:\s*(.+)$/i);
  if (ref) {
    const re = /\[([^\]]+)\]\(([^)]+)\)/g; let m;
    while ((m = re.exec(ref[1])) !== null) cur.refs.push({ label: m[1], url: m[2] });
    continue;
  }
  cur.body.push(line);
}
if (cur) items.push(cur);

// A signal line may be labelled in any locale's language (信号: / Signal: / …)
const SIGNAL_RE = new RegExp(
  '^\\s*(?:' + Object.values(LOCALES).map(l => l.signalLabel).join('|') +
  '|信号|信號)[:：]\\s*(.+)$');   // 簡繁都收（舊 md 保險）

// --- Render one item's body markdown → HTML ---
function renderBody(bodyLines) {
  let html = '';
  let listType = null, inQuote = false;
  const closeList = () => { if (listType) { html += `</${listType}>\n`; listType = null; } };
  const closeQuote = () => { if (inQuote) { html += `</blockquote>\n`; inQuote = false; } };
  for (const line of bodyLines) {
    if (line.startsWith('### ')) { closeList(); closeQuote(); html += `<h2>${inlineFmt(line.slice(4).trim())}</h2>\n`; continue; }
    const sig = line.match(SIGNAL_RE);
    if (sig) { closeList(); closeQuote(); html += `<div class="signal">${inlineFmt(sig[1])}</div>\n`; continue; }
    if (/^>\s?/.test(line)) { closeList(); if (!inQuote) { html += `<blockquote>\n`; inQuote = true; } html += `${inlineFmt(line.replace(/^>\s?/, ''))}<br>\n`; continue; }
    if (inQuote && line.trim() === '') { closeQuote(); continue; }
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) { closeQuote(); if (listType !== 'ol') { closeList(); html += `<ol>\n`; listType = 'ol'; } html += `<li>${inlineFmt(ol[1])}</li>\n`; continue; }
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) { closeQuote(); if (listType !== 'ul') { closeList(); html += `<ul>\n`; listType = 'ul'; } html += `<li>${inlineFmt(ul[1])}</li>\n`; continue; }
    if (line.trim() === '') { closeList(); continue; }
    closeList(); closeQuote(); html += `<p>${inlineFmt(line.trim())}</p>\n`;
  }
  closeList(); closeQuote();
  return html;
}

const template = applyL10n(fs.readFileSync(templatePath, 'utf-8'), lang);

items.forEach((it, i) => {
  const refsHtml = it.refs.map(r =>
    `<a class="ref-link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ↗</a>`
  ).join('');
  const prev = i > 0 ? items[i - 1] : null;
  const next = i < items.length - 1 ? items[i + 1] : null;
  const prevHtml = prev ? `<a href="./${base}--${prev.slug}.html">← ${esc(prev.title)}</a>` : `<span></span>`;
  const nextHtml = next ? `<a href="./${base}--${next.slug}.html">${esc(next.title)} →</a>` : `<span></span>`;

  const html = template
    .replace(/\{\{DETAIL_LANG\}\}/g, lang)
    .replace(/\{\{DETAIL_TITLE\}\}/g, esc(it.title))
    .replace('{{DETAIL_DIGEST_LINK}}', digestLink)
    .replace('{{DETAIL_KICKER}}', esc(it.kicker || T.explainerKicker))
    .replace('{{DETAIL_REFS}}', refsHtml)
    .replace('{{DETAIL_BODY}}', renderBody(it.body))
    .replace('{{DETAIL_PREVNEXT}}', prevHtml + nextHtml);

  const outPath = path.join(outputDir, `${base}--${it.slug}.html`);
  fs.writeFileSync(outPath, html);
});

console.log(`Written ${items.length} detail pages: ${base}--<slug>.html`);
