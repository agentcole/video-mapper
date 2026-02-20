import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MediaFrame, Point, PerspectiveCorners } from '../types';
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
} from 'lucide-react';
import { Slider } from './ui/slider';

// ---------------------------------------------------------------------------
// Perspective / Homography utilities
// ---------------------------------------------------------------------------

/**
 * Solve an 8×8 linear system (A·x = b) via Gaussian elimination with partial
 * pivoting.  Returns null if the matrix is (near-)singular.
 */
function gaussianSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Augmented matrix [A | b]
  const mat = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[maxRow][col])) maxRow = row;
    }
    [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];
    if (Math.abs(mat[col][col]) < 1e-10) return null;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = mat[row][col] / mat[col][col];
      for (let k = col; k <= n; k++) mat[row][k] -= factor * mat[col][k];
    }
  }

  return mat.map((row, i) => row[n] / row[i]);
}

/**
 * Compute the 2-D projective transformation (homography) that maps four
 * source points to four destination points.
 *
 * src[i] and dst[i] are [x, y] pairs.
 *
 * Returns [h00, h01, h02, h10, h11, h12, h20, h21] with h22 = 1, or null on
 * failure.
 */
function computeHomography(
  src: [number, number][],
  dst: [number, number][]
): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    // Row for x
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    // Row for y
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  return gaussianSolve(A, b);
}

/**
 * Convert an 8-element homography vector (h22 = 1) to a CSS matrix3d() string.
 *
 * The homography H maps [x, y, 1]^T → [x', y', w']^T where the final point
 * is (x'/w', y'/w').  We embed it in a 4×4 column-major matrix for CSS:
 *
 *   matrix3d(h00, h10, 0, h20,
 *             h01, h11, 0, h21,
 *             0,   0,   1, 0,
 *             h02, h12, 0, 1)
 */
function homographyToCSS(h: number[]): string {
  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;
  return `matrix3d(${h00},${h10},0,${h20},${h01},${h11},0,${h21},0,0,1,0,${h02},${h12},0,1)`;
}

/**
 * Given a frame and its perspective corners (stored as pixel offsets from the
 * default rectangle corners), compute the CSS matrix3d transform that warps
 * the content element (width × height) to fill the quad.
 */
function getPerspectiveTransform(
  width: number,
  height: number,
  corners: PerspectiveCorners
): string | null {
  // Source: the element's own 4 corners in local pixels
  const src: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];

  // Destination: corner positions in the frame's local coordinate space
  const dst: [number, number][] = [
    [corners.tl.x, corners.tl.y],
    [width + corners.tr.x, corners.tr.y],
    [width + corners.br.x, height + corners.br.y],
    [corners.bl.x, height + corners.bl.y],
  ];

  const h = computeHomography(src, dst);
  if (!h) return null;
  return homographyToCSS(h);
}

/** Corner positions in the frame's local coordinate space (pixels). */
function getCornerLocalPositions(
  width: number,
  height: number,
  corners: PerspectiveCorners
) {
  return {
    tl: { x: corners.tl.x, y: corners.tl.y },
    tr: { x: width + corners.tr.x, y: corners.tr.y },
    br: { x: width + corners.br.x, y: height + corners.br.y },
    bl: { x: corners.bl.x, y: height + corners.bl.y },
  };
}

interface MediaFrameComponentProps {
  frame: MediaFrame;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<MediaFrame>) => void;
  onDelete: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
  onRotateStart: (e: React.MouseEvent) => void;
  isPresentationMode: boolean;
  onOpenMediaLibrary: () => void; // Open media library to change media for this frame
  playbackCommand: 'play' | 'pause' | null; // Global playback command
}

