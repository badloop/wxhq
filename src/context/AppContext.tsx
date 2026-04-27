import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { AppState, AppAction } from './AppReducer';
import { appReducer, initialState } from './AppReducer';
import { loadConfig, saveConfig } from '../services/configService';

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> }>({
  state: initialState,
  dispatch: () => undefined,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState, () => {
    // Load saved config into initial state
    const saved = loadConfig();
    if (saved) {
      return appReducer(initialState, { type: 'LOAD_CONFIG', payload: saved });
    }
    return initialState;
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
      prev.radarState.animationSpeed !== state.radarState.animationSpeed ||
      prev.radarState.frameCount !== state.radarState.frameCount ||
      prev.radarState.radarProduct !== state.radarState.radarProduct;

    prevStateRef.current = state;

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
