import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { fetchIEMBotMessages, cleanMessageHtml } from '../services/iembotApi';

/** Synthesize a short notification beep via Web Audio API */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);        // A5
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08); // ramp up
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);

    // Clean up
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available — silent fallback
  }
}

export function useIEMBot(rooms: string[], pollInterval = 10000) {
  const { dispatch } = useApp();
  const seqnumRef = useRef<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);
  const initialLoadRef = useRef(true);
  const audioEnabledRef = useRef(true);

  const setAudioEnabled = useCallback((enabled: boolean) => {
    audioEnabledRef.current = enabled;
  }, []);

  const poll = useCallback(async () => {
    let anySuccess = false;
    let newMessageCount = 0;

    for (const room of rooms) {
      try {
        const lastSeq = seqnumRef.current[room] ?? 0;
        const messages = await fetchIEMBotMessages(room, lastSeq);
        anySuccess = true;

        if (messages.length > 0) {
          let maxSeq = lastSeq;
          for (const msg of messages) {
            if (msg.seqnum > maxSeq) maxSeq = msg.seqnum;
            dispatch({
              type: 'ADD_IEMBOT_MSG',
              payload: {
                seqnum: msg.seqnum,
                timestamp: msg.ts,
                author: msg.author,
                productId: msg.product_id ?? '',
                message: cleanMessageHtml(msg.message),
                room,
                read: false,
              },
            });
            newMessageCount++;
          }
          seqnumRef.current[room] = maxSeq;
        }
      } catch (err) {
        console.error(`[IEMBot] Error polling ${room}:`, err);
      }
    }

    setIsConnected(anySuccess);

    // Play sound for new messages, but not on initial history load
    if (newMessageCount > 0 && !initialLoadRef.current && audioEnabledRef.current) {
      playNotificationSound();
    }
    initialLoadRef.current = false;
  }, [rooms, dispatch]);

  useEffect(() => {
    if (rooms.length === 0) return;

    seqnumRef.current = {};
    initialLoadRef.current = true;
    poll();
    const id = setInterval(poll, pollInterval);
    return () => clearInterval(id);
  }, [rooms.join(','), pollInterval, poll]);

  return { isConnected, setAudioEnabled };
}
