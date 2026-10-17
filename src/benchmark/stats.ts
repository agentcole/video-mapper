// ---------------------------------------------------------------------------
// Benchmark statistics — pure functions, unit tested
// ---------------------------------------------------------------------------

export interface FrameStats {
  fps: number;
  p50: number; // frame interval percentiles, ms
  p95: number;
  p99: number;
  longFrames: number; // intervals longer than 1.5 refresh intervals (visible stutter)
  samples: number;
}

export interface StepResult {
  layers: number;
  display: FrameStats;
  videoFps: number; // average presented video frames per second, per layer
  droppedVideoPct: number; // dropped / total decoded video frames, all layers
  stable: boolean;
}

/** Nearest-rank percentile of an ascending array. */
export const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
};

/** The display's refresh interval, estimated from idle rAF intervals. */
export const estimateRefreshInterval = (intervals: number[]): number => {
  const sorted = [...intervals].sort((a, b) => a - b);
  return percentile(sorted, 50) || 1000 / 60;
};

export const summarizeFrameIntervals = (intervals: number[], refreshMs: number): FrameStats => {
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((sum, v) => sum + v, 0);
  return {
    fps: total > 0 ? (intervals.length * 1000) / total : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    longFrames: intervals.filter(v => v > refreshMs * 1.5).length,
    samples: intervals.length,
  };
};

/**
 * A step is stable when the display keeps (almost) its refresh rate, no
 * frame takes longer than two refreshes at p99, the videos keep up with
 * their own frame rate and (almost) no video frames are dropped.
 */
export const isStable = (
  display: FrameStats,
  refreshMs: number,
  videoFps: number,
  sourceFps: number,
  droppedVideoPct: number
): boolean =>
  display.fps >= 0.95 * (1000 / refreshMs) &&
  display.p99 <= refreshMs * 2 &&
  videoFps >= 0.95 * sourceFps &&
  droppedVideoPct < 1;

/** Highest layer count of an unbroken run of stable steps from the start. */
export const maxStableLayers = (results: StepResult[]): number => {
  let max = 0;
  for (const r of [...results].sort((a, b) => a.layers - b.layers)) {
    if (!r.stable) break;
    max = r.layers;
  }
  return max;
};