// Helper to convert normalized vertices to clip-path polygon string
const verticesToClipPath = (vertices: Point[] | undefined): string => {
  if (!vertices || vertices.length < 3) return 'none';
  const points = vertices.map(v => `${v.x * 100}% ${v.y * 100}%`).join(', ');
  return `polygon(${points})`;
};

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
        if (!currentFrame.vertices || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(1, (clientX - rect.left) / currentFrame.width));
        const newY = Math.max(0, Math.min(1, (clientY - rect.top) / currentFrame.height));

        const newVertices = [...currentFrame.vertices];
        newVertices[currentIndex] = { x: newX, y: newY };
        onUpdateRef.current({ vertices: newVertices });
        return;
      }

      // --- Corner dragging (perspective mode) ---
      const corner = draggingCornerRef.current;
      if (corner !== null) {
        const currentFrame = frameRef.current;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;

        const defaultX = corner === 'tl' || corner === 'bl' ? 0 : currentFrame.width;
        const defaultY = corner === 'tl' || corner === 'tr' ? 0 : currentFrame.height;

        const newOffset = { x: localX - defaultX, y: localY - defaultY };
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

  // Determine clip path based on shape / perspective mode
  const getClipPath = (): string => {
    if (frame.perspectiveMode) {
      // Clip to the quad defined by the 4 perspective corners (in local pixels)
      const cp = getCornerLocalPositions(frame.width, frame.height, frame.perspectiveCorners);
      return `polygon(${cp.tl.x}px ${cp.tl.y}px, ${cp.tr.x}px ${cp.tr.y}px, ${cp.br.x}px ${cp.br.y}px, ${cp.bl.x}px ${cp.bl.y}px)`;
    }
    if (frame.shape === 'circle') {
      return 'ellipse(50% 50% at 50% 50%)';
    }
    if (frame.shape === 'polygon' && frame.textureMode === 'clip') {
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

  // Build transform string for flips and content scale
  const contentScale = frame.contentScale ?? 1;
  const contentOffsetX = frame.contentOffsetX ?? 0;
  const contentOffsetY = frame.contentOffsetY ?? 0;

  const transformStyle = [
    frame.flipHorizontal ? 'scaleX(-1)' : '',
    frame.flipVertical ? 'scaleY(-1)' : '',
    contentScale !== 1 ? `scale(${contentScale})` : '',
    (contentOffsetX !== 0 || contentOffsetY !== 0) ? `translate(${contentOffsetX}%, ${contentOffsetY}%)` : '',
  ].filter(Boolean).join(' ');

  // Perspective transform (matrix3d) — computed when perspective mode is active
  const perspectiveTransform = frame.perspectiveMode
    ? getPerspectiveTransform(frame.width, frame.height, frame.perspectiveCorners)
    : null;

  // Corner positions for handle rendering
  const cornerPositions = frame.perspectiveMode
    ? getCornerLocalPositions(frame.width, frame.height, frame.perspectiveCorners)
    : null;

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
        // overflow must be visible when perspective mode is active so that
        // corner handles (which can be dragged outside the frame) are shown
        overflow: frame.perspectiveMode ? 'visible' : undefined,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media Content */}
      <div
        className={`w-full h-full relative overflow-hidden bg-gray-100 ${isPresentationMode ? '' : 'border-4 border-blue-500/50'}`}
        style={{
          clipPath: clipPathStyle,
          mixBlendMode: frame.blendMode,
        }}
        onMouseDown={onDragStart}
      >
        {frame.url ? (
          frame.type === 'video' ? (
            <video
              ref={videoRef}
              src={frame.url}
              loop={frame.loop}
              muted // Always muted for initial autoplay (browser requirement)
              autoPlay
              className="w-full h-full object-cover pointer-events-none"
              style={
                frame.perspectiveMode && perspectiveTransform
                  ? {
                      // Perspective mode: warp content to fill the quad
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transformOrigin: '0 0',
                      transform: perspectiveTransform,
                      filter: filterStyle || undefined,
                    }
                  : {
                      filter: filterStyle,
                      transform: transformStyle,
                    }
              }
              playsInline
            />
          ) : (
            <img
              src={frame.url}
              alt="Media"
              className="w-full h-full object-cover pointer-events-none"
              style={
                frame.perspectiveMode && perspectiveTransform
                  ? {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transformOrigin: '0 0',
                      transform: perspectiveTransform,
                      filter: filterStyle || undefined,
                    }
                  : {
                      filter: filterStyle,
                      transform: transformStyle,
                    }
              }
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

        {/* Polygon outline overlay (non-presentation mode) */}
        {frame.shape === 'polygon' && frame.vertices && !isPresentationMode && (
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
          {/* Quad outline */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <polygon
              points={[
                `${cornerPositions.tl.x},${cornerPositions.tl.y}`,
                `${cornerPositions.tr.x},${cornerPositions.tr.y}`,
                `${cornerPositions.br.x},${cornerPositions.br.y}`,
                `${cornerPositions.bl.x},${cornerPositions.bl.y}`,
              ].join(' ')}
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
          In perspective mode the four corner slots (nw/ne/sw/se) are occupied by
          the orange perspective-pin handles, so we only render the edge handles
          (n/s/e/w) to avoid overlap. All eight handles are shown otherwise. */}
      {isSelected && frame.shape !== 'polygon' && resizeHandles
        .filter(h => !frame.perspectiveMode || !['nw', 'ne', 'sw', 'se'].includes(h))
        .map((handle) => (
          <div
            key={handle}
            className={`absolute w-4 h-4 bg-yellow-400 border-2 border-yellow-600 cursor-${handle}-resize z-10 shadow-md`}
            style={{ ...getHandlePosition(handle) }}
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

            <div>
              <label className="text-xs mb-2 block">Z-Index</label>
              <Slider
                value={[frame.zIndex]}
                onValueChange={(value) => onUpdate({ zIndex: value[0] })}
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
                    title="Warp - Stretches media to fit polygon (experimental)"
                  >
                    <Move3D className="w-3 h-3" />
                    Warp
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {frame.textureMode === 'clip' 
                    ? 'Media is cut to polygon shape' 
                    : 'Media stretches to fit polygon (quad only)'}
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
                  Drag the orange handles to distort the content. Resize handles are disabled while corner pin is active.
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
                onChange={(e) => onUpdate({ blendMode: e.target.value as any })}
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

function getHandlePosition(handle: string): React.CSSProperties {
  const positions: Record<string, React.CSSProperties> = {
    nw: { top: -6, left: -6 },
    ne: { top: -6, right: -6 },
    sw: { bottom: -6, left: -6 },
    se: { bottom: -6, right: -6 },
    n: { top: -6, left: '50%', transform: 'translateX(-50%)' },
    s: { bottom: -6, left: '50%', transform: 'translateX(-50%)' },
    e: { right: -6, top: '50%', transform: 'translateY(-50%)' },
    w: { left: -6, top: '50%', transform: 'translateY(-50%)' },
  };
  return positions[handle] || {};
}

