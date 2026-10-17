import React, { useState } from 'react';
import type { MediaFrame, CompositionSettings, BlendMode } from '../types';
import {
  Layers,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Trash2,
  Copy,
  Video,
  Image as ImageIcon,
  Square,
  Circle,
  Pentagon,
} from 'lucide-react';
import { Slider } from './ui/slider';
import { scaleFrameSize } from '../lib/geometry';
import { field, iconButton, option, panelSurface, panelTitle, sectionLabel } from './ui/theme';

interface LayersPanelProps {
  frames: MediaFrame[];
  selectedFrameIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onUpdate: (id: string, updates: Partial<MediaFrame>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  composition: CompositionSettings;
}

const frameDisplayName = (frame: MediaFrame, index: number): string => {
  return frame.name || frame.filename || `${frame.shape} ${index + 1}`;
};

const ShapeIcon: React.FC<{ frame: MediaFrame }> = ({ frame }) => {
  const cls = 'w-3.5 h-3.5 shrink-0';
  if (frame.url) {
    return frame.type === 'video' ? <Video className={cls} /> : <ImageIcon className={cls} />;
  }
  if (frame.shape === 'circle') return <Circle className={cls} />;
  if (frame.shape === 'polygon') return <Pentagon className={cls} />;
  return <Square className={cls} />;
};

// Numeric input that commits parseable values as you type
const NumberField: React.FC<{
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
}> = ({ label, value, onCommit, step = 1 }) => (
  <label className="flex items-center gap-1 text-[11px] text-gray-400">
    <span className="w-4 shrink-0">{label}</span>
    <input
      type="number"
      value={Math.round(value * 100) / 100}
      step={step}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onCommit(n);
      }}
      className="w-full min-w-0 bg-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
    />
  </label>
);

export const LayersPanel: React.FC<LayersPanelProps> = ({
  frames,
  selectedFrameIds,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onReorder,
  composition,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  // Top layer first (highest zIndex)
  const sorted = [...frames].sort((a, b) => b.zIndex - a.zIndex);
  const selectedFrame = selectedFrameIds.length === 1
    ? frames.find(f => f.id === selectedFrameIds[0]) ?? null
    : null;

  const commitName = (id: string) => {
    const trimmed = nameDraft.trim();
    onUpdate(id, { name: trimmed || undefined });
    setEditingNameId(null);
  };

  return (
    <div
      className={`fixed top-4 right-4 ${panelSurface} z-[1000] w-64 flex flex-col`}
      // Ends above the clip launcher when it is open
      style={isCollapsed ? undefined : { bottom: 'calc(1rem + var(--launcher-height, 0px))' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer shrink-0"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className={panelTitle}>
          <Layers className="w-4 h-4" />
          Layers
          <span className="text-xs text-gray-400 font-normal">({frames.length})</span>
        </h2>
        <button className={iconButton} title={isCollapsed ? 'Expand' : 'Collapse'}>
          <ChevronsUpDown className="w-4 h-4" />
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Layer list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-0">
            {sorted.length === 0 && (
              <p className="text-xs text-gray-500 px-2 py-4 text-center">No layers yet — draw a frame or drop media.</p>
            )}
            {sorted.map((frame, i) => {
              const isSelected = selectedFrameIds.includes(frame.id);
              const displayName = frameDisplayName(frame, frames.indexOf(frame));
              return (
                <div
                  key={frame.id}
                  className={`group flex items-center gap-1.5 rounded px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                    isSelected ? 'bg-cyan-600/40 ring-1 ring-cyan-500' : 'bg-white/5 hover:bg-white/10'
                  } ${frame.visible === false ? 'opacity-50' : ''}`}
                  onClick={(e) => onSelect(frame.id, e.shiftKey)}
                >
                  {/* Visibility */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(frame.id, { visible: frame.visible === false });
                    }}
                    className="p-0.5 hover:bg-white/20 rounded shrink-0"
                    title={frame.visible === false ? 'Show layer' : 'Hide layer'}
                  >
                    {frame.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  <ShapeIcon frame={frame} />

                  {/* Name (double-click to rename) */}
                  {editingNameId === frame.id ? (
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => commitName(frame.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitName(frame.id);
                        if (e.key === 'Escape') setEditingNameId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-white/10 rounded px-1 py-0.5 text-xs focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 truncate"
                      title={`${displayName} — double-click to rename`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingNameId(frame.id);
                        setNameDraft(frame.name ?? '');
                      }}
                    >
                      {displayName}
                    </span>
                  )}

                  {/* Row actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onReorder(frame.id, 'up'); }}
                      disabled={i === 0}
                      className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onReorder(frame.id, 'down'); }}
                      disabled={i === sorted.length - 1}
                      className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(frame.id); }}
                      className="p-0.5 hover:bg-white/20 rounded"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(frame.id); }}
                      className="p-0.5 hover:bg-red-500/50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Properties (single selection) */}
          <div className="border-t border-white/10 p-3 shrink-0 space-y-2">
            {selectedFrame ? (
              <>
                <p className={sectionLabel}>Properties</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="X" value={selectedFrame.x} onCommit={(v) => onUpdate(selectedFrame.id, { x: v })} />
                  <NumberField label="Y" value={selectedFrame.y} onCommit={(v) => onUpdate(selectedFrame.id, { y: v })} />
                  {/* Same pin scaling as the resize handles, so a warp keeps its shape */}
                  <NumberField label="W" value={selectedFrame.width} onCommit={(v) => v >= 10 && onUpdate(selectedFrame.id, scaleFrameSize(selectedFrame, v, selectedFrame.height))} />
                  <NumberField label="H" value={selectedFrame.height} onCommit={(v) => v >= 10 && onUpdate(selectedFrame.id, scaleFrameSize(selectedFrame, selectedFrame.width, v))} />
                </div>
                <NumberField label="∠" value={selectedFrame.rotation} onCommit={(v) => onUpdate(selectedFrame.id, { rotation: v })} />
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 flex justify-between">
                    Opacity <span className="tabular-nums text-white">{Math.round(selectedFrame.opacity * 100)}%</span>
                  </label>
                  <Slider
                    value={[selectedFrame.opacity * 100]}
                    onValueChange={(value) => onUpdate(selectedFrame.id, { opacity: value[0] / 100 })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-gray-400 shrink-0">Blend</label>
                  <select
                    value={selectedFrame.blendMode}
                    onChange={(e) => onUpdate(selectedFrame.id, { blendMode: e.target.value as BlendMode })}
                    className={`flex-1 min-w-0 ${field}`}
                  >
                    {['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map(mode => (
                      <option key={mode} value={mode} className={option}>{mode}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : selectedFrameIds.length > 1 ? (
              <p className="text-xs text-gray-400">{selectedFrameIds.length} layers selected</p>
            ) : (
              <p className="text-[11px] text-gray-500">
                Composition {composition.width} × {composition.height} — select a layer to edit its properties
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
