import { describe, expect, it } from 'vitest';
import type { MeshWarp, Point } from '../types';
import {
  activeMesh, buildWarpGeometry, createMesh, cropMesh, isFlatMesh, meshLine, meshPoint, moveMeshPoints,
  prepareWarp, resetMesh, resizeMesh, surfaceWarp, warpGridLines, warpOutline, warpSegments, type Warp,
} from './meshWarp';
import { applyHomography, computeHomography } from './geometry';

const close = (a: Point, b: Point, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

const RECT: Point[] = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }];
const TRAPEZOID: Point[] = [{ x: 100, y: 50 }, { x: 700, y: 0 }, { x: 800, y: 500 }, { x: 0, y: 450 }];

/** A 3 × 3 mesh with the middle point pushed right by 0.2. */
const bentMesh = (smooth: boolean): MeshWarp => moveMeshPoints(createMesh(3, 3, smooth), [4], { x: 0.2, y: 0 });

describe('meshes', () => {
  it('creates a flat grid, clamped to 2..17 points per side', () => {
    const mesh = createMesh(3, 2);
    expect(mesh.points).toEqual([
      { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 0.5, y: 1 }, { x: 1, y: 1 },
    ]);
    expect(isFlatMesh(mesh)).toBe(true);
    expect(createMesh(1, 40)).toMatchObject({ columns: 2, rows: 17 });
    expect(activeMesh(mesh)).toBeNull();
    expect(activeMesh(bentMesh(true))).not.toBeNull();
  });

  it.each([false, true])('a flat mesh maps every param to itself (smooth: %s)', smooth => {
    const mesh = createMesh(5, 4, smooth);
    for (const [u, v] of [[0, 0], [0.3, 0.7], [1, 1], [0.99, 0.01], [-0.1, 1.1]]) close(meshPoint(mesh, u, v), { x: u, y: v });
  });

  it.each([false, true])('passes through its control points (smooth: %s)', smooth => {
    const mesh = bentMesh(smooth);
    close(meshPoint(mesh, 0.5, 0.5), { x: 0.7, y: 0.5 });
    close(meshPoint(mesh, 0, 0), { x: 0, y: 0 });
    close(meshPoint(mesh, 1, 0.5), { x: 1, y: 0.5 });
  });

  it('linear: straight between control points; smooth: a curve', () => {
    // Halfway between the bent middle point (0.7) and the right edge (1)
    close(meshPoint(bentMesh(false), 0.75, 0.5), { x: 0.85, y: 0.5 });
    // Between the top edge and the middle: half the bend, linearly
    close(meshPoint(bentMesh(false), 0.5, 0.25), { x: 0.6, y: 0.25 });
    // The smooth one bends more than half way there (the curve is round)
    expect(meshPoint(bentMesh(true), 0.5, 0.25).x).toBeGreaterThan(0.6);
  });

  it('resizing keeps the bends where the grids share points', () => {
    const mesh = bentMesh(false);
    const bigger = resizeMesh(mesh, 5, 5);
    expect(bigger.points).toHaveLength(25);
    close(bigger.points[12], { x: 0.7, y: 0.5 });
    close(bigger.points[13], meshPoint(mesh, 0.75, 0.5));
    expect(resizeMesh(mesh, 3, 3)).toBe(mesh);
    expect(isFlatMesh(resizeMesh(createMesh(4, 4), 9, 3))).toBe(true);
  });

  it('crops to a part of its square without moving anything', () => {
    const mesh = bentMesh(true);
    const part = { x: 0.25, y: 0, width: 0.75, height: 1 };
    const cropped = cropMesh(mesh, part);
    for (const [u, v] of [[0, 0.5], [0.4, 0.3], [1, 1]]) {
      const inner = meshPoint(cropped, u, v);
      const whole = meshPoint(mesh, part.x + u * part.width, part.y + v * part.height);
      // The cropped grid samples the curve; at its own points it matches exactly
      if (u === 0 || u === 1) close({ x: part.x + inner.x * part.width, y: inner.y }, whole);
    }
    close(cropped.points[0], { x: (meshPoint(mesh, 0.25, 0).x - 0.25) / 0.75, y: 0 });
  });

  it('resets, moves points and lists rows and columns', () => {
    const mesh = createMesh(3, 2);
    expect(meshLine(mesh, 'row', 1)).toEqual([3, 4, 5]);
    expect(meshLine(mesh, 'column', 2)).toEqual([2, 5]);
    const moved = moveMeshPoints(mesh, [0, 5], { x: 0.1, y: -0.1 });
    close(moved.points[0], { x: 0.1, y: -0.1 });
    close(moved.points[5], { x: 1.1, y: 0.9 });
    expect(moved.points[1]).toBe(mesh.points[1]);
    expect(isFlatMesh(resetMesh(moved))).toBe(true);
  });
});

