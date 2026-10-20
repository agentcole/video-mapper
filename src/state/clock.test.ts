import { describe, expect, it } from 'vitest';
import {
  addTap, alignClock, barPosition, beatAt, beatError, clampBpm, retime, snapBeats, snapTime, timeOfBeat, type Tap,
} from './clock';

const clock = { bpm: 120, origin: 1000 }; // a beat every 500 ms, bar starts at 1000

describe('clock', () => {
  it('counts beats from the origin', () => {
    expect(beatAt(clock, 1000)).toBe(0);
    expect(beatAt(clock, 2250)).toBe(2.5);
    expect(beatAt(clock, 500)).toBe(-1);
    expect(timeOfBeat(clock, 4)).toBe(3000);
  });

  it('keeps the phase when the tempo changes', () => {
    const now = 2250; // beat 2.5
    const faster = retime(clock, 140, now);
    expect(faster.bpm).toBe(140);
    expect(beatAt(faster, now)).toBeCloseTo(2.5, 9);
  });

  it('places time in bars and beats', () => {
    expect(barPosition(clock, 1000, 4)).toEqual({ bar: 0, beat: 0, phase: 0 });
    expect(barPosition(clock, 3250, 4)).toEqual({ bar: 1, beat: 0, phase: 0.5 });
    expect(barPosition(clock, 3250, 3)).toEqual({ bar: 1, beat: 1, phase: 0.5 });
    // Before the origin the bar count goes negative, the beat stays in the bar
    expect(barPosition(clock, 750, 4)).toEqual({ bar: -1, beat: 3, phase: 0.5 });
  });

  it('clamps tempos', () => {
    expect(clampBpm(5)).toBe(20);
    expect(clampBpm(1000)).toBe(400);
    expect(clampBpm(128.456)).toBe(128.46);
    expect(clampBpm(Number.NaN)).toBe(120);
  });
});

describe('beat snap', () => {
  it('converts snap settings to beats', () => {
    expect(snapBeats('off', 4)).toBe(0);
    expect(snapBeats('beat', 4)).toBe(1);
    expect(snapBeats('bar', 3)).toBe(3);
    expect(snapBeats('2bars', 4)).toBe(8);
    expect(snapBeats('4bars', 4)).toBe(16);
  });

  it('waits for the next boundary', () => {
    expect(snapTime(clock, 1200, 0)).toBe(1200); // off
    expect(snapTime(clock, 1200, 1)).toBe(1500); // next beat
    expect(snapTime(clock, 1200, 4)).toBe(3000); // next bar
    expect(snapTime(clock, 3200, 8)).toBe(5000); // next 2-bar phrase
  });

  it('counts a press just after a boundary as on it', () => {
    expect(snapTime(clock, 3030, 4)).toBe(3030); // 30 ms late for the bar: now
    expect(snapTime(clock, 3080, 4)).toBe(5000); // too late: the next bar
    expect(snapTime(clock, 3030, 4, 0)).toBe(5000);
  });
});

describe('tap tempo', () => {
  const tapAll = (times: number[]) => {
    let taps: Tap[] = [];
    let result = null;
    for (const time of times) {
      result = addTap(taps, time) ?? result;
      if (result) taps = result.taps;
    }
    return result!;
  };

  it('starts a sequence on the first tap (the downbeat)', () => {
    const first = addTap([], 5000)!;
    expect(first.bpm).toBeNull();
    expect(first.origin).toBe(5000);
  });

  it('fits the tempo and phase to steady taps', () => {
    const result = tapAll([1000, 1500, 2000, 2500]);
    expect(result.bpm).toBe(120);
    expect(result.origin).toBeCloseTo(1000, 6);
  });

  it('averages out jitter', () => {
    const result = tapAll([1000, 1480, 2010, 2495, 3005, 3490, 4000]);
    expect(result.bpm).toBeGreaterThan(119);
    expect(result.bpm).toBeLessThan(121);
    expect(Math.abs(result.origin - 1000)).toBeLessThan(15);
  });

  it('ignores bounces and restarts after a pause', () => {
    const taps = tapAll([1000, 1500]).taps;
    expect(addTap(taps, 1530)).toBeNull();
    const restarted = addTap(taps, 1500 + 2500)!;
    expect(restarted.bpm).toBeNull();
    expect(restarted.origin).toBe(4000);
  });

  it('follows a tempo change, keeping the beat count', () => {
    // 120 BPM, then 150 BPM (400 ms)
    const result = tapAll([1000, 1500, 2000, 2500, 2900, 3300]);
    expect(result.bpm).toBeCloseTo(150, 0);
    const last = result.taps[result.taps.length - 1];
    expect(last.index).toBe(5);
    // The last tap still lands on its beat
    expect(beatAt({ bpm: result.bpm!, origin: result.origin }, 3300)).toBeCloseTo(5, 6);
  });
});

describe('alignClock', () => {
  it('moves the beat grid onto a beat time, keeping the bar count', () => {
    const clock = { bpm: 120, origin: 0 };
    // A beat heard at 10 020 ms: beat 20 of the old grid, 20 ms later
    expect(alignClock(clock, 120, 10_020, 10_100)).toEqual({ bpm: 120, origin: 20 });
    // Earlier than the grid: the shift goes the other way, never more than half a beat
    expect(alignClock(clock, 120, 9_760, 10_100).origin).toBe(-240);
  });

  it('takes the new tempo from now on', () => {
    const aligned = alignClock({ bpm: 120, origin: 0 }, 128, 10_000, 10_000);
    expect(aligned.bpm).toBe(128);
    expect(beatError(aligned, 10_000)).toBeCloseTo(0);
    expect(beatError(aligned, 10_000 + 60_000 / 128 * 7)).toBeCloseTo(0);
    // Same beat number as before (beat 20 at 120 BPM)
    expect(beatAt(aligned, 10_000)).toBeCloseTo(20);
  });

  it('measures the distance to the nearest beat', () => {
    expect(beatError({ bpm: 120, origin: 0 }, 1_030)).toBeCloseTo(30);
    expect(beatError({ bpm: 120, origin: 0 }, 1_480)).toBeCloseTo(20);
  });
});
