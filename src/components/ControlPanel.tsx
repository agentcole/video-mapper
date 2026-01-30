import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
} from 'lucide-react';
import type { ShapeType } from '../types';

interface ControlPanelProps {
  onAddUrl: (url: string, type: 'video' | 'image') => void;
  onSave: () => void;
  onExport: () => void;
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
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAddUrl,
  onSave,
  onExport,
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
    <div className={`fixed top-4 left-4 bg-black/80 backdrop-blur-md text-white rounded-lg shadow-2xl z-50 transition-all duration-200 ${isMinimized ? 'p-2' : 'p-4 min-w-[280px]'}`}>
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
            • <strong>ESC</strong> - Exit mode/cancel draw<br />
            <br />
            <strong>Tips:</strong><br />
            • Rectangle/Circle: Click & drag<br />
            • Polygon: Click vertices, dbl-click to close<br />
            • Drag frames to move<br />
            • Blue handles to resize<br />
            • Green handle to rotate<br />
            • Purple handles to edit polygon vertices<br />
            • Hover for controls
          </p>
        </div>
      </div>
      )}
    </div>
  );
};

