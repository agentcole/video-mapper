import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import {
  Download,
  Upload,
  Save,
  Link,
  Square,
  Circle,
  Image as ImageIcon,
  Video,
  Pentagon,
  FolderOpen,
  Palette,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Grid3X3,
  Magnet,
  Package,
  MonitorOff,
  LayoutTemplate,
  Monitor,
} from 'lucide-react';
import type { ShapeType, GridSettings, CompositionSettings } from '../types';

interface ControlPanelProps {
  onAddUrl: (url: string, type: 'video' | 'image') => void;
  onSave: () => void;
  onExport: () => void;
  onExportWithMedia: () => void;
  onImport: (file: File) => void;
  onDrawMode: (shape: ShapeType) => void;
  isDrawMode: boolean;
  drawShape: ShapeType | null;
  onPresentationMode: () => void;
  onOpenMediaLibrary: () => void;
  onOpenBackgroundSettings: () => void;
  onPlayAll: () => void;
  onPauseAll: () => void;
  hasVideos: boolean;
  grid: GridSettings;
  onUpdateGrid: (updates: Partial<GridSettings>) => void;
  composition: CompositionSettings;
  onUpdateComposition: (updates: Partial<CompositionSettings>) => void;
  masterOpacity: number;
  onMasterOpacityChange: (value: number) => void;
  blackout: boolean;
  onToggleBlackout: () => void;
  showTestCard: boolean;
  onToggleTestCard: () => void;
}

const GRID_SIZES = [8, 16, 24, 32, 48, 64, 96, 128];

const COMPOSITION_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { label: '2560 × 1440 (QHD)', width: 2560, height: 1440 },
  { label: '3840 × 2160 (4K)', width: 3840, height: 2160 },
];

