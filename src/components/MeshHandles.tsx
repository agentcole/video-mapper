import React, { useRef } from 'react';
import type { MeshWarp, Point } from '../types';
import { prepareWarp, warpGridLines, type Warp } from '../lib/meshWarp';
import { dragMeshPoints, selectMeshPoints, type MeshTarget } from '../state/meshEditor';

// ---------------------------------------------------------------------------
// A mesh warp's control points on the stage (3.2), drawn where they land
// through the corner pin, with the curves through them. Click selects a
// point, Shift+click adds or removes one; dragging moves every selected
// point. Points are dragged in pin space, so they stay under the pointer.
// The SVG sits in the overlay's px (a surface's box, a screen).
// ---------------------------------------------------------------------------

interface MeshHandlesProps {
  target: MeshTarget;
  warp: Warp; // the target's warp in this overlay's px
  mesh: MeshWarp;
  selected: readonly number[];
  px: number; // overlay px per screen px (keeps handles a constant size)
  toSpace: (clientX: number, clientY: number) => Point; // pointer → overlay px
}

const HANDLE_RADIUS = 5; // screen px

export const MeshHandles: React.FC<MeshHandlesProps> = ({ target, warp, mesh, selected, px, toSpace }) => {
  const gesture = useRef<{ pointerId: number; from: Point; start: MeshWarp; indices: number[] } | null>(null);
  const prepared = prepareWarp(warp);
  if (!prepared) return null;
  const lines = warpGridLines(prepared, mesh, 6);
  const handles = mesh.points.map(p => prepared.pin(p.x, p.y));

  const onPointerDown = (e: React.PointerEvent<SVGCircleElement>, index: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const indices = e.shiftKey
      ? selected.includes(index) ? selected.filter(k => k !== index) : [...selected, index]
      : selected.includes(index) ? [...selected] : [index];
    selectMeshPoints(indices);
    if (!indices.includes(index)) return; // Shift+click took it out
    const from = prepared.unpin(toSpace(e.clientX, e.clientY));
    if (!from) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { pointerId: e.pointerId, from, start: mesh, indices };
  };

  const onPointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const p = prepared.unpin(toSpace(e.clientX, e.clientY));
    if (p) dragMeshPoints(target, g.start, g.indices, { x: p.x - g.from.x, y: p.y - g.from.y });
  };

  const onPointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    if (gesture.current?.pointerId !== e.pointerId) return;
    gesture.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <svg
      className="absolute"
      style={{ left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: 4 }}
      data-mesh-handles=""
    >
      <g fill="none" stroke="rgba(34, 211, 238, 0.7)" strokeWidth={px}>
        {lines.map((line, i) => (
          <polyline key={i} points={line.map(p => `${p.x},${p.y}`).join(' ')} />
        ))}
      </g>
      {handles.map((p, k) => {
        const isSelected = selected.includes(k);
        return (
          <circle
            key={k}
            cx={p.x}
            cy={p.y}
            r={HANDLE_RADIUS * px}
            fill={isSelected ? '#22d3ee' : 'white'}
            stroke="#0e7490"
            strokeWidth={1.5 * px}
            style={{ pointerEvents: 'auto', cursor: 'move', touchAction: 'none' }}
            onPointerDown={(e) => onPointerDown(e, k)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-mesh-point={k}
          >
            <title>{`Mesh point ${(k % mesh.columns) + 1}, ${Math.floor(k / mesh.columns) + 1} — Shift+click to add to the selection`}</title>
          </circle>
        );
      })}
    </svg>
  );
};
