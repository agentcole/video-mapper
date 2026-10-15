import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  MediaFrame, DragState, ResizeState, RotateState, DrawState, MarqueeState,
  ShapeType, Point, StoredMedia,
} from '../types';
import { MediaFrameComponent } from './MediaFrame';
import { ControlPanel } from './ControlPanel';
import { LayersPanel } from './LayersPanel';
import { MediaLibrary } from './MediaLibrary';
import { BackgroundSettingsPanel } from './BackgroundSettings';
import { TestCard } from './TestCard';
import { UpdatePrompt } from './UpdatePrompt';
import { BackgroundLayer, GridOverlay } from './StageLayers';
import { generateFrameId } from '../lib/storage';
import { storeMedia, getMediaObjectUrl } from '../lib/mediaStorage';
import { dedupePolygon, getFrameCompOutline, rotateVector } from '../lib/geometry';
import { projectStore, useProjectStore } from '../state/projectStore';
import { projectHistory } from '../state/history';
import { liveStore, useLiveStore, outputGainOf } from '../state/liveStore';
import { startControlSync, useOutputStatus } from '../output/controlSync';
import { useProjectSession } from '../state/useProjectSession';
import { ProjectsPanel } from './ProjectsPanel';
import { GpuStage } from '../render/GpuStage';
import type { RenderScene } from '../render/types';

// Store actions are stable for the app's lifetime
const { setFrames, updateFrame, setBackground, setGrid, setComposition } = projectStore.getState();
const { setMasterOpacity, setBlackout, setShowTestCard, sendPlayback, setRenderer } = liveStore.getState();

// State for polygon drawing (click to add vertices)
interface PolygonDrawState {
  isDrawing: boolean;
  vertices: Point[]; // Composition coordinates while drawing
  startX: number;
  startY: number;
}

// Full frame defaults; overrides supply position/size/shape and media info
const createFrame = (
  overrides: Partial<MediaFrame> & Pick<MediaFrame, 'x' | 'y' | 'width' | 'height' | 'shape'>
): Omit<MediaFrame, 'id'> => ({
  type: 'image',
  url: '',
  rotation: 0,
  textureMode: 'clip',
  loop: true,
  opacity: 1,
  zIndex: 0,
  playbackRate: 1,
  muted: false,
  blur: 0,
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  saturate: 100,
  hueRotate: 0,
  invert: 0,
  sepia: 0,
  blendMode: 'normal',
  flipHorizontal: false,
  flipVertical: false,
  lockAspectRatio: true,
  contentScale: 1,
  contentOffsetX: 0,
  contentOffsetY: 0,
  perspectiveMode: false,
  perspectiveCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
  visible: true,
  testPattern: false,
  softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
  ...overrides,
});

const filenameFromUrl = (url: string): string | undefined => {
  try {
    const lastSegment = new URL(url).pathname.split('/').pop();
    return lastSegment ? decodeURIComponent(lastSegment) : undefined;
  } catch {
    return undefined;
  }
};

