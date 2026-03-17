// ─── PDF Report Generator ───────────────────────────────────────────────────
// Generates an A4 PDF report from the current store state, including physics
// results, advisory narrative, data provenance, and the append-only event log.
//
// Referenced decisions: PRD §10 (export/reporting)

import jsPDF from 'jspdf';
import type {
  DomainEvent,
  PhysicsResult,
  InlandPhysicsResult,
  CoastalPhysicsResult,
  AdvisoryResult,
  AnalysisMode,
  UserIntent,
} from '@/types';
import { DISCLAIMER_TEXT } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportInput {
  mode: AnalysisMode | null;
  userIntent: UserIntent;
  assetLabel: string;
  interventionType: string;
  interventionAreaHa: number;
  physicsResult: PhysicsResult | null;
  advisoryResult: AdvisoryResult | null;
  eventLog: DomainEvent[];
  generatedAt: string;
}

// ─── Layout Constants ───────────────────────────────────────────────────────

const PAGE_WIDTH = 210;   // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 25;
const MARGIN_BOTTOM = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 6;
const HEADING_HEIGHT = 8;
const SECTION_GAP = 10;

const COLOURS = {
  primary: [30, 64, 106] as [number, number, number],     // Dark blue
  secondary: [60, 100, 140] as [number, number, number],
  text: [33, 37, 41] as [number, number, number],          // Near-black
  muted: [108, 117, 125] as [number, number, number],
  accent: [13, 110, 253] as [number, number, number],
  warning: [255, 193, 7] as [number, number, number],
  border: [206, 212, 218] as [number, number, number],
  bg: [248, 249, 250] as [number, number, number],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function isInland(result: PhysicsResult): result is InlandPhysicsResult {
  return 'peakFlowReductionPct' in result;
}

function isCoastal(result: PhysicsResult): result is CoastalPhysicsResult {
  return 'waveEnergyReductionPct' in result;
}

class PDFBuilder {
  private doc: jsPDF;
  private y: number;
  private pageNum: number;

  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.y = MARGIN_TOP;
    this.pageNum = 1;
  }

  private checkPageBreak(requiredSpace: number): void {
    if (this.y + requiredSpace > PAGE_HEIGHT - MARGIN_BOTTOM) {
      this.addFooter();
      this.doc.addPage();
      this.pageNum++;
      this.y = MARGIN_TOP;
      this.addPageHeader();
    }
  }

  private addFooter(): void {
    const doc = this.doc;
    // Disclaimer line
    doc.setFontSize(7);
    doc.setTextColor(...COLOURS.muted);
    const disclaimerLines = doc.splitTextToSize(DISCLAIMER_TEXT, CONTENT_WIDTH);
    const footerY = PAGE_HEIGHT - MARGIN_BOTTOM + 5;
    doc.text(disclaimerLines, MARGIN_LEFT, footerY);

    // Page number
    doc.setFontSize(8);
    doc.text(`Page ${this.pageNum}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 10, { align: 'right' });
  }

  private addPageHeader(): void {
    const doc = this.doc;
    doc.setFontSize(8);
    doc.setTextColor(...COLOURS.muted);
    doc.text('Nature Risk -- Pre-Feasibility Report', MARGIN_LEFT, 15);
    doc.setDrawColor(...COLOURS.border);
    doc.line(MARGIN_LEFT, 18, PAGE_WIDTH - MARGIN_RIGHT, 18);
    this.y = MARGIN_TOP;
  }

  addTitle(text: string): void {
    this.checkPageBreak(20);
    const doc = this.doc;
    doc.setFontSize(22);
    doc.setTextColor(...COLOURS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN_LEFT, this.y);
    this.y += 12;
  }

  addSubtitle(text: string): void {
    this.checkPageBreak(10);
    const doc = this.doc;
    doc.setFontSize(11);
    doc.setTextColor(...COLOURS.secondary);
    doc.setFont('helvetica', 'normal');
    doc.text(text, MARGIN_LEFT, this.y);
    this.y += 8;
  }

  addHeading(text: string): void {
    this.checkPageBreak(HEADING_HEIGHT + 4);
    this.y += 4;
    const doc = this.doc;
    doc.setFontSize(14);
    doc.setTextColor(...COLOURS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN_LEFT, this.y);
    this.y += HEADING_HEIGHT;
    // Underline
    doc.setDrawColor(...COLOURS.accent);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, this.y - 2, MARGIN_LEFT + 40, this.y - 2);
    this.y += 2;
  }

  addText(text: string, options?: { bold?: boolean; fontSize?: number; color?: [number, number, number] }): void {
    const doc = this.doc;
    const fontSize = options?.fontSize ?? 10;
    doc.setFontSize(fontSize);
    doc.setTextColor(...(options?.color ?? COLOURS.text));
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');

    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    const requiredHeight = lines.length * LINE_HEIGHT;
    this.checkPageBreak(requiredHeight);

    doc.text(lines, MARGIN_LEFT, this.y);
    this.y += requiredHeight;
  }

  addKeyValue(key: string, value: string): void {
    this.checkPageBreak(LINE_HEIGHT);
    const doc = this.doc;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOURS.text);
    doc.text(`${key}:`, MARGIN_LEFT, this.y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MARGIN_LEFT + 55, this.y);
    this.y += LINE_HEIGHT;
  }

  addSpacer(height = SECTION_GAP): void {
    this.y += height;
  }

  addHorizontalRule(): void {
    this.checkPageBreak(4);
    this.doc.setDrawColor(...COLOURS.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN_LEFT, this.y, PAGE_WIDTH - MARGIN_RIGHT, this.y);
    this.y += 4;
  }

  addTable(headers: string[], rows: string[][]): void {
    const doc = this.doc;
    const colWidth = CONTENT_WIDTH / headers.length;
    const rowHeight = 7;

    // Header row
    this.checkPageBreak(rowHeight * (rows.length + 2));
    doc.setFillColor(...COLOURS.primary);
    doc.rect(MARGIN_LEFT, this.y - 1, CONTENT_WIDTH, rowHeight, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => {
      doc.text(h, MARGIN_LEFT + i * colWidth + 2, this.y + 4);
    });
    this.y += rowHeight;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOURS.text);
    rows.forEach((row, rowIdx) => {
      this.checkPageBreak(rowHeight);
      if (rowIdx % 2 === 0) {
        doc.setFillColor(...COLOURS.bg);
        doc.rect(MARGIN_LEFT, this.y - 1, CONTENT_WIDTH, rowHeight, 'F');
      }
      doc.setFontSize(8);
      row.forEach((cell, i) => {
        const truncated = cell.length > 40 ? cell.slice(0, 37) + '...' : cell;
        doc.text(truncated, MARGIN_LEFT + i * colWidth + 2, this.y + 4);
      });
      this.y += rowHeight;
    });
    this.y += 4;
  }

  addMapPlaceholder(): void {
    this.checkPageBreak(60);
    const doc = this.doc;
    doc.setDrawColor(...COLOURS.border);
    doc.setFillColor(...COLOURS.bg);
    doc.roundedRect(MARGIN_LEFT, this.y, CONTENT_WIDTH, 50, 3, 3, 'FD');
    doc.setFontSize(12);
    doc.setTextColor(...COLOURS.muted);
    doc.text('[Map Snapshot]', PAGE_WIDTH / 2, this.y + 25, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Map capture available in interactive session', PAGE_WIDTH / 2, this.y + 33, { align: 'center' });
    this.y += 55;
  }

  finalize(): void {
    this.addFooter();
  }

  toBlob(): Blob {
    return this.doc.output('blob');
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a professional A4 PDF report from the current analysis state.
 * Returns a Blob suitable for download via URL.createObjectURL().
 */
export async function generateReport(input: ReportInput): Promise<Blob> {
  const pdf = new PDFBuilder();

  // ── Title Page Content
  pdf.addTitle('Nature Risk');
  pdf.addSubtitle('Pre-Feasibility Assessment Report');
  pdf.addSpacer(6);
  pdf.addKeyValue('Generated', new Date(input.generatedAt).toLocaleString('en-GB'));
  pdf.addKeyValue('Analysis Mode', input.mode ?? 'Not classified');
  pdf.addKeyValue('User Intent', input.userIntent === 'asset_manager' ? 'Asset Manager' : 'Project Developer');
  pdf.addKeyValue('Asset', input.assetLabel || 'Not specified');
  pdf.addKeyValue('Intervention', input.interventionType || 'Not specified');
  pdf.addKeyValue('Area', input.interventionAreaHa ? `${input.interventionAreaHa} ha` : 'Not specified');

  pdf.addSpacer();
  pdf.addHorizontalRule();

  // ── Map Snapshot Placeholder
  pdf.addHeading('Site Location');
  pdf.addMapPlaceholder();

  // ── Physics Results
  if (input.physicsResult) {
    pdf.addHeading('Physics Engine Results');
    pdf.addText(`Model: ${input.physicsResult.physicsModel}`, { fontSize: 9, color: COLOURS.muted });
    pdf.addText(`Confidence: ${input.physicsResult.confidence.level} (+/- ${input.physicsResult.confidence.uncertaintyPct}%)`, { fontSize: 9 });
    pdf.addSpacer(4);

    if (isInland(input.physicsResult)) {
      pdf.addKeyValue('Peak Flow Reduction', `${input.physicsResult.peakFlowReductionPct}%`);
      pdf.addKeyValue('Flood Height Reduction', `${input.physicsResult.floodHeightReductionM} m`);
      pdf.addKeyValue('Peak Delay', `${input.physicsResult.peakDelayHrs} hrs`);
      pdf.addKeyValue('Volume Attenuated', `${input.physicsResult.volumeAttenuatedM3} m3`);
    } else if (isCoastal(input.physicsResult)) {
      pdf.addKeyValue('Wave Energy Reduction', `${input.physicsResult.waveEnergyReductionPct}%`);
      pdf.addKeyValue('Storm Surge Reduction', `${input.physicsResult.stormSurgeReductionM} m`);
      pdf.addKeyValue('Erosion Delta (25yr)', `${input.physicsResult.erosionDelta25yrM} m`);
      pdf.addKeyValue('Habitat Suitability', `${input.physicsResult.habitatSuitabilityScore}`);
      pdf.addKeyValue('Maturation Period', `${input.physicsResult.maturationYears} years`);
    }

    // Data sources table
    pdf.addSpacer(4);
    pdf.addText('Data Sources', { bold: true });
    const dsHeaders = ['Source', 'Resolution', 'Licence'];
    const dsRows = input.physicsResult.confidence.dataSources.map((ds) => [
      ds.name,
      ds.resolution ?? '-',
      ds.licence,
    ]);
    pdf.addTable(dsHeaders, dsRows);
  }

  // ── Advisory Narrative
  if (input.advisoryResult) {
    pdf.addHeading('Advisory Narrative');

    // Strip markdown formatting for PDF (basic)
    const plainNarrative = input.advisoryResult.narrative
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^>\s*/gm, '')
      .replace(/\|[^|]*\|/g, '')  // Strip table rows
      .replace(/^-{3,}/gm, '')
      .trim();

    pdf.addText(plainNarrative, { fontSize: 9 });

    if (input.advisoryResult.scaleWarnings.length > 0) {
      pdf.addSpacer(4);
      pdf.addText('Scale Warnings:', { bold: true, color: COLOURS.warning });
      input.advisoryResult.scaleWarnings.forEach((w) => {
        pdf.addText(`  - ${w}`, { fontSize: 9 });
      });
    }

    pdf.addSpacer(4);
    pdf.addText(`Confidence: ${input.advisoryResult.confidenceSummary}`, { fontSize: 9, color: COLOURS.muted });
  }

  // ── Event Log Audit Trail
  if (input.eventLog.length > 0) {
    pdf.addHeading('Audit Trail (Event Log)');
    pdf.addText(
      `${input.eventLog.length} events recorded during this analysis session.`,
      { fontSize: 9, color: COLOURS.muted },
    );
    pdf.addSpacer(4);

    const eventHeaders = ['Time', 'Event Type', 'Details'];
    const eventRows = input.eventLog.map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString('en-GB');
      const details = Object.entries(e.payload)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ');
      return [time, e.type, details.slice(0, 60)];
    });
    pdf.addTable(eventHeaders, eventRows);
  }

  // ── Disclaimer (final section)
  pdf.addSpacer();
  pdf.addHorizontalRule();
  pdf.addHeading('Disclaimer');
  pdf.addText(DISCLAIMER_TEXT, { fontSize: 9, color: COLOURS.muted });

  pdf.finalize();
  return pdf.toBlob();
}

/**
 * Convenience wrapper: reads the current store state and generates a PDF.
 * Used by components that call `generatePdf()` without arguments.
 */
export async function generatePdf(): Promise<Blob> {
  const { useNatureRiskStore } = await import('@/store');
  const state = useNatureRiskStore.getState();
  const input = extractReportInput(state);
  return generateReport(input);
}

/**
 * Convenience function to extract report input from a store-like object.
 */
export function extractReportInput(store: {
  mode: AnalysisMode | null;
  userIntent: UserIntent;
  assetPin: { asset: { label: string } } | null;
  interventionPolygon: { interventionType: string; areaHa: number } | null;
  physicsResult: PhysicsResult | null;
  advisoryResult: AdvisoryResult | null;
  eventLog: DomainEvent[];
}): ReportInput {
  return {
    mode: store.mode,
    userIntent: store.userIntent,
    assetLabel: store.assetPin?.asset.label ?? '',
    interventionType: store.interventionPolygon?.interventionType ?? '',
    interventionAreaHa: store.interventionPolygon?.areaHa ?? 0,
    physicsResult: store.physicsResult,
    advisoryResult: store.advisoryResult,
    eventLog: store.eventLog,
    generatedAt: new Date().toISOString(),
  };
}
