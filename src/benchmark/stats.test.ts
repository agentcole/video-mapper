import { describe, expect, it } from 'vitest';
import {
  estimateRefreshInterval, isStable, maxStableLayers, percentile, summarizeFrameIntervals, type StepResult,
} from './stats';

describe('percentile', () => {
  it('uses nearest rank', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 50)).toBe(5);
    expect(percentile(sorted, 95)).toBe(10);
    expect(percentile(sorted, 10)).toBe(1);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('summarizeFrameIntervals', () => {
  it('reports fps, percentiles and stutter', () => {
    const intervals = [...Array(98).fill(16.7), 40, 50];
    const stats = summarizeFrameIntervals(intervals, 16.7);
    expect(stats.fps).toBeCloseTo(100_000 / (98 * 16.7 + 90), 3);
    expect(stats.p50).toBe(16.7);
    expect(stats.p99).toBe(40);
    expect(stats.longFrames).toBe(2);
    expect(stats.samples).toBe(100);
  });

  it('estimates the refresh interval from the median', () => {
    expect(estimateRefreshInterval([8.3, 8.4, 8.3, 30, 8.3])).toBe(8.3);
  });
});

describe('stability', () => {
  const smooth = summarizeFrameIntervals(Array(300).fill(16.7), 16.7);
  const janky = summarizeFrameIntervals([...Array(280).fill(16.7), ...Array(20).fill(50)], 16.7);

  it('requires display rate, p99, video rate and no drops', () => {
    expect(isStable(smooth, 16.7, 30, 30, 0)).toBe(true);
    expect(isStable(janky, 16.7, 30, 30, 0)).toBe(false);
    expect(isStable(smooth, 16.7, 24, 30, 0)).toBe(false);
    expect(isStable(smooth, 16.7, 30, 30, 2)).toBe(false);
  });

  it('finds the highest unbroken stable layer count', () => {
    const step = (layers: number, stable: boolean): StepResult =>
      ({ layers, stable, display: smooth, videoFps: 30, droppedVideoPct: 0 });
    expect(maxStableLayers([step(1, true), step(2, true), step(4, false), step(6, true)])).toBe(2);
    expect(maxStableLayers([step(1, false)])).toBe(0);
  });
});
