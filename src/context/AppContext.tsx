import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { AppState, AppAction } from './AppReducer';
import { appReducer, initialState } from './AppReducer';
import { loadConfig, saveConfig, loadIEMBotMessages, saveIEMBotMessages, loadIEMBotPolygons, saveIEMBotPolygons } from '../services/configService';

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> }>({
  state: initialState,
  dispatch: () => undefined,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState, () => {
    // Load saved config into initial state
    let s = initialState;
    const saved = loadConfig();
    if (saved) {
      s = appReducer(s, { type: 'LOAD_CONFIG', payload: saved });
    }
    // Restore persisted IEMBot messages (filter out any that were dismissed)
    const msgs = loadIEMBotMessages();
    if (msgs.length > 0) {
      s = { ...s, iembotMessages: msgs.filter(m => !s.iembotDismissed.includes(m.seqnum)) };
    }
    // Restore persisted IEMBot polygons
    const polys = loadIEMBotPolygons();
    if (polys.length > 0) {
      s = { ...s, mcdPolygons: polys };
    }
    return s;
  });

  // Auto-save config on relevant state changes (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef(state);

  useEffect(() => {
    // Only save when persistable parts change
    const prev = prevStateRef.current;
    const changed =
      prev.overlays !== state.overlays ||
      prev.layerGroups !== state.layerGroups ||
      prev.iembotConfig !== state.iembotConfig ||
      prev.iembotLastSeqnums !== state.iembotLastSeqnums ||
      prev.iembotDismissed !== state.iembotDismissed ||
      prev.mapPoints !== state.mapPoints ||
      prev.refLayers !== state.refLayers ||
      prev.layout !== state.layout ||
      prev.paneProducts !== state.paneProducts ||
      prev.radarState.animationSpeed !== state.radarState.animationSpeed ||
      prev.radarState.frameCount !== state.radarState.frameCount ||
      prev.radarState.radarProduct !== state.radarState.radarProduct;

    const messagesChanged = prev.iembotMessages !== state.iembotMessages;
    const polygonsChanged = prev.mcdPolygons !== state.mcdPolygons;

    prevStateRef.current = state;

    // Persist messages and polygons separately (no debounce — they change infrequently)
    if (messagesChanged) {
      saveIEMBotMessages(state.iembotMessages);
    }
    if (polygonsChanged) {
      saveIEMBotPolygons(state.mcdPolygons);
    }

    if (!changed) return;

    // Debounce saves to avoid thrashing during slider drags
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveConfig(state), 500);
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
