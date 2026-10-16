import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { MediaFrame, Point, PerspectiveCorners, BlendMode, ResizeHandle } from '../types';
import type { LiveState } from '../state/liveStore';
import {
  RotateCw,
  Trash2,
  Volume2,
  VolumeX,
  Layers,
  Upload,
  Sparkles,
  FlipHorizontal,
  FlipVertical,
  Lock,
  Unlock,
  Move3D,
  Grid3X3,
  LayoutTemplate,
  PenTool,
} from 'lucide-react';
import { Slider } from './ui/slider';
import { FrameContent } from './FrameContent';
import type { PreloadMedia } from '../render/types';
import {
  applyHomography,
  invertHomography,
  getFrameHomography,
  getCornerLocalPositions,
  getShapeVertices,
  compToFrameLocal,
  isConvexQuad,
  refitFrameToVertices,
  pinFrameToQuadVertices,
} from '../lib/geometry';

// Callbacks take the frame id so the parent can pass stable functions and
// the component can be memoized (only frames that change re-render)
interface MediaFrameComponentProps {
  frame: MediaFrame;
  isSelected: boolean;
  onUpdateFrame: (id: string, updates: Partial<MediaFrame>) => void;
  onDeleteFrame: (id: string) => void;
  onFrameDragStart: (id: string, e: React.MouseEvent) => void;
  onFrameResizeStart: (id: string, handle: ResizeHandle, e: React.MouseEvent) => void;
  onFrameRotateStart: (id: string, e: React.MouseEvent) => void;
  isPresentationMode: boolean;
  onOpenFrameMediaLibrary: (id: string) => void; // Open media library to change media for this frame
  playback: LiveState['playback']; // Global transport (play / pause all)
  clientToComp: (clientX: number, clientY: number) => Point; // pointer → composition coords
  snapToGrid: (value: number) => number; // identity when snapping is off
  // Editor overlay layer (portal target) — handles, outlines and hit areas
  // live there, above all content, so they never blend or get clipped
  overlayContainer: HTMLElement | null;
  viewScale: number; // composition → screen scale; keeps handles a constant screen size
  outputGain: number; // master fader × blackout, applied to audio volume
  // false when the GPU renderer draws the content — only the editor UI remains
  renderContent?: boolean;
  preload?: PreloadMedia[]; // launcher: clips of this frame's layer to keep ready
  startSeq?: number; // launcher: this frame's layer trigger counter
}

// Number of subdivisions of the warped editing grid (Resolume-style)
const WARP_GRID_DIVISIONS = 8;

// Resize handles and their position as a fraction of the frame box
const RESIZE_HANDLES: { handle: ResizeHandle; fx: number; fy: number }[] = [
  { handle: 'nw', fx: 0, fy: 0 },
  { handle: 'n', fx: 0.5, fy: 0 },
  { handle: 'ne', fx: 1, fy: 0 },
  { handle: 'e', fx: 1, fy: 0.5 },
  { handle: 'se', fx: 1, fy: 1 },
  { handle: 's', fx: 0.5, fy: 1 },
  { handle: 'sw', fx: 0, fy: 1 },
  { handle: 'w', fx: 0, fy: 0.5 },
];

// Frame UI layers (outlines, handles, controls) stack above every hit area
const UI_LAYER_Z = 100000;

