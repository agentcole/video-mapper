import React from 'react';
import { Grid3X3, RotateCcw, Trash2 } from 'lucide-react';
import type { MeshWarp } from '../types';
import { Button } from './ui/button';
import { field, option, sectionLabel, segment, segmented } from './ui/theme';
import {
  addMesh, editMesh, removeMesh, resetMeshPoints, sameTarget, setMeshSize, setMeshSmooth, setTargetWarp,
  useMeshEditor, type MeshTarget,
} from '../state/meshEditor';
import { useLiveStore } from '../state/liveStore';
import { MESH_MAX_POINTS, MESH_MIN_POINTS } from '../lib/meshWarp';

// ---------------------------------------------------------------------------
// Warp settings of a surface or a slice (3.2): how the corner pin
// interpolates, and a mesh inside it — its size, linear or smooth, and
// editing its points on the stage.
// ---------------------------------------------------------------------------

const COUNTS = Array.from({ length: MESH_MAX_POINTS - MESH_MIN_POINTS + 1 }, (_, i) => MESH_MIN_POINTS + i);

interface WarpControlsProps {
  target: MeshTarget;
  bilinear?: boolean;
  mesh?: MeshWarp;
  // A surface's corner pin is off: there are no corners to interpolate yet
  pinOff?: boolean;
}

export const WarpControls: React.FC<WarpControlsProps> = ({ target, bilinear, mesh, pinOff = false }) => {
  const editing = useMeshEditor(s => sameTarget(s.target, target));
  const selectedCount = useMeshEditor(s => (sameTarget(s.target, target) ? s.selected.length : 0));
  const renderer = useLiveStore(s => s.renderer);

  const countSelect = (value: number, onChange: (n: number) => void, label: string) => (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`flex-1 min-w-0 ${field}`}
      aria-label={label}
      title={label}
    >
      {COUNTS.map(n => <option key={n} value={n} className={option}>{n}</option>)}
    </select>
  );

  return (
    <div className="space-y-2" data-warp-controls="">
      <p className={sectionLabel}>Warp</p>
      <div className={segmented} role="group" aria-label="Corner pin">
        <button
          className={segment(!bilinear)}
          onClick={() => setTargetWarp(target, { bilinear: undefined })}
          title="Corners in perspective: straight lines stay straight (a flat surface seen at an angle)"
        >
          Perspective
        </button>
        <button
          className={segment(!!bilinear)}
          onClick={() => setTargetWarp(target, { bilinear: true })}
          disabled={pinOff}
          title={pinOff ? 'Turn the corner pin on first' : 'Corners interpolated bilinearly: even spacing along every edge'}
        >
          Bilinear
        </button>
      </div>

      {!mesh ? (
        <Button variant="outline" size="sm" className="w-full text-[11px]" onClick={() => addMesh(target)} title="A grid of points inside the corners, to bend the picture onto curved or uneven surfaces">
          <Grid3X3 className="w-3.5 h-3.5" /> Add mesh
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="shrink-0">Mesh</span>
            {countSelect(mesh.columns, (n) => setMeshSize(target, n, mesh.rows), 'Mesh points across')}
            <span className="shrink-0">×</span>
            {countSelect(mesh.rows, (n) => setMeshSize(target, mesh.columns, n), 'Mesh points down')}
          </div>
          <div className={segmented} role="group" aria-label="Mesh curves">
            <button className={segment(!mesh.smooth)} onClick={() => setMeshSmooth(target, false)} title="Straight between the points">
              Linear
            </button>
            <button className={segment(mesh.smooth)} onClick={() => setMeshSmooth(target, true)} title="Smooth curves through the points">
              Smooth
            </button>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className={`flex-1 text-[11px] ${editing ? 'bg-cyan-500 text-black border-cyan-500 hover:bg-cyan-400 hover:text-black' : ''}`}
              onClick={() => editMesh(editing ? null : target)}
              aria-pressed={editing}
              title="Show the mesh's points on the stage"
            >
              Edit points
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] px-2"
              onClick={() => resetMeshPoints(target)}
              title={selectedCount > 0 ? 'Selected points back on the grid' : 'All points back on the grid'}
              aria-label="Reset mesh points"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] px-2 hover:bg-red-500/40"
              onClick={() => removeMesh(target)}
              title="Remove the mesh"
              aria-label="Remove mesh"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          {editing && (
            <p className="text-[10px] text-gray-400 leading-snug">
              Drag points · Shift+click adds · arrows move them (Shift: 10 px) · ⌘/Ctrl+A all · Esc done
            </p>
          )}
        </>
      )}
      {renderer === 'css' && (mesh || bilinear) && (
        <p className="text-[10px] text-gray-400 leading-snug">The CSS renderer shows the corner pin only — the GPU renderer draws the mesh.</p>
      )}
    </div>
  );
};
