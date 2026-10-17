import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { divider, field, iconButton, option, panelSurface, panelTitle, sectionLabel } from './ui/theme';
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
  FolderKanban,
  ChevronsUpDown,
  Clapperboard,
  Play,
  Pause,
  Grid3X3,
  Magnet,
  Package,
  MonitorOff,
  LayoutTemplate,
  Monitor,
  Zap,
} from 'lucide-react';
import type { ShapeType, GridSettings, CompositionSettings } from '../types';
import { OutputWindowControls } from './OutputWindowControls';

interface ControlPanelProps {
  onAddUrl: (url: string, type: 'video' | 'image') => void;
  projectName: string;
  onOpenProjects: () => void;
  onSaveVersion: () => void;
  onExport: () => void;
  onExportPackage: () => void;
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
  isLauncherOpen: boolean;
  onToggleLauncher: () => void;
}

const GRID_SIZES = [8, 16, 24, 32, 48, 64, 96, 128];

const COMPOSITION_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { label: '2560 × 1440 (QHD)', width: 2560, height: 1440 },
  { label: '3840 × 2160 (4K)', width: 3840, height: 2160 },
];

const clampDimension = (value: number) => Math.max(320, Math.min(8192, Math.round(value)));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl+';
const SHIFT = isMac ? '⇧' : 'Shift+';

// Key combos are separated by " / "
const SHORTCUTS: [string, string][] = [
  ['P', 'Present mode'],
  ['F', 'Fullscreen'],
  ['B', 'Blackout'],
  ['1–9', 'Play column'],
  [`${SHIFT}1–9`, 'Cue column'],
  ['Space', 'Go (fire the cue)'],
  ['Alt', '+ trigger: fire now, skip beat snap'],
  [`T / ${SHIFT}T`, 'Tap tempo / resync bar'],
  ['L', 'Clip launcher'],
  [`G / ${SHIFT}G`, 'Grid / snap'],
  ['Del', 'Delete selection'],
  ['Arrows', `Nudge (${SHIFT.replace('+', '')} = grid steps)`],
  [`${MOD}Z / ${SHIFT}${MOD}Z`, 'Undo / redo'],
  [`${MOD}C / ${MOD}X / ${MOD}V`, 'Copy / cut / paste'],
  [`${MOD}D`, 'Duplicate'],
  [`${MOD}A`, 'Select all'],
  [`${MOD}S`, 'Save a version'],
  ['Esc', 'Exit mode / cancel / deselect'],
];

