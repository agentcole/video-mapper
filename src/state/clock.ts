import type { BeatSnap } from '../types';

// ---------------------------------------------------------------------------
// Master clock math (pure). A clock is a tempo and an origin: the time of
// beat 0, which is the start of a bar. Times are milliseconds on one time
// base (clockNow), so every window agrees on the beat.
// ---------------------------------------------------------------------------

/**
 * The clock's time base: milliseconds since the epoch, high resolution.
 * Unlike performance.now() it is the same in every window of the browser
 * (editor and outputs).
 */
export const clockNow = (): number => performance.timeOrigin + performance.now();

export interface Clock {
  bpm: number;
  origin: number;
}

export const MIN_BPM = 20;
export const MAX_BPM = 400;

export const clampBpm = (bpm: number): number =>
  Number.isFinite(bpm) ? Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) * 100) / 100 : 120;

export const msPerBeat = (bpm: number): number => 60_000 / bpm;

/** Beats since the origin (fractional, negative before it). */
export const beatAt = (clock: Clock, time: number): number => (time - clock.origin) / msPerBeat(clock.bpm);

export const timeOfBeat = (clock: Clock, beat: number): number => clock.origin + beat * msPerBeat(clock.bpm);

/** A new tempo that continues from the current phase (no jump in the beat). */
export const retime = (clock: Clock, bpm: number, now: number): Clock => ({
  bpm,
  origin: now - beatAt(clock, now) * msPerBeat(bpm),
});

const mod = (n: number, m: number) => ((n % m) + m) % m;

export interface BarPosition {
  bar: number; // since the origin, from 0
  beat: number; // in the bar, from 0
  phase: number; // within the beat, 0..1
}

export const barPosition = (clock: Clock, time: number, beatsPerBar: number): BarPosition => {
  const beats = beatAt(clock, time);
  const whole = Math.floor(beats);
  return { bar: Math.floor(whole / beatsPerBar), beat: mod(whole, beatsPerBar), phase: beats - whole };
};

// ---- Beat snap ----------------------------------------------------------------------

export const BEAT_SNAPS: { snap: BeatSnap; label: string }[] = [
  { snap: 'off', label: 'Off' },
  { snap: 'beat', label: 'Beat' },
  { snap: 'bar', label: 'Bar' },
  { snap: '2bars', label: '2 Bars' },
  { snap: '4bars', label: '4 Bars' },
];

/** The snap length in beats (0 = off). */
export const snapBeats = (snap: BeatSnap, beatsPerBar: number): number => {
  switch (snap) {
    case 'beat': return 1;
    case 'bar': return beatsPerBar;
    case '2bars': return 2 * beatsPerBar;
    case '4bars': return 4 * beatsPerBar;
    default: return 0;
  }
};

// A press this late after a boundary still counts as on it — the operator
// meant the beat that just went by, not the one a bar later
export const SNAP_GRACE_MS = 50;

/**
 * When a trigger pressed at `now` starts: now (snap off, or within the grace
 * after a boundary) or at the next multiple of `beats`.
 */
export const snapTime = (clock: Clock, now: number, beats: number, graceMs = SNAP_GRACE_MS): number => {
  if (beats <= 0) return now;
  const position = beatAt(clock, now);
  const previous = Math.floor(position / beats) * beats;
  if ((position - previous) * msPerBeat(clock.bpm) <= graceMs) return now;
  return timeOfBeat(clock, previous + beats);
};

// ---- Tap tempo --------------------------------------------------------------------

export interface Tap {
  index: number; // beat number since the first tap of the sequence
  time: number;
}

export const TAP_RESET_MS = 2000; // a pause this long starts a new sequence
const TAP_MIN_INTERVAL_MS = 100; // faster than this is a bounce, not a beat
const TAP_WINDOW = 16; // taps used for the tempo
const TAP_TOLERANCE = 0.15; // an interval this far off the tempo restarts the fit (jitter is ~5 %)

export interface TapResult {
  taps: Tap[];
  bpm: number | null; // null: not enough taps for a tempo yet
  origin: number; // the first tap of the sequence is beat 1 of a bar
}

/**
 * Add a tap. The tempo is a least-squares fit over the recent taps (steadier
 * than averaging intervals); the phase follows the taps, counting the first
 * tap of a sequence as the downbeat. Returns null for a bounce.
 */
export const addTap = (taps: readonly Tap[], now: number): TapResult | null => {
  const last = taps[taps.length - 1];
  if (!last || now - last.time > TAP_RESET_MS || now < last.time) {
    return { taps: [{ index: 0, time: now }], bpm: null, origin: now };
  }
  const interval = now - last.time;
  if (interval < TAP_MIN_INTERVAL_MS) return null;

  let next: Tap[] = [...taps, { index: last.index + 1, time: now }];
  // A tempo change (or a missed tap): fit only from the last tap on
  if (taps.length >= 2) {
    const period = fit(taps).period;
    if (Math.abs(interval - period) > TAP_TOLERANCE * period) next = next.slice(-2);
  }
  next = next.slice(-TAP_WINDOW);
  const { period, origin } = fit(next);
  return { taps: next, bpm: clampBpm(60_000 / period), origin };
};

/** Least squares over (index, time): the beat period and the time of index 0. */
const fit = (taps: readonly Tap[]): { period: number; origin: number } => {
  const n = taps.length;
  const meanIndex = taps.reduce((sum, t) => sum + t.index, 0) / n;
  const meanTime = taps.reduce((sum, t) => sum + t.time, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const t of taps) {
    covariance += (t.index - meanIndex) * (t.time - meanTime);
    variance += (t.index - meanIndex) ** 2;
  }
  const period = variance > 0 ? covariance / variance : msPerBeat(120);
  return { period, origin: meanTime - period * meanIndex };
};
