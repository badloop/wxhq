import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { AppState, AppAction } from './AppReducer';
import { appReducer, initialState } from './AppReducer';
import { loadConfig, saveConfig, loadIEMBotMessages, saveIEMBotMessages, loadIEMBotPolygons, saveIEMBotPolygons, loadIEMBotSeqnums, saveIEMBotSeqnums } from '../services/configService';

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> }>({
  state: initialState,
  dispatch: () => undefined,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState, () => {
    // Sync init: restore IEMBot messages/polygons/seqnums from localStorage
    let s = initialState;
    const seqnums = loadIEMBotSeqnums();
    if (Object.keys(seqnums).length > 0) {
      s = { ...s, iembotLastSeqnums: seqnums };
    }
    const msgs = loadIEMBotMessages();
    if (msgs.length > 0) {
      s = { ...s, iembotMessages: msgs.filter(m => !s.iembotDismissed.includes(m.seqnum)) };
    }
    const polys = loadIEMBotPolygons();
    if (polys.length > 0) {
      s = { ...s, mcdPolygons: polys };
    }
    return s;
  });

  // Load config asynchronously from JSON file
  const configLoaded = useRef(false);
  useEffect(() => {
    if (configLoaded.current) return;
    configLoaded.current = true;
    loadConfig().then(saved => {
      if (saved) dispatch({ type: 'LOAD_CONFIG', payload: saved });
    });
  }, []);

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
      prev.mapView !== state.mapView ||
      prev.mesoProducts !== state.mesoProducts ||
      prev.radarState.animationSpeed !== state.radarState.animationSpeed ||
      prev.radarState.frameCount !== state.radarState.frameCount ||
      prev.radarState.radarProduct !== state.radarState.radarProduct ||
      prev.radarState.loopDelay !== state.radarState.loopDelay;

    const messagesChanged = prev.iembotMessages !== state.iembotMessages;
    const polygonsChanged = prev.mcdPolygons !== state.mcdPolygons;
    const seqnumsChanged = prev.iembotLastSeqnums !== state.iembotLastSeqnums;

    prevStateRef.current = state;

    // Persist messages, polygons, and seqnums separately (no debounce — they change infrequently)
    if (messagesChanged) {
      saveIEMBotMessages(state.iembotMessages);
    }
    if (polygonsChanged) {
      saveIEMBotPolygons(state.mcdPolygons);
    }
    if (seqnumsChanged) {
      saveIEMBotSeqnums(state.iembotLastSeqnums);
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
