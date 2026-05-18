import { useEffect, useRef, useCallback } from 'react';
import { TileLayer } from 'react-leaflet';
import type { TileLayer as LeafletTileLayer } from 'leaflet';
import type { ComponentProps } from 'react';

type TileLayerProps = ComponentProps<typeof TileLayer>;

interface TrackedTileLayerProps extends TileLayerProps {
  /** Called when this layer finishes loading all visible tiles */
  onLoaded?: () => void;
  /** Whether to apply GPU compositing hints for smooth animation */
  gpuAccelerated?: boolean;
}

/**
 * A TileLayer wrapper that:
 * 1. Fires `onLoaded` when all visible tiles are loaded (Leaflet `load` event)
 * 2. Optionally promotes the layer to a GPU-composited layer for smooth opacity toggling
 */
export function TrackedTileLayer({ onLoaded, gpuAccelerated, ...props }: TrackedTileLayerProps) {
  const ref = useRef<LeafletTileLayer | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const setRef = useCallback((layer: LeafletTileLayer | null) => {
    if (ref.current) {
      ref.current.off('load');
    }
    ref.current = layer;
    if (layer) {
      layer.on('load', () => {
        onLoadedRef.current?.();
      });

      // Promote to GPU compositing layer for flicker-free opacity toggling
      if (gpuAccelerated) {
        const container = layer.getContainer();
        if (container) {
          container.style.willChange = 'opacity';
          container.style.transform = 'translateZ(0)';
          container.style.backfaceVisibility = 'hidden';
        }
      }
    }
  }, [gpuAccelerated]);

  // Keep GPU hints applied when container is recreated
  useEffect(() => {
    if (gpuAccelerated && ref.current) {
      const container = ref.current.getContainer();
      if (container) {
        container.style.willChange = 'opacity';
        container.style.transform = 'translateZ(0)';
        container.style.backfaceVisibility = 'hidden';
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.off('load');
      }
    };
  }, []);

  return <TileLayer ref={setRef} {...props} />;
}
