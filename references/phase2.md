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

## Step D: Generate HTML

```bash
bun /path/to/no-more-fomo/scripts/render.js ~/no-more-fomo/YYYY-MM-DD.md
```

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
