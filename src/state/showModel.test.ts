import { describe, expect, it } from 'vitest';
import type { MediaFrame } from '../types';
import { allClips, emptyShow, findClip, framesFromShow, showFromFrames, type IdFactory } from './showModel';

const frame = (id: string, overrides: Partial<MediaFrame> = {}): MediaFrame => ({
  id, type: 'video', url: 'blob:x', mediaId: `media-${id}`, filename: `${id}.mp4`, name: `Surface ${id}`,
  x: 10, y: 20, width: 300, height: 200, rotation: 0, shape: 'rectangle', textureMode: 'clip',
  loop: true, opacity: 1, zIndex: 0, playbackRate: 1, muted: true,
  blur: 0, brightness: 100, contrast: 100, grayscale: 0, saturate: 100, hueRotate: 0, invert: 0, sepia: 0,
  blendMode: 'normal', flipHorizontal: false, flipVertical: false, lockAspectRatio: true,
  contentScale: 1, contentOffsetX: 0, contentOffsetY: 0, perspectiveMode: false,
  perspectiveCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
  visible: true, testPattern: false, softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
  ...overrides,
});

const counterIds = (): IdFactory => {
  let n = 0;
  return kind => `${kind}-${++n}`;
};

const strip = ({ layerId, ...rest }: MediaFrame) => {
  void layerId;
  return rest;
};

describe('frames ⇄ show', () => {
  it('round-trips frames without losing anything', () => {
    const frames = [
      frame('a', { opacity: 0.5, blendMode: 'screen', blur: 3, contentScale: 1.5, perspectiveMode: true }),
      frame('b', { shape: 'polygon', vertices: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], url: '', mediaId: undefined, filename: undefined, type: 'image' }),
    ];
    const show = showFromFrames(emptyShow(), frames, counterIds());
    expect(show.surfaces).toHaveLength(2);
    expect(show.layers).toHaveLength(2);
    expect(framesFromShow(show).map(strip)).toEqual(frames);
  });

  it('puts every field where it belongs', () => {
    const show = showFromFrames(emptyShow(), [frame('a', { opacity: 0.4, blendMode: 'multiply', hueRotate: 90, x: 99 })], counterIds());
    const [surface] = show.surfaces;
    const [layer] = show.layers;
    const clip = findClip(layer, layer.activeClipId)!;
    expect(surface.x).toBe(99);
    expect(surface.layerId).toBe(layer.id);
    expect(layer.opacity).toBe(0.4);
    expect(layer.blendMode).toBe('multiply');
    expect(clip.hueRotate).toBe(90);
    expect(clip.source.mediaId).toBe('media-a');
    expect(layer.slots[0]).toBe(clip); // column 1
    expect(layer.slots).toHaveLength(show.columns.length);
  });

  it('keeps unchanged frames (and surfaces) as the same objects', () => {
    const ids = counterIds();
    const show = showFromFrames(emptyShow(), [frame('a'), frame('b')], ids);
    const before = framesFromShow(show);
    const edited = before.map(f => (f.id === 'b' ? { ...f, x: 500 } : f));
    const nextShow = showFromFrames(show, edited, ids);
    const after = framesFromShow(nextShow, before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].x).toBe(500);
    expect(nextShow.surfaces[0]).toBe(show.surfaces[0]);
    expect(nextShow.layers).toEqual(show.layers);
  });

  it('edits the active clip instead of adding clips', () => {
    const ids = counterIds();
    let show = showFromFrames(emptyShow(), [frame('a')], ids);
    show = showFromFrames(show, framesFromShow(show).map(f => ({ ...f, url: 'blob:new', mediaId: 'media-new' })), ids);
    expect(allClips(show)).toHaveLength(1);
    expect(allClips(show)[0].source.mediaId).toBe('media-new');
  });

  it('removes a layer with its last surface but keeps show-only layers', () => {
    const ids = counterIds();
    const show = showFromFrames(emptyShow(), [frame('a'), frame('b')], ids);
    const withSpare = { ...show, layers: [...show.layers, { id: 'spare', name: 'Spare', opacity: 1, blendMode: 'normal' as const, slots: [], activeClipId: null }] };
    const next = showFromFrames(withSpare, framesFromShow(withSpare).filter(f => f.id !== 'a'), ids);
    expect(next.surfaces.map(s => s.id)).toEqual(['b']);
    expect(next.layers.map(l => l.id)).toEqual([show.layers[1].id, 'spare']);
  });

  it('lets surfaces share a layer: mix and content edits reach both', () => {
    const ids = counterIds();
    const show = showFromFrames(emptyShow(), [frame('a'), frame('b')], ids);
    const shared = { ...show, surfaces: show.surfaces.map(s => ({ ...s, layerId: show.layers[0].id })), layers: [show.layers[0]] };
    const frames = framesFromShow(shared);
    const next = showFromFrames(shared, frames.map(f => (f.id === 'b' ? { ...f, opacity: 0.3 } : f)), ids);
    expect(framesFromShow(next).map(f => f.opacity)).toEqual([0.3, 0.3]);
  });

  it('gives frames without media an empty clip so their settings persist', () => {
    const show = showFromFrames(emptyShow(), [frame('a', { url: '', mediaId: undefined, filename: undefined, blur: 4 })], counterIds());
    expect(framesFromShow(show)[0].blur).toBe(4);
  });
});
