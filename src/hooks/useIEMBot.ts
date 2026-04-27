import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { fetchIEMBotMessages, cleanMessageHtml } from '../services/iembotApi';

export function useIEMBot(rooms: string[], pollInterval = 10000) {
  const { dispatch } = useApp();
  const seqnumRef = useRef<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);

  const poll = useCallback(async () => {
    let anySuccess = false;
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
          }
          seqnumRef.current[room] = maxSeq;
        }
      } catch (err) {
        console.error(`[IEMBot] Error polling ${room}:`, err);
      }
    }
    setIsConnected(anySuccess);
  }, [rooms, dispatch]);

  useEffect(() => {
    if (rooms.length === 0) return;

    // Reset seqnums when rooms change
    seqnumRef.current = {};
    poll();
    const id = setInterval(poll, pollInterval);
    return () => clearInterval(id);
  }, [rooms.join(','), pollInterval, poll]);

  return { isConnected };
}
