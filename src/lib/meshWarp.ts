import type { MeshWarp, PerspectiveCorners, Point } from '../types';
import { applyHomography, computeHomography, getCornerLocalPositions, invertHomography } from './geometry';

// ---------------------------------------------------------------------------
// Mesh warp (roadmap 3.2). A warp puts a unit square — a surface's box, a
// slice's input rectangle — onto the output in two layers:
//
//   param (u, v) ──mesh──▶ pin space (s, t) ──corner pin──▶ output px
//
// The mesh is a grid of control points in the pin's unit square: linear
// (bilinear between neighbours) or smooth (a Catmull-Rom surface through
// the points). The corner pin is a homography (perspective, the default) or
// a bilinear map of the four corners. Mesh points live in pin space, so
// moving a corner keeps the bends. The GPU draws a warp as a triangle mesh
// whose vertices carry homogeneous output positions, so the content is
// interpolated in perspective (buildWarpGeometry).
// See docs/design/mesh-warp.md.
// ---------------------------------------------------------------------------

export const MESH_MIN_POINTS = 2;
export const MESH_MAX_POINTS = 17;

export interface Warp {
  corners: readonly Point[]; // TL, TR, BR, BL, output px
  bilinear?: boolean;
  mesh?: MeshWarp | null;
}

const clampCount = (n: number) => Math.max(MESH_MIN_POINTS, Math.min(MESH_MAX_POINTS, Math.round(n) || MESH_MIN_POINTS));

/** Where control point `index` sits on a flat mesh. */
const gridPosition = (columns: number, rows: number, index: number): Point => ({
  x: (index % columns) / (columns - 1),
  y: Math.floor(index / columns) / (rows - 1),
});

/** A flat mesh: columns × rows points on a regular grid. */
export const createMesh = (columns = 4, rows = 4, smooth = true): MeshWarp => {
  const c = clampCount(columns);
  const r = clampCount(rows);
  return { columns: c, rows: r, points: Array.from({ length: c * r }, (_, k) => gridPosition(c, r, k)), smooth };
};

/** The same size and kind, every point back on the grid. */
export const resetMesh = (mesh: MeshWarp): MeshWarp => createMesh(mesh.columns, mesh.rows, mesh.smooth);

/** True when every point sits on its grid position — the mesh bends nothing. */
export const isFlatMesh = (mesh: MeshWarp, epsilon = 1e-6): boolean =>
  mesh.points.every((p, k) => {
    const g = gridPosition(mesh.columns, mesh.rows, k);
    return Math.abs(p.x - g.x) < epsilon && Math.abs(p.y - g.y) < epsilon;
  });

/** A mesh that bends something, or null. */
export const activeMesh = (mesh: MeshWarp | null | undefined): MeshWarp | null =>
  mesh && !isFlatMesh(mesh) ? mesh : null;

// ---- Evaluation -----------------------------------------------------------------------------

// Control point (i, j); beyond the border the grid continues in a straight line
const controlPoint = (mesh: MeshWarp, i: number, j: number): Point => {
  const { columns: c, rows: r } = mesh;
  if (i < 0 || i > c - 1) {
    const edge = i < 0 ? 0 : c - 1;
    const a = controlPoint(mesh, edge, j);
    const b = controlPoint(mesh, i < 0 ? 1 : c - 2, j);
    const n = i < 0 ? -i : i - edge;
    return { x: a.x + (a.x - b.x) * n, y: a.y + (a.y - b.y) * n };
  }
  if (j < 0 || j > r - 1) {
    const edge = j < 0 ? 0 : r - 1;
    const a = controlPoint(mesh, i, edge);
    const b = controlPoint(mesh, i, j < 0 ? 1 : r - 2);
    const n = j < 0 ? -j : j - edge;
    return { x: a.x + (a.x - b.x) * n, y: a.y + (a.y - b.y) * n };
  }
  return mesh.points[j * c + i];
};

// The cell along one axis and the position in it (outside 0..1: the border cell, extrapolated)
const cellOf = (x: number, count: number): [number, number] => {
  const f = x * (count - 1);
  const i = Math.max(0, Math.min(count - 2, Math.floor(f)));
  return [i, f - i];
};

// Uniform Catmull-Rom weights of the four points around a segment
const catmullRom = (s: number): [number, number, number, number] => {
  const s2 = s * s;
  const s3 = s2 * s;
  return [(-s3 + 2 * s2 - s) / 2, (3 * s3 - 5 * s2 + 2) / 2, (-3 * s3 + 4 * s2 + s) / 2, (s3 - s2) / 2];
};

