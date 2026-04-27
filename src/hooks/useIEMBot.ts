import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { fetchIEMBotMessages, cleanMessageHtml } from '../services/iembotApi';
import { fetchMCDFromMessage } from '../services/mcdPolygonService';

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

/**
 * Boot timestamp — set once when the module first loads.
 * Survives HMR since module-level state persists across hot reloads.
 * Only messages with timestamps AFTER this will trigger notifications.
 */
const BOOT_TIME = new Date();

/** Parse IEMBot UTC timestamp to Date */
function parseIEMTimestamp(ts: string): Date {
  return new Date(ts.replace(' ', 'T') + 'Z');
}

export function useIEMBot(rooms: string[], pollInterval = 10000) {
  const { state, dispatch } = useApp();
  const seqnumRef = useRef<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);
  const seededRef = useRef(false);
  const mcdScannedRef = useRef(false);

  const audioEnabledRef = useRef(true);
  const telegramEnabledRef = useRef(state.iembotConfig.telegramNotify);
  telegramEnabledRef.current = state.iembotConfig.telegramNotify;

  // Keep a ref to dismissed seqnums so poll callback can check without stale closure
  const dismissedRef = useRef(state.iembotDismissed);
  dismissedRef.current = state.iembotDismissed;

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

            // Skip if already dismissed (user cleared it previously)
            if (dismissedRef.current.includes(msg.seqnum)) continue;

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

            // If this is an MCD message, fetch the polygon in the background
            if ((msg.product_id ?? '').includes('SWOMCD')) {
              fetchMCDFromMessage(cleanedHtml).then(poly => {
                if (poly) dispatch({ type: 'ADD_MCD_POLYGON', payload: poly });
              });
            }

            // Only queue for notifications if message arrived AFTER boot
            const msgTime = parseIEMTimestamp(msg.ts);
            if (msgTime > BOOT_TIME) {
              telegramQueue.push({
                room,
                text: stripHtml(cleanedHtml),
                productId: msg.product_id ?? '',
              });
            }
          }
          seqnumRef.current[room] = maxSeq;
          // Persist seqnums so next refresh starts from here
          dispatch({ type: 'SET_IEMBOT_SEQNUMS', payload: { [room]: maxSeq } });
        }
      } catch (err) {
        console.error(`[IEMBot] Error polling ${room}:`, err);
      }
    }

    setIsConnected(anySuccess);

    // Audio: only for messages after boot
    if (telegramQueue.length > 0 && audioEnabledRef.current) {
      playNotificationSound();
    }

    // Telegram: only for messages after boot
    if (telegramQueue.length > 0 && telegramEnabledRef.current) {
      sendTelegramNotification(telegramQueue);
    }
  }, [rooms, dispatch]);

  useEffect(() => {
    if (rooms.length === 0) return;

    // Seed seqnums from persisted state (only once)
    if (!seededRef.current) {
      const saved = state.iembotLastSeqnums;
      if (saved && Object.keys(saved).length > 0) {
        seqnumRef.current = { ...saved };
      }
      seededRef.current = true;
    }

    poll();
    const id = setInterval(poll, pollInterval);

    // One-time: scan persisted messages for MCD polygons on startup
    if (!mcdScannedRef.current) {
      mcdScannedRef.current = true;
      const mcdMsgs = state.iembotMessages.filter(m => m.productId.includes('SWOMCD'));
      console.log(`[wxhq] MCD scan: ${state.iembotMessages.length} messages, ${mcdMsgs.length} SWOMCD`);
      console.log(`[wxhq] MCD scan productIds:`, state.iembotMessages.map(m => ({ seq: m.seqnum, pid: m.productId, msg: m.message.substring(0, 120) })));
      for (const msg of mcdMsgs) {
        fetchMCDFromMessage(msg.message).then(poly => {
          if (poly) {
            console.log(`[wxhq] MCD polygon loaded: ${poly.id}`, poly.coordinates.length, 'points');
            dispatch({ type: 'ADD_MCD_POLYGON', payload: poly });
          } else {
            console.warn(`[wxhq] MCD polygon parse returned null for message seqnum=${msg.seqnum}`);
          }
        }).catch(err => {
          console.error(`[wxhq] MCD polygon fetch failed for seqnum=${msg.seqnum}:`, err);
        });
      }
    }

    return () => clearInterval(id);
  }, [rooms.join(','), pollInterval, poll]);

  return { isConnected, setAudioEnabled };
}
