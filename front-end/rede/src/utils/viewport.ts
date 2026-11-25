export type ViewportOrientation = 'portrait' | 'landscape';

export interface ViewportMetrics {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  minSide: number;
  maxSide: number;
  orientation: ViewportOrientation;
  /** Uniform scale reference relative to a 1000px base stage. */
  unitScale: number;
}

/**
 * Computes responsive layout metrics from the current canvas size.
 * Works identically on desktop and mobile in both portrait and landscape.
 */
export function computeViewportMetrics(
  width: number,
  height: number,
): ViewportMetrics {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const minSide = Math.min(safeWidth, safeHeight);
  const maxSide = Math.max(safeWidth, safeHeight);

  return {
    width: safeWidth,
    height: safeHeight,
    centerX: safeWidth / 2,
    centerY: safeHeight / 2,
    minSide,
    maxSide,
    orientation: safeWidth >= safeHeight ? 'landscape' : 'portrait',
    unitScale: minSide / 1000,
  };
}
