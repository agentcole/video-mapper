import type { CompositionSettings, Point, Quad, Rect, Screen, Slice } from '../types';
import { computeHomography, invertHomography, isConvexQuad } from '../lib/geometry';

// ---------------------------------------------------------------------------
// Screens and slices (roadmap 3.1): the composition is the content; a screen
// is one output (projector, display) with its own resolution; a slice takes
// a rectangle of the composition (input) and puts it on the screen through
// four corners (output). No screens: every output shows the whole
// composition, as before. See docs/design/screens.md.
// ---------------------------------------------------------------------------

export const MIN_SLICE_SIZE = 1; // px, input rectangles
export const MAX_SCREEN_SIZE = 16384;

const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const rectQuad = ({ x, y, width, height }: Rect): Quad => [
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
];

export const quadBounds = (quad: readonly Point[]): Rect => {
  const xs = quad.map(p => p.x);
  const ys = quad.map(p => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const moveQuad = (quad: Quad, dx: number, dy: number): Quad =>
  quad.map(p => ({ x: p.x + dx, y: p.y + dy })) as Quad;

export const setCorner = (quad: Quad, index: number, point: Point): Quad =>
  quad.map((p, i) => (i === index ? point : p)) as Quad;

/** A usable output: four corners in order (TL, TR, BR, BL), convex, not folded. */
export const isValidQuad = (quad: readonly Point[]): boolean => isConvexQuad([...quad]);

export const nextName = (prefix: string, names: readonly string[]): string => {
  let n = names.length + 1;
  while (names.includes(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
};

export const createSlice = (input: Rect, output: Quad, name = 'Slice 1'): Slice => ({
  id: randomId('slice'), name, enabled: true, input, output,
});

/** A screen the size of the composition showing all of it. */
export const createScreen = (composition: CompositionSettings, name = 'Screen 1'): Screen => {
  const whole = { x: 0, y: 0, width: composition.width, height: composition.height };
  return {
    id: randomId('screen'),
    name,
    width: composition.width,
    height: composition.height,
    slices: [createSlice(whole, rectQuad(whole))],
  };
};

/**
 * Split the composition into columns × rows screens (e.g. projectors side
 * by side), neighbours sharing `overlap` px for edge blending. Each screen
 * gets the size of its part and one slice filling it.
 */
export const splitComposition = (
  composition: CompositionSettings,
  columns: number,
  rows: number,
  overlap = 0,
): Screen[] => {
  const c = Math.max(1, Math.round(columns));
  const r = Math.max(1, Math.round(rows));
  const ox = c > 1 ? Math.max(0, Math.min(overlap, composition.width / c)) : 0;
  const oy = r > 1 ? Math.max(0, Math.min(overlap, composition.height / r)) : 0;
  const partW = (composition.width + (c - 1) * ox) / c;
  const partH = (composition.height + (r - 1) * oy) / r;
  const screens: Screen[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const x = Math.round(col * (partW - ox));
      const y = Math.round(row * (partH - oy));
      // The last part ends exactly at the composition's edge
      const width = (col === c - 1 ? composition.width : Math.round(x + partW)) - x;
      const height = (row === r - 1 ? composition.height : Math.round(y + partH)) - y;
      const input = { x, y, width, height };
      screens.push({
        id: randomId('screen'),
        name: `Screen ${screens.length + 1}`,
        width,
        height,
        slices: [createSlice(input, rectQuad({ x: 0, y: 0, width, height }))],
      });
    }
  }
  return screens;
};

/** New resolution: the slices keep their place on the screen (scaled with it). */
export const resizeScreen = (screen: Screen, width: number, height: number): Screen => {
  const w = Math.max(16, Math.min(MAX_SCREEN_SIZE, Math.round(width)));
  const h = Math.max(16, Math.min(MAX_SCREEN_SIZE, Math.round(height)));
  if (w === screen.width && h === screen.height) return screen;
  const sx = w / screen.width;
  const sy = h / screen.height;
  return {
    ...screen,
    width: w,
    height: h,
    slices: screen.slices.map(s => ({ ...s, output: s.output.map(p => ({ x: p.x * sx, y: p.y * sy })) as Quad })),
  };
};

export const fillScreen = (screen: Pick<Screen, 'width' | 'height'>): Quad =>
  rectQuad({ x: 0, y: 0, width: screen.width, height: screen.height });

/** Output = the input rectangle at the same coordinates (screen and composition 1:1). */
export const matchOutputToInput = (slice: Slice): Quad => rectQuad(slice.input);

/** Input = the output's bounding box (the inverse of the above). */
export const matchInputToOutput = (slice: Slice): Rect => {
  const b = quadBounds(slice.output);
  return { ...b, width: Math.max(MIN_SLICE_SIZE, b.width), height: Math.max(MIN_SLICE_SIZE, b.height) };
};

const UNIT: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const pairs = (quad: readonly Point[]): [number, number][] => quad.map(p => [p.x, p.y]);

/** Homography: input rectangle px (0..width, 0..height) → screen px. */
export const sliceHomography = (slice: Slice): number[] | null => {
  const { width: w, height: h } = slice.input;
  return computeHomography([[0, 0], [w, 0], [w, h], [0, h]], pairs(slice.output));
};

/** Homography: screen px → unit square of the slice (0..1 across its input). */
export const screenToSlice = (slice: Slice): number[] | null => {
  const toScreen = computeHomography(UNIT, pairs(slice.output));
  return toScreen ? invertHomography(toScreen) : null;
};

/** How much a slice magnifies the composition (screen px per composition px). */
export const sliceZoom = (slice: Slice): number => {
  const b = quadBounds(slice.output);
  return Math.max(b.width / Math.max(1, slice.input.width), b.height / Math.max(1, slice.input.height));
};

// ---- Editing --------------------------------------------------------------------------------

export type RectHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Drag one edge or corner of a rectangle by (dx, dy); it never gets smaller than `min`. */
export const resizeRect = (start: Rect, handle: RectHandle, dx: number, dy: number, min = MIN_SLICE_SIZE): Rect => {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes('w')) left = Math.min(left + dx, right - min);
  if (handle.includes('e')) right = Math.max(right + dx, left + min);
  if (handle.includes('n')) top = Math.min(top + dy, bottom - min);
  if (handle.includes('s')) bottom = Math.max(bottom + dy, top + min);
  return { x: left, y: top, width: right - left, height: bottom - top };
};

/** How far to move `value` onto the nearest target within `threshold` (null: none in range). */
export const snapDelta = (value: number, targets: readonly number[], threshold: number): number | null => {
  let best: number | null = null;
  for (const t of targets) {
    const d = t - value;
    if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
};

/** The shift that puts the closest of several values (edges, corners) onto a target; 0 when none is in range. */
export const snapShift = (values: readonly number[], targets: readonly number[], threshold: number): number => {
  let best: number | null = null;
  for (const v of values) {
    const d = snapDelta(v, targets, threshold);
    if (d !== null && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best ?? 0;
};

/** The nearest target within `threshold`, or the value itself. */
export const snapValue = (value: number, targets: readonly number[], threshold: number): number => {
  let best = value;
  let distance = threshold;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d <= distance) {
      best = t;
      distance = d;
    }
  }
  return best;
};

/** Edges a slice can snap to: the space's borders and the other slices' edges / corners. */
export const snapTargets = (
  space: { width: number; height: number },
  others: readonly (readonly Point[])[],
): { xs: number[]; ys: number[] } => ({
  xs: [0, space.width / 2, space.width, ...others.flatMap(q => q.map(p => p.x))],
  ys: [0, space.height / 2, space.height, ...others.flatMap(q => q.map(p => p.y))],
});
