import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { fetchIEMBotMessages, cleanMessageHtml } from '../services/iembotApi';
import { fetchPolygonFromMessage, polygonIdForMessage } from '../services/iembotPolygonService';

/**
 * Max polygon-fetch attempts per message before giving up. Brand-new products
 * occasionally lag the IEMBot relay by a few seconds; retrying across poll
 * cycles lets the shape appear as soon as the source text is published, while
 * the cap prevents endless refetching of products that genuinely have no
 * polygon (e.g. text-only statements).
 */
const MAX_POLYGON_ATTEMPTS = 8;

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

function sendDesktopNotification(messages: Array<{ room: string; text: string; productId: string }>) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return;
  }

  console.log(`[IEMBot] Sending ${messages.length} desktop notification(s)`);
  for (const m of messages.slice(0, 5)) {
    const title = m.productId ? `[${m.room}] ${m.productId}` : `[${m.room}] IEMBot`;
    new Notification(title, {
      body: m.text.slice(0, 200),
      icon: '/lightning.svg',
      // Stable tag per product/room so the OS coalesces duplicates instead of stacking
      tag: `iembot-${m.room}-${m.productId || m.text.slice(0, 40)}`,
    });
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

  const audioEnabledRef = useRef(true);
  const telegramEnabledRef = useRef(state.iembotConfig.telegramNotify);
  telegramEnabledRef.current = state.iembotConfig.telegramNotify;
  const desktopNotifyRef = useRef(state.iembotConfig.desktopNotify);
  desktopNotifyRef.current = state.iembotConfig.desktopNotify;

  // Keep a ref to dismissed seqnums so poll callback can check without stale closure
  const dismissedRef = useRef(state.iembotDismissed);
  dismissedRef.current = state.iembotDismissed;

  // Keep a ref to seqnums already in the list, so the notification queue stays
  // in sync with what the reducer actually accepts (prevents re-notifying dupes)
  const existingSeqnumsRef = useRef<Set<number>>(new Set());
  existingSeqnumsRef.current = new Set(state.iembotMessages.map(m => m.seqnum));

  // Per-message polygon-fetch attempt counter. Bounds retries across polls.
  const polygonAttemptsRef = useRef<Map<number, number>>(new Map());
  // Seqnums with a polygon fetch currently in flight (avoid concurrent dupes).
  const polygonInFlightRef = useRef<Set<number>>(new Set());
  // Polygon ids we've already dispatched, to dedupe across the async gap between
  // a successful fetch and the next render reflecting it in state.mcdPolygons.
  const addedPolygonIdsRef = useRef<Set<string>>(new Set());

  const setAudioEnabled = useCallback((enabled: boolean) => {
    audioEnabledRef.current = enabled;
  }, []);

  /**
   * Ensure a shape exists for one message. Idempotent and self-throttling:
   * skips if a polygon for this message is already rendered/dispatched, already
   * in flight, or attempts are exhausted. Safe to call every poll per message.
   * `renderedIds` is the set of polygon ids currently in state (passed in so we
   * never read a ref during render).
   */
  const ensurePolygon = useCallback(
    async (seqnum: number, messageHtml: string, productId: string, renderedIds: Set<string>) => {
      const polyId = polygonIdForMessage(messageHtml, productId);
      if (!polyId) return; // no drawable product
      if (renderedIds.has(polyId) || addedPolygonIdsRef.current.has(polyId)) return; // already have it
      if (polygonInFlightRef.current.has(seqnum)) return; // already fetching

      const attempts = polygonAttemptsRef.current.get(seqnum) ?? 0;
      if (attempts >= MAX_POLYGON_ATTEMPTS) return; // gave up

      polygonInFlightRef.current.add(seqnum);
      polygonAttemptsRef.current.set(seqnum, attempts + 1);
      try {
        const poly = await fetchPolygonFromMessage(messageHtml, productId);
        if (poly && !addedPolygonIdsRef.current.has(poly.id)) {
          addedPolygonIdsRef.current.add(poly.id);
          dispatch({ type: 'ADD_MCD_POLYGON', payload: poly });
        }
      } catch {
        // swallow — next poll's sweep retries until the attempt cap
      } finally {
        polygonInFlightRef.current.delete(seqnum);
      }
    },
    [dispatch],
  );

  /**
   * Re-attempt polygon fetches for every undismissed message that still lacks a
   * shape. Run at the end of each poll so a brand-new alert whose source text
   * lagged the relay gets its shape within a poll cycle (not the 2-min overlay
   * refresh), and a transient network error self-heals.
   */
  const sweepPolygons = useCallback(() => {
    const renderedIds = new Set(state.mcdPolygons.map(p => p.id));
    for (const m of state.iembotMessages) {
      if (dismissedRef.current.includes(m.seqnum)) continue;
      ensurePolygon(m.seqnum, m.message, m.productId, renderedIds);
    }
  }, [state.iembotMessages, ensurePolygon]);

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
            // Guard against missing/NaN seqnums that would stall pagination and
            // cause the same messages to be refetched + re-notified every poll.
            if (typeof msg.seqnum === 'number' && msg.seqnum > maxSeq) maxSeq = msg.seqnum;

            // Skip if already dismissed (user cleared it previously)
            if (dismissedRef.current.includes(msg.seqnum)) continue;

            // Skip if already in the list — the reducer would dedupe it anyway,
            // and notifying for it would produce a flood of duplicate alerts.
            if (existingSeqnumsRef.current.has(msg.seqnum)) continue;

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
            // Mark as seen so duplicates within this batch / across rooms don't re-notify
            existingSeqnumsRef.current.add(msg.seqnum);

            // Translate the alert's coordinate data into a map shape. First
            // attempt fires now; the end-of-poll sweep retries if the source
            // text isn't published yet. (A new message has no rendered polygon
            // yet, so pass an empty rendered-id set; dedupe guards handle races.)
            ensurePolygon(msg.seqnum, cleanedHtml, msg.product_id ?? '', new Set());

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

    // Desktop notifications: only for messages after boot
    if (telegramQueue.length > 0 && desktopNotifyRef.current) {
      console.log(`[IEMBot] Desktop notify triggered, ${telegramQueue.length} msg(s), permission=${Notification?.permission}`);
      sendDesktopNotification(telegramQueue);
    }

    // Retry shapes for any undismissed message still missing one. Cheap: skips
    // messages already drawn, in flight, or past the attempt cap.
    sweepPolygons();
  }, [rooms, dispatch, ensurePolygon, sweepPolygons]);

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

    return () => clearInterval(id);
  }, [rooms.join(','), pollInterval, poll]);

  return { isConnected, setAudioEnabled };
}
