import React, { useRef } from 'react';
import type { Point, Quad, Rect, Screen, Slice } from '../types';
import { useProjectStore } from '../state/projectStore';
import { selectScreen, selectSlice, useScreenEditor } from '../state/screenEditor';
import { updateSlice } from '../state/screenActions';
import { applyHomography, computeHomography } from '../lib/geometry';
import {
  isValidQuad, moveQuad, rectQuad, resizeRect, setCorner, snapDelta, snapShift, snapTargets, type RectHandle,
} from '../state/screens';

// ---------------------------------------------------------------------------
// Editing slices on the stage. Input view: the composition with every
// slice's input rectangle (drag to move, edges and corners to resize).
// Output view: one screen with its slices' output corners (drag a corner to
// warp, the inside to move). Edges and corners snap to the borders, the
// middle and the other slices — Alt drags freely; the composition grid's
// snap applies to input rectangles.
// ---------------------------------------------------------------------------

const SNAP_PX = 8; // editor px
const HANDLE_PX = 10;

type Space = { width: number; height: number };

/** Pointer → stage px (the overlay fills the stage, whatever its zoom). */
const stagePoint = (el: HTMLElement, space: Space, clientX: number, clientY: number): Point => {
  const rect = el.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) * space.width) / (rect.width || 1),
    y: ((clientY - rect.top) * space.height) / (rect.height || 1),
  };
};

// Snap targets for a grid: the grid lines around each value
const gridTargets = (values: number[], size: number) =>
  values.flatMap(v => [Math.floor(v / size) * size, Math.ceil(v / size) * size]);

interface Gesture {
  pointerId: number;
  screenId: string;
  sliceId: string;
  from: Point;
}

// ---- Input view -------------------------------------------------------------------------------

