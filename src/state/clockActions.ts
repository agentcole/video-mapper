import type { BeatSnap } from '../types';
import { projectStore } from './projectStore';
import { liveStore } from './liveStore';
import { addTap, alignClock, beatAt, beatError, clampBpm, clockNow, msPerBeat, retime, type Clock, type Tap } from './clock';
import { currentClock, retargetScheduled } from './deckActions';

// ---------------------------------------------------------------------------
// Master clock actions (editor): tempo, tap, resync, nudge. The tempo is
// saved with the project (not undoable — like a fader move); the phase is
// live state that output windows mirror. Triggers waiting for their beat
// follow every change.
// ---------------------------------------------------------------------------

let taps: Tap[] = [];

const applyClock = (clock: Clock) => {
  const { tempo, setTempo } = projectStore.getState();
  if (clock.bpm !== tempo.bpm) setTempo(t => ({ ...t, bpm: clock.bpm }));
  liveStore.getState().setClockOrigin(clock.origin);
  retargetScheduled();
};

/** A new tempo, continuing from the current beat. */
export const setBpm = (bpm: number): void => {
  taps = [];
  applyClock(retime(currentClock(), clampBpm(bpm), clockNow()));
};

/** A tempo and a beat time from outside (the audio input): beats land on it. */
export const syncToBeat = (bpm: number, beatTime: number): void => {
  taps = [];
  applyClock(alignClock(currentClock(), clampBpm(bpm), beatTime, clockNow()));
};

// Follow mode: adopt the detected tempo when it is this sure and differs
const FOLLOW_CONFIDENCE = 0.5;
const FOLLOW_BPM = 0.2;
const FOLLOW_PHASE_MS = 25;
const FOLLOW_INTERVAL_MS = 2000;
let lastFollow = 0;

/** Follow a detected tempo: when stable and off by enough, take it (at most every 2 s). */
export const followTempo = (estimate: { bpm: number; beatTime: number; stable: boolean; confidence: number }): void => {
  if (!estimate.stable || estimate.confidence < FOLLOW_CONFIDENCE) return;
  const now = clockNow();
  if (now - lastFollow < FOLLOW_INTERVAL_MS) return;
  const clock = currentClock();
  if (Math.abs(estimate.bpm - clock.bpm) < FOLLOW_BPM && beatError(clock, estimate.beatTime) < FOLLOW_PHASE_MS) return;
  lastFollow = now;
  syncToBeat(estimate.bpm, estimate.beatTime);
};

/**
 * Follow an external clock (MIDI clock): its tempo, and its bar when the
 * position is known (null: keep our phase, change only the tempo). Small
 * differences are left alone so the clock doesn't churn.
 */
export const followExternalClock = (bpm: number, origin: number | null): void => {
  const clock = currentClock();
  const next = origin === null
    ? retime(clock, clampBpm(bpm), clockNow())
    : { bpm: clampBpm(bpm), origin };
  // Same tempo and the bars line up (within 1 ms): nothing to do
  const bar = projectStore.getState().tempo.beatsPerBar;
  const beats = beatAt(clock, next.origin);
  const barError = Math.abs(beats - Math.round(beats / bar) * bar) * msPerBeat(clock.bpm);
  if (Math.abs(next.bpm - clock.bpm) < 0.01 && barError < 1) return;
  taps = [];
  applyClock(next);
};

/** Double / halve the tempo. */
export const scaleTempo = (factor: number): void => setBpm(currentClock().bpm * factor);

/** Tap the beat: from the second tap the tempo follows; the first tap is the downbeat. */
export const tapTempo = (): void => {
  const result = addTap(taps, clockNow());
  if (!result) return;
  taps = result.taps;
  applyClock({ bpm: result.bpm ?? currentClock().bpm, origin: result.origin });
};

/** Now is the start of a bar (keeps the tempo). */
export const resyncBar = (): void => {
  taps = [];
  applyClock({ ...currentClock(), origin: clockNow() });
};

/** Shift the phase: positive = later beats (hold back), negative = earlier (push ahead). */
export const nudgeClock = (ms: number): void => {
  const clock = currentClock();
  applyClock({ ...clock, origin: clock.origin + ms });
};

const NUDGE_TICK_MS = 30;
const NUDGE_RATE = 0.04; // like a pitch bend of ±4 % while held

/**
 * Bend the clock while a nudge button is held: +1 pushes ahead, -1 holds
 * back. Returns the release handler.
 */
export const startNudge = (direction: 1 | -1): (() => void) => {
  const step = () => nudgeClock(-direction * NUDGE_TICK_MS * NUDGE_RATE);
  step();
  const interval = setInterval(step, NUDGE_TICK_MS);
  return () => clearInterval(interval);
};

export const setBeatsPerBar = (beatsPerBar: number): void =>
  projectStore.getState().setTempo(t => ({ ...t, beatsPerBar: Math.max(1, Math.min(16, Math.round(beatsPerBar))) }));

/** The composition's beat snap (clips without their own follow it). */
export const setBeatSnap = (beatSnap: BeatSnap): void =>
  projectStore.getState().setTempo(t => ({ ...t, beatSnap }));
