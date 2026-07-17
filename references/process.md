# Process — Phase 1

## Prerequisites

- **twscrape** (`pipx install twscrape` + `pipx inject twscrape curl-cffi`) — Twitter/X
  data via X's internal API. Binary at `~/.local/bin/twscrape`. **Always run with
  `DO_NOT_TRACK=1`** to disable its anonymous PostHog telemetry. Use a BURNER account.
  - **Cookie auth is the reliable path** (password/`login_accounts` login is usually
    Cloudflare-blocked). Log the burner into x.com in a browser, copy the `auth_token`
    and `ct0` cookies, then:
    `DO_NOT_TRACK=1 twscrape add_cookie "handle" "auth_token=…; ct0=…"`
  - Verify: `DO_NOT_TRACK=1 twscrape --db "$HOME/accounts.db" accounts` shows
    `active=1`; a test `twscrape --db "$HOME/accounts.db" search "from:karpathy" --limit 3`
    returns tweets.
  - Cookies expire (weeks–months) → re-add when searches start returning nothing.
- **curl** — RSS feeds and HN API (standard on all systems)
- **Jina Reader** — free, no auth needed (`https://r.jina.ai/URL`)
- **baoyu-youtube-transcript** (optional) — podcast transcript download. Path: `~/.claude/plugins/ljg-skills/.agents/skills/baoyu-youtube-transcript`. Falls back to yt-dlp.
- **bun** (optional) — runtime for youtube-transcript scripts
- **yt-dlp** — podcast YouTube subtitles (fallback)

## Step 1: Fetch All Sources (PARALLEL)

Launch ALL fetches in parallel. **First read `~/.no-more-fomo/config.yaml` if it exists, then merge with defaults.**

**Twitter/X via twscrape — one search command covers all three source types.**
Everything goes through `twscrape search "<X advanced-search query>" --limit N`, so
accounts, hashtags, and domains use the SAME mechanism. Always prefix `DO_NOT_TRACK=1`.

**CRITICAL — always pass `--db "$HOME/accounts.db"`.** twscrape's account DB is
resolved RELATIVE TO THE CURRENT DIRECTORY. Without an explicit `--db`, a run from a
different CWD (cron, another folder) finds no accounts, silently creates an empty
`accounts.db`, and returns **0 tweets** — the X section vanishes with no error. Pin the
absolute path so it works regardless of where the skill runs.

Build the query with X's advanced-search operators + a 24h `since:` window:

```bash
export PATH="$HOME/.local/bin:$PATH"
DB="$HOME/accounts.db"     # absolute — the logged-in burner lives here, CWD-independent
SINCE=$(date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d "1 day ago" +%Y-%m-%d)

# (a) A KOL's timeline (originals + quotes, no plain replies):
DO_NOT_TRACK=1 twscrape --db "$DB" search "from:karpathy since:$SINCE -filter:replies" --limit 20

# (b) A hashtag / topic (config: tags):
DO_NOT_TRACK=1 twscrape --db "$DB" search "#LLM since:$SINCE min_faves:50" --limit 30

# (c) Posts linking a specific domain (config: domains):
DO_NOT_TRACK=1 twscrape --db "$DB" search "url:arxiv.org since:$SINCE min_faves:100" --limit 30
```

Run these in parallel (many `twscrape search` calls at once). Combine operators freely,
e.g. `from:_akhaliq since:$SINCE min_faves:50`.

**Rate-limit budget (IMPORTANT).** X throttles the search endpoint per account (~15-min
window) — and the budget is shared with anything else querying through the same account.
Keep it modest: **≤ ~10 `twscrape search` calls per run**
(e.g. top ~8 KOLs + 1 domain + 1 tag), and prefer combined queries
(`(from:a OR from:b OR from:c)`) over one call per handle. If searches start blocking
(`No account available … Next available at …`), the account is throttled — wait out the
window or add a 2nd burner so twscrape auto-rotates.

**twscrape output (JSON, one tweet per line by default):**
- Key fields: `id`, `url` (already a full `https://x.com/user/status/…` — no t.co, no
  reconstruction needed), `date`, `rawContent`, `likeCount`, `retweetCount`,
  `user.username`. Add `--raw` only if you need the unparsed GraphQL response.