const RECT_HANDLES: { handle: RectHandle; x: number; y: number; cursor: string }[] = [
  { handle: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { handle: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { handle: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { handle: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { handle: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { handle: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { handle: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { handle: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

/** Snap a moved or resized input rectangle: only the edges that move. */
const snapRect = (
  rect: Rect,
  handle: RectHandle | 'move',
  targets: { xs: number[]; ys: number[] },
  threshold: number,
  grid: number | null,
): Rect => {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const xsOf = (values: number[]) => (grid ? gridTargets(values, grid) : targets.xs);
  const ysOf = (values: number[]) => (grid ? gridTargets(values, grid) : targets.ys);
  const limit = grid ?? threshold;
  if (handle === 'move') {
    const dx = snapShift([rect.x, right], xsOf([rect.x, right]), limit);
    const dy = snapShift([rect.y, bottom], ysOf([rect.y, bottom]), limit);
    return { ...rect, x: rect.x + dx, y: rect.y + dy };
  }
  const edge = (value: number, list: number[]) => value + (snapDelta(value, list, limit) ?? 0);
  let left = rect.x;
  let top = rect.y;
  let r = right;
  let b = bottom;
  if (handle.includes('w')) left = edge(left, xsOf([left]));
  if (handle.includes('e')) r = edge(r, xsOf([r]));
  if (handle.includes('n')) top = edge(top, ysOf([top]));
  if (handle.includes('s')) b = edge(b, ysOf([b]));
  // Snapping never folds the rectangle
  if (r - left < 1 || b - top < 1) return rect;
  return { x: left, y: top, width: r - left, height: b - top };
};

export const SliceInputOverlay: React.FC<{ viewScale: number }> = ({ viewScale }) => {
  const screens = useProjectStore(s => s.screens);
  const composition = useProjectStore(s => s.composition);
  const grid = useProjectStore(s => s.grid);
  const screenId = useScreenEditor(s => s.screenId);
  const sliceId = useScreenEditor(s => s.sliceId);
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<(Gesture & { handle: RectHandle | 'move'; start: Rect }) | null>(null);
  const px = 1 / viewScale;

  const begin = (e: React.PointerEvent, screen: Screen, slice: Slice, handle: RectHandle | 'move') => {
    if (e.button !== 0 || !rootRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    selectScreen(screen.id, slice.id);
    rootRef.current.setPointerCapture(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId, screenId: screen.id, sliceId: slice.id, handle, start: slice.input,
      from: stagePoint(rootRef.current, composition, e.clientX, e.clientY),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId || !rootRef.current) return;
    const p = stagePoint(rootRef.current, composition, e.clientX, e.clientY);
    const dx = p.x - g.from.x;
    const dy = p.y - g.from.y;
    let rect = g.handle === 'move' ? { ...g.start, x: g.start.x + dx, y: g.start.y + dy } : resizeRect(g.start, g.handle, dx, dy);
    if (!e.altKey) {
      const others = screens.flatMap(s => s.slices).filter(s => s.id !== g.sliceId).map(s => rectQuad(s.input));
      rect = snapRect(rect, g.handle, snapTargets(composition, others), SNAP_PX * px, grid.snap ? grid.size : null);
    }
    updateSlice(g.screenId, g.sliceId, { input: rect });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (gesture.current?.pointerId !== e.pointerId) return;
    gesture.current = null;
    rootRef.current?.releasePointerCapture(e.pointerId);
  };

  // The selected screen's slices on top
  const ordered = [...screens.filter(s => s.id !== screenId), ...screens.filter(s => s.id === screenId)];

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      style={{ zIndex: 800 }}
      onPointerDown={(e) => {
        if (e.button === 0) selectSlice(null);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {ordered.map(screen => screen.slices.map(slice => {
        const isScreen = screen.id === screenId;
        const isSelected = isScreen && slice.id === sliceId;
        const { x, y, width, height } = slice.input;
        return (
          <div
            key={slice.id}
            className="absolute cursor-move"
            style={{
              left: x,
              top: y,
              width,
              height,
              boxSizing: 'border-box',
              border: `${(isSelected ? 2 : 1.5) * px}px ${isScreen ? 'solid' : 'dashed'} ${
                isSelected ? '#22d3ee' : isScreen ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'
              }`,
              background: isSelected ? 'rgba(34,211,238,0.08)' : undefined,
              opacity: slice.enabled ? 1 : 0.45,
            }}
            onPointerDown={(e) => begin(e, screen, slice, 'move')}
          >
            <span
              className="absolute left-0 top-0 whitespace-nowrap bg-black/70 text-white rounded-br pointer-events-none"
              style={{ fontSize: 11 * px, padding: `${2 * px}px ${5 * px}px` }}
            >
              {screen.name} · {slice.name}
            </span>
            {isSelected && RECT_HANDLES.map(h => (
              <div
                key={h.handle}
                className="absolute bg-white border border-cyan-500 rounded-sm"
                style={{
                  left: `calc(${h.x * 100}% - ${(HANDLE_PX / 2) * px}px)`,
                  top: `calc(${h.y * 100}% - ${(HANDLE_PX / 2) * px}px)`,
                  width: HANDLE_PX * px,
                  height: HANDLE_PX * px,
                  borderWidth: px,
                  cursor: h.cursor,
                }}
                onPointerDown={(e) => begin(e, screen, slice, h.handle)}
              />
            ))}
          </div>
        );
      }))}
    </div>
  );
};

// ---- Output view ------------------------------------------------------------------------------

const GRID_STEPS = [0.25, 0.5, 0.75];

/** Lines of a 4 × 4 grid through the slice's warp — shows the perspective. */
const warpGrid = (quad: Quad): [Point, Point][] => {
  const h = computeHomography([[0, 0], [1, 0], [1, 1], [0, 1]], quad.map(p => [p.x, p.y]));
  if (!h) return [];
  const at = (u: number, v: number) => applyHomography(h, u, v);
  return GRID_STEPS.flatMap(t => [[at(t, 0), at(t, 1)], [at(0, t), at(1, t)]] as [Point, Point][]);
};

export const SliceOutputOverlay: React.FC<{ screen: Screen; viewScale: number }> = ({ screen, viewScale }) => {
  const sliceId = useScreenEditor(s => s.sliceId);
  const corner = useScreenEditor(s => s.corner);
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<(Gesture & { corner: number | null; start: Quad }) | null>(null);
  const px = 1 / viewScale;

  const begin = (e: React.PointerEvent, slice: Slice, cornerIndex: number | null) => {
    if (e.button !== 0 || !rootRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    selectScreen(screen.id, slice.id);
    selectSlice(slice.id, cornerIndex);
    rootRef.current.setPointerCapture(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId, screenId: screen.id, sliceId: slice.id, corner: cornerIndex, start: slice.output,
      from: stagePoint(rootRef.current, screen, e.clientX, e.clientY),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId || !rootRef.current) return;
    const p = stagePoint(rootRef.current, screen, e.clientX, e.clientY);
    const dx = p.x - g.from.x;
    const dy = p.y - g.from.y;
    const others = screen.slices.filter(s => s.id !== g.sliceId).map(s => s.output);
    const targets = snapTargets(screen, others);
    const threshold = e.altKey ? 0 : SNAP_PX * px;
    let output: Quad;
    if (g.corner === null) {
      const moved = moveQuad(g.start, dx, dy);
      output = threshold > 0
        ? moveQuad(moved, snapShift(moved.map(q => q.x), targets.xs, threshold), snapShift(moved.map(q => q.y), targets.ys, threshold))
        : moved;
    } else {
      const start = g.start[g.corner];
      const x = start.x + dx;
      const y = start.y + dy;
      output = setCorner(g.start, g.corner, {
        x: x + (threshold > 0 ? snapDelta(x, targets.xs, threshold) ?? 0 : 0),
        y: y + (threshold > 0 ? snapDelta(y, targets.ys, threshold) ?? 0 : 0),
      });
      // A folded or flipped quad would turn the picture inside out: keep the last good one
      if (!isValidQuad(output)) return;
    }
    updateSlice(g.screenId, g.sliceId, { output });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (gesture.current?.pointerId !== e.pointerId) return;
    gesture.current = null;
    rootRef.current?.releasePointerCapture(e.pointerId);
  };

  const selected = screen.slices.find(s => s.id === sliceId);
  const stroke = 1.5 * px;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      style={{ zIndex: 800 }}
      onPointerDown={(e) => {
        if (e.button === 0) selectSlice(null);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${screen.width} ${screen.height}`} preserveAspectRatio="none">
        {screen.slices.map(slice => {
          const isSelected = slice.id === sliceId;
          return (
            <g key={slice.id} opacity={slice.enabled ? 1 : 0.45}>
              <polygon
                points={slice.output.map(p => `${p.x},${p.y}`).join(' ')}
                fill={isSelected ? 'rgba(34,211,238,0.06)' : 'transparent'}
                stroke={isSelected ? '#22d3ee' : 'rgba(255,255,255,0.7)'}
                strokeWidth={isSelected ? 2 * px : stroke}
                className="cursor-move"
                onPointerDown={(e) => begin(e, slice, null)}
              />
              <text
                x={slice.output[0].x + 6 * px}
                y={slice.output[0].y + 16 * px}
                fontSize={11 * px}
                fill="white"
                stroke="black"
                strokeWidth={3 * px}
                paintOrder="stroke"
                className="pointer-events-none select-none"
              >
                {slice.name}
              </text>
            </g>
          );
        })}
        {selected && (
          <g className="pointer-events-none">
            {warpGrid(selected.output).map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(34,211,238,0.45)" strokeWidth={px} />
            ))}
          </g>
        )}
        {selected && selected.output.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={(HANDLE_PX / 2 + 1) * px}
            fill={corner === i ? '#22d3ee' : 'white'}
            stroke="#0891b2"
            strokeWidth={1.5 * px}
            className="cursor-crosshair"
            onPointerDown={(e) => begin(e, selected, i)}
          />
        ))}
      </svg>
    </div>
  );
};
