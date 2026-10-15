import { describe, expect, it } from 'vitest';
import { compareVersions, parseProjectData, PROJECT_VERSION } from './projectSchema';

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
