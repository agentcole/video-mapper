import type { AudioBand, EffectParamValue, LfoShape, Macro, ModMap, ModSource, Modulation } from '../types';
import { inputRange, paramValue, type IsfInput } from '../effects/isf';
import { beatAt, type Clock } from './clock';

// ---------------------------------------------------------------------------
// Parameter modulation (pure). A source — LFO, audio band or macro fader —
// gives 0..1; a modulation pushes a parameter from where it is set by an
// amount of its range. Everything is computed from the shared clock, the
// audio analysis and the macros, so the editor and every output window get
// the same values without sending them per frame.
// ---------------------------------------------------------------------------

export type AudioLevels = Record<AudioBand, number>;

export interface ModContext {
  now: number; // clock time base (clockNow)
  clock: Clock; // master tempo and phase, for LFOs in beats
  audio: AudioLevels | null; // null: no audio input (silence)
  macros: readonly number[];
}

export const LFO_SHAPES: { shape: LfoShape; label: string }[] = [
  { shape: 'sine', label: 'Sine' },
  { shape: 'triangle', label: 'Triangle' },
  { shape: 'saw', label: 'Saw up' },
  { shape: 'ramp', label: 'Ramp down' },
  { shape: 'square', label: 'Square' },
  { shape: 'pulse', label: 'Pulse' },
  { shape: 'random', label: 'Random' },
];

export const AUDIO_BANDS: { band: AudioBand; label: string }[] = [
  { band: 'level', label: 'Level' },
  { band: 'bass', label: 'Bass' },
  { band: 'mid', label: 'Mid' },
  { band: 'high', label: 'High' },
  { band: 'kick', label: 'Kick' },
];

// Periods offered for LFOs: in beats of the master clock, or in seconds
export const LFO_BEATS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
export const LFO_SECONDS = [0.25, 0.5, 1, 2, 4, 8, 16, 30, 60];

export const DEFAULT_MODULATION: Modulation = {
  source: { kind: 'lfo', shape: 'sine', period: 4, beats: true },
  amount: 0.5,
};

/** A new modulation for a value: it moves towards the side with room (down from the top half). */
export const defaultModulation = (base: number, min: number, max: number): Modulation =>
  base > (min + max) / 2 ? { ...DEFAULT_MODULATION, amount: -DEFAULT_MODULATION.amount } : DEFAULT_MODULATION;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A stable 32-bit seed for a string (FNV-1a), e.g. per modulated parameter. */
export const seedOf = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** A deterministic 0..1 for an integer and a seed (same in every window). */
const random01 = (n: number, seed: number): number => {
  let x = (Math.imul(n | 0, 0x9e3779b1) ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/**
 * An LFO at `cycle` (periods since the start, fractional). Waves peak on
 * the cycle start, so a beat-synced LFO hits on the beat.
 */
export const lfoValue = (shape: LfoShape, cycle: number, width = 0.5, seed = 0): number => {
  const p = cycle - Math.floor(cycle);
  const w = Math.min(1, Math.max(0.01, width));
  switch (shape) {
    case 'sine': return 0.5 + 0.5 * Math.cos(2 * Math.PI * p);
    case 'triangle': return Math.abs(2 * p - 1);
    case 'saw': return p;
    case 'ramp': return 1 - p;
    case 'square': return p < w ? 1 : 0;
    case 'pulse': return (1 - Math.min(1, p / w)) ** 2;
    case 'random': return random01(Math.floor(cycle), seed);
  }
};

/** A source's value now, 0..1. `seed` decorrelates random LFOs of different parameters. */
export const sourceValue = (source: ModSource, ctx: ModContext, seed = 0): number => {
  switch (source.kind) {
    case 'lfo': {
      const period = source.period > 0 ? source.period : 1;
      const position = source.beats ? beatAt(ctx.clock, ctx.now) : ctx.now / 1000;
      return lfoValue(source.shape, position / period + (source.phase ?? 0), source.width ?? (source.shape === 'pulse' ? 0.25 : 0.5), seed);
    }
    case 'audio': return clamp01(ctx.audio?.[source.band] ?? 0);
    case 'macro': return clamp01(ctx.macros[source.index] ?? 0);
  }
};

/** A value modulated within [min, max]. */
export const modulate = (
  base: number, mod: Modulation, min: number, max: number, ctx: ModContext, seed = 0,
): number => {
  const v = base + mod.amount * (max - min) * sourceValue(mod.source, ctx, seed);
  return Math.min(max, Math.max(min, v));
};

/** The key of a modulated parameter: an input, or one axis of a point. */
export const modKey = (name: string, axis?: number): string => (axis === undefined ? name : `${name}.${axis}`);

/**
 * An ISF shader's parameter values with their modulations applied (floats
 * and point axes). Unmodulated parameters come back as they are stored.
 */
export const modulatedParams = (
  inputs: readonly IsfInput[],
  params: Record<string, EffectParamValue>,
  mods: ModMap | undefined,
  ctx: ModContext,
  seedKey: string,
): Record<string, EffectParamValue> => {
  if (!mods) return params;
  let out: Record<string, EffectParamValue> | null = null;
  for (const input of inputs) {
    if (input.type === 'float') {
      const mod = mods[input.name];
      if (!mod) continue;
      const [min, max] = inputRange(input);
      out ??= { ...params };
      out[input.name] = modulate(paramValue(input, params[input.name]) as number, mod, min, max, ctx, seedOf(`${seedKey}|${input.name}`));
    } else if (input.type === 'point2D') {
      const axes = [0, 1].filter(axis => mods[modKey(input.name, axis)]);
      if (axes.length === 0) continue;
      const point = [...(paramValue(input, params[input.name]) as number[])];
      for (const axis of axes) {
        const [min, max] = inputRange(input, axis);
        const key = modKey(input.name, axis);
        point[axis] = modulate(point[axis], mods[key], min, max, ctx, seedOf(`${seedKey}|${key}`));
      }
      out ??= { ...params };
      out[input.name] = point;
    }
  }
  return out ?? params;
};

export const hasMods = (mods: ModMap | undefined): boolean => !!mods && Object.keys(mods).length > 0;

// ---- Labels ---------------------------------------------------------------------------

/** "1 bar", "2 beats", "1/8", "4 s" */
export const periodLabel = (period: number, beats?: boolean, beatsPerBar = 4): string => {
  if (!beats) return `${period} s`;
  if (period >= beatsPerBar && period % beatsPerBar === 0) {
    const bars = period / beatsPerBar;
    return `${bars} bar${bars === 1 ? '' : 's'}`;
  }
  if (period === 0.25) return '1/16';
  if (period === 0.5) return '1/8';
  return `${period} beat${period === 1 ? '' : 's'}`;
};

/** "Sine · 1 bar", "Bass", "Macro 3" */
export const sourceLabel = (source: ModSource, macros: readonly Macro[] = [], beatsPerBar = 4): string => {
  switch (source.kind) {
    case 'lfo': return `${LFO_SHAPES.find(s => s.shape === source.shape)?.label ?? 'LFO'} · ${periodLabel(source.period, source.beats, beatsPerBar)}`;
    case 'audio': return AUDIO_BANDS.find(b => b.band === source.band)?.label ?? 'Audio';
    case 'macro': return macros[source.index]?.name || `Macro ${source.index + 1}`;
  }
};
