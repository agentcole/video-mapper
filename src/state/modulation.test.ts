import { describe, expect, it } from 'vitest';
import type { Modulation } from '../types';
import type { IsfInput } from '../effects/isf';
import {
  defaultModulation, lfoValue, modulate, modulatedParams, periodLabel, seedOf, sourceLabel, sourceValue,
  type ModContext,
} from './modulation';

const ctx = (over: Partial<ModContext> = {}): ModContext => ({
  now: 0,
  clock: { bpm: 120, origin: 0 },
  audio: null,
  macros: [],
  ...over,
});

describe('lfoValue', () => {
  it('peaks on the cycle start', () => {
    for (const shape of ['sine', 'triangle', 'ramp', 'square', 'pulse'] as const) {
      expect(lfoValue(shape, 3)).toBeCloseTo(1);
    }
    expect(lfoValue('saw', 2.999)).toBeCloseTo(1, 2);
  });

  it('has its low point where expected', () => {
    expect(lfoValue('sine', 0.5)).toBeCloseTo(0);
    expect(lfoValue('triangle', 0.5)).toBeCloseTo(0);
    expect(lfoValue('saw', 0)).toBe(0);
    expect(lfoValue('square', 0.6, 0.5)).toBe(0);
    expect(lfoValue('pulse', 0.25, 0.25)).toBe(0);
  });

  it('holds a random value per cycle, the same everywhere', () => {
    const a = lfoValue('random', 5.1, 0.5, 7);
    expect(lfoValue('random', 5.9, 0.5, 7)).toBe(a);
    expect(lfoValue('random', 5.5, 0.5, 7)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    const values = new Set(Array.from({ length: 20 }, (_, i) => lfoValue('random', i, 0.5, 7)));
    expect(values.size).toBeGreaterThan(15);
    // Another seed (another parameter) gets another sequence
    expect(lfoValue('random', 5.1, 0.5, 8)).not.toBe(a);
  });
});

describe('sourceValue', () => {
  it('runs a beat LFO on the master clock', () => {
    const source = { kind: 'lfo', shape: 'saw', period: 4, beats: true } as const;
    // 120 BPM: a beat is 500 ms, 4 beats = 2 s
    expect(sourceValue(source, ctx({ now: 1000 }))).toBeCloseTo(0.5);
    expect(sourceValue(source, ctx({ now: 1000, clock: { bpm: 120, origin: 500 } }))).toBeCloseTo(0.25);
    expect(sourceValue({ ...source, phase: 0.25 }, ctx({ now: 1000 }))).toBeCloseTo(0.75);
  });

  it('runs a seconds LFO on the clock time base', () => {
    expect(sourceValue({ kind: 'lfo', shape: 'saw', period: 4 }, ctx({ now: 3000 }))).toBeCloseTo(0.75);
  });

  it('reads audio bands and macros, silence without input', () => {
    const audio = { level: 0.2, bass: 0.9, mid: 0.4, high: 0.1, kick: 1 };
    expect(sourceValue({ kind: 'audio', band: 'bass' }, ctx({ audio }))).toBe(0.9);
    expect(sourceValue({ kind: 'audio', band: 'bass' }, ctx())).toBe(0);
    expect(sourceValue({ kind: 'macro', index: 2 }, ctx({ macros: [0, 0, 0.7] }))).toBe(0.7);
    expect(sourceValue({ kind: 'macro', index: 5 }, ctx({ macros: [0, 0, 0.7] }))).toBe(0);
  });
});

describe('modulate', () => {
  const macro = (amount: number): Modulation => ({ source: { kind: 'macro', index: 0 }, amount });

  it('pushes the value by amount × range and clamps', () => {
    expect(modulate(2, macro(0.5), 0, 10, ctx({ macros: [1] }))).toBe(7);
    expect(modulate(2, macro(0.5), 0, 10, ctx({ macros: [0.5] }))).toBe(4.5);
    expect(modulate(8, macro(0.5), 0, 10, ctx({ macros: [1] }))).toBe(10);
    expect(modulate(8, macro(-1), 0, 10, ctx({ macros: [1] }))).toBe(0);
    expect(modulate(8, macro(1), 0, 10, ctx({ macros: [0] }))).toBe(8);
  });
});

describe('defaultModulation', () => {
  it('moves towards the side with room', () => {
    expect(defaultModulation(1, 0, 1).amount).toBeLessThan(0); // full opacity: pulse down
    expect(defaultModulation(0.2, 0, 1).amount).toBeGreaterThan(0);
    expect(defaultModulation(150, 0, 360).amount).toBeGreaterThan(0);
  });
});

describe('modulatedParams', () => {
  const inputs: IsfInput[] = [
    { name: 'amount', type: 'float', default: 0.2, min: 0, max: 2 },
    { name: 'center', type: 'point2D', default: [0.5, 0.5], min: [0, 0], max: [1, 1] },
    { name: 'invert', type: 'bool', default: false },
  ];

  it('returns the stored params when nothing is modulated', () => {
    const params = { amount: 1 };
    expect(modulatedParams(inputs, params, undefined, ctx(), 'x')).toBe(params);
    expect(modulatedParams(inputs, params, {}, ctx(), 'x')).toBe(params);
  });

  it('modulates floats from their default and point axes on their own', () => {
    const mods = {
      amount: { source: { kind: 'macro', index: 0 }, amount: 0.5 },
      'center.1': { source: { kind: 'macro', index: 1 }, amount: -0.5 },
    } as const;
    const out = modulatedParams(inputs, {}, mods, ctx({ macros: [1, 1] }), 'x');
    expect(out.amount).toBeCloseTo(1.2);
    expect(out.center).toEqual([0.5, 0]);
    expect(out.invert).toBeUndefined();
  });
});

describe('labels', () => {
  it('names periods and sources', () => {
    expect(periodLabel(4, true)).toBe('1 bar');
    expect(periodLabel(8, true)).toBe('2 bars');
    expect(periodLabel(3, true, 3)).toBe('1 bar');
    expect(periodLabel(4, true, 3)).toBe('4 beats');
    expect(periodLabel(0.5, true)).toBe('1/8');
    expect(periodLabel(2, false)).toBe('2 s');
    expect(sourceLabel({ kind: 'lfo', shape: 'sine', period: 1, beats: true })).toBe('Sine · 1 beat');
    expect(sourceLabel({ kind: 'audio', band: 'kick' })).toBe('Kick');
    expect(sourceLabel({ kind: 'macro', index: 1 }, [{ name: 'A', value: 0 }, { name: 'Strobe', value: 0 }])).toBe('Strobe');
    expect(sourceLabel({ kind: 'macro', index: 4 })).toBe('Macro 5');
  });

  it('seeds differ per key', () => {
    expect(seedOf('a|x')).not.toBe(seedOf('a|y'));
    expect(seedOf('a|x')).toBe(seedOf('a|x'));
  });
});
