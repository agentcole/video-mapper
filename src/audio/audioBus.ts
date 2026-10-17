import type { AudioLevels } from '../state/modulation';
import { clockNow } from '../state/clock';

// ---------------------------------------------------------------------------
// The latest audio analysis in this window: the editor publishes what its
// audio input measures and forwards it to output windows, which publish it
// here too. Renderers and meters read it every frame. Old analysis counts
// as silence, so outputs go quiet when the editor's input stops.
// ---------------------------------------------------------------------------

export interface AudioSnapshot {
  at: number; // when it was measured (clock time base)
  levels: AudioLevels;
  spectrum: Uint8Array; // FFT bins 0 Hz … Nyquist, 0..255
  waveform: Uint8Array; // the last samples, 128 = silence
}

// Older than this is silence
export const AUDIO_STALE_MS = 500;

let latest: AudioSnapshot | null = null;
let version = 0;

export const publishAudio = (snapshot: AudioSnapshot): void => {
  latest = snapshot;
  version++;
};

export const clearAudio = (): void => {
  latest = null;
  version++;
};

/** The analysis if it is recent, else null (no input, or it stopped). */
export const currentAudio = (now = clockNow()): AudioSnapshot | null =>
  latest && now - latest.at < AUDIO_STALE_MS ? latest : null;

/** Changes with every new analysis — renderers upload textures only then. */
export const audioVersion = (): number => version;
