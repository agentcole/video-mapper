import { describe, expect, it } from 'vitest';
import { AudioAnalyzer, HOP_SIZE } from './analysis';
import { estimateTempo, TempoTracker } from './tempo';
import { kickLoop, noise, SAMPLE_RATE } from './testSignals';

const RATE = SAMPLE_RATE / HOP_SIZE;
// Onsets show up about this long after the beat (see audioInput.ts)
const LATENCY_MS = ((0.75 * HOP_SIZE) / SAMPLE_RATE) * 1000;

/** Run audio through the analysis into a tracker (times in ms of the hop end). */
const track = (samples: Float32Array, latencyMs = LATENCY_MS) => {
  const analyzer = new AudioAnalyzer(SAMPLE_RATE);
  const tracker = new TempoTracker(RATE, { seconds: 10, latencyMs });
  for (let i = 0; i < samples.length; i += 128) {
    for (const f of analyzer.push(samples.subarray(i, i + 128))) tracker.push(f.flux, f.bassFlux, (f.frame / SAMPLE_RATE) * 1000);
  }
  return tracker;
};

/** Distance (ms) from `time` to the nearest beat of the loop. */
const phaseError = (time: number, bpm: number, offsetS: number) => {
  const beat = 60_000 / bpm;
  const d = (((time - offsetS * 1000) % beat) + beat) % beat;
  return Math.min(d, beat - d);
};

describe('estimateTempo', () => {
  it('finds the tempo of a pulse train', () => {
    const rate = 100;
    const onsets = Array.from({ length: 1000 }, (_, i) => (i % 50 === 0 ? 1 : 0)); // 120 BPM
    const result = estimateTempo(onsets, rate)!;
    expect(result.bpm).toBeCloseTo(120, 0);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.beatOffset).toBeCloseTo(49, 0); // the last pulse (index 950) before the end (999)
  });

  it('needs a few seconds', () => {
    expect(estimateTempo(new Array(100).fill(0), 100)).toBeNull();
  });
});

describe('TempoTracker', () => {
  it.each([90, 96, 110, 124, 128, 135, 140, 150])('locks onto a %d BPM loop with the beat on the kick', (bpm) => {
    const offset = 0.137;
    for (const hats of [true, false]) {
      const estimate = track(kickLoop(bpm, 12, { offset, hats }).samples).estimate()!;
      expect(estimate.bpm).toBeCloseTo(bpm, 1);
      expect(estimate.confidence).toBeGreaterThan(0.5);
      expect(phaseError(estimate.beatTime, bpm, offset)).toBeLessThan(5);
    }
  });

  it('reads drum & bass as half time (×2 is the operator\'s call)', () => {
    const estimate = track(kickLoop(174, 12).samples).estimate()!;
    expect(estimate.bpm).toBeCloseTo(87, 1);
  });

  it('is stable after a few agreeing estimates', () => {
    const tracker = track(kickLoop(128, 12).samples);
    expect(tracker.estimate()!.stable).toBe(false);
    tracker.estimate();
    expect(tracker.estimate()!.stable).toBe(true);
  });

  it('has no confidence in noise', () => {
    const rnd = noise(3);
    const samples = Float32Array.from({ length: SAMPLE_RATE * 10 }, () => 0.3 * rnd());
    const estimate = track(samples).estimate();
    expect(estimate === null || estimate.confidence < 0.3).toBe(true);
  });
});
