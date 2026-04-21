# Process — Phase 1

## Prerequisites

- **xreach** (`npm i -g xreach-cli`) — Twitter/X data. Requires auth: `xreach auth`
- **curl** — RSS feeds and HN API (standard on all systems)
- **Jina Reader** — free, no auth needed (`https://r.jina.ai/URL`)
- **baoyu-youtube-transcript** (optional) — podcast transcript download. Path: `~/.claude/plugins/ljg-skills/.agents/skills/baoyu-youtube-transcript`. Falls back to yt-dlp.
- **bun** (optional) — runtime for youtube-transcript scripts
- **yt-dlp** — podcast YouTube subtitles (fallback)

## Step 1: Fetch All Sources (PARALLEL)

Launch ALL fetches in parallel. **First read `~/.no-more-fomo/config.yaml` if it exists, then merge with defaults.**

**CRITICAL — Filter at fetch time.** Pipe xreach output through jq to keep only relevant tweets (~30KB → ~2KB/account).

**xreach JSON structure (verified):**
- Top-level keys: `items`, `cursor`, `hasMore` (NOT `data.items`)
- Each item: `{id, text, createdAt, likeCount, retweetCount, isQuote, isRetweet, isReply, user, media, ...}`
- **NO `entities.urls` field** — URLs appear as t.co links within `text`
- `id` — tweet ID string, construct URL: `https://x.com/HANDLE/status/ID`
- `createdAt` — format: `"Tue Mar 24 16:56:24 +0000 2026"`

```bash
# Template for each account — filters to last 24h:
CUTOFF=$(date -u -v-24H +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -d "24 hours ago" +"%Y-%m-%dT%H:%M:%S")
xreach tweets @HANDLE --json -n N | jq --arg cutoff "$CUTOFF" '[.items[] | select(.isRetweet==false or .isQuote==true) | select(.createdAt | strptime("%a %b %d %H:%M:%S %z %Y") | strftime("%Y-%m-%dT%H:%M:%S") > $cutoff) | {id,text: .text[:300],createdAt,likeCount,retweetCount,isQuote}]'
```

**Batching (4 batches to avoid rate limits):**
- Batch 1: High volume (@_akhaliq -n50, @dotey -n30)
- Batch 2: KOLs (karpathy, bcherny, oran_ge, trq212, swyx, emollick)
- Batch 3: More KOLs (drjimfan, simonw, hardmaru, ylecun)
- Batch 4: Company accounts (cursor_ai, AnthropicAI, OpenAI, GoogleDeepMind)
- Tier 2 (only with `--full`): xai, WindsurfAI, cognition, replit, huggingface, llama_index

**Rate limiting:** xreach may return `"Rate limit exceeded"` after ~15 accounts. Wait 10s and retry.

**AI Lab Blogs:**
```bash
curl -s "https://r.jina.ai/https://deepmind.google/blog/rss.xml"
curl -s "https://r.jina.ai/https://www.anthropic.com/news"
curl -s "https://r.jina.ai/https://openai.com/blog/rss.xml"
```

**Podcasts:**
```bash
curl -s "https://r.jina.ai/https://rss.art19.com/no-priors-ai"
curl -s "https://r.jina.ai/https://api.substack.com/feed/podcast/1084089.rss"
curl -s "https://r.jina.ai/https://apple.dwarkesh-podcast.workers.dev/feed.rss"
curl -s "https://r.jina.ai/https://feeds.megaphone.fm/trainingdata"
```

**arxiv Papers:**
```bash
curl -s "https://export.arxiv.org/api/query?search_query=(cat:cs.AI+OR+cat:cs.CL)+AND+abs:%22AI+agent%22&sortBy=submittedDate&sortOrder=descending&max_results=10"
```

**HuggingFace Daily Papers:**
```bash
curl -s "https://huggingface.co/api/daily_papers?limit=20"
```

