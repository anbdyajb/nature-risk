// ─── ChatMessage ────────────────────────────────────────────────────────────
// Renders a single chat message (user, assistant, or system).
// Supports markdown rendering and inline physics result widgets.

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { RiskDeltaDial } from '@/components/Widgets/RiskDeltaDial';
import { ConfidenceBadge } from '@/components/Widgets/ConfidenceBadge';
import { HydrographChart } from '@/components/Widgets/HydrographChart';
import { UncertaintyRange } from '@/components/Widgets/UncertaintyRange';
import type {
  ChatMessage as ChatMessageType,
  InlandPhysicsResult,
  CoastalPhysicsResult,
} from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function isInlandResult(
  result: InlandPhysicsResult | CoastalPhysicsResult,
): result is InlandPhysicsResult {
  return 'peakFlowReductionPct' in result;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { role, content, timestamp, physicsResult } = message;

  const htmlContent = useMemo(() => {
    if (!content) return '';
    marked.setOptions({ breaks: true, gfm: true });
    const rawHtml = marked.parse(content) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [content]);

  const isUser = role === 'user';
  const isSystem = role === 'system';

  const time = new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          padding: '10px 14px',
          borderRadius: isUser
            ? '12px 12px 4px 12px'
            : '12px 12px 12px 4px',
          background: isUser
            ? 'rgba(59,130,246,0.15)'
            : isSystem
              ? 'rgba(71,85,105,0.2)'
              : 'var(--bg-elevated)',
          border: `1px solid ${
            isUser
              ? 'rgba(59,130,246,0.3)'
              : isSystem
                ? 'rgba(71,85,105,0.3)'
                : 'var(--border-subtle)'
          }`,
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="markdown-content"
          style={{ fontSize: '0.83rem', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {physicsResult && (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {isInlandResult(physicsResult) ? (
              <InlandWidgets result={physicsResult} />
            ) : (
              <CoastalWidgets result={physicsResult} />
            )}
          </div>
        )}

        {physicsResult?.confidence && (
          <div style={{ marginTop: 8 }}>
            <ConfidenceBadge confidence={physicsResult.confidence} />
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          padding: '0 4px',
        }}
      >
        {time}
      </span>
    </div>
  );
}

function InlandWidgets({ result }: { result: InlandPhysicsResult }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RiskDeltaDial
          beforeValue={100}
          afterValue={100 - result.peakFlowReductionPct}
          unit="%"
          label="Peak Flow"
        />
        <RiskDeltaDial
          beforeValue={result.floodHeightReductionM + 1}
          afterValue={1}
          unit="m"
          label="Flood Height"
        />
      </div>

      <UncertaintyRange
        value={result.peakFlowReductionPct}
        uncertainty={result.confidence.uncertaintyPct}
        unit="%"
        label="Peak flow reduction"
      />

      <HydrographChart
        beforePeak={100}
        afterPeak={100 - result.peakFlowReductionPct}
        peakDelay={result.peakDelayHrs}
        duration={24}
      />
    </>
  );
}

function CoastalWidgets({ result }: { result: CoastalPhysicsResult }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RiskDeltaDial
          beforeValue={100}
          afterValue={100 - result.waveEnergyReductionPct}
          unit="%"
          label="Wave Energy"
        />
        <RiskDeltaDial
          beforeValue={result.stormSurgeReductionM + 1}
          afterValue={1}
          unit="m"
          label="Storm Surge"
        />
      </div>

      <UncertaintyRange
        value={result.waveEnergyReductionPct}
        uncertainty={result.confidence.uncertaintyPct}
        unit="%"
        label="Wave energy reduction"
      />
    </>
  );
}
