import { describe, expect, it } from 'vitest';
import { compareVersions, parseProjectData, PROJECT_VERSION } from './projectSchema';
import { DEFAULT_TEMPO } from './defaults';

// A frame as older project files stored it — fields added later are missing
const legacyFrame = (overrides: Record<string, unknown> = {}) => ({
  id: 'frame-1',
  type: 'image',
  url: '',
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  rotation: 0,
  shape: 'rectangle',
  loop: true,
  opacity: 1,
  zIndex: 0,
  playbackRate: 1,
  muted: false,
  blur: 0,
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  saturate: 100,
  hueRotate: 0,
  invert: 0,
  sepia: 0,
  blendMode: 'normal',
  flipHorizontal: false,
  flipVertical: false,
  lockAspectRatio: true,
  ...overrides,
});

describe('parseProjectData', () => {
  it('rejects data that is not a project', () => {
    expect(() => parseProjectData(null)).toThrow('Invalid project file format');
    expect(() => parseProjectData({ frames: 'nope' })).toThrow('Invalid project file format');
  });

  it('fills in fields added in later versions', () => {
    const { frames, grid, composition, background, warnings } = parseProjectData({ frames: [legacyFrame()] });
    const [frame] = frames;
    expect(frame.textureMode).toBe('clip');
    expect(frame.perspectiveMode).toBe(false);
    expect(frame.perspectiveCorners.tl).toEqual({ x: 0, y: 0 });
    expect(frame.visible).toBe(true);
    expect(frame.testPattern).toBe(false);
    expect(frame.softEdge).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(frame.contentScale).toBe(1);
    expect(grid.size).toBe(32);
    expect(composition).toEqual({ width: 1920, height: 1080 });
    expect(background.type).toBe('color');
    expect(warnings).toEqual([]);
  });

  it('skips broken layers instead of failing the whole project', () => {
    const { frames, warnings } = parseProjectData({
      version: '4.0.0',
      frames: [
        legacyFrame({ id: 'ok' }),
        legacyFrame({ id: 'nan', name: 'Broken', x: Number.NaN }),
        legacyFrame({ id: 'poly', shape: 'polygon' }),
        'garbage',
      ],
    });
    expect(frames.map(f => f.id)).toEqual(['ok']);
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain('"Broken"');
  });

  it('turns an old warp-mode quad into a corner-pinned rectangle on its vertices', () => {
    const [frame] = parseProjectData({
      version: '4.0.0',
      frames: [legacyFrame({
        shape: 'polygon',
        textureMode: 'warp',
        // counter-clockwise from bottom-right, as a user might have clicked it
        vertices: [{ x: 1, y: 1 }, { x: 0.9, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 1 }],
      })],
    }).frames;
    expect(frame.shape).toBe('rectangle');
    expect(frame.textureMode).toBe('clip');
    expect(frame.vertices).toBeUndefined();
    expect(frame.perspectiveMode).toBe(true);
    expect(frame.perspectiveCorners.tl.x).toBeCloseTo(20);
    expect(frame.perspectiveCorners.tl.y).toBeCloseTo(0);
    expect(frame.perspectiveCorners.tr.x).toBeCloseTo(-20);
    expect(frame.perspectiveCorners.br.x).toBeCloseTo(0);
    expect(frame.perspectiveCorners.bl.y).toBeCloseTo(0);
  });

  it('falls back to clipping for old warp-mode polygons that are not quads', () => {
    const [frame] = parseProjectData({
      frames: [legacyFrame({
        shape: 'polygon',
        textureMode: 'warp',
        vertices: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      })],
    }).frames;
    expect(frame.shape).toBe('polygon');
    expect(frame.textureMode).toBe('clip');
    expect(frame.vertices).toHaveLength(3);
  });

  it('runs migrations only for projects older than the migration', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const [frame] = parseProjectData({
      version: PROJECT_VERSION,
      frames: [legacyFrame({ shape: 'polygon', textureMode: 'warp', vertices })],
    }).frames;
    expect(frame.shape).toBe('polygon');
  });

  it('resets invalid settings and reports newer files', () => {
    const { background, composition, media, warnings } = parseProjectData({
      version: '99.0.0',
      frames: [],
      background: { type: 'hologram' },
      composition: { width: -5, height: 1080 },
      media: [{ id: 'm1', name: 'clip.mp4', type: 'video', mimeType: 'video/mp4', dataUrl: 'data:video/mp4;base64,AA' }, { id: 'x' }],
    });
    expect(background.type).toBe('color');
    expect(composition).toEqual({ width: 1920, height: 1080 });
    expect(media).toHaveLength(1);
    expect(warnings.some(w => w.includes('newer version'))).toBe(true);
    expect(warnings).toHaveLength(4);
  });
});

