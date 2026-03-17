# ADR-006: Report Generation

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

Nature Risk must produce a downloadable PDF report for each analysis session. The report must include:

- Executive summary (narrative, LLM-generated from physics outputs)
- Asset details (location, sector, asset value if provided)
- Risk analysis results (flood return periods, damage probabilities, depth-damage curves)
- Natural capital intervention recommendations (ranked restoration sites or protected assets)
- Confidence scores and uncertainty ranges for all quantitative outputs
- Source citations (UK government APIs, physics model references)
- A static map image showing asset location, intervention polygons, and flood/coastal risk layers

The product is a static GH Pages site (ADR-001). There is no server to generate PDFs server-side. The report must be generated entirely in the browser and offered as a file download.

## Decision Drivers

- Static site constraint: no server-side rendering or PDF generation service
- Reports must be self-contained: usable offline after download
- Map snapshot must be captured at the exact zoom/layer state the user configured
- Reports must include tabular physics results with proper formatting
- Must work without a print dialog — user clicks "Download Report" and receives a `.pdf` file
- Must function on Chrome, Firefox, and Safari (the main browser targets)

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Client-side PDF via jsPDF + html2canvas** | No server required, works in static site, active libraries, map snapshot via html2canvas, reasonable TypeScript support | html2canvas has rendering quirks with WebGL (map canvas must be pre-exported); PDF fidelity depends on browser canvas rendering |
| **Browser print-to-PDF (window.print + CSS @media print)** | No library needed, perfect rendering fidelity | Requires user interaction with browser print dialog; cannot programmatically save to file; inconsistent page breaks across browsers |
| **Puppeteer/headless Chrome on a server** | Perfect rendering, reliable PDF output | Requires a server; violates static site constraint (ADR-001) |
| **PDF generation via Cloudflare Worker (html-pdf-node)** | Keeps static site constraint, server renders PDF | Cloudflare Workers do not support headless Chrome; would require a separate Deno/Node service |
| **react-pdf (PDF as React components)** | Programmatic layout, no html2canvas quirks | Requires rebuilding report layout in a separate component tree; map image still requires canvas export |

## Decision Outcome

**Chosen option:** Client-side PDF via jsPDF + html2canvas

The report generation pipeline:

1. **Map snapshot:** Before PDF generation begins, the MapLibre/Mapbox GL canvas is exported to a PNG via `map.getCanvas().toDataURL('image/png')`. This must be called while the map is still rendered (before any UI state change).

2. **Report HTML assembly:** A hidden `<div id="report-container">` is populated with the full report structure (executive summary, tables, citations). This element uses print-optimised CSS (no shadows, high-contrast, A4 proportions).

3. **html2canvas capture:** `html2canvas(reportContainer)` renders the hidden div to a canvas. The map PNG is inserted as an `<img>` element (not a live WebGL canvas) to avoid WebGL snapshot issues.

4. **jsPDF assembly:** The canvas image data is added to a jsPDF document. Multi-page reports are handled by slicing the canvas into A4-height segments. Table data (physics results) is rendered using `jspdf-autotable` for clean column alignment.

5. **File download:** `pdf.save('nature-risk-report-YYYY-MM-DD.pdf')` triggers a browser download without a dialog.

The report template is defined in `/src/reports/ReportTemplate.tsx` and is kept under 500 lines (project file size limit).

### Consequences

**Good:**
- No server required; satisfies the static site constraint
- Users receive a single downloadable `.pdf` with no print dialog interaction
- Map snapshot is captured at the exact state the user configured (zoom, layers, drawn polygons)
- jspdf-autotable produces well-aligned tables for physics output data
- The report is self-contained and usable offline after download

**Bad:**
- html2canvas cannot render WebGL content directly; the map canvas must be exported to PNG before the report div is constructed — timing must be managed carefully
- html2canvas has known issues with CSS `backdrop-filter`, `clip-path`, and web fonts; the report template must avoid these properties
- Large reports (many restoration sites, long narrative) may produce PDFs exceeding 5 MB due to canvas-to-image conversion; image quality settings must be tuned

## Links

- Related ADRs: ADR-001 (Static Site Architecture), ADR-004 (Physics Engine), ADR-005 (LLM Integration)
- jsPDF: https://github.com/parallax/jsPDF
- html2canvas: https://html2canvas.hertzen.com/
- jspdf-autotable: https://github.com/simonbengtsson/jsPDF-AutoTable
