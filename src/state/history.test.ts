import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFrame } from '../types';
import { createProjectStore } from './projectStore';
import { createHistory } from './history';
import { placeClip, setActiveClip } from './deck';
import { createClip } from './showModel';

const frame = (id: string, x = 0): MediaFrame => ({ id, x } as MediaFrame);

describe('project history', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const store = createProjectStore({ frames: [frame('a')] });
    const history = createHistory(store, { debounceMs: 400 });
    history.reset();
    return { store, history };
  };

  it('collapses a gesture into one undo step', () => {
    const { store, history } = setup();
    for (let x = 1; x <= 10; x++) {
      store.getState().updateFrame('a', { x });
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(400);
    expect(store.getState().frames[0].x).toBe(10);
    history.undo();
    expect(store.getState().frames[0].x).toBe(0);
    history.redo();
    expect(store.getState().frames[0].x).toBe(10);
  });

  it('undoes a change that is still inside the debounce window', () => {
    const { store, history } = setup();
    store.getState().setFrames(prev => [...prev, frame('b')]);
    history.undo();
    expect(store.getState().frames.map(f => f.id)).toEqual(['a']);
  });

  it('a new change clears the redo stack', () => {
    const { store, history } = setup();
    store.getState().updateFrame('a', { x: 5 });
    vi.advanceTimersByTime(400);
    history.undo();
    store.getState().updateFrame('a', { x: 7 });
    vi.advanceTimersByTime(400);
    expect(history.canRedo()).toBe(false);
    history.redo();
    expect(store.getState().frames[0].x).toBe(7);
  });

  it('ignores grid changes and anything before reset()', () => {
    const store = createProjectStore({ frames: [frame('a')] });
    const history = createHistory(store, { debounceMs: 400 });
    store.getState().updateFrame('a', { x: 3 }); // before reset → not tracked
    vi.advanceTimersByTime(400);
    history.reset();
    store.getState().setGrid(prev => ({ ...prev, show: !prev.show }));
    vi.advanceTimersByTime(400);
    expect(history.canUndo()).toBe(false);
  });

  it('never undoes what is playing (triggers are not edits)', () => {
    const store = createProjectStore({ frames: [frame('a')] });
    const history = createHistory(store, { debounceMs: 400 });
    const layerId = store.getState().layers[0].id;
    const first = store.getState().layers[0].activeClipId!;
    store.getState().setShow(show => placeClip(show, { layerId, column: 1 }, createClip('clip-2', { type: 'image', url: 'b.png' })));
    history.reset();

    store.getState().setShow(show => setActiveClip(show, layerId, 'clip-2'));
    vi.advanceTimersByTime(400);
    expect(history.canUndo()).toBe(false);

    store.getState().updateFrame('a', { x: 9 });
    vi.advanceTimersByTime(400);
    store.getState().setShow(show => setActiveClip(show, layerId, first));
    history.undo(); // the move, not the trigger
    expect(store.getState().frames[0].x).toBe(0);
    expect(store.getState().layers[0].activeClipId).toBe(first);
    history.redo();
    expect(store.getState().frames[0].x).toBe(9);
    expect(store.getState().layers[0].activeClipId).toBe(first);
  });

  it('undoes deck edits like any other edit', () => {
    const store = createProjectStore({ frames: [frame('a')] });
    const history = createHistory(store, { debounceMs: 400 });
    history.reset();
    const layerId = store.getState().layers[0].id;
    store.getState().setShow(show => placeClip(show, { layerId, column: 3 }, createClip('clip-x', { type: 'image', url: 'x.png' })));
    history.undo();
    expect(store.getState().layers[0].slots[3]).toBeNull();
  });

  it('respects the history limit', () => {
    const store = createProjectStore({ frames: [frame('a')] });
    const history = createHistory(store, { debounceMs: 10, limit: 3 });
    history.reset();
    for (let x = 1; x <= 6; x++) {
      store.getState().updateFrame('a', { x });
      vi.advanceTimersByTime(10);
    }
    history.undo();
    history.undo();
    history.undo();
    history.undo(); // nothing left
    expect(store.getState().frames[0].x).toBe(3);
  });
});

describe('screens in the history', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('undoes screen edits', () => {
    const store = createProjectStore();
    const history = createHistory(store, { debounceMs: 400 });
    history.reset();
    store.getState().setScreens(() => [{ id: 's', name: 'Screen 1', width: 1920, height: 1080, slices: [] }]);
    vi.advanceTimersByTime(400);
    history.undo();
    expect(store.getState().screens).toEqual([]);
    history.redo();
    expect(store.getState().screens.map(s => s.id)).toEqual(['s']);
  });
});
