import { afterEach, describe, expect, it, vi } from 'vitest';
import { markTriggered, reportFirstFrame, startStatsStore } from './startStats';

describe('clip start latency', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports the slowest layer of a trigger, once per layer', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    markTriggered(['a', 'b']);
    reportFirstFrame('a', true, 1012);
    expect(startStatsStore.getState().last).toEqual({ ms: 12, preloaded: true });
    reportFirstFrame('b', false, 1090);
    expect(startStatsStore.getState().last).toEqual({ ms: 90, preloaded: false });
    reportFirstFrame('b', true, 1500); // already counted
    reportFirstFrame('other', true, 1001); // not part of this trigger
    expect(startStatsStore.getState().last).toEqual({ ms: 90, preloaded: false });
  });
});
