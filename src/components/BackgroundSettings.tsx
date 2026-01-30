import React, { useRef } from 'react';
import type { BackgroundSettings } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Palette,
  Image as ImageIcon,
  Video,
  X,
  FolderOpen,
} from 'lucide-react';

interface BackgroundSettingsProps {
  background: BackgroundSettings;
  onUpdate: (settings: BackgroundSettings) => void;
  onOpenMediaLibrary: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#1e293b', // Slate-800
  '#0f172a', // Slate-900
  '#18181b', // Zinc-900
  '#171717', // Neutral-900
  '#1c1917', // Stone-900
  '#ffffff', // White
  '#ef4444', // Red-500
  '#22c55e', // Green-500
  '#3b82f6', // Blue-500
  '#a855f7', // Purple-500
  '#f97316', // Orange-500
];

export const BackgroundSettingsPanel: React.FC<BackgroundSettingsProps> = ({
  background,
  onUpdate,
  onOpenMediaLibrary,
  isOpen,
  onClose,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 left-[300px] bg-black/90 text-white p-4 rounded-lg shadow-2xl z-50 min-w-[280px] backdrop-blur-md border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Background Settings
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Type Selection */}
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase font-semibold">Type</p>
        <div className="flex gap-2">
          <Button
            variant={background.type === 'color' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ ...background, type: 'color' })}
            className="flex-1"
          >
            <Palette className="w-4 h-4 mr-1" />
            Color
          </Button>
          <Button
            variant={background.type === 'image' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ ...background, type: 'image' })}
            className="flex-1"
          >
            <ImageIcon className="w-4 h-4 mr-1" />
            Image
          </Button>
          <Button
            variant={background.type === 'video' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ ...background, type: 'video' })}
            className="flex-1"
          >
            <Video className="w-4 h-4 mr-1" />
            Video
          </Button>
        </div>
      </div>

      {/* Color Options */}
      {background.type === 'color' && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-400 uppercase font-semibold">Color</p>
          
          {/* Preset Colors */}
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onUpdate({ ...background, color })}
                className={`w-8 h-8 rounded border-2 transition-all ${
                  background.color === color
                    ? 'border-blue-500 scale-110'
                    : 'border-transparent hover:border-white/50'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Custom Color */}
          <div className="flex gap-2 items-center">
            <input
              ref={colorInputRef}
              type="color"
              value={background.color}
              onChange={(e) => onUpdate({ ...background, color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer bg-transparent"
            />
            <Input
              type="text"
              value={background.color}
              onChange={(e) => onUpdate({ ...background, color: e.target.value })}
              className="flex-1 text-sm"
              placeholder="#000000"
            />
          </div>
        </div>
      )}

      {/* Image/Video Options */}
      {(background.type === 'image' || background.type === 'video') && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-400 uppercase font-semibold">
            {background.type === 'image' ? 'Image' : 'Video'} Source
          </p>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMediaLibrary}
            className="w-full"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Select from Library
          </Button>

          {background.url && (
            <div className="mt-2 p-2 bg-white/5 rounded text-xs text-gray-400 truncate">
              Current: {background.url.substring(0, 40)}...
            </div>
          )}

          {background.type === 'video' && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={background.loop ?? true}
                  onChange={(e) => onUpdate({ ...background, loop: e.target.checked })}
                  className="rounded"
                />
                Loop Video
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={background.muted ?? true}
                  onChange={(e) => onUpdate({ ...background, muted: e.target.checked })}
                  className="rounded"
                />
                Mute Audio
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
