import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MediaFrame, Point } from '../types';
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
} from 'lucide-react';
import { Slider } from './ui/slider';

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
}) => {
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs to avoid stale closures in event handlers
  const draggingVertexIndexRef = useRef<number | null>(null);
  const frameRef = useRef(frame);
  const onUpdateRef = useRef(onUpdate);
  
  // Keep refs in sync
  useEffect(() => {
    draggingVertexIndexRef.current = draggingVertexIndex;
  }, [draggingVertexIndex]);
  
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Handle vertex drag for polygon editing
  const handleVertexMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingVertexIndex(index);
  }, []);

  // Global mouse move/up handlers for vertex dragging - always attached when dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const currentIndex = draggingVertexIndexRef.current;
      if (currentIndex === null) return;
      
      const currentFrame = frameRef.current;
      if (!currentFrame.vertices || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      // Calculate new normalized position
      const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / currentFrame.width));
      const newY = Math.max(0, Math.min(1, (e.clientY - rect.top) / currentFrame.height));

      const newVertices = [...currentFrame.vertices];
      newVertices[currentIndex] = { x: newX, y: newY };
      onUpdateRef.current({ vertices: newVertices });
    };

    const handleMouseUp = () => {
      if (draggingVertexIndexRef.current !== null) {
        setDraggingVertexIndex(null);
        draggingVertexIndexRef.current = null;
      }
    };

    // Always add listeners - they check the ref internally
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // Empty dependency - handlers use refs

  useEffect(() => {
    if (videoRef.current && frame.type === 'video') {
      videoRef.current.playbackRate = frame.playbackRate;
      videoRef.current.muted = frame.muted;
      if (frame.loop) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [frame.playbackRate, frame.muted, frame.loop, frame.type]);

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

  // Determine clip path based on shape and texture mode
  const getClipPath = (): string => {
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
              muted={frame.muted}
              className="w-full h-full object-cover pointer-events-none"
              style={{
                filter: filterStyle,
                transform: transformStyle,
              }}
              playsInline
            />
          ) : (
            <img
              src={frame.url}
              alt="Media"
              className="w-full h-full object-cover pointer-events-none"
              style={{
                filter: filterStyle,
                transform: transformStyle,
              }}
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

      {/* Resize Handles (not for polygons) */}
      {isSelected && frame.shape !== 'polygon' && resizeHandles.map((handle) => (
        <div
          key={handle}
          className={`absolute w-4 h-4 bg-yellow-400 border-2 border-yellow-600 cursor-${handle}-resize z-10 shadow-md`}
          style={{
            ...getHandlePosition(handle),
          }}
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
          className="absolute w-4 h-4 bg-purple-500 border-2 border-purple-700 rounded-full cursor-move z-20 shadow-md hover:bg-purple-400 transition-colors"
          style={{
            left: vertex.x * frame.width - 8,
            top: vertex.y * frame.height - 8,
          }}
          onMouseDown={(e) => handleVertexMouseDown(index, e)}
          title={`Vertex ${index + 1}`}
        />
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