/** Param (u, v) → pin space through the mesh. Outside 0..1 the border cells continue. */
export function meshPoint(mesh: MeshWarp, u: number, v: number): Point {
  const [i, s] = cellOf(u, mesh.columns);
  const [j, t] = cellOf(v, mesh.rows);
  if (!mesh.smooth) {
    const a = controlPoint(mesh, i, j);
    const b = controlPoint(mesh, i + 1, j);
    const c = controlPoint(mesh, i + 1, j + 1);
    const d = controlPoint(mesh, i, j + 1);
    return {
      x: (1 - s) * (1 - t) * a.x + s * (1 - t) * b.x + s * t * c.x + (1 - s) * t * d.x,
      y: (1 - s) * (1 - t) * a.y + s * (1 - t) * b.y + s * t * c.y + (1 - s) * t * d.y,
    };
  }
  const ws = catmullRom(s);
  const wt = catmullRom(t);
  let x = 0;
  let y = 0;
  for (let b = 0; b < 4; b++) {
    for (let a = 0; a < 4; a++) {
      const p = controlPoint(mesh, i - 1 + a, j - 1 + b);
      const w = ws[a] * wt[b];
      x += w * p.x;
      y += w * p.y;
    }
  }
  return { x, y };
}

/** The same bends on a grid of another size (sampled from the current one). */
export const resizeMesh = (mesh: MeshWarp, columns: number, rows: number): MeshWarp => {
  const c = clampCount(columns);
  const r = clampCount(rows);
  if (c === mesh.columns && r === mesh.rows) return mesh;
  const points = Array.from({ length: c * r }, (_, k) => {
    const g = gridPosition(c, r, k);
    return meshPoint(mesh, g.x, g.y);
  });
  return { ...mesh, columns: c, rows: r, points };
};

/**
 * The mesh for a part of its unit square (x, y, width, height in params) as
 * that part's own unit square — e.g. after a surface's box is refitted to
 * its polygon, so nothing moves on the output.
 */
export const cropMesh = (mesh: MeshWarp, part: { x: number; y: number; width: number; height: number }): MeshWarp => ({
  ...mesh,
  points: mesh.points.map((_, k) => {
    const g = gridPosition(mesh.columns, mesh.rows, k);
    const p = meshPoint(mesh, part.x + g.x * part.width, part.y + g.y * part.height);
    return { x: (p.x - part.x) / part.width, y: (p.y - part.y) / part.height };
  }),
});

/** Move some control points by a delta in pin space. */
export const moveMeshPoints = (mesh: MeshWarp, indices: readonly number[], delta: Point): MeshWarp => ({
  ...mesh,
  points: mesh.points.map((p, k) => (indices.includes(k) ? { x: p.x + delta.x, y: p.y + delta.y } : p)),
});

/** Every control point (indices) in a column or a row of the grid. */
export const meshLine = (mesh: MeshWarp, axis: 'row' | 'column', index: number): number[] =>
  axis === 'row'
    ? Array.from({ length: mesh.columns }, (_, i) => index * mesh.columns + i)
    : Array.from({ length: mesh.rows }, (_, j) => j * mesh.columns + index);

// ---- Warps: mesh + corner pin -------------------------------------------------------------------

const UNIT: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export interface PreparedWarp {
  /** Param → output px. */
  point(u: number, v: number): Point;
  /** Param → homogeneous output position (x, y, w; the point is x/w, y/w). */
  homogeneous(u: number, v: number): [number, number, number];
  /** Pin space → output px. */
  pin(s: number, t: number): Point;
  /** Output px → pin space (where mesh points live); null when out of reach. */
  unpin(p: Point): Point | null;
  /** Output px → param; null when out of reach. */
  inverse(p: Point): Point | null;
  readonly mesh: MeshWarp | null; // the mesh, when it bends anything
  readonly bilinear: boolean;
}

const bilerp = (c: readonly Point[], s: number, t: number): Point => ({
  x: (1 - s) * (1 - t) * c[0].x + s * (1 - t) * c[1].x + s * t * c[2].x + (1 - s) * t * c[3].x,
  y: (1 - s) * (1 - t) * c[0].y + s * (1 - t) * c[1].y + s * t * c[2].y + (1 - s) * t * c[3].y,
});

/**
 * Solve f(u, v) = target by Newton's method from `start` (finite-difference
 * Jacobian, damped steps). null when it doesn't converge to `tolerance` px.
 */
