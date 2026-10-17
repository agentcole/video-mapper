import { describe, expect, it } from 'vitest';
import {
  crossfadeGain, fadeProgress, sameTransition, transitionLabel, transitionMs,
} from './transitions';

describe('transitions', () => {
  it('measures in seconds or beats', () => {
    expect(transitionMs(undefined, 120)).toBe(0);
    expect(transitionMs({ duration: 0 }, 120)).toBe(0);
    expect(transitionMs({ duration: 0.5 }, 120)).toBe(500);
    expect(transitionMs({ duration: 2, beats: true }, 120)).toBe(1000);
    expect(transitionMs({ duration: 2, beats: true }, 60)).toBe(2000);
  });

  it('labels and compares', () => {
    expect(transitionLabel(undefined)).toBe('Cut');
    expect(transitionLabel({ duration: 1 })).toBe('1 s');
    expect(transitionLabel({ duration: 1, beats: true })).toBe('1 beat');
    expect(transitionLabel({ duration: 4, beats: true })).toBe('4 beats');
    expect(sameTransition(undefined, { duration: 0 })).toBe(true);
    expect(sameTransition({ duration: 1 }, { duration: 1, beats: true })).toBe(false);
  });

  it('runs linearly from the start', () => {
    expect(fadeProgress(1000, 500, 1000)).toBe(0);
    expect(fadeProgress(1000, 500, 1250)).toBe(0.5);
    expect(fadeProgress(1000, 500, 2000)).toBe(1);
    expect(fadeProgress(1000, 0, 1000)).toBe(1);
  });
});

describe('crossfader', () => {
  it('keeps both sides full in the middle', () => {
    expect(crossfadeGain('A', 0)).toBe(1);
    expect(crossfadeGain('A', 0.5)).toBe(1);
    expect(crossfadeGain('A', 0.75)).toBe(0.5);
    expect(crossfadeGain('A', 1)).toBe(0);
    expect(crossfadeGain('B', 0)).toBe(0);
    expect(crossfadeGain('B', 0.25)).toBe(0.5);
    expect(crossfadeGain('B', 0.5)).toBe(1);
    expect(crossfadeGain(undefined, 0)).toBe(1);
  });

});
