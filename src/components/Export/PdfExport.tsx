// ─── PdfExport ──────────────────────────────────────────────────────────────
// "Export PDF" button that calls the pdfGenerator service.
// Shows loading spinner during generation, downloads the blob on completion.

import { useState, useCallback } from 'react';
import { useNatureRiskStore } from '@/store';
import { generateReport, extractReportInput } from '@/services/pdfGenerator';

export function PdfExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = useNatureRiskStore((s) => s.messages);
  const hasResults = messages.some((m) => m.physicsResult || m.advisoryResult);

  const handleExport = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const state = useNatureRiskStore.getState();
      const input = extractReportInput(state);
      const blob = await generateReport(input);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nature-risk-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PDF generation failed';
      setError(message);
      console.error('PDF export error:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={!hasResults || loading}
        aria-label="Export analysis as PDF report"
        style={{
          width: '100%',
          padding: '10px 16px',
          background:
            'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(59,130,246,0.08))',
          border: '1px solid var(--border-glow)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--green)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: !hasResults || loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: !hasResults || loading ? 0.4 : 1,
        }}
      >
        {loading ? (
          <>
            <div
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid rgba(52,211,153,0.3)',
                borderTopColor: 'var(--green)',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            Generating...
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M12 16l-4-4h3V4h2v8h3l-4 4z" fill="currentColor" />
              <path d="M4 18h16v2H4v-2z" fill="currentColor" />
            </svg>
            Export Board PDF
          </>
        )}
      </button>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 6,
            fontSize: '0.72rem',
            color: 'var(--red)',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