function solve(f: (u: number, v: number) => Point, target: Point, start: Point, tolerance: number): Point | null {
  let u = start.x;
  let v = start.y;
  const h = 1e-6;
  let error = Infinity;
  for (let k = 0; k < 40; k++) {
    const p = f(u, v);
    const ex = p.x - target.x;
    const ey = p.y - target.y;
    error = Math.hypot(ex, ey);
    if (error < tolerance * 1e-3) break;
    const pu = f(u + h, v);
    const pv = f(u, v + h);
    const a = (pu.x - p.x) / h;
    const b = (pv.x - p.x) / h;
    const c = (pu.y - p.y) / h;
    const d = (pv.y - p.y) / h;
    const det = a * d - b * c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    let du = (d * ex - b * ey) / det;
    let dv = (a * ey - c * ex) / det;
    const step = Math.hypot(du, dv);
    if (step > 0.25) {
      du *= 0.25 / step;
      dv *= 0.25 / step;
    }
    u -= du;
    v -= dv;
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  }
  const p = f(u, v);
  return Math.hypot(p.x - target.x, p.y - target.y) <= tolerance ? { x: u, y: v } : null;
}

/** A warp ready to evaluate; null when its corners are degenerate. */
export function prepareWarp(warp: Warp): PreparedWarp | null {
  const corners = warp.corners;
  const H = computeHomography(UNIT, corners.map(p => [p.x, p.y]));
  const Hinv = H ? invertHomography(H) : null;
  if (!H || !Hinv) return null;
  const mesh = activeMesh(warp.mesh);
  const bilinear = !!warp.bilinear;
  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  // Solver tolerance: a hundredth of a px, relative for tiny warps
  const tolerance = Math.min(0.01, 1e-4 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));

  const pin = (s: number, t: number): Point => (bilinear ? bilerp(corners, s, t) : applyHomography(H, s, t));
  const toPin = (u: number, v: number): Point => (mesh ? meshPoint(mesh, u, v) : { x: u, y: v });
  const point = (u: number, v: number): Point => {
    const m = toPin(u, v);
    return pin(m.x, m.y);
  };
  const homogeneous = (u: number, v: number): [number, number, number] => {
    const m = toPin(u, v);
    if (bilinear) {
      const p = bilerp(corners, m.x, m.y);
      return [p.x, p.y, 1];
    }
    return [
      H[0] * m.x + H[1] * m.y + H[2],
      H[3] * m.x + H[4] * m.y + H[5],
      H[6] * m.x + H[7] * m.y + 1,
    ];
  };
  const unpin = (p: Point): Point | null => {
    const guess = applyHomography(Hinv, p.x, p.y);
    if (!bilinear) return Number.isFinite(guess.x) && Number.isFinite(guess.y) ? guess : null;
    return solve(pin, p, guess, tolerance);
  };
  const inverse = (p: Point): Point | null => {
    const m = unpin(p);
    if (!mesh) return m;
    const found = m ? solve(point, p, m, tolerance) : null;
    if (found) return found;
    // Strong bends: start from the nearest point of a coarse grid
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (let j = -4; j <= 24; j++) {
      for (let i = -4; i <= 24; i++) {
        const q = point(i / 20, j / 20);
        const distance = Math.hypot(q.x - p.x, q.y - p.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x: i / 20, y: j / 20 };
        }
      }
    }
    return best ? solve(point, p, best, tolerance) : null;
  };
  return { point, homogeneous, pin, unpin, inverse, mesh, bilinear };
}

/** Does the warp bend beyond what one homography does (a mesh or a bilinear pin)? */
export const bendsBeyondPerspective = (warp: Warp): boolean => !!activeMesh(warp.mesh) || !!warp.bilinear;

// ---- Geometry for the GPU -------------------------------------------------------------------------

export interface WarpGeometry {
  /** Per vertex: x, y, w (homogeneous output position), then u, v (param). */
  vertices: Float32Array;
  indices: Uint16Array | Uint32Array;
}

/** x' = a·x + b·y + c, y' = d·x + e·y + f (e.g. a surface's rotation and position). */
export type Affine = [number, number, number, number, number, number];

const MAX_SEGMENTS = 160;

/**
 * How finely to tessellate: one cell for a perspective pin (exact — the GPU
 * interpolates in perspective), more where it bends.
 */
export function warpSegments(warp: Warp): [number, number] {
  const mesh = activeMesh(warp.mesh);
  const pin = warp.bilinear ? 32 : 1;
  if (!mesh) return [pin, pin];
  const k = mesh.smooth ? 8 : 4;
  return [
    Math.min(MAX_SEGMENTS, Math.max(pin, (mesh.columns - 1) * k)),
    Math.min(MAX_SEGMENTS, Math.max(pin, (mesh.rows - 1) * k)),
  ];
}

/**
 * Triangles covering a warp, grown by `pad` output px on every side (the
 * params continue past 0..1) so antialiased edges aren't cut off.
 */
