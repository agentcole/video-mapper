import { describe, expect, it } from 'vitest';
import type { PerspectiveCorners, Point } from '../types';
import {
  applyHomography,
  canonicalQuadOrder,
  dedupePolygon,
  getFrameCompOutline,
  getFrameHomography,
  getPerspectiveHomography,
  invertHomography,
  isConvexQuad,
  pinFrameToQuadVertices,
  refitFrameToVertices,
  scaleFrameSize,
  type FrameGeometry,
} from './geometry';

const ZERO_CORNERS: PerspectiveCorners = {
  tl: { x: 0, y: 0 },
  tr: { x: 0, y: 0 },
  br: { x: 0, y: 0 },
  bl: { x: 0, y: 0 },
};

const WARP_CORNERS: PerspectiveCorners = {
  tl: { x: 30, y: 12 },
  tr: { x: -20, y: 40 },
  br: { x: 15, y: -25 },
  bl: { x: -10, y: 5 },
};

const expectPointClose = (actual: Point, expected: Point, digits = 6) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};

describe('invertHomography', () => {
  it('undoes the homography', () => {
    const H = getPerspectiveHomography(400, 300, WARP_CORNERS)!;
    const inv = invertHomography(H)!;
    for (const [x, y] of [[0, 0], [400, 0], [123, 77], [400, 300], [-50, 360]]) {
      const warped = applyHomography(H, x, y);
      expectPointClose(applyHomography(inv, warped.x, warped.y), { x, y });
    }
  });

  it('returns null for a singular matrix', () => {
    expect(invertHomography([0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});

describe('getFrameHomography', () => {
  it('is null when corner pin is off or not warped', () => {
    const base: FrameGeometry = { x: 0, y: 0, width: 100, height: 100, rotation: 0, perspectiveMode: false, perspectiveCorners: WARP_CORNERS };
    expect(getFrameHomography(base)).toBeNull();
    expect(getFrameHomography({ ...base, perspectiveMode: true, perspectiveCorners: ZERO_CORNERS })).toBeNull();
    expect(getFrameHomography({ ...base, perspectiveMode: true })).not.toBeNull();
  });
});

describe('isConvexQuad', () => {
  const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it('accepts a clockwise convex quad', () => {
    expect(isConvexQuad(rect)).toBe(true);
  });

  it('rejects mirrored, folded and degenerate quads', () => {
    expect(isConvexQuad([...rect].reverse())).toBe(false);
    expect(isConvexQuad([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
    expect(isConvexQuad([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
    expect(isConvexQuad([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 10 }])).toBe(false);
  });
});

describe('canonicalQuadOrder', () => {
  it('turns any start corner and winding into TL, TR, BR, BL', () => {
    const tl = { x: 0, y: 0 };
    const tr = { x: 10, y: 1 };
    const br = { x: 11, y: 9 };
    const bl = { x: 1, y: 10 };
    expect(canonicalQuadOrder([br, bl, tl, tr])).toEqual([tl, tr, br, bl]);
    expect(canonicalQuadOrder([tr, tl, bl, br])).toEqual([tl, tr, br, bl]);
  });
});

describe('dedupePolygon', () => {
  it('drops the duplicate point of a double-click and a closing repeat', () => {
    const triangle = [{ x: 0, y: 100 }, { x: 50, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 100 }];
    expect(dedupePolygon(triangle)).toEqual(triangle.slice(0, 3));
    expect(dedupePolygon([...triangle.slice(0, 3), { x: 0.4, y: 100 }])).toEqual(triangle.slice(0, 3));
  });
});

describe('refitFrameToVertices', () => {
  const frame = {
    x: 200,
    y: 150,
    width: 400,
    height: 300,
    rotation: 25,
    perspectiveMode: true,
    perspectiveCorners: WARP_CORNERS,
    shape: 'polygon' as const,
    // A vertex dragged outside the box (x = 1.3) and none touching the top
    vertices: [{ x: 0.5, y: 0.2 }, { x: 1.3, y: 0.9 }, { x: 0.1, y: 1 }],
  };

  it('keeps every vertex where it was on screen', () => {
    const refit = refitFrameToVertices(frame)!;
    expect(refit).not.toBeNull();
    const before = getFrameCompOutline(frame);
    const after = getFrameCompOutline({ ...frame, ...refit });
    before.forEach((p, i) => expectPointClose(after[i], p, 6));
  });

  it('produces a tight box with vertices in [0, 1]', () => {
    const refit = refitFrameToVertices(frame)!;
    const xs = refit.vertices.map(v => v.x);
    const ys = refit.vertices.map(v => v.y);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(1);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(1);
    expect(refit.width).toBeCloseTo(400 * 1.2);
    expect(refit.height).toBeCloseTo(300 * 0.8);
  });

  it('also preserves unwarped, rotated frames', () => {
    const plain = { ...frame, perspectiveMode: false, perspectiveCorners: ZERO_CORNERS };
    const refit = refitFrameToVertices(plain)!;
    const before = getFrameCompOutline(plain);
    const after = getFrameCompOutline({ ...plain, ...refit });
    before.forEach((p, i) => expectPointClose(after[i], p, 6));
  });

  it('returns null when the box already fits', () => {
    expect(refitFrameToVertices({ ...frame, vertices: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] })).toBeNull();
  });
});

describe('pinFrameToQuadVertices', () => {
  it('pins the box corners onto the rendered quad, whatever the vertex order', () => {
    // Counter-clockwise, starting bottom-right — used to mirror/rotate the media
    const vertices = [{ x: 0.9, y: 1 }, { x: 0.8, y: 0.1 }, { x: 0, y: 0 }, { x: 0.1, y: 0.9 }];
    const frame = { x: 0, y: 0, width: 200, height: 100, rotation: 0, perspectiveMode: false, perspectiveCorners: ZERO_CORNERS, vertices };
    const pinned = pinFrameToQuadVertices(frame)!;
    expect(pinned.shape).toBe('rectangle');
    const H = getPerspectiveHomography(200, 100, pinned.perspectiveCorners)!;
    expectPointClose(applyHomography(H, 0, 0), { x: 0, y: 0 });
    expectPointClose(applyHomography(H, 200, 0), { x: 160, y: 10 });
    expectPointClose(applyHomography(H, 200, 100), { x: 180, y: 100 });
    expectPointClose(applyHomography(H, 0, 100), { x: 20, y: 90 });
  });

  it('rejects non-quads and concave quads', () => {
    const base = { x: 0, y: 0, width: 100, height: 100, rotation: 0, perspectiveMode: false, perspectiveCorners: ZERO_CORNERS };
    expect(pinFrameToQuadVertices({ ...base, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] })).toBeNull();
    expect(pinFrameToQuadVertices({ ...base, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.3, y: 0.3 }, { x: 0, y: 1 }] })).toBeNull();
  });
});

describe('scaleFrameSize', () => {
  it('scales the corner pins with the box', () => {
    const scaled = scaleFrameSize({ width: 100, height: 50, perspectiveCorners: WARP_CORNERS }, 200, 25);
    expect(scaled.perspectiveCorners.tl).toEqual({ x: 60, y: 6 });
    expect(scaled.perspectiveCorners.tr).toEqual({ x: -40, y: 20 });
  });
});
