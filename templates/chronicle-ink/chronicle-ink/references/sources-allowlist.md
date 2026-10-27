# Source tiers

Source tiers come only from `src/engine/data/sources-allowlist.json`; users and Agents cannot assign a
tier. This page lists the same domains (a test compares the sets). Independence is judged by publisher.

## Tier 1 (reference institutions)

| Domain | Publisher |
|---|---|
| `britannica.com` | britannica |
| `whc.unesco.org` | unesco |
| `gbif.org` | gbif |
| `api.gbif.org` | gbif |
| `cbdb.fas.harvard.edu` | cbdb |
| `dpm.org.cn` | palace-museum |
| `britishmuseum.org` | british-museum |
| `metmuseum.org` | met |
| `collectionapi.metmuseum.org` | met |
| `ncha.gov.cn` | ncha |

## Tier 2 (open encyclopedic data)

| Domain | Publisher |
|---|---|
| `wikidata.org` | wikimedia |
| `.wikipedia.org` (suffix: every language edition) | wikimedia |

Wikidata and all Wikipedias are one publisher, so they never corroborate each other.

## Tier 3 (news agencies, recent events only)

| Domain | Publisher |
|---|---|
| `reuters.com` | reuters |
| `apnews.com` | ap |
| `bbc.com` | bbc |
| `xinhuanet.com` | xinhua |

Tier 3 counts only for claims with a date whose year is at least the source's retrieval year minus 30.
Claims without a date (numbers, counts, labels, enums, undated events, superlatives, quotes) never count
tier 3 evidence.

## Lead (explicit)

These are read like any lead but the report names the reason (social media, Q&A site, aggregated
encyclopedia):

| Domain | Reason |
|---|---|
| `weibo.com` | social media |
| `zhihu.com` | Q&A site |
| `baike.baidu.com` | aggregated encyclopedia |
| `x.com` | social media |
| `twitter.com` | social media |
| `reddit.com` | social media |
| `quora.com` | Q&A site |
| `douyin.com` | social media |
| `xiaohongshu.com` | social media |

Every other domain is a lead too: it can be read and can guide the search, but it is never evidence.
AI answers are never stored as sources.

## Matching

- A `host` rule matches the host itself or any subdomain (`www.britannica.com` matches `britannica.com`).
- A `suffix` rule matches by suffix only. There are no wildcards.
- The DOI resolver is only a redirect entry: the tier is decided by the publisher host after the redirect
  (a host that is not listed is a lead). Every redirect hop is classified again.

## Identifier formatters

Tier-1 pages are found from Wikidata external identifiers through the property's formatter URL (`P1630`),
re-read on 21 October 2026 and unchanged: Britannica `P1417`, CBDB `P497` (the preferred Harvard
`cbdbapi` URL; the http mirrors are not used), UNESCO World Heritage `P757`, GBIF `P846` (fetched from the
public GBIF API of the same publisher), IUCN `P627`.

IUCN Red List pages are link-only: they are never fetched (the API terms forbid commercial use); the
status comes from Wikidata `P141`.

## Public read policy

- GET only, `https:` only (`http:` is rewritten; no plaintext fallback), 20 s timeout, 2 MiB limit,
  at most 3 redirects, at least 1 s between two requests to one host.
- Hosts resolving to loopback, private, link-local, CGNAT, ULA or unspecified addresses are refused
  (`fetch_blocked_private`), on every redirect hop.
- `User-Agent: chronicle-ink/<version> (+https://www.sandbase.ai/lab/chronicle-ink)`; no cookies, no
  `Authorization` header, no credentials of any kind; the read modules never read environment variables.
- `robots.txt` is read once per host and its `Disallow` / `Allow` rules for `*` and `chronicle-ink` are
  applied to every page, including Wikipedia article URLs passed with `--add-source`. A disallowed URL is
  skipped with `robots_disallowed:<host>`.
- The documented Wikimedia APIs (the Wikidata action API `wbgetentities` / `wbsearchentities` and the
  Wikipedia REST `page/html` endpoint) are called as APIs under the Wikimedia Robot Policy's API rules
  (identified User-Agent, one request at a time, well below 5 requests per second), not as crawls; the
  Wikimedia `robots.txt` disallows `/w/` and `/api/` for generic crawlers, so these endpoints skip the
  crawler check and keep every other rule above.
- A source that fails (4xx, 5xx, timeout, too large, blocked) is skipped with a warning; Wikidata itself
  is retried twice (1 s, 3 s) and then stops research with `research_failed` (exit 5). Some publishers
  refuse automated reads (Britannica answered HTTP 403 to the October 2026 smoke test); the film then
  relies on the remaining tier-1 sources.
- Only excerpts, URLs, retrieval times and the full-text sha256 leave the project; the full texts stay in
  `work/research/sources/`.