describe('warps', () => {
  it('a perspective pin is the corner homography', () => {
    const warp = prepareWarp({ corners: TRAPEZOID })!;
    const H = computeHomography([[0, 0], [1, 0], [1, 1], [0, 1]], TRAPEZOID.map(p => [p.x, p.y]))!;
    for (const [u, v] of [[0, 0], [1, 1], [0.25, 0.6]]) close(warp.point(u, v), applyHomography(H, u, v));
    const [x, y, w] = warp.homogeneous(0.25, 0.6);
    close({ x: x / w, y: y / w }, applyHomography(H, 0.25, 0.6));
  });

  it('a bilinear pin interpolates the corners (w = 1)', () => {
    const warp = prepareWarp({ corners: TRAPEZOID, bilinear: true })!;
    close(warp.point(0.5, 0), { x: 400, y: 25 });
    close(warp.point(0.5, 0.5), { x: 400, y: 250 });
    expect(warp.homogeneous(0.3, 0.3)[2]).toBe(1);
  });

  it.each([
    ['perspective', { corners: TRAPEZOID }],
    ['bilinear', { corners: TRAPEZOID, bilinear: true }],
    ['perspective + smooth mesh', { corners: TRAPEZOID, mesh: bentMesh(true) }],
    ['bilinear + linear mesh', { corners: TRAPEZOID, bilinear: true, mesh: bentMesh(false) }],
  ] as [string, Warp][])('inverts %s', (_, w) => {
    const warp = prepareWarp(w)!;
    for (const [u, v] of [[0.5, 0.5], [0.1, 0.9], [0.8, 0.3], [0, 0]]) {
      const p = warp.point(u, v);
      close(warp.inverse(p)!, { x: u, y: v }, 4);
    }
  });

  it('unpins to pin space, where mesh points live', () => {
    const warp = prepareWarp({ corners: TRAPEZOID, mesh: bentMesh(false) })!;
    // The bent middle point lands at pin(0.7, 0.5), and unpins back to it
    const p = warp.point(0.5, 0.5);
    close(p, warp.pin(0.7, 0.5));
    close(warp.unpin(p)!, { x: 0.7, y: 0.5 });
  });

  it('refuses degenerate corners', () => {
    expect(prepareWarp({ corners: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] })).toBeNull();
  });
});

describe('warp geometry', () => {
  it('a perspective pin is one cell — exact, the GPU divides by w', () => {
    expect(warpSegments({ corners: TRAPEZOID })).toEqual([1, 1]);
    const warp = prepareWarp({ corners: TRAPEZOID })!;
    const { vertices, indices } = buildWarpGeometry(warp, [1, 1]);
    expect(vertices).toHaveLength(4 * 5);
    expect(Array.from(indices)).toEqual([0, 1, 3, 0, 3, 2]);
    // Vertex 3: the bottom right corner, param (1, 1)
    const [x, y, w, u, v] = vertices.slice(15, 20);
    close({ x: x / w, y: y / w }, { x: 800, y: 500 }, 3);
    expect([u, v]).toEqual([1, 1]);
  });

  it('bends get more cells', () => {
    expect(warpSegments({ corners: RECT, bilinear: true })).toEqual([32, 32]);
    expect(warpSegments({ corners: RECT, mesh: bentMesh(false) })).toEqual([8, 8]);
    expect(warpSegments({ corners: RECT, mesh: moveMeshPoints(createMesh(5, 3, true), [6], { x: 0.1, y: 0 }) })).toEqual([32, 16]);
    expect(warpSegments({ corners: RECT, mesh: moveMeshPoints(createMesh(17, 17, true), [6], { x: 0.1, y: 0 }) })).toEqual([128, 128]);
    // A flat mesh is no bend
    expect(warpSegments({ corners: RECT, mesh: createMesh(9, 9) })).toEqual([1, 1]);
  });

  it('pads by px on every side, the params continuing past 0..1', () => {
    const warp = prepareWarp({ corners: RECT })!;
    const { vertices } = buildWarpGeometry(warp, [2, 1], 2);
    // 5 × 4 vertices: −pad, 0, ½, 1, +pad across; −pad, 0, 1, +pad down
    expect(vertices).toHaveLength(5 * 4 * 5);
    const first = Array.from(vertices.slice(0, 5));
    expect(first[0]).toBeCloseTo(-2, 4);
    expect(first[1]).toBeCloseTo(-2, 4);
    expect(first[3]).toBeCloseTo(-2 / 400, 6);
    expect(first[4]).toBeCloseTo(-2 / 200, 6);
  });

  it('applies an affine transform to the homogeneous positions', () => {
    const warp = prepareWarp({ corners: TRAPEZOID })!;
    const { vertices } = buildWarpGeometry(warp, [1, 1], 0, [0, -1, 1000, 1, 0, 0]); // rotate 90°, shift
    const [x, y, w] = vertices.slice(15, 18);
    close({ x: x / w, y: y / w }, { x: 1000 - 500, y: 800 }, 3);
  });

  it('draws grid lines through the control points and the outline', () => {
    const mesh = bentMesh(false);
    const warp = prepareWarp({ corners: RECT, mesh })!;
    const lines = warpGridLines(warp, mesh, 4);
    expect(lines).toHaveLength(6);
    // Middle row passes the bent point at its middle sample
    close(lines[1][4], { x: 0.7 * 400, y: 100 });
    expect(warpOutline(warp, 8)).toHaveLength(32);
  });

  it('surface warps sit in the box, pinned when corner pin is on', () => {
    const frame = {
      width: 200, height: 100, perspectiveMode: true, bilinear: true,
      perspectiveCorners: { tl: { x: 10, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
    };
    expect(surfaceWarp(frame)).toEqual({
      corners: [{ x: 10, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
      bilinear: true,
      mesh: undefined,
    });
    expect(surfaceWarp({ ...frame, perspectiveMode: false }).bilinear).toBe(false);
    expect(surfaceWarp({ ...frame, perspectiveMode: false }).corners[2]).toEqual({ x: 200, y: 100 });
  });
});
