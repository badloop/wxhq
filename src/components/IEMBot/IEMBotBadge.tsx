import { useApp } from '../../context/AppContext';

const BADGE_SIZE = 42;

export function IEMBotBadge() {
  const { state, dispatch } = useApp();
  const unread = state.iembotUnread;
  const hasUnread = unread > 0;

  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_IEMBOT_PANEL' })}
      title="IEMBot Monitor"
      style={{
        position: 'fixed',
        bottom: 64,
        left: 16,
        zIndex: 1001,
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: '50%',
        background: 'rgba(10, 10, 15, 0.9)',
        border: `2px solid ${state.iembotPanelOpen ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)'}`,
        color: '#00f0ff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        boxShadow: hasUnread
          ? '0 0 12px rgba(255, 0, 170, 0.6), 0 0 24px rgba(255, 0, 170, 0.3)'
          : '0 0 8px rgba(0, 240, 255, 0.2)',
        animation: hasUnread ? 'iembot-pulse 1.5s ease-in-out infinite' : 'none',
        padding: 0,
      }}
    >
      <span role="img" aria-label="messages">💬</span>
      {hasUnread && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ff00aa',
            color: '#fff',
            fontSize: 10,
            fontWeight: 'bold',
            borderRadius: '50%',
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 0 6px rgba(255, 0, 170, 0.8)',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      <style>{`
        @keyframes iembot-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255, 0, 170, 0.6), 0 0 24px rgba(255, 0, 170, 0.3); }
          50% { box-shadow: 0 0 20px rgba(255, 0, 170, 0.9), 0 0 40px rgba(255, 0, 170, 0.5); }
        }
      `}</style>
    </button>
  );
}
