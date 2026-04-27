import { useEffect, useRef } from 'react';
import type { IEMBotMessage } from '../../types/iembot';
import type { Dispatch } from 'react';
import type { AppAction } from '../../context/AppReducer';

interface MessageListProps {
  messages: IEMBotMessage[];
  filter: string;
  dispatch: Dispatch<AppAction>;
}

const FONT = "monospace";
const BASE_SIZE = 13;

/** Convert UTC timestamp string to US Central */
function toCentral(utcStr: string): string {
  const d = new Date(utcStr.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}

/** Strip XML namespace wrapper and sanitize script tags */
function sanitizeHtml(raw: string): string {
  let html = raw;
  html = html.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return html;
}

export function MessageList({ messages, filter, dispatch }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reverse: messages come in newest-first, we want newest at bottom
  const chronological = [...messages].reverse();

  const filtered = filter
    ? chronological.filter(
        (m) =>
          m.message.toLowerCase().includes(filter.toLowerCase()) ||
          m.productId.toLowerCase().includes(filter.toLowerCase())
      )
    : chronological;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered.length]);

  if (filtered.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#666', fontFamily: FONT, fontSize: BASE_SIZE }}>
        {filter ? 'No messages match filter' : 'No messages yet -- waiting for data...'}
      </div>
    );
  }

  return (
    <div>
      {filtered.map((msg, i) => (
        <div
          key={msg.seqnum}
          style={{
            padding: '8px 12px',
            borderLeft: msg.read ? '3px solid transparent' : '3px solid #ff00aa',
            background: i % 2 === 0 ? 'rgba(26, 26, 46, 0.5)' : 'transparent',
            borderBottom: '1px solid rgba(0, 240, 255, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: BASE_SIZE - 1, color: '#00f0ff' }}>
              {toCentral(msg.timestamp)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: BASE_SIZE - 2,
                  color: '#888',
                  fontFamily: FONT,
                  background: 'rgba(0, 240, 255, 0.05)',
                  padding: '1px 6px',
                  borderRadius: 3,
                }}
              >
                {msg.room}
              </span>
              <button
                onClick={() => dispatch({ type: 'DISMISS_IEMBOT_MSG', payload: msg.seqnum })}
                title="Dismiss"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#606070',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: 12,
                  padding: 0,
                  lineHeight: 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ff00aa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#606070')}
              >
                ×
              </button>
            </div>
          </div>
          <div
            className="iembot-msg"
            style={{
              fontSize: BASE_SIZE,
              fontFamily: FONT,
              color: '#e0e0e0',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.message) }}
          />
          {msg.productId && (
            <div style={{ fontSize: BASE_SIZE - 2, color: '#555', marginTop: 4, fontFamily: FONT }}>
              {msg.productId}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
      <style>{`
        .iembot-msg a {
          color: #00f0ff !important;
          text-decoration: none;
        }
        .iembot-msg a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
