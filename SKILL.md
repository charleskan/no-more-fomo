---
name: no-more-fomo
description: >
  Use when user says 'fomo', 'digest', 'daily', 'AI news', 'today's papers',
  'what's new in AI', 'catch up', or on a scheduled daily cron trigger.
---

# No More FOMO

Daily AI intelligence briefing: Twitter KOLs + AI lab blogs + tech podcasts + arxiv + HackerNews.

**Primary digest is always in English.** After generating, automatically translate to Chinese (`YYYY-MM-DD-zh.md`). Both get HTML rendering. Skip translation with `--en-only`.

## When to Use

- User asks about today's AI papers, news, or trending research
- Morning routine check-in on new releases
- Scheduled daily cron trigger

**When NOT to use:** Searching for a specific paper (use web-fetcher or arxiv directly).

## Process Overview

1. **Fetch** — all sources in parallel (see `references/sources.md` for full list)
2. **Filter** — 24h for Twitter/HN, 7 days for blogs/podcasts
3. **Enrich** — fetch abstracts, repo descriptions, resolve URLs
4. **Categorize** — 10 sections from Models to Discovery
5. **Output** — save to `~/no-more-fomo/YYYY-MM-DD.md` + HTML render
6. **Phase 2** — podcast deep summaries, topic search, discovery (skip with `--quick`)
7. **Deploy** — publish the HTML to an S3 static website, only if the user configured a bucket (skip with `--no-deploy`)

Full process details: `references/process.md` and `references/phase2.md`.

## Arguments

| Argument | Effect |
|----------|--------|
| (none) | Phase 1 + Phase 2 (all defaults) |
| `--full` | Also fetch Tier 2 company accounts |
| `--quick` | Phase 1 only, skip Phase 2 |
| `@handle` | Add extra Twitter accounts |
| `--twitter-only` | Skip blogs, podcasts, HN |
| `--hn-only` | Skip Twitter, blogs, podcasts |
| `--podcasts-only` | Only podcast feeds + deep processing |
| `--no-save` | Print results, don't save |
| `--no-html` | Only .md, skip HTML |
| `--en-only` | Skip Chinese translation |
| `--query "term"` | Add custom HN search query |
| `--no-deploy` | Skip the S3 deploy at the end |

## Key Rules

- Every digest item MUST have at least one clickable `[link](URL)`
- ALL fetches must be parallel (never sequential)
- xreach JSON: `.items[]` (not `.data.items[]`), no `.entities.urls` field
- Construct tweet links from `.id`: `https://x.com/HANDLE/status/ID`
- Dedup against previous day's digest
- Rate limit: batch Twitter into 4 groups, retry after 10s

## Deploy (S3 static website — optional)

If the user has configured a bucket (a `deploy.s3` block in `~/.no-more-fomo/config.yaml`,
see `references/sources.md`, or a `BUCKET` env var), run the deploy as the final step of
every digest, unless `--no-deploy` or `--no-save` was passed:

```bash
BUCKET=<bucket> AWS_PROFILE=<profile> AWS_DEFAULT_REGION=<region> \
  bash /path/to/no-more-fomo/scripts/deploy-s3.sh   # syncs ~/no-more-fomo/*.html
```

- Recommend a **scoped IAM profile** whose policy only grants S3 on the one bucket —
  never root/admin creds. One-time bucket bootstrap commands are commented at the
  bottom of `deploy-s3.sh`.
- The site is public-read over HTTP at
  `http://<bucket>.s3-website-<region>.amazonaws.com/`. After deploying, tell the
  user the live URL of today's dated page.
- If the deploy fails (no profile, no network), report it but don't fail the whole
  run — the local HTML is still there.
- No bucket configured → skip silently.

## Scheduling

**Claude Code Cloud:** preview.claude.ai/code → Scheduled → Daily 09:00 AM

**Local:** `0 9 * * * claude -p "run /no-more-fomo and save the digest" --allowedTools "Bash,Read,Write,Glob"`

## Fallback

- xreach fails → `curl -s "https://r.jina.ai/https://twitter.com/HANDLE"`
- HN API fails → `curl -s "https://r.jina.ai/https://news.ycombinator.com"`
- Podcast RSS fails → `curl -s "https://r.jina.ai/PODCAST_WEBSITE"`
