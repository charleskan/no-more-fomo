---
name: no-more-fomo
description: >
  Use when user says 'fomo', 'digest', 'daily', 'AI news', 'today's papers',
  'what's new in AI', 'catch up', or on a scheduled daily cron trigger.
---

# No More FOMO

Daily AI intelligence briefing: Twitter KOLs + AI lab blogs + tech podcasts + arxiv + HackerNews.

**Primary digest is always in English.** After generating, automatically translate to **Traditional Chinese (繁體中文，香港用字：發佈/網絡/軟件，NEVER simplified)** (`YYYY-MM-DD-zh.md`). Both get HTML rendering. Skip translation with `--en-only`.

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
7. **Brief** — explain the digest to the user as a beginner-friendly spoken briefing (skip with `--no-brief`)
8. **Deploy** — publish the HTML to an S3 static website, only if the user configured a bucket (skip with `--no-deploy`)

Full process details: `references/process.md` and `references/phase2.md`.

## Beginner Briefing (default ON)

After saving, the final chat message is NOT a bare file list — it is a spoken-style
briefing that assumes the reader is **new to AI news** and wants to be told what
happened and why it matters, not handed links to read themselves.

**Format: each of the top 3–5 items is explained with the same three questions**
(translate the question headings into the user's language):

1. **What's this about?** — the news in one or two plain sentences,
   no marketing tone.
2. **What exactly is XXX?** — pick the ONE term or thing a newcomer
   would trip on (the model name, "agent", "prompt injection", "diffusion", etc.)
   and define it from scratch in plain words, with an everyday analogy if useful.
3. **What's the community saying?** — **list the actual discussion
   topics as a numbered list (1, 2, 3…)**, each a distinct angle/argument the
   community raised (support vs. skepticism, a specific concern, a hot sub-thread),
   drawn from HN comments, quote-tweets, or the discussion. Lead the section with a
   one-line signal (e.g. "HN 510 points, 193 comments") then the numbered topics.
   If there's genuinely no discussion signal, say so and give the significance instead.

Rules:
- Match the user's language (the zh digest reader gets a Chinese briefing with
  Chinese question headings: 這是在講什麼? / XXX 到底是什麼? / 網友都在討論什麼?).
- Lead with a 1–2 sentence "if you only remember one thing today" takeaway.
- Cover only the 3–5 most important items in the three-question format — do NOT
  run every section through it.
- Group the long tail into one sentence ("also today: …") instead of listing it.
- End with any gaps/caveats in plain terms (e.g. "Twitter was skipped today because…").
- The HTML/markdown files hold the full detail; the briefing is the human handoff.

Skip only when the user passes `--no-brief` or `--no-save`.

### Per-item detail pages

**Every** news item — highlights AND every section item — gets its own clickable
**detail page** = the three-question briefing for that single item, with the item's
**source ref link(s) shown next to the title**.

How it works:
- In the digest markdown, append `{#english-title-kebab-slug}` to the end of every
  item line (highlights included). render.js strips it and turns each item into a
  link to `YYYY-MM-DD[-zh]--<slug>.html` (both the title and an explainer chip —
  `Explainer →` / `白話詳解 →` depending on the page language).
  The SAME news in two sections shares one slug → one detail page.
- Write one authored `YYYY-MM-DD[-zh]-details.md` with a `## <title> {#slug}` block
  per unique item, then render with `scripts/render-details.js` (emits one HTML
  page per item, wires prev/next, shows the `ref:` links beside the title).
- Slugs use the item's **English title in kebab-case** (`gpt-live`, `gitlost`).

Per-item detail block format (in `-details.md`; the zh file uses the Chinese
question headings and `信號:`):
```markdown
## OpenAI releases GPT-Live {#gpt-live}
kicker: Models & Releases                  <!-- section label above the title -->
ref: [OpenAI announcement](url) · [HN thread](url)  <!-- source links beside the title -->
### What's this about?
### What exactly is a "voice model"?
### What's the community saying?
Signal: HN 636 points, 422 comments
1. ...
```

Full spec + render order: `references/phase2.md` (Steps C2 and D). Still ALSO give
the spoken briefing in chat (above). Skip both with `--no-brief`.

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
| `--no-brief` | Skip the beginner-friendly spoken briefing at the end |
| `--no-deploy` | Skip the S3 deploy at the end |

## Key Rules

- Every digest item MUST have at least one clickable `[link](URL)`
- ALL fetches must be parallel (never sequential)
- Twitter/X via **twscrape** — always `DO_NOT_TRACK=1 twscrape --db "$HOME/accounts.db"`
  (telemetry off; `--db` absolute so a run from any CWD finds the logged-in account —
  omitting it silently returns 0 tweets)
- All X sources use ONE tool: `twscrape search "<query>" --limit N` — accounts
  (`from:handle`), hashtags (`#tag`), and domains (`url:domain.com`), each with
  `since:$YESTERDAY`; twscrape output already has full `url` (no t.co reconstruction)
- Dedup against previous day's digest

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

- twscrape returns nothing / account locked → `twscrape relogin_failed`, or skip the
  X section for the day (note it in the digest footer). Last resort:
  `curl -s "https://r.jina.ai/https://twitter.com/HANDLE"` (often blocked by X)
- HN API fails → `curl -s "https://r.jina.ai/https://news.ycombinator.com"`
- Podcast RSS fails → `curl -s "https://r.jina.ai/PODCAST_WEBSITE"`
