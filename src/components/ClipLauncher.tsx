import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown, ChevronUp, Crosshair, Image as ImageIcon, Plus, Play, Timer, X, Video, Zap,
} from 'lucide-react';
import type { BeatSnap, MediaType } from '../types';
import { useProjectStore } from '../state/projectStore';
import { useLiveStore, type ScheduledTrigger } from '../state/liveStore';
import { layersTopFirst, type SlotRef } from '../state/deck';
import {
  addDeckColumn, addDeckLayer, assignMedia, clearAllLayers, clearLayer, cueColumn, go, moveClipTo,
  preloadClip, pressClip, removeClipAt, renameClip, renameDeckColumn, setClipBeatSnap, setTriggerStyle,
  triggerColumn, updateDeckLayer,
} from '../state/deckActions';
import { BEAT_SNAPS } from '../state/clock';
import type { Clip, Layer, TriggerStyle } from '../state/showModel';
import { TempoBar } from './TempoBar';
import { useLastClipStart } from '../render/startStats';
import { generateThumbnail, getMedia, getMediaFile, getMediaObjectUrl, storeMedia } from '../lib/mediaStorage';
import { isFolderMediaId } from '../lib/mediaFolders';
import { menuSurface, panelSurface, panelTitle, sectionLabel } from './ui/theme';

// ---------------------------------------------------------------------------
// Clip launcher: layers × columns. Press a clip to play it on its layer, a
// column header to play the whole column; cue a column and fire it with Go.
// Clips under the pointer and in the cued column are preloaded. With beat
// snap, triggers wait (armed, blinking) for the beat; Alt fires right away.
// ---------------------------------------------------------------------------

const SLOT_MIME = 'application/x-video-mapper-slot';
const CELL_W = 104;
const CELL_H = 62;
const HEADER_W = 148;

// The launcher's height, for the panels and stage to make room
const setDockHeight = (px: number) => document.documentElement.style.setProperty('--launcher-height', `${px}px`);

// ---- Thumbnails --------------------------------------------------------------------

const thumbnails = new Map<string, string | null>();
const pendingThumbnails = new Map<string, Promise<string | null>>();

const loadThumbnail = (mediaId: string): Promise<string | null> => {
  let pending = pendingThumbnails.get(mediaId);
  if (!pending) {
    pending = (async () => {
      const stored = isFolderMediaId(mediaId) ? null : await getMedia(mediaId);
      if (stored?.thumbnail) return stored.thumbnail;
      // Linked folders store no thumbnails — make one from the file
      const file = await getMediaFile(mediaId);
      return file ? await generateThumbnail(file.blob, file.type) : null;
    })()
      .catch(() => null)
      .then(url => {
        thumbnails.set(mediaId, url);
        return url;
      });
    pendingThumbnails.set(mediaId, pending);
  }
  return pending;
};