// Axis-aligned bounding box of a frame's rendered outline (shape through
// corner pin and rotation) in composition space
const frameAABB = (f: MediaFrame) => {
  const outline = getFrameCompOutline(f);
  const xs = outline.map(p => p.x);
  const ys = outline.map(p => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

export const Canvas: React.FC = () => {
  // The project document lives in the project store (shared with autosave,
  // history and the output window)
  const frames = useProjectStore(s => s.frames);
  const background = useProjectStore(s => s.background);
  const grid = useProjectStore(s => s.grid);
  const composition = useProjectStore(s => s.composition);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    frameId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    frameId: null,
    handle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startFrameX: 0,
    startFrameY: 0,
    rotation: 0,
  });
  const [rotateState, setRotateState] = useState<RotateState>({
    isRotating: false,
    frameId: null,
    startAngle: 0,
    centerX: 0,
    centerY: 0,
  });
  const [drawState, setDrawState] = useState<DrawState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [polygonDrawState, setPolygonDrawState] = useState<PolygonDrawState>({
    isDrawing: false,
    vertices: [],
    startX: 0,
    startY: 0,
  });
  const [marquee, setMarquee] = useState<MarqueeState>({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    additive: false,
  });
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawShape, setDrawShape] = useState<ShapeType | null>(null);
  const [pendingMediaUrl, setPendingMediaUrl] = useState<{url: string, type: 'video' | 'image', mediaId?: string} | null>(null);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaLibraryTargetFrameId, setMediaLibraryTargetFrameId] = useState<string | null>(null); // Which frame is requesting media change
  const [mediaLibraryTargetBackground, setMediaLibraryTargetBackground] = useState(false); // Is media library for background?
  const [isBackgroundSettingsOpen, setIsBackgroundSettingsOpen] = useState(false);
  const [showPresentationControls, setShowPresentationControls] = useState(false);
  // Live output controls (not persisted) — shared with the output window
  const masterOpacity = useLiveStore(s => s.masterOpacity);
  const blackout = useLiveStore(s => s.blackout);
  const showTestCard = useLiveStore(s => s.showTestCard);
  const playback = useLiveStore(s => s.playback);
  const renderer = useLiveStore(s => s.renderer);
  const [rendererNotice, setRendererNotice] = useState<string | null>(null);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  // Open project, autosave, versions, import/export (see useProjectSession)
  const clearSelection = useCallback(() => setSelectedFrameIds([]), []);
  const session = useProjectSession(clearSelection);
  const { saveVersion, exportJson, exportPackage, importFile } = session;
  // Viewport (editor window) size — drives the letterboxed stage transform
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Editor overlay (frame handles/outlines/hit areas are portalled here)
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);
  const clipboardRef = useRef<MediaFrame[] | null>(null);
  const dragMovedRef = useRef(false);
  // Latest selection for stable (memo-friendly) gesture callbacks
  const selectedIdsRef = useRef(selectedFrameIds);
  useEffect(() => {
    selectedIdsRef.current = selectedFrameIds;
  }, [selectedFrameIds]);

  // ------------------------------------------------------------------
  // Composition view transform (letterboxed fit)
  // ------------------------------------------------------------------
  const viewScale = Math.min(viewport.w / composition.width, viewport.h / composition.height) || 1;
  const viewOffsetX = (viewport.w - composition.width * viewScale) / 2;
  const viewOffsetY = (viewport.h - composition.height * viewScale) / 2;

  // Track the canvas element size (window resizes, fullscreen changes)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setViewport({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Convert a pointer position (client coords) into composition coordinates
  const toComp = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (clientX - left - viewOffsetX) / viewScale,
      y: (clientY - top - viewOffsetY) / viewScale,
    };
  }, [viewOffsetX, viewOffsetY, viewScale]);

  // Snap a composition coordinate to the grid when snapping is enabled
  const snapToGrid = useCallback((value: number): number => {
    if (!grid.snap) return value;
    return Math.round(value / grid.size) * grid.size;
  }, [grid.snap, grid.size]);

  // Check if there are any video frames
  const hasVideos = frames.some(f => f.type === 'video');

  // Play / pause all videos (also reaches the output window)
  const handlePlayAll = useCallback(() => sendPlayback('play'), []);
  const handlePauseAll = useCallback(() => sendPlayback('pause'), []);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => !prev);
    setSelectedFrameIds([]);
    setIsDrawMode(false);
    setDrawShape(null);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await canvasRef.current?.requestFullscreen();
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      await document.exitFullscreen();
    }
  }, []);

  const enterFullscreenPresentation = useCallback(async () => {
    setIsPresentationMode(true);
    setSelectedFrameIds([]);
    setIsDrawMode(false);
    setDrawShape(null);
    try {
      await canvasRef.current?.requestFullscreen();
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Project load / save
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Undo / redo (see state/history.ts) — drops selection entries that no
  // longer exist in the restored state
  // ------------------------------------------------------------------
  const pruneSelection = useCallback(() => {
    const ids = new Set(projectStore.getState().frames.map(f => f.id));
    setSelectedFrameIds(prev => prev.filter(id => ids.has(id)));
  }, []);

  const undo = useCallback(() => {
    projectHistory.undo();
    pruneSelection();
  }, [pruneSelection]);

  const redo = useCallback(() => {
    projectHistory.redo();
    pruneSelection();
  }, [pruneSelection]);

  // Mirror the project + live state to output windows
  useEffect(() => startControlSync(), []);
  const outputsConnected = useOutputStatus(s => s.connected) > 0;

  // Master fader and blackout apply to audio as well as pixels. While an
  // output window is live it carries the sound, so the editor stays silent.
  const outputGain = outputGainOf({ masterOpacity, blackout });
  const editorGain = outputsConnected ? 0 : outputGain;

  // GPU renderer (beta): draws background + frames; falls back to CSS
  const visibleFrames = useMemo(() => frames.filter(f => f.visible !== false), [frames]);
  const gpuScene = useMemo<RenderScene>(() => ({
    frames: visibleFrames,
    background,
    composition,
    masterOpacity,
    outputGain: editorGain,
    playback,
    showPlaceholders: !isPresentationMode,
  }), [visibleFrames, background, composition, masterOpacity, editorGain, playback, isPresentationMode]);
  const handleGpuUnavailable = useCallback((reason: string) => {
    console.error(reason);
    setRenderer('css');
    setRendererNotice(`${reason} — switched back to the CSS renderer.`);
  }, []);

  // Surfaces whose layer holds a clip of a stored media — any clip, not only
  // the playing one (for the library's delete warning)
  const getMediaUsage = useCallback((mediaId: string): string[] => {
    const { layers } = projectStore.getState();
    const layerIds = new Set(
      layers.filter(l => l.slots.some(c => c?.source.mediaId === mediaId)).map(l => l.id)
    );
    const users = frames
      .filter(f => f.layerId && layerIds.has(f.layerId))
      .map(f => f.name || f.filename || 'Untitled layer');
    if (background.mediaId === mediaId) users.push('Background');
    return users;
  }, [frames, background.mediaId]);

  // ------------------------------------------------------------------
  // Frame CRUD
  // ------------------------------------------------------------------
  const addFrame = useCallback((frame: Omit<MediaFrame, 'id'>) => {
    const newFrame: MediaFrame = { ...createFrame(frame), id: generateFrameId() };
    setFrames(prev => [...prev, newFrame]);
    setSelectedFrameIds([newFrame.id]);
  }, []);

  const deleteFrames = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setFrames(prev => prev.filter(f => !idSet.has(f.id)));
    setSelectedFrameIds(prev => prev.filter(id => !idSet.has(id)));
  }, []);

  const deleteFrame = useCallback((id: string) => deleteFrames([id]), [deleteFrames]);

  const duplicateFrames = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const newIds: string[] = [];
    setFrames(prev => {
      const sources = prev.filter(f => ids.includes(f.id));
      const copies = sources.map((source, i) => {
        const id = generateFrameId();
        newIds.push(id);
        return {
          ...source,
          id,
          x: source.x + 20,
          y: source.y + 20,
          zIndex: prev.length + i,
          vertices: source.vertices?.map(v => ({ ...v })),
          perspectiveCorners: {
            tl: { ...source.perspectiveCorners.tl },
            tr: { ...source.perspectiveCorners.tr },
            br: { ...source.perspectiveCorners.br },
            bl: { ...source.perspectiveCorners.bl },
          },
          softEdge: { ...source.softEdge },
        };
      });
      return [...prev, ...copies];
    });
    setSelectedFrameIds(newIds);
  }, []);

  // Move a frame one step up/down in the z-order (used by the layers panel).
  // Normalizes all zIndex values to their sorted order.
  const reorderFrame = useCallback((id: string, direction: 'up' | 'down') => {
    setFrames(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const i = sorted.findIndex(f => f.id === id);
      if (i === -1) return prev;
      const j = direction === 'up' ? i + 1 : i - 1;
      if (j < 0 || j >= sorted.length) return prev;
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      const zMap = new Map(sorted.map((f, idx) => [f.id, idx]));
      return prev.map(f => ({ ...f, zIndex: zMap.get(f.id)! }));
    });
  }, []);

  const selectFrame = useCallback((id: string, additive: boolean) => {
    setSelectedFrameIds(prev => {
      if (additive) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      // Keep an existing multi-selection when clicking one of its members
      // (collapse-to-single happens on mouse-up without drag)
      return prev.includes(id) ? prev : [id];
    });
  }, []);

  // Copy selected frames to the internal clipboard
  const copySelection = useCallback(() => {
    const selected = frames.filter(f => selectedFrameIds.includes(f.id));
    if (selected.length === 0) return false;
    clipboardRef.current = JSON.parse(JSON.stringify(selected));
    return true;
  }, [frames, selectedFrameIds]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.length === 0) return;
    const newIds: string[] = [];
    setFrames(prev => {
      const copies = clip.map((source, i) => {
        const id = generateFrameId();
        newIds.push(id);
        return { ...source, id, x: source.x + 20, y: source.y + 20, zIndex: prev.length + i };
      });
      return [...prev, ...copies];
    });
    setSelectedFrameIds(newIds);
    // Cascade repeated pastes
    clipboardRef.current = clip.map(f => ({ ...f, x: f.x + 20, y: f.y + 20 }));
  }, []);

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT' || target.isContentEditable;

      // ESC works even while typing: exit mode, cancel draw, or deselect
      if (e.key === 'Escape') {
        if (isPresentationMode) {
          setIsPresentationMode(false);
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
        } else if (polygonDrawState.isDrawing) {
          setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
          setIsDrawMode(false);
          setDrawShape(null);
          setPendingMediaUrl(null);
        } else if (isDrawMode) {
          setIsDrawMode(false);
          setDrawShape(null);
          setPendingMediaUrl(null);
        } else if (selectedFrameIds.length > 0) {
          setSelectedFrameIds([]);
        }
        return;
      }

      if (isTyping || isMediaLibraryOpen) return;

      const hasSelection = selectedFrameIds.length > 0;

      // Save a version
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void saveVersion();
        return;
      }

      // Undo / redo
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Clipboard
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && hasSelection) {
        e.preventDefault();
        copySelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X') && hasSelection) {
        e.preventDefault();
        if (copySelection()) deleteFrames(selectedFrameIds);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteClipboard();
        return;
      }

      // Cmd/Ctrl+A selects all frames
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A') && !isPresentationMode) {
        e.preventDefault();
        setSelectedFrameIds(frames.map(f => f.id));
        return;
      }

      // Cmd/Ctrl+D duplicates the selection
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D') && hasSelection) {
        e.preventDefault();
        duplicateFrames(selectedFrameIds);
        return;
      }

      if (e.metaKey || e.ctrlKey) return;

      // Delete / Backspace removes the selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        deleteFrames(selectedFrameIds);
        return;
      }

      // Arrow keys nudge the selection (Shift = bigger steps)
      if (hasSelection && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? (grid.snap ? grid.size : 10) : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const idSet = new Set(selectedFrameIds);
        setFrames(prev => prev.map(f => idSet.has(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f));
        return;
      }

      // P for presentation mode
      if (e.key === 'p' || e.key === 'P') {
        togglePresentationMode();
      }
      // F for fullscreen
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      // G toggles the grid, Shift+G toggles snapping
      if (e.key === 'g' || e.key === 'G') {
        if (e.shiftKey) {
          setGrid(prev => ({ ...prev, snap: !prev.snap }));
        } else {
          setGrid(prev => ({ ...prev, show: !prev.show }));
        }
      }
      // B toggles blackout (live performance safety)
      if (e.key === 'b' || e.key === 'B') {
        setBlackout(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    isPresentationMode, isDrawMode, polygonDrawState.isDrawing, isMediaLibraryOpen,
    selectedFrameIds, frames, grid.snap, grid.size,
    deleteFrames, duplicateFrames, copySelection, pasteClipboard, undo, redo, saveVersion,
    togglePresentationMode, toggleFullscreen,
  ]);

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------

  // Finish polygon and create frame
  const finishPolygon = useCallback(() => {
    // A double-click (or closing on the first point) can repeat a vertex,
    // which would degenerate the shape — drop near-duplicates first
    const drawnVertices = dedupePolygon(polygonDrawState.vertices, 1 / viewScale);
    if (drawnVertices.length < 3) {
      setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
      return;
    }

    // Calculate bounding box
    const xs = drawnVertices.map(v => v.x);
    const ys = drawnVertices.map(v => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;

    // Skip if too small
    if (width < 20 || height < 20) {
      setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
      return;
    }

    // Convert vertices to normalized coordinates (0-1) relative to bounding box
    const normalizedVertices: Point[] = drawnVertices.map(v => ({
      x: (v.x - minX) / width,
      y: (v.y - minY) / height,
    }));

    addFrame(createFrame({
      type: pendingMediaUrl?.type || 'image',
      url: pendingMediaUrl?.url || '',
      mediaId: pendingMediaUrl?.mediaId,
      filename: pendingMediaUrl?.url ? filenameFromUrl(pendingMediaUrl.url) : undefined,
      x: minX,
      y: minY,
      width,
      height,
      shape: 'polygon',
      vertices: normalizedVertices,
      zIndex: frames.length,
      lockAspectRatio: false, // Polygons don't have aspect ratio lock
    }));
    setPendingMediaUrl(null);
    setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
    setIsDrawMode(false);
    setDrawShape(null);
  }, [polygonDrawState, pendingMediaUrl, frames.length, addFrame, viewScale]);

  // Handle canvas mouse down (empty area: draw or marquee-select)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const targetEl = e.target as HTMLElement;
    const isEmptyArea = targetEl === canvasRef.current || targetEl === stageRef.current || targetEl.dataset.canvasBg === 'true';
    if (!isEmptyArea || isPresentationMode) return;

    const comp = toComp(e.clientX, e.clientY);

    if (isDrawMode && drawShape) {
      setSelectedFrameIds([]);
      if (drawShape === 'polygon') {
        // The second press of a double-click closes the polygon (onDoubleClick)
        // — it must not add a duplicate vertex
        if (e.detail >= 2) return;
        // Polygon drawing: add vertex on click
        const x = snapToGrid(comp.x);
        const y = snapToGrid(comp.y);

        if (!polygonDrawState.isDrawing) {
          // Start new polygon
          setPolygonDrawState({
            isDrawing: true,
            vertices: [{ x, y }],
            startX: x,
            startY: y,
          });
        } else {
          // Check if clicking near first vertex to close polygon
          const firstVertex = polygonDrawState.vertices[0];
          const distance = Math.sqrt(
            Math.pow(x - firstVertex.x, 2) + Math.pow(y - firstVertex.y, 2)
          );

          if (distance < 20 / viewScale && polygonDrawState.vertices.length >= 3) {
            // Close polygon
            finishPolygon();
          } else {
            // Add new vertex
            setPolygonDrawState(prev => ({
              ...prev,
              vertices: [...prev.vertices, { x, y }],
            }));
          }
        }
      } else {
        // Rectangle or circle: drag to draw
        const x = snapToGrid(comp.x);
        const y = snapToGrid(comp.y);
        setDrawState({
          isDrawing: true,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        });
      }
      return;
    }

    // Not in draw mode: start a rubber-band selection
    if (!e.shiftKey) {
      setSelectedFrameIds([]);
    }
    setMarquee({
      isActive: true,
      startX: comp.x,
      startY: comp.y,
      currentX: comp.x,
      currentY: comp.y,
      additive: e.shiftKey,
    });
  }, [isPresentationMode, isDrawMode, drawShape, polygonDrawState, toComp, snapToGrid, viewScale, finishPolygon]);

  // Handle double-click to close polygon
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const targetEl = e.target as HTMLElement;
    const isEmptyArea = targetEl === canvasRef.current || targetEl === stageRef.current || targetEl.dataset.canvasBg === 'true';
    if (isEmptyArea && drawShape === 'polygon' && polygonDrawState.isDrawing) {
      if (polygonDrawState.vertices.length >= 3) {
        finishPolygon();
      }
    }
  }, [drawShape, polygonDrawState, finishPolygon]);

  // ------------------------------------------------------------------
  // Frame gestures (drag / resize / rotate)
  // ------------------------------------------------------------------

  // Handle frame drag start — establishes the (possibly multi-) selection
  // (Gesture starts read the latest frames/selection at call time so they stay
  // stable and memoized frames don't re-render on every change.)
  const handleDragStart = useCallback((frameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const frames = projectStore.getState().frames;
    const selectedFrameIds = selectedIdsRef.current;
    const frame = frames.find(f => f.id === frameId);
    if (!frame) return;

    // Work out the group being dragged: an already-selected frame drags the
    // whole selection; an unselected one becomes the (additive) selection.
    let group: string[];
    if (selectedFrameIds.includes(frameId)) {
      group = selectedFrameIds;
    } else {
      group = e.shiftKey ? [...selectedFrameIds, frameId] : [frameId];
      setSelectedFrameIds(group);
    }

    const groupStartPositions: Record<string, Point> = {};
    for (const id of group) {
      const f = frames.find(fr => fr.id === id);
      if (f) groupStartPositions[id] = { x: f.x, y: f.y };
    }

    const comp = toComp(e.clientX, e.clientY);
    dragMovedRef.current = false;
    setDragState({
      isDragging: true,
      frameId,
      startX: comp.x,
      startY: comp.y,
      offsetX: frame.x,
      offsetY: frame.y,
      groupStartPositions,
    });
  }, [toComp]);

  // Handle resize start
  const handleResizeStart = useCallback((frameId: string, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const frame = projectStore.getState().frames.find(f => f.id === frameId);
    if (!frame) return;

    const comp = toComp(e.clientX, e.clientY);
    setResizeState({
      isResizing: true,
      frameId,
      handle: handle as ResizeState['handle'],
      startX: comp.x,
      startY: comp.y,
      startWidth: frame.width,
      startHeight: frame.height,
      startFrameX: frame.x,
      startFrameY: frame.y,
      rotation: frame.rotation,
      // Snapshot corners so we can scale them proportionally while resizing
      startPerspectiveCorners: frame.perspectiveMode ? { ...frame.perspectiveCorners } : undefined,
    });
  }, [toComp]);

  // Handle rotate start
  const handleRotateStart = useCallback((frameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const frame = projectStore.getState().frames.find(f => f.id === frameId);
    if (!frame) return;

    const centerX = frame.x + frame.width / 2;
    const centerY = frame.y + frame.height / 2;
    const comp = toComp(e.clientX, e.clientY);
    const angle = Math.atan2(comp.y - centerY, comp.x - centerX);

    setRotateState({
      isRotating: true,
      frameId,
      startAngle: angle - (frame.rotation * Math.PI / 180),
      centerX,
      centerY,
    });
  }, [toComp]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const needsComp = dragState.isDragging || resizeState.isResizing || rotateState.isRotating
      || drawState.isDrawing || marquee.isActive;
    if (!needsComp) return;
    const comp = toComp(e.clientX, e.clientY);

    // Handle dragging (moves the whole selected group)
    if (dragState.isDragging && dragState.frameId) {
      const deltaX = comp.x - dragState.startX;
      const deltaY = comp.y - dragState.startY;
      if (Math.abs(deltaX) > 3 / viewScale || Math.abs(deltaY) > 3 / viewScale) {
        dragMovedRef.current = true;
      }
      const positions = dragState.groupStartPositions ?? { [dragState.frameId]: { x: dragState.offsetX, y: dragState.offsetY } };
      setFrames(prev => prev.map(f => {
        const start = positions[f.id];
        if (!start) return f;
        return { ...f, x: snapToGrid(start.x + deltaX), y: snapToGrid(start.y + deltaY) };
      }));
    }

    // Handle resizing (rotation-aware: deltas in the frame's local axes,
    // opposite corner/edge anchored in composition space)
    if (resizeState.isResizing && resizeState.frameId) {
      const frame = frames.find(f => f.id === resizeState.frameId);
      if (!frame) return;

      const handle = resizeState.handle;
      const rot = resizeState.rotation;
      const isRotated = Math.abs(((rot % 360) + 360) % 360) > 0.01;
      const aspectRatio = resizeState.startWidth / resizeState.startHeight;

      // Pointer delta in the frame's local (unrotated) axes
      const d = rotateVector(comp.x - resizeState.startX, comp.y - resizeState.startY, -rot);

      let newWidth = resizeState.startWidth;
      let newHeight = resizeState.startHeight;

      // Frame edges at resize start — for unrotated frames snapping targets
      // the dragged edge so frames align to grid lines.
      const startLeft = resizeState.startFrameX;
      const startTop = resizeState.startFrameY;
      const startRight = resizeState.startFrameX + resizeState.startWidth;
      const startBottom = resizeState.startFrameY + resizeState.startHeight;

      const snapWidthEast = (raw: number) => isRotated ? snapToGrid(raw) : snapToGrid(startLeft + raw) - startLeft;
      const snapWidthWest = (raw: number) => isRotated ? snapToGrid(raw) : startRight - snapToGrid(startRight - raw);
      const snapHeightSouth = (raw: number) => isRotated ? snapToGrid(raw) : snapToGrid(startTop + raw) - startTop;
      const snapHeightNorth = (raw: number) => isRotated ? snapToGrid(raw) : startBottom - snapToGrid(startBottom - raw);

      if (frame.lockAspectRatio && (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se')) {
        // Corner handles with aspect ratio lock (snap width, derive height)
        if (handle.includes('e')) {
          newWidth = Math.max(50, snapWidthEast(resizeState.startWidth + d.x));
        } else {
          newWidth = Math.max(50, snapWidthWest(resizeState.startWidth - d.x));
        }
        newHeight = newWidth / aspectRatio;
      } else {
        // Free resize or edge handles
        if (handle?.includes('e')) {
          newWidth = Math.max(50, snapWidthEast(resizeState.startWidth + d.x));
        }
        if (handle?.includes('w')) {
          newWidth = Math.max(50, snapWidthWest(resizeState.startWidth - d.x));
        }
        if (handle?.includes('s')) {
          newHeight = Math.max(50, snapHeightSouth(resizeState.startHeight + d.y));
        }
        if (handle?.includes('n')) {
          newHeight = Math.max(50, snapHeightNorth(resizeState.startHeight - d.y));
        }
      }

      // Anchor: the corner/edge opposite the handle stays fixed in
      // composition space, even when the frame is rotated.
      const anchorSignX = handle?.includes('w') ? 1 : handle?.includes('e') ? -1 : 0;
      const anchorSignY = handle?.includes('n') ? 1 : handle?.includes('s') ? -1 : 0;
      const startCenter = {
        x: resizeState.startFrameX + resizeState.startWidth / 2,
        y: resizeState.startFrameY + resizeState.startHeight / 2,
      };
      const anchorLocalStart = rotateVector(anchorSignX * resizeState.startWidth / 2, anchorSignY * resizeState.startHeight / 2, rot);
      const anchorWorld = { x: startCenter.x + anchorLocalStart.x, y: startCenter.y + anchorLocalStart.y };
      const anchorLocalNew = rotateVector(anchorSignX * newWidth / 2, anchorSignY * newHeight / 2, rot);
      const newCenter = { x: anchorWorld.x - anchorLocalNew.x, y: anchorWorld.y - anchorLocalNew.y };

      const resizeUpdates: Partial<MediaFrame> = {
        width: newWidth,
        height: newHeight,
        x: newCenter.x - newWidth / 2,
        y: newCenter.y - newHeight / 2,
      };

      // When perspective mode is active, scale corner offsets proportionally so the
      // visual warp shape stays consistent as the frame bounding box changes.
      if (resizeState.startPerspectiveCorners) {
        const scaleX = newWidth  / resizeState.startWidth;
        const scaleY = newHeight / resizeState.startHeight;
        const sc = resizeState.startPerspectiveCorners;
        resizeUpdates.perspectiveCorners = {
          tl: { x: sc.tl.x * scaleX, y: sc.tl.y * scaleY },
          tr: { x: sc.tr.x * scaleX, y: sc.tr.y * scaleY },
          br: { x: sc.br.x * scaleX, y: sc.br.y * scaleY },
          bl: { x: sc.bl.x * scaleX, y: sc.bl.y * scaleY },
        };
      }

      updateFrame(resizeState.frameId, resizeUpdates);
    }

    // Handle rotating
    if (rotateState.isRotating && rotateState.frameId) {
      const angle = Math.atan2(
        comp.y - rotateState.centerY,
        comp.x - rotateState.centerX
      );
      const rotation = ((angle - rotateState.startAngle) * 180 / Math.PI) % 360;
      updateFrame(rotateState.frameId, { rotation });
    }

    // Handle drawing
    if (drawState.isDrawing) {
      setDrawState(prev => ({
        ...prev,
        currentX: snapToGrid(comp.x),
        currentY: snapToGrid(comp.y),
      }));
    }

    // Handle marquee selection
    if (marquee.isActive) {
      setMarquee(prev => ({ ...prev, currentX: comp.x, currentY: comp.y }));
    }
  }, [dragState, resizeState, rotateState, drawState, marquee.isActive, frames, snapToGrid, toComp, viewScale]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Finish drawing (only for rectangle/circle, not polygon)
    if (drawState.isDrawing && drawShape && drawShape !== 'polygon') {
      const x = Math.min(drawState.startX, drawState.currentX);
      const y = Math.min(drawState.startY, drawState.currentY);
      const width = Math.abs(drawState.currentX - drawState.startX);
      const height = Math.abs(drawState.currentY - drawState.startY);
      const isBigEnough = width > 20 && height > 20;

      if (isBigEnough) {
        // Always create a frame, even without media URL
        addFrame(createFrame({
          type: pendingMediaUrl?.type || 'image',
          url: pendingMediaUrl?.url || '',
          mediaId: pendingMediaUrl?.mediaId,
          filename: pendingMediaUrl?.url ? filenameFromUrl(pendingMediaUrl.url) : undefined,
          x,
          y,
          width,
          height,
          shape: drawShape,
          zIndex: frames.length,
        }));
        setPendingMediaUrl(null);
      }

      setDrawState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      });
      // Stay in draw mode after an accidental tiny drag so the user can
      // simply try again; only a successful frame (or ESC) exits the mode.
      if (isBigEnough) {
        setIsDrawMode(false);
        setDrawShape(null);
      }
    }

    // Finish marquee selection
    if (marquee.isActive) {
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);
      if (maxX - minX > 4 || maxY - minY > 4) {
        const hit = frames
          .filter(f => f.visible !== false)
          .filter(f => {
            const box = frameAABB(f);
            return box.minX < maxX && box.maxX > minX && box.minY < maxY && box.maxY > minY;
          })
          .map(f => f.id);
        setSelectedFrameIds(prev => marquee.additive ? [...new Set([...prev, ...hit])] : hit);
      }
      setMarquee(prev => ({ ...prev, isActive: false }));
    }

    // Plain click (no drag) on a member of a multi-selection collapses the
    // selection to that frame — standard multi-select behavior.
    if (dragState.isDragging && dragState.frameId && !dragMovedRef.current && !e.shiftKey) {
      setSelectedFrameIds([dragState.frameId]);
    }

    setDragState(prev => ({ ...prev, isDragging: false, frameId: null, groupStartPositions: undefined }));
    setResizeState(prev => ({ ...prev, isResizing: false, frameId: null }));
    setRotateState(prev => ({ ...prev, isRotating: false, frameId: null }));
  }, [drawState, drawShape, marquee, dragState, frames, addFrame, pendingMediaUrl]);

  // Add mouse event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ------------------------------------------------------------------
  // Media handling
  // ------------------------------------------------------------------

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const comp = toComp(e.clientX, e.clientY);
    const files = Array.from(e.dataTransfer.files);
    let offset = 0;
    for (const file of files) {
      if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
        const type = file.type.startsWith('video/') ? 'video' : 'image';

        try {
          // Store in IndexedDB
          const storedMedia = await storeMedia(file, file.name, type);
          const url = getMediaObjectUrl(storedMedia);

          addFrame(createFrame({
            type,
            url,
            mediaId: storedMedia.id,
            filename: file.name,
            x: snapToGrid(comp.x - 150 + offset),
            y: snapToGrid(comp.y - 100 + offset),
            width: 300,
            height: 200,
            shape: 'rectangle',
            zIndex: frames.length,
          }));
          offset += 20;
        } catch (error) {
          console.error('Failed to store media:', error);
          alert((error as Error).message);
        }
      }
    }
  }, [frames.length, addFrame, snapToGrid, toComp]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Control panel handlers
  const handleAddUrl = useCallback((url: string, type: 'video' | 'image') => {
    setPendingMediaUrl({ url, type });
    setIsDrawMode(true);
    setDrawShape('rectangle');
  }, []);

  // Handle media selection from library
  const handleSelectMedia = useCallback(async (media: StoredMedia) => {
    const url = getMediaObjectUrl(media);

    // Check if selecting for background
    if (mediaLibraryTargetBackground) {
      setBackground(prev => ({
        ...prev,
        url,
        mediaId: media.id,
      }));
      setMediaLibraryTargetBackground(false);
    }
    // Check if we're changing media for an existing frame
    else if (mediaLibraryTargetFrameId) {
      // Update the existing frame with new media
      updateFrame(mediaLibraryTargetFrameId, {
        url,
        type: media.type,
        mediaId: media.id,
        filename: media.name,
      });
      setMediaLibraryTargetFrameId(null);
    } else {
      // Set pending media for new frame creation
      setPendingMediaUrl({ url, type: media.type, mediaId: media.id });
      setIsDrawMode(true);
      setDrawShape('rectangle');
    }
  }, [mediaLibraryTargetFrameId, mediaLibraryTargetBackground]);

  // Handle opening media library for a specific frame (to change its media)
  const handleOpenMediaLibraryForFrame = useCallback((frameId: string) => {
    setMediaLibraryTargetFrameId(frameId);
    setMediaLibraryTargetBackground(false);
    setIsMediaLibraryOpen(true);
  }, []);

  // Handle opening media library for new media selection
  const handleOpenMediaLibrary = useCallback(() => {
    setMediaLibraryTargetFrameId(null);
    setMediaLibraryTargetBackground(false);
    setIsMediaLibraryOpen(true);
  }, []);

  // Handle opening media library for background
  const handleOpenMediaLibraryForBackground = useCallback(() => {
    setMediaLibraryTargetFrameId(null);
    setMediaLibraryTargetBackground(true);
    setIsMediaLibraryOpen(true);
  }, []);

  const handleDrawMode = useCallback((shape: ShapeType) => {
    if (isDrawMode && drawShape === shape) {
      setIsDrawMode(false);
      setDrawShape(null);
    } else {
      setIsDrawMode(true);
      setDrawShape(shape);
    }
  }, [isDrawMode, drawShape]);

  const handleExportPackage = useCallback(async () => {
    try {
      await exportPackage();
    } catch (error) {
      alert('Failed to export the project package: ' + (error as Error).message);
    }
  }, [exportPackage]);

  // Imports always become a new project — the open one is never overwritten
  const handleImport = useCallback(async (file: File) => {
    try {
      await importFile(file);
    } catch (error) {
      alert('Failed to import project: ' + (error as Error).message);
    }
  }, [importFile]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  // Draw preview rectangle/circle (composition coords)
  const drawPreview = drawState.isDrawing && drawShape && drawShape !== 'polygon' ? {
    x: Math.min(drawState.startX, drawState.currentX),
    y: Math.min(drawState.startY, drawState.currentY),
    width: Math.abs(drawState.currentX - drawState.startX),
    height: Math.abs(drawState.currentY - drawState.startY),
  } : null;

  // Marquee rect (composition coords)
  const marqueeRect = marquee.isActive ? {
    x: Math.min(marquee.startX, marquee.currentX),
    y: Math.min(marquee.startY, marquee.currentY),
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : null;

  // Polygon preview points string for SVG
  const polygonPreviewPoints = polygonDrawState.isDrawing && polygonDrawState.vertices.length > 0
    ? polygonDrawState.vertices.map(v => `${v.x},${v.y}`).join(' ')
    : null;

  const gridVisible = grid.show && (!isPresentationMode || grid.showInPresentation);

  return (
    <>
      {/* Non-blocking notices — never shown on the output. The update prompt
          stays mounted so the service worker is registered once. */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2000] flex flex-col items-center gap-2"
        style={{ display: isPresentationMode ? 'none' : undefined }}
      >
        <UpdatePrompt />
        {session.notice && (
          <div className="bg-black/85 text-white text-sm rounded-lg px-4 py-2 shadow-xl backdrop-blur-sm">
            {session.notice}
          </div>
        )}
        {session.loadWarnings.length > 0 && (
          <div className="flex items-start gap-3 bg-amber-900/90 text-white text-sm rounded-lg px-4 py-2 shadow-xl backdrop-blur-sm max-w-xl">
            <div>
              <p>The project was repaired while opening:</p>
              <ul className="list-disc pl-4 text-xs text-white/80 mt-1">
                {session.loadWarnings.slice(0, 5).map((warning, i) => <li key={i}>{warning}</li>)}
                {session.loadWarnings.length > 5 && <li>…and {session.loadWarnings.length - 5} more (see console)</li>}
              </ul>
            </div>
            <button onClick={session.dismissLoadWarnings} className="text-white/70 hover:text-white">Dismiss</button>
          </div>
        )}
        {rendererNotice && (
          <div className="flex items-center gap-3 bg-amber-900/90 text-white text-sm rounded-lg px-4 py-2 shadow-xl backdrop-blur-sm">
            <span>{rendererNotice}</span>
            <button onClick={() => setRendererNotice(null)} className="text-white/70 hover:text-white">Dismiss</button>
          </div>
        )}
        {session.autosaveError && (
          <div className="flex items-center gap-3 bg-red-900/90 text-white text-sm rounded-lg px-4 py-2 shadow-xl backdrop-blur-sm">
            <span>Autosave failed: {session.autosaveError}</span>
            <button onClick={exportJson} className="underline whitespace-nowrap">Export project</button>
            <button onClick={session.dismissAutosaveError} className="text-white/70 hover:text-white">Dismiss</button>
          </div>
        )}
      </div>

      {!isPresentationMode && (
        <ControlPanel
          onAddUrl={handleAddUrl}
          projectName={session.project?.name ?? '…'}
          onOpenProjects={() => setIsProjectsOpen(true)}
          onSaveVersion={saveVersion}
          onExport={exportJson}
          onExportPackage={handleExportPackage}
          onImport={handleImport}
          onDrawMode={handleDrawMode}
          isDrawMode={isDrawMode}
          drawShape={drawShape}
          onPresentationMode={enterFullscreenPresentation}
          onOpenMediaLibrary={handleOpenMediaLibrary}
          onOpenBackgroundSettings={() => setIsBackgroundSettingsOpen(true)}
          onPlayAll={handlePlayAll}
          onPauseAll={handlePauseAll}
          hasVideos={hasVideos}
          grid={grid}
          onUpdateGrid={(updates) => setGrid(prev => ({ ...prev, ...updates }))}
          composition={composition}
          onUpdateComposition={(updates) => setComposition(prev => ({ ...prev, ...updates }))}
          masterOpacity={masterOpacity}
          onMasterOpacityChange={setMasterOpacity}
          blackout={blackout}
          onToggleBlackout={() => setBlackout(prev => !prev)}
          showTestCard={showTestCard}
          onToggleTestCard={() => setShowTestCard(prev => !prev)}
        />
      )}

      {!isPresentationMode && (
        <LayersPanel
          frames={frames}
          selectedFrameIds={selectedFrameIds}
          onSelect={selectFrame}
          onUpdate={updateFrame}
          onDelete={(id) => deleteFrames([id])}
          onDuplicate={(id) => duplicateFrames([id])}
          onReorder={reorderFrame}
          composition={composition}
        />
      )}

      {/* Media Library Modal */}
      <MediaLibrary
        isOpen={isMediaLibraryOpen}
        onClose={() => {
          setIsMediaLibraryOpen(false);
          setMediaLibraryTargetFrameId(null);
          setMediaLibraryTargetBackground(false);
        }}
        onSelectMedia={handleSelectMedia}
        getMediaUsage={getMediaUsage}
      />

      <ProjectsPanel isOpen={isProjectsOpen} onClose={() => setIsProjectsOpen(false)} session={session} />

      {/* Background Settings Panel */}
      <BackgroundSettingsPanel
        background={background}
        onUpdate={setBackground}
        onOpenMediaLibrary={handleOpenMediaLibraryForBackground}
        isOpen={isBackgroundSettingsOpen}
        onClose={() => setIsBackgroundSettingsOpen(false)}
      />

      <div
        ref={canvasRef}
        className={`w-full h-full relative overflow-hidden bg-[#0a0a0a] ${isDrawMode ? 'cursor-crosshair' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={(e) => {
          // Show presentation controls when mouse is in top-right corner
          if (isPresentationMode) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const isInCorner = e.clientX > rect.right - 150 && e.clientY < rect.top + 100;
              setShowPresentationControls(isInCorner);
            }
          }
        }}
        onMouseLeave={() => isPresentationMode && setShowPresentationControls(false)}
      >
        {/* Composition stage — everything inside is in composition coordinates */}
        <div
          ref={stageRef}
          data-canvas-bg="true"
          className="absolute bg-black"
          style={{
            width: composition.width,
            height: composition.height,
            transform: `translate(${viewOffsetX}px, ${viewOffsetY}px) scale(${viewScale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Content: GPU canvas or master-faded DOM (background + frames).
              Frames always provide their editor overlay. */}
          {renderer === 'gpu' && (
            <GpuStage
              scene={gpuScene}
              pixelsPerUnit={viewScale * window.devicePixelRatio}
              onUnavailable={handleGpuUnavailable}
            />
          )}
          <div
            data-canvas-bg="true"
            className="absolute inset-0"
            style={{ opacity: masterOpacity, pointerEvents: renderer === 'gpu' ? 'none' : undefined }}
          >
            {renderer !== 'gpu' && (
              <BackgroundLayer background={background} outputGain={editorGain} playback={playback} />
            )}

            {/* Frames */}
            {visibleFrames.map(frame => (
              <MediaFrameComponent
                key={frame.id}
                frame={frame}
                isSelected={selectedFrameIds.includes(frame.id) && !isPresentationMode}
                onUpdateFrame={updateFrame}
                onDeleteFrame={deleteFrame}
                onFrameDragStart={handleDragStart}
                onFrameResizeStart={handleResizeStart}
                onFrameRotateStart={handleRotateStart}
                isPresentationMode={isPresentationMode}
                onOpenFrameMediaLibrary={handleOpenMediaLibraryForFrame}
                playback={playback}
                clientToComp={toComp}
                snapToGrid={snapToGrid}
                overlayContainer={overlayEl}
                viewScale={viewScale}
                outputGain={editorGain}
                renderContent={renderer !== 'gpu'}
              />
            ))}
          </div>

          {/* Editor overlay — outlines, handles and hit areas of every frame,
              above the content and outside the master fader */}
          <div ref={setOverlayEl} className="absolute inset-0 pointer-events-none" style={{ zIndex: 700 }} />

          {/* Grid overlay — optionally stays visible in presentation mode for
              projector alignment */}
          {gridVisible && <GridOverlay grid={grid} />}

          {/* Global output test card (projector setup) */}
          {showTestCard && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 550 }}>
              <TestCard
                width={composition.width}
                height={composition.height}
                label={`${composition.width} × ${composition.height}`}
              />
            </div>
          )}

          {/* Draw Preview for Rectangle/Circle */}
          {drawPreview && (
            <div
              className="absolute border-4 border-dashed border-yellow-400 bg-yellow-400/20 pointer-events-none"
              style={{
                left: drawPreview.x,
                top: drawPreview.y,
                width: drawPreview.width,
                height: drawPreview.height,
                zIndex: 800,
                clipPath: drawShape === 'circle' ? 'ellipse(50% 50% at 50% 50%)' : 'none',
              }}
            />
          )}

          {/* Marquee selection rectangle */}
          {marqueeRect && (marqueeRect.width > 2 || marqueeRect.height > 2) && (
            <div
              className="absolute border border-cyan-400 bg-cyan-400/10 pointer-events-none"
              style={{
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.width,
                height: marqueeRect.height,
                zIndex: 800,
              }}
            />
          )}

          {/* Polygon Preview */}
          {polygonDrawState.isDrawing && polygonDrawState.vertices.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 800 }}>
              {/* Draw lines between vertices */}
              <polyline
                points={polygonPreviewPoints || ''}
                fill="rgba(250, 204, 21, 0.2)"
                stroke="#facc15"
                strokeWidth={3 / viewScale}
                strokeDasharray="8 4"
              />
              {/* Draw vertices as circles */}
              {polygonDrawState.vertices.map((vertex, index) => (
                <circle
                  key={index}
                  cx={vertex.x}
                  cy={vertex.y}
                  r={(index === 0 ? 10 : 6) / viewScale}
                  fill={index === 0 ? '#22c55e' : '#facc15'}
                  stroke={index === 0 ? '#16a34a' : '#ca8a04'}
                  strokeWidth={2 / viewScale}
                />
              ))}
              {/* Instruction text */}
              <text
                x="50%"
                y={40 / viewScale}
                textAnchor="middle"
                fill="white"
                fontSize={16 / viewScale}
                fontWeight="bold"
                className="drop-shadow-lg"
              >
                {polygonDrawState.vertices.length < 3
                  ? `Click to add vertices (${polygonDrawState.vertices.length}/3 minimum)`
                  : 'Double-click or click green point to close polygon'
                }
              </text>
            </svg>
          )}

          {/* Composition bounds outline (edit mode only) */}
          {!isPresentationMode && (
            <div className="absolute inset-0 pointer-events-none border border-white/25" style={{ zIndex: 900 }} />
          )}

          {/* Blackout — kills the whole output instantly (B) */}
          {blackout && (
            <div className="absolute inset-0 bg-black pointer-events-none" style={{ zIndex: 950 }} />
          )}
        </div>

        {/* Presentation Mode Controls - only show on corner hover */}
        {isPresentationMode && showPresentationControls && (
          <div className="absolute top-4 right-4 z-50 flex gap-2 animate-fade-in">
            <button
              onClick={togglePresentationMode}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2"
              title="Exit Presentation Mode (ESC or P)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Mode
            </button>
            {!document.fullscreenElement && (
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
                title="Fullscreen (F)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Instructions overlay when empty */}
        {frames.length === 0 && !isPresentationMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white/50">
              <p className="text-2xl font-bold mb-2">Video Mapper</p>
              <p className="text-lg">Draw a frame or drop media files to start</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
