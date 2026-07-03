import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MediaFrame, Point, PerspectiveCorners, BlendMode } from '../types';
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
  Scissors,
  Move3D,
  Grid3X3,
  LayoutTemplate,
} from 'lucide-react';
import { Slider } from './ui/slider';
import { TestCard } from './TestCard';
import {
  computeHomography,
  homographyToCSS,
  applyHomography,
  getPerspectiveHomography,
  getCornerLocalPositions,
  getShapeVertices,
  compToFrameLocal,
} from '../lib/geometry';

interface MediaFrameComponentProps {
  frame: MediaFrame;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<MediaFrame>) => void;
  onDelete: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
  onRotateStart: (e: React.MouseEvent) => void;
  isPresentationMode: boolean;
  onOpenMediaLibrary: () => void; // Open media library to change media for this frame
  playbackCommand: 'play' | 'pause' | null; // Global playback command
  clientToComp: (clientX: number, clientY: number) => Point; // pointer → composition coords
  snapToGrid: (value: number) => number; // identity when snapping is off
}

// Helper to convert normalized vertices to clip-path polygon string (percent)
const verticesToClipPath = (vertices: Point[] | undefined): string => {
  if (!vertices || vertices.length < 3) return 'none';
  const points = vertices.map(v => `${v.x * 100}% ${v.y * 100}%`).join(', ');
  return `polygon(${points})`;
};

// Number of subdivisions of the warped editing grid (Resolume-style)
const WARP_GRID_DIVISIONS = 8;