const useThumbnail = (mediaId: string | undefined): string | null => {
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!mediaId || thumbnails.has(mediaId)) return;
    let cancelled = false;
    void loadThumbnail(mediaId).then(() => {
      if (!cancelled) setLoaded(n => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);
  return mediaId ? thumbnails.get(mediaId) ?? null : null;
};

// ---- Media files dropped onto slots ----------------------------------------------

const mediaTypeOf = (file: File): MediaType | null =>
  file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;

/** Store dropped files and put them into the slot and the ones to its right. */
const importFiles = async (files: File[], slot: SlotRef, columnCount: number) => {
  let column = slot.column;
  for (const file of files) {
    const type = mediaTypeOf(file);
    if (!type || column >= columnCount) continue;
    try {
      const stored = await storeMedia(file, file.name, type);
      assignMedia({ layerId: slot.layerId, column }, {
        type, url: getMediaObjectUrl(stored), mediaId: stored.id, filename: file.name,
      });
      column += 1;
    } catch (error) {
      alert((error as Error).message);
    }
  }
};

const clipLabel = (clip: Clip) => clip.name || clip.source.filename || (clip.source.url ? 'Clip' : 'Empty clip');

const snapLabel = (snap: BeatSnap) => BEAT_SNAPS.find(s => s.snap === snap)?.label ?? snap;

// A trigger waiting for its beat: this clip starts, or (toggle) stops
type Armed = 'start' | 'stop' | null;

const armedOf = (
  scheduled: ScheduledTrigger[], cuedColumn: number | null, layer: Layer, column: number, clip: Clip | null,
): Armed => {
  if (!clip) return null;
  // A clip trigger on the layer decides (it fires after a column at the same time)
  const own = scheduled.find(t => t.kind === 'clip' && t.layerId === layer.id);
  if (own?.kind === 'clip') {
    if (own.clipId === clip.id) return 'start';
    return own.clipId === null && layer.activeClipId === clip.id ? 'stop' : null;
  }
  // A column (or Go): its clips start, layers with an empty cell there stop
  const waiting = scheduled.find(t => t.kind !== 'clip');
  const target = waiting?.kind === 'column' ? waiting.column : waiting?.kind === 'go' ? cuedColumn : null;
  if (target === null) return null;
  if (target === column) return 'start';
  return !layer.slots[target] && layer.activeClipId === clip.id ? 'stop' : null;
};

// ---- Cells ---------------------------------------------------------------------------

interface CellProps {
  layerId: string;
  column: number;
  clip: Clip | null;
  isActive: boolean;
  isCued: boolean;
  armed: Armed;
  columnCount: number;
  onPickMedia: (slot: SlotRef) => void;
  onMenu: (e: React.MouseEvent, slot: SlotRef, clip: Clip) => void;
}

const ClipCell = React.memo(function ClipCell({
  layerId, column, clip, isActive, isCued, armed, columnCount, onPickMedia, onMenu,
}: CellProps) {
  const thumbnail = useThumbnail(clip?.source.mediaId);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const slot = { layerId, column };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !clip) return;
    e.preventDefault();
    const release = pressClip(layerId, clip.id, { now: e.altKey });
    if (!release) return;
    const up = () => {
      release();
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const acceptsDrop = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(SLOT_MIME) || e.dataTransfer.types.includes('Files');

  return (
    <div
      className={`relative shrink-0 rounded overflow-hidden select-none ${
        isActive ? 'ring-2 ring-emerald-400' : isCued ? 'ring-1 ring-amber-400/80' : 'ring-1 ring-white/10'
      } ${isDropTarget ? 'outline outline-2 outline-cyan-400' : ''}`}
      style={{ width: CELL_W, height: CELL_H }}
      onDragOver={(e) => {
        if (!acceptsDrop(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes(SLOT_MIME) && e.altKey ? 'copy' : e.dataTransfer.types.includes(SLOT_MIME) ? 'move' : 'copy';
        setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDropTarget(false);
        const from = e.dataTransfer.getData(SLOT_MIME);
        if (from) {
          moveClipTo(JSON.parse(from) as SlotRef, slot, e.altKey);
        } else if (e.dataTransfer.files.length > 0) {
          void importFiles(Array.from(e.dataTransfer.files), slot, columnCount);
        }
      }}
    >
      {clip ? (
        <>
          {/* Thumbnail: press to trigger */}
          <button
            type="button"
            tabIndex={-1}
            className={`absolute inset-0 w-full h-full bg-gray-800 bg-cover bg-center ${isActive ? '' : 'opacity-80 hover:opacity-100'}`}
            style={{ backgroundImage: thumbnail ? `url(${thumbnail})` : undefined }}
            onPointerDown={onPointerDown}
            onPointerEnter={() => preloadClip(clip.id)}
            onPointerLeave={() => preloadClip(null)}
            onContextMenu={(e) => onMenu(e, slot, clip)}
            title={`${clipLabel(clip)} — press to play${clip.triggerStyle && clip.triggerStyle !== 'normal' ? ` (${clip.triggerStyle})` : ''}${clip.beatSnap ? `, beat snap ${snapLabel(clip.beatSnap)}` : ''} · Alt: now`}
          >
            {!thumbnail && (
              <span className="absolute inset-0 flex items-center justify-center text-white/40">
                {clip.source.type === 'video' ? <Video className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              </span>
            )}
            {isActive && (
              <span className="absolute top-1 left-1 bg-emerald-500 rounded-sm p-0.5">
                <Play className="w-2.5 h-2.5 text-black fill-black" />
              </span>
            )}
            {((clip.triggerStyle && clip.triggerStyle !== 'normal') || clip.beatSnap) && (
              <span className="absolute top-1 right-1 bg-black/70 rounded-sm px-1 text-[9px] uppercase text-amber-300">
                {[
                  clip.triggerStyle && clip.triggerStyle !== 'normal' ? clip.triggerStyle : null,
                  clip.beatSnap ? `♩${snapLabel(clip.beatSnap)}` : null,
                ].filter(Boolean).join(' · ')}
              </span>
            )}
            {armed && (
              <>
                <span
                  className={`absolute inset-0 rounded pointer-events-none ring-[3px] ring-inset animate-pulse ${
                    armed === 'start' ? 'ring-white' : 'ring-red-500'
                  }`}
                />
                <span
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold pointer-events-none ${
                    armed === 'start' ? 'bg-black/80 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  {armed === 'start' ? 'Next' : 'Stop'}
                </span>
              </>
            )}
          </button>
          {/* Label: drag handle (Alt = copy), right-click for options */}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(SLOT_MIME, JSON.stringify(slot));
              e.dataTransfer.effectAllowed = 'copyMove';
            }}
            onContextMenu={(e) => onMenu(e, slot, clip)}
            className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-[10px] leading-tight text-white truncate cursor-grab"
            title="Drag to move (Alt: copy) · right-click for options"
          >
            {clipLabel(clip)}
          </div>
        </>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onPickMedia(slot)}
          className="absolute inset-0 w-full h-full bg-white/[0.03] hover:bg-white/10 text-white/20 hover:text-white/60 flex items-center justify-center"
          title="Add media (or drop files here)"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

// ---- Context menu ----------------------------------------------------------------------

interface MenuState {
  x: number;
  y: number;
  slot: SlotRef;
  clip: Clip;
}

const TRIGGER_STYLES: { style: TriggerStyle; label: string; hint: string }[] = [
  { style: 'normal', label: 'Normal', hint: 'press plays from the start' },
  { style: 'toggle', label: 'Toggle', hint: 'press again clears the layer' },
  { style: 'piano', label: 'Piano', hint: 'plays while held' },
];

const ClipMenu: React.FC<{ menu: MenuState; onClose: () => void; onReplace: (slot: SlotRef) => void }> = ({
  menu, onClose, onReplace,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const compositionSnap = useProjectStore(s => s.tempo.beatSnap);
  // Open upwards as far as needed to stay on screen (the launcher sits at the bottom)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - el.getBoundingClientRect().height - 8))}px`;
  }, [menu.y]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const style = menu.clip.triggerStyle ?? 'normal';
  const item = 'w-full text-left px-3 py-1.5 hover:bg-white/10 text-xs';
  return (
    <div
      ref={ref}
      className={`fixed z-[3000] min-w-[220px] ${menuSurface} py-1`}
      style={{ left: Math.min(menu.x, window.innerWidth - 240), top: menu.y }}
    >
      <p className={`px-3 py-1 truncate ${sectionLabel}`}>{clipLabel(menu.clip)}</p>
      {TRIGGER_STYLES.map(t => (
        <button
          key={t.style}
          className={`${item} flex items-center gap-2`}
          onClick={() => {
            setTriggerStyle(menu.clip.id, t.style);
            onClose();
          }}
        >
          <span className={`w-2 h-2 rounded-full ${style === t.style ? 'bg-emerald-400' : 'bg-white/15'}`} />
          {t.label}
          <span className="text-gray-500 ml-auto">{t.hint}</span>
        </button>
      ))}
      <div className="my-1 border-t border-white/10" />
      <p className={`px-3 pt-1 ${sectionLabel}`}>Beat snap</p>
      <div className="flex flex-wrap gap-1 px-3 py-1.5">
        {[null, ...BEAT_SNAPS.map(s => s.snap)].map(snap => {
          const selected = (menu.clip.beatSnap ?? null) === snap;
          return (
            <button
              key={snap ?? 'composition'}
              className={`px-1.5 py-0.5 rounded text-[11px] ${selected ? 'bg-amber-500 text-black font-semibold' : 'bg-white/10 hover:bg-white/20'}`}
              onClick={() => {
                setClipBeatSnap(menu.clip.id, snap);
                onClose();
              }}
              title={snap === null ? 'Follow the composition\'s beat snap' : undefined}
            >
              {snap === null ? `Comp. (${snapLabel(compositionSnap)})` : snapLabel(snap)}
            </button>
          );
        })}
      </div>
      <div className="my-1 border-t border-white/10" />
      <button
        className={item}
        onClick={() => {
          const name = prompt('Clip name', clipLabel(menu.clip));
          if (name !== null) renameClip(menu.clip.id, name);
          onClose();
        }}
      >
        Rename…
      </button>
      <button
        className={item}
        onClick={() => {
          onReplace(menu.slot);
          onClose();
        }}
      >
        Replace media…
      </button>
      <button
        className={`${item} text-red-300`}
        onClick={() => {
          removeClipAt(menu.slot);
          onClose();
        }}
      >
        Remove clip
      </button>
    </div>
  );
};

// ---- Inline rename -------------------------------------------------------------------

const EditableName: React.FC<{
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  onClick?: () => void;
  title?: string;
}> = ({ value, onCommit, className, onClick, title }) => {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        className="w-full min-w-0 bg-white/10 rounded px-1 text-xs text-white focus:outline-none"
      />
    );
  }
  return (
    <span
      className={className}
      onClick={onClick}
      onDoubleClick={() => setDraft(value)}
      title={title ?? `${value} — double-click to rename`}
    >
      {value}
    </span>
  );
};

// ---- Launcher ---------------------------------------------------------------------------

interface ClipLauncherProps {
  onPickMedia: (slot: SlotRef) => void;
  onSelectLayer: (layerId: string) => void;
  onLayerAdded: (surfaceId: string) => void;
  onClose: () => void;
}

const LayerHeader: React.FC<{ layer: Layer; onSelect: (layerId: string) => void }> = ({ layer, onSelect }) => (
  <div className="shrink-0 flex flex-col justify-center gap-1 pr-2" style={{ width: HEADER_W, height: CELL_H }}>
    <div className="flex items-center gap-1">
      <EditableName
        value={layer.name}
        onCommit={(name) => name.trim() && updateDeckLayer(layer.id, { name: name.trim() })}
        onClick={() => onSelect(layer.id)}
        className="flex-1 truncate text-xs cursor-pointer hover:text-cyan-300"
        title={`${layer.name} — click to select its surfaces, double-click to rename`}
      />
      <button
        onClick={() => clearLayer(layer.id)}
        disabled={!layer.activeClipId}
        className="p-0.5 rounded hover:bg-white/15 disabled:opacity-25"
        title="Clear layer (stop its clip)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(layer.opacity * 100)}
      onChange={(e) => updateDeckLayer(layer.id, { opacity: Number(e.target.value) / 100 })}
      className="w-full h-1 accent-cyan-400"
      title={`Layer opacity ${Math.round(layer.opacity * 100)}%`}
    />
  </div>
);

export const ClipLauncher: React.FC<ClipLauncherProps> = ({ onPickMedia, onSelectLayer, onLayerAdded, onClose }) => {
  const surfaces = useProjectStore(s => s.surfaces);
  const layers = useProjectStore(s => s.layers);
  const columns = useProjectStore(s => s.columns);
  const cuedColumn = useLiveStore(s => s.cuedColumn);
  const scheduled = useLiveStore(s => s.scheduled);
  const lastStart = useLastClipStart();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tell the editor how much room the launcher takes
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setDockHeight(el.getBoundingClientRect().height + 16));
    observer.observe(el);
    return () => {
      observer.disconnect();
      setDockHeight(0);
    };
  }, []);

  const ordered = layersTopFirst({ surfaces, layers, columns });
  const openMenu = React.useCallback((e: React.MouseEvent, slot: SlotRef, clip: Clip) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, slot, clip });
  }, []);
  const closeMenu = React.useCallback(() => setMenu(null), []);

  const nextCue = cuedColumn !== null ? columns[cuedColumn] : null;
  const armedColumn = scheduled.find(t => t.kind === 'column');
  const goArmed = scheduled.some(t => t.kind === 'go');

  return (
    <div
      ref={rootRef}
      className={`fixed left-4 right-4 bottom-4 z-[1100] ${panelSurface} flex flex-col`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()} // a miss must not navigate to the file
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 shrink-0 text-xs">
        <h2 className={`${panelTitle} mr-2`}>
          <Zap className="w-4 h-4" />
          Clip Launcher
        </h2>
        <TempoBar />
        <button
          onClick={(e) => go({ now: e.altKey })}
          disabled={cuedColumn === null}
          className={`flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 text-black font-semibold disabled:bg-white/10 disabled:text-white/40 ${goArmed ? 'animate-pulse' : ''}`}
          title="Fire the cued column, then cue the next one (Space; Alt: now, without beat snap)"
        >
          <Play className="w-3 h-3 fill-current" />
          Go{nextCue ? ` · ${nextCue.name || cuedColumn! + 1}` : ''}
        </button>
        <button onClick={clearAllLayers} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" title="Stop every layer's clip">
          Clear all
        </button>
        <button
          onClick={() => onLayerAdded(addDeckLayer())}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          title="New layer on a surface filling the composition"
        >
          <Plus className="w-3 h-3" /> Layer
        </button>
        <button onClick={addDeckColumn} className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20">
          <Plus className="w-3 h-3" /> Column
        </button>
        <span className="text-gray-500 hidden 2xl:inline">1–9 column · Shift+1–9 cue · Space Go · T tap · L hide</span>
        <span className="ml-auto text-gray-400 tabular-nums" title="Time from the last trigger to its first frame in this window">
          {lastStart ? `Last start ${Math.round(lastStart.ms)} ms${lastStart.preloaded ? ' (preloaded)' : ''}` : ''}
        </span>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1 rounded hover:bg-white/10"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10" title="Hide the launcher (L)">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-auto px-3 pb-3 max-h-[40vh]">
          {/* Column headers */}
          <div className="flex gap-1.5 mb-1.5">
            <div className="shrink-0" style={{ width: HEADER_W }} />
            {columns.map((column, index) => (
              <div
                key={column.id}
                className={`shrink-0 flex items-center rounded text-xs ${
                  armedColumn?.kind === 'column' && armedColumn.column === index
                    ? 'bg-white/30 ring-1 ring-white animate-pulse'
                    : cuedColumn === index ? 'bg-amber-500/25 ring-1 ring-amber-400' : 'bg-white/5'
                }`}
                style={{ width: CELL_W }}
              >
                <button
                  onClick={(e) => triggerColumn(index, { now: e.altKey })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const name = prompt('Column name', column.name || String(index + 1));
                    if (name !== null) renameDeckColumn(index, name);
                  }}
                  className="flex-1 min-w-0 text-left px-1.5 py-1 rounded hover:bg-white/15 truncate"
                  title={`Play column ${column.name || index + 1}${index < 9 ? ` (key ${index + 1})` : ''} · Alt: now · right-click to rename`}
                >
                  {column.name || String(index + 1)}
                </button>
                <button
                  onClick={() => cueColumn(cuedColumn === index ? null : index)}
                  className={`p-1 rounded hover:bg-white/15 ${cuedColumn === index ? 'text-amber-300' : 'text-white/30'}`}
                  title={`Cue column (preload, fire with Go)${index < 9 ? ` — Shift+${index + 1}` : ''}`}
                >
                  <Crosshair className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {ordered.length === 0 && (
            <p className="text-xs text-gray-500 py-3">
              No layers yet — add one with “+ Layer”, or draw a frame on the stage.
            </p>
          )}

          {/* Layers, top of the stack first */}
          <div className="flex flex-col gap-1.5">
            {ordered.map(layer => (
              <div key={layer.id} className="flex gap-1.5 items-center">
                <LayerHeader layer={layer} onSelect={onSelectLayer} />
                {columns.map((column, index) => {
                  const clip = layer.slots[index] ?? null;
                  return (
                    <ClipCell
                      key={column.id}
                      layerId={layer.id}
                      column={index}
                      clip={clip}
                      isActive={clip !== null && clip.id === layer.activeClipId}
                      isCued={cuedColumn === index}
                      armed={armedOf(scheduled, cuedColumn, layer, index, clip)}
                      columnCount={columns.length}
                      onPickMedia={onPickMedia}
                      onMenu={openMenu}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On the body: the launcher's backdrop filter would make it the menu's containing block */}
      {menu && createPortal(<ClipMenu menu={menu} onClose={closeMenu} onReplace={onPickMedia} />, document.body)}
    </div>
  );
};
