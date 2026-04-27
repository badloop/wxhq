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

/** Strip HTML tags for plain-text Telegram notification */
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/** Send IEMBot message summary to Telegram via JARVIS bot */
async function sendTelegramNotification(messages: Array<{ room: string; text: string; productId: string }>) {
  try {
    const lines = messages.map(m => {
      const prefix = m.productId ? `[${m.room}] ${m.productId}` : `[${m.room}]`;
      return `${prefix}\n${m.text}`;
    });
    const body = `IEMBot (${messages.length} new):\n\n${lines.join('\n\n')}`;
    await fetch('/telegram-api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
    });
  } catch {
    // Telegram bot may not be running — silent fail
  }
}

export function useIEMBot(rooms: string[], pollInterval = 10000) {
  const { state, dispatch } = useApp();
  const seqnumRef = useRef<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);
  const initialLoadRef = useRef(true);
  const audioEnabledRef = useRef(true);
  // Snapshot telegramNotify into a ref so the poll callback doesn't go stale
  const telegramEnabledRef = useRef(state.iembotConfig.telegramNotify);
  telegramEnabledRef.current = state.iembotConfig.telegramNotify;

  const setAudioEnabled = useCallback((enabled: boolean) => {
    audioEnabledRef.current = enabled;
  }, []);

  const poll = useCallback(async () => {
    let anySuccess = false;
    let newMessageCount = 0;
    const telegramQueue: Array<{ room: string; text: string; productId: string }> = [];

    for (const room of rooms) {
      try {
        const lastSeq = seqnumRef.current[room] ?? 0;
        const messages = await fetchIEMBotMessages(room, lastSeq);
        anySuccess = true;

        if (messages.length > 0) {
          let maxSeq = lastSeq;
          for (const msg of messages) {
            if (msg.seqnum > maxSeq) maxSeq = msg.seqnum;
            const cleanedHtml = cleanMessageHtml(msg.message);
            dispatch({
              type: 'ADD_IEMBOT_MSG',
              payload: {
                seqnum: msg.seqnum,
                timestamp: msg.ts,
                author: msg.author,
                productId: msg.product_id ?? '',
                message: cleanedHtml,
                room,
                read: false,
              },
            });
            newMessageCount++;
            // Queue for telegram (only non-initial messages)
            if (!initialLoadRef.current) {
              telegramQueue.push({
                room,
                text: stripHtml(cleanedHtml),
                productId: msg.product_id ?? '',
              });
            }
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

    // Send Telegram notification for new messages (not initial load)
    if (telegramQueue.length > 0 && telegramEnabledRef.current) {
      sendTelegramNotification(telegramQueue);
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