export const MediaFrameComponent: React.FC<MediaFrameComponentProps> = ({
  frame,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDragStart,
  onResizeStart,
  onRotateStart,
  isPresentationMode,
  onOpenMediaLibrary,
  playbackCommand,
  clientToComp,
  snapToGrid,
}) => {
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<keyof PerspectiveCorners | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Pointer → frame-local coords (handles stage scale AND frame rotation),
    // then snapped: against the composition grid when the frame is unrotated,
    // against local coords otherwise.
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
      const currentIndex = draggingVertexIndexRef.current;
      if (currentIndex !== null) {
        const currentFrame = frameRef.current;
        if (!currentFrame.vertices) return;

        const local = pointerToSnappedLocal(clientX, clientY);
        const newX = Math.max(0, Math.min(1, local.x / currentFrame.width));
        const newY = Math.max(0, Math.min(1, local.y / currentFrame.height));

        const newVertices = [...currentFrame.vertices];
        newVertices[currentIndex] = { x: newX, y: newY };
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
        onUpdateRef.current({ perspectiveCorners: newCorners });
      }
    };

    const handleUp = () => {
      if (draggingVertexIndexRef.current !== null) {
        setDraggingVertexIndex(null);
        draggingVertexIndexRef.current = null;
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

  // Handle video playback settings
  useEffect(() => {
    if (videoRef.current && frame.type === 'video') {
      videoRef.current.playbackRate = frame.playbackRate;
    }
  }, [frame.playbackRate, frame.type]);

  // Handle video muted state separately to avoid autoplay issues
  useEffect(() => {
    if (videoRef.current && frame.type === 'video') {
      videoRef.current.muted = frame.muted;
    }
  }, [frame.muted, frame.type]);

  // Auto-play video when URL changes or on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video || frame.type !== 'video' || !frame.url) return;

    const attemptPlay = async () => {
      try {
        // Ensure video is muted for autoplay (browser policy)
        video.muted = true;
        await video.play();
        // Restore muted state after successful autoplay
        video.muted = frame.muted;
      } catch (error) {
        console.warn('Autoplay failed, will play on user interaction:', error);
        // Try again with muted if unmuted failed
        if (!video.muted) {
          video.muted = true;
          video.play().catch(() => {});
        }
      }
    };

    // Try to play when video data is loaded
    const handleLoadedData = () => {
      attemptPlay();
    };

    // If video is already loaded, play immediately
    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      video.addEventListener('loadeddata', handleLoadedData);
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [frame.url, frame.type, frame.muted]);

  // Handle global playback commands (Play All / Pause All)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || frame.type !== 'video' || !playbackCommand) return;

    if (playbackCommand === 'play') {
      video.play().catch((error) => {
        console.warn('Play failed:', error);
        // Try muted play as fallback
        video.muted = true;
        video.play().catch(() => {});
      });
    } else if (playbackCommand === 'pause') {
      video.pause();
    }
  }, [playbackCommand, frame.type]);

  const handleMouseEnter = () => !isPresentationMode && setShowControls(true);
  const handleMouseLeave = () => {
    if (!isPresentationMode) {
      setShowControls(false);
      setShowSettings(false);
      setShowEffects(false);
    }
  };

  const handleChangeMedia = () => {
    onOpenMediaLibrary();
  };

  // -------------------------------------------------------------------------
  // Unified warp model (Photoshop-style: the shape stays, the texture warps)
  //
  // 1. Every shape is a set of normalized vertices (circle ≈ 48-gon).
  // 2. Corner-pin (perspectiveMode) defines a homography H for the whole frame.
  //    The shape's vertices are transformed through H, so the shape itself
  //    warps consistently — polygons/triangles keep straight edges.
  // 3. The content element gets a homography as a CSS matrix3d:
  //    - normally H itself;
  //    - a 4-vertex polygon in "warp" texture mode gets the homography that
  //      maps the frame rect onto its (possibly H-transformed) vertices.
  // 4. The clip-path is applied to the UNtransformed wrapper using the
  //    transformed vertex positions, so warp and shape compose.
  // -------------------------------------------------------------------------
  const w = frame.width;
  const h = frame.height;

  const perspH = frame.perspectiveMode
    ? getPerspectiveHomography(w, h, frame.perspectiveCorners)
    : null;

  const shapeVertices = getShapeVertices(frame.shape, frame.vertices);
  const shapeVerticesPx: Point[] = shapeVertices.map(v => {
    const px = { x: v.x * w, y: v.y * h };
    return perspH ? applyHomography(perspH, px.x, px.y) : px;
  });

  // Content homography: polygon quads in warp mode stretch the media onto the
  // quad; everything else warps with the frame's corner-pin homography.
  const isWarpQuad = frame.shape === 'polygon' && frame.textureMode === 'warp'
    && frame.vertices && frame.vertices.length === 4;
  let contentH: number[] | null = perspH;
  if (isWarpQuad) {
    contentH = computeHomography(
      [[0, 0], [w, 0], [w, h], [0, h]],
      shapeVerticesPx.slice(0, 4).map(p => [p.x, p.y] as [number, number])
    );
  }

  // Clip path on the wrapper (untransformed space)
  const getClipPath = (): string => {
    if (frame.perspectiveMode) {
      // All shapes clip to their homography-transformed outline
      return `polygon(${shapeVerticesPx.map(p => `${p.x}px ${p.y}px`).join(', ')})`;
    }
    if (frame.shape === 'circle') {
      return 'ellipse(50% 50% at 50% 50%)'; // exact ellipse when unwarped
    }
    if (frame.shape === 'polygon') {
      return verticesToClipPath(frame.vertices);
    }
    return 'none';
  };

  const clipPathStyle = getClipPath();

  // Build CSS filter string
  const filterStyle = [
    frame.blur > 0 ? `blur(${frame.blur}px)` : '',
    frame.brightness !== 100 ? `brightness(${frame.brightness}%)` : '',
    frame.contrast !== 100 ? `contrast(${frame.contrast}%)` : '',
    frame.grayscale > 0 ? `grayscale(${frame.grayscale}%)` : '',
    frame.saturate !== 100 ? `saturate(${frame.saturate}%)` : '',
    frame.hueRotate !== 0 ? `hue-rotate(${frame.hueRotate}deg)` : '',
    frame.invert > 0 ? `invert(${frame.invert}%)` : '',
    frame.sepia > 0 ? `sepia(${frame.sepia}%)` : '',
  ].filter(Boolean).join(' ');

  const contentScale = frame.contentScale ?? 1;
  const contentOffsetX = frame.contentOffsetX ?? 0;
  const contentOffsetY = frame.contentOffsetY ?? 0;

  // Content transform. With a homography the transform-origin is (0,0), so
  // flips/zoom are expressed relative to the frame box and composed AFTER the
  // homography (transform lists apply right-to-left).
  const buildContentTransform = (): string => {
    const parts: string[] = [];
    if (contentH) {
      parts.push(homographyToCSS(contentH));
      if (frame.flipHorizontal) parts.push(`translate(${w}px, 0px) scaleX(-1)`);
      if (frame.flipVertical) parts.push(`translate(0px, ${h}px) scaleY(-1)`);
      if (contentScale !== 1) parts.push(`translate(${w / 2}px, ${h / 2}px) scale(${contentScale}) translate(${-w / 2}px, ${-h / 2}px)`);
      if (contentOffsetX !== 0 || contentOffsetY !== 0) parts.push(`translate(${contentOffsetX}%, ${contentOffsetY}%)`);
    } else {
      if (frame.flipHorizontal) parts.push('scaleX(-1)');
      if (frame.flipVertical) parts.push('scaleY(-1)');
      if (contentScale !== 1) parts.push(`scale(${contentScale})`);
      if (contentOffsetX !== 0 || contentOffsetY !== 0) parts.push(`translate(${contentOffsetX}%, ${contentOffsetY}%)`);
    }
    return parts.join(' ');
  };

  // Soft edge feathering — masks the content element itself, so the feather
  // warps together with the content under a corner-pin homography.
  const softEdge = frame.softEdge ?? { left: 0, right: 0, top: 0, bottom: 0 };
  const hasSoftEdge = softEdge.left > 0 || softEdge.right > 0 || softEdge.top > 0 || softEdge.bottom > 0;
  const softEdgeMask = hasSoftEdge
    ? [
        `linear-gradient(to right, transparent 0px, black ${softEdge.left}px, black calc(100% - ${softEdge.right}px), transparent 100%)`,
        `linear-gradient(to bottom, transparent 0px, black ${softEdge.top}px, black calc(100% - ${softEdge.bottom}px), transparent 100%)`,
      ].join(', ')
    : undefined;

  const contentStyle: React.CSSProperties = {
    ...(contentH
      ? {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transformOrigin: '0 0',
        }
      : {}),
    filter: filterStyle || undefined,
    transform: buildContentTransform() || undefined,
    ...(softEdgeMask
      ? {
          maskImage: softEdgeMask,
          maskComposite: 'intersect',
          WebkitMaskImage: softEdgeMask,
          WebkitMaskComposite: 'source-in',
        }
      : {}),
  };

  // Corner positions for perspective handle rendering
  const cornerPositions = frame.perspectiveMode
    ? getCornerLocalPositions(w, h, frame.perspectiveCorners)
    : null;

  // Warped editing grid lines (homographies map straight lines to straight
  // lines, so each grid line is a segment between transformed endpoints)
  const warpGridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (frame.perspectiveMode && !isPresentationMode && (isSelected || showControls)) {
    const gh = contentH ?? perspH;
    const map = (x: number, y: number): Point => gh ? applyHomography(gh, x, y) : { x, y };
    for (let i = 1; i < WARP_GRID_DIVISIONS; i++) {
      const f = i / WARP_GRID_DIVISIONS;
      const v1 = map(f * w, 0);
      const v2 = map(f * w, h);
      warpGridLines.push({ x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y });
      const h1 = map(0, f * h);
      const h2 = map(w, f * h);
      warpGridLines.push({ x1: h1.x, y1: h1.y, x2: h2.x, y2: h2.y });
    }
  }

  // Counter-rotation for UI elements to keep them upright
  const counterRotation = `rotate(${-frame.rotation}deg)`;

  const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div
      ref={containerRef}
      className="absolute group"
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        transform: `rotate(${frame.rotation}deg)`,
        zIndex: frame.zIndex,
        opacity: frame.opacity,
        pointerEvents: 'auto',
        // overflow must be visible when perspective mode is active so that
        // corner handles (which can be dragged outside the frame) are shown
        overflow: frame.perspectiveMode ? 'visible' : undefined,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media Content */}
      <div
        className={`w-full h-full relative ${isPresentationMode ? '' : 'border-4 border-blue-500/50'}`}
        style={{
          clipPath: clipPathStyle,
          mixBlendMode: frame.blendMode,
          // Perspective content may extend beyond the frame box — the
          // clip-path (which follows the warped shape) does the clipping.
          overflow: frame.perspectiveMode ? 'visible' : 'hidden',
          backgroundColor: frame.url || frame.testPattern ? undefined : 'rgb(243 244 246)',
        }}
        onMouseDown={onDragStart}
      >
        {frame.testPattern ? (
          <div className="w-full h-full pointer-events-none" style={contentStyle}>
            <TestCard
              width={frame.width}
              height={frame.height}
              label={frame.name || frame.filename || `${Math.round(frame.width)} × ${Math.round(frame.height)}`}
            />
          </div>
        ) : frame.url ? (
          frame.type === 'video' ? (
            <video
              ref={videoRef}
              src={frame.url}
              loop={frame.loop}
              muted // Always muted for initial autoplay (browser requirement)
              autoPlay
              className="w-full h-full object-cover pointer-events-none"
              style={contentStyle}
              playsInline
            />
          ) : (
            <img
              src={frame.url}
              alt="Media"
              className="w-full h-full object-cover pointer-events-none"
              style={contentStyle}
              draggable={false}
            />
          )
        ) : (
          <div
            className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 cursor-pointer hover:from-gray-300 hover:to-gray-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMediaLibrary();
            }}
          >
            <div className="text-center text-gray-500">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Click to add media</p>
              <p className="text-xs mt-1">from library</p>
            </div>
          </div>
        )}

        {/* Warped editing grid (Resolume-style) — clipped to the warped shape */}
        {warpGridLines.length > 0 && (
          <svg
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            {warpGridLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(34, 211, 238, 0.45)"
                strokeWidth="1"
              />
            ))}
          </svg>
        )}

        {/* Polygon outline overlay (non-presentation mode) */}
        {frame.shape === 'polygon' && frame.vertices && !isPresentationMode && !frame.perspectiveMode && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <polygon
              points={frame.vertices.map(v => `${v.x * frame.width},${v.y * frame.height}`).join(' ')}
              fill="none"
              stroke="rgba(168, 85, 247, 0.5)"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          </svg>
        )}

        {/* Filename Display */}
        {frame.url && frame.filename && !isPresentationMode && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white px-2 py-1 text-xs truncate backdrop-blur-sm">
            {frame.filename}
          </div>
        )}

        {/* Selection Border */}
        {isSelected && (
          <div className="absolute inset-0 border-4 border-yellow-400 pointer-events-none shadow-lg" />
        )}
      </div>

      {/* Perspective Corner Handles — visible on hover OR when selected */}
      {(showControls || isSelected) && frame.perspectiveMode && cornerPositions && !isPresentationMode && (
        <>
          {/* Warped shape outline */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <polygon
              points={shapeVerticesPx.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(249, 115, 22, 0.7)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
          </svg>

          {(Object.entries(cornerPositions) as [keyof PerspectiveCorners, { x: number; y: number }][]).map(
            ([corner, pos]) => (
              <div
                key={corner}
                className="absolute z-30 cursor-move"
                style={{
                  // Visible dot is 20×20; the clickable/touchable area is padded to 44×44
                  // so it meets mobile touch-target guidelines without looking bulky
                  left: pos.x - 22,
                  top: pos.y - 22,
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'none',
                }}
                onMouseDown={(e) => handleCornerPointerDown(corner, e)}
                onTouchStart={(e) => handleCornerPointerDown(corner, e)}
                title={`Corner pin: ${corner.toUpperCase()}`}
              >
                {/* Visual dot */}
                <div
                  className="w-5 h-5 bg-orange-500 border-2 border-white rounded-sm shadow-lg hover:bg-orange-400 transition-colors"
                  style={{ boxShadow: '0 0 0 2px rgba(0,0,0,0.4)' }}
                />
              </div>
            )
          )}
        </>
      )}

      {/* Resize Handles
          In perspective mode the corner resize handles (nw/ne/sw/se) are shifted
          further outside the frame so they don't overlap the orange perspective
          corner handles that sit exactly on the corners. */}
      {isSelected && frame.shape !== 'polygon' && resizeHandles.map((handle) => (
        <div
          key={handle}
          className={`absolute w-4 h-4 bg-yellow-400 border-2 border-yellow-600 cursor-${handle}-resize z-10 shadow-md`}
          style={getHandlePosition(handle, frame.perspectiveMode)}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, handle);
          }}
        />
      ))}

      {/* Polygon Vertex Handles */}
      {isSelected && frame.shape === 'polygon' && frame.vertices && frame.vertices.map((vertex, index) => (
        <div
          key={`vertex-${index}`}
          className="absolute z-20 cursor-move"
          style={{
            left: vertex.x * frame.width - 22,
            top: vertex.y * frame.height - 22,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
          }}
          onMouseDown={(e) => handleVertexMouseDown(index, e)}
          onTouchStart={(e) => handleVertexMouseDown(index, e)}
          title={`Vertex ${index + 1}`}
        >
          <div className="w-4 h-4 bg-purple-500 border-2 border-purple-700 rounded-full shadow-md hover:bg-purple-400 transition-colors" />
        </div>
      ))}

      {/* Rotation Handle */}
      {isSelected && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-green-500 rounded-full border-2 border-white cursor-grab flex items-center justify-center shadow-lg"
          onMouseDown={(e) => {
            e.stopPropagation();
            onRotateStart(e);
          }}
        >
          <RotateCw className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Control Overlay - Counter-rotated to stay upright */}
      {showControls && (
        <div
          className="absolute top-2 right-2 flex flex-col gap-1 z-20"
          style={{ transform: counterRotation, transformOrigin: 'top right' }}
        >
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
      )}

      {/* Settings Panel - Counter-rotated to stay upright */}
      {showSettings && showControls && (
        <div
          className="absolute top-2 right-14 bg-black/90 text-white p-4 rounded-lg backdrop-blur-sm min-w-[220px] max-h-[400px] overflow-y-auto z-20"
          style={{ transform: counterRotation, transformOrigin: 'top right' }}
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

            {/* Texture Mode for Polygons */}
            {frame.shape === 'polygon' && (
              <div>
                <label className="text-xs mb-2 block">Texture Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdate({ textureMode: 'clip' })}
                    className={`flex-1 p-2 rounded text-xs flex items-center justify-center gap-1 ${
                      frame.textureMode === 'clip' ? 'bg-blue-600' : 'bg-white/10'
                    }`}
                    title="Clip - Cuts media to polygon shape"
                  >
                    <Scissors className="w-3 h-3" />
                    Clip
                  </button>
                  <button
                    onClick={() => onUpdate({ textureMode: 'warp' })}
                    className={`flex-1 p-2 rounded text-xs flex items-center justify-center gap-1 ${
                      frame.textureMode === 'warp' ? 'bg-blue-600' : 'bg-white/10'
                    }`}
                    title="Warp - Stretches media to fit the polygon (4-vertex polygons)"
                  >
                    <Move3D className="w-3 h-3" />
                    Warp
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {frame.textureMode === 'clip'
                    ? 'Media is cut to polygon shape'
                    : frame.vertices?.length === 4
                      ? 'Media stretches to fill the quad'
                      : 'Warp needs exactly 4 vertices — falls back to clip'}
                </p>
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

      {/* Effects Panel - Counter-rotated to stay upright */}
      {showEffects && showControls && (
        <div
          className="absolute top-2 right-14 bg-black/90 text-white p-4 rounded-lg backdrop-blur-sm min-w-[240px] max-h-[500px] overflow-y-auto z-20"
          style={{ transform: counterRotation, transformOrigin: 'top right' }}
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
  );
};

function getHandlePosition(handle: string, perspectiveMode = false): React.CSSProperties {
  // In perspective mode the orange corner handles sit at -10 px from each corner
  // (centred on the corner).  To keep the yellow resize handles reachable we push
  // them an extra 16 px further outside so both sets are independently clickable.
  const cornerOffset = perspectiveMode ? -26 : -6;
  const positions: Record<string, React.CSSProperties> = {
    nw: { top: cornerOffset, left: cornerOffset },
    ne: { top: cornerOffset, right: cornerOffset },
    sw: { bottom: cornerOffset, left: cornerOffset },
    se: { bottom: cornerOffset, right: cornerOffset },
    n: { top: -6, left: '50%', transform: 'translateX(-50%)' },
    s: { bottom: -6, left: '50%', transform: 'translateX(-50%)' },
    e: { right: -6, top: '50%', transform: 'translateY(-50%)' },
    w: { left: -6, top: '50%', transform: 'translateY(-50%)' },
  };
  return positions[handle] || {};
}