const TIPS = [
  'Rectangle / circle: click and drag',
  'Polygon: click vertices, double-click to close',
  'Drag on empty stage to marquee-select, Shift+click to add',
  'Yellow handles resize, green rotates, purple edits vertices',
  'Hover a frame for its controls',
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAddUrl,
  projectName,
  onOpenProjects,
  onSaveVersion,
  onExport,
  onExportPackage,
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
  isLauncherOpen,
  onToggleLauncher,
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
    <div
      className={`fixed top-4 left-4 ${panelSurface} z-[1000] overflow-y-auto ${isMinimized ? 'w-auto' : 'w-64'}`}
      style={{ maxHeight: 'calc(100vh - 2rem - var(--launcher-height, 0px))' }}
    >
      <div
        className="flex items-center justify-between gap-2 p-3 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <h2 className={panelTitle}>
          <Clapperboard className="w-4 h-4" />
          {!isMinimized && 'Video Mapper'}
        </h2>
        <button className={iconButton} title={isMinimized ? 'Expand' : 'Minimize'}>
          <ChevronsUpDown className="w-4 h-4" />
        </button>
      </div>

      {!isMinimized && (
      <div className="space-y-3 px-3 pb-3">
        {/* Draw Mode */}
        <div className="space-y-2">
          <p className={sectionLabel}>Draw Frame</p>
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
            <p className="text-[11px] text-cyan-300">
              {drawShape === 'polygon' 
                ? 'Click to add vertices, double-click or click first point to close'
                : `Click and drag on canvas to create ${drawShape}`
              }
            </p>
          )}
        </div>

        {/* Add Media */}
        <div className="space-y-2">
          <p className={sectionLabel}>Add Media</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMediaLibrary}
            className="w-full"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Media Library
          </Button>
          <Button
            variant={isLauncherOpen ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleLauncher}
            className="w-full"
            title="Layers × columns of clips (L)"
          >
            <Zap className="w-4 h-4 mr-1" />
            Clip Launcher
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
        <div className={`space-y-2 pt-3 border-t ${divider}`}>
          <p className={sectionLabel}>Project</p>
          <button
            onClick={onOpenProjects}
            className="w-full flex items-center gap-2 rounded bg-white/10 hover:bg-white/20 px-2 py-1.5 text-left text-xs transition-colors"
            title="All projects and versions"
          >
            <FolderKanban className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="flex-1 font-semibold truncate">{projectName}</span>
            <span className="text-[10px] text-gray-400">Projects…</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveVersion}
              title="Save a version you can go back to (Cmd/Ctrl+S) — changes are autosaved anyway"
            >
              <Save className="w-4 h-4 mr-1" />
              Version
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              title="Import a project file or package as a new project"
            >
              <Upload className="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              title="Export the project file (media stays on this machine)"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPackage}
              title="Export a portable package (zip) with all media files"
            >
              <Package className="w-4 h-4 mr-1" />
              Package
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Playback Controls */}
        {hasVideos && (
          <div className={`space-y-2 pt-3 border-t ${divider}`}>
            <p className={sectionLabel}>Playback</p>
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
        <div className={`space-y-2 pt-3 border-t ${divider}`}>
          <p className={sectionLabel}>Grid</p>
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
              className={`flex-1 ${field}`}
            >
              {GRID_SIZES.map(size => (
                <option key={size} value={size} className={option}>
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
              className="accent-cyan-400"
            />
            Keep visible in present mode (projector alignment)
          </label>
        </div>

        {/* Composition (output resolution) */}
        <div className={`space-y-2 pt-3 border-t ${divider}`}>
          <p className={`${sectionLabel} flex items-center gap-1`}>
            <Monitor className="w-3 h-3" />
            Composition
          </p>
          <select
            value={`${composition.width}x${composition.height}`}
            onChange={(e) => {
              const preset = COMPOSITION_PRESETS.find(p => `${p.width}x${p.height}` === e.target.value);
              if (preset) onUpdateComposition({ width: preset.width, height: preset.height });
            }}
            className={`w-full ${field}`}
          >
            {!COMPOSITION_PRESETS.some(p => p.width === composition.width && p.height === composition.height) && (
              <option value={`${composition.width}x${composition.height}`} className={option}>
                {composition.width} × {composition.height} (custom)
              </option>
            )}
            {COMPOSITION_PRESETS.map(p => (
              <option key={p.label} value={`${p.width}x${p.height}`} className={option}>
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
              className={`w-full min-w-0 tabular-nums ${field}`}
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
              className={`w-full min-w-0 tabular-nums ${field}`}
              title="Composition height (px)"
            />
          </div>
        </div>

        {/* Output (live controls) */}
        <div className={`space-y-2 pt-3 border-t ${divider}`}>
          <p className={sectionLabel}>Output</p>
          <div>
            <label className="text-[11px] text-gray-400 mb-1.5 flex justify-between">
              Master <span className="tabular-nums text-white">{Math.round(masterOpacity * 100)}%</span>
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
          <OutputWindowControls />
        </div>

        {/* View & Background */}
        <div className={`space-y-2 pt-3 border-t ${divider}`}>
          <p className={sectionLabel}>View</p>
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
            variant="outline"
            size="sm"
            onClick={onPresentationMode}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Present (P)
          </Button>
          <a
            href="?benchmark"
            target="_blank"
            rel="noopener"
            className="block text-center text-[11px] text-gray-400 hover:text-white underline"
            title="How many video layers does this machine play smoothly?"
          >
            Performance benchmark
          </a>
        </div>

        {/* Keyboard shortcuts and tips */}
        <details className={`pt-3 border-t ${divider} group`}>
          <summary className={`${sectionLabel} cursor-pointer select-none list-none flex items-center justify-between hover:text-white`}>
            Shortcuts & tips
            <ChevronsUpDown className="w-3 h-3" />
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] text-gray-400">
            {SHORTCUTS.map(([keys, label]) => (
              <React.Fragment key={keys}>
                <dt className="text-right">
                  {keys.split(' / ').map(k => (
                    <kbd key={k} className="ml-0.5 px-1 rounded bg-white/10 text-[10px] text-white font-sans">{k}</kbd>
                  ))}
                </dt>
                <dd>{label}</dd>
              </React.Fragment>
            ))}
          </dl>
          <ul className="mt-3 space-y-0.5 text-[11px] text-gray-500">
            {TIPS.map(tip => <li key={tip}>{tip}</li>)}
          </ul>
        </details>
      </div>
      )}
    </div>
  );
};

