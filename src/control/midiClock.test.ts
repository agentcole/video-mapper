import { describe, expect, it } from 'vitest';
import { ClockFollower, TICKS_PER_BEAT } from './midiClock';

const ticks = (follower: ClockFollower, bpm: number, count: number, from: number, jitter = 0) => {
  const ms = 60_000 / bpm / TICKS_PER_BEAT;
  let seed = 3;
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    follower.tick(from + i * ms + (seed / 2147483648 - 0.5) * 2 * jitter);
  }
};

describe('ClockFollower', () => {
  it('needs a beat of ticks', () => {
    const f = new ClockFollower();
    ticks(f, 120, 10, 0);
    expect(f.clock()).toBeNull();
  });

  it('fits the tempo through jitter', () => {
    const f = new ClockFollower();
    ticks(f, 128, 200, 1000, 1.5);
    expect(f.clock()!.bpm).toBeCloseTo(128, 1);
    expect(f.clock()!.origin).toBeNull(); // joined mid-song: tempo only
  });

  it('knows the bar after Start: tick 0 is beat 0', () => {
    const f = new ClockFollower();
    f.start();
    ticks(f, 120, 100, 5000, 1);
    const c = f.clock()!;
    expect(c.bpm).toBeCloseTo(120, 1);
    expect(Math.abs(c.origin! - 5000)).toBeLessThan(2);
    expect(f.running).toBe(true);
    f.stop();
    expect(f.running).toBe(false);
  });

  it('takes the position from a Song Position Pointer', () => {
    const f = new ClockFollower();
    f.songPosition(16); // 16 sixteenths = 4 beats in
    f.continue();
    ticks(f, 120, 48, 10_000);
    // 4 beats at 120 BPM before the first tick
    expect(f.clock()!.origin!).toBeCloseTo(10_000 - 2000, 0);
  });

  it('starts over after a dropout', () => {
    const f = new ClockFollower();
    f.start();
    ticks(f, 120, 50, 0);
    ticks(f, 90, 50, 10_000);
    expect(f.clock()!.bpm).toBeCloseTo(90, 1);
    expect(f.clock()!.origin).toBeNull();
  });
});
