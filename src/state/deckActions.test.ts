import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeatSnap } from '../types';
import { DEFAULT_TEMPO } from '../lib/defaults';
import { projectStore } from './projectStore';
import { liveStore } from './liveStore';
import { createClip, createColumns, type Layer } from './showModel';
import { clockNow } from './clock';
import { clearLayer, cueColumn, go, pressClip, triggerColumn } from './deckActions';
import { resyncBar, setBpm, tapTempo } from './clockActions';

const clip = (id: string) => createClip(id, { type: 'video', url: `blob:${id}` });

const layer = (id: string, clipIds: (string | null)[], activeClipId: string | null = null): Layer => ({
  id,
  name: id,
  opacity: 1,
  blendMode: 'normal',
  slots: [...clipIds.map(c => (c ? clip(c) : null)), ...Array(8 - clipIds.length).fill(null)],
  activeClipId,
});

const active = () => Object.fromEntries(projectStore.getState().layers.map(l => [l.id, l.activeClipId]));
const scheduled = () => liveStore.getState().scheduled;

// 120 BPM in 4/4: a beat every 500 ms, a bar every 2 s, starting now
const setup = (beatSnap: BeatSnap) => {
  projectStore.getState().replaceDocument({
    columns: createColumns(),
    layers: [layer('A', ['a1', 'a2'], 'a1'), layer('B', ['b1', 'b2'])],
    surfaces: [],
    tempo: { ...DEFAULT_TEMPO, bpm: 120, beatSnap },
  });
  liveStore.setState({ clockOrigin: clockNow(), scheduled: [], cuedColumn: null, layerTriggers: {} });
};

describe('beat snap', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] }));
  afterEach(() => vi.useRealTimers());

  it('starts right away when beat snap is off', () => {
    setup('off');
    vi.advanceTimersByTime(300);
    pressClip('A', 'a2');
    expect(active().A).toBe('a2');
    expect(scheduled()).toEqual([]);
  });

  it('waits for the next bar, then starts the clip', () => {
    setup('bar');
    vi.advanceTimersByTime(300);
    pressClip('A', 'a2');
    expect(active().A).toBe('a1');
    expect(scheduled()).toHaveLength(1);
    vi.advanceTimersByTime(1690);
    expect(active().A).toBe('a1');
    vi.advanceTimersByTime(20);
    expect(active().A).toBe('a2');
    expect(scheduled()).toEqual([]);
    expect(liveStore.getState().layerTriggers.A).toBe(1);
  });

  it('counts a slightly late press as on the beat, and Alt fires now', () => {
    setup('bar');
    vi.advanceTimersByTime(2030); // 30 ms after the bar
    pressClip('B', 'b1');
    expect(active().B).toBe('b1');
    vi.advanceTimersByTime(500);
    pressClip('B', 'b2', { now: true });
    expect(active().B).toBe('b2');
  });

  it('uses a clip’s own beat snap over the composition’s', () => {
    setup('4bars');
    projectStore.getState().setShow(show => ({
      ...show,
      layers: show.layers.map(l => ({ ...l, slots: l.slots.map(c => (c?.id === 'b1' ? { ...c, beatSnap: 'beat' as const } : c)) })),
    }));
    vi.advanceTimersByTime(100);
    pressClip('B', 'b1');
    vi.advanceTimersByTime(400);
    expect(active().B).toBe('b1'); // next beat, not 4 bars
  });

  it('lets the later press win', () => {
    setup('bar');
    vi.advanceTimersByTime(300);
    pressClip('A', 'a2');
    pressClip('B', 'b2');
    triggerColumn(0); // replaces both clip triggers
    expect(scheduled().map(t => t.kind)).toEqual(['column']);
    pressClip('B', 'b2'); // after the column: wins on its layer
    vi.advanceTimersByTime(1700);
    expect(active()).toEqual({ A: 'a1', B: 'b2' });
  });

  it('takes back a toggle press and cancels with clear', () => {
    setup('bar');
    projectStore.getState().setShow(show => ({
      ...show,
      layers: show.layers.map(l => ({ ...l, slots: l.slots.map(c => (c ? { ...c, triggerStyle: 'toggle' as const } : c)) })),
    }));
    vi.advanceTimersByTime(300);
    pressClip('A', 'a1'); // playing: stop on the bar
    expect(scheduled()).toMatchObject([{ kind: 'clip', layerId: 'A', clipId: null }]);
    pressClip('A', 'a1'); // again: never mind
    expect(scheduled()).toEqual([]);
    pressClip('B', 'b1');
    clearLayer('B');
    expect(scheduled()).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(active()).toEqual({ A: 'a1', B: null });
  });

  it('fires Go on the bar and cues the next column', () => {
    setup('bar');
    cueColumn(1);
    vi.advanceTimersByTime(300);
    go();
    go(); // already waiting
    expect(scheduled()).toHaveLength(1);
    expect(liveStore.getState().cuedColumn).toBe(1);
    vi.advanceTimersByTime(1700);
    expect(active()).toEqual({ A: 'a2', B: 'b2' });
    expect(liveStore.getState().cuedColumn).toBe(2);
  });

  it('moves waiting triggers with the clock', () => {
    setup('bar');
    vi.advanceTimersByTime(300);
    pressClip('A', 'a2'); // bar at 2000
    setBpm(60); // at beat 0.6: the next bar (beat 4) is now 3.4 s away
    vi.advanceTimersByTime(1800);
    expect(active().A).toBe('a1');
    vi.advanceTimersByTime(1600);
    expect(active().A).toBe('a2');

    vi.advanceTimersByTime(100);
    pressClip('A', 'a1'); // waits for the next bar, 3.9 s away
    expect(active().A).toBe('a2');
    vi.advanceTimersByTime(3800);
    resyncBar(); // the one comes 100 ms early: the trigger goes with it
    expect(active().A).toBe('a1');

    vi.advanceTimersByTime(100);
    pressClip('A', 'a2'); // next bar 3.9 s away
    vi.advanceTimersByTime(1000);
    resyncBar(); // a new bar starts now: the next one is 4 s away
    vi.advanceTimersByTime(3900);
    expect(active().A).toBe('a1');
    vi.advanceTimersByTime(100);
    expect(active().A).toBe('a2');
  });
});

describe('tap tempo', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
  afterEach(() => vi.useRealTimers());

  it('sets the tempo and the downbeat from taps', () => {
    setup('off');
    vi.advanceTimersByTime(5000);
    const first = clockNow();
    for (let i = 0; i < 4; i++) {
      tapTempo();
      vi.advanceTimersByTime(400);
    }
    expect(projectStore.getState().tempo.bpm).toBe(150);
    expect(liveStore.getState().clockOrigin).toBeCloseTo(first, 6);
  });
});
