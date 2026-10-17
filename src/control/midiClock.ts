// ---------------------------------------------------------------------------
// Following an external MIDI clock (pure): 24 clock ticks per beat. The
// tempo is a least-squares fit over the last ticks, like tap tempo. After a
// Start (or a Song Position Pointer + Continue) the tick count says where
// the bar is: tick 0 is the start of the song, and so of a bar.
// ---------------------------------------------------------------------------

export const TICKS_PER_BEAT = 24;
const WINDOW = 4 * TICKS_PER_BEAT; // ticks in the tempo fit
const MIN_TICKS = TICKS_PER_BEAT; // a beat of ticks before a tempo
const DROPOUT_MS = 500; // a gap this long: the clock stopped, start over

export interface ExternalClock {
  bpm: number;
  origin: number | null; // time of beat 0 (a bar start) when the position is known
}

export class ClockFollower {
  private ticks: { index: number; time: number }[] = [];
  private index = -1; // ticks since the song start (when known); the first tick is 0
  private aligned = false; // index counts from the song start (Start / SPP seen)
  private pendingStart = false; // the next tick is tick 0
  running = false;

  /** A clock tick at `time` (ms). */
  tick(time: number): void {
    const last = this.ticks[this.ticks.length - 1];
    if (last && time - last.time > DROPOUT_MS) {
      // The clock stopped and came back: the tempo starts over, the position is unknown
      this.ticks = [];
      this.aligned = false;
    }
    if (this.pendingStart) {
      this.index = 0;
      this.pendingStart = false;
    } else {
      this.index++;
    }
    this.ticks.push({ index: this.index, time });
    if (this.ticks.length > WINDOW) this.ticks.shift();
  }

  /** Start: the song starts over; the next tick is its first. */
  start(): void {
    this.ticks = [];
    this.pendingStart = true;
    this.aligned = true;
    this.running = true;
  }

  continue(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  /** Song Position Pointer (in 16ths = 6 ticks): the next tick is at this position. */
  songPosition(sixteenths: number): void {
    this.ticks = [];
    this.index = sixteenths * 6 - 1;
    this.pendingStart = false;
    this.aligned = true;
  }

  /** The tempo (and where beat 0 is, when known), or null before enough ticks. */
  clock(): ExternalClock | null {
    const n = this.ticks.length;
    if (n < MIN_TICKS) return null;
    const meanIndex = this.ticks.reduce((s, t) => s + t.index, 0) / n;
    const meanTime = this.ticks.reduce((s, t) => s + t.time, 0) / n;
    let covariance = 0;
    let variance = 0;
    for (const t of this.ticks) {
      covariance += (t.index - meanIndex) * (t.time - meanTime);
      variance += (t.index - meanIndex) ** 2;
    }
    if (!(variance > 0) || !(covariance > 0)) return null;
    const msPerTick = covariance / variance;
    const bpm = 60_000 / (msPerTick * TICKS_PER_BEAT);
    return { bpm, origin: this.aligned ? meanTime - meanIndex * msPerTick : null };
  }
}
