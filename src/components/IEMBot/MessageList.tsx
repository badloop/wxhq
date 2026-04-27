import type { IEMBotMessage } from '../../types/iembot';

interface MessageListProps {
  messages: IEMBotMessage[];
  filter: string;
}

/** Convert UTC timestamp string to US Central (CDT = UTC-5) */
function toCentral(utcStr: string): string {
  // Parse "2026-04-27 14:26:44" as UTC
  const d = new Date(utcStr.replace(' ', 'T') + 'Z');
  const ct = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const hh = ct.getUTCHours().toString().padStart(2, '0');
  const mm = ct.getUTCMinutes().toString().padStart(2, '0');
  const ss = ct.getUTCSeconds().toString().padStart(2, '0');
  const mo = (ct.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = ct.getUTCDate().toString().padStart(2, '0');
  return `${mo}/${dd} ${hh}:${mm}:${ss} CT`;
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
      <div style={{ padding: 20, textAlign: 'center', color: '#666', fontFamily: 'monospace' }}>
        {filter ? 'No messages match filter' : 'No messages yet — waiting for data...'}
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
            <span
              style={{
                fontFamily: '"Courier New", monospace',
                fontSize: 11,
                color: '#00f0ff',
              }}
            >
              {toCentral(msg.timestamp)}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#666',
                fontFamily: 'monospace',
                background: 'rgba(0, 240, 255, 0.05)',
                padding: '1px 6px',
                borderRadius: 3,
              }}
            >
              {msg.room}
            </span>
          </div>
          <div
            style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.4, wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: msg.message }}
          />
          {msg.productId && (
            <div style={{ fontSize: 10, color: '#555', marginTop: 4, fontFamily: 'monospace' }}>
              {msg.productId}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
