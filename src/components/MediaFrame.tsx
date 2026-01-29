import React, { useRef, useEffect, useState } from 'react';
import type { MediaFrame } from '../types';
import { 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Trash2, 
  Volume2, 
  VolumeX,
  Gauge,
  Layers,
  Upload,
  Sparkles,
  FlipHorizontal,
  FlipVertical,
  Lock,
  Unlock
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
}

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
}) => {
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('image/'))) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      onUpdate({ url, type, filename: file.name });
    }
    e.target.value = ''; // Reset input
  };

  const handleChangeMedia = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file && (file.type.startsWith('video/') || file.type.startsWith('image/'))) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      onUpdate({ url, type, filename: file.name });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clipPathStyle = frame.shape === 'circle' 
    ? 'ellipse(50% 50% at 50% 50%)' 
    : 'none';

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

  // Build transform string for flips
  const transformStyle = [
    frame.flipHorizontal ? 'scaleX(-1)' : '',
    frame.flipVertical ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ');

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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <div className="text-center text-gray-500">
              <p className="text-sm font-medium">Drop media here</p>
              <p className="text-xs mt-1">or add URL</p>
            </div>
          </div>
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

      {/* Resize Handles */}
      {isSelected && resizeHandles.map((handle) => (
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

      {/* Control Overlay */}
      {showControls && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-20">
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

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Settings Panel */}
      {showSettings && showControls && (
        <div 
          className="absolute top-2 right-14 bg-black/90 text-white p-4 rounded-lg backdrop-blur-sm min-w-[200px] z-20"
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
                onChange={(e) => onUpdate({ shape: e.target.value as 'rectangle' | 'circle' })}
                className="w-full bg-white/10 rounded px-2 py-1 text-xs"
              >
                <option value="rectangle">Rectangle</option>
                <option value="circle">Circle</option>
              </select>
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
      {showEffects && showControls && (
        <div 
          className="absolute top-2 right-14 bg-black/90 text-white p-4 rounded-lg backdrop-blur-sm min-w-[240px] max-h-[500px] overflow-y-auto z-20"
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

