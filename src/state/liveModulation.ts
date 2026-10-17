import type { Modulation } from '../types';
import { projectStore } from './projectStore';
import { clockNow } from './clock';
import { currentClock } from './deckActions';
import { modulate, seedOf, type ModContext } from './modulation';
import { currentAudio } from '../audio/audioBus';

// The modulation sources as this window sees them now — for the editor's
// live markers (the renderers build the same context per frame)

export const liveModContext = (): ModContext => {
  const now = clockNow();
  return {
    now,
    clock: currentClock(),
    audio: currentAudio(now)?.levels ?? null,
    macros: projectStore.getState().macros.map(m => m.value),
  };
};

/** A modulated value now, as the renderer computes it (same seed → same random LFO). */
export const liveValue = (base: number, mod: Modulation, min: number, max: number, seedKey: string): number =>
  modulate(base, mod, min, max, liveModContext(), seedOf(seedKey));
