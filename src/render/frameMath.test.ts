import { describe, expect, it } from 'vitest';
import type { MediaFrame, Point } from '../types';
import { applyHomography, frameLocalToComp, getFrameHomography } from '../lib/geometry';
import { boxToElementUV, compToBox, coverUV, frameRenderParams } from './frameMath';

const frame = (overrides: Partial<MediaFrame> = {}): MediaFrame => ({
  id: 'f', type: 'image', url: '', x: 300, y: 200, width: 400, height: 250, rotation: 0,
  shape: 'rectangle', textureMode: 'clip', loop: true, opacity: 1, zIndex: 0, playbackRate: 1, muted: true,
  blur: 0, brightness: 100, contrast: 100, grayscale: 0, saturate: 100, hueRotate: 0, invert: 0, sepia: 0,
  blendMode: 'normal', flipHorizontal: false, flipVertical: false, lockAspectRatio: true,
  contentScale: 1, contentOffsetX: 0, contentOffsetY: 0, perspectiveMode: false,
  perspectiveCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
  visible: true, testPattern: false, softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
  ...overrides,
});

const close = (a: Point, b: Point, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

const warped = frame({
  rotation: 17,
  perspectiveMode: true,
  perspectiveCorners: { tl: { x: 40, y: 20 }, tr: { x: -30, y: 10 }, br: { x: 15, y: -25 }, bl: { x: -5, y: 0 } },
});

describe('compToBox', () => {
  it('maps the drawn quad corners back onto the box corners', () => {
    const p = frameRenderParams(warped);
    const corners = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 250 }, { x: 0, y: 250 }];
    p.quad.forEach((q, i) => close(compToBox(p, q.x, q.y), corners[i], 6));
  });

  it('inverts the CSS forward mapping for interior points', () => {
    const p = frameRenderParams(warped);
    const H = getFrameHomography(warped)!;
    for (const box of [{ x: 120, y: 80 }, { x: 333, y: 201 }, { x: 5, y: 240 }]) {
      const w = applyHomography(H, box.x, box.y);
      const comp = frameLocalToComp(w.x, w.y, warped);
      close(compToBox(p, comp.x, comp.y), box, 6);
    }
  });
});

describe('boxToElementUV', () => {
  it('is the identity without content transforms', () => {
    const p = frameRenderParams(frame());
    close(boxToElementUV(p, { x: 0, y: 0 }), { x: 0, y: 0 });
    close(boxToElementUV(p, { x: 400, y: 250 }), { x: 1, y: 1 });
  });

  it('undoes flips, zoom about the centre and pan (CSS order)', () => {
    const p = frameRenderParams(frame({ flipHorizontal: true, contentScale: 2, contentOffsetX: 10 }));
    // Box centre shows the element point offset by -10 % (pan moves content right)
    close(boxToElementUV(p, { x: 200, y: 125 }), { x: 0.4, y: 0.5 });
    // Flipped: the box's left edge shows the element's right side
    const left = boxToElementUV(p, { x: 0, y: 125 });
    expect(left.x).toBeGreaterThan(0.5);
  });
});

describe('coverUV', () => {
  it('crops the longer media axis like object-fit: cover', () => {
    // 16:9 media in a square box: only the middle 9/16 of the width shows
    close(coverUV({ x: 0, y: 0.5 }, 1, 16 / 9), { x: 0.5 - 0.5 * (9 / 16), y: 0.5 });
    // 1:2 portrait media in a square box: middle half of the height
    close(coverUV({ x: 0.5, y: 1 }, 1, 0.5), { x: 0.5, y: 0.75 });
  });
});
