# ADR-008: Deployment Pipeline

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

Nature Risk is a static GH Pages application (ADR-001). The team needs a reliable, automated deployment pipeline that:

- Builds and validates the application on every push and pull request
- Deploys to GitHub Pages on merge to `main`
- Provides deploy previews for pull requests so reviewers can test changes in a live environment
- Runs the AssemblyScript WASM build step (ADR-004) before the TypeScript/React build
- Runs tests and linting before any deploy
- Enforces branch protection: no direct pushes to `main`

## Decision Drivers

- GitHub Actions is already configured in the repository (`f042ffa merged prd`)
- GitHub Pages is the chosen hosting (ADR-001); native GH Actions integration avoids external CI services
- The WASM build step (AssemblyScript compiler `asc`) must precede the Vite/React build
- Deploy previews must be accessible via a URL posted as a PR comment for stakeholder review
- Zero additional tooling cost: GitHub Actions free tier (2,000 minutes/month for public repos) is sufficient
- Branch protection + required status checks enforce quality gates

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **GitHub Actions deploying `docs/` folder** | Native GH Pages integration, already configured, free, branch protection support, PR comment deploy previews via `actions/deploy-pages` | Deploy previews require a workaround (separate Pages environment or Netlify/CF Pages for PRs) |
| **Netlify** | Excellent deploy previews, instant deploys, drag-and-drop | External service; free tier has bandwidth limits; diverges from GH Pages hosting strategy |
| **Vercel** | Deploy previews, serverless functions if needed | External service; free tier restrictions; unnecessary complexity for static site |
| **Manual deploy (git push to gh-pages branch)** | Simple | No automation, no validation, no deploy previews; error-prone |

## Decision Outcome

**Chosen option:** GitHub Actions deploying the `docs/` output folder

The pipeline consists of two workflows:

**Workflow 1: `ci.yml` (runs on every push and PR)**
```
Trigger: push (all branches), pull_request (target: main)

Jobs:
  1. build-and-test
     - checkout
     - setup Node 20
     - npm ci
     - asc (AssemblyScript → WASM)    # Physics engine build (ADR-004)
     - npm run lint
     - npm test                        # Vitest unit + integration tests
     - npm run build                   # Vite production build → dist/

  2. preview-deploy (PRs only, depends on build-and-test)
     - Upload dist/ as artifact
     - Deploy to GitHub Pages preview environment
     - Post preview URL as PR comment via github-script
```

**Workflow 2: `deploy.yml` (runs on push to `main` only)**
```
Trigger: push to main (after CI passes)

Jobs:
  1. deploy (depends on ci.yml passing)
     - checkout
     - npm ci
     - asc (AssemblyScript → WASM)
     - npm run build → dist/
     - actions/deploy-pages → GitHub Pages production
```

**Branch protection rules on `main`:**
- Require pull request with at least 1 approving review
- Require status checks: `build-and-test` must pass
- Restrict direct pushes (no force push)
- Require branches to be up to date before merging

**Deploy preview strategy:** GitHub Pages supports multiple deployment environments. PR preview deployments are pushed to a `preview/pr-{number}` path on the `gh-pages` branch and the URL is posted to the PR thread via `actions/github-script`. Previews are cleaned up (branch deleted) on PR close.

The `docs/` folder in the repository root is reserved for the ADR documentation (this file). The Vite build outputs to `dist/` and GitHub Pages is configured to deploy from the `gh-pages` branch (populated by the workflow), not from `docs/`.

### Consequences

**Good:**
- Zero additional tooling cost; GitHub Actions free tier covers expected build volumes
- The AssemblyScript WASM build step is a first-class pipeline stage — physics engine compilation failures block deployment
- Branch protection prevents untested code from reaching production
- Deploy previews allow non-technical stakeholders to review UI changes before merge
- Workflow YAML lives in `.github/workflows/` — version-controlled alongside the application code

**Bad:**
- GitHub Actions cold start adds ~30s to every job; total pipeline time is approximately 3–5 minutes for a full build
- Deploy previews on GH Pages are less seamless than Netlify/Vercel; the PR comment approach requires a GitHub token with `pages:write` permission
- If the WASM build step introduces a breaking change, rollback requires a revert commit and re-deploy (no instant rollback mechanism)

## Links

- Related ADRs: ADR-001 (Static Site Architecture), ADR-004 (Physics Engine)
- GitHub Actions: https://docs.github.com/en/actions
- GitHub Pages deploy action: https://github.com/actions/deploy-pages
- AssemblyScript compiler: https://www.assemblyscript.org/compiler.html