describe('format 5', () => {
  it('converts a legacy project into surfaces, layers and clips', () => {
    const project = parseProjectData({ version: '4.1.0', frames: [legacyFrame({ opacity: 0.5, blendMode: 'screen', mediaId: 'm1', type: 'video' })] });
    expect(project.surfaces).toHaveLength(1);
    expect(project.layers).toHaveLength(1);
    expect(project.columns.length).toBeGreaterThan(0);
    const [layer] = project.layers;
    expect(layer.opacity).toBe(0.5);
    expect(layer.blendMode).toBe('screen');
    expect(layer.slots[0]?.source.mediaId).toBe('m1');
    expect(layer.activeClipId).toBe(layer.slots[0]?.id);
    expect(project.surfaces[0].layerId).toBe(layer.id);
  });

  it('round-trips through the format-5 shape', () => {
    const legacy = parseProjectData({ frames: [legacyFrame({ hueRotate: 45 })] });
    const { surfaces, layers, columns } = legacy;
    const again = parseProjectData({ version: PROJECT_VERSION, surfaces, layers, columns });
    expect(again.frames).toEqual(legacy.frames);
    expect(again.warnings).toEqual([]);
  });

  it('keeps clip trigger styles and tolerates unknown ones', () => {
    const { surfaces, layers, columns } = parseProjectData({ frames: [legacyFrame()] });
    const withStyle = (triggerStyle: unknown) => [{ ...layers[0], slots: layers[0].slots.map(c => (c ? { ...c, triggerStyle } : c)) }];
    const piano = parseProjectData({ version: PROJECT_VERSION, surfaces, columns, layers: withStyle('piano') });
    expect(piano.layers[0].slots[0]?.triggerStyle).toBe('piano');
    const future = parseProjectData({ version: PROJECT_VERSION, surfaces, columns, layers: withStyle('hold-and-loop') });
    expect(future.layers[0].slots[0]).not.toBeNull();
    expect(future.layers[0].slots[0]?.triggerStyle).toBeUndefined();
  });

  it('reads the tempo and beat snap, repairing bad values one by one', () => {
    const { surfaces, layers, columns } = parseProjectData({ frames: [legacyFrame()] });
    expect(parseProjectData({ surfaces, layers, columns }).tempo).toEqual(DEFAULT_TEMPO); // before 5.2
    const withSnap = [{ ...layers[0], slots: layers[0].slots.map(c => (c ? { ...c, beatSnap: 'bar' } : c)) }];
    const project = parseProjectData({
      version: PROJECT_VERSION, surfaces, columns, layers: withSnap,
      tempo: { bpm: 128, beatsPerBar: 3, beatSnap: 'every-other-tuesday' },
    });
    expect(project.tempo).toEqual({ bpm: 128, beatsPerBar: 3, beatSnap: 'off' });
    expect(project.layers[0].slots[0]?.beatSnap).toBe('bar');
    expect(parseProjectData({ surfaces, layers, columns, tempo: { bpm: 9000 } }).tempo.bpm).toBe(DEFAULT_TEMPO.bpm);
  });

  it('reads transitions and crossfader sides, dropping broken ones', () => {
    const { surfaces, layers, columns } = parseProjectData({ frames: [legacyFrame()] });
    const layer = {
      ...layers[0],
      transition: { duration: 2, beats: true },
      crossfade: 'A',
      slots: layers[0].slots.map(c => (c ? { ...c, transition: { duration: -1 } } : c)),
    };
    const project = parseProjectData({ version: PROJECT_VERSION, surfaces, columns, layers: [layer] });
    expect(project.layers[0].transition).toEqual({ duration: 2, beats: true });
    expect(project.layers[0].crossfade).toBe('A');
    expect(project.layers[0].slots[0]?.transition).toBeUndefined(); // invalid: follows the layer
    const odd = parseProjectData({ version: PROJECT_VERSION, surfaces, columns, layers: [{ ...layer, crossfade: 'C' }] });
    expect(odd.layers[0].crossfade).toBeUndefined();
    expect(odd.warnings).toEqual([]);
  });

  it('reads effect stacks, generators and carried shaders, dropping broken entries', () => {
    const { surfaces, layers, columns } = parseProjectData({ frames: [legacyFrame()] });
    const ok = { id: 'e1', effectId: 'builtin:invert', enabled: true, params: { amount: 0.5, tint: [1, 0, 0, 1], on: true } };
    const layer = {
      ...layers[0],
      effects: [ok, { id: 'broken' }, 'nope'],
      slots: layers[0].slots.map(c => (c ? { ...c, effects: [{ ...ok, id: 'e2', params: { amount: 'loud' } }], generator: { effectId: 'builtin:plasma' } } : c)),
    };
    const project = parseProjectData({
      version: PROJECT_VERSION, surfaces, columns, layers: [layer],
      effects: [{ ...ok, id: 'e3', enabled: false }],
      shaders: [{ id: 'user:1', name: 'Mine', source: '/*{}*/' }, { id: 2 }],
    });
    expect(project.layers[0].effects).toEqual([ok]);
    expect(project.layers[0].slots[0]?.effects).toEqual([{ ...ok, id: 'e2', params: {} }]);
    expect(project.layers[0].slots[0]?.generator).toEqual({ effectId: 'builtin:plasma', params: {} });
    expect(project.effects).toEqual([{ ...ok, id: 'e3', enabled: false }]);
    expect(project.shaders).toEqual([{ id: 'user:1', name: 'Mine', source: '/*{}*/' }]);
    expect(parseProjectData({ surfaces, layers, columns }).effects).toEqual([]);
  });

  it('reads modulations, dropping broken ones, and always all macro faders', () => {
    const { surfaces, layers, columns } = parseProjectData({ frames: [legacyFrame()] });
    const lfo = { source: { kind: 'lfo', shape: 'sine', period: 4, beats: true }, amount: 0.5 };
    const bass = { source: { kind: 'audio', band: 'bass' }, amount: -1 };
    const effect = {
      id: 'e1', effectId: 'builtin:invert', enabled: true, params: {},
      mods: { amount: lfo, 'center.0': bass, broken: { source: { kind: 'midi' }, amount: 1 }, loud: { ...bass, amount: 3 } },
    };
    const layer = {
      ...layers[0],
      mods: { opacity: { source: { kind: 'macro', index: 2 }, amount: 1 } },
      slots: layers[0].slots.map(c => (c ? { ...c, generator: { effectId: 'builtin:plasma', mods: 'nope' } } : c)),
    };
    const project = parseProjectData({
      version: PROJECT_VERSION, surfaces, columns, layers: [layer], effects: [effect],
      macros: [{ name: 'Strobe', value: 0.25 }, { name: 'Bad', value: 7 }],
    });
    expect(project.effects[0].mods).toEqual({ amount: lfo, 'center.0': bass });
    expect(project.layers[0].mods).toEqual({ opacity: { source: { kind: 'macro', index: 2 }, amount: 1 } });
    expect(project.frames[0].layerMods).toEqual(project.layers[0].mods);
    expect(project.layers[0].slots[0]?.generator?.mods).toBeUndefined();
    expect(project.macros).toHaveLength(8);
    expect(project.macros[0]).toEqual({ name: 'Strobe', value: 0.25 });
    expect(project.macros[1]).toEqual({ name: 'Macro 2', value: 0 });
    // Before 5.5: default macros, no modulations
    const old = parseProjectData({ surfaces, layers, columns });
    expect(old.macros.map(m => m.name)).toEqual(Array.from({ length: 8 }, (_, i) => `Macro ${i + 1}`));
    expect(old.layers[0].mods).toBeUndefined();
  });

  it('skips broken clips and surfaces individually and repairs references', () => {
    const { surfaces, layers, columns } = parseProjectData({ frames: [legacyFrame()] });
    const project = parseProjectData({
      version: PROJECT_VERSION,
      columns,
      layers: [{ ...layers[0], slots: [{ id: 'bad', source: { type: 'hologram' } }, ...layers[0].slots.slice(1)] }],
      surfaces: [...surfaces, { ...surfaces[0], id: 's2', layerId: 'missing-layer' }, { id: 'broken' }],
    });
    expect(project.layers[0].activeClipId).toBeNull(); // its clip was invalid
    expect(project.surfaces.map(s => s.id)).toEqual([surfaces[0].id, 's2']);
    expect(project.layers.map(l => l.id)).toContain('missing-layer');
    expect(project.warnings).toHaveLength(3);
  });
});

describe('compareVersions', () => {
  it('compares numerically', () => {
    expect(compareVersions('4.10.0', '4.9.0')).toBeGreaterThan(0);
    expect(compareVersions('4.0.0', '4.1.0')).toBeLessThan(0);
    expect(compareVersions('4.1', '4.1.0')).toBe(0);
  });
});