- URLs inside `rawContent` are already expanded — no t.co resolution step.
- Filter to last 24h at query time via `since:`; apply `min_faves:` for quality.

**Batching / rate limits:** twscrape handles rate-limit waiting and multi-account
rotation internally, so you can fire all searches in parallel. If a burner account gets
locked, `twscrape relogin_failed` (or add another burner) recovers it.

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

Check `config.yaml` for `hn.mode`. Default is `ai-only`.

```bash
# ai-only mode (default):
YESTERDAY=$(python3 -c "import time; print(int(time.time()) - 86400)")
curl -s "https://hn.algolia.com/api/v1/search?query=ai+agent&tags=story&numericFilters=created_at_i%3E$YESTERDAY&hitsPerPage=20"
curl -s "https://hn.algolia.com/api/v1/search?query=LLM+OR+GPT+OR+Claude+OR+Gemini&tags=story&numericFilters=created_at_i%3E$YESTERDAY&hitsPerPage=15"

# frontpage mode:
curl -s "https://hacker-news.firebaseio.com/v0/topstories.json" | python3 -c "import json,sys; ids=json.load(sys.stdin)[:30]; print('\n'.join(str(i) for i in ids))" | xargs -I{} curl -s "https://hacker-news.firebaseio.com/v0/item/{}.json"
```

Always append `extra_queries` from config (e.g. "Linux"):
```bash
curl -s "https://hn.algolia.com/api/v1/search?query=Linux&tags=story&numericFilters=created_at_i%3E$YESTERDAY&hitsPerPage=10"
```

**General Tech (if `general_tech.enabled: true` in config):**
```bash
curl -s "https://r.jina.ai/https://www.v2ex.com/"
curl -s "https://r.jina.ai/https://www.v2ex.com/?tab=tech"
curl -s "https://r.jina.ai/https://www.linuxtoday.com/"
curl -s "https://r.jina.ai/https://lwn.net/headlines/newrss"
```

## Step 2: Parse & Extract

- twscrape emits one JSON tweet per line: use `url` (already the full
  `https://x.com/user/status/…` link), `rawContent`, `date`, `likeCount`,
  `retweetCount`, `user.username`
- URLs inside `rawContent` are already expanded — no t.co resolution step

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
| 通用技术 | General Tech | V2EX hot, Linux news, non-AI HN (if enabled) |
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

## Step 9: Deploy to S3 (optional — only if configured, skip with `--no-deploy`)

If the user configured a bucket (`deploy.s3` in `~/.no-more-fomo/config.yaml`, or a
`BUCKET` env var), publish the HTML as the very last step of the run so the digest
is readable anywhere:

```bash
BUCKET=<bucket> AWS_PROFILE=<profile> AWS_DEFAULT_REGION=<region> \
  bash /path/to/no-more-fomo/scripts/deploy-s3.sh
```

This syncs `~/no-more-fomo/*.html` to the S3 static-website bucket. Then include
today's live URL in the summary, e.g.
`http://<bucket>.s3-website-<region>.amazonaws.com/YYYY-MM-DD.html`.

Skip when `--no-deploy` or `--no-save`, or when no bucket is configured. If the
deploy fails, report the error but keep the run successful — the local files are
still generated.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Including all retweets | Only quote tweets with commentary |
| Sequential fetching | ALL fetches must be parallel |
| Omitting `--db` with twscrape | Always `--db "$HOME/accounts.db"` — else a run from another CWD silently returns 0 tweets |
| Reconstructing tweet URLs | twscrape's `url` field is already the full link — use it |
| Items without reference links | Every item needs at least one `[link](URL)` |
| Highlights without links | 今日要点 MUST end with `\| [link](URL)` |
| Ignoring dedup | Same URL from Twitter + HN = one entry |
| One `twscrape search` per handle | Combine: `(from:a OR from:b OR from:c)` — stay inside the per-account search budget |
| Repeating yesterday's headlines | Read previous day's .md, exclude duplicates |
