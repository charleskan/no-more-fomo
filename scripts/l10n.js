// UI strings for every language a digest can be rendered in.
//
// To add a language: add an entry here, add its section names in
// scripts/render.js SECTIONS, and generate YYYY-MM-DD<suffix>.md digests for
// it (e.g. suffix '-ja' → 2026-03-22-ja.md). English is the fallback for any
// missing key. The digest CONTENT language is per-file (filename suffix);
// these strings are the surrounding chrome.
'use strict';

const LOCALES = {
  en: {
    suffix: '',                 // 2026-03-22.md → 2026-03-22.html
    label: 'EN',                // shown in the language-switcher button
    highlightsTitle: "Today's Highlights",
    noItems: 'No items',
    explainerChip: 'Explainer →',
    explainerKicker: 'Explainer',
    signalLabel: 'Signal',
    backToDigest: '← Back to digest',
    archive: '← Archive',
    viewNewspaper: 'Newspaper',
    viewSidebar: 'Sidebar',
    viewGrid: 'Grid',
  },
  zh: {
    suffix: '-zh',
    label: '中',
    highlightsTitle: '今日要点',
    noItems: '暂无内容',
    explainerChip: '白话详解 →',
    explainerKicker: '白话详解',
    signalLabel: '信号',
    backToDigest: '← 返回摘要',
    archive: '← 归档',
    viewNewspaper: '报纸',
    viewSidebar: '侧栏',
    viewGrid: '网格',
  },
};

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Locale code of a digest/details basename, by filename suffix
// ('2026-03-22-zh' → 'zh', '2026-03-22' → 'en').
function localeFromBase(base) {
  for (const [code, l] of Object.entries(LOCALES)) {
    if (l.suffix && base.endsWith(l.suffix)) return code;
  }
  return 'en';
}

// data-<code>="…" attributes for the in-page chrome language toggle.
function swapAttrs(key) {
  return Object.entries(LOCALES)
    .map(([code, l]) => `data-${code}="${escAttr(l[key] != null ? l[key] : LOCALES.en[key])}"`)
    .join(' ');
}

// Resolve the template's l10n placeholders for one page language:
//   {{L10N:key}}        → the string in `lang` (en fallback)
//   {{L10N_ATTRS:key}}  → data-<code> swap attributes for all locales
//   {{L10N_LOCALES}}    → JSON [{code, suffix}] for the client-side toggle
//   {{L10N_LANG_TOGGLE}} → the switcher label, e.g. "EN/中"
function applyL10n(html, lang) {
  const T = LOCALES[lang] || LOCALES.en;
  return html
    .replace(/\{\{L10N_ATTRS:(\w+)\}\}/g, (_, k) => swapAttrs(k))
    .replace(/\{\{L10N:(\w+)\}\}/g, (_, k) => escAttr(T[k] != null ? T[k] : LOCALES.en[k]))
    .replace(/\{\{L10N_LOCALES\}\}/g, JSON.stringify(
      Object.entries(LOCALES).map(([code, l]) => ({ code, suffix: l.suffix }))))
    .replace(/\{\{L10N_LANG_TOGGLE\}\}/g, Object.values(LOCALES).map(l => l.label).join('/'));
}

module.exports = { LOCALES, localeFromBase, swapAttrs, applyL10n };
