import React, { createContext, useContext, useReducer } from 'react';
import type { Dispatch } from 'react';
import type { AppState, AppAction } from './AppReducer';
import { appReducer, initialState } from './AppReducer';

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> }>({
  state: initialState,
  dispatch: () => undefined,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
