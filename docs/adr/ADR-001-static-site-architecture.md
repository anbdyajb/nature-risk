# ADR-001: Static Site Architecture (GH Pages)

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

The Nature Risk project needs a hosting strategy for its geospatial risk quantification engine. The product is a dual-mode tool (Asset Manager and Project Developer) that calls UK government APIs to quantify how natural capital interventions reduce climate risks to UK corporate assets. The team needs zero operational overhead for MVP, and the product has no authentication or user data persistence requirements at this stage.

## Decision Drivers

- Zero infrastructure cost for MVP and ongoing maintenance
- Instant deployment with no server provisioning
- No backend authentication required for Phase 1
- Public UK government data APIs are the data source (no private data store needed)
- GitHub is already the source-of-truth repository; GH Pages is a natural fit
- Must be demonstrable to stakeholders without complex setup

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Static GH Pages + Cloudflare Workers CORS proxy** | Zero hosting cost, auto-deploy from repo, CDN-backed, no server maintenance | UK government APIs lack CORS headers requiring a proxy; IndexedDB caching adds client complexity |
| **Server-rendered app (Node/Next.js on Vercel/Railway)** | Full server control, CORS handled server-side, SSR for SEO | Monthly hosting cost, requires devops, adds infra complexity for MVP |
| **Serverless (AWS Lambda / Azure Functions)** | Scalable, pay-per-use, handles CORS | Cold starts, vendor lock-in, requires cloud account, more complex CI/CD |

## Decision Outcome

**Chosen option:** Static GH Pages with client-side API calls + Cloudflare Workers for CORS proxy

The front-end is a fully static single-page application (SPA) deployed to GitHub Pages from the `docs/` folder (or a dedicated `gh-pages` branch). A lightweight Cloudflare Worker acts as a transparent CORS proxy for UK government APIs (EA, OS, BGS, UKHO, Cefas, NTSLF) that do not set `Access-Control-Allow-Origin` headers. All API responses are cached in the browser's IndexedDB with a 24-hour TTL to reduce latency and protect against upstream rate limits.

### Consequences

**Good:**
- No hosting bill; GH Pages is free for public repositories
- Deployment is a `git push`; GitHub Actions handles the rest
- The Cloudflare Worker free tier (100,000 requests/day) is sufficient for MVP usage volumes
- The static architecture enforces a clean separation between UI, physics engine, and LLM advisory layer
- No backend means no attack surface for data exfiltration at MVP

**Bad:**
- All computation happens in the browser; large LIDAR or bathymetry datasets may stress memory on low-end devices
- The Cloudflare Worker introduces a single point of failure for API connectivity (mitigated by IndexedDB cache)
- Offline-first is limited to cached data; fresh API calls require connectivity

## Links

- Related ADRs: ADR-003 (UK Data API Strategy), ADR-008 (Deployment Pipeline)
- EA Flood Risk API: https://environment.data.gov.uk/flood-monitoring/doc/reference
- OS Maps API: https://developer.ordnancesurvey.co.uk/os-maps-api
