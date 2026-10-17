import React, { useEffect, useState } from 'react';
import {
  MonitorPlay, X, Plus, Trash2, Copy, ChevronUp, ChevronDown, ExternalLink, ScanSearch, Columns3, Eye, EyeOff,
} from 'lucide-react';
import { Button } from './ui/button';
import { NumberField } from './ui/number-field';
import { divider, field, iconButton, option, panelSurface, panelTitle, sectionLabel, segment, segmented } from './ui/theme';
import { useProjectStore } from '../state/projectStore';
import { openScreenEditor, selectScreen, selectSlice, setScreenView, useScreenEditor } from '../state/screenEditor';
import {
  addScreen, addSlice, duplicateSlice, moveSlice, removeScreen, removeSlice, renameScreen, setScreenSize,
  splitIntoScreens, updateSlice,
} from '../state/screenActions';
import { fillScreen, matchInputToOutput, matchOutputToInput, setCorner } from '../state/screens';
import { useOutputStatus } from '../output/controlSync';
import { assignDisplay, detectDisplays, openOutput, supportsDisplaySelection, useDisplays } from '../output/outputWindow';
import type { Point, Screen, Slice } from '../types';

// ---------------------------------------------------------------------------
// Screens panel (replaces the layers panel while the screen editor is open):
// the project's screens (outputs) and their slices, with numbers for
// everything that can be dragged on the stage.
// ---------------------------------------------------------------------------

const RESOLUTIONS = [
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

const CORNERS = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];

const SplitForm: React.FC<{ hasScreens: boolean; onDone: () => void }> = ({ hasScreens, onDone }) => {
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(1);
  const [overlap, setOverlap] = useState(0);
  return (
    <div className="space-y-2 rounded bg-white/5 p-2">
      <p className="text-[11px] text-gray-400">
        Split the composition into screens side by side — one per projector. Neighbours can overlap for edge blending.
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        <NumberField label="↔" value={columns} title="Columns" onCommit={(v) => setColumns(Math.max(1, Math.min(8, Math.round(v))))} />
        <NumberField label="↕" value={rows} title="Rows" onCommit={(v) => setRows(Math.max(1, Math.min(8, Math.round(v))))} />
        <NumberField label="⧉" value={overlap} title="Overlap (composition px)" onCommit={(v) => setOverlap(Math.max(0, Math.round(v)))} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            if (hasScreens && !window.confirm('Replace the screens with the split?')) return;
            splitIntoScreens(columns, rows, overlap);
            onDone();
          }}
        >
          Split into {columns * rows}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
};

