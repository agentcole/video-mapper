import { describe, expect, it } from 'vitest';
import {
  addColumn, addLayer, layersTopFirst, moveClip, onlyActiveClipsChanged, placeClip, preloadClips, preloadTargets,
  removeClip, setActiveClip, triggerColumn, updateClip,
} from './deck';
import { createClip, createColumns, type IdFactory, type Layer, type ShowDocument, type Surface } from './showModel';

const counterIds = (): IdFactory => {
  let n = 0;
  return kind => `${kind}-new-${++n}`;
};

const clip = (id: string) => createClip(id, { type: 'video', url: `blob:${id}`, mediaId: `media-${id}` });

const layer = (id: string, clipIds: (string | null)[], activeClipId: string | null = null): Layer => ({
  id,
  name: id,
  opacity: 1,
  blendMode: 'normal',
  slots: [...clipIds.map(c => (c ? clip(c) : null)), ...Array(8 - clipIds.length).fill(null)],
  activeClipId,
});

const surface = (id: string, layerId: string, zIndex: number, visible = true): Surface => ({
  id, layerId, zIndex, visible, testPattern: false, x: 0, y: 0, width: 100, height: 100, rotation: 0,
  shape: 'rectangle', lockAspectRatio: true, perspectiveMode: false,
  perspectiveCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
  softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
});

// Two layers: A (bottom) with clips in columns 1–2, B (top) with a clip in column 1 and 3
const show = (): ShowDocument => ({
  columns: createColumns(),
  layers: [layer('A', ['a1', 'a2'], 'a1'), layer('B', ['b1', null, 'b3'])],
  surfaces: [surface('sA', 'A', 0), surface('sB', 'B', 1)],
});

const active = (s: ShowDocument) => Object.fromEntries(s.layers.map(l => [l.id, l.activeClipId]));

describe('triggering', () => {
  it('plays a clip of the layer and ignores clips of other layers', () => {
    const s = show();
    expect(active(setActiveClip(s, 'A', 'a2'))).toEqual({ A: 'a2', B: null });
    expect(setActiveClip(s, 'A', 'b1')).toBe(s);
    expect(setActiveClip(s, 'A', 'a1')).toBe(s); // already playing: nothing changes
  });

  it('triggers a column and clears layers with an empty cell there', () => {
    const { show: next, started } = triggerColumn(show(), 1);
    expect(active(next)).toEqual({ A: 'a2', B: null });
    expect(started).toEqual(['A']);
    const third = triggerColumn(next, 2);
    expect(active(third.show)).toEqual({ A: null, B: 'b3' });
  });

  it('tells trigger changes apart from edits', () => {
    const s = show();
    expect(onlyActiveClipsChanged(setActiveClip(s, 'A', 'a2').layers, s.layers)).toBe(true);
    expect(onlyActiveClipsChanged(updateClip(s, 'a1', { blur: 2 }).layers, s.layers)).toBe(false);
    expect(onlyActiveClipsChanged(s.layers, s.layers)).toBe(false);
  });
});

describe('editing slots', () => {
  it('replacing the playing clip keeps the slot playing', () => {
    const next = placeClip(show(), { layerId: 'A', column: 0 }, clip('new'));
    expect(next.layers[0].slots[0]?.id).toBe('new');
    expect(next.layers[0].activeClipId).toBe('new');
  });

  it('removing the playing clip clears the layer', () => {
    const next = removeClip(show(), { layerId: 'A', column: 0 });
    expect(next.layers[0].slots[0]).toBeNull();
    expect(next.layers[0].activeClipId).toBeNull();
  });

  it('moves within a layer by swapping, and the clip keeps playing', () => {
    const next = moveClip(show(), { layerId: 'A', column: 0 }, { layerId: 'A', column: 1 });
    expect(next.layers[0].slots.slice(0, 2).map(c => c?.id)).toEqual(['a2', 'a1']);
    expect(next.layers[0].activeClipId).toBe('a1');
  });

  it('a clip moved to another layer stops playing; copies get a new id', () => {
    const moved = moveClip(show(), { layerId: 'A', column: 0 }, { layerId: 'B', column: 1 });
    expect(moved.layers[0].slots[0]).toBeNull();
    expect(moved.layers[0].activeClipId).toBeNull();
    expect(moved.layers[1].slots[1]?.id).toBe('a1');

    const copied = moveClip(show(), { layerId: 'A', column: 0 }, { layerId: 'B', column: 2 }, { copy: true, ids: counterIds() });
    expect(copied.layers[0].slots[0]?.id).toBe('a1');
    expect(copied.layers[1].slots[2]?.id).toBe('clip-new-1');
    expect(copied.layers[1].slots[2]?.source.mediaId).toBe('media-a1');
  });

  it('adds columns to every layer', () => {
    const next = addColumn(show(), counterIds());
    expect(next.columns).toHaveLength(9);
    expect(next.columns[8]).toEqual({ id: 'column-new-1', name: '9' });
    expect(next.layers.every(l => l.slots.length === 9)).toBe(true);
  });

  it('adds a layer on top with a surface filling the composition', () => {
    const { show: next, layerId, surfaceId } = addLayer(show(), { width: 1280, height: 720 }, counterIds());
    const added = next.surfaces.find(s => s.id === surfaceId)!;
    expect(added).toMatchObject({ layerId, x: 0, y: 0, width: 1280, height: 720, zIndex: 2 });
    expect(next.layers.find(l => l.id === layerId)?.slots).toHaveLength(8);
    expect(layersTopFirst(next)[0].id).toBe(layerId);
  });
});

describe('launcher order and preloading', () => {
  it('lists the top layer first and layers without surfaces last', () => {
    const s = show();
    const spare = layer('spare', []);
    expect(layersTopFirst({ ...s, layers: [spare, ...s.layers] }).map(l => l.id)).toEqual(['B', 'A', 'spare']);
  });

  it('preloads the cued column and the clip under the pointer, but not playing clips', () => {
    const s = show();
    const ids = (targets: Parameters<typeof preloadTargets>) => preloadClips(s, preloadTargets(...targets)).map(p => p.clip.id);
    expect(ids([0, null, []])).toEqual(['b1']); // a1 already plays
    expect(ids([1, 'b3', []])).toEqual(['a2', 'b3']);
    expect(ids([null, null, []])).toEqual([]);
    // Triggers waiting for their beat preload what they will start
    expect(ids([null, null, [
      { kind: 'column', column: 2, at: 0, beats: 4 },
      { kind: 'clip', layerId: 'a', clipId: 'a2', at: 0, beats: 1 },
      { kind: 'clip', layerId: 'b', clipId: null, at: 0, beats: 1 },
    ]])).toEqual(['a2', 'b3']);
  });
});