**HackerNews:**
```bash
YESTERDAY=$(python3 -c "import time; print(int(time.time()) - 86400)")
curl -s "https://hn.algolia.com/api/v1/search?query=ai+agent&tags=story&numericFilters=created_at_i%3E$YESTERDAY&hitsPerPage=20"
curl -s "https://hn.algolia.com/api/v1/search?query=LLM+OR+GPT+OR+Claude+OR+Gemini&tags=story&numericFilters=created_at_i%3E$YESTERDAY&hitsPerPage=15"
```

## Step 2: Parse & Extract

- Items at `.items[]` (NOT `.data.items[]`)
- No `entities.urls` — URLs are t.co links inside `text`
- Construct tweet links: `https://x.com/HANDLE/status/ID`

**URL extraction from tweet text:**
1. Regex extract `https://t.co/\w+` from `text`
2. Resolve via `curl -sI URL | grep -i location`

**Every digest item MUST have at least one clickable link.**

## Step 3: Filter

| Source | Window | Quality threshold |
|--------|--------|-------------------|
| Twitter | 24h | `likeCount > 100` (@_akhaliq), `> 50` (others) |
| Blogs | 7 days | Skip non-technical (hiring, events) |
| Podcasts | 7 days | Title + date + description + link |
| HN | 24h | `points > 20` |

- Include original tweets and quote tweets with commentary
- Exclude pure retweets and reply threads
- **Dedup vs previous day:** If previous digest exists, skip repeated items

## Step 4: Enrich

After filtering, enrich all unique URLs in parallel:

**arxiv papers:** `curl -s "https://r.jina.ai/https://arxiv.org/abs/PAPER_ID" | head -80`
Extract: title, authors (first 3), abstract (first 2 sentences).

**GitHub repos:** `curl -s "https://api.github.com/repos/OWNER/REPO" | python3 -c "..."`

**HuggingFace models:** `curl -s "https://r.jina.ai/https://huggingface.co/MODEL_ID" | head -40`

**What "enriched" looks like:**

| Before (bad) | After (good) |
|-------------|-------------|
| `**FASTER** — paper \| @_akhaliq` | `**FASTER** — 将 VLA 推理速度提升 5x... \| [arxiv](...) [github](...) \| @_akhaliq \| 33L` |

## Step 5: Categorize

| Section (zh) | Section (en) | Content |
|--------------|-------------|---------|
| 模型与发布 | Models & Releases | New models, checkpoints, API launches |
| 工具与演示 | Tools & Demos | Libraries, frameworks, open-source tools |
| AI Agents | AI Agents | Agent frameworks, benchmarks |
| 实验室动态 | Lab Updates | DeepMind / Anthropic / OpenAI blog highlights |
| 播客 | Podcasts | New episodes (last 7 days) |
| HN 讨论 | HN Threads | Top HN discussions |
| 行业动态 | Industry | Company announcements, funding, policy |
| HF 热门论文 | HF Trending Papers | HuggingFace community-upvoted papers |
| arxiv: [主题] | arxiv: [Topic] | Per-topic arxiv search results |
| 发现 | Discovery | Phase 2: s.jina.ai web search results |

## Step 6: Format & Output

Save to `~/no-more-fomo/YYYY-MM-DD.md`. See `references/template.md` for full output format.

Primary digest is always in English. After saving, automatically translate to Chinese as `YYYY-MM-DD-zh.md` (skip with `--en-only`).

## Step 7: Relevance Check

If user has CLAUDE.md or memory files with project keywords, tag matching items with `[RELEVANT]`.

## Step 8: Summary to User

Print concise summary:
- Top 3 highlights with links
- Count per section
- New podcast episodes
- Any `[RELEVANT]` items

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Including all retweets | Only quote tweets with commentary |
| Sequential fetching | ALL fetches must be parallel |
| Using `.data.items[]` for xreach | Correct: `.items[]` |
| Using `.entities.urls` for xreach | Does not exist. Use `.id` for tweet links |
| Items without reference links | Every item needs at least one `[link](URL)` |
| Highlights without links | 今日要点 MUST end with `\| [link](URL)` |
| Ignoring dedup | Same URL from Twitter + HN = one entry |
| xreach rate limiting | Use 4 batches, retry after 10s |
| Repeating yesterday's headlines | Read previous day's .md, exclude duplicates |