export const MediaFrameComponent = React.memo(function MediaFrameComponent({
  frame,
  isSelected,
  onUpdateFrame,
  onDeleteFrame,
  onFrameDragStart,
  onFrameResizeStart,
  onFrameRotateStart,
  isPresentationMode,
  onOpenFrameMediaLibrary,
  playback,
  clientToComp,
  snapToGrid,
  overlayContainer,
  viewScale,
  outputGain,
  renderContent = true,
  preload,
  startSeq,
}: MediaFrameComponentProps) {
  const frameId = frame.id;
  const onUpdate = useCallback(
    (updates: Partial<MediaFrame>) => onUpdateFrame(frameId, updates),
    [onUpdateFrame, frameId]
  );
  const onDelete = () => onDeleteFrame(frameId);
  const onDragStart = (e: React.MouseEvent) => onFrameDragStart(frameId, e);
  const onResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => onFrameResizeStart(frameId, handle, e);
  const onRotateStart = (e: React.MouseEvent) => onFrameRotateStart(frameId, e);
  const onOpenMediaLibrary = () => onOpenFrameMediaLibrary(frameId);

  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<keyof PerspectiveCorners | null>(null);
  // Polygon + corner pin: pins and vertices often coincide (vertices on the
  // box corners), so — like Photoshop's transform vs. direct selection —
  // either the warp pins or the shape's vertices are editable at a time
  const [isEditingShape, setIsEditingShape] = useState(false);
  const hideControlsTimerRef = useRef<number | null>(null);
  const bodyPointerDownRef = useRef<Point | null>(null);

  // Use refs to avoid stale closures in event handlers
  const draggingVertexIndexRef = useRef<number | null>(null);
  const draggingCornerRef = useRef<keyof PerspectiveCorners | null>(null);
  const frameRef = useRef(frame);
  const onUpdateRef = useRef(onUpdate);
  const clientToCompRef = useRef(clientToComp);
  const snapToGridRef = useRef(snapToGrid);

  // Keep refs in sync
  useEffect(() => {
    draggingVertexIndexRef.current = draggingVertexIndex;
  }, [draggingVertexIndex]);

  useEffect(() => {
    draggingCornerRef.current = draggingCorner;
  }, [draggingCorner]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    clientToCompRef.current = clientToComp;
  }, [clientToComp]);

  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);

  // Handle vertex drag for polygon editing
  const handleVertexMouseDown = useCallback((index: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingVertexIndex(index);
  }, []);

  // Handle corner drag for perspective mode
  const handleCornerPointerDown = useCallback((corner: keyof PerspectiveCorners, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingCorner(corner);
  }, []);

  // Global move/up handlers for vertex & corner dragging — mouse + touch
  useEffect(() => {
    const getClientXY = (e: MouseEvent | TouchEvent): { clientX: number; clientY: number } => {
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        return { clientX: t.clientX, clientY: t.clientY };
      }
      return { clientX: e.clientX, clientY: e.clientY };
    };

    // Pointer → warped frame-local coords (handles stage scale AND frame
    // rotation), then snapped: against the composition grid when the frame is
    // unrotated, against local coords otherwise.
    const pointerToSnappedLocal = (clientX: number, clientY: number): Point => {
      const currentFrame = frameRef.current;
      const comp = clientToCompRef.current(clientX, clientY);
      const local = compToFrameLocal(comp.x, comp.y, currentFrame);
      const snap = snapToGridRef.current;
      const isRotated = Math.abs(((currentFrame.rotation % 360) + 360) % 360) > 0.01;
      if (isRotated) {
        return { x: snap(local.x), y: snap(local.y) };
      }
      return {
        x: snap(currentFrame.x + local.x) - currentFrame.x,
        y: snap(currentFrame.y + local.y) - currentFrame.y,
      };
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const isDraggingAnything =
        draggingVertexIndexRef.current !== null || draggingCornerRef.current !== null;
      if (!isDraggingAnything) return;

      // Prevent page scroll while dragging on touch
      if ('touches' in e) e.preventDefault();

      const { clientX, clientY } = getClientXY(e);

      // --- Vertex dragging ---
      // Vertices live in the unwarped box, so the (warped) pointer position is
      // pulled back through H⁻¹ — the vertex stays exactly under the cursor.
      // They may leave the box; it is refitted when the drag ends.
      const currentIndex = draggingVertexIndexRef.current;
      if (currentIndex !== null) {
        const currentFrame = frameRef.current;
        if (!currentFrame.vertices) return;

        const warped = pointerToSnappedLocal(clientX, clientY);
        const H = getFrameHomography(currentFrame);
        const Hinv = H ? invertHomography(H) : null;
        if (H && !Hinv) return;
        const local = Hinv ? applyHomography(Hinv, warped.x, warped.y) : warped;

        const newVertices = [...currentFrame.vertices];
        newVertices[currentIndex] = {
          x: local.x / currentFrame.width,
          y: local.y / currentFrame.height,
        };
        onUpdateRef.current({ vertices: newVertices });
        return;
      }

      // --- Corner dragging (perspective mode) ---
      const corner = draggingCornerRef.current;
      if (corner !== null) {
        const currentFrame = frameRef.current;
        const local = pointerToSnappedLocal(clientX, clientY);

        const defaultX = corner === 'tl' || corner === 'bl' ? 0 : currentFrame.width;
        const defaultY = corner === 'tl' || corner === 'tr' ? 0 : currentFrame.height;

        const newOffset = { x: local.x - defaultX, y: local.y - defaultY };
        const newCorners = { ...currentFrame.perspectiveCorners, [corner]: newOffset };

        // Reject folded / mirrored quads — the last valid pin position stays
        const q = getCornerLocalPositions(currentFrame.width, currentFrame.height, newCorners);
        if (!isConvexQuad([q.tl, q.tr, q.br, q.bl])) return;

        onUpdateRef.current({ perspectiveCorners: newCorners });
      }
    };

    const handleUp = () => {
      if (draggingVertexIndexRef.current !== null) {
        setDraggingVertexIndex(null);
        draggingVertexIndexRef.current = null;
        // Shrink/grow the box to the edited shape without moving anything
        const refit = refitFrameToVertices(frameRef.current);
        if (refit) onUpdateRef.current(refit);
      }
      if (draggingCornerRef.current !== null) {
        setDraggingCorner(null);
        draggingCornerRef.current = null;
      }
    };

    // passive: false on touchmove so we can call preventDefault() to block scroll
    window.addEventListener('mousemove', handleMove as EventListener);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove as EventListener, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove as EventListener);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove as EventListener);
      window.removeEventListener('touchend', handleUp);
    };
  }, []); // Empty dependency — handlers use refs

  // Clear a pending hide-controls timer on unmount
  useEffect(() => () => {
    if (hideControlsTimerRef.current !== null) clearTimeout(hideControlsTimerRef.current);
  }, []);

  // Hover shows the controls; hiding is delayed slightly so the pointer can
  // cross the gap between the shape and its (outside-anchored) buttons
  const handleMouseEnter = () => {
    if (isPresentationMode) return;
    if (hideControlsTimerRef.current !== null) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    setShowControls(true);
  };
  const handleMouseLeave = () => {
    if (isPresentationMode) return;
    hideControlsTimerRef.current = window.setTimeout(() => {
      hideControlsTimerRef.current = null;
      setShowControls(false);
      setShowSettings(false);
      setShowEffects(false);
    }, 250);
  };

  const handleChangeMedia = () => {
    onOpenMediaLibrary();
  };

  // Pressing the shape selects + starts a drag; a click without movement on
  // an empty frame opens the media library
  const handleBodyMouseDown = (e: React.MouseEvent) => {
    bodyPointerDownRef.current = { x: e.clientX, y: e.clientY };
    if (!isSelected) setIsEditingShape(false);
    onDragStart(e);
  };
  const handleBodyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const start = bodyPointerDownRef.current;
    const moved = !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4;
    // (A launcher layer that is merely cleared is not empty)
    if (!moved && !frame.url && !frame.testPattern && !frame.layerHasClips) onOpenMediaLibrary();
  };

  // -------------------------------------------------------------------------
  // Unified warp model (Photoshop-style: the shape stays, the texture warps)
  //
  // The frame box (width × height) is the corner-pin container for every
  // shape. Its four pins define ONE homography H, and everything drawn for the
  // frame goes through it: the media, the shape's clip-path, the editing grid,
  // vertex and resize handles, the selection outline and the hit area.
  // Vertices live in the unwarped box (normalized 0–1); edits are pulled back
  // through H⁻¹ and the box is refitted afterwards. Circles become an n-gon
  // only while warped.
  // -------------------------------------------------------------------------
  const w = frame.width;
  const h = frame.height;
  const H = getFrameHomography(frame);
  const toWarped = (x: number, y: number): Point => (H ? applyHomography(H, x, y) : { x, y });

  const shapeVertices = getShapeVertices(frame.shape, frame.vertices, H ? 96 : 48);
  const shapeVerticesPx: Point[] = shapeVertices.map(v => toWarped(v.x * w, v.y * h));
  const outlinePoints = shapeVerticesPx.map(p => `${p.x},${p.y}`).join(' ');

  // Values edited in the settings / effects panels
  const contentScale = frame.contentScale ?? 1;
  const contentOffsetX = frame.contentOffsetX ?? 0;
  const contentOffsetY = frame.contentOffsetY ?? 0;
  const softEdge = frame.softEdge ?? { left: 0, right: 0, top: 0, bottom: 0 };
  const hasSoftEdge = softEdge.left > 0 || softEdge.right > 0 || softEdge.top > 0 || softEdge.bottom > 0;

  // ---- Editor overlay geometry (warped frame-local px) ----
  const ui = 1 / (viewScale || 1); // composition px per screen px
  const canToggleShapeEdit = frame.shape === 'polygon' && frame.perspectiveMode;
  const editingShape = canToggleShapeEdit && isEditingShape && isSelected;
  const showPins = frame.perspectiveMode && (isSelected || showControls) && !editingShape;
  const showVertexHandles = isSelected && frame.shape === 'polygon' && (!frame.perspectiveMode || editingShape);
  const cornerPositions = getCornerLocalPositions(w, h, frame.perspectiveCorners);
  const pinQuad = frame.perspectiveMode
    ? [cornerPositions.tl, cornerPositions.tr, cornerPositions.br, cornerPositions.bl]
    : [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const pinQuadCenter = {
    x: pinQuad.reduce((sum, p) => sum + p.x, 0) / 4,
    y: pinQuad.reduce((sum, p) => sum + p.y, 0) / 4,
  };
  const outlineBounds = {
    minX: Math.min(...shapeVerticesPx.map(p => p.x)),
    maxX: Math.max(...shapeVerticesPx.map(p => p.x)),
    minY: Math.min(...shapeVerticesPx.map(p => p.y)),
    maxY: Math.max(...shapeVerticesPx.map(p => p.y)),
  };

  // Resize handles sit on the warped box; in corner-pin mode the corner ones
  // are pushed outward so they don't cover the orange pins
  const resizeHandlePositions = RESIZE_HANDLES.map(({ handle, fx, fy }) => {
    let p = toWarped(fx * w, fy * h);
    if (frame.perspectiveMode && handle.length === 2) {
      const dx = p.x - pinQuadCenter.x;
      const dy = p.y - pinQuadCenter.y;
      const len = Math.hypot(dx, dy) || 1;
      p = { x: p.x + (dx / len) * 24 * ui, y: p.y + (dy / len) * 24 * ui };
    }
    return { handle, p };
  });
  const rotateAnchor = toWarped(w / 2, 0);

  // Warped editing grid lines (homographies map straight lines to straight
  // lines, so each grid line is a segment between transformed endpoints)
  const warpGridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (frame.perspectiveMode && (isSelected || showControls)) {
    for (let i = 1; i < WARP_GRID_DIVISIONS; i++) {
      const f = i / WARP_GRID_DIVISIONS;
      const v1 = toWarped(f * w, 0);
      const v2 = toWarped(f * w, h);
      warpGridLines.push({ x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y });
      const h1 = toWarped(0, f * h);
      const h2 = toWarped(w, f * h);
      warpGridLines.push({ x1: h1.x, y1: h1.y, x2: h2.x, y2: h2.y });
    }
  }

  const clipId = `frame-clip-${frame.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // A convex 4-vertex polygon can hand its vertices to the corner pin
  const quadPin = frame.shape === 'polygon' && frame.vertices?.length === 4
    ? pinFrameToQuadVertices(frame)
    : null;

  // Counter-rotation for UI elements to keep them upright
  const counterRotation = `rotate(${-frame.rotation}deg)`;

  // Both editor layers share the frame's box and rotation
  const overlayBoxStyle: React.CSSProperties = {
    left: frame.x,
    top: frame.y,
    width: w,
    height: h,
    transform: `rotate(${frame.rotation}deg)`,
    pointerEvents: 'none',
  };

  // Hit layer — exactly the rendered (warped) shape, stacked like the content
  const hitLayer = !isPresentationMode ? (
    <div
      className="absolute"
      style={{ ...overlayBoxStyle, zIndex: frame.zIndex }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        className="absolute"
        style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      >
        <polygon
          points={outlinePoints}
          fill="transparent"
          style={{ pointerEvents: 'fill', cursor: 'move' }}
          onMouseDown={handleBodyMouseDown}
          onClick={handleBodyClick}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (canToggleShapeEdit) setIsEditingShape(prev => !prev);
          }}
        />
      </svg>
    </div>
  ) : null;

  // UI layer — outlines, grid and handles, above every hit area
  const uiLayer = !isPresentationMode ? (
    <div
      className="absolute"
      style={{ ...overlayBoxStyle, zIndex: UI_LAYER_Z + frame.zIndex }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        className="absolute"
        style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points={outlinePoints} />
          </clipPath>
        </defs>

        {/* Warped editing grid (Resolume-style) — clipped to the warped shape */}
        {warpGridLines.length > 0 && (
          <g clipPath={`url(#${clipId})`}>
            {warpGridLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(34, 211, 238, 0.45)"
                strokeWidth={ui}
              />
            ))}
          </g>
        )}

        {/* Corner-pin quad — differs from the outline for non-rectangular shapes */}
        {(showPins || editingShape) && frame.shape !== 'rectangle' && (
          <polygon
            points={pinQuad.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(249, 115, 22, 0.7)"
            strokeWidth={1.5 * ui}
            strokeDasharray={`${5 * ui} ${3 * ui}`}
          />
        )}

        {/* Shape outline — doubles as the selection highlight */}
        <polygon
          points={outlinePoints}
          fill="none"
          stroke={isSelected ? '#facc15' : 'rgba(59, 130, 246, 0.6)'}
          strokeWidth={(isSelected ? 3 : 1.5) * ui}
          strokeDasharray={isSelected ? undefined : `${6 * ui} ${4 * ui}`}
          strokeLinejoin="round"
        />
      </svg>

      {/* Perspective corner pins — visible on hover OR when selected */}
      {showPins &&
        (Object.entries(cornerPositions) as [keyof PerspectiveCorners, Point][]).map(([corner, pos]) => (
          <div
            key={corner}
            className="absolute cursor-move"
            style={{
              // Visible dot is 20×20 screen px; the touch target is padded to 44×44
              left: pos.x - 22 * ui,
              top: pos.y - 22 * ui,
              width: 44 * ui,
              height: 44 * ui,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
              pointerEvents: 'auto',
              zIndex: 3,
            }}
            onMouseDown={(e) => handleCornerPointerDown(corner, e)}
            onTouchStart={(e) => handleCornerPointerDown(corner, e)}
            title={`Corner pin: ${corner.toUpperCase()}`}
          >
            <div
              className="bg-orange-500 border-white rounded-sm hover:bg-orange-400 transition-colors"
              style={{
                width: 20 * ui,
                height: 20 * ui,
                borderWidth: 2 * ui,
                boxShadow: `0 0 0 ${2 * ui}px rgba(0,0,0,0.4)`,
              }}
            />
          </div>
        ))}

      {/* Resize handles — every shape, on the warped box */}
      {isSelected && resizeHandlePositions.map(({ handle, p }) => (
        <div
          key={handle}
          className="absolute bg-yellow-400 border-yellow-600 shadow-md"
          style={{
            left: p.x - 8 * ui,
            top: p.y - 8 * ui,
            width: 16 * ui,
            height: 16 * ui,
            borderWidth: 2 * ui,
            cursor: `${handle}-resize`,
            pointerEvents: 'auto',
            zIndex: 1,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, handle);
          }}
        />
      ))}

      {/* Polygon vertex handles — drawn where the vertex is rendered */}
      {showVertexHandles && frame.vertices?.map((vertex, index) => {
        const p = toWarped(vertex.x * w, vertex.y * h);
        return (
          <div
            key={`vertex-${index}`}
            className="absolute cursor-move"
            style={{
              left: p.x - 22 * ui,
              top: p.y - 22 * ui,
              width: 44 * ui,
              height: 44 * ui,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
              pointerEvents: 'auto',
              zIndex: 2,
            }}
            onMouseDown={(e) => handleVertexMouseDown(index, e)}
            onTouchStart={(e) => handleVertexMouseDown(index, e)}
            title={`Vertex ${index + 1}`}
          >
            <div
              className="bg-purple-500 border-purple-700 rounded-full shadow-md hover:bg-purple-400 transition-colors"
              style={{ width: 16 * ui, height: 16 * ui, borderWidth: 2 * ui }}
            />
          </div>
        );
      })}

      {/* Rotation handle — above the warped top edge */}
      {isSelected && (
        <div
          className="absolute bg-green-500 rounded-full border-white cursor-grab flex items-center justify-center shadow-lg"
          style={{
            left: rotateAnchor.x - 16 * ui,
            top: rotateAnchor.y - 56 * ui,
            width: 32 * ui,
            height: 32 * ui,
            borderWidth: 2 * ui,
            pointerEvents: 'auto',
            zIndex: 3,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onRotateStart(e);
          }}
        >
          <RotateCw className="text-white" style={{ width: 16 * ui, height: 16 * ui }} />
        </div>
      )}

      {/* Filename label under the shape */}
      {frame.url && frame.filename && (
        <div
          className="absolute bg-black/70 text-white px-2 py-0.5 rounded text-xs whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            left: outlineBounds.minX,
            top: outlineBounds.maxY + 4 * ui,
            maxWidth: 240,
            transform: `scale(${ui})`,
            transformOrigin: '0 0',
          }}
        >
          {frame.filename}
        </div>
      )}

      {/* Controls — anchored at the shape's top-right, upright and screen-sized */}
      {showControls && (
        <div
          className="absolute"
          style={{ left: outlineBounds.maxX - 8 * ui, top: outlineBounds.minY + 8 * ui, width: 0, height: 0, zIndex: 4 }}
        >
          <div
            className="absolute right-0 top-0 flex flex-row-reverse items-start gap-2"
            style={{ transform: `${counterRotation} scale(${ui})`, transformOrigin: 'top right', pointerEvents: 'auto' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                  setShowEffects(false);
                }}
                className="p-2 bg-black/70 hover:bg-black/90 text-white rounded backdrop-blur-sm transition-colors"
                title="Settings"
              >
                <Layers className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEffects(!showEffects);
                  setShowSettings(false);
                }}
                className="p-2 bg-black/70 hover:bg-black/90 text-white rounded backdrop-blur-sm transition-colors"
                title="Effects"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleChangeMedia();
                }}
                className="p-2 bg-black/70 hover:bg-black/90 text-white rounded backdrop-blur-sm transition-colors"
                title="Change Media"
              >
                <Upload className="w-4 h-4" />
              </button>

              {canToggleShapeEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingShape(!isEditingShape);
                  }}
                  className={`p-2 text-white rounded backdrop-blur-sm transition-colors ${editingShape ? 'bg-purple-600 hover:bg-purple-500' : 'bg-black/70 hover:bg-black/90'}`}
                  title={editingShape ? 'Back to corner pins (double-click shape)' : 'Edit shape vertices (double-click shape)'}
                >
                  <PenTool className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ testPattern: !frame.testPattern });
                }}
                className={`p-2 text-white rounded backdrop-blur-sm transition-colors ${frame.testPattern ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-black/70 hover:bg-black/90'}`}
                title={frame.testPattern ? 'Hide test pattern' : 'Show test pattern (calibrate this surface)'}
              >
                <LayoutTemplate className="w-4 h-4" />
              </button>

              {frame.type === 'video' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ muted: !frame.muted });
                  }}
                  className="p-2 bg-black/70 hover:bg-black/90 text-white rounded backdrop-blur-sm transition-colors"
                  title={frame.muted ? "Unmute" : "Mute"}
                >
                  {frame.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded backdrop-blur-sm transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div
                className="bg-black/90 text-white p-4 rounded-lg backdrop-blur-sm min-w-[220px] max-h-[400px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs mb-2 block">Opacity</label>
                    <Slider
                      value={[frame.opacity * 100]}
                      onValueChange={(value) => onUpdate({ opacity: value[0] / 100 })}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Content Scale/Zoom */}
                  <div className="pt-2 border-t border-white/20">
                    <label className="text-xs mb-2 block">Content Zoom</label>
                    <Slider
                      value={[contentScale * 100]}
                      onValueChange={(value) => onUpdate({ contentScale: value[0] / 100 })}
                      min={50}
                      max={300}
                      step={10}
                    />
                    <span className="text-xs text-gray-400">{Math.round(contentScale * 100)}%</span>
                  </div>

                  {contentScale > 1 && (
                    <>
                      <div>
                        <label className="text-xs mb-2 block">Pan X</label>
                        <Slider
                          value={[contentOffsetX]}
                          onValueChange={(value) => onUpdate({ contentOffsetX: value[0] })}
                          min={-50}
                          max={50}
                          step={1}
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-2 block">Pan Y</label>
                        <Slider
                          value={[contentOffsetY]}
                          onValueChange={(value) => onUpdate({ contentOffsetY: value[0] })}
                          min={-50}
                          max={50}
                          step={1}
                        />
                      </div>
                      <button
                        onClick={() => onUpdate({ contentScale: 1, contentOffsetX: 0, contentOffsetY: 0 })}
                        className="w-full py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
                      >
                        Reset Zoom
                      </button>
                    </>
                  )}

                  {frame.type === 'video' && (
                    <>
                      <div>
                        <label className="text-xs mb-2 block">Playback Speed</label>
                        <Slider
                          value={[frame.playbackRate * 100]}
                          onValueChange={(value) => onUpdate({ playbackRate: value[0] / 100 })}
                          min={25}
                          max={300}
                          step={25}
                        />
                        <span className="text-xs text-gray-400">{frame.playbackRate}x</span>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={frame.loop}
                            onChange={(e) => onUpdate({ loop: e.target.checked })}
                            className="rounded"
                          />
                          Loop Video
                        </label>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs mb-2 block">Shape</label>
                    <select
                      value={frame.shape}
                      onChange={(e) => {
                        const newShape = e.target.value as 'rectangle' | 'circle' | 'polygon';
                        // If switching to polygon without vertices, create default square polygon
                        if (newShape === 'polygon' && (!frame.vertices || frame.vertices.length < 3)) {
                          onUpdate({
                            shape: newShape,
                            vertices: [
                              { x: 0, y: 0 },
                              { x: 1, y: 0 },
                              { x: 1, y: 1 },
                              { x: 0, y: 1 },
                            ]
                          });
                        } else {
                          onUpdate({ shape: newShape });
                        }
                      }}
                      className="w-full bg-white/10 rounded px-2 py-1 text-xs"
                    >
                      <option value="rectangle">Rectangle</option>
                      <option value="circle">Circle</option>
                      <option value="polygon">Polygon</option>
                    </select>
                  </div>

                  {/* Media mapping for polygons — one model: the shape cuts,
                      the corner pin warps. A quad can hand its vertices to the
                      corner pin so the media stretches onto it. */}
                  {frame.shape === 'polygon' && (
                    <div>
                      <label className="text-xs mb-2 block">Media Mapping</label>
                      <p className="text-[10px] text-gray-400">
                        The polygon cuts the media; corner pin warps media and shape together.
                      </p>
                      {frame.vertices?.length === 4 && (
                        <>
                          <button
                            onClick={() => quadPin && onUpdate(quadPin)}
                            disabled={!quadPin}
                            className="w-full mt-2 p-2 rounded text-xs flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10"
                            title="Turn this quad into a corner-pinned surface whose pins sit on its 4 vertices"
                          >
                            <Move3D className="w-3 h-3" />
                            Stretch media onto quad
                          </button>
                          {!quadPin && (
                            <p className="text-[10px] text-gray-400 mt-1">The quad must be convex.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Perspective / Corner Pin */}
                  <div className="pt-2 border-t border-white/20">
                    <label className="text-xs mb-2 block font-medium text-orange-400 flex items-center gap-1">
                      <Grid3X3 className="w-3 h-3" />
                      Perspective Mapping
                    </label>
                    <button
                      onClick={() => onUpdate({ perspectiveMode: !frame.perspectiveMode })}
                      className={`w-full p-2 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                        frame.perspectiveMode ? 'bg-orange-600 hover:bg-orange-500' : 'bg-white/10 hover:bg-white/20'
                      }`}
                      title="Toggle perspective / corner-pin mode"
                    >
                      <Grid3X3 className="w-3 h-3" />
                      {frame.perspectiveMode ? 'Corner Pin Active' : 'Enable Corner Pin'}
                    </button>
                    {frame.perspectiveMode && (
                      <button
                        onClick={() =>
                          onUpdate({
                            perspectiveCorners: {
                              tl: { x: 0, y: 0 },
                              tr: { x: 0, y: 0 },
                              br: { x: 0, y: 0 },
                              bl: { x: 0, y: 0 },
                            },
                          })
                        }
                        className="w-full mt-1 py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
                      >
                        Reset Corners
                      </button>
                    )}
                    {frame.perspectiveMode && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Drag the orange handles to warp — the shape warps with the content, and handles snap to the grid when snapping is on.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/20">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <button
                        onClick={() => onUpdate({ lockAspectRatio: !frame.lockAspectRatio })}
                        className="flex items-center gap-1"
                      >
                        {frame.lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>Lock Aspect Ratio</span>
                      </button>
                    </label>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => onUpdate({ flipHorizontal: !frame.flipHorizontal })}
                      className={`flex-1 p-2 rounded text-xs flex items-center justify-center gap-1 ${frame.flipHorizontal ? 'bg-blue-600' : 'bg-white/10'}`}
                      title="Flip Horizontal"
                    >
                      <FlipHorizontal className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onUpdate({ flipVertical: !frame.flipVertical })}
                      className={`flex-1 p-2 rounded text-xs flex items-center justify-center gap-1 ${frame.flipVertical ? 'bg-blue-600' : 'bg-white/10'}`}
                      title="Flip Vertical"
                    >
                      <FlipVertical className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Effects Panel */}
            {showEffects && (
              <div
                className="bg-black/90 text-white p-4 rounded-lg backdrop-blur-sm min-w-[240px] max-h-[500px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Effects
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs mb-2 block">Blur</label>
                    <Slider
                      value={[frame.blur]}
                      onValueChange={(value) => onUpdate({ blur: value[0] })}
                      min={0}
                      max={20}
                      step={1}
                    />
                    <span className="text-xs text-gray-400">{frame.blur}px</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Brightness</label>
                    <Slider
                      value={[frame.brightness]}
                      onValueChange={(value) => onUpdate({ brightness: value[0] })}
                      min={0}
                      max={200}
                      step={5}
                    />
                    <span className="text-xs text-gray-400">{frame.brightness}%</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Contrast</label>
                    <Slider
                      value={[frame.contrast]}
                      onValueChange={(value) => onUpdate({ contrast: value[0] })}
                      min={0}
                      max={200}
                      step={5}
                    />
                    <span className="text-xs text-gray-400">{frame.contrast}%</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Saturation</label>
                    <Slider
                      value={[frame.saturate]}
                      onValueChange={(value) => onUpdate({ saturate: value[0] })}
                      min={0}
                      max={200}
                      step={5}
                    />
                    <span className="text-xs text-gray-400">{frame.saturate}%</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Grayscale</label>
                    <Slider
                      value={[frame.grayscale]}
                      onValueChange={(value) => onUpdate({ grayscale: value[0] })}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <span className="text-xs text-gray-400">{frame.grayscale}%</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Hue Rotate</label>
                    <Slider
                      value={[frame.hueRotate]}
                      onValueChange={(value) => onUpdate({ hueRotate: value[0] })}
                      min={0}
                      max={360}
                      step={10}
                    />
                    <span className="text-xs text-gray-400">{frame.hueRotate}°</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Invert</label>
                    <Slider
                      value={[frame.invert]}
                      onValueChange={(value) => onUpdate({ invert: value[0] })}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <span className="text-xs text-gray-400">{frame.invert}%</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Sepia</label>
                    <Slider
                      value={[frame.sepia]}
                      onValueChange={(value) => onUpdate({ sepia: value[0] })}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <span className="text-xs text-gray-400">{frame.sepia}%</span>
                  </div>

                  <div>
                    <label className="text-xs mb-2 block">Blend Mode</label>
                    <select
                      value={frame.blendMode}
                      onChange={(e) => onUpdate({ blendMode: e.target.value as BlendMode })}
                      className="w-full bg-white/10 rounded px-2 py-1 text-xs"
                    >
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="darken">Darken</option>
                      <option value="lighten">Lighten</option>
                      <option value="color-dodge">Color Dodge</option>
                      <option value="color-burn">Color Burn</option>
                      <option value="hard-light">Hard Light</option>
                      <option value="soft-light">Soft Light</option>
                      <option value="difference">Difference</option>
                      <option value="exclusion">Exclusion</option>
                      <option value="hue">Hue</option>
                      <option value="saturation">Saturation</option>
                      <option value="color">Color</option>
                      <option value="luminosity">Luminosity</option>
                    </select>
                  </div>

                  {/* Soft edge feathering for projection blending */}
                  <div className="pt-2 border-t border-white/20">
                    <label className="text-xs mb-2 block font-medium text-cyan-400">Soft Edge (blend)</label>
                    {(['left', 'right', 'top', 'bottom'] as const).map(edge => (
                      <div key={edge} className="mb-2">
                        <label className="text-xs mb-1 block capitalize">{edge}</label>
                        <Slider
                          value={[softEdge[edge]]}
                          onValueChange={(value) => onUpdate({ softEdge: { ...softEdge, [edge]: value[0] } })}
                          min={0}
                          max={Math.round((edge === 'left' || edge === 'right' ? frame.width : frame.height) / 2)}
                          step={1}
                        />
                        <span className="text-xs text-gray-400">{Math.round(softEdge[edge])}px</span>
                      </div>
                    ))}
                    {hasSoftEdge && (
                      <button
                        onClick={() => onUpdate({ softEdge: { left: 0, right: 0, top: 0, bottom: 0 } })}
                        className="w-full py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
                      >
                        Reset Soft Edge
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onUpdate({
                      blur: 0,
                      brightness: 100,
                      contrast: 100,
                      grayscale: 0,
                      saturate: 100,
                      hueRotate: 0,
                      invert: 0,
                      sepia: 0,
                      blendMode: 'normal',
                    })}
                    className="w-full py-2 bg-red-600/80 hover:bg-red-600 rounded text-xs"
                  >
                    Reset All Effects
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {renderContent && (
        <FrameContent
          frame={frame}
          playback={playback}
          outputGain={outputGain}
          showPlaceholder={!isPresentationMode && !frame.layerHasClips}
          preload={preload}
          startSeq={startSeq}
        />
      )}
      {overlayContainer && hitLayer && createPortal(hitLayer, overlayContainer)}
      {overlayContainer && uiLayer && createPortal(uiLayer, overlayContainer)}
    </>
  );
});
