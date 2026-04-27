import { AppProvider, useApp } from './context/AppContext';
import { MapLayout } from './components/Map/MapLayout';
import { AnimationControls } from './components/Map/AnimationControls';
import { OverlayManager } from './components/Overlays/OverlayManager';
import { ContextSidebar } from './components/Sidebar/ContextSidebar';
import { IEMBotBadge } from './components/IEMBot/IEMBotBadge';
import { IEMBotMonitor } from './components/IEMBot/IEMBotMonitor';
import { useIEMBot } from './hooks/useIEMBot';

function AppInner() {
  const { state } = useApp();
  const config = state.iembotConfig;
  const { isConnected, setAudioEnabled } = useIEMBot(config.rooms, config.pollInterval);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <MapLayout />
      <OverlayManager />
      <AnimationControls />
      <ContextSidebar />
      <IEMBotBadge />
      <IEMBotMonitor isConnected={isConnected} setAudioEnabled={setAudioEnabled} />
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
