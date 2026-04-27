import { AppProvider } from './context/AppContext';
import { RadarMap } from './components/Map/RadarMap';
import { AnimationControls } from './components/Map/AnimationControls';
import { OverlayManager } from './components/Overlays/OverlayManager';

export default function App() {
  return (
    <AppProvider>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <RadarMap />
        <OverlayManager />
        <AnimationControls />
      </div>
    </AppProvider>
  );
}
