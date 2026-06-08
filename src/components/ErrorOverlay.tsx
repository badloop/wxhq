import { useState, useSyncExternalStore } from 'react';
import {
  subscribeErrors,
  getErrors,
  dismissError,
  clearErrors,
  type AppError,
  type ErrorSeverity,
} from '../services/errorBus';

const SEVERITY_COLOR: Record<ErrorSeverity, string> = {
  error: '#ff3b5c',
  warning: '#ffaa00',
  info: '#00f0ff',
};

/**
 * Global error overlay — a stacked set of toasts (top-right) that surfaces any
 * failure reported to the {@link errorBus} (backend/API calls, radar tile load
 * errors, etc.). Fully decoupled from app state; subscribes directly to the bus.
 */
export function ErrorOverlay() {
  const errors = useSyncExternalStore(subscribeErrors, getErrors, getErrors);

  if (errors.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 'min(360px, calc(100vw - 24px))',
        fontFamily: 'monospace',
        pointerEvents: 'none', // let the gaps pass clicks through to the map
      }}
    >
      {errors.length > 1 && (
        <button
          onClick={clearErrors}
          style={{
            pointerEvents: 'auto',
            alignSelf: 'flex-end',
            background: 'rgba(26, 26, 46, 0.96)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            color: '#00f0ff',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Clear all ({errors.length})
        </button>
      )}
      {errors.map((e) => (
        <ErrorToast key={e.id} error={e} />
      ))}
    </div>
  );
}

function ErrorToast({ error }: { error: AppError }) {
  const [expanded, setExpanded] = useState(false);
  const color = SEVERITY_COLOR[error.severity];
  const time = new Date(error.lastSeen).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'rgba(26, 26, 46, 0.96)',
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        padding: '8px 10px',
        color: '#e6e6f0',
        boxShadow: `0 0 10px ${color}33, 0 2px 8px rgba(0,0,0,0.5)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            color,
            fontSize: 10,
            fontWeight: 'bold',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {error.source}
        </span>
        {error.count > 1 && (
          <span
            style={{
              background: color,
              color: '#0a0a0f',
              fontSize: 10,
              fontWeight: 'bold',
              borderRadius: 8,
              padding: '0 6px',
              lineHeight: '15px',
            }}
            title={`Occurred ${error.count} times`}
          >
            ×{error.count}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: '#7780a0', fontSize: 10 }}>{time}</span>
        <button
          onClick={() => dismissError(error.id)}
          title="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9aa0c0',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12.5, color: '#fff', marginTop: 4, wordBreak: 'break-word' }}>
        {error.message}
      </div>

      {error.detail && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              color,
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 10,
              padding: 0,
              marginTop: 4,
            }}
          >
            {expanded ? '▾ hide details' : '▸ details'}
          </button>
          {expanded && (
            <pre
              style={{
                margin: '4px 0 0',
                fontSize: 10.5,
                color: '#9aa0c0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 120,
                overflow: 'auto',
              }}
            >
              {error.detail}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
