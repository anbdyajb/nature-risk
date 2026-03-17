// ─── AdvisorConfig ──────────────────────────────────────────────────────────
// Collapsible config panel for API key and proxy URL.
// Shows Live/Demo mode status badge.

import { useState, useCallback } from 'react';
import { useNatureRiskStore } from '@/store';

export function AdvisorConfig() {
  const advisorMode = useNatureRiskStore((s) => s.advisorMode);
  const configureAdvisor = useNatureRiskStore((s) => s.configureAdvisor);

  const [apiKey, setApiKey] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    configureAdvisor(apiKey.trim() || undefined, proxyUrl.trim() || undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKey, proxyUrl, configureAdvisor]);

  const isLive = advisorMode === 'live';

  return (
    <div
      style={{
        marginTop: 8,
        padding: '12px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          Advisor Mode
        </span>
        <span
          role="status"
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            fontFamily: 'var(--mono)',
            padding: '3px 10px',
            borderRadius: 99,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            background: isLive
              ? 'rgba(52,211,153,0.12)'
              : 'rgba(245,158,11,0.12)',
            border: `1px solid ${isLive ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
            color: isLive ? 'var(--green)' : 'var(--amber)',
          }}
        >
          {isLive ? 'Live Mode' : 'Demo Mode'}
        </span>
      </div>

      <div>
        <label
          htmlFor="advisor-api-key"
          style={{
            display: 'block',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          API Key
        </label>
        <input
          id="advisor-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(10,22,40,0.5)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
            fontFamily: 'var(--mono)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glow)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        />
      </div>

      <div>
        <label
          htmlFor="advisor-proxy-url"
          style={{
            display: 'block',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          Proxy URL (optional)
        </label>
        <input
          id="advisor-proxy-url"
          type="url"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="https://your-proxy.example.com/v1"
          autoComplete="off"
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(10,22,40,0.5)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
            fontFamily: 'var(--font)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glow)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          padding: '8px 14px',
          background: 'linear-gradient(135deg, var(--green-dim), #059669)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          color: '#ffffff',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font)',
          transition: 'all 0.2s ease',
        }}
      >
        {saved ? 'Saved' : 'Save Configuration'}
      </button>

      <div
        style={{
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          lineHeight: 1.4,
          padding: '6px 8px',
          background: 'rgba(10,22,40,0.4)',
          border: '1px solid rgba(71,85,105,0.2)',
          borderRadius: 4,
        }}
      >
        API keys are stored in sessionStorage only and are cleared when the
        browser tab is closed. They are never sent to any server other than the
        configured API endpoint or proxy.
      </div>
    </div>
  );
}
