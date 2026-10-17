import type { CrossfadeSide, Transition } from '../types';
import { msPerBeat } from './clock';

// ---------------------------------------------------------------------------
// Transitions and the A/B crossfader (pure). A layer dissolves from its old
// clip to the new one (or to nothing when cleared) over its transition; a
// clip can bring its own. Layers on side A or B follow the crossfader.
// ---------------------------------------------------------------------------

/** Transition length in ms at the given tempo (0: cut). */
export const transitionMs = (transition: Transition | undefined, bpm: number): number => {
  if (!transition || !(transition.duration > 0)) return 0;
  return transition.beats ? transition.duration * msPerBeat(bpm) : transition.duration * 1000;
};

export const transitionLabel = (transition: Transition | undefined): string => {
  if (!transition || !(transition.duration > 0)) return 'Cut';
  const n = transition.duration;
  if (transition.beats) return `${n} beat${n === 1 ? '' : 's'}`;
  return `${n} s`;
};

// Choices offered in the launcher (a null transition = cut)
export const TRANSITION_PRESETS: Transition[] = [
  { duration: 0 },
  { duration: 0.25 },
  { duration: 0.5 },
  { duration: 1 },
  { duration: 2 },
  { duration: 4 },
  { duration: 1, beats: true },
  { duration: 2, beats: true },
  { duration: 4, beats: true },
  { duration: 8, beats: true },
];

export const sameTransition = (a: Transition | undefined, b: Transition | undefined): boolean =>
  (!a || !(a.duration > 0)) && (!b || !(b.duration > 0))
    ? true
    : !!a && !!b && a.duration === b.duration && !!a.beats === !!b.beats;

/** Linear fade position 0..1 of a transition that started at `start`. */
export const fadeProgress = (start: number, ms: number, now: number): number =>
  ms <= 0 ? 1 : Math.min(1, Math.max(0, (now - start) / ms));

// ---- Crossfader -------------------------------------------------------------------

/**
 * Gain of a layer on a crossfader side at position x (0 = A, 1 = B). Both
 * sides are full in the middle, so with B stacked on A moving the fader is
 * a true dissolve in either direction: B fades in over A, then A goes away
 * behind it.
 */
export const crossfadeGain = (side: CrossfadeSide | undefined, x: number): number => {
  const position = Math.min(1, Math.max(0, x));
  if (side === 'A') return Math.min(1, 2 * (1 - position));
  if (side === 'B') return Math.min(1, 2 * position);
  return 1;
};
