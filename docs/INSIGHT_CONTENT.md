# Insight content contract

Premium Insight tab: list at `/insight`, detail at `/insight/[slug]`.
**No fake articles.** If `content/insights/` has no valid public posts, the UI shows an empty state only.

## Frontmatter (YAML)

Every post file must open with YAML frontmatter:

```yaml
---
title: string              # required — display title
date: YYYY-MM-DD           # required — ISO date
slug: kebab-case-slug      # required — must match filename stem
summary: string            # required — list teaser / meta description
author: string             # optional — e.g. "NBA Fantasy Analyst"
tags: [string]             # optional — labels for chips
status: ready              # optional — ready|published (public); draft|wip (hidden)
---
```

| Field     | Type       | Required | Notes |
|-----------|------------|----------|-------|
| `title`   | `string`   | yes      | Non-empty |
| `date`    | `string`   | yes      | Exact `YYYY-MM-DD` |
| `slug`    | `string`   | yes      | Kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`); **must equal** the filename stem |
| `summary` | `string`   | yes      | Non-empty; used on list cards and detail meta |
| `author`  | `string`   | no       | Tolerated by the loader; may be shown in meta when present |
| `tags`    | `string[]` | no       | Optional labels; omitted or empty is fine |
| `status`  | `string`   | no       | `ready` / `published` → public; `draft` / `wip` → hidden; omit → public |

Body after the closing `---` is Markdown (headings, paragraphs, emphasis, links, lists, tables, inline/fenced code).

## File naming

```
content/insights/{slug}.md
```

- Stem of the file **must** match frontmatter `slug`.
- Skip non-posts: `README.md`, `.gitkeep`, and any file that fails validation (missing fields, bad date, slug mismatch).
- Do not invent sample/fake posts for the UI. Ship real editorial only.

## Loader

- Server-side: `src/lib/insights.ts` reads `content/insights/*.md` via `fs` + `gray-matter`.
- Parses required `title` / `date` / `slug` / `summary` and optional `author` / `tags` / `status`.
- YAML unquoted dates (e.g. `date: 2026-09-07`) may parse as a JS `Date`; the loader coerces `Date` and ISO strings to `YYYY-MM-DD` before validation.
- `getInsightPosts()` → public posts sorted by `date` descending (then slug).
- `getInsightBySlug(slug)` → one public post or `null`.
- Invalid files are skipped (not thrown) so a bad draft cannot break the list.

## List render (`/insight`)

When posts exist:
- Header: Insight kicker + title + short subtitle
- Feed of cards: **title**, **date**, **summary**, link to `/insight/{slug}`
- Optional tags as muted chips; optional author in meta when present

When none:
- Empty-state card copy only — **“No insights published.”**
- No invented titles, teasers, or placeholder articles

## Detail render (`/insight/[slug]`)

- Full post: title, date, optional author/tags, Markdown body
- Unknown / invalid / non-public slug → Next.js `notFound()`
- Back link to `/insight`

## Chrome

- Dark grey + champagne premium glass (same tokens as Home/Player)
- Mobile-safe padding and type scale
- Nav unchanged: **Home | Player | Insight** (`AppNav`)

## Published posts

| slug | title |
|------|-------|
| `fantasy-score-method` | Fantasy score method — how we rank the pool |
| `rank-stability-5yr` | How sticky are fantasy ranks year to year? |

Routes: `/insight`, `/insight/fantasy-score-method`, `/insight/rank-stability-5yr`.
