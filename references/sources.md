# Sources & Configuration

## Twitter — Tier 1: KOLs (Default, always fetched)

| Handle | Who | Focus | Count |
|--------|-----|-------|-------|
| @_akhaliq | AK | Papers, models, tools — highest signal/volume | `-n 50` |
| @karpathy | Andrej Karpathy | Deep insights, tutorials, AI commentary | `-n 20` |
| @dotey | Baoyu | Chinese AI community, translations, commentary | `-n 30` |
| @bcherny | Boris Cherny | Claude Code core dev, coding agents | `-n 20` |
| @oran_ge | OrangeAI | AI research, tools, commentary | `-n 20` |
| @trq212 | Thariq | Claude Code core dev | `-n 20` |
| @swyx | swyx | Latent Space host, AI engineering ecosystem | `-n 20` |
| @emollick | Ethan Mollick | Wharton professor, AI adoption & impact | `-n 20` |
| @drjimfan | Jim Fan | NVIDIA robotics/embodied AI research | `-n 20` |
| @simonw | Simon Willison | LLM tooling, Datasette creator, pragmatic builder | `-n 20` |
| @hardmaru | David Ha | Sakana AI CEO, creative AI research | `-n 20` |
| @ylecun | Yann LeCun | Meta/NYU, AI theory debates, high signal | `-n 20` |
| @cursor_ai | Cursor | AI-native code editor | `-n 15` |
| @AnthropicAI | Anthropic | Claude, safety research | `-n 15` |
| @OpenAI | OpenAI | GPT, API, product launches | `-n 15` |
| @GoogleDeepMind | Google DeepMind | Models, research papers | `-n 15` |

## Twitter — Tier 2: More Companies & Tools (on-demand via `--full`)

| Handle | Who | Focus |
|--------|-----|-------|
| @xai | xAI | Grok, compute infrastructure |
| @WindsurfAI | Windsurf | AI coding (Codeium) |
| @cognition | Cognition | Devin, autonomous coding agent |
| @replit | Replit | AI-native IDE & deployment |
| @huggingface | Hugging Face | Open-source models & datasets |
| @llama_index | LlamaIndex | RAG, AI agents for documents |

Users can also add any handle via arguments: `/no-more-fomo @someone`

## AI Lab Blogs

| Source | URL | Method |
|--------|-----|--------|
| DeepMind | `https://deepmind.google/blog/rss.xml` | Jina Reader |
| Anthropic | `https://www.anthropic.com/research` + `https://www.anthropic.com/news` | Jina Reader (no RSS) |
| OpenAI | `https://openai.com/blog/rss.xml` | Jina Reader |

## Tech Podcasts (RSS)

| Podcast | RSS Feed | Transcript Source | Focus |
|---------|----------|-------------------|-------|
| No Priors | `https://rss.art19.com/no-priors-ai` | YouTube subs | AI/ML/startups — top researcher interviews |
| Latent Space | `https://api.substack.com/feed/podcast/1084089.rss` | Substack post (embedded) | AI engineering deep dives |
| Dwarkesh Podcast | `https://apple.dwarkesh-podcast.workers.dev/feed.rss` | Substack post (embedded) | Long-form interviews with AI leaders |
| Training Data (Sequoia) | `https://feeds.megaphone.fm/trainingdata` | YouTube subs | AI/tech from Sequoia Capital |

**Transcript retrieval (Phase 2 — automatic, no flag needed):**

Primary method uses youtube-transcript:
```bash
# Step 1: Find YouTube URL for the episode
yt-dlp --flat-playlist "ytsearch1:PODCAST_NAME EPISODE_TITLE" --print url

# Step 2: Download transcript with chapters and speaker detection
bun ~/.claude/plugins/ljg-skills/.agents/skills/baoyu-youtube-transcript/scripts/main.ts VIDEO_URL \
  --chapters --speakers \
  --languages en,zh \
  --output-dir ~/no-more-fomo/.cache/pods
```

**Fallback chain** (if youtube-transcript fails or is not installed):
1. `yt-dlp --write-auto-sub --sub-lang en --skip-download` — auto-generated subtitles
2. `curl -s "https://r.jina.ai/POST_URL"` — Substack transcript (Latent Space, Dwarkesh)
3. Keep basic episode entry (title + description only)

## arxiv Papers (Topic-filtered)

Default topics (customizable via config):

| Topic | arxiv Query | Categories |
|-------|-------------|------------|
| AI Agents | `abs:"AI agent" OR abs:"LLM agent"` | cs.AI, cs.CL |
| Large Language Models | `abs:"large language model" OR abs:LLM` | cs.CL, cs.AI |

**arxiv API:**
```bash
curl -s "https://export.arxiv.org/api/query?search_query=cat:cs.AI+AND+abs:AI+agent&sortBy=submittedDate&sortOrder=descending&max_results=10"
```

**HuggingFace Daily Papers:**
```bash
curl -s "https://huggingface.co/api/daily_papers?limit=20"
```
Filter: `upvotes >= 3` (configurable via `min_hf_upvotes`).

**Merge logic:** Deduplicate by arxiv ID across both sources. If a paper appears in both, mark as high-signal.

## HackerNews

Two parallel searches via HN Algolia API, filtered to last 24h:
1. `ai agent` — agent-specific stories
2. `LLM OR GPT OR Claude OR Gemini` — broader AI coverage

## User Config (Optional)

Users can customize sources by creating `~/.no-more-fomo/config.yaml`. The skill merges this with defaults — users only specify what they want to change.

**Before fetching, always check if config exists:**
```bash
cat ~/.no-more-fomo/config.yaml 2>/dev/null
```

**Config format:**
```yaml
# ~/.no-more-fomo/config.yaml

twitter:
  add:                          # Extra accounts to follow
    - handle: "@elonmusk"
      count: 15
  remove:                       # Accounts to skip from defaults
    - "@ylecun"

papers:
  topics:                       # arxiv topic searches
    - query: "AI agent"
      categories: ["cs.AI", "cs.CL"]
    - query: "large language model"
      categories: ["cs.CL", "cs.AI"]
  hf_daily: true
  min_hf_upvotes: 3

podcasts:
  add:
    - name: "Lex Fridman"
      rss: "https://lexfridman.com/feed/podcast/"
      transcript: youtube
  remove:
    - "Training Data"
  depth: full                   # full | none
  max_episodes: 3
  cache_dir: ~/no-more-fomo/.cache/pods

blogs:
  add:
    - name: "Meta AI"
      url: "https://ai.meta.com/blog/"
  remove: []

hn:
  extra_queries:
    - "robotics"

discovery:
  enabled: true
  max_per_topic: 3

topic_search:
  enabled: true
  min_mentions: 2
  max_topics: 5

language: zh                    # zh | en
```

**Merge rules:**
- `add` items are appended to defaults
- `remove` items are excluded from defaults (match by handle or name)
- If no config file exists, use all defaults as-is
- Unspecified sections keep their defaults
