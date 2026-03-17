# Nature Risk — Deployment Guide

**Version:** 1.0
**Date:** 2026-03-17

---

## Table of Contents

1. [Overview](#1-overview)
2. [GitHub Pages Setup](#2-github-pages-setup)
3. [GitHub Secrets](#3-github-secrets)
4. [Cloudflare Worker Deployment](#4-cloudflare-worker-deployment)
5. [Custom Domain Setup](#5-custom-domain-setup)
6. [Monitoring](#6-monitoring)
7. [Updating](#7-updating)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Overview

Nature Risk consists of two independently deployed components:

| Component | Hosting | URL Pattern | Deploy Method |
|-----------|---------|-------------|---------------|
| **React SPA + Landing Page** | GitHub Pages | `https://<org>.github.io/nature-risk/` | Automatic on push to `main` via GitHub Actions |
| **CORS Proxy Worker** | Cloudflare Workers | `https://nature-risk-proxy.<account>.workers.dev/` | Manual via `wrangler deploy` |

The SPA is a static site with no server-side components. The Cloudflare Worker is a stateless edge function that proxies UK government data API requests and injects API keys.

### Deployment Architecture

```
┌─────────────────────────────────┐
│  Developer pushes to main       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  GitHub Actions                  │
│  1. Build WASM (Rust → wasm32)  │
│  2. Build SPA (Vite + React)    │
│  3. Assemble deploy directory   │
│  4. Deploy to GitHub Pages      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  GitHub Pages                    │
│  /           → Landing page     │
│  /app/       → React SPA       │
│  /adr/       → ADR documents   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Cloudflare Workers              │
│  (deployed separately)           │
│  /api/ea/*   → Environment Agency│
│  /api/os/*   → Ordnance Survey  │
│  /api/met/*  → Met Office       │
│  /api/ukho/* → UKHO ADMIRALTY   │
│  /api/claude/*→ Anthropic API   │
└─────────────────────────────────┘
```

---

## 2. GitHub Pages Setup

### Step 1 — Enable GitHub Pages

1. Navigate to your repository on GitHub: **Settings > Pages**
2. Under **Source**, select **GitHub Actions**
3. The workflow at `.github/workflows/deploy.yml` handles the rest automatically

### Step 2 — Verify the Workflow File

The CI/CD workflow is already configured in `.github/workflows/deploy.yml`. It:

1. Builds the Rust WASM physics engine using `wasm-pack`
2. Builds the React SPA using Vite
3. Assembles the deploy directory:
   - `/` — Landing page from `docs/index.html`
   - `/app/` — Vite build output (the React SPA)
   - `/adr/` — Architecture Decision Records from `docs/adr/`
4. Deploys to GitHub Pages using the official `actions/deploy-pages@v4` action

### Step 3 — Confirm Permissions

The workflow requires these repository permissions (set in the workflow YAML):

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

These are the default permissions for GitHub Actions deploying to Pages.

### Step 4 — Verify Deployment

After the first push to `main`, check:

- **Actions tab:** The "Build & Deploy to GitHub Pages" workflow should complete successfully
- **Pages URL:** Visit `https://<org>.github.io/nature-risk/` for the landing page
- **SPA URL:** Visit `https://<org>.github.io/nature-risk/app/` for the application

---

## 3. GitHub Secrets

The following secrets must be configured in your repository for the CI/CD pipeline.

Navigate to: **Settings > Secrets and variables > Actions > New repository secret**

| Secret Name | Required | Description |
|-------------|----------|-------------|
| `VITE_MAPTILER_KEY` | Yes | MapTiler API key for map tile rendering. Obtain from [maptiler.com](https://www.maptiler.com/) |
| `VITE_PROXY_URL` | Yes | The full URL of your deployed Cloudflare Worker (e.g., `https://nature-risk-proxy.your-account.workers.dev`) |

These secrets are injected as environment variables during the Vite build step:

```yaml
- name: Build application
  run: npm run build
  env:
    VITE_MAPTILER_KEY: ${{ secrets.VITE_MAPTILER_KEY }}
    VITE_PROXY_URL: ${{ secrets.VITE_PROXY_URL }}
```

### Obtaining a MapTiler Key

1. Create an account at [maptiler.com](https://www.maptiler.com/)
2. Navigate to **Account > API Keys**
3. Create a new key (the free tier is sufficient for development)
4. Restrict the key to your GitHub Pages domain for production use

---

## 4. Cloudflare Worker Deployment

### Step 1 — Create a Cloudflare Account

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Note your **Account ID** (visible on the Workers dashboard)

### Step 2 — Install Wrangler

```bash
npm install -g wrangler
```

### Step 3 — Authenticate

```bash
wrangler login
```

This opens a browser window for OAuth authentication.

### Step 4 — Review Configuration

The Worker configuration is in `worker/wrangler.toml`:

```toml
name = "nature-risk-proxy"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ALLOWED_ORIGIN = "https://jjohare.github.io"
```

Update `ALLOWED_ORIGIN` to match your GitHub Pages domain (e.g., `https://your-org.github.io`).

### Step 5 — Set Secrets

API keys for gated data sources are stored as Cloudflare Worker secrets — never in the source code.

```bash
cd worker

# Ordnance Survey Data Hub (required for OS API access)
wrangler secret put OS_DATA_HUB_KEY
# Paste your key when prompted

# Met Office Weather DataHub (required for rainfall/UKCP18 data)
wrangler secret put MET_OFFICE_KEY

# UKHO ADMIRALTY (required for bathymetry data — Phase 2)
wrangler secret put UKHO_KEY

# Anthropic Claude API (required for live advisory mode)
wrangler secret put ANTHROPIC_KEY
```

Each command prompts you to enter the secret value interactively.

### Step 6 — Deploy

```bash
cd worker
wrangler deploy
```

Wrangler will output the deployed URL:

```
Published nature-risk-proxy (1.23 sec)
  https://nature-risk-proxy.<account>.workers.dev
```

### Step 7 — Verify

```bash
curl https://nature-risk-proxy.<account>.workers.dev/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-03-17T10:30:00.000Z"
}
```

Test a proxied API call:

```bash
curl 'https://nature-risk-proxy.<account>.workers.dev/api/ea/arcgis/rest/services/EA/FloodMapForPlanningRiversAndSeaFloodZone3/MapServer/0/query?geometry=-2.0,52.0&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&outFields=*&f=json'
```

### Step 8 — Update GitHub Secret

After deploying the Worker, copy its URL and set it as the `VITE_PROXY_URL` GitHub secret (see [Section 3](#3-github-secrets)).

---

## 5. Custom Domain Setup

### GitHub Pages Custom Domain

1. Navigate to **Settings > Pages**
2. Enter your custom domain (e.g., `naturerisk.example.com`)
3. Configure DNS:
   - For an apex domain: Add `A` records pointing to GitHub Pages IPs (see [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))
   - For a subdomain: Add a `CNAME` record pointing to `<org>.github.io`
4. Enable **Enforce HTTPS**

### Cloudflare Worker Custom Domain

1. In the Cloudflare dashboard, navigate to **Workers & Pages > nature-risk-proxy > Settings > Domains & Routes**
2. Add a custom domain (e.g., `api.naturerisk.example.com`)
3. Cloudflare will automatically provision an SSL certificate

If using a custom domain for the Worker, update:
- The `VITE_PROXY_URL` GitHub secret
- The `ALLOWED_ORIGIN` variable in `worker/wrangler.toml`

---

## 6. Monitoring

### GitHub Pages

- **Deployment status:** Check the **Actions** tab for workflow run history and logs
- **Traffic:** GitHub does not provide built-in traffic analytics for Pages. Use a client-side analytics solution if required (ensure compliance with your privacy policy)

### Cloudflare Worker

Cloudflare provides built-in monitoring for Workers:

1. Navigate to **Workers & Pages > nature-risk-proxy > Analytics**
2. View:
   - **Requests per day/hour:** Total proxied requests
   - **Errors:** Failed requests (4xx, 5xx)
   - **Latency:** P50 and P99 response times
   - **CPU time:** Execution time consumed

### Logs

View real-time Worker logs during development:

```bash
wrangler tail
```

This streams `console.log()` output from the Worker, including the structured log line for each proxied request:

```
[proxy] GET /api/ea/arcgis/... -> https://environment.data.gov.uk | 200 | 342ms | 203.0.113.1
```

### Uptime

The Cloudflare Workers platform provides a 99.99% uptime SLA. For additional monitoring, configure an external health check service (e.g., UptimeRobot, Pingdom) pointing at:

```
https://nature-risk-proxy.<account>.workers.dev/health
```

---

## 7. Updating

### SPA Updates

Push to the `main` branch. The GitHub Actions workflow triggers automatically:

```bash
git add -A
git commit -m "Update: description of changes"
git push origin main
```

The new version will be live within 2–3 minutes (WASM build + Vite build + Pages deployment).

### Worker Updates

```bash
cd worker
# Make changes to src/index.ts
wrangler deploy
```

Worker deployments are typically live within seconds. There is no downtime during deployment.

### Updating Secrets

**GitHub secrets:**

Navigate to **Settings > Secrets and variables > Actions**, click the secret name, and update the value. The new value takes effect on the next workflow run.

**Worker secrets:**

```bash
wrangler secret put SECRET_NAME
# Enter new value when prompted
```

The new secret value takes effect immediately.

---

## 8. Troubleshooting

### Build Failures

**WASM build fails:**
- Ensure Rust stable toolchain and `wasm32-unknown-unknown` target are installed
- Check `physics-engine/Cargo.toml` for dependency version conflicts
- Run `cd physics-engine && cargo test` locally to isolate Rust compilation errors

**Vite build fails:**
- Ensure `src/wasm/` contains the WASM output (run `npm run build:wasm` first)
- Check that `VITE_MAPTILER_KEY` and `VITE_PROXY_URL` secrets are set in GitHub

### Worker Issues

**502 Bad Gateway responses:**
- The upstream API is down or unreachable. Check the specific API status page (e.g., EA, OS, Met Office)
- View Worker logs with `wrangler tail` for the upstream error message

**403 Origin not allowed:**
- The request's `Origin` header does not match `ALLOWED_ORIGIN` in `wrangler.toml`
- Update `ALLOWED_ORIGIN` to match your deployment domain and redeploy

**429 Rate Limited:**
- The client IP has exceeded 100 requests per minute
- This is expected behaviour; the client should retry after 60 seconds

**Missing API data:**
- Verify the relevant Worker secret is set: `wrangler secret list`
- Test the upstream API directly to confirm it is not the Worker's configuration

### Map Not Rendering

- Check that `VITE_MAPTILER_KEY` is set correctly
- Verify the MapTiler key is not restricted to a different domain
- Open the browser developer console and check for tile loading errors

### Demo Mode Unexpectedly Active

- Check that `VITE_PROXY_URL` is set correctly in both GitHub secrets and `.env.local`
- Verify the Worker is deployed and responding at the health endpoint
- Check the browser console for network errors when the advisory service attempts to call the proxy

---

*For user documentation, see the [User Guide](user-guide.md). For API details, see the [API Reference](api-reference.md). For development setup, see the [Developer Guide](developer-guide.md).*
