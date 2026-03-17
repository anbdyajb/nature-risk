# ADR-002: Mapping Library

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

The Nature Risk UI requires a high-performance interactive GIS map on the right-hand side of the Co-Pilot + Map split-screen layout. The map must support: vector tile rendering, polygon drawing for the Project Developer mode, asset pin placement for the Asset Manager mode, LIDAR raster overlay, flood risk layer visualisation, and UK Ordnance Survey raster tiles. The chosen library must run in the browser as part of the static site (no server-side rendering of map tiles).

## Decision Drivers

- WebGL performance for LIDAR raster overlays and large flood polygon datasets
- Support for UK Ordnance Survey raster and vector tile endpoints
- Polygon drawing and geometry editing for Project Developer mode
- Asset pin placement and popups for Asset Manager mode
- Free-tier or open-source licensing compatible with a public GH Pages project
- Active maintenance and TypeScript typings

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Mapbox GL JS (free tier) + MapLibre GL fallback** | WebGL rendering, vector tiles, OS tile support, polygon drawing via Mapbox Draw, TypeScript types, large community | Mapbox requires API key; free tier has usage limits; proprietary renderer |
| **Leaflet.js** | Lightweight (~42 KB), well-known, huge plugin ecosystem, no API key | Canvas/SVG renderer (no WebGL), poor performance with large LIDAR rasters, limited vector tile support without plugins |
| **Deck.gl (Uber)** | Exceptional WebGL performance, data-layer architecture, great for large point clouds | Heavier bundle, steeper learning curve, no built-in UI controls, requires a base map layer separately |
| **OpenLayers** | Fully open-source, strong OGC/WMS/WFS support | Larger API surface, older architecture, less momentum than Mapbox GL ecosystem |

## Decision Outcome

**Chosen option:** Mapbox GL JS (free tier) with MapLibre GL JS as the open-source fallback

Primary rendering uses Mapbox GL JS because it provides the best out-of-the-box support for OS vector tiles, WebGL LIDAR raster overlays, and the `@mapbox/mapbox-gl-draw` plugin for polygon drawing. The Mapbox free tier (50,000 map loads/month) is sufficient for MVP usage.

MapLibre GL JS is maintained as a drop-in fallback: because MapLibre is a community fork of Mapbox GL JS v1, the API is identical. Switching is a single import change. MapLibre is used in CI test environments and recommended for deployments that reach Mapbox free-tier limits.

OS raster tiles are consumed via the OS Maps API XYZ endpoint, which is compatible with both Mapbox GL and MapLibre as a raster-tile source.

### Consequences

**Good:**
- Single WebGL-accelerated renderer handles LIDAR rasters, flood polygons, and OS base tiles without performance degradation
- `@mapbox/mapbox-gl-draw` provides polygon drawing and editing with minimal custom code
- MapLibre fallback guarantees the project can go fully open-source at any point
- TypeScript type definitions are available for both libraries
- OS vector tile support is native via the standard XYZ/MVT protocol

**Bad:**
- Mapbox GL JS v2+ is not open-source; if API key usage exceeds free tier, a billing account is required
- Bundle size is larger than Leaflet (~880 KB gzipped vs ~42 KB)
- Mapbox GL Draw plugin requires careful z-index management when layering LIDAR overlays

## Links

- Related ADRs: ADR-001 (Static Site Architecture), ADR-003 (UK Data API Strategy)
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/
- MapLibre GL JS: https://maplibre.org/
- OS Maps API: https://developer.ordnancesurvey.co.uk/os-maps-api
- Mapbox GL Draw: https://github.com/mapbox/mapbox-gl-draw