export function buildWarpGeometry(
  warp: PreparedWarp,
  segments: [number, number],
  pad = 0,
  affine?: Affine,
): WarpGeometry {
  const [nu, nv] = segments.map(n => Math.max(1, Math.round(n)));
  // How far to continue the params for `pad` px: from the slowest rate along each side
  const extend = (side: 'left' | 'right' | 'top' | 'bottom'): number => {
    if (pad <= 0) return 0;
    const e = 1e-3;
    let slowest = Infinity;
    for (let k = 0; k <= 4; k++) {
      const a = k / 4;
      const [p, q] = side === 'left' ? [warp.point(0, a), warp.point(e, a)]
        : side === 'right' ? [warp.point(1, a), warp.point(1 - e, a)]
        : side === 'top' ? [warp.point(a, 0), warp.point(a, e)]
        : [warp.point(a, 1), warp.point(a, 1 - e)];
      slowest = Math.min(slowest, Math.hypot(q.x - p.x, q.y - p.y) / e);
    }
    const amount = Math.min(0.25, pad / Math.max(slowest, 1e-9));
    // Never past the horizon of a perspective pin
    const ends = side === 'left' ? [[-amount, 0], [-amount, 1]] : side === 'right' ? [[1 + amount, 0], [1 + amount, 1]]
      : side === 'top' ? [[0, -amount], [1, -amount]] : [[0, 1 + amount], [1, 1 + amount]];
    return ends.every(([u, v]) => warp.homogeneous(u, v)[2] > 1e-6) ? amount : 0;
  };
  const steps = (n: number, before: number, after: number): number[] => {
    const list = Array.from({ length: n + 1 }, (_, i) => i / n);
    if (before > 0) list.unshift(-before);
    if (after > 0) list.push(1 + after);
    return list;
  };
  const us = steps(nu, extend('left'), extend('right'));
  const vs = steps(nv, extend('top'), extend('bottom'));
  const vertices = new Float32Array(us.length * vs.length * 5);
  let o = 0;
  for (const v of vs) {
    for (const u of us) {
      const [hx, hy, w] = warp.homogeneous(u, v);
      vertices[o++] = affine ? affine[0] * hx + affine[1] * hy + affine[2] * w : hx;
      vertices[o++] = affine ? affine[3] * hx + affine[4] * hy + affine[5] * w : hy;
      vertices[o++] = w;
      vertices[o++] = u;
      vertices[o++] = v;
    }
  }
  const cols = us.length;
  const cells = (us.length - 1) * (vs.length - 1);
  const indices = us.length * vs.length > 65535 ? new Uint32Array(cells * 6) : new Uint16Array(cells * 6);
  let n = 0;
  for (let j = 0; j < vs.length - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = a + cols;
      indices[n++] = a;
      indices[n++] = b;
      indices[n++] = c;
      indices[n++] = a;
      indices[n++] = c;
      indices[n++] = d;
    }
  }
  return { vertices, indices };
}

/** Polylines (output px) along the mesh's rows and columns — the grid the editor draws. */
export function warpGridLines(warp: PreparedWarp, mesh: MeshWarp, samplesPerCell = 8): Point[][] {
  const lines: Point[][] = [];
  const along = (count: number) => Array.from({ length: (count - 1) * samplesPerCell + 1 }, (_, k) => k / ((count - 1) * samplesPerCell));
  for (let j = 0; j < mesh.rows; j++) {
    const v = j / (mesh.rows - 1);
    lines.push(along(mesh.columns).map(u => warp.point(u, v)));
  }
  for (let i = 0; i < mesh.columns; i++) {
    const u = i / (mesh.columns - 1);
    lines.push(along(mesh.rows).map(v => warp.point(u, v)));
  }
  return lines;
}

/** Points (output px) along the warp's border, clockwise from the top left. */
export function warpOutline(warp: PreparedWarp, samplesPerSide = 32): Point[] {
  const n = samplesPerSide;
  const out: Point[] = [];
  for (let k = 0; k < n; k++) out.push(warp.point(k / n, 0));
  for (let k = 0; k < n; k++) out.push(warp.point(1, k / n));
  for (let k = 0; k < n; k++) out.push(warp.point(1 - k / n, 1));
  for (let k = 0; k < n; k++) out.push(warp.point(0, 1 - k / n));
  return out;
}

// ---- Surfaces -------------------------------------------------------------------------------------

export interface SurfaceWarpFields {
  width: number;
  height: number;
  perspectiveMode: boolean;
  perspectiveCorners: PerspectiveCorners;
  bilinear?: boolean;
  mesh?: MeshWarp;
}

/** A surface's warp in its warped-local px: the box with its corner pins and mesh. */
export const surfaceWarp = (frame: SurfaceWarpFields): Warp => {
  const { width: w, height: h } = frame;
  const c = frame.perspectiveMode ? getCornerLocalPositions(w, h, frame.perspectiveCorners) : null;
  return {
    corners: c ? [c.tl, c.tr, c.br, c.bl] : [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    bilinear: !!(frame.perspectiveMode && frame.bilinear),
    mesh: frame.mesh,
  };
};
