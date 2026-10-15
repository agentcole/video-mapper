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
 * Inverse of a homography (8-element vector, h22 = 1), normalized so that its
 * h22 is 1 again. Returns null for singular matrices.
 */
export function invertHomography(h: number[]): number[] | null {
  const [a, b, c, d, e, f, g, hh] = h;
  const i = 1;
  // Cofactors of the 3×3 matrix [a b c; d e f; g hh i]
  const A = e * i - f * hh;
  const B = -(d * i - f * g);
  const C = d * hh - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = [
    A, -(b * i - c * hh), b * f - c * e,
    B, a * i - c * g, -(a * f - c * d),
    C, -(a * hh - b * g), a * e - b * d,
  ].map(v => v / det);
  if (Math.abs(inv[8]) < 1e-12) return null;
  return inv.slice(0, 8).map(v => v / inv[8]);
}

/** True when all corner-pin offsets are (near) zero — i.e. no warp. */
export function isIdentityCorners(corners: PerspectiveCorners, epsilon = 1e-6): boolean {
  return (['tl', 'tr', 'br', 'bl'] as const).every(
    k => Math.abs(corners[k].x) < epsilon && Math.abs(corners[k].y) < epsilon
  );
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

/**
 * True for a strictly convex quad whose points run clockwise on screen
 * (y down) in TL, TR, BR, BL order — the orientation of an unwarped frame.
 * Folded, flipped or degenerate quads return false.
 */
export function isConvexQuad(quad: Point[], epsilon = 1e-6): boolean {
  if (quad.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= epsilon) return false;
  }
  return true;
}

/**
 * Reorder 4 points so they run clockwise on screen, starting at the point
 * nearest the top-left — the TL, TR, BR, BL order corner pins expect.
 */
export function canonicalQuadOrder(points: Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  const ring = area < 0 ? [...points].reverse() : [...points];
  let start = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i].x + ring[i].y < ring[start].x + ring[start].y) start = i;
  }
  return ring.map((_, k) => ring[(start + k) % ring.length]);
}

// ---------------------------------------------------------------------------
// Frame geometry (Photoshop-style: one homography per frame)
//
// A frame is an axis-aligned box (x, y, width, height) rotated about its
// centre. Its shape is a set of vertices normalized to that box, and its four
// corner pins warp the box — and everything drawn in it — through a single
// homography H. Local "unwarped" coordinates are box pixels; H maps them to
// "warped" local coordinates; rotation + position map those to composition.
// ---------------------------------------------------------------------------

export interface FrameGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  perspectiveMode: boolean;
  perspectiveCorners: PerspectiveCorners;
}

/** The homography used for rendering, or null when the frame is not warped. */
export function getFrameHomography(frame: FrameGeometry): number[] | null {
  if (!frame.perspectiveMode || isIdentityCorners(frame.perspectiveCorners)) return null;
  return getPerspectiveHomography(frame.width, frame.height, frame.perspectiveCorners);
}

/** Warped frame-local point → composition coordinates (applies rotation). */
export function frameLocalToComp(lx: number, ly: number, frame: FrameGeometry): Point {
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const v = rotateVector(lx - cx, ly - cy, frame.rotation);
  return { x: frame.x + cx + v.x, y: frame.y + cy + v.y };
}

/** The frame's rendered outline (shape through H, then rotation) in composition space. */
export function getFrameCompOutline(
  frame: FrameGeometry & { shape: 'rectangle' | 'circle' | 'polygon'; vertices?: Point[] }
): Point[] {
  const H = getFrameHomography(frame);
  return getShapeVertices(frame.shape, frame.vertices).map(v => {
    const p = { x: v.x * frame.width, y: v.y * frame.height };
    const warped = H ? applyHomography(H, p.x, p.y) : p;
    return frameLocalToComp(warped.x, warped.y, frame);
  });
}

/**
 * Shrink/grow a polygon frame's box so it tightly fits its vertices again
 * (after vertex edits), without moving anything on screen: the vertices are
 * renormalized, the corner pins are carried over (H'(q) = H(q + m) − m) and
 * the position compensates for the moved rotation pivot.
 * Returns null when the box already fits.
 */
