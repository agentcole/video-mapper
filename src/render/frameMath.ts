import type { MediaFrame, Point } from '../types';
import {
  applyHomography, frameLocalToComp, getFrameHomography, getShapeVertices, invertHomography,
} from '../lib/geometry';

// ---------------------------------------------------------------------------
// Per-frame render parameters for the GPU compositor. The fragment shader
// maps every pixel backwards: composition → frame box (undo rotation, then
// H⁻¹) → content element (undo flip / zoom / pan) → media (object-fit:
// cover). The TypeScript functions below are the reference implementation
// of that mapping (and are what the unit tests check against the CSS model).
// ---------------------------------------------------------------------------

export const MAX_POLYGON_VERTICES = 64;

export type ShapeCode = 0 | 1 | 2; // rectangle, circle (ellipse), polygon

export interface FrameRenderParams {
  center: Point; // box centre in composition px (rotation pivot)
  cos: number; // of the frame rotation
  sin: number;
  size: Point; // box width / height
  // Warped local → unwarped box px, as a column-major 3×3 (GLSL mat3)
  hinv: number[];
  // The warped box's corners in composition px (geometry to draw)
  quad: Point[];
  shape: ShapeCode;
  vertices: Point[]; // normalized polygon vertices (polygon shape only)
  flip: Point; // ±1 per axis
  zoom: number;
  offset: Point; // pan in box px
  softEdge: [number, number, number, number]; // left, right, top, bottom px
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** 8-element homography (h22 = 1) → column-major mat3. */
export const toMat3 = (h: number[]): number[] => [h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], 1];

export function frameRenderParams(frame: MediaFrame): FrameRenderParams {
  const w = frame.width;
  const h = frame.height;
  const H = getFrameHomography(frame);
  const Hinv = H ? invertHomography(H) : null;
  const rad = (frame.rotation * Math.PI) / 180;
  const toWarped = (x: number, y: number): Point => (H ? applyHomography(H, x, y) : { x, y });
  const quad = [toWarped(0, 0), toWarped(w, 0), toWarped(w, h), toWarped(0, h)]
    .map(p => frameLocalToComp(p.x, p.y, frame));
  const softEdge = frame.softEdge ?? { left: 0, right: 0, top: 0, bottom: 0 };
  const isPolygon = frame.shape === 'polygon' && (frame.vertices?.length ?? 0) >= 3;
  return {
    center: { x: frame.x + w / 2, y: frame.y + h / 2 },
    cos: Math.cos(rad),
    sin: Math.sin(rad),
    size: { x: w, y: h },
    hinv: Hinv ? toMat3(Hinv) : IDENTITY3,
    quad,
    shape: frame.shape === 'circle' ? 1 : isPolygon ? 2 : 0,
    vertices: isPolygon
      ? getShapeVertices('polygon', frame.vertices).slice(0, MAX_POLYGON_VERTICES)
      : [],
    flip: { x: frame.flipHorizontal ? -1 : 1, y: frame.flipVertical ? -1 : 1 },
    zoom: frame.contentScale ?? 1,
    offset: { x: ((frame.contentOffsetX ?? 0) / 100) * w, y: ((frame.contentOffsetY ?? 0) / 100) * h },
    softEdge: [softEdge.left, softEdge.right, softEdge.top, softEdge.bottom],
  };
}

/** Composition px → unwarped box px (what the shader does per pixel). */
export function compToBox(p: FrameRenderParams, x: number, y: number): Point {
  const dx = x - p.center.x;
  const dy = y - p.center.y;
  const lx = dx * p.cos + dy * p.sin + p.size.x / 2;
  const ly = -dx * p.sin + dy * p.cos + p.size.y / 2;
  const m = p.hinv;
  const hx = m[0] * lx + m[3] * ly + m[6];
  const hy = m[1] * lx + m[4] * ly + m[7];
  const hz = m[2] * lx + m[5] * ly + m[8];
  return { x: hx / hz, y: hy / hz };
}

/** Unwarped box px → content element uv (0–1 where the element covers). */
export function boxToElementUV(p: FrameRenderParams, box: Point): Point {
  let x = (box.x - p.size.x / 2) * p.flip.x;
  let y = (box.y - p.size.y / 2) * p.flip.y;
  x = x / p.zoom - p.offset.x;
  y = y / p.zoom - p.offset.y;
  return { x: x / p.size.x + 0.5, y: y / p.size.y + 0.5 };
}

/** Element uv → media uv for object-fit: cover. */
export function coverUV(uv: Point, boxAspect: number, mediaAspect: number): Point {
  if (mediaAspect > boxAspect) {
    return { x: 0.5 + (uv.x - 0.5) * (boxAspect / mediaAspect), y: uv.y };
  }
  return { x: uv.x, y: 0.5 + (uv.y - 0.5) * (mediaAspect / boxAspect) };
}
