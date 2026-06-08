import { useEffect, useRef, useCallback, useMemo } from 'react';
import { WMSTileLayer } from 'react-leaflet';
import type { TileLayer as LeafletTileLayer, WMSParams } from 'leaflet';
import type { ComponentProps } from 'react';
import { reportError } from '../../services/errorBus';

type WMSTileLayerProps = ComponentProps<typeof WMSTileLayer>;

interface TrackedWMSTileLayerProps extends Omit<WMSTileLayerProps, 'params'> {
  /**
   * WMS TIME dimension value (ISO8601, e.g. "2026-06-08T14:18Z").
   * The NCEP GeoServer snaps this to the nearest available volume scan
   * (the layer advertises `nearestValue="1"`), so minute-precision is fine.
   */
  time?: string;
  /** Called once when this layer finishes loading its visible tiles. */
  onLoaded?: () => void;
  /**
   * Called once if this layer fails to load (Leaflet `tileerror`). Used to
   * "settle" the loading gate so a single bad frame can't deadlock the loop.
   */
  onError?: () => void;
  /**
   * Short context label (e.g. "KVWX N0B") used when surfacing a tile-load
   * failure to the global error overlay. Reported at most once per layer; the
   * errorBus further dedupes identical labels across sibling frames.
   */
  errorLabel?: string;
  /** Whether to apply GPU compositing hints for smooth opacity toggling */
  gpuAccelerated?: boolean;
}

function applyGpuHints(layer: LeafletTileLayer) {
  const container = layer.getContainer();
  if (container) {
    container.style.willChange = 'opacity';
    container.style.transform = 'translateZ(0)';
    container.style.backfaceVisibility = 'hidden';
    // NOTE: deliberately no `imageRendering: pixelated` here — these are
    // super-resolution WMS frames; we want them rendered smoothly, unlike the
    // old low-res tile-cache frames.
  }
}

/**
 * A WMS TileLayer wrapper used for single-site radar animation frames.
 *
 * It renders one frame of the NCEP OpenGeo super-resolution radar layer pinned
 * to a specific scan time via the WMS TIME dimension — the same high-resolution
 * source used for the live (static) view — so animation no longer drops to the
 * lower-resolution IEM RIDGE tile cache.
 *
 * Behaviour mirrors {@link TrackedTileLayer}:
 *  1. Fires `onLoaded` when all visible tiles are loaded (Leaflet `load` event).
 *  2. Optionally promotes the layer to a GPU-composited layer for flicker-free
 *     opacity toggling during animation.
 */
export function TrackedWMSTileLayer({
  time,
  onLoaded,
  onError,
  errorLabel,
  gpuAccelerated,
  eventHandlers,
  ...props
}: TrackedWMSTileLayerProps) {
  const ref = useRef<LeafletTileLayer | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const onErrorRef = useRef(onError);
  const errorLabelRef = useRef(errorLabel);
  // One-shot guards for this layer instance (a fresh mount resets them).
  const settledRef = useRef(false);
  const reportedRef = useRef(false);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
    onErrorRef.current = onError;
    errorLabelRef.current = errorLabel;
  }, [onLoaded, onError, errorLabel]);

  // Memoise the WMS params so the object identity is stable across re-renders.
  // The parent re-renders on every animation tick (to toggle frame opacity); an
  // unstable params object would make react-leaflet call `setParams` each tick
  // and force a full WMS redraw of every preloaded frame.
  //
  // `layers` (the other required WMS param) is supplied separately as a direct
  // prop and merged by react-leaflet, so the cast through `unknown` is safe here.
  const params = useMemo<WMSParams | undefined>(
    () => (time ? ({ time } as unknown as WMSParams) : undefined),
    [time],
  );

  const setRef = useCallback((layer: LeafletTileLayer | null) => {
    if (ref.current) {
      ref.current.off('load');
      ref.current.off('tileerror');
    }
    ref.current = layer;
    if (layer) {
      layer.on('load', () => {
        if (gpuAccelerated) applyGpuHints(layer);
        // Settle the loading gate exactly once (the first successful load).
        if (!settledRef.current) {
          settledRef.current = true;
          onLoadedRef.current?.();
        }
      });
      layer.on('tileerror', () => {
        // Surface to the global overlay once per layer; the errorBus dedupes
        // identical labels across sibling frames into a single counted toast.
        if (!reportedRef.current && errorLabelRef.current) {
          reportedRef.current = true;
          reportError({
            source: 'Radar',
            message: `Radar frames failed to load for ${errorLabelRef.current}`,
            severity: 'warning',
          });
        }
        // Count a failed layer as "settled" so it can't deadlock the loop.
        if (!settledRef.current) {
          settledRef.current = true;
          onErrorRef.current?.();
        }
      });
      if (gpuAccelerated) applyGpuHints(layer);
    }
  }, [gpuAccelerated]);

  // Keep GPU hints applied when the tile container is recreated (e.g. on zoom)
  useEffect(() => {
    if (gpuAccelerated && ref.current) applyGpuHints(ref.current);
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.off('load');
        ref.current.off('tileerror');
      }
    };
  }, []);

  return <WMSTileLayer ref={setRef} {...props} params={params} eventHandlers={eventHandlers} />;
}