export function refitFrameToVertices(frame: FrameGeometry & { vertices?: Point[] }): {
  x: number;
  y: number;
  width: number;
  height: number;
  vertices: Point[];
  perspectiveCorners: PerspectiveCorners;
} | null {
  const verts = frame.vertices;
  if (!verts || verts.length < 3) return null;
  const { width: w, height: h } = frame;
  const px = verts.map(v => ({ x: v.x * w, y: v.y * h }));
  const minX = Math.min(...px.map(p => p.x));
  const maxX = Math.max(...px.map(p => p.x));
  const minY = Math.min(...px.map(p => p.y));
  const maxY = Math.max(...px.map(p => p.y));
  const newW = maxX - minX;
  const newH = maxY - minY;
  if (newW < 1 || newH < 1) return null;

  const tolerance = 1e-6 * Math.max(w, h);
  if (
    Math.abs(minX) < tolerance && Math.abs(minY) < tolerance &&
    Math.abs(maxX - w) < tolerance && Math.abs(maxY - h) < tolerance
  ) {
    return null;
  }

  const vertices = px.map(p => ({ x: (p.x - minX) / newW, y: (p.y - minY) / newH }));

  // Carry the (possibly latent) corner-pin warp over to the new box
  let perspectiveCorners = frame.perspectiveCorners;
  const storedH = getPerspectiveHomography(w, h, frame.perspectiveCorners);
  if (storedH) {
    const map = (x: number, y: number): Point => {
      const p = applyHomography(storedH, x + minX, y + minY);
      return { x: p.x - minX, y: p.y - minY };
    };
    const tl = map(0, 0);
    const tr = map(newW, 0);
    const br = map(newW, newH);
    const bl = map(0, newH);
    perspectiveCorners = {
      tl: { x: tl.x, y: tl.y },
      tr: { x: tr.x - newW, y: tr.y },
      br: { x: br.x - newW, y: br.y - newH },
      bl: { x: bl.x, y: bl.y - newH },
    };
  }

  // Rotation happens about the box centre, which moves with the box:
  // pos' = pos + c − R·c − c' + R·(m + c')
  const c = { x: w / 2, y: h / 2 };
  const c2 = { x: newW / 2, y: newH / 2 };
  const rc = rotateVector(c.x, c.y, frame.rotation);
  const rmc2 = rotateVector(minX + c2.x, minY + c2.y, frame.rotation);

  return {
    x: frame.x + c.x - rc.x - c2.x + rmc2.x,
    y: frame.y + c.y - rc.y - c2.y + rmc2.y,
    width: newW,
    height: newH,
    vertices,
    perspectiveCorners,
  };
}

/** Resize a frame box (top-left fixed), scaling the corner pins with it. */
export function scaleFrameSize(
  frame: Pick<FrameGeometry, 'width' | 'height' | 'perspectiveCorners'>,
  width: number,
  height: number
): { width: number; height: number; perspectiveCorners: PerspectiveCorners } {
  const sx = width / frame.width;
  const sy = height / frame.height;
  const c = frame.perspectiveCorners;
  return {
    width,
    height,
    perspectiveCorners: {
      tl: { x: c.tl.x * sx, y: c.tl.y * sy },
      tr: { x: c.tr.x * sx, y: c.tr.y * sy },
      br: { x: c.br.x * sx, y: c.br.y * sy },
      bl: { x: c.bl.x * sx, y: c.bl.y * sy },
    },
  };
}

/**
 * Turn a 4-vertex polygon into a corner-pinned rectangle whose pins sit where
 * the polygon's vertices are currently rendered, so the media stretches onto
 * the quad (the old "warp" texture mode, expressed in the single-homography
 * model). Returns null when the vertices don't form a convex quad.
 */
export function pinFrameToQuadVertices(frame: FrameGeometry & { vertices?: Point[] }): {
  shape: 'rectangle';
  vertices: undefined;
  textureMode: 'clip';
  perspectiveMode: true;
  perspectiveCorners: PerspectiveCorners;
} | null {
  if (!frame.vertices || frame.vertices.length !== 4) return null;
  const { width: w, height: h } = frame;
  const H = getFrameHomography(frame);
  const rendered = frame.vertices.map(v => {
    const p = { x: v.x * w, y: v.y * h };
    return H ? applyHomography(H, p.x, p.y) : p;
  });
  const q = canonicalQuadOrder(rendered);
  if (!isConvexQuad(q)) return null;
  return {
    shape: 'rectangle',
    vertices: undefined,
    textureMode: 'clip',
    perspectiveMode: true,
    perspectiveCorners: {
      tl: { x: q[0].x, y: q[0].y },
      tr: { x: q[1].x - w, y: q[1].y },
      br: { x: q[2].x - w, y: q[2].y - h },
      bl: { x: q[3].x, y: q[3].y - h },
    },
  };
}

/**
 * Drop consecutive (near-)duplicate points, including a last point that
 * repeats the first — e.g. the extra click of a double-click.
 */
export function dedupePolygon(points: Point[], epsilon = 1): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > epsilon) out.push(p);
  }
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) > epsilon) break;
    out.pop();
  }
  return out;
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
