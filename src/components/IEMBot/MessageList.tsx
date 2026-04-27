import type { IEMBotMessage } from '../../types/iembot';

interface MessageListProps {
  messages: IEMBotMessage[];
  filter: string;
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
  // Remove <body xmlns='...'> wrapper
  html = html.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');
  // Strip script tags
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Make links open in new tab
  html = html.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return html;
}

export function MessageList({ messages, filter }: MessageListProps) {
  const filtered = filter
    ? messages.filter(
        (m) =>
          m.message.toLowerCase().includes(filter.toLowerCase()) ||
          m.productId.toLowerCase().includes(filter.toLowerCase())
      )
    : messages;

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
          </div>
          <div
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
