#!/usr/bin/env node
// Usage: node scripts/build-homepage-data.js [digest-folder]
// 從最近 7 日嘅 digest markdown 抽 highlights + podcasts，
// 寫成 <folder>/data/homepage.json 俾 homepage（site/index.html）fetch。
// 純解析、零 LLM；deploy-s3.sh 會喺 sync 之前自動跑一次。

const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || path.join(process.env.HOME, 'no-more-fomo');
const MAX_DAYS = 7;
const MAX_ITEMS = 5;

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// --- 揀最近 7 個有 digest 嘅日期（優先 zh 版）---
const dates = [...new Set(
  fs.readdirSync(SRC)
    .map(f => (f.match(/^(\d{4}-\d{2}-\d{2})(-zh)?\.md$/) || [])[1])
    .filter(Boolean)
)].sort().reverse().slice(0, MAX_DAYS);

// --- 逐行解析 ---
function sectionLines(md, headings) {
  const lines = md.split('\n');
  const out = [];
  let on = false;
  for (const line of lines) {
    if (/^## /.test(line)) { on = headings.some(h => line.startsWith('## ' + h)); continue; }
    if (on && /^- \*\*/.test(line)) out.push(line);
  }
  return out;
}

function parseSignal(line) {
  // 「14.5k + 1.2k 赞」/ "14.5k likes" → 「14.5K ♥」；HN 分數 → 「HN 259」；HF ↑
  let m = line.match(/([\d.]+k?)(?:\s*[+＋]\s*[\d.]+k?)*\s*(?:赞|讚|likes?)/i);
  if (m) return m[1].toUpperCase() + ' ♥';
  m = line.match(/HN\s*([\d.,]+k?)\s*(?:分|points?|pts)/i);
  if (m) return 'HN ' + m[1];
  m = line.match(/(\d+)\s*↑/);
  if (m) return m[1] + '↑';
  return '';
}

function parseSource(line) {
  if (/\]\(https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)/.test(line)) return 'X';
  if (/news\.ycombinator\.com/.test(line)) return 'HN';
  if (/huggingface\.co/.test(line)) return 'HF';
  if (/arxiv\.org/.test(line)) return 'ARX';
  return 'WEB';
}

function parseDesc(line) {
  // `- **title** — desc （signal） | [link](url)…` → 抽 desc 段
  let m = line.match(/^\- \*\*[^*]+\*\*\s*[—–-]+\s*(.+)$/);
  if (!m) return '';
  let d = m[1];
  d = d.split(/\s*\|\s*\[/)[0];                       // 去 links
  d = d.replace(/[（(][^（()）]*[）)]\s*$/, '');       // 去尾端 signal 括號
  d = d.replace(/\{#[a-z0-9-]+\}\s*$/, '');
  d = d.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // 去 inline markdown
       .replace(/\*\*/g, '').replace(/`/g, '').trim();
  if (d.length > 160) d = d.slice(0, 158) + '…';
  return d;
}

function parseItem(line, date, isZh) {
  const title = (line.match(/^- \*\*([^*]+)\*\*/) || [])[1];
  const slug = (line.match(/\{#([a-z0-9-]+)\}\s*$/) || [])[1];
  if (!title) return null;
  const item = {
    title: title.trim(),
    desc: parseDesc(line),
    signal: parseSignal(line),
    source: parseSource(line),
  };
  if (slug) item.detailUrl = `${date}${isZh ? '-zh' : ''}--${slug}.html`;
  else {
    const url = (line.match(/\]\((https?:\/\/[^)]+)\)/) || [])[1];
    if (url) item.url = url;
  }
  return item;
}

function parsePodcast(line, date, isZh) {
  const item = parseItem(line, date, isZh);
  if (!item) return null;
  // 「Show —《Title》」/「Show — "Title"」/「Show：Title」→ show + title 分拆
  const raw = item.title;
  let m = raw.match(/^(.*?)\s*[—-]{1,2}\s*[《"“](.+?)[》"”]$/) ||
          raw.match(/^(.*?)[：:]\s*(.+)$/);
  if (m) {
    const show = m[1].replace(/（[^）]*）|\([^)]*\)/g, '').trim();
    item.show = show;
    item.title = m[2].trim();
    item.badge = show.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  }
  item.source = 'POD';
  return item;
}

// --- 組 days[] ---
const days = [];
for (const date of dates) {
  const zhPath = path.join(SRC, `${date}-zh.md`);
  const enPath = path.join(SRC, `${date}.md`);
  const isZh = fs.existsSync(zhPath);
  const mdPath = isZh ? zhPath : enPath;
  if (!fs.existsSync(mdPath)) continue;
  const md = fs.readFileSync(mdPath, 'utf-8');

  const highlights = sectionLines(md, ['今日要點', '今日要点', 'Top Highlights', 'Highlights'])
    .map(l => parseItem(l, date, isZh)).filter(Boolean).slice(0, MAX_ITEMS);
  const podcasts = sectionLines(md, ['播客', 'Podcasts'])
    .map(l => parsePodcast(l, date, isZh)).filter(Boolean).slice(0, MAX_ITEMS);

  if (!highlights.length && !podcasts.length) continue;
  const [, mm, dd] = date.split('-');
  days.push({
    date,
    dateLabel: `${dd} ${MONTHS[parseInt(mm, 10) - 1]}`,
    digestUrl: `${date}${isZh ? '-zh' : ''}.html`,
    podcasts,
    highlights,
  });
}

const out = { generatedAt: dates[0] || '', days };
const outDir = path.join(SRC, 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'homepage.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Written: ${outPath} (${days.length} days, ` +
  days.map(d => `${d.date}: ${d.highlights.length}h/${d.podcasts.length}p`).join(', ') + ')');
