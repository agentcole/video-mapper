import { describe, expect, it } from 'vitest';
import type { MediaFrame } from '../types';
import { migrateFrame } from './storage';

// Frames as older project files stored them — fields added later are missing
const legacyFrame = (overrides: Partial<MediaFrame>): MediaFrame => ({
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
} as MediaFrame);

describe('migrateFrame', () => {
  it('fills in fields added in later versions', () => {
    const frame = migrateFrame(legacyFrame({}));
    expect(frame.textureMode).toBe('clip');
    expect(frame.perspectiveMode).toBe(false);
    expect(frame.perspectiveCorners.tl).toEqual({ x: 0, y: 0 });
    expect(frame.visible).toBe(true);
    expect(frame.testPattern).toBe(false);
    expect(frame.softEdge).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(frame.contentScale).toBe(1);
  });

  it('turns an old warp-mode quad into a corner-pinned rectangle on its vertices', () => {
    const frame = migrateFrame(legacyFrame({
      shape: 'polygon',
      textureMode: 'warp',
      // counter-clockwise from bottom-right, as a user might have clicked it
      vertices: [{ x: 1, y: 1 }, { x: 0.9, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 1 }],
    }));
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

  it('falls back to clipping for warp-mode polygons that are not quads', () => {
    const frame = migrateFrame(legacyFrame({
      shape: 'polygon',
      textureMode: 'warp',
      vertices: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    }));
    expect(frame.shape).toBe('polygon');
    expect(frame.textureMode).toBe('clip');
    expect(frame.vertices).toHaveLength(3);
  });
});
