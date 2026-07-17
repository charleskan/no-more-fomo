# Phase 2: Deep Layer

Runs in the same session immediately after Phase 1 saves the digest. Skip entirely with `--quick`.

## Step A: Parallel Network Requests

Launch ALL as parallel Bash tool calls:

**Podcast transcripts** (if `podcasts.depth` is `full`, default):
For each new episode (up to `max_episodes` per podcast, default 3).
Check cache first: `~/no-more-fomo/.cache/pods/{channel}/{episode}/summary.md`

```bash
bun ~/.claude/plugins/ljg-skills/.agents/skills/baoyu-youtube-transcript/scripts/main.ts VIDEO_URL \
  --chapters --speakers --languages en,zh \
  --output-dir ~/no-more-fomo/.cache/pods
```

**Topic Search** (if `topic_search.enabled`, default true):
For each hot topic from step 6.5 (max 5):
```bash
xreach search "TOPIC_NAME" --type top -n 15 --json
```

**Discovery** (if `discovery.enabled`, default true):
For each topic in `papers.topics` config (max 3):
```bash
curl -s "https://s.jina.ai/latest%20TOPIC%20research%202026"
```

## Step B: AI Processing (Serial)

**Podcast structured summaries** — for each episode with transcript:

1. Read transcript from `~/no-more-fomo/.cache/pods/{channel}/{title}/transcript.md`
2. Reference speaker identification prompt at:
   `~/.claude/plugins/ljg-skills/.agents/skills/baoyu-youtube-transcript/prompts/speaker-transcript.md`
3. Identify speakers (host vs guest) from video metadata
4. Generate structured summary in configured `language`:

```markdown
**TLDR:** [3 sentences: core thesis, most surprising insight, practical takeaway]

**章节:**
- *[Chapter Title]* — [1-2 sentence summary]

**关键引用:**
> **[Speaker Name]:** "[Translated quote]" [HH:MM:SS]
```

5. Cache summary to `~/no-more-fomo/.cache/pods/{channel}/{title}/summary.md`

Speaker names stay in original form. Select 2-3 most insightful quotes.

**Topic Search analysis:**
- Filter: `likeCount > 200`, exclude KOLs already in digest
- If >80% overlap with existing tweets, skip
- Extract 2-3 external perspectives → format as `> 社区热议:` blockquote

**Discovery filtering:**
- Deduplicate: remove URLs already in digest
- Only keep technical content (papers, blogs, conference pages)
- Keep max 3 per topic:
```markdown
- **[类型]** [Title] — [summary] | [link](URL)
```
Types: 博客, 会议, 报告, 教程

## Step C: Update Digest File

Read `~/no-more-fomo/YYYY-MM-DD.md` and apply:

1. **Podcasts:** Replace `⏳ 深度摘要生成中...` → structured summary
2. **Topic Search:** Append `> 社区热议:` blockquote after matching entries
3. **Discovery:** Insert `## 发现` section before Sources line
4. **Update Sources line** to include Phase 2 counts

## Step C2: Write per-item detail pages (default ON, skip with `--no-brief`)

**Every** news item gets its own clickable **detail page** — the three-question
"白话详解" for that single item, with the source ref link(s) beside the title.
This covers highlights AND every section item (dedupe: the same news appearing in
two sections shares ONE slug/page).

Two parts:

**(a) Tag every digest item with a slug.** In the digest markdown, append
`{#slug}` to the end of each item line (highlights included), where slug is the
item's **English title in kebab-case** (`gpt-live`, `gitlost`, `swe-1-7`). render.js
strips the marker and turns the item into a link to `YYYY-MM-DD[-zh]--<slug>.html`.
Reuse the same slug for the same news across sections.

**(b) Author `YYYY-MM-DD[-zh]-details.md`** — one block per UNIQUE item:

```markdown
# 白话详解 — YYYY-MM-DD        <!-- ignored page title -->

## OpenAI 发布 GPT-Live {#gpt-live}
kicker: 模型与发布                          <!-- optional section label above title -->
ref: [OpenAI 公告](url) · [HN 讨论](url)     <!-- source links, shown beside the title -->
### 这是在讲什么?
<1–3 plain sentences>
### 「语音模型」到底是什么?
<define the one term from scratch, everyday analogy>
### 网友都在讨论什么?
信号: HN NNN 分、NNN 则留言                   <!-- one-line signal → green badge -->
1. <discussion topic>
2. <discussion topic>
3. <discussion topic>
<!-- if no discussion signal, replace Q3 with "为什么值得注意?" + significance -->

## <next unique item> {#slug}
...
```

Rules:
- Depth scales with signal: items with real HN/community discussion get the full
  three questions incl. a numbered "网友都在讨论什么"; long-tail papers get
  这是在讲什么 / 术语是什么 / 为什么值得注意 (2–4 sentences each).
- Every `## ` slug MUST also appear as a `{#slug}` on the matching digest item(s),
  or that item won't link. Conversely every slug used in the digest MUST have a
  block here, or the link 404s.
- Do this for each language you generate a digest for (en + zh).

## Step D: Generate HTML

```bash
# detail pages → one HTML per item (render FIRST so links resolve)
bun /path/to/no-more-fomo/scripts/render-details.js ~/no-more-fomo/YYYY-MM-DD-details.md

# digest → HTML (turns every {#slug}-tagged item into a link to its detail page)
bun /path/to/no-more-fomo/scripts/render.js ~/no-more-fomo/YYYY-MM-DD.md
```

Verify after rendering: no leftover `{#slug}` text in the digest HTML, and every
`--<slug>.html` referenced by the digest actually exists (no broken links).

Features:
- Three view layouts: newspaper (default), sidebar, grid
- Light/dark theme with system preference
- `中/EN` button navigates between `.html` ↔ `-zh.html`
- render.js supports both English AND Chinese section headings

For `--quick` mode: run this at end of Phase 1.

## Step E: Generate Chinese Translation

Skip if `--no-save` or digest already in Chinese.

1. Read English version (already in memory)
2. Translate: section titles → zh, descriptions → zh, names/links/metrics → keep original
3. Write to `~/no-more-fomo/YYYY-MM-DD-zh.md`
4. Render: `bun /path/to/no-more-fomo/scripts/render.js ~/no-more-fomo/YYYY-MM-DD-zh.md`

Skip with `--en-only`.
