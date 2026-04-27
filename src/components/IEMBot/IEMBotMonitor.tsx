import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageList } from './MessageList';
import { useIsMobile } from '../../hooks/useIsMobile';

const PRESET_ROOMS = ['botstalk', 'spcchat', 'emergchat', 'pdschat', 'dmgchat'];

export function IEMBotMonitor({ isConnected, setAudioEnabled }: { isConnected: boolean; setAudioEnabled: (v: boolean) => void }) {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [muted, setMuted] = useState(false);

  const config = state.iembotConfig;
  const mobile = useIsMobile();

  if (!state.iembotPanelOpen) return null;

  // Mark all as read when panel is open
  const handleMarkRead = () => dispatch({ type: 'MARK_IEMBOT_READ' });
  const handleClear = () => dispatch({ type: 'CLEAR_IEMBOT' });
  const handleClose = () => dispatch({ type: 'TOGGLE_IEMBOT_PANEL' });

  const addRoom = () => {
    const room = roomInput.trim().toLowerCase();
    if (room && !config.rooms.includes(room)) {
      dispatch({ type: 'SET_IEMBOT_ROOMS', payload: [...config.rooms, room] });
    }
    setRoomInput('');
  };

  const removeRoom = (room: string) => {
    dispatch({ type: 'SET_IEMBOT_ROOMS', payload: config.rooms.filter((r) => r !== room) });
  };

  const togglePresetRoom = (room: string) => {
    if (config.rooms.includes(room)) {
      removeRoom(room);
    } else {
      dispatch({ type: 'SET_IEMBOT_ROOMS', payload: [...config.rooms, room] });
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(26, 26, 46, 0.8)',
    border: '1px solid rgba(0, 240, 255, 0.2)',
    color: '#e0e0e0',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 13,
    outline: 'none',
    fontFamily: "monospace",
  };

  const btnStyle: React.CSSProperties = {
    background: 'rgba(0, 240, 255, 0.1)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    color: '#00f0ff',
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "monospace",
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: mobile ? 72 : 64,
        left: mobile ? 8 : 16,
        right: mobile ? 8 : undefined,
        width: mobile ? undefined : 450,
        maxHeight: mobile ? '70vh' : '60vh',
        background: 'rgba(10, 10, 15, 0.95)',
        border: '1px solid rgba(0, 240, 255, 0.3)',
        boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
        borderRadius: 8,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? '#39ff14' : '#ff3333',
              boxShadow: isConnected ? '0 0 6px #39ff14' : '0 0 6px #ff3333',
              display: 'inline-block',
            }}
          />
          <span style={{ color: '#00f0ff', fontWeight: 'bold', fontSize: 14, fontFamily: "monospace" }}>
            IEMBot Monitor
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => dispatch({ type: 'SET_IEMBOT_TELEGRAM', payload: !config.telegramNotify })}
            style={{
              ...btnStyle,
              color: config.telegramNotify ? '#39ff14' : '#606070',
              borderColor: config.telegramNotify ? 'rgba(57,255,20,0.3)' : 'rgba(0,240,255,0.15)',
            }}
            title={config.telegramNotify ? 'Telegram notifications ON' : 'Telegram notifications OFF'}
          >
            TG
          </button>
          <button
            onClick={() => { setMuted(!muted); setAudioEnabled(muted); }}
            style={{ ...btnStyle, color: muted ? '#ff4444' : '#39ff14', borderColor: muted ? 'rgba(255,68,68,0.3)' : 'rgba(57,255,20,0.3)' }}
            title={muted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button onClick={handleMarkRead} style={btnStyle} title="Mark all read">
            ✓
          </button>
          <button onClick={handleClear} style={btnStyle} title="Clear all">
            ✕
          </button>
          <button onClick={handleClose} style={{ ...btnStyle, color: '#ff00aa', borderColor: 'rgba(255,0,170,0.3)' }}>
            ✕
          </button>
        </div>
      </div>

      {/* Room selector */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid rgba(0, 240, 255, 0.1)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {PRESET_ROOMS.map((room) => (
          <button
            key={room}
            onClick={() => togglePresetRoom(room)}
            style={{
              ...btnStyle,
              fontSize: 10,
              padding: '2px 8px',
              background: config.rooms.includes(room) ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
              borderColor: config.rooms.includes(room) ? '#00f0ff' : 'rgba(0, 240, 255, 0.15)',
            }}
          >
            {room}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0, 240, 255, 0.1)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Filter messages..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Messages */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <MessageList messages={state.iembotMessages} filter={filter} dispatch={dispatch} />
      </div>

      {/* Add room */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(0, 240, 255, 0.15)',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Add room (e.g. ounchat)"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRoom()}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={addRoom} style={btnStyle}>
          + Add
        </button>
      </div>

      {/* Active custom rooms */}
      {config.rooms.filter((r) => !PRESET_ROOMS.includes(r)).length > 0 && (
        <div
          style={{
            padding: '4px 12px 8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            flexShrink: 0,
          }}
        >
          {config.rooms
            .filter((r) => !PRESET_ROOMS.includes(r))
            .map((room) => (
              <span
                key={room}
                style={{
                  fontSize: 10,
                  color: '#00f0ff',
                  background: 'rgba(0, 240, 255, 0.1)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontFamily: 'monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {room}
                <button
                  onClick={() => removeRoom(room)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff00aa',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
