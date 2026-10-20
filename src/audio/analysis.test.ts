import { describe, expect, it } from 'vitest';
import { AudioAnalyzer, Fft, HOP_SIZE, SPECTRUM_SIZE, type AnalysisFrame } from './analysis';
import { kickLoop, SAMPLE_RATE, sine } from './testSignals';

const run = (samples: Float32Array, settings = { gain: 0, autoGain: false, smoothing: 0 }): AnalysisFrame[] => {
  const analyzer = new AudioAnalyzer(SAMPLE_RATE, settings);
  const frames: AnalysisFrame[] = [];
  // Feed in render quanta like an AudioWorklet does
  for (let i = 0; i < samples.length; i += 128) frames.push(...analyzer.push(samples.subarray(i, i + 128)));
  return frames;
};

const last = (frames: AnalysisFrame[]) => frames[frames.length - 1];

describe('Fft', () => {
  it('finds a sine in its bin', () => {
    const fft = new Fft(1024);
    const re = new Float64Array(1024);
    const im = new Float64Array(1024);
    for (let i = 0; i < 1024; i++) re[i] = Math.sin((2 * Math.PI * 37 * i) / 1024);
    fft.transform(re, im);
    const mags = Array.from({ length: 512 }, (_, k) => Math.hypot(re[k], im[k]));
    expect(mags.indexOf(Math.max(...mags))).toBe(37);
    expect(mags[37]).toBeCloseTo(512, 3);
  });
});

describe('AudioAnalyzer', () => {
  it('gives a frame per hop and silence for silence', () => {
    const frames = run(new Float32Array(HOP_SIZE * 10));
    expect(frames).toHaveLength(10);
    expect(frames[9].frame).toBe(HOP_SIZE * 10);
    expect(last(frames).levels).toEqual({ level: 0, bass: 0, mid: 0, high: 0, kick: 0 });
    expect(last(frames).spectrum).toHaveLength(SPECTRUM_SIZE);
    expect(last(frames).waveform.every(v => v === 128)).toBe(true);
  });

  it('sorts tones into bands', () => {
    const bass = last(run(sine(60, 0.5, 0.5))).levels;
    expect(bass.bass).toBeGreaterThan(0.7);
    expect(bass.high).toBeLessThan(0.1);
    const high = last(run(sine(6000, 0.5, 0.5))).levels;
    expect(high.high).toBeGreaterThan(0.7);
    expect(high.bass).toBeLessThan(0.1);
    const mid = last(run(sine(800, 0.5, 0.5))).levels;
    expect(mid.mid).toBeGreaterThan(0.7);
    expect(mid.bass).toBeLessThan(0.3);
    expect(mid.high).toBeLessThan(0.3);
  });

  it('maps dB to 0..1 with the manual gain', () => {
    // A full-scale sine is 0 dB = 1; -18 dB is half way down the 36 dB range
    expect(last(run(sine(800, 0.3, 1))).levels.level).toBeCloseTo(1, 1);
    expect(last(run(sine(800, 0.3, 10 ** (-18 / 20)))).levels.level).toBeCloseTo(0.5, 1);
    expect(last(run(sine(800, 0.3, 10 ** (-18 / 20)), { gain: 9, autoGain: false, smoothing: 0 })).levels.level).toBeCloseTo(0.75, 1);
  });

  it('auto gain brings quiet input up to full scale', () => {
    const quiet = last(run(sine(800, 1, 0.01), { gain: 0, autoGain: true, smoothing: 0 })).levels;
    expect(quiet.level).toBeGreaterThan(0.9);
  });

  it('falls slowly with smoothing, rises at once', () => {
    const tone = sine(60, 0.3, 0.5);
    const signal = new Float32Array(tone.length + HOP_SIZE * 8);
    signal.set(tone);
    const sharp = run(signal, { gain: 0, autoGain: false, smoothing: 0 });
    const smooth = run(signal, { gain: 0, autoGain: false, smoothing: 1 });
    expect(last(sharp).levels.bass).toBeLessThan(0.05);
    expect(last(smooth).levels.bass).toBeGreaterThan(0.5);
  });

  it('detects each kick once, within two hops', () => {
    const { samples, kicks } = kickLoop(128, 8);
    const frames = run(samples, { gain: 0, autoGain: true, smoothing: 0.3 });
    const detected = frames.filter(f => f.levels.kick === 1).map(f => f.frame / SAMPLE_RATE);
    expect(detected).toHaveLength(kicks.length);
    detected.forEach((t, i) => {
      expect(t - kicks[i]).toBeGreaterThanOrEqual(0);
      expect(t - kicks[i]).toBeLessThan((2 * HOP_SIZE) / SAMPLE_RATE + 0.002);
    });
  });

  it('shows the wave around the middle', () => {
    // Half scale: 128 ± 64
    const wave = last(run(sine(200, 0.2, 0.5))).waveform;
    expect(Math.max(...wave)).toBeGreaterThan(185);
    expect(Math.min(...wave)).toBeLessThan(70);
  });
});
