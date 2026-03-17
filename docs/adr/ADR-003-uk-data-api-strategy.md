# ADR-003: UK Data API Strategy

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

Nature Risk ingests data from eight UK government and statutory body APIs spanning inland and coastal risk domains:

**Inland:** EA LIDAR (DSM/DTM tiles), OS Open Rivers (WFS), BGS Soilscapes (WMS/WFS), EA Risk of Flooding from Rivers and Sea (RoFRS), Met Office UKCP18 climate projections.

**Coastal:** UKHO Bathymetry (WCS), Cefas Saltmarsh extent (WFS), NTSLF tide gauge data, EA National Coastal Erosion Risk Mapping (NCERM).

The product is a static GH Pages site; all data fetching must occur client-side. Several of these APIs do not set `Access-Control-Allow-Origin` response headers, blocking direct browser XHR/fetch calls. Data volumes can be significant (LIDAR tiles, bathymetry grids), so naive on-demand fetching would produce unacceptable latency and risk exhausting rate limits during a live demo or concurrent user session.

## Decision Drivers

- Direct browser calls to APIs without CORS headers will be blocked by the browser
- Rate limits on EA and OS APIs (typically 600 req/min) must be respected
- LIDAR and bathymetry tiles are expensive to fetch repeatedly; caching is essential
- The solution must remain serverless / static-site compatible
- Data freshness requirements: flood risk and climate data can tolerate 24h staleness; tide gauge data should be near-real-time (5-minute cache)
- Offline use (e.g., presenting in a meeting without connectivity) requires pre-cached data

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Cloudflare Worker CORS proxy + IndexedDB cache (TTL per dataset)** | Serverless, free tier (100k req/day), transparent to client, cache at worker layer and client layer, no server to maintain | Single CF account dependency; worker logic needs maintenance as API endpoints change |
| **Direct browser calls only** | Simplest architecture | Fails for all APIs without CORS headers; blocked at browser level |
| **Pre-cached static data (GeoJSON/COG files in repo)** | Fully offline, no API calls needed | Data becomes stale immediately; large binary files bloat repo; cannot reflect real-time flood warnings |
| **Self-hosted Node proxy (Heroku/Railway)** | Full control, can add auth/rate-limiting | Introduces server infrastructure and ongoing cost; violates static-site constraint |

## Decision Outcome

**Chosen option:** Cloudflare Worker CORS proxy for APIs without CORS support + IndexedDB cache with per-dataset TTL

A single Cloudflare Worker (`nature-risk-proxy.workers.dev`) acts as a transparent forwarding proxy. The worker:
1. Receives a request from the browser with the target API URL as a query parameter
2. Validates the target URL against an allowlist (only the eight approved UK government domains)
3. Forwards the request with appropriate headers (including API keys stored as CF Worker secrets, never in client JS)
4. Returns the response with `Access-Control-Allow-Origin: *`

The browser's `DataCache` service (IndexedDB via `idb` library) stores responses keyed by URL + parameters with per-dataset TTLs:

| Dataset | TTL |
|---------|-----|
| LIDAR tiles (EA) | 7 days |
| OS Open Rivers | 24 hours |
| BGS Soilscapes | 7 days |
| EA RoFRS flood zones | 24 hours |
| UKCP18 climate projections | 7 days |
| UKHO Bathymetry | 7 days |
| Cefas Saltmarsh | 7 days |
| NTSLF tide gauges | 5 minutes |
| EA NCERM coastal erosion | 24 hours |

A cache-hit check occurs before every API call; the network is only reached on cache miss or TTL expiry.

### Consequences

**Good:**
- All nine API integrations work in the browser regardless of CORS policy
- API keys are stored as Cloudflare Worker secrets — never shipped in client-side JS
- 24h caching of LIDAR and bathymetry tiles makes the app fast for repeat users and resilient to API outages
- The 5-minute TTL for NTSLF tide gauges provides near-real-time coastal data without hammering the endpoint
- Offline presentation mode works for any data loaded in the previous TTL window

**Bad:**
- The Cloudflare Worker is a dependency; if it is unavailable, API calls fail (mitigated by IndexedDB cache)
- The allowlist in the Worker must be updated when new data sources are added
- IndexedDB storage quotas (typically 50–80% of available disk) can be exhausted by large LIDAR tile sets on low-storage devices; a cache eviction policy (LRU) is required

## Links

- Related ADRs: ADR-001 (Static Site Architecture), ADR-004 (Physics Engine)
- EA Environment Data: https://environment.data.gov.uk/
- OS Data Hub: https://osdatahub.os.uk/
- BGS Linked Data: https://www.bgs.ac.uk/geological-data/
- Cloudflare Workers: https://developers.cloudflare.com/workers/