const ScreenSettings: React.FC<{ screen: Screen }> = ({ screen }) => {
  const displays = useDisplays(s => s.displays);
  const assigned = useDisplays(s => s.assigned[screen.id]);
  const live = useOutputStatus(s => s.screens[screen.id] ?? 0);
  const [blocked, setBlocked] = useState(false);
  // Common sizes and the detected displays' (in device pixels)
  const sizes = [
    ...(displays ?? []).map(d => {
      const w = Math.round(d.width * d.pixelRatio);
      const h = Math.round(d.height * d.pixelRatio);
      return { value: `${w}x${h}`, label: `${w} × ${h} — ${d.label}` };
    }),
    ...RESOLUTIONS.map(r => ({ value: `${r.width}x${r.height}`, label: `${r.width} × ${r.height}` })),
  ];

  return (
    <div className={`space-y-2 pt-2 border-t ${divider}`}>
      <input
        key={`${screen.id}:${screen.name}`}
        defaultValue={screen.name}
        onBlur={(e) => renameScreen(screen.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={`w-full ${field}`}
        title="Screen name"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="W" value={screen.width} title="Width (px) — the projector's resolution" onCommit={(v) => v >= 16 && setScreenSize(screen.id, v, screen.height)} />
        <NumberField label="H" value={screen.height} title="Height (px)" onCommit={(v) => v >= 16 && setScreenSize(screen.id, screen.width, v)} />
      </div>
      <select
        value=""
        onChange={(e) => {
          const [w, h] = e.target.value.split('x').map(Number);
          if (w && h) setScreenSize(screen.id, w, h);
        }}
        className={`w-full ${field}`}
        title="Resolution — the slices scale with the screen"
      >
        <option value="" className={option}>Resolution…</option>
        {sizes.map(r => (
          <option key={r.value} value={r.value} className={option}>{r.label}</option>
        ))}
      </select>
      {supportsDisplaySelection() && (
        displays ? (
          <select
            value={assigned ?? ''}
            onChange={(e) => assignDisplay(screen.id, e.target.value || null)}
            className={`w-full ${field}`}
            title="The display this screen's output window opens on (remembered on this machine)"
          >
            <option value="" className={option}>Another display</option>
            {displays.map(d => (
              <option key={d.index} value={d.label} className={option}>
                {d.label} — {d.width}×{d.height}{d.isCurrent ? ' (this display)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => void detectDisplays()}>
            <ScanSearch />
            Detect displays
          </Button>
        )
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setBlocked(!openOutput(screen.id))}
          title="Open this screen's output window"
        >
          <ExternalLink />
          {live > 0 ? 'Show output' : 'Open output'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (window.confirm(`Delete ${screen.name}?`)) removeScreen(screen.id);
          }}
          title="Delete this screen"
        >
          <Trash2 />
        </Button>
      </div>
      {blocked && <p className="text-[11px] text-red-300">The browser blocked the window — allow pop-ups for this site.</p>}
    </div>
  );
};

const PointFields: React.FC<{ label: string; point: Point; onCommit: (p: Point) => void }> = ({ label, point, onCommit }) => (
  <div className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1.5">
    <span className="text-[11px] text-gray-400">{label}</span>
    <NumberField label="X" value={point.x} onCommit={(x) => onCommit({ ...point, x })} />
    <NumberField label="Y" value={point.y} onCommit={(y) => onCommit({ ...point, y })} />
  </div>
);

const SliceSettings: React.FC<{ screen: Screen; slice: Slice }> = ({ screen, slice }) => {
  const composition = useProjectStore(s => s.composition);
  const update = (updates: Partial<Slice>) => updateSlice(screen.id, slice.id, updates);
  const { input } = slice;
  return (
    <div className={`space-y-2 pt-2 border-t ${divider}`}>
      <p className={sectionLabel}>Input — part of the composition</p>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={input.x} onCommit={(x) => update({ input: { ...input, x } })} />
        <NumberField label="Y" value={input.y} onCommit={(y) => update({ input: { ...input, y } })} />
        <NumberField label="W" value={input.width} onCommit={(width) => width >= 1 && update({ input: { ...input, width } })} />
        <NumberField label="H" value={input.height} onCommit={(height) => height >= 1 && update({ input: { ...input, height } })} />
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-[11px]"
          onClick={() => update({ input: { x: 0, y: 0, width: composition.width, height: composition.height } })}
          title="The whole composition"
        >
          Whole
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-[11px]"
          onClick={() => update({ input: matchInputToOutput(slice) })}
          title="Input = the output's bounding box (screen and composition 1:1)"
        >
          = Output
        </Button>
      </div>

      <p className={sectionLabel}>Output — corners on the screen</p>
      <div className="space-y-1">
        {slice.output.map((p, i) => (
          <PointFields
            key={i}
            label={CORNERS[i]}
            point={p}
            onCommit={(point) => {
              const output = setCorner(slice.output, i, point);
              update({ output });
              selectSlice(slice.id, i);
            }}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1 text-[11px]" onClick={() => update({ output: fillScreen(screen) })} title="Corners on the screen's corners">
          Fill screen
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-[11px]"
          onClick={() => update({ output: matchOutputToInput(slice) })}
          title="Output = the input rectangle at the same coordinates (screen and composition 1:1)"
        >
          = Input
        </Button>
      </div>
    </div>
  );
};

export const ScreensPanel: React.FC = () => {
  const screens = useProjectStore(s => s.screens);
  const view = useScreenEditor(s => s.view);
  const screenId = useScreenEditor(s => s.screenId);
  const sliceId = useScreenEditor(s => s.sliceId);
  const live = useOutputStatus(s => s.screens);
  const [splitting, setSplitting] = useState(false);

  const screen = screens.find(s => s.id === screenId) ?? null;
  const slice = screen?.slices.find(s => s.id === sliceId) ?? null;

  // Keep a screen selected while there are any
  useEffect(() => {
    if (!screen && screens.length > 0) selectScreen(screens[0].id, screens[0].slices[0]?.id ?? null);
  }, [screen, screens]);

  return (
    <div
      className={`fixed top-4 right-4 ${panelSurface} z-[1000] w-72 flex flex-col`}
      style={{ bottom: 'calc(1rem + var(--launcher-height, 0px))' }}
    >
      <div className="flex items-center justify-between p-3 shrink-0">
        <h2 className={panelTitle}>
          <MonitorPlay className="w-4 h-4" />
          Screens
          <span className="text-xs text-gray-400 font-normal">({screens.length})</span>
        </h2>
        <button className={iconButton} onClick={() => openScreenEditor(false)} title="Close the screen editor (Esc)">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 min-h-0">
        <div className={segmented}>
          <button className={segment(view === 'input')} onClick={() => setScreenView('input')} title="The composition, with the part each slice takes">
            Input
          </button>
          <button className={segment(view === 'output')} onClick={() => setScreenView('output')} title="The selected screen as its output window shows it">
            Output
          </button>
        </div>

        {screens.length === 0 && !splitting && (
          <p className="text-xs text-gray-400">
            No screens: every output window shows the whole composition. Add a screen to give a projector its own
            resolution and corner pin, or split the composition across several projectors.
          </p>
        )}

        {screens.length > 0 && (
          <div className="space-y-1">
            {screens.map(s => (
              <button
                key={s.id}
                onClick={() => selectScreen(s.id, s.slices[0]?.id ?? null)}
                className={`w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left transition-colors ${
                  s.id === screenId ? 'bg-cyan-600/40 ring-1 ring-cyan-500' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className={live[s.id] ? 'text-emerald-400' : 'text-gray-600'} title={live[s.id] ? 'Output window live' : 'No output window'}>●</span>
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
                <span className="text-[10px] text-gray-400 tabular-nums">{s.width}×{s.height}</span>
              </button>
            ))}
          </div>
        )}

        {splitting ? (
          <SplitForm hasScreens={screens.length > 0} onDone={() => setSplitting(false)} />
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => addScreen()} title="A screen the size of the composition, showing all of it">
              <Plus />
              Screen
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setSplitting(true)} title="Split the composition across several screens">
              <Columns3 />
              Split…
            </Button>
          </div>
        )}

        {screen && <ScreenSettings screen={screen} />}

        {screen && (
          <div className={`space-y-1 pt-2 border-t ${divider}`}>
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>Slices</p>
              <button className={iconButton} onClick={() => addSlice(screen.id)} title="Add a slice">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {screen.slices.length === 0 && <p className="text-[11px] text-gray-500">No slices — the screen stays black.</p>}
            {[...screen.slices].reverse().map(s => (
              <div
                key={s.id}
                onClick={() => selectSlice(s.id)}
                className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs cursor-pointer transition-colors ${
                  s.id === sliceId ? 'bg-cyan-600/40 ring-1 ring-cyan-500' : 'bg-white/5 hover:bg-white/10'
                } ${s.enabled ? '' : 'opacity-50'}`}
              >
                <button
                  className={iconButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSlice(screen.id, s.id, { enabled: !s.enabled });
                  }}
                  title={s.enabled ? 'Hide this slice' : 'Show this slice'}
                >
                  {s.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <input
                  key={`${s.id}:${s.name}`}
                  defaultValue={s.name}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => selectSlice(s.id)}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== s.name) updateSlice(screen.id, s.id, { name });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 min-w-0 bg-transparent focus:bg-white/10 rounded px-1 focus:outline-none"
                />
                <span className="hidden group-hover:flex items-center">
                  <button className={iconButton} onClick={(e) => { e.stopPropagation(); moveSlice(screen.id, s.id, 1); }} title="Up (draws over the slices below)">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button className={iconButton} onClick={(e) => { e.stopPropagation(); moveSlice(screen.id, s.id, -1); }} title="Down">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button className={iconButton} onClick={(e) => { e.stopPropagation(); duplicateSlice(screen.id, s.id); }} title="Duplicate (Cmd/Ctrl+D)">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button className={iconButton} onClick={(e) => { e.stopPropagation(); removeSlice(screen.id, s.id); }} title="Delete (Delete)">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {screen && slice && <SliceSettings screen={screen} slice={slice} />}

        {screen && (
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Drag on the stage: in Input the part of the composition, in Output the corners. Arrow keys move the
            selection (Shift: 10 px), Alt drags without snapping, Esc ends.
          </p>
        )}
      </div>
    </div>
  );
};
