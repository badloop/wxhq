import { AppProvider, useApp } from './context/AppContext';
import { RadarMap } from './components/Map/RadarMap';
import { AnimationControls } from './components/Map/AnimationControls';
import { OverlayManager } from './components/Overlays/OverlayManager';
import { ContextSidebar } from './components/Sidebar/ContextSidebar';
import { IEMBotBadge } from './components/IEMBot/IEMBotBadge';
import { IEMBotMonitor } from './components/IEMBot/IEMBotMonitor';
import { useIEMBot } from './hooks/useIEMBot';

function AppInner() {
  const { state } = useApp();
  const config = state.iembotConfig;
  // Always poll, regardless of panel open/closed
  const { isConnected } = useIEMBot(config.rooms, config.pollInterval);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <RadarMap />
      <OverlayManager />
      <AnimationControls />
      <ContextSidebar />
      <IEMBotBadge />
      <IEMBotMonitor isConnected={isConnected} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
