import type { Point, PerspectiveCorners } from '../types';

// ---------------------------------------------------------------------------
// Perspective / Homography utilities
// ---------------------------------------------------------------------------

/**
 * Solve an 8×8 linear system (A·x = b) via Gaussian elimination with partial
 * pivoting.  Returns null if the matrix is (near-)singular.
 */
function gaussianSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Augmented matrix [A | b]
  const mat = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[maxRow][col])) maxRow = row;
    }
    [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];
    if (Math.abs(mat[col][col]) < 1e-10) return null;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = mat[row][col] / mat[col][col];
      for (let k = col; k <= n; k++) mat[row][k] -= factor * mat[col][k];
    }
  }

  return mat.map((row, i) => row[n] / row[i]);
}

/**
 * Compute the 2-D projective transformation (homography) that maps four
 * source points to four destination points.
 *
 * src[i] and dst[i] are [x, y] pairs.
 *
 * Returns [h00, h01, h02, h10, h11, h12, h20, h21] with h22 = 1, or null on
 * failure.
 */
export function computeHomography(
  src: [number, number][],
  dst: [number, number][]
): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    // Row for x
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    // Row for y
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  return gaussianSolve(A, b);
}

/**
 * Convert an 8-element homography vector (h22 = 1) to a CSS matrix3d() string.
 *
 * The homography H maps [x, y, 1]^T → [x', y', w']^T where the final point
 * is (x'/w', y'/w').  We embed it in a 4×4 column-major matrix for CSS:
 *
 *   matrix3d(h00, h10, 0, h20,
 *             h01, h11, 0, h21,
 *             0,   0,   1, 0,
 *             h02, h12, 0, 1)
 */
export function homographyToCSS(h: number[]): string {
  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;
  return `matrix3d(${h00},${h10},0,${h20},${h01},${h11},0,${h21},0,0,1,0,${h02},${h12},0,1)`;
}

/** Apply a homography (8-element vector, h22 = 1) to a point. */
export function applyHomography(h: number[], x: number, y: number): Point {
  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;
  const w = h20 * x + h21 * y + 1;
  return {
    x: (h00 * x + h01 * y + h02) / w,
    y: (h10 * x + h11 * y + h12) / w,
  };
}

/**
 * Homography that warps a width×height rectangle onto the quad defined by the
 * frame's 4 perspective corner offsets. Identity-ish (null) on degenerate quads.
 */
export function getPerspectiveHomography(
  width: number,
  height: number,
  corners: PerspectiveCorners
): number[] | null {
  const src: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const dst: [number, number][] = [
    [corners.tl.x, corners.tl.y],
    [width + corners.tr.x, corners.tr.y],
    [width + corners.br.x, height + corners.br.y],
    [corners.bl.x, height + corners.bl.y],
  ];
  return computeHomography(src, dst);
}

/** Corner positions in the frame's local coordinate space (pixels). */
export function getCornerLocalPositions(
  width: number,
  height: number,
  corners: PerspectiveCorners
) {
  return {
    tl: { x: corners.tl.x, y: corners.tl.y },
    tr: { x: width + corners.tr.x, y: corners.tr.y },
    br: { x: width + corners.br.x, y: height + corners.br.y },
    bl: { x: corners.bl.x, y: height + corners.bl.y },
  };
}

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

/** Rotate a vector by `degrees` around the origin. */
export function rotateVector(x: number, y: number, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Convert a composition-space point into a frame's local (unrotated) space,
 * where (0,0) is the frame's top-left and (width,height) its bottom-right.
 */
export function compToFrameLocal(
  cx: number,
  cy: number,
  frame: { x: number; y: number; width: number; height: number; rotation: number }
): Point {
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  const v = rotateVector(cx - centerX, cy - centerY, -frame.rotation);
  return { x: v.x + frame.width / 2, y: v.y + frame.height / 2 };
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

/** Normalized (0–1) vertices for a shape; circles are approximated by an n-gon. */
export function getShapeVertices(
  shape: 'rectangle' | 'circle' | 'polygon',
  polygonVertices: Point[] | undefined,
  circleSegments = 48
): Point[] {
  if (shape === 'polygon' && polygonVertices && polygonVertices.length >= 3) {
    return polygonVertices;
  }
  if (shape === 'circle') {
    const pts: Point[] = [];
    for (let i = 0; i < circleSegments; i++) {
      const a = (i / circleSegments) * Math.PI * 2;
      pts.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) });
    }
    return pts;
  }
  // rectangle (and fallback)
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
}