const clampDimension = (value: number) => Math.max(320, Math.min(8192, Math.round(value)));

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAddUrl,
  onSave,
  onExport,
  onExportWithMedia,
  onImport,
  onDrawMode,
  isDrawMode,
  drawShape,
  onPresentationMode,
  onOpenMediaLibrary,
  onOpenBackgroundSettings,
  onPlayAll,
  onPauseAll,
  hasVideos,
  grid,
  onUpdateGrid,
  composition,
  onUpdateComposition,
  masterOpacity,
  onMasterOpacityChange,
  blackout,
  onToggleBlackout,
  showTestCard,
  onToggleTestCard,
}) => {
  const [url, setUrl] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddUrl = () => {
    if (url.trim()) {
      onAddUrl(url.trim(), mediaType);
      setUrl('');
      setShowUrlInput(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div className={`fixed top-4 left-4 bg-black/80 backdrop-blur-md text-white rounded-lg shadow-2xl z-[1000] max-h-[calc(100vh-2rem)] overflow-y-auto transition-all duration-200 ${isMinimized ? 'p-2' : 'p-4 min-w-[280px]'}`}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <h2 className={`font-bold ${isMinimized ? 'text-sm' : 'text-lg'}`}>
          {isMinimized ? 'VM' : 'Video Mapper'}
        </h2>
        <button 
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
      
      {!isMinimized && (
      <div className="space-y-4 mt-4">
        {/* Draw Mode */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase font-semibold">Draw Frame</p>
          <div className="flex gap-2">
            <Button
              variant={isDrawMode && drawShape === 'rectangle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onDrawMode('rectangle')}
              className="flex-1"
              title="Rectangle"
            >
              <Square className="w-4 h-4" />
            </Button>
            <Button
              variant={isDrawMode && drawShape === 'circle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onDrawMode('circle')}
              className="flex-1"
              title="Circle"
            >
              <Circle className="w-4 h-4" />
            </Button>
            <Button
              variant={isDrawMode && drawShape === 'polygon' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onDrawMode('polygon')}
              className="flex-1"
              title="Polygon"
            >
              <Pentagon className="w-4 h-4" />
            </Button>
          </div>
          {isDrawMode && (
            <p className="text-xs text-blue-400">
              {drawShape === 'polygon' 
                ? 'Click to add vertices, double-click or click first point to close'
                : `Click and drag on canvas to create ${drawShape}`
              }
            </p>
          )}
        </div>

        {/* Add Media */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase font-semibold">Add Media</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMediaLibrary}
            className="w-full"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Media Library
          </Button>
          {!showUrlInput ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUrlInput(true)}
              className="w-full"
            >
              <Link className="w-4 h-4 mr-1" />
              Add from URL
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant={mediaType === 'video' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMediaType('video')}
                  className="flex-1"
                >
                  <Video className="w-4 h-4" />
                </Button>
                <Button
                  variant={mediaType === 'image' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMediaType('image')}
                  className="flex-1"
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
              <Input
                type="text"
                placeholder="Enter URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddUrl}
                  disabled={!url.trim()}
                  className="flex-1"
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowUrlInput(false);
                    setUrl('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Project Management */}
        <div className="space-y-2 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-semibold">Project</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportWithMedia}
            className="w-full"
            title="Export the project with all media files embedded (portable, but large)"
          >
            <Package className="w-4 h-4 mr-1" />
            Export + Media
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Playback Controls */}
        {hasVideos && (
          <div className="space-y-2 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 uppercase font-semibold">Playback</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPlayAll}
                className="flex-1"
                title="Play all videos"
              >
                <Play className="w-4 h-4 mr-1" />
                Play All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onPauseAll}
                className="flex-1"
                title="Pause all videos"
              >
                <Pause className="w-4 h-4 mr-1" />
                Pause All
              </Button>
            </div>
          </div>
        )}

        {/* Grid & Snapping */}
        <div className="space-y-2 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-semibold">Grid</p>
          <div className="flex gap-2">
            <Button
              variant={grid.show ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdateGrid({ show: !grid.show })}
              className="flex-1"
              title="Show grid (G)"
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Grid
            </Button>
            <Button
              variant={grid.snap ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdateGrid({ snap: !grid.snap })}
              className="flex-1"
              title="Snap to grid (Shift+G)"
            >
              <Magnet className="w-4 h-4 mr-1" />
              Snap
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Size</label>
            <select
              value={grid.size}
              onChange={(e) => onUpdateGrid({ size: Number(e.target.value) })}
              className="flex-1 bg-white/10 rounded px-2 py-1 text-xs"
            >
              {GRID_SIZES.map(size => (
                <option key={size} value={size} className="bg-gray-900">
                  {size} px
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={grid.showInPresentation}
              onChange={(e) => onUpdateGrid({ showInPresentation: e.target.checked })}
              className="rounded"
            />
            Keep visible in present mode (projector alignment)
          </label>
        </div>

        {/* Composition (output resolution) */}
        <div className="space-y-2 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            Composition
          </p>
          <select
            value={`${composition.width}x${composition.height}`}
            onChange={(e) => {
              const preset = COMPOSITION_PRESETS.find(p => `${p.width}x${p.height}` === e.target.value);
              if (preset) onUpdateComposition({ width: preset.width, height: preset.height });
            }}
            className="w-full bg-white/10 rounded px-2 py-1.5 text-xs"
          >
            {!COMPOSITION_PRESETS.some(p => p.width === composition.width && p.height === composition.height) && (
              <option value={`${composition.width}x${composition.height}`} className="bg-gray-900">
                {composition.width} × {composition.height} (custom)
              </option>
            )}
            {COMPOSITION_PRESETS.map(p => (
              <option key={p.label} value={`${p.width}x${p.height}`} className="bg-gray-900">
                {p.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={composition.width}
              min={320}
              max={8192}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) onUpdateComposition({ width: clampDimension(n) });
              }}
              className="w-full min-w-0 bg-white/10 rounded px-2 py-1 text-xs"
              title="Composition width (px)"
            />
            <span className="text-xs text-gray-500">×</span>
            <input
              type="number"
              value={composition.height}
              min={320}
              max={8192}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) onUpdateComposition({ height: clampDimension(n) });
              }}
              className="w-full min-w-0 bg-white/10 rounded px-2 py-1 text-xs"
              title="Composition height (px)"
            />
          </div>
        </div>

        {/* Output (live controls) */}
        <div className="space-y-2 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-semibold">Output</p>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Master — {Math.round(masterOpacity * 100)}%
            </label>
            <Slider
              value={[masterOpacity * 100]}
              onValueChange={(value) => onMasterOpacityChange(value[0] / 100)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={blackout ? 'destructive' : 'outline'}
              size="sm"
              onClick={onToggleBlackout}
              className="flex-1"
              title="Blackout — instantly hide all output (B)"
            >
              <MonitorOff className="w-4 h-4 mr-1" />
              {blackout ? 'Blackout ON' : 'Blackout'}
            </Button>
            <Button
              variant={showTestCard ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleTestCard}
              className="flex-1"
              title="Show the output test card for projector setup"
            >
              <LayoutTemplate className="w-4 h-4 mr-1" />
              Test Card
            </Button>
          </div>
        </div>

        {/* View & Background */}
        <div className="space-y-2 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-semibold">View</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenBackgroundSettings}
            className="w-full"
          >
            <Palette className="w-4 h-4 mr-1" />
            Background
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onPresentationMode}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Present (P)
          </Button>
        </div>

        {/* Instructions */}
        <div className="pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            <strong>Keyboard Shortcuts:</strong><br />
            • <strong>P</strong> - Present mode<br />
            • <strong>F</strong> - Fullscreen<br />
            • <strong>B</strong> - Blackout<br />
            • <strong>G</strong> / <strong>Shift+G</strong> - Grid / snap<br />
            • <strong>Del</strong> - Delete selection<br />
            • <strong>Arrows</strong> - Nudge (Shift = faster)<br />
            • <strong>Cmd/Ctrl+Z</strong> - Undo (Shift = redo)<br />
            • <strong>Cmd/Ctrl+C/X/V</strong> - Copy/cut/paste<br />
            • <strong>Cmd/Ctrl+D</strong> - Duplicate<br />
            • <strong>Cmd/Ctrl+A</strong> - Select all<br />
            • <strong>ESC</strong> - Exit mode/cancel/deselect<br />
            <br />
            <strong>Tips:</strong><br />
            • Rectangle/Circle: Click & drag<br />
            • Polygon: Click vertices, dbl-click to close<br />
            • Drag empty canvas to marquee-select<br />
            • Shift+click for multi-select<br />
            • Yellow handles to resize<br />
            • Green handle to rotate<br />
            • Purple handles to edit polygon vertices<br />
            • Hover a frame for its controls
          </p>
        </div>
      </div>
      )}
    </div>
  );
};

